import Anthropic from "@anthropic-ai/sdk";

const g = globalThis as unknown as { __anthropic?: Anthropic };
// maxRetries covers 429/529/5xx inside the SDK; the loop below adds slower,
// longer backoff on top for overload bursts and transport drops.
const client = g.__anthropic ?? (g.__anthropic = new Anthropic({ maxRetries: 3 }));

/**
 * Model per pipeline stage (see README "Why these models"). Benchmarks and the
 * Anthropic model catalog (July 2026) put Claude Fable 5 — the most capable
 * generally available Claude — on the deep daily synthesis, where extracting
 * decision-relevant insight from a large evidence dump is the whole job, and
 * Claude Opus 4.8 on interactive chat + mid-run triage, where frontier quality
 * matters but turns must stay fast. Each is overridable via env.
 */
export const SYNTHESIS_MODEL =
  process.env.CLAUDE_SYNTHESIS_MODEL || process.env.CLAUDE_MODEL || "claude-fable-5";
export const CHAT_MODEL =
  process.env.CLAUDE_CHAT_MODEL || process.env.CLAUDE_MODEL || "claude-opus-4-8";
export const TRIAGE_MODEL = process.env.CLAUDE_TRIAGE_MODEL || CHAT_MODEL;
/** Where a Fable 5 request reroutes if safety classifiers decline it (rare). */
const FALLBACK_MODEL = "claude-opus-4-8";

export interface ClaudeJSONOptions {
  system: string;
  messages: Anthropic.MessageParam[];
  /** JSON Schema (additionalProperties:false everywhere) the response must satisfy. */
  schema: Record<string, unknown>;
  /** Defaults to CHAT_MODEL. */
  model?: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

// Transport failures that escape the SDK's typed wrappers (undici stream
// drops during streaming reads surface as raw TypeError: terminated).
const TRANSPORT_RX = /terminated|econnreset|socket hang up|fetch failed|aborted|network|other side closed/i;

function isTransportError(e: unknown): boolean {
  if (e instanceof Anthropic.APIConnectionError) return true;
  if (e instanceof Error) {
    if (TRANSPORT_RX.test(e.message)) return true;
    const cause = (e as Error & { cause?: unknown }).cause;
    if (cause instanceof Error && TRANSPORT_RX.test(cause.message)) return true;
  }
  return false;
}

function isRetryable(e: unknown): boolean {
  if (isTransportError(e)) return true;
  if (e instanceof Anthropic.APIError) {
    const { status, message } = e as unknown as { status?: number; message?: string };
    if (status === 429 || status === 529 || (status != null && status >= 500)) return true;
    if (message?.toLowerCase().includes("overloaded")) return true;
  }
  return false;
}

/** Turn SDK errors into copy a person can act on (no raw JSON blobs in the UI). */
export function friendlyAIError(e: unknown): string {
  if (e instanceof Anthropic.APIError) {
    const { status } = e as unknown as { status?: number };
    if (status === 529 || e.message?.toLowerCase().includes("overloaded")) {
      return "Anthropic's API is briefly overloaded. Your message was saved — hit retry in a moment.";
    }
    if (status === 429) {
      return "Anthropic rate limit hit. Wait a few seconds and retry.";
    }
    if (status === 401 || status === 403) {
      return "Anthropic API key was rejected — check ANTHROPIC_API_KEY in .env.local.";
    }
    if (status === 400 && e.message?.toLowerCase().includes("credit")) {
      return "Anthropic account is out of credits — top up, then retry.";
    }
  }
  if (isTransportError(e)) {
    return "Connection to Anthropic dropped mid-response. Your message was saved — hit retry.";
  }
  const msg = e instanceof Error ? e.message : String(e);
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
}

/**
 * One structured-output call to Claude. Adaptive thinking stays on (always-on
 * for Fable 5, default-configured for Opus 4.8); the response text is
 * schema-constrained JSON which we parse. Streams under the hood — synthesis
 * calls run for minutes and non-streaming requests are prone to connection
 * drops.
 */
export async function claudeJSON<T>(opts: ClaudeJSONOptions): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await claudeJSONOnce<T>(opts);
    } catch (e) {
      lastErr = e;
      if (isRetryable(e) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function claudeJSONOnce<T>(opts: ClaudeJSONOptions): Promise<T> {
  const model = opts.model ?? CHAT_MODEL;
  const params = {
    model,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: opts.messages,
    thinking: { type: "adaptive" },
    output_config: {
      ...(opts.effort ? { effort: opts.effort } : {}),
      format: {
        type: "json_schema",
        schema: opts.schema,
      },
    },
  };

  // Fable 5 runs safety classifiers that can decline a request (finance
  // content practically never trips them, but the API contract requires
  // handling it): opt into the server-side fallback so a declined call is
  // transparently re-run on Opus 4.8 in the same request.
  const fable = model.startsWith("claude-fable") || model.startsWith("claude-mythos");
  const stream = fable
    ? client.beta.messages.stream({
        ...params,
        betas: ["server-side-fallback-2026-06-01"],
        fallbacks: [{ model: FALLBACK_MODEL }],
      } as unknown as Parameters<typeof client.beta.messages.stream>[0])
    : client.messages.stream(params as Anthropic.MessageStreamParams);
  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined this request (safety refusal).");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude response was truncated (max_tokens reached).");
  }

  // response is Message | BetaMessage depending on the path — same text shape.
  const blocks = response.content as Array<{ type: string; text?: string }>;
  const text = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  if (!text) throw new Error("Claude returned no text content.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Claude returned unparseable JSON output.");
  }
}
