import { insertUsageEvent } from "../db";

/**
 * AI usage telemetry — one tiny helper recorded by every model call site.
 * Powers the admin cost dashboard. costUsd is computed at write time from the
 * pricing table below, so the figure is locked to the price at call time.
 * All writes are fire-and-forget and fully guarded: telemetry must NEVER
 * break or slow a user-facing response.
 */

interface Price {
  input: number; // $ per 1M tokens
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const price = (input: number, output: number): Price => ({
  input,
  output,
  // Anthropic publishes cache-read at 0.1× input and cache-write at 1.25×;
  // close enough for Gemini's cached-content tier too (estimates either way).
  cacheRead: input * 0.1,
  cacheWrite: input * 1.25,
});

/** Exact-match pricing (USD per 1M tokens). */
const MODEL_PRICING: Record<string, Price> = {
  // Anthropic (per official pricing: Opus 4.x $5/$25, Fable/Mythos $10/$50,
  // Sonnet $3/$15, Haiku 4.5 $1/$5)
  "claude-fable-5": price(10, 50),
  "claude-mythos-5": price(10, 50),
  "claude-opus-5": price(5, 25),
  "claude-opus-4-8": price(5, 25),
  "claude-opus-4-7": price(5, 25),
  "claude-opus-4-6": price(5, 25),
  "claude-opus-4-5": price(5, 25),
  "claude-sonnet-5": price(3, 15),
  "claude-sonnet-4-6": price(3, 15),
  "claude-sonnet-4-5": price(3, 15),
  "claude-haiku-4-5": price(1, 5),
  // Google Gemini (approximate list prices; scouts auto-select new IDs, so
  // family fallbacks below carry most of the weight)
  "gemini-2.5-flash": price(0.3, 2.5),
  "gemini-2.5-pro": price(1.25, 10),
};

/**
 * Family fallbacks for auto-selected model IDs we haven't priced exactly
 * (e.g. gemini-3.5-flash, gemini-3.1-pro-preview, future Claude tiers).
 * First match wins; conservative tier assumptions keep estimates honest.
 */
const FAMILY_PRICING: [RegExp, Price][] = [
  [/^claude.*(fable|mythos)/, price(10, 50)],
  [/^claude.*opus/, price(5, 25)],
  [/^claude.*haiku/, price(1, 5)],
  [/^claude/, price(3, 15)], // sonnet-tier default
  [/^gemini.*flash/, price(0.3, 2.5)],
  [/^gemini.*pro/, price(1.25, 10)],
  [/^gemini/, price(1.25, 10)],
];

export function priceFor(model: string): Price {
  const exact = MODEL_PRICING[model];
  if (exact) return exact;
  for (const [rx, p] of FAMILY_PRICING) if (rx.test(model)) return p;
  return price(3, 15); // unknown model — count it at a mid tier rather than $0
}

export interface TokenCounts {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export function computeCostUsd(model: string, t: TokenCounts): number {
  const p = priceFor(model);
  return (
    ((t.inputTokens ?? 0) / 1_000_000) * p.input +
    ((t.outputTokens ?? 0) / 1_000_000) * p.output +
    ((t.cacheReadTokens ?? 0) / 1_000_000) * p.cacheRead +
    ((t.cacheWriteTokens ?? 0) / 1_000_000) * p.cacheWrite
  );
}

/** Context threaded from call sites: whose call, for which pipeline feature. */
export interface UsageMeta {
  userId?: string | null;
  feature?: string;
}

function record(provider: "anthropic" | "google", model: string, meta: UsageMeta | undefined, t: TokenCounts): void {
  const total =
    (t.inputTokens ?? 0) + (t.outputTokens ?? 0) + (t.cacheReadTokens ?? 0) + (t.cacheWriteTokens ?? 0);
  if (total === 0) return; // nothing meaningful to record
  void insertUsageEvent({
    userId: meta?.userId ?? null,
    provider,
    model,
    feature: meta?.feature ?? "other",
    inputTokens: t.inputTokens ?? 0,
    outputTokens: t.outputTokens ?? 0,
    cacheReadTokens: t.cacheReadTokens ?? 0,
    cacheWriteTokens: t.cacheWriteTokens ?? 0,
    costUsd: computeCostUsd(model, t),
  }).catch(() => {
    /* telemetry is best-effort — never surface to the caller */
  });
}

/** Anthropic Messages API usage shape (also covers the beta fallback path). */
interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function recordClaudeUsage(
  usage: AnthropicUsage | null | undefined,
  model: string,
  meta?: UsageMeta
): void {
  if (!usage) return;
  try {
    record("anthropic", model, meta, {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    });
  } catch {
    /* never throw */
  }
}

/** Gemini generateContent usageMetadata shape. */
interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number | null;
}

export function recordGeminiUsage(
  usage: GeminiUsage | null | undefined,
  model: string,
  meta?: UsageMeta
): void {
  if (!usage) return;
  try {
    record("google", model, meta, {
      inputTokens: usage.promptTokenCount ?? 0,
      // Thinking tokens bill as output on Gemini.
      outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
      cacheReadTokens: usage.cachedContentTokenCount ?? 0,
    });
  } catch {
    /* never throw */
  }
}
