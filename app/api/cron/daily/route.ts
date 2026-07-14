import { NextResponse, after } from "next/server";
import { autoResearchEnabled, listAllTickers, listSignals } from "@/lib/db";
import { executeRun, startRun } from "@/lib/agents/research";
import { staleThresholdMs } from "@/lib/cadence";

// 300s is the Vercel Hobby ceiling (Fluid Compute); above the plan cap Vercel
// rejects the deployment. Pro/Enterprise allow up to 800.
export const maxDuration = 300;

/**
 * Daily regeneration entry point, invoked by the Vercel cron (which sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically) or any scheduler.
 * Sweeps EVERY user's onboarded desks whose last run is older than their
 * adaptive staleness window — daily for active desks, backing off to every
 * ~2-3 days for dormant ones that keep reading "nothing new" (lib/cadence.ts) —
 * honoring each account's own auto-research switch, so one user pausing spend
 * never affects another.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const autoByUser = new Map<string, boolean>();
  const started: string[] = [];
  for (const t of await listAllTickers()) {
    if (!t.onboarded) continue;
    const uid = t.userId ?? "local";
    if (!autoByUser.has(uid)) autoByUser.set(uid, await autoResearchEnabled(uid));
    if (!autoByUser.get(uid)) continue;
    if ((await listSignals(uid, t.symbol, "active")).length === 0) continue;
    const fresh =
      t.lastRunAt && Date.now() - Date.parse(t.lastRunAt) < staleThresholdMs(t.quietRuns);
    if (fresh) continue;
    const { run, started: isNew } = await startRun(uid, t.symbol);
    if (isNew) {
      started.push(`${uid.slice(0, 6)}:${t.symbol}`);
      after(() => executeRun(uid, run.id, t.symbol));
    }
  }
  return NextResponse.json({ started });
}
