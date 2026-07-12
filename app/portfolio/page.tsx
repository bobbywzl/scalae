"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PnlChart, fmtUsd } from "@/components/PnlChart";
import { TradeForm } from "@/components/TradeForm";
import { api } from "@/components/util";
import { orderLabel } from "@/lib/order-math";
import { optionLabel } from "@/lib/portfolio-math";
import { daysUntil } from "@/components/util";
import type { Order, PortfolioPayload, Trade } from "@/lib/types";

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
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [divBusy, setDivBusy] = useState<string | null>(null);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [capEditing, setCapEditing] = useState(false);
  const [capInput, setCapInput] = useState("");
  const [capBusy, setCapBusy] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const [withholding, setWithholding] = useState<Record<string, string>>({});

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

  async function cancelOrder(o: Order) {
    setOrderBusy(o.id);
    try {
      await api(`/api/portfolio/orders/${o.id}`, { method: "DELETE" });
      await load();
    } finally {
      setOrderBusy(null);
    }
  }

  async function applyDividend(symbol: string, exDate: string) {
    setDivBusy(`${symbol}|${exDate}`);
    try {
      const withholdingPct = Number(withholding[`${symbol}|${exDate}`]) || 0;
      await api(`/api/portfolio/dividends`, {
        method: "POST",
        body: JSON.stringify({ symbol, exDate, withholdingPct }),
      });
      await load();
    } finally {
      setDivBusy(null);
    }
  }

  async function applyAllDividends() {
    setDivBusy("all");
    try {
      await api(`/api/portfolio/dividends`, { method: "POST", body: JSON.stringify({ all: true }) });
      await load();
    } finally {
      setDivBusy(null);
    }
  }

  async function saveCapital(raw: string) {
    const trimmed = raw.replace(/[$,\s]/g, "");
    const amount = trimmed === "" ? null : Number(trimmed);
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) return;
    setCapBusy(true);
    try {
      await api(`/api/portfolio/capital`, { method: "POST", body: JSON.stringify({ amount }) });
      setCapEditing(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save capital");
    } finally {
      setCapBusy(false);
    }
  }

  async function resetBook() {
    setResetBusy(true);
    try {
      await api(`/api/portfolio`, { method: "DELETE" });
      setResetConfirm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset the book");
    } finally {
      setResetBusy(false);
    }
  }

  async function toggleDrip(symbol: string, enabled: boolean) {
    // optimistic: settings write is cheap, avoid whole-payload flash
    setData((d) => (d ? { ...d, drip: { ...d.drip, [symbol]: enabled } } : d));
    try {
      await api(`/api/portfolio/drip`, {
        method: "POST",
        body: JSON.stringify({ symbol, enabled }),
      });
    } catch {
      load();
    }
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
        <div className="ml-auto flex items-center gap-2">
          {data && data.trades.length + data.openOrders.length > 0 && (
            <button
              onClick={() => setResetConfirm((v) => !v)}
              title="Clear the whole book (trades, orders, dividends)"
              className="rounded-lg bg-white/6 hover:bg-white/10 text-muted hover:text-loss text-xs font-medium px-3 py-1.5 transition-colors"
            >
              Reset book
            </button>
          )}
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            + Trade
          </button>
        </div>
      </header>

      {resetConfirm && data && (
        <div className="mb-5 rounded-2xl border border-loss/30 bg-loss/8 px-4 py-3">
          <p className="text-sm font-semibold text-loss">Reset the whole book?</p>
          <p className="text-xs text-[#c7c7cc] mt-1">
            This permanently deletes {data.trades.length} trade{data.trades.length === 1 ? "" : "s"},{" "}
            {data.openOrders.length + data.orderHistory.length} order
            {data.openOrders.length + data.orderHistory.length === 1 ? "" : "s"} and{" "}
            {data.dividends.length} dividend receipt{data.dividends.length === 1 ? "" : "s"}. Your
            initial capital and DRIP settings are kept. This cannot be undone.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={resetBook}
              disabled={resetBusy}
              className="rounded-lg bg-loss/20 hover:bg-loss/30 text-loss text-xs font-semibold px-3 py-1.5 disabled:opacity-50 transition-colors"
            >
              {resetBusy ? "Deleting…" : "Delete everything"}
            </button>
            <button
              onClick={() => setResetConfirm(false)}
              className="rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium px-3 py-1.5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-loss text-sm mb-4">{error}</p>}
      {adding && (
        <div className="mb-5">
          <TradeForm
            onSaved={() => {
              setAdding(false);
              load();
            }}
            onCancel={() => setAdding(false)}
            cashUsd={data?.cash ?? null}
            book={
              data
                ? {
                    totalUsd: data.summary.marketValue,
                    positions: data.stocks.map((p) => ({
                      symbol: p.symbol,
                      qty: p.qty,
                      avgCost: p.avgCost,
                      currency: p.currency,
                      marketValueUsd: (p.marketValue ?? 0) * p.fxToUsd,
                    })),
                    openOrders: data.openOrders.map((o) => ({ symbol: o.symbol })),
                  }
                : null
            }
          />
        </div>
      )}

      {!data ? (
        <div className="text-muted text-sm py-16 text-center">Loading portfolio…</div>
      ) : data.trades.length === 0 && data.openOrders.length === 0 && !adding ? (
        <div className="py-16 text-center">
          <p className="text-lg font-medium">No trades yet</p>
          <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
            Place orders (market, limit, stop…) or record past fills — stocks and options — to see
            live P&L, cost basis, dividends, and your involvement on each ticker’s desk.
          </p>
          <button
            onClick={() => setAdding(true)}
            className="mt-4 rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2"
          >
            Place your first trade
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
                sub={[
                  s.dayChange != null ? `${fmtUsd(s.dayChange, { sign: true })} today` : null,
                  data.initialCapital != null && data.initialCapital > 0
                    ? `${s.totalPnl >= 0 ? "+" : ""}${((s.totalPnl / data.initialCapital) * 100).toFixed(1)}% on capital`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined}
              />
              <StatTile label="Unrealized" value={fmtUsd(s.unrealized, { sign: true })} tone={signCls(s.unrealized)} />
              <StatTile label="Realized" value={fmtUsd(s.realized, { sign: true })} tone={signCls(s.realized)} />
              {s.dividends !== 0 && (
                <StatTile
                  label="Dividends"
                  value={fmtUsd(s.dividends, { sign: true })}
                  tone={signCls(s.dividends)}
                  sub="cash + reinvested"
                />
              )}
              {data.initialCapital != null && data.cash != null ? (
                <div className="rounded-xl bg-card border border-hairline px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted flex items-center">
                    Cash
                    <button
                      onClick={() => {
                        setCapInput(String(data.initialCapital ?? ""));
                        setCapEditing(true);
                      }}
                      title="Edit initial capital"
                      className="ml-auto normal-case tracking-normal text-muted hover:text-[#c7c7cc] transition-colors"
                    >
                      ✎ edit
                    </button>
                  </p>
                  <p className={`text-lg font-bold tabular-nums mt-0.5 ${data.cash < 0 ? "text-loss" : ""}`}>
                    {fmtUsd(data.cash)}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5 tabular-nums">
                    of {fmtUsd(data.initialCapital)} initial
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCapInput("");
                    setCapEditing(true);
                  }}
                  className="rounded-xl border border-dashed border-white/20 hover:border-accent/50 px-4 py-3 text-left transition-colors group"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted">Cash</p>
                  <p className="text-sm font-semibold text-muted group-hover:text-accent mt-1 transition-colors">
                    + Set initial capital
                  </p>
                  <p className="text-[11px] text-muted/70 mt-0.5">unlocks cash & return tracking</p>
                </button>
              )}
            </section>
          )}

          {/* Initial-capital editor */}
          {capEditing && (
            <section className="rounded-2xl bg-card border border-accent/25 px-4 py-3 flex items-end gap-3 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">Initial capital · USD</p>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCapital(capInput);
                    if (e.key === "Escape") setCapEditing(false);
                  }}
                  placeholder="100000"
                  className="mt-1 rounded-lg bg-card2 border border-hairline focus:border-accent/50 px-2.5 py-2 text-sm outline-none tabular-nums w-44 transition-colors placeholder:text-muted/60"
                />
              </div>
              <p className="text-[11px] text-muted max-w-sm pb-1">
                The cash you started this book with. Cash on hand = this + every buy/sell/fee/dividend
                since. Leave empty to stop tracking cash.
              </p>
              <div className="flex gap-2 pb-0.5 ml-auto">
                <button
                  onClick={() => saveCapital(capInput)}
                  disabled={capBusy}
                  className="rounded-lg bg-accent text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50 transition-colors"
                >
                  {capBusy ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setCapEditing(false)}
                  className="rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium px-3 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {/* Detected dividends awaiting confirmation */}
          {data.pendingDividends.length > 0 && (
            <section className="rounded-2xl border border-warn/25 bg-warn/6 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] uppercase tracking-widest text-warn font-semibold">
                  {data.pendingDividends.length} dividend{data.pendingDividends.length === 1 ? "" : "s"} detected
                </p>
                <p className="text-[11px] text-muted">
                  paid on shares you held before the ex-date — apply to add them to your book
                </p>
                <button
                  onClick={applyAllDividends}
                  disabled={divBusy != null}
                  className="ml-auto rounded-lg bg-warn/15 text-warn text-[11px] font-semibold px-2.5 py-1 hover:bg-warn/25 disabled:opacity-50 transition-colors"
                >
                  {divBusy === "all" ? "Applying…" : "Apply all"}
                </button>
              </div>
              <ul className="mt-2 divide-y divide-hairline">
                {data.pendingDividends.map((p) => (
                  <li key={`${p.symbol}|${p.exDate}`} className="flex items-center gap-3 py-2 text-xs">
                    <span className="font-semibold">{p.symbol}</span>
                    <span className="text-muted tabular-nums">{p.exDate}</span>
                    <span className="tabular-nums">
                      {fmtNative(p.perShare, p.currency)} × {p.shares.toLocaleString()} sh ={" "}
                      <span className={signCls(p.amount)}>{fmtNative(p.amount, p.currency)}</span>
                    </span>
                    <span className="text-muted">
                      {p.drip && p.reinvestShares != null
                        ? `DRIP: +${p.reinvestShares} sh @ ${p.reinvestPrice != null ? fmtNative(p.reinvestPrice, p.currency) : "market"}`
                        : p.amount < 0
                          ? "short — dividend owed"
                          : "cash"}
                    </span>
                    <label className="ml-auto flex items-center gap-1 text-muted shrink-0" title="Tax withheld at source — the credited amount is net of it">
                      w/h
                      <input
                        inputMode="decimal"
                        value={withholding[`${p.symbol}|${p.exDate}`] ?? ""}
                        onChange={(e) =>
                          setWithholding((m) => ({ ...m, [`${p.symbol}|${p.exDate}`]: e.target.value }))
                        }
                        placeholder="0"
                        className="w-10 rounded bg-card2 border border-hairline px-1 py-0.5 text-[11px] tabular-nums outline-none focus:border-accent/50 transition-colors"
                      />
                      %
                    </label>
                    <button
                      onClick={() => applyDividend(p.symbol, p.exDate)}
                      disabled={divBusy != null}
                      className="ml-auto rounded-lg bg-white/8 hover:bg-white/12 text-[11px] font-medium px-2.5 py-1 disabled:opacity-50 transition-colors"
                    >
                      {divBusy === `${p.symbol}|${p.exDate}` ? "…" : "Apply"}
                    </button>
                  </li>
                ))}
              </ul>
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

          {/* Working orders (paper execution) */}
          {data.openOrders.length > 0 && (
            <section>
              <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">
                Open orders{" "}
                <span className="normal-case tracking-normal font-normal">
                  — simulated fills at live prices, checked on refresh
                </span>
              </p>
              <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                {data.openOrders.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                    <span className={`font-semibold ${o.side === "buy" ? "text-gain" : "text-loss"}`}>
                      {o.side.toUpperCase()}
                    </span>
                    <span className="font-semibold">
                      {o.quantity.toLocaleString()} {o.symbol}
                    </span>
                    <span className="text-[#c7c7cc] tabular-nums">{orderLabel(o)}</span>
                    <span className="text-muted tabular-nums hidden sm:inline">
                      placed {o.placedAt.slice(0, 10)}
                    </span>
                    {o.note && <span className="text-muted truncate hidden md:inline">— {o.note}</span>}
                    <button
                      onClick={() => cancelOrder(o)}
                      disabled={orderBusy === o.id}
                      className="ml-auto rounded-lg bg-white/6 hover:bg-white/10 text-muted hover:text-loss text-[11px] font-medium px-2.5 py-1 disabled:opacity-50 transition-colors"
                    >
                      {orderBusy === o.id ? "…" : "Cancel"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
                          {p.qty > 0 && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                toggleDrip(p.symbol, !data.drip[p.symbol]);
                              }}
                              title={
                                data.drip[p.symbol]
                                  ? "Dividend reinvestment ON — dividends buy more shares when applied"
                                  : "Dividend reinvestment OFF — dividends credit as cash when applied"
                              }
                              className={`ml-2 rounded-full px-2 py-px text-[9px] font-semibold uppercase tracking-wider transition-colors ${
                                data.drip[p.symbol]
                                  ? "bg-gain/15 text-gain"
                                  : "bg-white/6 text-muted hover:bg-white/10"
                              }`}
                            >
                              DRIP {data.drip[p.symbol] ? "on" : "off"}
                            </button>
                          )}
                        </p>
                        <p className="text-[11px] text-muted tabular-nums">
                          {Math.abs(p.qty).toLocaleString()} sh @ {fmtNative(p.avgCost, p.currency)} avg
                          {s && s.marketValue > 0 && p.marketValue != null && (
                            <span
                              className="ml-2 rounded bg-white/6 px-1.5 py-px text-[10px]"
                              title="Share of the book's total market value"
                            >
                              {(((p.marketValue ?? 0) * p.fxToUsd * 100) / s.marketValue).toFixed(0)}% of book
                            </span>
                          )}
                          {p.avgCost === 0 && (
                            <span
                              className="ml-1.5 text-warn"
                              title="This position was recorded at price 0, so its P&L is overstated — delete the trade in Trade history and re-record it with the real fill price."
                            >
                              ⚠ no cost recorded
                            </span>
                          )}
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

          {/* Order history */}
          {data.orderHistory.length > 0 && (
            <section>
              <button
                onClick={() => setShowOrderHistory((v) => !v)}
                className="text-[11px] uppercase tracking-widest text-muted font-semibold hover:text-[#c7c7cc] transition-colors"
              >
                Order history ({data.orderHistory.length}) {showOrderHistory ? "▾" : "▸"}
              </button>
              {showOrderHistory && (
                <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                  {data.orderHistory.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                      <span className="text-muted tabular-nums shrink-0">
                        {(o.filledAt ?? o.placedAt).slice(0, 10)}
                      </span>
                      <span className={`font-semibold ${o.side === "buy" ? "text-gain" : "text-loss"}`}>
                        {o.side.toUpperCase()}
                      </span>
                      <span className="min-w-0 truncate">
                        {o.quantity.toLocaleString()} {o.symbol} · {orderLabel(o)}
                        {o.status === "filled" && o.fillPrice != null && (
                          <span className="tabular-nums"> — filled @ {o.fillPrice.toLocaleString()}</span>
                        )}
                      </span>
                      <span
                        className={`ml-auto shrink-0 rounded px-1.5 py-px text-[9px] uppercase tracking-wider ${
                          o.status === "filled"
                            ? "bg-gain/15 text-gain"
                            : o.status === "canceled"
                              ? "bg-white/8 text-muted"
                              : "bg-warn/10 text-warn/80"
                        }`}
                      >
                        {o.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Dividend receipts */}
          {data.dividends.length > 0 && (
            <section>
              <button
                onClick={() => setShowReceipts((v) => !v)}
                className="text-[11px] uppercase tracking-widest text-muted font-semibold hover:text-[#c7c7cc] transition-colors"
              >
                Dividend receipts ({data.dividends.length}) {showReceipts ? "▾" : "▸"}
              </button>
              {showReceipts && (
                <>
                  <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                    {data.dividends.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-xs flex-wrap">
                        <span className="text-muted tabular-nums shrink-0">{d.exDate}</span>
                        <span className="font-semibold">{d.symbol}</span>
                        <span className="tabular-nums">
                          {fmtNative(d.perShare, d.currency)} × {d.shares.toLocaleString()} sh
                        </span>
                        <span className={`tabular-nums font-medium ${signCls(d.amount)}`}>
                          {fmtNative(d.amount, d.currency)}
                        </span>
                        {d.withholdingPct > 0 && (
                          <span className="rounded bg-white/6 px-1.5 py-px text-[10px] text-muted" title="Credited net of tax withheld at source">
                            net of {d.withholdingPct}% w/h
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-px text-[10px] ${
                            d.reinvested ? "bg-gain/12 text-gain" : "bg-white/6 text-muted"
                          }`}
                        >
                          {d.reinvested ? "DRIP — reinvested" : "cash"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {data.dividends.some((d) => d.currency !== "USD") && (
                    <p className="text-[10px] text-muted mt-1.5">
                      Non-USD receipts are shown in their native currency and converted at the live
                      rate in the USD totals above.
                    </p>
                  )}
                </>
              )}
            </section>
          )}

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
