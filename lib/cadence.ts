/**
 * Adaptive research cadence — the token lever for the daily cron.
 *
 * FOUNDATION.md: signals are built for years of dormancy and fire on events,
 * never on a calendar; "nothing happened today" is the expected healthy output,
 * and activity is a cost, not a KPI. So a desk that keeps producing no new
 * evidence is genuinely dormant, and re-researching it every single day burns
 * tokens to reconfirm silence. This is where the daily sweep's cost compounds
 * as more tickers are added: tickers × days.
 *
 * The cron therefore backs off dormant desks. Each run updates a per-ticker
 * `quietRuns` counter: reset to 0 the moment a run finds ANY new evidence, and
 * incremented when a run is pure carry-forward. The staleness threshold a desk
 * must exceed to be swept scales with that counter — daily → every ~2 days →
 * every ~3 days — and snaps straight back to daily on the next real development.
 *
 * Deliberately conservative:
 *   - capped at ~3 days, so nothing dormant ever goes truly stale;
 *   - the manual "Run" button and the desk-open auto-refresh bypass it entirely
 *     (they don't consult this), so an investor always gets an on-demand run;
 *   - it only slows the UNATTENDED sweep of desks nobody is watching.
 */

/** Baseline daily staleness: a desk older than this is eligible for the cron. */
export const BASE_STALE_MS = 20 * 3_600_000; // ~daily (20h, matching the UI)

/**
 * How stale a desk must be before the daily cron re-researches it, given how
 * many consecutive runs found no new evidence. Steps daily → ~2d → ~3d.
 */
export function staleThresholdMs(quietRuns: number | null | undefined): number {
  const q = quietRuns ?? 0;
  if (q >= 4) return 68 * 3_600_000; // ~3 days — deeply dormant
  if (q >= 2) return 44 * 3_600_000; // ~2 days — quieting down
  return BASE_STALE_MS; // daily — active or just reset by new evidence
}
