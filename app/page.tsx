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
  const [autoResearch, setAutoResearch] = useState<boolean | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    api<{ autoResearch: boolean }>("/api/settings")
      .then((s) => {
        if (!cancelled) setAutoResearch(s.autoResearch);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The token-budget lever: gates the cron AND stale-desk auto-runs (server-
  // enforced for the cron). Manual runs and explicit chat asks still work.
  async function toggleAutoResearch() {
    if (autoResearch === null || savingAuto) return;
    const next = !autoResearch;
    setSavingAuto(true);
    setAutoResearch(next); // optimistic
    try {
      await api(`/api/settings`, { method: "POST", body: JSON.stringify({ autoResearch: next }) });
    } catch {
      setAutoResearch(!next); // revert on failure
    } finally {
      setSavingAuto(false);
    }
  }

  async function remove(symbol: string) {
    if (!confirm(`Remove ${symbol} and its desk (signals, readings, chat)?`)) return;
    await api(`/api/tickers/${symbol}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 flex-1">
      <header className="mb-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-muted text-sm font-medium min-h-5">{today}</p>
            <h1 className="text-3xl font-bold tracking-tight">Scalae</h1>
            <p className="text-muted text-sm mt-1">
              In the long run, the market is a weighing machine — desks that weigh your businesses
              daily, from the open web.
            </p>
          </div>
          <Link
            href="/portfolio"
            title="Portfolio — positions, options and P&L"
            className="shrink-0 mt-5 flex items-center gap-2 rounded-xl bg-card border border-hairline hover:border-white/25 hover:bg-white/4 px-3 py-2 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
              <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" />
              <path d="M3 12h18" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="text-xs font-semibold">Portfolio</span>
          </Link>
        </div>

        {/* Auto daily research switch — the token spend lever. */}
        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-card border border-hairline px-3.5 py-2.5">
          <button
            role="switch"
            aria-checked={autoResearch === true}
            disabled={autoResearch === null || savingAuto}
            onClick={toggleAutoResearch}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              autoResearch ? "bg-gain" : "bg-white/15"
            }`}
            title={autoResearch ? "Turn off automatic daily research" : "Turn on automatic daily research"}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                autoResearch ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold">
              Auto daily research{" "}
              <span className={autoResearch ? "text-gain" : "text-muted"}>
                {autoResearch === null ? "…" : autoResearch ? "on" : "off"}
              </span>
            </p>
            <p className="text-[11px] text-muted leading-snug">
              {autoResearch === false
                ? "Desks only research when you ask — the Run button or telling the analyst. The daily cron is paused (no background token spend)."
                : "Every desk researches once a day (cron + on stale open). Turn off to spend tokens only on demand."}
            </p>
          </div>
        </div>
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
            {rows.map(({ ticker, quote, activeCount, suggestedCount, running, stale, position }) => {
              const up = (quote?.changePercent ?? 0) >= 0;
              const held = position && (position.stock || position.options.length > 0);
              return (
                <li key={ticker.symbol} className="group relative">
                  <Link
                    href={`/t/${encodeURIComponent(ticker.symbol)}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/4 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {ticker.symbol}
                        {held && (
                          <span
                            className={`ml-2 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide align-middle ${
                              (position!.unrealized ?? 0) >= 0
                                ? "bg-gain/15 text-gain"
                                : "bg-loss/15 text-loss"
                            }`}
                            title={
                              position!.stock
                                ? `${Math.abs(position!.stock.qty)} shares @ ${position!.stock.avgCost.toFixed(2)} avg${
                                    position!.options.length ? ` + ${position!.options.length} option leg(s)` : ""
                                  }`
                                : `${position!.options.length} option leg(s)`
                            }
                          >
                            held
                            {position!.stock?.unrealizedPct != null &&
                              ` ${position!.stock.unrealizedPct >= 0 ? "+" : ""}${position!.stock.unrealizedPct.toFixed(1)}%`}
                          </span>
                        )}
                      </div>
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
