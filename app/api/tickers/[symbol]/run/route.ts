import { NextResponse, after } from "next/server";
import { getTicker, listSignals } from "@/lib/db";
import { executeRun, startRun } from "@/lib/agents/research";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";
import { localizeRun } from "@/lib/i18n/translate";

// The deep pipeline (breadth sweeps → gap triage → deep-dive sweeps →
// synthesis) runs inside this budget via after(). 300s is the Vercel Hobby
// ceiling (Fluid Compute); Pro/Enterprise allow up to 800. A run that outlasts
// it is reaped and retried (see reapStuckRuns). Setting it above the plan cap
// makes Vercel reject the deployment, so keep this at the plan maximum.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/** Kick off a research run; the pipeline continues after the response returns. */
export async function POST(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTicker(user.id, symbol);
  if (!ticker) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (ticker.researchPaused) {
    return NextResponse.json({ error: "RESEARCH_PAUSED" }, { status: 409 });
  }
  if ((await listSignals(user.id, symbol, "active")).length === 0) {
    return NextResponse.json(
      { error: "Approve at least one signal before running research." },
      { status: 400 }
    );
  }

  const { run, started } = await startRun(user.id, symbol);
  if (started) {
    after(() => executeRun(user.id, run.id, symbol));
  }
  const lang = await requestLang(user.id);
  return NextResponse.json({ run: await localizeRun(run, lang, { userId: user.id }), started });
}
