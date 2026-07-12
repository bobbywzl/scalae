"use client";

import Link from "next/link";
import { optionLabel } from "@/lib/portfolio-math";
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
  const s = position.stock;
  const cur = position.currency;
  return (
    <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[11px] uppercase tracking-widest text-muted font-semibold">Your position</p>
        {position.unrealized != null && (
          <span className={`text-[11px] font-semibold tabular-nums ${signCls(position.unrealized)}`}>
            {position.unrealized >= 0 ? "+" : ""}
            {fmtNative(position.unrealized, cur, 0)} unrealized
          </span>
        )}
        {position.realized !== 0 && (
          <span className={`text-[11px] tabular-nums ${signCls(position.realized)}`}>
            · {position.realized >= 0 ? "+" : ""}
            {fmtNative(position.realized, cur, 0)} realized
          </span>
        )}
        <Link
          href="/portfolio"
          className="ml-auto text-[11px] text-accent hover:opacity-80 transition-opacity"
        >
          Manage in portfolio →
        </Link>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
        {s && (
          <div>
            <p className="text-sm font-semibold tabular-nums">
              {s.qty < 0 && <span className="text-loss text-[10px] font-bold mr-1">SHORT</span>}
              {Math.abs(s.qty).toLocaleString()} shares{" "}
              <span className="text-muted font-normal">@ {fmtNative(s.avgCost, cur)} avg</span>
            </p>
            <p className="text-[11px] text-muted tabular-nums mt-0.5">
              {s.mark != null ? (
                <>
                  now {fmtNative(s.mark, cur)}
                  {s.unrealizedPct != null && (
                    <span className={`ml-1.5 font-semibold ${signCls(s.unrealizedPct)}`}>
                      {s.unrealizedPct >= 0 ? "+" : ""}
                      {s.unrealizedPct.toFixed(1)}%
                    </span>
                  )}
                  {s.marketValue != null && <span className="ml-1.5">· value {fmtNative(s.marketValue, cur, 0)}</span>}
                </>
              ) : (
                "no live quote"
              )}
            </p>
          </div>
        )}
        {position.options.map((o) => (
          <div key={o.key}>
            <p className="text-sm font-semibold">
              {o.qty < 0 && <span className="text-warn text-[10px] font-bold mr-1">SHORT</span>}
              {Math.abs(o.qty)}× {optionLabel(o)}
              {o.expired && <span className="text-loss text-[10px] font-bold ml-1.5">EXPIRED</span>}
            </p>
            <p className="text-[11px] text-muted tabular-nums mt-0.5">
              @ {fmtNative(o.avgCost, cur)} premium
              {o.unrealized != null && (
                <span className={`ml-1.5 font-semibold ${signCls(o.unrealized)}`}>
                  {o.unrealized >= 0 ? "+" : ""}
                  {fmtNative(o.unrealized, cur, 0)}
                </span>
              )}
              {o.markSource === "intrinsic" && !o.expired && <span className="ml-1.5 text-muted/70">intrinsic</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
