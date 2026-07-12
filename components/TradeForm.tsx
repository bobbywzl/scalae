"use client";

import { useEffect, useRef, useState } from "react";
import { fillDecision, validateOrder } from "@/lib/order-math";
import type { SearchHit } from "@/lib/market";
import type { Order, OptionType, OrderTif, OrderType, RichQuote, TradeKind, TradeSide } from "@/lib/types";
import { QuoteCard } from "./QuoteCard";
import { api } from "./util";

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
            value === o.v ? "bg-white/12 text-foreground" : "text-muted hover:text-[#c7c7cc]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  market: "Market",
  limit: "Limit",
  stop: "Stop",
  stop_limit: "Stop-limit",
};

const ORDER_TYPE_HINT: Record<OrderType, string> = {
  market: "Fills immediately at the live market price.",
  limit: "Fills only at your limit price or better.",
  stop: "Becomes a market order once the stop price trades.",
  stop_limit: "Once the stop triggers, fills only at your limit or better.",
};

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
}) {
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

  // Position context only makes sense while the ticket is on the seeded symbol.
  const heldApplies =
    held != null && symbol.trim().toUpperCase() === (initialSymbol ?? "").trim().toUpperCase();

  const orderInput = {
    symbol: symbol.trim().toUpperCase(),
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
      setOrderError(e instanceof Error ? e.message : "Failed to place order");
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
      setError(e instanceof Error ? e.message : "Failed to save trade");
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
  const label = "text-[10px] uppercase tracking-wider text-muted";

  // -----------------------------------------------------------------------
  // Post-placement confirmation (the brokerage "order status" moment)
  // -----------------------------------------------------------------------
  if (placed) {
    const filled = placed.status === "filled";
    return (
      <div className="rounded-2xl bg-card border border-hairline p-4 space-y-3">
        <div className={`rounded-xl px-4 py-3 border ${filled ? "border-gain/30 bg-gain/8" : "border-accent/30 bg-accent/8"}`}>
          <p className="text-sm font-semibold">
            {filled ? "✓ Order filled" : "◷ Order working"}
          </p>
          <p className="text-xs text-[#c7c7cc] mt-1">
            {placed.side.toUpperCase()} {placed.quantity.toLocaleString()} {placed.symbol} —{" "}
            {ORDER_TYPE_LABEL[placed.orderType]}
            {placed.orderType !== "market" && ` · ${placed.tif.toUpperCase()}`}
          </p>
          {filled ? (
            <p className="text-xs text-[#c7c7cc] mt-0.5 tabular-nums">
              Simulated fill at {placed.fillPrice != null ? fmtMoney(placed.fillPrice, currency) : "market"} — recorded in
              your ledger.
            </p>
          ) : (
            <p className="text-xs text-muted mt-0.5">
              Fills automatically when the live price crosses your trigger — checked whenever the
              portfolio refreshes. Cancel any time from Open orders.
            </p>
          )}
        </div>
        <button
          onClick={onSaved}
          className="w-full rounded-lg bg-accent text-white text-sm font-semibold py-2 transition-colors"
        >
          Done
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
              { v: "order", label: "Place order" },
              { v: "record", label: "Record past trade" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === o.v ? "bg-white/12 text-foreground" : "text-muted hover:text-[#c7c7cc]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="text-[11px] text-muted hover:text-[#c7c7cc]">
          Cancel
        </button>
      </div>

      {/* Ticker (shared) */}
      <div ref={boxRef} className="relative">
        <p className={label}>Ticker</p>
        <input
          value={symbol}
          onChange={(e) => {
            setTickerDirty(true);
            setSymbol(e.target.value);
          }}
          onFocus={() => hits.length && setShowHits(true)}
          placeholder="AAPL, PDD, 9983.T…"
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
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/6 text-left"
              >
                <span>
                  <span className="font-semibold text-sm">{h.symbol}</span>
                  <span className="text-muted text-xs ml-2">{h.name}</span>
                </span>
                <span className="text-muted/70 text-[10px]">{h.exchange}</span>
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
        <div className="rounded-xl bg-card2 border border-hairline px-3.5 py-3 text-[11px] text-muted pulse-soft">
          Fetching quote…
        </div>
      ) : symbol.trim().length > 0 ? (
        <div className="rounded-xl bg-card2 border border-hairline px-3.5 py-3 text-[11px] text-muted">
          No live quote for “{symbol.trim().toUpperCase()}” yet — pick a ticker from the search results.
        </div>
      ) : null}

      {mode === "order" ? (
        review ? (
          /* ---------------- Review step ---------------- */
          <div className="space-y-3">
            <div className="rounded-xl bg-card2 border border-hairline px-4 py-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted">Review order</p>
              <p className="text-sm font-semibold">
                <span className={side === "buy" ? "text-gain" : "text-loss"}>{side.toUpperCase()}</span>{" "}
                {shares.toLocaleString()} {symbol.trim().toUpperCase()} — {ORDER_TYPE_LABEL[orderType]}
                {orderType !== "market" && <span className="text-muted font-normal"> · {tif.toUpperCase()}</span>}
              </p>
              {needsStop && stopPrice != null && (
                <p className="text-xs text-[#c7c7cc] tabular-nums">Stop {fmtMoney(stopPrice, currency)}</p>
              )}
              {needsLimit && limitPrice != null && (
                <p className="text-xs text-[#c7c7cc] tabular-nums">Limit {fmtMoney(limitPrice, currency)}</p>
              )}
              {estTotal != null && (
                <p className="text-xs text-[#c7c7cc] tabular-nums">
                  Estimated {side === "buy" ? "cost" : "proceeds"}: {fmtMoney(estTotal, currency)}
                  {orderType === "market" && <span className="text-muted"> (at live market — final price may differ)</span>}
                </p>
              )}
              {marketable && (
                <p className="text-[11px] text-warn">
                  ⚡ Marketable — the live price already satisfies this order, so it will fill immediately.
                </p>
              )}
              {side === "buy" && cashUsd != null && currency === "USD" && estTotal != null && (
                <p className={`text-[11px] tabular-nums ${estTotal > cashUsd ? "text-warn" : "text-muted"}`}>
                  Cash available: {fmtMoney(cashUsd, "USD")}
                  {estTotal > cashUsd &&
                    " — this order exceeds it (the book records it anyway; no margin is modeled)."}
                </p>
              )}
            </div>
            {orderError && <p className="text-loss text-xs">{orderError}</p>}
            <div className="flex gap-2">
              <button
                onClick={place}
                disabled={placing}
                className={`flex-1 rounded-lg text-white text-sm font-semibold py-2 transition-colors disabled:opacity-60 ${
                  side === "buy" ? "bg-gain/80 hover:bg-gain/90 text-black" : "bg-loss/80 hover:bg-loss/90"
                }`}
              >
                {placing ? "Placing…" : `Place ${side} order`}
              </button>
              <button
                onClick={() => setReview(false)}
                disabled={placing}
                className="rounded-lg bg-white/8 hover:bg-white/12 text-sm font-medium px-4 py-2 transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        ) : (
          /* ---------------- Order entry ---------------- */
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={label}>Side</p>
                <div className="mt-1">
                  <Toggle
                    value={side}
                    options={[
                      { v: "buy", label: "Buy" },
                      { v: "sell", label: "Sell" },
                    ]}
                    onChange={setSide}
                  />
                </div>
              </div>
              <div>
                <p className={label}>Time in force</p>
                <div className="mt-1">
                  {orderType === "market" ? (
                    <div className="rounded-lg bg-card2 border border-hairline px-2.5 py-1.5 text-xs text-muted">
                      Immediate
                    </div>
                  ) : (
                    <Toggle
                      value={tif}
                      options={[
                        { v: "gtc", label: "GTC" },
                        { v: "day", label: "Day" },
                      ]}
                      onChange={setTif}
                    />
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className={label}>Order type</p>
              <div className="mt-1">
                <Toggle
                  value={orderType}
                  options={(Object.keys(ORDER_TYPE_LABEL) as OrderType[]).map((v) => ({
                    v,
                    label: ORDER_TYPE_LABEL[v],
                  }))}
                  onChange={setOrderType}
                />
              </div>
              <p className="text-[10px] text-muted mt-1">{ORDER_TYPE_HINT[orderType]}</p>
            </div>

            {(needsStop || needsLimit) && (
              <div className="grid grid-cols-2 gap-3">
                {needsStop && (
                  <div>
                    <p className={label}>Stop price · {currency}</p>
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
                    <p className={label}>Limit price · {currency}</p>
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

            <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
              <div>
                <p className={label}>Quantity in</p>
                <div className="mt-1">
                  <Toggle
                    value={qtyMode}
                    options={[
                      { v: "shares", label: "Shares" },
                      { v: "amount", label: currency },
                    ]}
                    onChange={setQtyMode}
                  />
                </div>
              </div>
              <div>
                <p className={label}>{qtyMode === "shares" ? "Shares" : `Amount · ${currency}`}</p>
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
              <p className="text-[11px] text-muted -mt-1.5 tabular-nums">
                ≈ {shares.toLocaleString()} shares at{" "}
                {effPrice != null ? fmtMoney(effPrice, currency) : "market"}
                {" "}(fractional supported)
              </p>
            )}
            {heldApplies && side === "sell" && (held as number) > 0 && (
              <p className="text-[11px] text-muted -mt-1.5 tabular-nums">
                You hold {(held as number).toLocaleString()} sh
                {shares > (held as number) && (
                  <span className="text-warn"> — selling more opens a short</span>
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
                    Sell all
                  </button>
                )}
              </p>
            )}
            {heldApplies && side === "buy" && (held as number) < 0 && (
              <p className="text-[11px] text-muted -mt-1.5 tabular-nums">
                You’re short {Math.abs(held as number).toLocaleString()} sh
                {shares > Math.abs(held as number) && (
                  <span className="text-warn"> — buying more than that goes net long</span>
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
                    Cover all
                  </button>
                )}
              </p>
            )}

            <div>
              <p className={label}>Note (optional)</p>
              <input
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="thesis, margin-of-safety math…"
                className={`${field} mt-1`}
              />
            </div>

            {estTotal != null && (
              <p className="text-xs text-[#c7c7cc] tabular-nums">
                Estimated {side === "buy" ? "cost" : "proceeds"}:{" "}
                <span className="font-semibold">{fmtMoney(estTotal, currency)}</span>
                {orderType === "market" && <span className="text-muted"> at live market</span>}
              </p>
            )}
            {marketable && (
              <p className="text-[11px] text-warn">
                ⚡ The live price already satisfies this {ORDER_TYPE_LABEL[orderType].toLowerCase()} — it
                will fill immediately at market, like a marketable order at any broker.
              </p>
            )}
            {typeof validation === "string" && validation !== "incomplete" && (
              <p className="text-[11px] text-loss">{validation}</p>
            )}
            {market == null && symbol.trim() !== "" && !quoteBusy && (
              <p className="text-[11px] text-muted">
                Orders need a live quote — no market data for this symbol. Use “Record past trade”
                instead.
              </p>
            )}

            <button
              onClick={() => setReview(true)}
              disabled={!canReview}
              className="w-full rounded-lg bg-accent disabled:bg-white/10 disabled:text-muted text-white text-sm font-semibold py-2 transition-colors"
            >
              Review {side} order — {symbol.trim().toUpperCase() || "…"}
            </button>
            <p className="text-[10px] text-muted/70">
              Paper execution: fills are simulated against live quotes when your portfolio refreshes —
              options and off-market fills go in via “Record past trade”.
            </p>
          </div>
        )
      ) : (
        /* ---------------- Manual record ---------------- */
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={label}>Instrument</p>
              <div className="mt-1">
                <Toggle
                  value={kind}
                  options={[
                    { v: "stock", label: "Stock" },
                    { v: "option", label: "Option" },
                  ]}
                  onChange={setKind}
                />
              </div>
            </div>
            <div>
              <p className={label}>Side</p>
              <div className="mt-1">
                <Toggle
                  value={side}
                  options={[
                    { v: "buy", label: "Buy" },
                    { v: "sell", label: "Sell" },
                  ]}
                  onChange={setSide}
                />
              </div>
            </div>
          </div>

          <div>
            <p className={label}>Trade date</p>
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
                <p className={label}>Type</p>
                <div className="mt-1">
                  <Toggle
                    value={optionType}
                    options={[
                      { v: "call", label: "Call" },
                      { v: "put", label: "Put" },
                    ]}
                    onChange={setOptionType}
                  />
                </div>
              </div>
              <div>
                <p className={label}>Strike</p>
                <input
                  inputMode="decimal"
                  value={strike}
                  onChange={(e) => setStrike(e.target.value)}
                  placeholder="100"
                  className={`${field} mt-1 tabular-nums`}
                />
              </div>
              <div>
                <p className={label}>Expiry</p>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={`${field} mt-1`} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className={label}>{kind === "option" ? "Contracts" : "Shares"}</p>
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
                {kind === "option" ? "Premium / share" : "Price / share"}
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
                <p className="text-[10px] text-muted mt-0.5">×100 per contract, in the ticker’s currency</p>
              )}
            </div>
            <div>
              <p className={label}>Fees (optional)</p>
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
            <p className={label}>Note (optional)</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="thesis, broker, lot…"
              className={`${field} mt-1`}
            />
          </div>

          {deviates && quote?.price != null && (
            <p className="text-warn text-[11px]">
              ⚠ Entered price is far from the live market ({fmtMoney(quote.price, quote.currency)}) —
              check units and currency before recording.
            </p>
          )}
          {error && <p className="text-loss text-xs">{error}</p>}
          <button
            onClick={submitRecord}
            disabled={!canSubmitRecord || busy}
            className="w-full rounded-lg bg-accent disabled:bg-white/10 disabled:text-muted text-white text-sm font-semibold py-2 transition-colors"
          >
            {busy
              ? "Saving…"
              : `Record ${side} — ${kind === "option" ? `${optionType} on ` : ""}${symbol.trim().toUpperCase() || "…"}`}
          </button>
        </div>
      )}
    </div>
  );
}
