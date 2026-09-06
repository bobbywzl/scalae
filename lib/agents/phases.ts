import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Phased research runs.
 *
 * A research run (the board run and the single-signal check alike) is five
 * sequential model stages — question framing, wave-1 sweeps, gap triage,
 * wave-2 deep dives, synthesis — and one Vercel invocation is capped at the
 * route's maxDuration (300s on Hobby). Run inside ONE invocation, the stages
 * before synthesis routinely spend 200-280s of that budget on a busy board
 * (each may take up to 110s), leaving synthesis — the heaviest call, minutes
 * on the flagship model for a large board — a handful of seconds. It hit its
 * deadline on every run, the desk showed "took too long", and the retry
 * failed the same way.
 *
 * So a run is a chain of PHASES, each executed in its own invocation with a
 * fresh budget:
 *   sweep      → setup, question framing, wave-1 breadth sweeps
 *   probe      → gap triage, wave-2 deep dives
 *   synthesize → synthesis and recording (the run is complete after this)
 *   enrich     → trailing best-effort enrichment (context board, backstories)
 * Between phases the pipeline persists its state (the run_work table) and
 * hands the next phase to a NEW invocation through the internal continuation
 * route (app/api/internal/run-phase), authenticated with a token derived from
 * the deployment's secrets. When no continuation target resolves (local dev
 * without APP_URL, no secrets), the next phase runs in-process instead — the
 * pre-phase behavior, fine wherever no platform time limit applies.
 */

/** process.env or any plain env-shaped record (tests pass literals). */
type EnvLike = Readonly<Record<string, string | undefined>>;

export const RUN_PHASES = ["sweep", "probe", "synthesize", "enrich"] as const;
export type RunPhase = (typeof RUN_PHASES)[number];

export function isRunPhase(v: unknown): v is RunPhase {
  return typeof v === "string" && (RUN_PHASES as readonly string[]).includes(v);
}

/** The phase after `phase`, or null after the last one. */
export function nextRunPhase(phase: RunPhase): RunPhase | null {
  const i = RUN_PHASES.indexOf(phase);
  return i >= 0 && i + 1 < RUN_PHASES.length ? RUN_PHASES[i + 1] : null;
}

/**
 * Wall-clock budget of ONE phase: the 300s route maxDuration (the Vercel
 * Hobby ceiling; Pro/Enterprise allow more, but the phases are sized for the
 * floor) minus a platform margin.
 */
export const PHASE_BUDGET_MS = 285_000;

/**
 * Strict per-stage limit for the scout/triage/backstory stages: every such
 * stage must finish under two minutes; 110s leaves headroom under that
 * ceiling and stops any single stage from hanging and eating a phase.
 */
export const STAGE_LIMIT_MS = 110_000;

/** Kept free at the end of a phase for its state write and the hand-off request. */
const STAGE_RESERVE_MS = 10_000;

/**
 * Deadline for a stage starting now inside a phase that began at
 * `phaseStart`: the stage's cap (the flat stage limit unless the caller says
 * otherwise), shrunk to whatever the phase still has left minus a reserve.
 * Never negative — a stage that finds no time left fails fast and cleanly
 * instead of riding into the platform kill.
 */
export function stageBudgetMs(
  phaseStart: number,
  opts: { cap?: number; reserve?: number; now?: number } = {}
): number {
  const cap = opts.cap ?? STAGE_LIMIT_MS;
  const reserve = opts.reserve ?? STAGE_RESERVE_MS;
  const elapsed = (opts.now ?? Date.now()) - phaseStart;
  return Math.max(0, Math.min(cap, PHASE_BUDGET_MS - elapsed - reserve));
}

// ---------------------------------------------------------------------------
// The continuation target — where a phase hands the next one to.
// ---------------------------------------------------------------------------

export interface ContinuationTarget {
  /** The continuation route's absolute URL. */
  url: string;
  /** Bearer token the route expects (see continuationToken). */
  token: string;
  /** Vercel deployment-protection bypass, when the deployment sets one. */
  bypass?: string;
}

/**
 * The deployment's own public origin. APP_URL (already used for OAuth
 * redirects) wins; otherwise Vercel's system variables — the production
 * domain on production deployments, the per-deployment URL on previews.
 * Null outside any of those (local dev): phases then run in-process.
 */
export function continuationBaseUrl(env: EnvLike = process.env): string | null {
  const explicit = env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const production = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (env.VERCEL_ENV === "production" && production) return `https://${production}`;
  const deployment = env.VERCEL_URL?.trim();
  if (deployment) return `https://${deployment}`;
  return null;
}

/**
 * The bearer token the continuation route requires. RUN_PHASE_SECRET pins it
 * explicitly; otherwise it is DERIVED (HMAC) from a secret the deployment
 * already has — SESSION_SECRET (set wherever sign-in is on) or CRON_SECRET —
 * so no new configuration is needed, and the derived token reveals neither.
 * Null when no secret exists: the route then refuses every call and phases
 * run in-process.
 */
export function continuationToken(env: EnvLike = process.env): string | null {
  const explicit = env.RUN_PHASE_SECRET?.trim();
  if (explicit) return explicit;
  const seed = env.SESSION_SECRET?.trim() || env.CRON_SECRET?.trim();
  if (!seed) return null;
  return createHmac("sha256", seed).update("scalae:run-phase:v1").digest("hex");
}

export function continuationTarget(env: EnvLike = process.env): ContinuationTarget | null {
  const base = continuationBaseUrl(env);
  const token = continuationToken(env);
  if (!base || !token) return null;
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return { url: `${base}/api/internal/run-phase`, token, ...(bypass ? { bypass } : {}) };
}

/** Constant-time bearer comparison (length leaks nothing useful here). */
export function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/**
 * "accepted": the target claimed the phase and runs it in its own invocation.
 * "declined": the phase is not claimable there (already claimed, advanced, or
 *             the run is gone) — nothing to do here either.
 * "unavailable": the target could not be reached or refused the call
 *             (misconfiguration, deployment protection, an old deployment
 *             without the route) — run the phase in-process instead.
 */
export type ContinuationResult = "accepted" | "declined" | "unavailable";

export async function requestRunPhase(
  target: ContinuationTarget,
  runId: string,
  phase: RunPhase,
  fetchImpl: typeof fetch = fetch
): Promise<{ result: ContinuationResult; detail: string }> {
  try {
    const res = await fetchImpl(target.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${target.token}`,
        ...(target.bypass ? { "x-vercel-protection-bypass": target.bypass } : {}),
      },
      body: JSON.stringify({ runId, phase }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text().catch(() => "");
    const detail = `${res.status}${text ? ` ${text.slice(0, 120)}` : ""}`;
    if (res.status === 202 || res.status === 200) return { result: "accepted", detail };
    if (res.status === 409) return { result: "declined", detail };
    return { result: "unavailable", detail };
  } catch (e) {
    return { result: "unavailable", detail: e instanceof Error ? e.message : String(e) };
  }
}
