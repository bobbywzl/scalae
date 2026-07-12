"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { PnlChart, fmtUsd } from "@/components/PnlChart";
import { TradeForm } from "@/components/TradeForm";
import { api } from "@/components/util";
import { orderLabel } from "@/lib/order-math";
import { optionLabel } from "@/lib/portfolio-math";
import { daysUntil } from "@/components/util";
import type { Order, PortfolioPayload, PortfolioSummary, Trade } from "@/lib/types";

type PositionAction = "sell" | "buy" | "record";

const fmtNative = (v: number, currency: string, digits = 2) =>
  `${currency === "USD" ? "$" : currency + " "}${v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

const signCls = (v: number | null | undefined) =>
  v == null ? "text-muted" : v >= 0 ? "text-gain" : "text-loss";

function StatTile({
  label,
  value,
  sub,
  tone,
  subTone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  subTone?: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-hairline px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${tone ?? ""}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-0.5 tabular-nums ${subTone ?? "text-muted"}`}>{sub}</p>}
    </div>
  );
}

/** One quick-action chip in a stock row's expanded panel. */
function ActionChip({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone?: "gain" | "loss";
  onClick: () => void;
  children: ReactNode;
}) {
  const toneCls =
    tone === "loss"
      ? `text-loss border-loss/30 hover:bg-loss/10 ${active ? "bg-loss/10" : ""}`
      : tone === "gain"
        ? `text-gain border-gain/30 hover:bg-gain/10 ${active ? "bg-gain/10" : ""}`
        : `text-[#c7c7cc] border-hairline hover:bg-white/8 ${active ? "bg-white/8" : ""}`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${toneCls}`}
    >
      {children}
    </button>
  );
}

/**
 * Book admin strip: starting capital (set / edit / remove, driving cash,
 * account value and % return) and the clear-the-whole-book button.
 */
function CapitalBar({
  summary,
  hasBook,
  clearing,
  onSave,
  onClear,
}: {
  summary: PortfolioSummary;
  hasBook: boolean;
  clearing: boolean;
  onSave: (v: number | null) => Promise<void>;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [str, setStr] = useState("");
  const [busy, setBusy] = useState(false);
  const cap = summary.initialCapital;
  const valid = str.trim() !== "" && Number.isFinite(Number(str)) && Number(str) >= 0;

  async function save(v: number | null) {
    setBusy(true);
    try {
      await onSave(v);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 rounded-xl bg-card border border-hairline px-3.5 py-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-[11px]">
      <span className="uppercase tracking-wider text-muted font-semibold text-[10px]">
        Starting capital
      </span>
      {editing ? (
        <>
          <input
            autoFocus
            inputMode="decimal"
            value={str}
            onChange={(e) => setStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid && !busy) save(Number(str));
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="100000"
            className="w-28 rounded-md bg-card2 border border-hairline focus:border-accent/50 px-2 py-1 text-xs tabular-nums outline-none"
          />
          <span className="text-muted">USD</span>
          <button
            onClick={() => save(Number(str))}
            disabled={!valid || busy}
            className="text-accent font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} disabled={busy} className="text-muted hover:text-[#c7c7cc]">
            Cancel
          </button>
          {cap != null && (
            <button onClick={() => save(null)} disabled={busy} className="text-muted hover:text-loss">
              Remove
            </button>
          )}
        </>
      ) : cap != null ? (
        <>
          <span className="font-semibold tabular-nums text-xs">{fmtUsd(cap)}</span>
          {summary.cash != null && (
            <span className={`tabular-nums ${summary.cash < 0 ? "text-loss" : "text-muted"}`}>
              cash {fmtUsd(summary.cash)}
              {summary.cash < 0 && " (over-invested)"}
            </span>
          )}
          {summary.returnPct != null && (
            <span
              className={`tabular-nums font-semibold ${summary.returnPct >= 0 ? "text-gain" : "text-loss"}`}
            >
              {summary.returnPct >= 0 ? "+" : ""}
              {summary.returnPct.toFixed(1)}% return
            </span>
          )}
          <button
            onClick={() => {
              setStr(String(cap));
              setEditing(true);
            }}
            className="text-accent hover:opacity-80 font-medium transition-opacity"
          >
            Edit
          </button>
        </>
      ) : (
        <>
          <span className="text-muted">not set — set it to track cash, account value and % return</span>
          <button
            onClick={() => {
              setStr("");
              setEditing(true);
            }}
            className="text-accent hover:opacity-80 font-medium transition-opacity"
          >
            Set
          </button>
        </>
      )}
      {hasBook && (
        <button
          onClick={onClear}
          disabled={clearing}
          className="ml-auto rounded-md border border-hairline px-2 py-1 font-medium text-muted hover:text-loss hover:border-loss/40 disabled:opacity-50 transition-colors"
        >
          {clearing ? "Clearing…" : "Clear book"}
        </button>
      )}
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
  const [clearing, setClearing] = useState(false);
  /** Which stock row is expanded into its actions panel, and which action is open. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [posAction, setPosAction] = useState<PositionAction | null>(null);

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
      await api(`/api/portfolio/dividends`, {
        method: "POST",
        body: JSON.stringify({ symbol, exDate }),
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

  function toggleRow(key: string) {
    setExpanded((cur) => (cur === key ? null : key));
    setPosAction(null);
  }

  async function saveCapital(v: number | null) {
    await api(`/api/settings`, { method: "POST", body: JSON.stringify({ initialCapital: v }) });
    await load();
  }

  async function clearBook() {
    if (!data) return;
    const n = (c: number, word: string) => `${c} ${word}${c === 1 ? "" : "s"}`;
    const what = [
      n(data.trades.length, "trade"),
      n(data.openOrders.length, "open order"),
      n(data.dividends.length, "dividend receipt"),
    ].join(", ");
    if (
      !confirm(
        `Clear the whole book? This permanently deletes ${what}, all order history, and DRIP settings — every position and its P&L goes with them. Starting capital is kept. This cannot be undone.`
      )
    )
      return;
    setClearing(true);
    try {
      await api(`/api/portfolio`, { method: "DELETE" });
      setExpanded(null);
      setPosAction(null);
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear the book");
    } finally {
      setClearing(false);
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
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
        >
          + Trade
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

      {data && (
        <CapitalBar
          summary={data.summary}
          hasBook={
            data.trades.length > 0 ||
            data.openOrders.length > 0 ||
            data.orderHistory.length > 0 ||
            data.dividends.length > 0
          }
          clearing={clearing}
          onSave={saveCapital}
          onClear={clearBook}
        />
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
            <section
              className={`grid grid-cols-2 sm:grid-cols-4 ${
                (s.dividends !== 0 ? 1 : 0) + (s.accountValue != null ? 1 : 0) >= 2
                  ? "lg:grid-cols-6"
                  : (s.dividends !== 0 ? 1 : 0) + (s.accountValue != null ? 1 : 0) === 1
                    ? "lg:grid-cols-5"
                    : ""
              } gap-3`}
            >
              {s.accountValue != null && (
                <StatTile
                  label="Account value"
                  value={fmtUsd(s.accountValue)}
                  sub={s.cash != null ? `cash ${fmtUsd(s.cash)}` : undefined}
                  subTone={s.cash != null && s.cash < 0 ? "text-loss" : undefined}
                />
              )}
              <StatTile label="Market value" value={fmtUsd(s.marketValue)} sub={`cost ${fmtUsd(s.costBasis)}`} />
              <StatTile
                label="Total P&L"
                value={fmtUsd(s.totalPnl, { sign: true })}
                tone={signCls(s.totalPnl)}
                sub={s.dayChange != null ? `${fmtUsd(s.dayChange, { sign: true })} today` : undefined}
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
                {data.stocks.map((p) => {
                  const open = expanded === p.key;
                  return (
                    <li key={p.key}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={open}
                        onClick={() => toggleRow(p.key)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return; // let the DRIP chip keep its keys
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleRow(p.key);
                          }
                        }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/4 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">
                            {p.symbol} {p.qty < 0 && <span className="text-loss text-[10px] font-semibold ml-1">SHORT</span>}
                            {p.qty > 0 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
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
                        <span
                          aria-hidden
                          className={`shrink-0 text-[10px] transition-transform ${
                            open ? "rotate-90 text-[#c7c7cc]" : "text-muted/60"
                          }`}
                        >
                          ▸
                        </span>
                      </div>

                      {/* Everything you can do with this position, in one place. */}
                      {open && (
                        <div className="px-4 pb-4 pt-2.5 bg-white/2 border-t border-hairline/60">
                          <div className="flex flex-wrap items-center gap-2">
                            <ActionChip
                              tone="loss"
                              active={posAction === "sell"}
                              onClick={() => setPosAction((a) => (a === "sell" ? null : "sell"))}
                            >
                              {p.qty < 0 ? "Sell more" : "Sell"}
                            </ActionChip>
                            <ActionChip
                              tone="gain"
                              active={posAction === "buy"}
                              onClick={() => setPosAction((a) => (a === "buy" ? null : "buy"))}
                            >
                              {p.qty < 0 ? "Buy to cover" : "Buy more"}
                            </ActionChip>
                            <ActionChip
                              active={posAction === "record"}
                              onClick={() => setPosAction((a) => (a === "record" ? null : "record"))}
                            >
                              Record past trade
                            </ActionChip>
                            <Link
                              href={`/t/${encodeURIComponent(p.symbol)}`}
                              className="ml-auto text-xs text-accent font-medium hover:opacity-80 transition-opacity"
                            >
                              Open desk →
                            </Link>
                          </div>
                          {posAction && (
                            <div className="mt-3">
                              <TradeForm
                                key={`${p.key}:${posAction}`}
                                initialSymbol={p.symbol}
                                initialSide={posAction === "buy" ? "buy" : posAction === "sell" ? "sell" : undefined}
                                initialMode={posAction === "record" ? "record" : "order"}
                                initialQuantity={
                                  posAction === "sell" && p.qty > 0
                                    ? p.qty
                                    : posAction === "buy" && p.qty < 0
                                      ? Math.abs(p.qty)
                                      : undefined
                                }
                                held={p.qty}
                                onSaved={() => {
                                  setPosAction(null);
                                  load();
                                }}
                                onCancel={() => setPosAction(null)}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
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
