"use client";

import { useEffect, useRef, useState } from "react";
import { fillDecision, validateOrder } from "@/lib/order-math";
import type { SearchHit } from "@/lib/market";
import type { Order, OptionType, OrderTif, OrderType, RichQuote, TradeKind, TradeSide } from "@/lib/types";
import type { TFunc, TKey } from "@/lib/i18n/dictionaries";
import { QuoteCard } from "./QuoteCard";
import { useT } from "./PrefsProvider";
import { api, localizeError } from "./util";

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtMoney = (v: number, currency: string) =>
  `${currency === "USD" ? "$" : currency + " "}${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-card2 border border-hairline p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
            value === o.v ? "bg-ink/12 text-foreground" : "text-muted hover:text-emph"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ORDER_TYPE_KEY = {
  market: "trade.typeMarket",
  limit: "trade.typeLimit",
  stop: "trade.typeStop",
  stop_limit: "trade.typeStopLimit",
} as const satisfies Record<OrderType, TKey>;

const ORDER_TYPE_HINT_KEY = {
  market: "trade.hintMarket",
  limit: "trade.hintLimit",
  stop: "trade.hintStop",
  stop_limit: "trade.hintStopLimit",
} as const satisfies Record<OrderType, TKey>;

/**
 * validateOrder() phrases (identical on client and server) mapped to the UI
 * language; anything unrecognized falls through to localizeError / raw text.
 */
const VALIDATION_KEY: Record<string, TKey> = {
  "quantity is implausibly large": "trade.valQtyHuge",
  "limitPrice must be > 0 for limit orders": "trade.valLimitRequired",
  "stopPrice must be > 0 for stop orders": "trade.valStopRequired",
  "buy stop-limit: limit must be at or above the stop (or the order can never fill)": "trade.valBuyStopLimit",
  "sell stop-limit: limit must be at or below the stop (or the order can never fill)": "trade.valSellStopLimit",
};

const NO_LIVE_MARKET_RX = /^No live market price for (\S+) — check the symbol, or record the trade manually\.$/;

function localizeTradeMsg(msg: string, t: TFunc): string {
  const key = VALIDATION_KEY[msg];
  if (key) return t(key);
  const m = msg.match(NO_LIVE_MARKET_RX);
  if (m) return t("trade.errNoLiveMarket", { sym: m[1] });
  return localizeError(msg, t);
}

/**
 * Brokerage-style ticket: place a paper order (market / limit / stop /
 * stop-limit, Day or GTC, shares or currency amount, estimate + review), or
 * record a past fill manually (stocks and options, any date). Working orders
 * fill — simulated — when live quotes cross them.
 *
 * The `initial*` props seed the ticket from a position row (the portfolio's
 * per-ticker quick actions); `held` is the signed share count already owned,
 * shown for context when selling or covering.
 */
export function TradeForm({
  onSaved,
  onCancel,
  initialSymbol,
  initialSide,
  initialMode,
  initialQuantity,
  held,
  cashUsd = null,
  book = null,
}: {
  onSaved: () => void;
  onCancel: () => void;
  initialSymbol?: string;
  initialSide?: TradeSide;
  initialMode?: "order" | "record";
  initialQuantity?: number;
  held?: number;
  /** Cash on hand (USD) when the investor tracks initial capital. */
  cashUsd?: number | null;
  /** Current book, so the ticket shows your position while you trade it. */
  book?: {
    totalUsd: number;
    positions: { symbol: string; qty: number; avgCost: number; currency: string; marketValueUsd: number }[];
    openOrders: { symbol: string }[];
  } | null;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<"order" | "record">(initialMode ?? "order");

  // Shared: ticker + live quote
  const [symbol, setSymbol] = useState(initialSymbol ?? "");
  // Seeded tickets skip the search dropdown until the ticker is actually edited.
  const [tickerDirty, setTickerDirty] = useState(!initialSymbol);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const [quote, setQuote] = useState<RichQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Order ticket
  const [side, setSide] = useState<TradeSide>(initialSide ?? "buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [tif, setTif] = useState<OrderTif>("gtc");
  const [qtyMode, setQtyMode] = useState<"shares" | "amount">("shares");
  const [qtyStr, setQtyStr] = useState(initialQuantity ? String(initialQuantity) : "");
  const [amountStr, setAmountStr] = useState("");
  const [limitStr, setLimitStr] = useState("");
  const [stopStr, setStopStr] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [review, setReview] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Manual record
  const [kind, setKind] = useState<TradeKind>("stock");
  const [quantity, setQuantity] = useState(initialQuantity ? String(initialQuantity) : "");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [tradeDate, setTradeDate] = useState(todayISO());
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [strike, setStrike] = useState("");
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tickerDirty) return; // don't pop suggestions over a pre-filled ticket
    const t = setTimeout(async () => {
      const q = symbol.trim();
      if (q.length < 1) {
        setHits([]);
        return;
      }
      try {
        const { hits } = await api<{ hits: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`);
        setHits(hits);
        setShowHits(true);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [symbol, tickerDirty]);

  // Pre-trade information (brokerage-style): fetch a full quote for the typed
  // or picked ticker; auto-fill the manual price the first time so records
  // start from the live market, not a blank.
  useEffect(() => {
    const raw = symbol.trim().toUpperCase();
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!/^[A-Z0-9][A-Z0-9.\-=]{0,11}$/.test(raw)) {
        if (!cancelled) setQuote(null);
        return;
      }
      setQuoteBusy(true);
      try {
        const { quote } = await api<{ quote: RichQuote }>(`/api/quote/${encodeURIComponent(raw)}`);
        if (cancelled) return;
        setQuote(quote);
        if (quote.price != null) {
          setPrice((p) => (p === "" ? String(quote.price) : p));
        }
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoteBusy(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [symbol]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setShowHits(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ---------------------------------------------------------------------
  // Order ticket derived state
  // ---------------------------------------------------------------------
  const currency = quote?.currency ?? "USD";
  const market = quote?.price ?? null;
  const limitPrice = limitStr ? Number(limitStr) : null;
  const stopPrice = stopStr ? Number(stopStr) : null;
  const needsLimit = orderType === "limit" || orderType === "stop_limit";
  const needsStop = orderType === "stop" || orderType === "stop_limit";

  // The price an estimate should assume: market now, or your limit/stop.
  const effPrice =
    orderType === "market"
      ? market
      : orderType === "stop"
        ? stopPrice
        : limitPrice;

  const shares =
    qtyMode === "shares"
      ? Number(qtyStr) || 0
      : effPrice && Number(amountStr) > 0
        ? Math.round((Number(amountStr) / effPrice) * 10000) / 10000
        : 0;

  const estTotal = effPrice != null && shares > 0 ? shares * effPrice : null;

  const sym = symbol.trim().toUpperCase();
  // Your standing in this name, so the ticket has the context a broker shows.
  // Two sources compose: the live book (any typed symbol) and the seeded
  // `held` prop from a position row (applies only while on that symbol).
  const heldApplies = held != null && sym === (initialSymbol ?? "").trim().toUpperCase();
  const heldPos =
    book?.positions.find((p) => p.symbol === sym) ??
    (heldApplies
      ? { symbol: sym, qty: held!, avgCost: 0, currency, marketValueUsd: 0 }
      : null);
  const workingOrders = book?.openOrders.filter((o) => o.symbol === sym).length ?? 0;
  const oversell =
    side === "sell" && shares > 0 && (heldPos ? heldPos.qty > 0 && shares > heldPos.qty : true);

  // Post-trade weight preview (USD names only — no FX guessing in a preview).
  const weightPreview = (() => {
    if (!book || book.totalUsd <= 0 || currency !== "USD" || estTotal == null) return null;
    const cur = book.positions.find((p) => p.symbol === sym)?.marketValueUsd ?? 0;
    const delta = side === "buy" ? estTotal : -estTotal;
    const post = Math.max(0, cur + delta);
    const postTotal = Math.max(1, book.totalUsd + delta);
    return {
      now: (cur / book.totalUsd) * 100,
      after: (post / postTotal) * 100,
    };
  })();

  const orderInput = {
    symbol: sym,
    side,
    quantity: shares,
    orderType,
    limitPrice: needsLimit ? (limitPrice ?? undefined) : undefined,
    stopPrice: needsStop ? (stopPrice ?? undefined) : undefined,
    tif,
    note: orderNote,
  };
  const validation = shares > 0 && symbol.trim() ? validateOrder(orderInput) : "incomplete";
  const canReview = validation === null && market != null;

  // Marketability preview: would this order fill right now?
  const marketable =
    market != null && validation === null && orderType !== "market"
      ? fillDecision({ side, orderType, limitPrice, stopPrice }, market).fills
      : false;

  async function place() {
    setPlacing(true);
    setOrderError(null);
    try {
      const { order } = await api<{ order: Order }>(`/api/portfolio/orders`, {
        method: "POST",
        body: JSON.stringify(orderInput),
      });
      setPlaced(order);
      setReview(false);
    } catch (e) {
      setOrderError(e instanceof Error ? localizeTradeMsg(e.message, t) : t("trade.errPlaceFailed"));
      setReview(false);
    } finally {
      setPlacing(false);
    }
  }

  async function submitRecord() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/portfolio/trades`, {
        method: "POST",
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          kind,
          side,
          quantity: Number(quantity),
          price: Number(price),
          fees: fees ? Number(fees) : 0,
          tradeDate,
          ...(kind === "option" ? { optionType, strike: Number(strike), expiry } : {}),
          note,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? localizeTradeMsg(e.message, t) : t("trade.errSaveTradeFailed"));
    } finally {
      setBusy(false);
    }
  }

  // A stock trade at 0 is almost certainly a data-entry slip; options can
  // legitimately close at 0 (expired worthless).
  const priceOk = kind === "option" ? Number(price) >= 0 : Number(price) > 0;
  const canSubmitRecord =
    symbol.trim() &&
    Number(quantity) > 0 &&
    priceOk &&
    price.trim() !== "" &&
    tradeDate &&
    (kind === "stock" || (Number(strike) > 0 && expiry));

  // Fat-finger guard: entered stock price far from the live market usually
  // means wrong units or currency.
  const deviates =
    kind === "stock" &&
    quote?.price != null &&
    Number(price) > 0 &&
    Math.abs(Number(price) - quote.price) / quote.price > 0.4;

  const field =
    "rounded-lg bg-card2 border border-hairline focus-within:border-accent/50 px-2.5 py-2 text-sm outline-none w-full transition-colors placeholder:text-muted/60";
  const label = "text-[0.625rem] uppercase tracking-wider text-muted";

  // -----------------------------------------------------------------------
  // Post-placement confirmation (the brokerage "order status" moment)
  // -----------------------------------------------------------------------
  if (placed) {
    const filled = placed.status === "filled";
    return (
      <div className="rounded-2xl bg-card border border-hairline p-4 space-y-3">
        <div className={`rounded-xl px-4 py-3 border ${filled ? "border-gain/30 bg-gain/8" : "border-accent/30 bg-accent/8"}`}>
          <p className="text-sm font-semibold">
            {filled ? t("trade.orderFilled") : t("trade.orderWorking")}
          </p>
          <p className="text-xs text-emph mt-1">
            {t(placed.side === "buy" ? "trade.buy" : "trade.sell").toUpperCase()}{" "}
            {placed.quantity.toLocaleString()} {placed.symbol} —{" "}
            {t(ORDER_TYPE_KEY[placed.orderType])}
            {placed.orderType !== "market" &&
              ` · ${t(placed.tif === "gtc" ? "trade.tifGtc" : "trade.tifDay").toUpperCase()}`}
          </p>
          {filled ? (
            <p className="text-xs text-emph mt-0.5 tabular-nums">
              {t("trade.simFilledAt", {
                price: placed.fillPrice != null ? fmtMoney(placed.fillPrice, currency) : t("trade.marketWord"),
              })}
            </p>
          ) : (
            <p className="text-xs text-muted mt-0.5">{t("trade.workingDesc")}</p>
          )}
        </div>
        <button
          onClick={onSaved}
          className="w-full rounded-lg bg-accent text-white text-sm font-semibold py-2 transition-colors"
        >
          {t("trade.done")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-hairline p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg bg-card2 border border-hairline p-0.5">
          {(
            [
              { v: "order", label: t("trade.modeOrder") },
              { v: "record", label: t("trade.modeRecord") },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === o.v ? "bg-ink/12 text-foreground" : "text-muted hover:text-emph"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="text-[0.6875rem] text-muted hover:text-emph">
          {t("common.cancel")}
        </button>
      </div>

      {/* Ticker (shared) */}
      <div ref={boxRef} className="relative">
        <p className={label}>{t("trade.ticker")}</p>
        <input
          value={symbol}
          onChange={(e) => {
            setTickerDirty(true);
            setSymbol(e.target.value);
          }}
          onFocus={() => hits.length && setShowHits(true)}
          placeholder={t("trade.tickerPlaceholder")}
          className={`${field} mt-1 uppercase`}
        />
        {showHits && hits.length > 0 && (
          <div className="absolute z-30 mt-1 w-full rounded-xl bg-card2 border border-hairline overflow-hidden shadow-2xl shadow-black/60">
            {hits.map((h) => (
              <button
                key={h.symbol}
                type="button"
                onClick={() => {
                  setSymbol(h.symbol);
                  setShowHits(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-ink/6 text-left"
              >
                <span>
                  <span className="font-semibold text-sm">{h.symbol}</span>
                  <span className="text-muted text-xs ml-2">{h.name}</span>
                </span>
                <span className="text-muted/70 text-[0.625rem]">{h.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pre-trade information — complete picture before the order (click a price to use it). */}
      {quote ? (
        <QuoteCard
          quote={quote}
          onUsePrice={(v) => {
            if (mode === "record") setPrice(String(v));
            else if (needsLimit) setLimitStr(String(v));
            else if (needsStop) setStopStr(String(v));
          }}
        />
      ) : quoteBusy ? (
        <div className="rounded-xl bg-card2 border border-hairline px-3.5 py-3 text-[0.6875rem] text-muted pulse-soft">
          {t("trade.fetchingQuote")}
        </div>
      ) : symbol.trim().length > 0 ? (
        <div className="rounded-xl bg-card2 border border-hairline px-3.5 py-3 text-[0.6875rem] text-muted">
          {t("trade.noQuoteYet", { sym: symbol.trim().toUpperCase() })}
        </div>
      ) : null}

      {/* Your standing in this name, front and center while you trade it. */}
      {heldPos && heldPos.avgCost > 0 && (
        <div className="rounded-xl bg-card2 border border-hairline px-3.5 py-2 text-[0.6875rem] text-emph tabular-nums flex items-center gap-2 flex-wrap">
          <span className="text-[0.625rem] uppercase tracking-wider text-muted">{t("trade.yourPosition")}</span>
          <span>
            {t(heldPos.qty < 0 ? "trade.posShort" : "trade.posLong", {
              n: Math.abs(heldPos.qty).toLocaleString(),
              price: fmtMoney(heldPos.avgCost, heldPos.currency),
            })}
          </span>
          {workingOrders > 0 && (
            <span className="text-muted">
              · {t(workingOrders === 1 ? "trade.workingOrdersOne" : "trade.workingOrdersMany", { n: workingOrders })}
            </span>
          )}
        </div>
      )}

      {mode === "order" ? (
        review ? (
          /* ---------------- Review step ---------------- */
          <div className="space-y-3">
            <div className="rounded-xl bg-card2 border border-hairline px-4 py-3 space-y-1.5">
              <p className="text-[0.625rem] uppercase tracking-wider text-muted">{t("trade.reviewOrder")}</p>
              <p className="text-sm font-semibold">
                <span className={side === "buy" ? "text-gain" : "text-loss"}>
                  {t(side === "buy" ? "trade.buy" : "trade.sell").toUpperCase()}
                </span>{" "}
                {shares.toLocaleString()} {symbol.trim().toUpperCase()} — {t(ORDER_TYPE_KEY[orderType])}
                {orderType !== "market" && (
                  <span className="text-muted font-normal">
                    {" "}
                    · {t(tif === "gtc" ? "trade.tifGtc" : "trade.tifDay").toUpperCase()}
                  </span>
                )}
              </p>
              {needsStop && stopPrice != null && (
                <p className="text-xs text-emph tabular-nums">{t("trade.stopAt", { price: fmtMoney(stopPrice, currency) })}</p>
              )}
              {needsLimit && limitPrice != null && (
                <p className="text-xs text-emph tabular-nums">{t("trade.limitAt", { price: fmtMoney(limitPrice, currency) })}</p>
              )}
              {estTotal != null && (
                <p className="text-xs text-emph tabular-nums">
                  {t(side === "buy" ? "trade.reviewEstCost" : "trade.reviewEstProceeds", {
                    amount: fmtMoney(estTotal, currency),
                  })}
                  {orderType === "market" && <span className="text-muted"> {t("trade.liveMarketMayDiffer")}</span>}
                </p>
              )}
              {marketable && (
                <p className="text-[0.6875rem] text-warn">{t("trade.marketableReview")}</p>
              )}
              {side === "buy" && cashUsd != null && currency === "USD" && estTotal != null && (
                <p className={`text-[0.6875rem] tabular-nums ${estTotal > cashUsd ? "text-warn" : "text-muted"}`}>
                  {t("trade.cashAvailable", { amount: fmtMoney(cashUsd, "USD") })}
                  {estTotal > cashUsd && ` ${t("trade.cashExceeds")}`}
                </p>
              )}
              {weightPreview && (
                <p className="text-[0.6875rem] text-muted tabular-nums">
                  {t("trade.weightPreview", {
                    now: weightPreview.now.toFixed(1),
                    after: weightPreview.after.toFixed(1),
                  })}
                </p>
              )}
              {oversell && (
                <p className="text-[0.6875rem] text-warn">
                  {t(heldPos && heldPos.qty > 0 ? "trade.oversellReviewOpen" : "trade.oversellReviewExtend")}
                </p>
              )}
            </div>
            {orderError && <p className="text-loss text-xs">{orderError}</p>}
            <div className="flex gap-2">
              <button
                onClick={place}
                disabled={placing}
                className={`flex-1 rounded-lg text-white text-sm font-semibold py-2 transition-colors disabled:opacity-60 ${
                  side === "buy" ? "bg-gain/80 hover:bg-gain/90 text-chipfg" : "bg-loss/80 hover:bg-loss/90"
                }`}
              >
                {placing ? t("trade.placing") : t(side === "buy" ? "trade.placeBuyOrder" : "trade.placeSellOrder")}
              </button>
              <button
                onClick={() => setReview(false)}
                disabled={placing}
                className="rounded-lg bg-ink/8 hover:bg-ink/12 text-sm font-medium px-4 py-2 transition-colors"
              >
                {t("common.edit")}
              </button>
            </div>
          </div>
        ) : (
          /* ---------------- Order entry ---------------- */
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={label}>{t("trade.side")}</p>
                <div className="mt-1">
                  <Toggle
                    value={side}
                    options={[
                      { v: "buy", label: t("trade.buy") },
                      { v: "sell", label: t("trade.sell") },
                    ]}
                    onChange={setSide}
                  />
                </div>
              </div>
              <div>
                <p className={label}>{t("trade.timeInForce")}</p>
                <div className="mt-1">
                  {orderType === "market" ? (
                    <div className="rounded-lg bg-card2 border border-hairline px-2.5 py-1.5 text-xs text-muted">
                      {t("trade.tifImmediate")}
                    </div>
                  ) : (
                    <Toggle
                      value={tif}
                      options={[
                        { v: "gtc", label: t("trade.tifGtc") },
                        { v: "day", label: t("trade.tifDay") },
                      ]}
                      onChange={setTif}
                    />
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className={label}>{t("trade.orderType")}</p>
              <div className="mt-1">
                <Toggle
                  value={orderType}
                  options={(Object.keys(ORDER_TYPE_KEY) as OrderType[]).map((v) => ({
                    v,
                    label: t(ORDER_TYPE_KEY[v]),
                  }))}
                  onChange={setOrderType}
                />
              </div>
              <p className="text-[0.625rem] text-muted mt-1">{t(ORDER_TYPE_HINT_KEY[orderType])}</p>
            </div>

            {(needsStop || needsLimit) && (
              <div className="grid grid-cols-2 gap-3">
                {needsStop && (
                  <div>
                    <p className={label}>{t("trade.stopPrice")} · {currency}</p>
                    <input
                      inputMode="decimal"
                      value={stopStr}
                      onChange={(e) => setStopStr(e.target.value)}
                      placeholder={market != null ? String(market) : "0.00"}
                      className={`${field} mt-1 tabular-nums`}
                    />
                  </div>
                )}
                {needsLimit && (
                  <div>
                    <p className={label}>{t("trade.limitPrice")} · {currency}</p>
                    <input
                      inputMode="decimal"
                      value={limitStr}
                      onChange={(e) => setLimitStr(e.target.value)}
                      placeholder={market != null ? String(market) : "0.00"}
                      className={`${field} mt-1 tabular-nums`}
                    />
                  </div>
                )}
              </div>
            )}
            {(needsStop || needsLimit) && (
              <div className="-mt-1 flex flex-wrap items-center gap-1.5 text-[0.625rem]">
                <span className="text-muted">{t("trade.anchors")}</span>
                {(
                  [
                    market != null ? { label: t("trade.anchorMarket", { v: market }), v: market } : null,
                    heldPos && heldPos.avgCost > 0
                      ? { label: t("trade.anchorCost", { v: heldPos.avgCost }), v: heldPos.avgCost }
                      : null,
                    quote?.wk52Low != null ? { label: t("trade.anchorLow", { v: quote.wk52Low }), v: quote.wk52Low } : null,
                    quote?.wk52High != null ? { label: t("trade.anchorHigh", { v: quote.wk52High }), v: quote.wk52High } : null,
                  ].filter(Boolean) as { label: string; v: number }[]
                ).map((a) => (
                  <button
                    key={a.label}
                    onClick={() => (needsLimit ? setLimitStr(String(a.v)) : setStopStr(String(a.v)))}
                    title={needsLimit ? t("trade.useAsLimit") : t("trade.useAsStop")}
                    className="rounded-full border border-hairline bg-ink/4 hover:bg-ink/10 px-2 py-0.5 text-emph tabular-nums transition-colors"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
              <div>
                <p className={label}>{t("trade.quantityIn")}</p>
                <div className="mt-1">
                  <Toggle
                    value={qtyMode}
                    options={[
                      { v: "shares", label: t("trade.sharesToggle") },
                      { v: "amount", label: currency },
                    ]}
                    onChange={setQtyMode}
                  />
                </div>
              </div>
              <div>
                <p className={label}>
                  {qtyMode === "shares" ? t("trade.sharesField") : `${t("trade.amountField")} · ${currency}`}
                </p>
                <input
                  inputMode="decimal"
                  value={qtyMode === "shares" ? qtyStr : amountStr}
                  onChange={(e) =>
                    qtyMode === "shares" ? setQtyStr(e.target.value) : setAmountStr(e.target.value)
                  }
                  placeholder={qtyMode === "shares" ? "10" : "1000"}
                  className={`${field} mt-1 tabular-nums`}
                />
              </div>
            </div>
            {qtyMode === "amount" && shares > 0 && (
              <p className="text-[0.6875rem] text-muted -mt-1.5 tabular-nums">
                {t("trade.approxShares", {
                  n: shares.toLocaleString(),
                  price: effPrice != null ? fmtMoney(effPrice, currency) : t("trade.marketWord"),
                })}
              </p>
            )}
            {heldApplies && side === "sell" && (held as number) > 0 && (
              <p className="text-[0.6875rem] text-muted -mt-1.5 tabular-nums">
                {t("trade.youHold", { n: (held as number).toLocaleString() })}
                {shares > (held as number) && (
                  <span className="text-warn"> {t("trade.sellMoreShort")}</span>
                )}
                {shares !== held && (
                  <button
                    type="button"
                    onClick={() => {
                      setQtyMode("shares");
                      setQtyStr(String(held));
                    }}
                    className="ml-2 text-accent hover:opacity-80 font-medium"
                  >
                    {t("trade.sellAll")}
                  </button>
                )}
              </p>
            )}
            {heldApplies && side === "buy" && (held as number) < 0 && (
              <p className="text-[0.6875rem] text-muted -mt-1.5 tabular-nums">
                {t("trade.youreShort", { n: Math.abs(held as number).toLocaleString() })}
                {shares > Math.abs(held as number) && (
                  <span className="text-warn"> {t("trade.buyMoreLong")}</span>
                )}
                {shares !== Math.abs(held as number) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQtyMode("shares");
                      setQtyStr(String(Math.abs(held as number)));
                    }}
                    className="ml-2 text-accent hover:opacity-80 font-medium"
                  >
                    {t("trade.coverAll")}
                  </button>
                )}
              </p>
            )}

            <div>
              <p className={label}>{t("trade.noteOptional")}</p>
              <input
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder={t("trade.orderNotePlaceholder")}
                className={`${field} mt-1`}
              />
            </div>

            {estTotal != null && (
              <p className="text-xs text-emph tabular-nums">
                {t(side === "buy" ? "trade.estCost" : "trade.estProceeds")}{" "}
                <span className="font-semibold">{fmtMoney(estTotal, currency)}</span>
                {orderType === "market" && <span className="text-muted"> {t("trade.atLiveMarket")}</span>}
              </p>
            )}
            {marketable && (
              <p className="text-[0.6875rem] text-warn">
                {t("trade.marketableEntry", { type: t(ORDER_TYPE_KEY[orderType]).toLowerCase() })}
              </p>
            )}
            {oversell && (
              <p className="text-[0.6875rem] text-warn">
                {heldPos && heldPos.qty > 0
                  ? t("trade.oversellHeld", {
                      held: heldPos.qty.toLocaleString(),
                      n: shares.toLocaleString(),
                      diff: (shares - heldPos.qty).toLocaleString(),
                    })
                  : t("trade.oversellNone")}
              </p>
            )}
            {typeof validation === "string" && validation !== "incomplete" && (
              <p className="text-[0.6875rem] text-loss">{localizeTradeMsg(validation, t)}</p>
            )}
            {market == null && symbol.trim() !== "" && !quoteBusy && (
              <p className="text-[0.6875rem] text-muted">{t("trade.needLiveQuote")}</p>
            )}

            <button
              onClick={() => setReview(true)}
              disabled={!canReview}
              className="w-full rounded-lg bg-accent disabled:bg-ink/10 disabled:text-muted text-white text-sm font-semibold py-2 transition-colors"
            >
              {t(side === "buy" ? "trade.reviewBuyOrder" : "trade.reviewSellOrder", {
                sym: symbol.trim().toUpperCase() || "…",
              })}
            </button>
            <p className="text-[0.625rem] text-muted/70">{t("trade.paperNote")}</p>
          </div>
        )
      ) : (
        /* ---------------- Manual record ---------------- */
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={label}>{t("trade.instrument")}</p>
              <div className="mt-1">
                <Toggle
                  value={kind}
                  options={[
                    { v: "stock", label: t("trade.stock") },
                    { v: "option", label: t("trade.option") },
                  ]}
                  onChange={setKind}
                />
              </div>
            </div>
            <div>
              <p className={label}>{t("trade.side")}</p>
              <div className="mt-1">
                <Toggle
                  value={side}
                  options={[
                    { v: "buy", label: t("trade.buy") },
                    { v: "sell", label: t("trade.sell") },
                  ]}
                  onChange={setSide}
                />
              </div>
            </div>
          </div>

          <div>
            <p className={label}>{t("trade.tradeDate")}</p>
            <input
              type="date"
              value={tradeDate}
              max={todayISO()}
              onChange={(e) => setTradeDate(e.target.value)}
              className={`${field} mt-1`}
            />
          </div>

          {kind === "option" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className={label}>{t("trade.optionType")}</p>
                <div className="mt-1">
                  <Toggle
                    value={optionType}
                    options={[
                      { v: "call", label: t("trade.call") },
                      { v: "put", label: t("trade.put") },
                    ]}
                    onChange={setOptionType}
                  />
                </div>
              </div>
              <div>
                <p className={label}>{t("trade.strike")}</p>
                <input
                  inputMode="decimal"
                  value={strike}
                  onChange={(e) => setStrike(e.target.value)}
                  placeholder="100"
                  className={`${field} mt-1 tabular-nums`}
                />
              </div>
              <div>
                <p className={label}>{t("trade.expiry")}</p>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={`${field} mt-1`} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className={label}>{kind === "option" ? t("trade.contracts") : t("trade.sharesField")}</p>
              <input
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className={`${field} mt-1 tabular-nums`}
              />
            </div>
            <div>
              <p className={label}>
                {kind === "option" ? t("trade.premiumPerShare") : t("trade.pricePerShare")}
                {quote && <span className="normal-case tracking-normal"> · {quote.currency}</span>}
              </p>
              <input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="84.50"
                className={`${field} mt-1 tabular-nums`}
              />
              {kind === "option" && (
                <p className="text-[0.625rem] text-muted mt-0.5">{t("trade.perContractNote")}</p>
              )}
            </div>
            <div>
              <p className={label}>{t("trade.feesOptional")}</p>
              <input
                inputMode="decimal"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="0"
                className={`${field} mt-1 tabular-nums`}
              />
            </div>
          </div>

          <div>
            <p className={label}>{t("trade.noteOptional")}</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("trade.recordNotePlaceholder")}
              className={`${field} mt-1`}
            />
          </div>

          {deviates && quote?.price != null && (
            <p className="text-warn text-[0.6875rem]">
              {t("trade.priceDeviates", { price: fmtMoney(quote.price, quote.currency) })}
            </p>
          )}
          {error && <p className="text-loss text-xs">{error}</p>}
          <button
            onClick={submitRecord}
            disabled={!canSubmitRecord || busy}
            className="w-full rounded-lg bg-accent disabled:bg-ink/10 disabled:text-muted text-white text-sm font-semibold py-2 transition-colors"
          >
            {busy
              ? t("common.saving")
              : t(side === "buy" ? "trade.recordBuy" : "trade.recordSell", {
                  inst:
                    kind === "option"
                      ? t(optionType === "call" ? "trade.callOn" : "trade.putOn", {
                          sym: symbol.trim().toUpperCase() || "…",
                        })
                      : symbol.trim().toUpperCase() || "…",
                })}
          </button>
        </div>
      )}
    </div>
  );
}
