import { NextResponse } from "next/server";
import {
  addTicker,
  getTicker,
  insertMessage,
  listSignals,
  listTickers,
  reapStuckRuns,
  runningRun,
} from "@/lib/db";
import { getQuote, resolveSymbol } from "@/lib/market";
import { requireUser } from "@/lib/auth";
import { welcomeMessage } from "@/lib/agents/chat";
import { computeInvolvement } from "@/lib/portfolio";
import { requestLang } from "@/lib/i18n/server";
import type { WatchlistRow } from "@/lib/types";

const STALE_MS = 20 * 3600_000;

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tickers = await listTickers(user.id);
  const rows: WatchlistRow[] = await Promise.all(
    tickers.map(async (t) => {
      await reapStuckRuns(user.id, t.symbol);
      const [quote, active, suggested, running, position] = await Promise.all([
        getQuote(t.symbol),
        listSignals(user.id, t.symbol, "active"),
        listSignals(user.id, t.symbol, "suggested"),
        runningRun(user.id, t.symbol),
        computeInvolvement(user.id, t.symbol).catch(() => null),
      ]);
      const stale =
        !!t.onboarded &&
        !running &&
        (!t.lastRunAt || Date.now() - Date.parse(t.lastRunAt) > STALE_MS);
      return {
        ticker: t,
        quote,
        activeCount: active.length,
        suggestedCount: suggested.length,
        running: !!running,
        stale,
        position,
      };
    })
  );
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { symbol?: string };
  const symbol = (body.symbol ?? "").trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const existing = await getTicker(user.id, symbol);
  if (existing) {
    return NextResponse.json({ ticker: existing });
  }
  const name = await resolveSymbol(symbol);
  if (!name) {
    return NextResponse.json(
      { error: `Could not find "${symbol}" on the public market.` },
      { status: 404 }
    );
  }
  const ticker = await addTicker(user.id, symbol, name);
  // The desk's greeting is conversation, not board content — write it in the
  // investor's language directly (chat history keeps whatever language it
  // was written in, like any conversation).
  const lang = await requestLang(user.id);
  await insertMessage(user.id, symbol, "assistant", welcomeMessage(symbol, name, lang));
  return NextResponse.json({ ticker }, { status: 201 });
}
