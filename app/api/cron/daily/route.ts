import { NextResponse, after } from "next/server";
import { autoResearchEnabled, listSignals, listTickers } from "@/lib/db";
import { executeRun, startRun } from "@/lib/agents/research";

// 300s is the Vercel Hobby ceiling (Fluid Compute); above the plan cap Vercel
// rejects the deployment. Pro/Enterprise allow up to 800.
export const maxDuration = 300;

const STALE_MS = 20 * 3600_000;

/**
 * Daily regeneration entry point, invoked by the Vercel cron (which sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically) or any scheduler.
 * Starts a research run for every onboarded desk whose last run is older than
 * 20 hours. The app also self-triggers per-desk on open.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The token-budget lever: when auto research is off, the cron is a no-op.
  // Enforced server-side so no client state can burn tokens overnight.
  if (!(await autoResearchEnabled())) {
    return NextResponse.json({ started: [], autoResearch: "off" });
  }

  const started: string[] = [];
  for (const t of await listTickers()) {
    if (!t.onboarded) continue;
    if ((await listSignals(t.symbol, "active")).length === 0) continue;
    const fresh = t.lastRunAt && Date.now() - Date.parse(t.lastRunAt) < STALE_MS;
    if (fresh) continue;
    const { run, started: isNew } = await startRun(t.symbol);
    if (isNew) {
      started.push(t.symbol);
      after(() => executeRun(run.id, t.symbol));
    }
  }
  return NextResponse.json({ started });
}
