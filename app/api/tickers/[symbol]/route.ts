import { NextResponse } from "next/server";
import {
  getTicker,
  latestRun,
  listFocusAreas,
  listMessages,
  listSignals,
  readingsForSignal,
  reapStuckRuns,
  recentDigest,
  removeTicker,
} from "@/lib/db";
import { getQuote } from "@/lib/market";
import type { DeskPayload, SignalWithReadings } from "@/lib/types";

type Params = { params: Promise<{ symbol: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTicker(symbol);
  if (!ticker) return NextResponse.json({ error: "not found" }, { status: 404 });

  await reapStuckRuns(symbol);
  const [quote, activeSignals, focusAreas, suggested, retired, run, digest, messages] =
    await Promise.all([
      getQuote(symbol),
      listSignals(symbol, "active"),
      listFocusAreas(symbol),
      listSignals(symbol, "suggested"),
      listSignals(symbol, "retired"),
      latestRun(symbol),
      recentDigest(symbol),
      listMessages(symbol),
    ]);

  const active: SignalWithReadings[] = await Promise.all(
    activeSignals.map(async (s) => {
      const history = await readingsForSignal(s.id, 20);
      return { ...s, latest: history[0] ?? null, history };
    })
  );

  const payload: DeskPayload = {
    ticker,
    quote,
    focusAreas,
    active,
    suggested,
    retired,
    latestRun: run ?? null,
    digest,
    messages,
  };
  return NextResponse.json(payload);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { symbol } = await params;
  await removeTicker(symbol.toUpperCase());
  return NextResponse.json({ ok: true });
}
