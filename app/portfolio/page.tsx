"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { PnlChart, fmtUsd } from "@/components/PnlChart";
import { useT } from "@/components/PrefsProvider";
import { TradeForm } from "@/components/TradeForm";
import { api, localizeError } from "@/components/util";
import { optionLabel } from "@/lib/portfolio-math";
import { daysUntil } from "@/components/util";
import type { TFunc } from "@/lib/i18n/dictionaries";
import type { Order, PortfolioPayload, Trade } from "@/lib/types";

type PositionAction = "sell" | "buy" | "record";

const fmtNative = (v: number, currency: string, digits = 2) =>
  `${currency === "USD" ? "$" : currency + " "}${v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

const signCls = (v: number | null | undefined) =>
  v == null ? "text-muted" : v >= 0 ? "text-gain" : "text-loss";

/**
 * summary.currencyNote is one of two English sentences composed server-side
 * (lib/portfolio.ts); map the known shapes to the UI language, fall back to
 * the raw string for anything unrecognized.
 */
function currencyNoteText(note: string, t: TFunc): string {
  if (note === "All amounts USD.") return t("portfolio.currencyNoteAllUsd");
  const m = note.match(/^Totals in USD \((.+) converted\); positions shown in native currency\.$/);
  if (m) return t("portfolio.currencyNoteConverted", { codes: m[1] });
  return note;
}

/** Localized twin of lib/order-math's orderLabel (identical English output). */
function orderLabelT(
  o: Pick<Order, "orderType" | "limitPrice" | "stopPrice" | "tif">,
  t: TFunc
): string {
  const type =
    o.orderType === "stop_limit"
      ? `${t("portfolio.otStopLimit")} ${o.stopPrice}/${o.limitPrice}`
      : o.orderType === "limit"
        ? `${t("portfolio.otLimit")} ${o.limitPrice}`
        : o.orderType === "stop"
          ? `${t("portfolio.otStop")} ${o.stopPrice}`
          : t("portfolio.otMarket");
  return o.orderType === "market"
    ? type
    : `${type} · ${o.tif === "gtc" ? t("portfolio.tifGtc") : t("portfolio.tifDay")}`;
}

/** Localized twin of optionLabel — English keeps the exact "SEP 18 '26 80 CALL" form. */
function optionLabelT(
  p: { optionType: string | null; strike: number | null; expiry: string | null },
  t: TFunc,
  lang: string,
  locale: string
): string {
  if (lang === "en") return optionLabel(p);
  const d = p.expiry ? new Date(p.expiry) : null;
  const when =
    d && !isNaN(d.getTime())
      ? d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
      : (p.expiry ?? "?");
  const type = (p.optionType ?? "call") === "put" ? t("portfolio.optionPut") : t("portfolio.optionCall");
  return `${when} ${p.strike ?? "?"} ${type}`;
}

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
        : `text-emph border-hairline hover:bg-ink/8 ${active ? "bg-ink/8" : ""}`;
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

export default function PortfolioPage() {
  const { t, lang, locale } = useT();
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
  /** Which stock row is expanded into its actions panel, and which action is open. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [posAction, setPosAction] = useState<PositionAction | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<PortfolioPayload>("/api/portfolio"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? localizeError(e.message, t) : t("portfolio.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    // Same initial-fetch-then-poll idiom as the watchlist/desk pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  async function removeTrade(tr: Trade) {
    const side = t(tr.side === "buy" ? "portfolio.sideBuy" : "portfolio.sideSell");
    if (
      !confirm(
        t("portfolio.deleteTradeConfirm", { side, qty: tr.quantity, sym: tr.symbol, price: tr.price })
      )
    )
      return;
    await api(`/api/portfolio/trades/${tr.id}`, { method: "DELETE" });
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
      setError(e instanceof Error ? localizeError(e.message, t) : t("portfolio.saveCapitalFailed"));
    } finally {
      setCapBusy(false);
    }
  }

  async function resetBook() {
    setResetBusy(true);
    try {
      await api(`/api/portfolio`, { method: "DELETE" });
      setResetConfirm(false);
      setExpanded(null);
      setPosAction(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? localizeError(e.message, t) : t("portfolio.resetFailed"));
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

  function toggleRow(key: string) {
    setExpanded((cur) => (cur === key ? null : key));
    setPosAction(null);
  }

  const s = data?.summary;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap mb-5">
        <Link href="/" className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity">
          {t("common.backToWatchlist")}
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">{t("portfolio.title")}</h1>
          <p className="text-muted text-xs">
            {s ? currencyNoteText(s.currencyNote, t) : t("portfolio.subtitle")}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {data && data.trades.length + data.openOrders.length > 0 && (
            <button
              onClick={() => setResetConfirm((v) => !v)}
              title={t("portfolio.resetBookTitle")}
              className="rounded-lg bg-ink/6 hover:bg-ink/10 text-muted hover:text-loss text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {t("portfolio.resetBook")}
            </button>
          )}
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            {t("portfolio.addTrade")}
          </button>
        </div>
      </header>

      {resetConfirm && data && (
        <div className="mb-5 rounded-2xl border border-loss/30 bg-loss/8 px-4 py-3">
          <p className="text-sm font-semibold text-loss">{t("portfolio.resetConfirmTitle")}</p>
          <p className="text-xs text-emph mt-1">
            {t("portfolio.resetConfirmBody", {
              trades: t(
                data.trades.length === 1 ? "portfolio.nTradesOne" : "portfolio.nTradesMany",
                { n: data.trades.length }
              ),
              orders: t(
                data.openOrders.length + data.orderHistory.length === 1
                  ? "portfolio.nOrdersOne"
                  : "portfolio.nOrdersMany",
                { n: data.openOrders.length + data.orderHistory.length }
              ),
              divs: t(
                data.dividends.length === 1 ? "portfolio.nReceiptsOne" : "portfolio.nReceiptsMany",
                { n: data.dividends.length }
              ),
            })}
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={resetBook}
              disabled={resetBusy}
              className="rounded-lg bg-loss/20 hover:bg-loss/30 text-loss text-xs font-semibold px-3 py-1.5 disabled:opacity-50 transition-colors"
            >
              {resetBusy ? t("portfolio.deleting") : t("portfolio.deleteEverything")}
            </button>
            <button
              onClick={() => setResetConfirm(false)}
              className="rounded-lg bg-ink/8 hover:bg-ink/12 text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-loss text-sm mb-4">{error}</p>}

      {/* Initial-capital editor — top of the page, available even on an empty book */}
      {capEditing && data && (
        <section className="mb-5 rounded-2xl bg-card border border-accent/25 px-4 py-3 flex items-end gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">{t("portfolio.capitalLabel")}</p>
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
          <p className="text-[11px] text-muted max-w-sm pb-1">{t("portfolio.capitalDesc")}</p>
          <div className="flex gap-2 pb-0.5 ml-auto">
            <button
              onClick={() => saveCapital(capInput)}
              disabled={capBusy}
              className="rounded-lg bg-accent text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50 transition-colors"
            >
              {capBusy ? t("common.saving") : t("common.save")}
            </button>
            <button
              onClick={() => setCapEditing(false)}
              className="rounded-lg bg-ink/8 hover:bg-ink/12 text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </section>
      )}

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
        <div className="text-muted text-sm py-16 text-center">{t("portfolio.loadingPortfolio")}</div>
      ) : data.trades.length === 0 && data.openOrders.length === 0 && !adding ? (
        <div className="py-16 text-center">
          <p className="text-lg font-medium">{t("portfolio.emptyTitle")}</p>
          <p className="text-muted text-sm mt-2 max-w-sm mx-auto">{t("portfolio.emptyBody")}</p>
          <button
            onClick={() => setAdding(true)}
            className="mt-4 rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2"
          >
            {t("portfolio.emptyCta")}
          </button>
          <p className="mt-5 text-xs text-muted">
            {data.initialCapital != null ? (
              <>
                {t("portfolio.startingCapital")}{" "}
                <span className="tabular-nums font-semibold text-emph">{fmtUsd(data.initialCapital)}</span>
                <button
                  onClick={() => {
                    setCapInput(String(data.initialCapital ?? ""));
                    setCapEditing(true);
                  }}
                  className="ml-2 text-accent hover:opacity-80 font-medium transition-opacity"
                >
                  {t("common.edit")}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setCapInput("");
                  setCapEditing(true);
                }}
                className="text-accent hover:opacity-80 font-medium transition-opacity"
              >
                {t("portfolio.setStartingCapital")}
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary tiles — capital first: the book starts from what you put in */}
          {s && (
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.initialCapital != null && data.cash != null ? (
                <div className="rounded-xl bg-card border border-hairline px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted flex items-center">
                    {t("portfolio.cash")}
                    <button
                      onClick={() => {
                        setCapInput(String(data.initialCapital ?? ""));
                        setCapEditing(true);
                      }}
                      title={t("portfolio.editCapitalTitle")}
                      className="ml-auto normal-case tracking-normal text-muted hover:text-emph transition-colors"
                    >
                      {t("portfolio.editCapital")}
                    </button>
                  </p>
                  <p className={`text-lg font-bold tabular-nums mt-0.5 ${data.cash < 0 ? "text-loss" : ""}`}>
                    {fmtUsd(data.cash)}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5 tabular-nums">
                    {t("portfolio.ofInitial", { amt: fmtUsd(data.initialCapital) })}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCapInput("");
                    setCapEditing(true);
                  }}
                  className="rounded-xl border border-dashed border-ink/20 hover:border-accent/50 px-4 py-3 text-left transition-colors group"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted">{t("portfolio.cash")}</p>
                  <p className="text-sm font-semibold text-muted group-hover:text-accent mt-1 transition-colors">
                    {t("portfolio.setInitialCapital")}
                  </p>
                  <p className="text-[11px] text-muted/70 mt-0.5">{t("portfolio.unlocksTracking")}</p>
                </button>
              )}
              <StatTile
                label={t("portfolio.marketValue")}
                value={fmtUsd(s.marketValue)}
                sub={t("portfolio.costSub", { amt: fmtUsd(s.costBasis) })}
              />
              <StatTile
                label={t("portfolio.totalPnl")}
                value={fmtUsd(s.totalPnl, { sign: true })}
                tone={signCls(s.totalPnl)}
                sub={[
                  s.dayChange != null
                    ? t("portfolio.todayAmt", { amt: fmtUsd(s.dayChange, { sign: true }) })
                    : null,
                  data.initialCapital != null && data.initialCapital > 0
                    ? t("portfolio.onCapital", {
                        pct: `${s.totalPnl >= 0 ? "+" : ""}${((s.totalPnl / data.initialCapital) * 100).toFixed(1)}`,
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined}
              />
              <StatTile
                label={t("portfolio.unrealized")}
                value={fmtUsd(s.unrealized, { sign: true })}
                tone={signCls(s.unrealized)}
              />
              <StatTile
                label={t("portfolio.realized")}
                value={fmtUsd(s.realized, { sign: true })}
                tone={signCls(s.realized)}
              />
              {s.dividends !== 0 && (
                <StatTile
                  label={t("portfolio.dividends")}
                  value={fmtUsd(s.dividends, { sign: true })}
                  tone={signCls(s.dividends)}
                  sub={t("portfolio.cashPlusReinvested")}
                />
              )}
            </section>
          )}

          {/* Detected dividends awaiting confirmation */}
          {data.pendingDividends.length > 0 && (
            <section className="rounded-2xl border border-warn/25 bg-warn/6 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] uppercase tracking-widest text-warn font-semibold">
                  {t(
                    data.pendingDividends.length === 1
                      ? "portfolio.divsDetectedOne"
                      : "portfolio.divsDetectedMany",
                    { n: data.pendingDividends.length }
                  )}
                </p>
                <p className="text-[11px] text-muted">{t("portfolio.pendingDivHint")}</p>
                <button
                  onClick={applyAllDividends}
                  disabled={divBusy != null}
                  className="ml-auto rounded-lg bg-warn/15 text-warn text-[11px] font-semibold px-2.5 py-1 hover:bg-warn/25 disabled:opacity-50 transition-colors"
                >
                  {divBusy === "all" ? t("portfolio.applying") : t("portfolio.applyAll")}
                </button>
              </div>
              <ul className="mt-2 divide-y divide-hairline">
                {data.pendingDividends.map((p) => (
                  <li key={`${p.symbol}|${p.exDate}`} className="flex items-center gap-3 py-2 text-xs">
                    <span className="font-semibold">{p.symbol}</span>
                    <span className="text-muted tabular-nums">{p.exDate}</span>
                    <span className="tabular-nums">
                      {fmtNative(p.perShare, p.currency)} × {p.shares.toLocaleString()}{" "}
                      {t("portfolio.shAbbr")} ={" "}
                      <span className={signCls(p.amount)}>{fmtNative(p.amount, p.currency)}</span>
                    </span>
                    <span className="text-muted">
                      {p.drip && p.reinvestShares != null
                        ? t("portfolio.dripPreview", {
                            n: p.reinvestShares,
                            price:
                              p.reinvestPrice != null
                                ? fmtNative(p.reinvestPrice, p.currency)
                                : t("portfolio.atMarket"),
                          })
                        : p.amount < 0
                          ? t("portfolio.shortOwed")
                          : t("portfolio.cashWord")}
                    </span>
                    <label
                      className="ml-auto flex items-center gap-1 text-muted shrink-0"
                      title={t("portfolio.whTitle")}
                    >
                      {t("portfolio.whAbbr")}
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
                      className="ml-auto rounded-lg bg-ink/8 hover:bg-ink/12 text-[11px] font-medium px-2.5 py-1 disabled:opacity-50 transition-colors"
                    >
                      {divBusy === `${p.symbol}|${p.exDate}` ? "…" : t("portfolio.apply")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* P&L chart */}
          <section className="rounded-2xl bg-card border border-hairline p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted font-semibold mb-2">
              {t("portfolio.pnlOverTime")}{" "}
              <span className="normal-case tracking-normal font-normal">{t("portfolio.usdUnit")}</span>
            </p>
            <PnlChart series={data.series} />
            {data.options.length > 0 && (
              <p className="text-[10px] text-muted/70 mt-2">{t("portfolio.optionsMarkNote")}</p>
            )}
            {data.unpriced.length > 0 && (
              <p className="text-[10px] text-warn mt-1">
                {t("portfolio.unpricedNote", { syms: data.unpriced.join(", ") })}
              </p>
            )}
          </section>

          {/* Working orders (paper execution) */}
          {data.openOrders.length > 0 && (
            <section>
              <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">
                {t("portfolio.openOrders")}{" "}
                <span className="normal-case tracking-normal font-normal">
                  {t("portfolio.openOrdersSub")}
                </span>
              </p>
              <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                {data.openOrders.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                    <span className={`font-semibold ${o.side === "buy" ? "text-gain" : "text-loss"}`}>
                      {t(o.side === "buy" ? "portfolio.sideBuy" : "portfolio.sideSell").toUpperCase()}
                    </span>
                    <span className="font-semibold">
                      {o.quantity.toLocaleString()} {o.symbol}
                    </span>
                    <span className="text-emph tabular-nums">{orderLabelT(o, t)}</span>
                    <span className="text-muted tabular-nums hidden sm:inline">
                      {t("portfolio.placedOn", { date: o.placedAt.slice(0, 10) })}
                    </span>
                    {o.note && <span className="text-muted truncate hidden md:inline">— {o.note}</span>}
                    <button
                      onClick={() => cancelOrder(o)}
                      disabled={orderBusy === o.id}
                      className="ml-auto rounded-lg bg-ink/6 hover:bg-ink/10 text-muted hover:text-loss text-[11px] font-medium px-2.5 py-1 disabled:opacity-50 transition-colors"
                    >
                      {orderBusy === o.id ? "…" : t("portfolio.cancelOrder")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Stock positions — click a row for everything you can do with it */}
          <section>
            <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">
              {t("portfolio.stocks")}
            </p>
            {data.stocks.length === 0 ? (
              <p className="text-muted text-xs italic mt-2">{t("portfolio.noStocks")}</p>
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
                        className="flex items-center gap-3 px-4 py-3 hover:bg-ink/4 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">
                            {p.symbol}{" "}
                            {p.qty < 0 && (
                              <span className="text-loss text-[10px] font-semibold ml-1">
                                {t("portfolio.shortTag")}
                              </span>
                            )}
                            {p.qty > 0 && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleDrip(p.symbol, !data.drip[p.symbol]);
                                }}
                                title={
                                  data.drip[p.symbol]
                                    ? t("portfolio.dripOnTitle")
                                    : t("portfolio.dripOffTitle")
                                }
                                className={`ml-2 rounded-full px-2 py-px text-[9px] font-semibold uppercase tracking-wider transition-colors ${
                                  data.drip[p.symbol]
                                    ? "bg-gain/15 text-gain"
                                    : "bg-ink/6 text-muted hover:bg-ink/10"
                                }`}
                              >
                                {data.drip[p.symbol]
                                  ? t("portfolio.dripOnChip")
                                  : t("portfolio.dripOffChip")}
                              </button>
                            )}
                          </p>
                          <p className="text-[11px] text-muted tabular-nums">
                            {t("portfolio.qtyAvg", {
                              qty: Math.abs(p.qty).toLocaleString(),
                              price: fmtNative(p.avgCost, p.currency),
                            })}
                            {s && s.marketValue > 0 && p.marketValue != null && (
                              <span
                                className="ml-2 rounded bg-ink/6 px-1.5 py-px text-[10px]"
                                title={t("portfolio.pctOfBookTitle")}
                              >
                                {t("portfolio.pctOfBook", {
                                  pct: (((p.marketValue ?? 0) * p.fxToUsd * 100) / s.marketValue).toFixed(0),
                                })}
                              </span>
                            )}
                            {p.avgCost === 0 && (
                              <span className="ml-1.5 text-warn" title={t("portfolio.noCostTitle")}>
                                {t("portfolio.noCost")}
                              </span>
                            )}
                            {p.realized !== 0 && (
                              <span className="ml-2">
                                {t("portfolio.realizedAmt", { amt: fmtNative(p.realized, p.currency, 0) })}
                              </span>
                            )}
                            {(data.dividendsBySymbol[p.symbol] ?? 0) !== 0 && (
                              <span
                                className={`ml-2 ${signCls(data.dividendsBySymbol[p.symbol])}`}
                                title={t("portfolio.divReceivedTitle")}
                              >
                                {t("portfolio.divReceived", {
                                  v: fmtUsd(data.dividendsBySymbol[p.symbol], { sign: true }),
                                })}
                              </span>
                            )}
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
                          {p.currency !== "USD" && p.fxToUsd !== 1 && (
                            <p className="text-[10px] text-muted tabular-nums mt-0.5">
                              {p.marketValue != null && (
                                <>≈ {fmtUsd(p.marketValue * p.fxToUsd)}</>
                              )}
                              {p.unrealized != null && (
                                <> · {fmtUsd(p.unrealized * p.fxToUsd, { sign: true })}</>
                              )}
                            </p>
                          )}
                        </div>
                        <span
                          aria-hidden
                          className={`shrink-0 text-[10px] transition-transform ${
                            open ? "rotate-90 text-emph" : "text-muted/60"
                          }`}
                        >
                          ▸
                        </span>
                      </div>

                      {/* Everything you can do with this position, in one place. */}
                      {open && (
                        <div className="px-4 pb-4 pt-2.5 bg-ink/2 border-t border-hairline/60">
                          <div className="flex flex-wrap items-center gap-2">
                            <ActionChip
                              tone="loss"
                              active={posAction === "sell"}
                              onClick={() => setPosAction((a) => (a === "sell" ? null : "sell"))}
                            >
                              {p.qty < 0 ? t("portfolio.sellMore") : t("portfolio.sell")}
                            </ActionChip>
                            <ActionChip
                              tone="gain"
                              active={posAction === "buy"}
                              onClick={() => setPosAction((a) => (a === "buy" ? null : "buy"))}
                            >
                              {p.qty < 0 ? t("portfolio.buyToCover") : t("portfolio.buyMore")}
                            </ActionChip>
                            <ActionChip
                              active={posAction === "record"}
                              onClick={() => setPosAction((a) => (a === "record" ? null : "record"))}
                            >
                              {t("portfolio.recordPastTrade")}
                            </ActionChip>
                            <Link
                              href={`/t/${encodeURIComponent(p.symbol)}`}
                              className="ml-auto text-xs text-accent font-medium hover:opacity-80 transition-opacity"
                            >
                              {t("portfolio.openDesk")}
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
                                cashUsd={data.cash ?? null}
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
            <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">
              {t("portfolio.options")}
            </p>
            {data.options.length === 0 ? (
              <p className="text-muted text-xs italic mt-2">{t("portfolio.noOptions")}</p>
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
                          <span className="text-emph">{optionLabelT(p, t, lang, locale)}</span>
                          {p.qty < 0 && (
                            <span className="text-warn text-[10px] font-semibold ml-1.5">
                              {t("portfolio.shortTag")}
                            </span>
                          )}
                          {p.expired && (
                            <span className="text-loss text-[10px] font-semibold ml-1.5">
                              {t("portfolio.expiredTag")}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted tabular-nums">
                          {t(
                            Math.abs(p.qty) === 1 ? "portfolio.contractsAtOne" : "portfolio.contractsAtMany",
                            { n: Math.abs(p.qty), price: fmtNative(p.avgCost, p.currency) }
                          )}
                          {dte != null && dte >= 0 && !p.expired && (
                            <span className="ml-2">{t("portfolio.dteShort", { n: dte })}</span>
                          )}
                          {p.markSource === "intrinsic" && !p.expired && (
                            <span className="ml-2 text-muted/70">{t("portfolio.intrinsicMark")}</span>
                          )}
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
              <p className="text-[10px] text-muted mt-1.5">{t("portfolio.expiredNote")}</p>
            )}
          </section>

          {/* Order history */}
          {data.orderHistory.length > 0 && (
            <section>
              <button
                onClick={() => setShowOrderHistory((v) => !v)}
                className="text-[11px] uppercase tracking-widest text-muted font-semibold hover:text-emph transition-colors"
              >
                {t("portfolio.orderHistory", { n: data.orderHistory.length })} {showOrderHistory ? "▾" : "▸"}
              </button>
              {showOrderHistory && (
                <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                  {data.orderHistory.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                      <span className="text-muted tabular-nums shrink-0">
                        {(o.filledAt ?? o.placedAt).slice(0, 10)}
                      </span>
                      <span className={`font-semibold ${o.side === "buy" ? "text-gain" : "text-loss"}`}>
                        {t(o.side === "buy" ? "portfolio.sideBuy" : "portfolio.sideSell").toUpperCase()}
                      </span>
                      <span className="min-w-0 truncate">
                        {o.quantity.toLocaleString()} {o.symbol} · {orderLabelT(o, t)}
                        {o.status === "filled" && o.fillPrice != null && (
                          <span className="tabular-nums">
                            {" "}
                            {t("portfolio.filledAtPrice", { price: o.fillPrice.toLocaleString() })}
                          </span>
                        )}
                      </span>
                      <span
                        className={`ml-auto shrink-0 rounded px-1.5 py-px text-[9px] uppercase tracking-wider ${
                          o.status === "filled"
                            ? "bg-gain/15 text-gain"
                            : o.status === "canceled"
                              ? "bg-ink/8 text-muted"
                              : "bg-warn/10 text-warn/80"
                        }`}
                      >
                        {t(`portfolio.status_${o.status}`)}
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
                className="text-[11px] uppercase tracking-widest text-muted font-semibold hover:text-emph transition-colors"
              >
                {t("portfolio.dividendReceipts", { n: data.dividends.length })} {showReceipts ? "▾" : "▸"}
              </button>
              {showReceipts && (
                <>
                  <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                    {data.dividends.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-xs flex-wrap">
                        <span className="text-muted tabular-nums shrink-0">{d.exDate}</span>
                        <span className="font-semibold">{d.symbol}</span>
                        <span className="tabular-nums">
                          {fmtNative(d.perShare, d.currency)} × {d.shares.toLocaleString()}{" "}
                          {t("portfolio.shAbbr")}
                        </span>
                        <span className={`tabular-nums font-medium ${signCls(d.amount)}`}>
                          {fmtNative(d.amount, d.currency)}
                        </span>
                        {d.withholdingPct > 0 && (
                          <span
                            className="rounded bg-ink/6 px-1.5 py-px text-[10px] text-muted"
                            title={t("portfolio.netOfWhTitle")}
                          >
                            {t("portfolio.netOfWh", { pct: d.withholdingPct })}
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-px text-[10px] ${
                            d.reinvested ? "bg-gain/12 text-gain" : "bg-ink/6 text-muted"
                          }`}
                        >
                          {d.reinvested ? t("portfolio.dripReinvested") : t("portfolio.cashWord")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {data.dividends.some((d) => d.currency !== "USD") && (
                    <p className="text-[10px] text-muted mt-1.5">{t("portfolio.nonUsdNote")}</p>
                  )}
                </>
              )}
            </section>
          )}

          {/* Trade history */}
          <section>
            <button
              onClick={() => setShowTrades((v) => !v)}
              className="text-[11px] uppercase tracking-widest text-muted font-semibold hover:text-emph transition-colors"
            >
              {t("portfolio.tradeHistory", { n: data.trades.length })} {showTrades ? "▾" : "▸"}
            </button>
            {showTrades && (
              <ul className="mt-2 divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
                {data.trades.map((tr) => (
                  <li key={tr.id} className="group flex items-center gap-3 px-4 py-2.5 text-xs">
                    <span className="text-muted tabular-nums shrink-0">{tr.tradeDate}</span>
                    <span className={`font-semibold ${tr.side === "buy" ? "text-gain" : "text-loss"}`}>
                      {t(tr.side === "buy" ? "portfolio.sideBuy" : "portfolio.sideSell").toUpperCase()}
                    </span>
                    <span className="min-w-0 truncate">
                      {tr.quantity.toLocaleString()}{" "}
                      {tr.kind === "option"
                        ? `× ${tr.symbol} ${optionLabelT(tr, t, lang, locale)}`
                        : `${tr.symbol}`}{" "}
                      @ <span className="tabular-nums">{tr.price.toLocaleString()}</span>
                      {tr.fees > 0 && (
                        <span className="text-muted"> {t("portfolio.feesNote", { fees: tr.fees })}</span>
                      )}
                      {tr.note && <span className="text-muted"> — {tr.note}</span>}
                    </span>
                    <button
                      onClick={() => removeTrade(tr)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-muted hover:text-loss transition-opacity shrink-0"
                      title={t("portfolio.deleteTradeTitle")}
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
        {t("portfolio.footerLedger")} {t("common.notAdvice")}
      </footer>
    </main>
  );
}
