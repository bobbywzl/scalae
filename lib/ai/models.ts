import { listClaudeModels } from "./claude";
import { listGeminiModels } from "./gemini";

/**
 * Automatic "best + latest available" model selection, per pipeline role.
 *
 * The desk should always run on the strongest current model for each job
 * without a human re-pinning IDs (and without a pinned ID silently breaking a
 * run when the provider retires it). So instead of hardcoding model strings,
 * each role declares WHAT KIND of model it wants (a pattern) and the resolver
 * picks the best CURRENTLY-AVAILABLE match from the provider's live model list:
 *
 *   - self-healing: a retired/unavailable model is never selected;
 *   - auto-latest: a newer version in the same line is adopted automatically
 *     (gemini-3.5-flash → gemini-4-flash, claude-opus-4-8 → claude-opus-5, …);
 *   - overridable: a per-role env var always wins, to pin a model by hand.
 *
 * TIER = "flagship": top-of-line without the pricier Fable/Mythos tier (which
 * needs 30-day data retention and costs ~2×). To move synthesis to that tier,
 * add `fable|mythos` to the `synthesis` include below, or set
 * CLAUDE_SYNTHESIS_MODEL. To drop to the value tier, set it to a Sonnet model.
 *
 * Reviewed monthly by .github/workflows/model-review.yml, which opens an issue
 * summarising each provider's current lineup so a human can approve adopting a
 * genuinely new model family (consistent with FOUNDATION.md's approval gates).
 */

export const MODELS_REVIEWED_AT = "2026-07";

export type ModelRole = "synthesis" | "chat" | "triage" | "scoutBreadth" | "scoutDeep";
type Provider = "claude" | "gemini";

interface RoleConfig {
  provider: Provider;
  /** Env var that pins/overrides the auto-choice. */
  env: string;
  /** Models eligible for this role. */
  include: RegExp;
  /** Disqualified variants (fast-mode routing IDs, media/embedding models, …). */
  exclude: RegExp;
  /** Conservative floor used only if the live model list can't be fetched. */
  fallback: string;
}

const ROLES: Record<ModelRole, RoleConfig> = {
  // Claude — newest flagship Opus (add `fable|mythos` here for the top tier).
  synthesis: {
    provider: "claude",
    env: "CLAUDE_SYNTHESIS_MODEL",
    include: /^claude-opus-\d/,
    exclude: /-(fast|latest)\b/,
    fallback: "claude-opus-4-8",
  },
  chat: {
    provider: "claude",
    env: "CLAUDE_CHAT_MODEL",
    include: /^claude-opus-\d/,
    exclude: /-(fast|latest)\b/,
    fallback: "claude-opus-4-8",
  },
  triage: {
    provider: "claude",
    env: "CLAUDE_TRIAGE_MODEL",
    include: /^claude-opus-\d/,
    exclude: /-(fast|latest)\b/,
    fallback: "claude-opus-4-8",
  },
  // Gemini — newest full Flash (breadth) and newest Pro (deep dives), both with
  // native Google-Search grounding. Exclude media/embedding/lite variants.
  scoutBreadth: {
    provider: "gemini",
    env: "GEMINI_MODEL",
    include: /^gemini-[\d.]+-flash/,
    exclude: /(lite|embedding|aqa|tts|image|audio|live|vision|learnlm|robotics|thinking)/,
    fallback: "gemini-2.5-flash",
  },
  scoutDeep: {
    provider: "gemini",
    env: "GEMINI_DEEP_MODEL",
    include: /^gemini-[\d.]+-pro/,
    exclude: /(embedding|aqa|tts|image|audio|live|vision|learnlm|robotics)/,
    fallback: "gemini-2.5-pro",
  },
};

/**
 * Rank candidates: newest version wins; within the same version a stable model
 * beats a preview/experimental/dated snapshot, and a full model beats a "lite".
 * Penalties are smaller than one minor-version step so they only break ties.
 */
function score(id: string): number {
  const n = (id.match(/\d+/g) ?? []).map(Number);
  let s = (n[0] ?? 0) * 1_000_000 + (n[1] ?? 0) * 1_000;
  if (/preview|-exp\b|experimental|\d{8}/.test(id)) s -= 200;
  if (/lite/.test(id)) s -= 400;
  return s - id.length; // final tie-break: the shorter, canonical id
}

interface CacheEntry {
  ids: Set<string>;
  at: number;
}
const store = ((globalThis as unknown as { __scalaeModelCache?: Partial<Record<Provider, CacheEntry>> })
  .__scalaeModelCache ??= {});
const OK_TTL = 6 * 3_600_000; // re-check available models every ~6h
const MISS_TTL = 15 * 60_000; // retry sooner if a list fetch failed

/** Available model IDs for a provider (cached; never throws). */
async function available(p: Provider): Promise<Set<string>> {
  const c = store[p];
  const ttl = c && c.ids.size ? OK_TTL : MISS_TTL;
  if (c && Date.now() - c.at < ttl) return c.ids;
  let ids: string[] = [];
  try {
    ids = p === "claude" ? await listClaudeModels() : await listGeminiModels();
  } catch (e) {
    console.error(`[scalae] listing ${p} models failed:`, e instanceof Error ? e.message : e);
  }
  store[p] = { ids: new Set(ids), at: Date.now() };
  return store[p]!.ids;
}

/**
 * Resolve the best available model for a role. Env override wins; otherwise the
 * top-scoring available model matching the role; otherwise the conservative
 * fallback. Never throws — model selection must not break a run.
 */
export async function resolveModel(role: ModelRole): Promise<string> {
  const cfg = ROLES[role];
  // Explicit pin wins: the role's own env var, then (Claude only) the legacy
  // global CLAUDE_MODEL. Unset these to let auto-selection track the frontier.
  const override =
    process.env[cfg.env] || (cfg.provider === "claude" ? process.env.CLAUDE_MODEL : undefined);
  if (override && override.trim()) return override.trim();
  const ids = await available(cfg.provider);
  const pick = [...ids]
    .filter((id) => cfg.include.test(id) && !cfg.exclude.test(id))
    .sort((a, b) => score(b) - score(a))[0];
  return pick ?? cfg.fallback;
}

/** Resolve every role at once (diagnostics + the monthly review). */
export async function resolveAllModels(): Promise<Record<ModelRole, string>> {
  const roles = Object.keys(ROLES) as ModelRole[];
  const vals = await Promise.all(roles.map(resolveModel));
  return Object.fromEntries(roles.map((r, i) => [r, vals[i]])) as Record<ModelRole, string>;
}
