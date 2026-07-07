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
import { welcomeMessage } from "@/lib/agents/chat";
import type { WatchlistRow } from "@/lib/types";

const STALE_MS = 20 * 3600_000;

export async function GET() {
  const tickers = await listTickers();
  const rows: WatchlistRow[] = await Promise.all(
    tickers.map(async (t) => {
      await reapStuckRuns(t.symbol);
      const [quote, active, suggested, running] = await Promise.all([
        getQuote(t.symbol),
        listSignals(t.symbol, "active"),
        listSignals(t.symbol, "suggested"),
        runningRun(t.symbol),
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
      };
    })
  );
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { symbol?: string };
  const symbol = (body.symbol ?? "").trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const existing = await getTicker(symbol);
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
  const ticker = await addTicker(symbol, name);
  await insertMessage(symbol, "assistant", welcomeMessage(symbol, name));
  return NextResponse.json({ ticker }, { status: 201 });
}
