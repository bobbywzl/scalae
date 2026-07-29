import { NextResponse } from "next/server";
import { getTicker, latestRun, listRunSweeps } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ symbol: string }> };

/**
 * The field file: a run's persisted scout reports, verbatim — the evidence
 * chain behind the brief (claim → reading → sweep → source), open for the
 * investor to audit. ?runId= selects a specific run (board or check); the
 * default is the latest completed board run. Rows are owner-scoped, so a
 * foreign runId simply returns empty.
 */
export async function GET(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  let runId = url.searchParams.get("runId");
  if (!runId) {
    const run = await latestRun(user.id, symbol);
    if (!run) return NextResponse.json({ runId: null, sweeps: [] });
    runId = run.id;
  }
  const sweeps = (await listRunSweeps(user.id, runId)).filter((s) => s.symbol === symbol);
  return NextResponse.json({ runId, sweeps });
}
