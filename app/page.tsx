"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AddTicker } from "@/components/AddTicker";
import { Sparkline } from "@/components/Sparkline";
import { api, fmtPct, fmtPrice } from "@/components/util";
import type { WatchlistRow } from "@/lib/types";

export default function WatchlistPage() {
  const [rows, setRows] = useState<WatchlistRow[] | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    // Formatted client-side only: server/browser locales differ and break hydration.
    setToday(
      new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    );
  }, []);

  const load = useCallback(async () => {
    try {
      const { rows } = await api<{ rows: WatchlistRow[] }>("/api/tickers");
      setRows(rows);
    } catch {
      /* keep last state */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

  async function remove(symbol: string) {
    if (!confirm(`Remove ${symbol} and its desk (signals, readings, chat)?`)) return;
    await api(`/api/tickers/${symbol}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 flex-1">
      <header className="mb-6">
        <p className="text-muted text-sm font-medium min-h-5">{today}</p>
        <h1 className="text-3xl font-bold tracking-tight">Scalae</h1>
        <p className="text-muted text-sm mt-1">
          In the long run, the market is a weighing machine — desks that weigh your businesses
          daily, from the open web.
        </p>
      </header>

      <AddTicker />

      <section className="mt-6">
        {rows === null ? (
          <div className="text-muted text-sm py-16 text-center">Loading watchlist…</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-medium">No desks yet</p>
            <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
              Add a ticker above to open a Scalae desk — an onboarding chat will ask what you want
              to understand about the business, then track it daily.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
            {rows.map(({ ticker, quote, activeCount, suggestedCount, running, stale }) => {
              const up = (quote?.changePercent ?? 0) >= 0;
              return (
                <li key={ticker.symbol} className="group relative">
                  <Link
                    href={`/t/${encodeURIComponent(ticker.symbol)}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/4 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{ticker.symbol}</div>
                      <div className="text-muted text-xs truncate">{ticker.name}</div>
                      <div className="text-[11px] mt-1 flex items-center gap-2">
                        {!ticker.onboarded ? (
                          <span className="text-accent">Set up your desk →</span>
                        ) : (
                          <>
                            <span className="text-muted">{activeCount} signals</span>
                            {suggestedCount > 0 && (
                              <span className="text-warn">
                                ● {suggestedCount} proposal{suggestedCount > 1 ? "s" : ""} to review
                              </span>
                            )}
                            {running && <span className="text-accent pulse-soft">● researching…</span>}
                            {stale && !running && <span className="text-muted/70">research due</span>}
                          </>
                        )}
                      </div>
                    </div>
                    <Sparkline data={quote?.spark ?? []} positive={up} />
                    <div className="text-right w-24 shrink-0">
                      <div className="font-medium tabular-nums">
                        {fmtPrice(quote?.price, quote?.currency)}
                      </div>
                      <div
                        className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums text-black ${
                          up ? "bg-gain" : "bg-loss"
                        }`}
                      >
                        {fmtPct(quote?.changePercent)}
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      remove(ticker.symbol);
                    }}
                    title={`Remove ${ticker.symbol}`}
                    className="absolute -left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted hover:text-loss px-1 text-xs transition-opacity"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="mt-10 text-center text-[11px] text-muted/60">
        Research by Claude (analyst) + Gemini (web scout). Quotes via Yahoo Finance. Educational
        research tool — not investment advice.
      </footer>
    </main>
  );
}
