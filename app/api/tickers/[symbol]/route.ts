import { NextResponse } from "next/server";
import {
  autoResearchEnabled,
  getTicker,
  latestRun,
  listFocusAreas,
  listMessages,
  listSignals,
  readingsForSignal,
  reapStuckRuns,
  recentDigest,
  removeTicker,
  sourcesForSignals,
} from "@/lib/db";
import { getQuote } from "@/lib/market";
import { computeInvolvement } from "@/lib/portfolio";
import type { DeskPayload, SignalWithReadings } from "@/lib/types";

type Params = { params: Promise<{ symbol: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTicker(symbol);
  if (!ticker) return NextResponse.json({ error: "not found" }, { status: 404 });

  await reapStuckRuns(symbol);
  const [
    quote,
    activeSignals,
    focusAreas,
    suggested,
    retired,
    dismissed,
    run,
    digest,
    messages,
    sourcesMap,
    position,
  ] = await Promise.all([
    getQuote(symbol),
    listSignals(symbol, "active"),
    listFocusAreas(symbol),
    listSignals(symbol, "suggested"),
    listSignals(symbol, "retired"),
    listSignals(symbol, "dismissed"),
    latestRun(symbol),
    recentDigest(symbol),
    listMessages(symbol, 200, { signalId: null }), // desk-level thread only
    sourcesForSignals(symbol),
    computeInvolvement(symbol).catch(() => null),
  ]);
  const autoResearch = await autoResearchEnabled();

  const active: SignalWithReadings[] = await Promise.all(
    activeSignals.map(async (s) => {
      const history = await readingsForSignal(s.id, 20);
      return { ...s, latest: history[0] ?? null, history, sources: sourcesMap.get(s.id) ?? [] };
    })
  );

  const payload: DeskPayload = {
    ticker,
    quote,
    focusAreas,
    active,
    suggested,
    retired,
    dismissed,
    latestRun: run ?? null,
    digest,
    messages,
    position,
    autoResearch,
  };
  return NextResponse.json(payload);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { symbol } = await params;
  await removeTicker(symbol.toUpperCase());
  return NextResponse.json({ ok: true });
}
