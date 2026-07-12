"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PnlChart, fmtUsd } from "@/components/PnlChart";
import { TradeForm } from "@/components/TradeForm";
import { api } from "@/components/util";
import { optionLabel } from "@/lib/portfolio-math";
import { daysUntil } from "@/components/util";
import type { PortfolioPayload, Trade } from "@/lib/types";

const fmtNative = (v: number, currency: string, digits = 2) =>
  `${currency === "USD" ? "$" : currency + " "}${v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

const signCls = (v: number | null | undefined) =>
  v == null ? "text-muted" : v >= 0 ? "text-gain" : "text-loss";

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-card border border-hairline px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${tone ?? ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted mt-0.5 tabular-nums">{sub}</p>}
    </div>
  );
}

function PctChip({ v }: { v: number | null }) {
  if (v == null) return null;
  return (
    <span className={`rounded px-1.5 py-px text-[10px] font-semibold tabular-nums ${v >= 0 ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"}`}>
      {v >= 0 ? "+" : ""}
      {v.toFixed(1)}%
    </span>
  );
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showTrades, setShowTrades] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<PortfolioPayload>("/api/portfolio"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio");
    }
  }, []);

  useEffect(() => {
    // Same initial-fetch-then-poll idiom as the watchlist/desk pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function removeTrade(t: Trade) {
    if (!confirm(`Delete this trade? ${t.side} ${t.quantity} ${t.symbol} @ ${t.price}`)) return;
    await api(`/api/portfolio/trades/${t.id}`, { method: "DELETE" });
    load();
  }

  const s = data?.summary;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap mb-5">
        <Link href="/" className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity">
          ‹ Watchlist
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">Portfolio</h1>
          <p className="text-muted text-xs">{s?.currencyNote ?? "Positions, options and P&L."}</p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
        >
          + Record trade
        </button>
      </header>

      {error && <p className="text-loss text-sm mb-4">{error}</p>}
      {adding && (
        <div className="mb-5">
          <TradeForm
            onSaved={() => {
              setAdding(false);
              load();
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {!data ? (
        <div className="text-muted text-sm py-16 text-center">Loading portfolio…</div>
      ) : data.trades.length === 0 && !adding ? (
        <div className="py-16 text-center">
          <p className="text-lg font-medium">No trades recorded yet</p>
          <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
            Record your buys and sells (stocks and options) to see live P&L, cost basis, and your
            involvement on each ticker’s desk.
          </p>
          <button
            onClick={() => setAdding(true)}
            className="mt-4 rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2"
          >
            Record your first trade
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary tiles */}
          {s && (
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Market value" value={fmtUsd(s.marketValue)} sub={`cost ${fmtUsd(s.costBasis)}`} />
              <StatTile
                label="Total P&L"
                value={fmtUsd(s.totalPnl, { sign: true })}
                tone={signCls(s.totalPnl)}
                sub={s.dayChange != null ? `${fmtUsd(s.dayChange, { sign: true })} today` : undefined}
              />
              <StatTile label="Unrealized" value={fmtUsd(s.unrealized, { sign: true })} tone={signCls(s.unrealized)} />
              <StatTile label="Realized" value={fmtUsd(s.realized, { sign: true })} tone={signCls(s.realized)} />
            </section>
          )}

          {/* P&L chart */}
          <section className="rounded-2xl bg-card border border-hairline p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted font-semibold mb-2">
              P&L over time <span className="normal-case tracking-normal font-normal">(USD)</span>
            </p>
            <PnlChart series={data.series} />
            {data.options.length > 0 && (
              <p className="text-[10px] text-muted/70 mt-2">
                Options are marked at live contract quotes where available (intrinsic value otherwise, and for history).
              </p>
            )}
            {data.unpriced.length > 0 && (
              <p className="text-[10px] text-warn mt-1">No market data for: {data.unpriced.join(", ")} — excluded from the curve.</p>
            )}
          </section>

          {/* Stock positions */}
          <section>
            <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">Stocks</p>
            {data.stocks.length === 0 ? (
              <p className="text-muted text-xs italic mt-2">No open stock positions.</p>
            ) : (
              <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                {data.stocks.map((p) => (
                  <li key={p.key}>
                    <Link href={`/t/${encodeURIComponent(p.symbol)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/4 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">
                          {p.symbol} {p.qty < 0 && <span className="text-loss text-[10px] font-semibold ml-1">SHORT</span>}
                        </p>
                        <p className="text-[11px] text-muted tabular-nums">
                          {Math.abs(p.qty).toLocaleString()} sh @ {fmtNative(p.avgCost, p.currency)} avg
                          {p.realized !== 0 && <span className="ml-2">realized {fmtNative(p.realized, p.currency, 0)}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium tabular-nums">
                          {p.mark != null ? fmtNative(p.mark, p.currency) : "—"}
                          {p.dayChangePct != null && (
                            <span className={`ml-1.5 text-[10px] ${signCls(p.dayChangePct)}`}>
                              {p.dayChangePct >= 0 ? "+" : ""}
                              {p.dayChangePct.toFixed(1)}%
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] tabular-nums mt-0.5">
                          <span className={signCls(p.unrealized)}>
                            {p.unrealized != null ? fmtNative(p.unrealized, p.currency, 0) : "—"}
                          </span>{" "}
                          <PctChip v={p.unrealizedPct} />
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Options positions */}
          <section>
            <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">Options</p>
            {data.options.length === 0 ? (
              <p className="text-muted text-xs italic mt-2">No open option positions.</p>
            ) : (
              <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                {data.options.map((p) => {
                  const dte = p.expiry ? daysUntil(p.expiry) : null;
                  return (
                    <li key={p.key} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">
                          <Link href={`/t/${encodeURIComponent(p.symbol)}`} className="hover:text-accent transition-colors">
                            {p.symbol}
                          </Link>{" "}
                          <span className="text-[#c7c7cc]">{optionLabel(p)}</span>
                          {p.qty < 0 && <span className="text-warn text-[10px] font-semibold ml-1.5">SHORT</span>}
                          {p.expired && <span className="text-loss text-[10px] font-semibold ml-1.5">EXPIRED</span>}
                        </p>
                        <p className="text-[11px] text-muted tabular-nums">
                          {Math.abs(p.qty)} contract{Math.abs(p.qty) !== 1 ? "s" : ""} @ {fmtNative(p.avgCost, p.currency)} premium
                          {dte != null && dte >= 0 && !p.expired && <span className="ml-2">{dte}d to expiry</span>}
                          {p.markSource === "intrinsic" && !p.expired && <span className="ml-2 text-muted/70">intrinsic mark</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium tabular-nums">{p.mark != null ? fmtNative(p.mark, p.currency) : "—"}</p>
                        <p className="text-[11px] tabular-nums mt-0.5">
                          <span className={signCls(p.unrealized)}>
                            {p.unrealized != null ? fmtNative(p.unrealized, p.currency, 0) : "—"}
                          </span>{" "}
                          <PctChip v={p.unrealizedPct} />
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {data.options.some((o) => o.expired) && (
              <p className="text-[10px] text-muted mt-1.5">
                Expired positions are marked worthless — record a closing trade (or exercise) to realize them.
              </p>
            )}
          </section>

          {/* Trade history */}
          <section>
            <button
              onClick={() => setShowTrades((v) => !v)}
              className="text-[11px] uppercase tracking-widest text-muted font-semibold hover:text-[#c7c7cc] transition-colors"
            >
              Trade history ({data.trades.length}) {showTrades ? "▾" : "▸"}
            </button>
            {showTrades && (
              <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                {data.trades.map((t) => (
                  <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5 text-xs">
                    <span className="text-muted tabular-nums shrink-0">{t.tradeDate}</span>
                    <span className={`font-semibold ${t.side === "buy" ? "text-gain" : "text-loss"}`}>{t.side.toUpperCase()}</span>
                    <span className="min-w-0 truncate">
                      {t.quantity.toLocaleString()}{" "}
                      {t.kind === "option" ? `× ${t.symbol} ${optionLabel(t)}` : `${t.symbol}`} @{" "}
                      <span className="tabular-nums">{t.price.toLocaleString()}</span>
                      {t.fees > 0 && <span className="text-muted"> (+{t.fees} fees)</span>}
                      {t.note && <span className="text-muted"> — {t.note}</span>}
                    </span>
                    <button
                      onClick={() => removeTrade(t)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-muted hover:text-loss transition-opacity shrink-0"
                      title="Delete trade"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <footer className="mt-10 text-center text-[11px] text-muted/60">
        Manual ledger, average-cost method. Educational research tool — not investment advice.
      </footer>
    </main>
  );
}
