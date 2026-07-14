/**
 * Overload fallback for interactive Claude calls. When the primary model
 * returns a 529 ("Overloaded" — a transient Anthropic capacity blip, most
 * common on the flagship Opus tier), retry the SAME call once on a
 * higher-capacity model instead of hard-failing the person waiting on it.
 *
 * Applied only to the calls a user synchronously waits on (desk chat, the
 * pairwise compare) — the daily research pipeline stays strictly on its
 * primary model, since a 529 there just means the run re-runs later and the
 * synthesis keeps its maximum-quality model.
 */

/** The model interactive calls fall back to when their primary is overloaded. */
export const CLAUDE_OVERLOAD_FALLBACK = process.env.CLAUDE_FALLBACK_MODEL || "claude-sonnet-5";

/** True for an Anthropic 529 / "overloaded" capacity error — the fallback trigger. */
export function isOverloaded(e: unknown): boolean {
  const err = e as { status?: number; message?: string } | null | undefined;
  if (!err) return false;
  if (err.status === 529) return true;
  return typeof err.message === "string" && err.message.toLowerCase().includes("overloaded");
}

/**
 * Run `run(primaryModel)`; if it fails with an overload error, run it once
 * more on `fallbackModel`. Anything else — a non-overload error, no fallback
 * configured, or a fallback identical to the primary — propagates unchanged.
 * If the fallback ALSO fails, the ORIGINAL overload error is surfaced: its
 * "briefly overloaded — retry in a moment" guidance is the actionable one.
 */
export async function withOverloadFallback<T>(
  primaryModel: string,
  fallbackModel: string | undefined,
  run: (model: string) => Promise<T>
): Promise<T> {
  try {
    return await run(primaryModel);
  } catch (e) {
    if (fallbackModel && fallbackModel !== primaryModel && isOverloaded(e)) {
      try {
        return await run(fallbackModel);
      } catch {
        throw e;
      }
    }
    throw e;
  }
}
