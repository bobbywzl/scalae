import { NextResponse } from "next/server";
import {
  autoResearchEnabled,
  getTicker,
  latestRun,
  latestSignalRun,
  listAccumulations,
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
import { chatTurnBusy, chatTurnError } from "@/lib/agents/chat";
import { getQuote } from "@/lib/market";
import { requireUser } from "@/lib/auth";
import { computeInvolvement } from "@/lib/portfolio";
import { requestLang } from "@/lib/i18n/server";
import { localizeDeskPayload, localizeRun } from "@/lib/i18n/translate";
import type { DeskPayload, Signal, SignalWithReadings } from "@/lib/types";

// The zh display path can pay a cold translation pass (several model batches
// after a fresh run) — the only content route without an explicit budget
// would otherwise ride the platform default and die mid-translation.
export const maxDuration = 120;

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
    signalRun,
    runsForProvenance,
    digest,
    accumulations,
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
    latestSignalRun(user.id, symbol),
    recentRuns(user.id, symbol, 15),
    recentDigest(user.id, symbol),
    listAccumulations(user.id, symbol),
    listMessages(user.id, symbol, 200, { signalId: null }), // desk-level thread only
    sourcesForSignals(user.id, symbol),
    computeInvolvement(user.id, symbol).catch(() => null),
  ]);
  const autoResearch = await autoResearchEnabled(user.id);
  // Chat-turn status for the desk thread: the analyst keeps thinking in the
  // background across reloads/tabs, and a failed turn stores its specific
  // reason — both surfaced so the UI shows honest state.
  const [analystBusy, analystError] = await Promise.all([
    chatTurnBusy(user.id, symbol, null),
    chatTurnError(user.id, symbol, null),
  ]);

  const withReadings = (s: Signal): Promise<SignalWithReadings> =>
    readingsForSignal(s.id, 20).then((history) => {
      // Backstory sources ride the signal row as a JSON TEXT column.
      let backstorySources: SignalWithReadings["backstorySources"] = [];
      try {
        const raw = (s as Signal & { backstorySources?: string }).backstorySources;
        if (raw) backstorySources = JSON.parse(raw);
      } catch {
        /* legacy/malformed — render backstory without linked citations */
      }
      return {
        ...s,
        latest: history[0] ?? null,
        history,
        sources: sourcesMap.get(s.id) ?? [],
        backstorySources,
      };
    });
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
    signalRun: signalRun ?? null,
    dossierRevisedAt,
    dossierHeldRuns,
    digest,
    accumulations,
    messages,
    position,
    autoResearch,
    analystBusy,
    analystError,
  };
  // Serve research content in the investor's display language (cached,
  // canonical English stays in the db; chat messages are never translated).
  // The signal-scoped check localizes separately — localizeDeskPayload only
  // walks board surfaces.
  const lang = await requestLang(user.id);
  const [localized, localizedSignalRun] = await Promise.all([
    localizeDeskPayload(payload, lang, { userId: user.id }),
    signalRun ? localizeRun(signalRun, lang, { userId: user.id }) : Promise.resolve(null),
  ]);
  return NextResponse.json({ ...localized, signalRun: localizedSignalRun });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol } = await params;
  await removeTicker(user.id, symbol.toUpperCase());
  return NextResponse.json({ ok: true });
}
