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
 *   - overridable: a per-role env var always wins, to pin a model by hand
 *     (legacy global GEMINI_MODEL / CLAUDE_MODEL pins are IGNORED with a warning).
 *
 * TIER by role (cost discipline — spend the flagship only where it is earned):
 *   - Opus (flagship): synthesis (the daily crown-jewel reading), compare, and
 *     the chat DEEP lane — signal building, document reads, desk actions,
 *     onboarding. These carry the desk's quality.
 *   - Sonnet (value): the chat FAST lane (simple working-chat Q&A answered in
 *     seconds from a compact snapshot; escalates to the deep lane for anything
 *     heavier), plus triage and backstory — bounded, high-frequency support
 *     work where the flagship is not earned.
 *   - Haiku (economy): display-language translation (mechanical, cached).
 * To move synthesis to the pricier Fable/Mythos tier (30-day retention, ~2×),
 * add `fable|mythos` to the `synthesis` include below, or set
 * CLAUDE_SYNTHESIS_MODEL. Any role can be re-pinned with its own env var.
 *
 * Reviewed monthly by .github/workflows/model-review.yml, which opens an issue
 * summarising each provider's current lineup so a human can approve adopting a
 * genuinely new model family (consistent with FOUNDATION.md's approval gates).
 */

export const MODELS_REVIEWED_AT = "2026-07";

export type ModelRole =
  | "synthesis"
  | "chat"
  | "chatFast"
  | "diligence"
  | "triage"
  | "backstory"
  | "scoutBreadth"
  | "scoutDeep"
  | "translate";
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
  // The chat FAST lane: simple working-chat Q&A answered from a compact desk
  // snapshot. It runs on every quick question, must come back in seconds, and
  // can take no desk action — the value tier is exactly right. Turns that
  // build signals, read documents, or synthesize new information escalate to
  // the flagship "chat" role above. (Pin with CLAUDE_CHAT_FAST_MODEL.)
  chatFast: {
    provider: "claude",
    env: "CLAUDE_CHAT_FAST_MODEL",
    include: /^claude-sonnet-\d/,
    exclude: /-(fast|latest)\b/,
    fallback: "claude-sonnet-5",
  },
  // Due-diligence record work: deep-research memos per section topic, the
  // standing synthesis of core insights, and section-topic suggestions. Runs
  // ONLY on the investor's explicit ask (never on the daily cron), and the
  // memo is the record's centrepiece — flagship quality is earned here.
  diligence: {
    provider: "claude",
    env: "CLAUDE_DILIGENCE_MODEL",
    include: /^claude-opus-\d/,
    exclude: /-(fast|latest)\b/,
    fallback: "claude-opus-4-8",
  },
  // Mid-run gap triage: read the breadth sweeps against the board and decide
  // which threads deserve a deep dive. A bounded routing/judgment task that
  // runs on EVERY desk EVERY day — the value tier (Sonnet) handles it well and
  // the flagship's cost here is not earned. The crown-jewel synthesis that
  // follows stays on Opus. (Pin with CLAUDE_TRIAGE_MODEL to override.)
  triage: {
    provider: "claude",
    env: "CLAUDE_TRIAGE_MODEL",
    include: /^claude-sonnet-\d/,
    exclude: /-(fast|latest)\b/,
    fallback: "claude-sonnet-5",
  },
  // Signal deep-history backstory: background enrichment written once per
  // signal and cached forever, not the daily reading. Sonnet is plenty; keeping
  // it off Opus removes up to two flagship calls from every research run.
  backstory: {
    provider: "claude",
    env: "CLAUDE_BACKSTORY_MODEL",
    include: /^claude-sonnet-\d/,
    exclude: /-(fast|latest)\b/,
    fallback: "claude-sonnet-5",
  },
  // Display-language translation of stored research content (cached per text
  // in the translations table). High-volume, mechanical — the value tier is
  // plenty, and results are cached so each text is translated exactly once.
  translate: {
    provider: "claude",
    env: "CLAUDE_TRANSLATE_MODEL",
    include: /^claude-haiku-\d/,
    exclude: /-(fast|latest)\b/,
    fallback: "claude-haiku-4-5-20251001",
  },
  // Gemini — newest full Flash (breadth) and newest Pro (deep dives), both with
  // native Google-Search grounding. Exclude media/embedding/lite variants.
  // Breadth floor raised to 3.5 Flash: auto-selection already adopts the newest
  // available Flash, so the fallback only bites when the live list is
  // unreachable — it should never regress the mass scout to an older line.
  scoutBreadth: {
    provider: "gemini",
    env: "GEMINI_BREADTH_MODEL",
    include: /^gemini-[\d.]+-flash/,
    exclude: /(lite|embedding|aqa|tts|image|audio|live|vision|learnlm|robotics|thinking)/,
    fallback: "gemini-3.5-flash",
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
  // Only the ROLE-SPECIFIC env var pins a model. The legacy globals
  // (GEMINI_MODEL, CLAUDE_MODEL) are deliberately IGNORED: they linger from
  // early deployments and silently froze the desk on old models (the exact
  // failure this resolver exists to prevent). We warn so they get cleaned up.
  const override = process.env[cfg.env];
  if (override && override.trim()) return override.trim();
  const legacy = cfg.provider === "claude" ? process.env.CLAUDE_MODEL : process.env.GEMINI_MODEL;
  if (legacy && !warnedLegacy.has(cfg.provider)) {
    warnedLegacy.add(cfg.provider);
    console.warn(
      `[scalae] ignoring legacy ${cfg.provider === "claude" ? "CLAUDE_MODEL" : "GEMINI_MODEL"}="${legacy}" — ` +
        `auto-selection tracks the newest model; pin per role with ${cfg.env} if you really want a fixed one.`
    );
  }
  const ids = await available(cfg.provider);
  const pick = [...ids]
    .filter((id) => cfg.include.test(id) && !cfg.exclude.test(id))
    .sort((a, b) => score(b) - score(a))[0];
  if (!pick) {
    console.warn(`[scalae] no live ${cfg.provider} model matched role "${role}" — using fallback ${cfg.fallback}`);
  }
  return pick ?? cfg.fallback;
}

const warnedLegacy = new Set<Provider>();

/** Resolve every role at once (diagnostics + the monthly review). */
export async function resolveAllModels(): Promise<Record<ModelRole, string>> {
  const roles = Object.keys(ROLES) as ModelRole[];
  const vals = await Promise.all(roles.map(resolveModel));
  return Object.fromEntries(roles.map((r, i) => [r, vals[i]])) as Record<ModelRole, string>;
}
