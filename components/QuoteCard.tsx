"use client";

import { Sparkline } from "./Sparkline";
import { useT } from "./PrefsProvider";
import type { TKey } from "@/lib/i18n/dictionaries";
import type { RichQuote } from "@/lib/types";

const cur$ = (c: string) => (c === "USD" ? "$" : c + " ");

const fmt = (v: number | null | undefined, digits = 2) =>
  v == null ? "—" : v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fmtInt = (v: number | null | undefined) =>
  v == null ? "—" : v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e4 ? `${(v / 1e3).toFixed(1)}k` : v.toLocaleString();

const fmtCap = (v: number | null | undefined, c: string) =>
  v == null ? "—" : `${cur$(c)}${v >= 1e12 ? (v / 1e12).toFixed(2) + "T" : v >= 1e9 ? (v / 1e9).toFixed(1) + "B" : (v / 1e6).toFixed(0) + "M"}`;

const MARKET_STATE_KEY: Record<string, TKey> = {
  REGULAR: "trade.stateOpen",
  PRE: "trade.statePre",
  POST: "trade.statePost",
  CLOSED: "trade.stateClosed",
  PREPRE: "trade.statePre",
  POSTPOST: "trade.statePost",
};

/** Low–high range with a marker at the current price (Schwab-style). */
function RangeBar({ low, high, value }: { low: number | null; high: number | null; value: number | null }) {
  if (low == null || high == null || value == null || high <= low) return null;
  const f = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return (
    <span className="relative inline-block w-16 h-1 rounded-full bg-ink/12 align-middle mx-1.5">
      <span
        className="absolute -top-[2.5px] h-2 w-2 rounded-full bg-emph border border-card"
        style={{ left: `calc(${(f * 100).toFixed(1)}% - 4px)` }}
      />
    </span>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-[11px] tabular-nums text-emph mt-px truncate">{children}</p>
    </div>
  );
}

/**
 * Pre-trade stock information, brokerage-style: identity, last/change, bid/ask
 * (click to fill the order price), ranges, volume and valuation basics.
 */
export function QuoteCard({
  quote: q,
  onUsePrice,
}: {
  quote: RichQuote;
  onUsePrice?: (price: number) => void;
}) {
  const { t } = useT();
  const up = (q.changePercent ?? 0) >= 0;
  const c = q.currency;
  const stateKey = q.marketState ? MARKET_STATE_KEY[q.marketState] : undefined;
  const state = q.marketState ? (stateKey ? t(stateKey) : q.marketState.toLowerCase()) : null;

  const priceBtn = (title: string, v: number | null) =>
    v != null && v > 0 && onUsePrice ? (
      <button
        type="button"
        onClick={() => onUsePrice(v)}
        title={title}
        className="underline decoration-dotted underline-offset-2 hover:text-accent transition-colors"
      >
        {fmt(v)}
      </button>
    ) : (
      <>{fmt(v)}</>
    );

  return (
    <div className="rounded-xl bg-card2 border border-hairline px-3.5 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">
            {q.name} <span className="text-muted font-normal">· {q.symbol}</span>
          </p>
          <p className="text-[10px] text-muted truncate">
            {q.exchange ?? "—"} · {c}
            {state && <span className={q.marketState === "REGULAR" ? " text-gain" : ""}> · {state}</span>}
          </p>
          <p className="mt-1 tabular-nums">
            <span className="text-lg font-bold">
              {cur$(c)}
              {fmt(q.price)}
            </span>
            <span className={`ml-2 text-xs font-semibold ${up ? "text-gain" : "text-loss"}`}>
              {q.change != null && `${q.change >= 0 ? "+" : ""}${fmt(q.change)}`}
              {q.changePercent != null && ` (${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%)`}
            </span>
            {onUsePrice && q.price != null && (
              <button
                type="button"
                onClick={() => onUsePrice(q.price!)}
                className="ml-2 rounded border border-accent/40 bg-accent/10 hover:bg-accent/20 px-1.5 py-px text-[10px] text-accent font-semibold transition-colors"
              >
                {t("trade.usePrice")}
              </button>
            )}
          </p>
        </div>
        <Sparkline data={q.spark} positive={up} width={88} height={30} />
      </div>

      <div className="mt-2.5 grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-2">
        <Cell label={t("trade.bidSize")}>
          {priceBtn(t("trade.useBid"), q.bid)}
          {q.bidSize != null && <span className="text-muted"> ×{fmtInt(q.bidSize)}</span>}
        </Cell>
        <Cell label={t("trade.askSize")}>
          {priceBtn(t("trade.useAsk"), q.ask)}
          {q.askSize != null && <span className="text-muted"> ×{fmtInt(q.askSize)}</span>}
        </Cell>
        <Cell label={t("trade.dayRange")}>
          {fmt(q.dayLow)}
          <RangeBar low={q.dayLow} high={q.dayHigh} value={q.price} />
          {fmt(q.dayHigh)}
        </Cell>
        <Cell label={t("trade.wk52Range")}>
          {fmt(q.wk52Low)}
          <RangeBar low={q.wk52Low} high={q.wk52High} value={q.price} />
          {fmt(q.wk52High)}
        </Cell>
        <Cell label={t("trade.volumeAvg")}>
          {fmtInt(q.volume)}
          <span className="text-muted"> / {fmtInt(q.avgVolume)}</span>
        </Cell>
        <Cell label={t("trade.mktCap")}>{fmtCap(q.marketCap, c)}</Cell>
        <Cell label={t("trade.peTtm")}>{q.trailingPE != null ? q.trailingPE.toFixed(1) : "—"}</Cell>
        <Cell label={t("trade.epsTtm")}>{fmt(q.epsTTM)}</Cell>
        <Cell label={t("trade.divYield")}>{q.dividendYieldPct != null ? `${q.dividendYieldPct.toFixed(2)}%` : "—"}</Cell>
        <Cell label={t("trade.prevClose")}>{fmt(q.previousClose)}</Cell>
        <Cell label={t("trade.open")}>{fmt(q.open)}</Cell>
      </div>
    </div>
  );
}
