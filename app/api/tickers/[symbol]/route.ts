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
  recentRuns,
  removeTicker,
  sourcesForSignals,
} from "@/lib/db";
import { getQuote } from "@/lib/market";
import { requireUser } from "@/lib/auth";
import { computeInvolvement } from "@/lib/portfolio";
import type { DeskPayload, Signal, SignalWithReadings } from "@/lib/types";

type Params = { params: Promise<{ symbol: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTicker(user.id, symbol);
  if (!ticker) return NextResponse.json({ error: "not found" }, { status: 404 });

  await reapStuckRuns(user.id, symbol);
  const [
    quote,
    activeSignals,
    focusAreas,
    suggested,
    retiredSignals,
    dismissed,
    run,
    runsForProvenance,
    digest,
    messages,
    sourcesMap,
    position,
  ] = await Promise.all([
    getQuote(symbol),
    listSignals(user.id, symbol, "active"),
    listFocusAreas(user.id, symbol),
    listSignals(user.id, symbol, "suggested"),
    listSignals(user.id, symbol, "retired"),
    listSignals(user.id, symbol, "dismissed"),
    latestRun(user.id, symbol),
    recentRuns(user.id, symbol, 15),
    recentDigest(user.id, symbol),
    listMessages(user.id, symbol, 200, { signalId: null }), // desk-level thread only
    sourcesForSignals(user.id, symbol),
    computeInvolvement(user.id, symbol).catch(() => null),
  ]);
  const autoResearch = await autoResearchEnabled(user.id);

  const withReadings = (s: Signal): Promise<SignalWithReadings> =>
    readingsForSignal(s.id, 20).then((history) => ({
      ...s,
      latest: history[0] ?? null,
      history,
      sources: sourcesMap.get(s.id) ?? [],
    }));
  // Retired signals keep their evidence trail — a swap never erases history.
  const [active, retired] = await Promise.all([
    Promise.all(activeSignals.map(withReadings)),
    Promise.all(retiredSignals.map(withReadings)),
  ]);

  // Dossier provenance: when did the standing view last actually change, and
  // for how many runs has it held? (Newest-first run list.)
  let dossierRevisedAt: string | null = null;
  let dossierHeldRuns = 0;
  const current = run?.dossier ?? null;
  if (current) {
    for (const r of runsForProvenance) {
      if (r.dossier === current) {
        dossierHeldRuns++;
        dossierRevisedAt = r.startedAt;
      } else break;
    }
  }

  const payload: DeskPayload = {
    ticker,
    quote,
    focusAreas,
    active,
    suggested,
    retired,
    dismissed,
    latestRun: run ?? null,
    dossierRevisedAt,
    dossierHeldRuns,
    digest,
    messages,
    position,
    autoResearch,
  };
  return NextResponse.json(payload);
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol } = await params;
  await removeTicker(user.id, symbol.toUpperCase());
  return NextResponse.json({ ok: true });
}
