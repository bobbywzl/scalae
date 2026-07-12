"use client";

import { useEffect, useRef, useState } from "react";
import { QuoteCard } from "./QuoteCard";
import { api } from "./util";
import type { SearchHit } from "@/lib/market";
import type { RichQuote, TradeKind, TradeSide, OptionType } from "@/lib/types";

const todayISO = () => new Date().toISOString().slice(0, 10);

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
          className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            value === o.v ? "bg-white/12 text-foreground" : "text-muted hover:text-[#c7c7cc]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Record a stock or option trade (buy/sell) into the portfolio ledger. */
export function TradeForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [showHits, setShowHits] = useState(false);
  const [kind, setKind] = useState<TradeKind>("stock");
  const [side, setSide] = useState<TradeSide>("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("");
  const [tradeDate, setTradeDate] = useState(todayISO());
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [strike, setStrike] = useState("");
  const [expiry, setExpiry] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<RichQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, [symbol]);

  // Pre-trade information (brokerage-style): fetch a full quote for the typed
  // or picked ticker; auto-fill the price field the first time so orders start
  // from the live market, not a blank.
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

  async function submit() {
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
  const canSubmit =
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

  return (
    <div className="rounded-2xl bg-card border border-hairline p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Record a trade</p>
        <button onClick={onCancel} className="text-[11px] text-muted hover:text-[#c7c7cc]">
          Cancel
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div ref={boxRef} className="relative">
          <p className={label}>Ticker</p>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
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
        <div>
          <p className={label}>Date</p>
          <input type="date" value={tradeDate} max={todayISO()} onChange={(e) => setTradeDate(e.target.value)} className={`${field} mt-1`} />
        </div>
      </div>

      {/* Pre-trade information — complete picture before the order (click a price to use it). */}
      {quote ? (
        <QuoteCard quote={quote} onUsePrice={(v) => setPrice(String(v))} />
      ) : quoteBusy ? (
        <div className="rounded-xl bg-card2 border border-hairline px-3.5 py-3 text-[11px] text-muted pulse-soft">
          Fetching quote…
        </div>
      ) : symbol.trim().length > 0 ? (
        <div className="rounded-xl bg-card2 border border-hairline px-3.5 py-3 text-[11px] text-muted">
          No live quote for “{symbol.trim().toUpperCase()}” yet — pick a ticker from the search results.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={label}>Instrument</p>
          <div className="mt-1">
            <Toggle value={kind} options={[{ v: "stock", label: "Stock" }, { v: "option", label: "Option" }]} onChange={setKind} />
          </div>
        </div>
        <div>
          <p className={label}>Side</p>
          <div className="mt-1">
            <Toggle value={side} options={[{ v: "buy", label: "Buy" }, { v: "sell", label: "Sell" }]} onChange={setSide} />
          </div>
        </div>
      </div>

      {kind === "option" && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className={label}>Type</p>
            <div className="mt-1">
              <Toggle value={optionType} options={[{ v: "call", label: "Call" }, { v: "put", label: "Put" }]} onChange={setOptionType} />
            </div>
          </div>
          <div>
            <p className={label}>Strike</p>
            <input inputMode="decimal" value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="100" className={`${field} mt-1 tabular-nums`} />
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
          <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10" className={`${field} mt-1 tabular-nums`} />
        </div>
        <div>
          <p className={label}>
            {kind === "option" ? "Premium / share" : "Price / share"}
            {quote && <span className="normal-case tracking-normal"> · {quote.currency}</span>}
          </p>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="84.50" className={`${field} mt-1 tabular-nums`} />
          {kind === "option" && <p className="text-[10px] text-muted mt-0.5">×100 per contract, in the ticker’s currency</p>}
        </div>
        <div>
          <p className={label}>Fees (optional)</p>
          <input inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" className={`${field} mt-1 tabular-nums`} />
        </div>
      </div>

      <div>
        <p className={label}>Note (optional)</p>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="thesis, broker, lot…" className={`${field} mt-1`} />
      </div>

      {deviates && quote?.price != null && (
        <p className="text-warn text-[11px]">
          ⚠ Entered price is far from the live market ({quote.currency === "USD" ? "$" : quote.currency + " "}
          {quote.price.toLocaleString()}) — check units and currency before recording.
        </p>
      )}
      {error && <p className="text-loss text-xs">{error}</p>}
      <button
        onClick={submit}
        disabled={!canSubmit || busy}
        className="w-full rounded-lg bg-accent disabled:bg-white/10 disabled:text-muted text-white text-sm font-semibold py-2 transition-colors"
      >
        {busy ? "Saving…" : `Record ${side} — ${kind === "option" ? `${optionType} on ` : ""}${symbol.trim().toUpperCase() || "…"}`}
      </button>
    </div>
  );
}
