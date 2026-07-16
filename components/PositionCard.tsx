"use client";

import Link from "next/link";
import { useState } from "react";
import { optionLabel } from "@/lib/portfolio-math";
import { useT } from "./PrefsProvider";
import { api } from "./util";
import type { TickerInvolvement } from "@/lib/types";

const fmtNative = (v: number, currency: string, digits = 2) =>
  `${currency === "USD" ? "$" : currency + " "}${v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

const signCls = (v: number | null | undefined) =>
  v == null ? "text-muted" : v >= 0 ? "text-gain" : "text-loss";

/** The investor's involvement in this ticker, shown on its desk. */
export function PositionCard({ position }: { position: TickerInvolvement }) {
  const { t } = useT();
  const s = position.stock;
  const cur = position.currency;
  // USD equivalent for non-USD names ("" when native is USD or FX unknown —
  // an honest blank beats a guessed conversion).
  const usd = (v: number, digits = 0): string =>
    cur !== "USD" && position.fxToUsd != null
      ? ` ≈ ${v * position.fxToUsd >= 0 ? "" : "−"}$${Math.abs(v * position.fxToUsd).toLocaleString(undefined, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        })}`
      : "";

  // DRIP toggle: optimistic local state; the desk's polling brings the stored
  // value back around — re-sync when the prop actually changes (the React
  // "adjust state during render" pattern, no effect needed).
  const [drip, setDrip] = useState(position.drip);
  const [prevPropDrip, setPrevPropDrip] = useState(position.drip);
  const [dripBusy, setDripBusy] = useState(false);
  if (position.drip !== prevPropDrip) {
    setPrevPropDrip(position.drip);
    setDrip(position.drip);
  }

  async function toggleDrip() {
    const next = !drip;
    setDrip(next);
    setDripBusy(true);
    try {
      await api(`/api/portfolio/drip`, {
        method: "POST",
        body: JSON.stringify({ symbol: position.symbol, enabled: next }),
      });
    } catch {
      setDrip(!next); // server said no — roll back
    } finally {
      setDripBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">{t("trade.yourPosition")}</p>
        {position.unrealized != null && (
          <span className={`text-[11px] font-semibold tabular-nums ${signCls(position.unrealized)}`}>
            {t("trade.unrealizedAmt", {
              v: `${position.unrealized >= 0 ? "+" : ""}${fmtNative(position.unrealized, cur, 0)}${usd(position.unrealized)}`,
            })}
          </span>
        )}
        {position.realized !== 0 && (
          <span className={`text-[11px] tabular-nums ${signCls(position.realized)}`}>
            · {t("trade.realizedAmt", {
              v: `${position.realized >= 0 ? "+" : ""}${fmtNative(position.realized, cur, 0)}${usd(position.realized)}`,
            })}
          </span>
        )}
        {position.dividends !== 0 && (
          <span
            className={`text-[11px] tabular-nums ${signCls(position.dividends)}`}
            title={t("trade.dividendsTitle")}
          >
            · {t("trade.dividendsAmt", {
              v: `${position.dividends >= 0 ? "+" : ""}${fmtNative(position.dividends, cur, 2)}${usd(position.dividends, 2)}`,
            })}
          </span>
        )}
        {s && s.qty > 0 && (
          <button
            onClick={toggleDrip}
            disabled={dripBusy}
            title={drip ? t("portfolio.dripOnTitle") : t("portfolio.dripOffTitle")}
            className={`rounded-full px-2 py-px text-[9px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 ${
              drip ? "bg-gain/15 text-gain" : "bg-ink/6 text-muted hover:bg-ink/10"
            }`}
          >
            {drip ? t("portfolio.dripOnChip") : t("portfolio.dripOffChip")}
          </button>
        )}
        <Link
          href="/portfolio"
          className="ml-auto text-[11px] text-accent hover:opacity-80 transition-opacity"
        >
          {t("trade.managePortfolio")}
        </Link>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
        {s && (
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {s.qty < 0 && <span className="text-loss text-[10px] font-bold mr-1">{t("trade.shortChip")}</span>}
              {t("trade.nShares", { n: Math.abs(s.qty).toLocaleString() })}{" "}
              <span className="text-muted font-normal">{t("trade.atAvg", { price: fmtNative(s.avgCost, cur) })}</span>
            </p>
            <p className="text-[11px] text-muted tabular-nums mt-0.5">
              {s.mark != null ? (
                <>
                  {t("trade.nowPrice", { price: fmtNative(s.mark, cur) })}
                  {s.unrealizedPct != null && (
                    <span className={`ml-1.5 font-semibold ${signCls(s.unrealizedPct)}`}>
                      {s.unrealizedPct >= 0 ? "+" : ""}
                      {s.unrealizedPct.toFixed(1)}%
                    </span>
                  )}
                  {s.marketValue != null && (
                    <span className="ml-1.5">
                      · {t("trade.valueOf", { amount: `${fmtNative(s.marketValue, cur, 0)}${usd(s.marketValue)}` })}
                    </span>
                  )}
                </>
              ) : (
                t("trade.noLiveQuote")
              )}
            </p>
          </div>
        )}
        {position.options.map((o) => (
          <div key={o.key}>
            <p className="text-sm font-semibold">
              {o.qty < 0 && <span className="text-warn text-[10px] font-bold mr-1">{t("trade.shortChip")}</span>}
              {Math.abs(o.qty)}× {optionLabel(o)}
              {o.expired && <span className="text-loss text-[10px] font-bold ml-1.5">{t("trade.expiredChip")}</span>}
            </p>
            <p className="text-[11px] text-muted tabular-nums mt-0.5">
              {t("trade.atPremium", { price: fmtNative(o.avgCost, cur) })}
              {o.unrealized != null && (
                <span className={`ml-1.5 font-semibold ${signCls(o.unrealized)}`}>
                  {o.unrealized >= 0 ? "+" : ""}
                  {fmtNative(o.unrealized, cur, 0)}
                </span>
              )}
              {o.markSource === "intrinsic" && !o.expired && (
                <span className="ml-1.5 text-muted/70">{t("trade.intrinsicTag")}</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
