import { NextResponse, after } from "next/server";
import { getTicker, listSignals } from "@/lib/db";
import { executeRun, startRun } from "@/lib/agents/research";

export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/** Kick off a research run; the pipeline continues after the response returns. */
export async function POST(_req: Request, { params }: Params) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!(await getTicker(symbol))) return NextResponse.json({ error: "not found" }, { status: 404 });
  if ((await listSignals(symbol, "active")).length === 0) {
    return NextResponse.json(
      { error: "Approve at least one signal before running research." },
      { status: 400 }
    );
  }

  const { run, started } = await startRun(symbol);
  if (started) {
    after(() => executeRun(run.id, symbol));
  }
  return NextResponse.json({ run, started });
}
