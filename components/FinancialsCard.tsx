"use client";

import { useEffect, useState } from "react";
import { useT } from "./PrefsProvider";
import { api, timeAgo } from "./util";
import type { TKey } from "@/lib/i18n/dictionaries";
import type {
  FinancialMetric,
  MetricFormat,
  MetricGroup,
  PeerMetric,
  TickerFinancials,
} from "@/lib/types";

const cur$ = (c: string) => (c === "USD" || !c ? "$" : c + " ");
const neg = (s: string) => s.replace("-", "−");

/** Signed, scaled money (T/B/M/k) with the ticker's reporting currency. */
function fmtMoney(v: number | null, c: string): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  const scaled =
    a >= 1e12 ? (a / 1e12).toFixed(2) + "T"
    : a >= 1e9 ? (a / 1e9).toFixed(1) + "B"
    : a >= 1e6 ? (a / 1e6).toFixed(0) + "M"
    : a >= 1e3 ? (a / 1e3).toFixed(0) + "k"
    : a.toFixed(0);
  return `${v < 0 ? "−" : ""}${cur$(c)}${scaled}`;
}

const fmtInt = (v: number | null): string =>
  v == null ? "—" : v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v.toLocaleString();

function fmtMetric(v: number | null, format: MetricFormat, c: string): string {
  if (v == null) return "—";
  switch (format) {
    case "money": return fmtMoney(v, c);
    case "pct": return neg((v * 100).toFixed(1)) + "%";
    case "ratio": return neg(v.toFixed(2));
    case "x": return neg(v.toFixed(1)) + "×";
    case "perShare": return (v < 0 ? "−" : "") + cur$(c) + Math.abs(v).toFixed(2);
    case "shares": return fmtInt(v);
  }
}

const label = (t: ReturnType<typeof useT>["t"], key: string) => t(`financials.${key}` as TKey);

/** Colour the latest cell by whether the metric improved YoY (per its polarity). */
function trendClass(m: FinancialMetric): string {
  if (m.polarity === 0) return "text-emph";
  const vals = m.values.filter((v): v is number => v != null);
  if (vals.length < 2) return "text-emph";
  const delta = (vals[vals.length - 1] - vals[vals.length - 2]) * m.polarity;
  return delta > 0 ? "text-gain" : delta < 0 ? "text-loss" : "text-emph";
}

const GROUPS: MetricGroup[] = ["income", "returns", "balance", "cashflow", "perShare"];

export function FinancialsSection({ symbol }: { symbol: string }) {
  const { t } = useT();
  const [data, setData] = useState<TickerFinancials | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showTable, setShowTable] = useState(false);

  // Fetch once per symbol. setState lives in the promise callbacks (with an
  // unmount guard), not synchronously in the effect body.
  useEffect(() => {
    let alive = true;
    api<{ financials: TickerFinancials }>(`/api/tickers/${encodeURIComponent(symbol)}/financials`)
      .then((res) => {
        if (!alive) return;
        setData(res.financials);
        setState("ready");
      })
      .catch(() => {
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, [symbol]);

  // Silently absent for tickers Yahoo has no fundamentals for — no empty shell.
  if (state === "error") return null;

  const c = data?.currency ?? "USD";
  const years = data?.fiscalYears ?? [];

  return (
    <section className="rounded-2xl bg-card border border-hairline p-5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="text-[11px] uppercase tracking-widest text-muted font-semibold">
          {t("financials.title")}
        </h2>
        {data && (
          <>
            <span className="text-[11px] text-muted/80">
              {t("financials.subtitle", { n: years.length })}
            </span>
            <span className="ml-auto text-[10px] text-muted/70">
              {t("financials.sourceNote", { n: years.length })} ·{" "}
              {t("financials.asOf", { when: timeAgo(data.fetchedAt, t) })}
            </span>
          </>
        )}
      </div>

      {state === "loading" && (
        <p className="text-muted text-xs italic mt-3">{t("financials.loading")}</p>
      )}

      {data && (
        <>
          <Snapshot data={data} c={c} t={t} />

          {data.peers.length > 0 && <Peers peers={data.peers} data={data} t={t} />}

          {years.length > 0 && (
            <>
              <button
                onClick={() => setShowTable((v) => !v)}
                className="mt-4 rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2.5 py-1 text-[10px] text-muted hover:text-emph transition-colors"
              >
                {showTable ? t("financials.hideTable") : t("financials.showTable")}
              </button>
              {showTable && <MetricsTable data={data} c={c} t={t} />}
            </>
          )}
        </>
      )}
    </section>
  );
}

// --- the "what it costs to own it now" valuation snapshot ---
function Snapshot({
  data,
  c,
  t,
}: {
  data: TickerFinancials;
  c: string;
  t: ReturnType<typeof useT>["t"];
}) {
  const s = data.snapshot;
  const cells: { key: string; value: string; tip?: string }[] = [
    { key: "enterpriseValue", value: fmtMoney(s.enterpriseValue, c), tip: t("financials.desc_enterpriseValue") },
    { key: "marketCap", value: fmtMoney(s.marketCap, c) },
    { key: "netDebt", value: fmtMoney(s.netDebt, c) },
    { key: "roic", value: fmtMetric(s.roic, "pct", c), tip: t("financials.desc_roic") },
    { key: "roe", value: fmtMetric(s.roe, "pct", c) },
    { key: "netMargin", value: fmtMetric(s.netMargin, "pct", c) },
    { key: "operatingMargin", value: fmtMetric(s.operatingMargin, "pct", c) },
    { key: "grossMargin", value: fmtMetric(s.grossMargin, "pct", c) },
    { key: "fcfYield", value: fmtMetric(s.fcfYield, "pct", c), tip: t("financials.desc_fcfYield") },
    { key: "trailingPE", value: fmtMetric(s.trailingPE, "x", c) },
    { key: "forwardPE", value: fmtMetric(s.forwardPE, "x", c) },
    { key: "priceToBook", value: fmtMetric(s.priceToBook, "x", c) },
    { key: "evToEbit", value: fmtMetric(s.evToEbit, "x", c) },
    { key: "evToEbitda", value: fmtMetric(s.evToEbitda, "x", c) },
    { key: "debtToEquity", value: fmtMetric(s.debtToEquity, "ratio", c) },
    { key: "currentRatio", value: fmtMetric(s.currentRatio, "ratio", c) },
  ];
  return (
    <div className="mt-3">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5">
        {t("financials.snapshotTitle")}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-4 gap-y-2.5">
        {cells.map((cell) => (
          <div key={cell.key} className="min-w-0" title={cell.tip}>
            <p className="text-[9px] uppercase tracking-wider text-muted flex items-center gap-1">
              {label(t, cell.key)}
              {cell.tip && <span className="text-muted/50">ⓘ</span>}
            </p>
            <p className="text-[12px] tabular-nums text-emph mt-px truncate">{cell.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- returns & margins vs. peers ---
function Peers({
  peers,
  data,
  t,
}: {
  peers: PeerMetric[];
  data: TickerFinancials;
  t: ReturnType<typeof useT>["t"];
}) {
  const s = data.snapshot;
  const cols: { key: string; get: (p: PeerMetric) => number | null; self: number | null }[] = [
    { key: "roe", get: (p) => p.roe, self: s.roe },
    { key: "roic", get: (p) => p.roic, self: s.roic },
    { key: "operatingMargin", get: (p) => p.operatingMargin, self: s.operatingMargin },
    { key: "netMargin", get: (p) => p.netMargin, self: s.netMargin },
    { key: "debtToEquity", get: (p) => p.debtToEquity, self: s.debtToEquity },
  ];
  const pct = (v: number | null) => (v == null ? "—" : neg((v * 100).toFixed(1)) + "%");
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-wider text-muted">
        {t("financials.peersTitle")}
        <span className="text-muted/60 normal-case tracking-normal ml-1.5">
          · {t("financials.peersNote")}
        </span>
      </p>
      <div className="overflow-x-auto mt-1.5">
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-muted text-left">
              <th className="font-medium py-1 pr-3">{t("financials.colTicker")}</th>
              {cols.map((col) => (
                <th key={col.key} className="font-medium py-1 px-2 text-right whitespace-nowrap">
                  {label(t, col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-hairline">
              <td className="py-1 pr-3 font-semibold text-foreground whitespace-nowrap">
                {data.symbol}{" "}
                <span className="text-[9px] text-accent uppercase">{t("financials.thisCompany")}</span>
              </td>
              {cols.map((col) => (
                <td key={col.key} className="py-1 px-2 text-right text-emph">
                  {col.key === "debtToEquity" ? (col.self == null ? "—" : neg(col.self.toFixed(2))) : pct(col.self)}
                </td>
              ))}
            </tr>
            {peers.map((p) => (
              <tr key={p.symbol} className="border-t border-hairline/60">
                <td className="py-1 pr-3 text-emph whitespace-nowrap" title={p.name ?? undefined}>
                  {p.symbol}
                </td>
                {cols.map((col) => (
                  <td key={col.key} className="py-1 px-2 text-right text-muted">
                    {col.key === "debtToEquity"
                      ? (col.get(p) == null ? "—" : neg(col.get(p)!.toFixed(2)))
                      : pct(col.get(p))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- the full 10-FY metrics × years table ---
function MetricsTable({
  data,
  c,
  t,
}: {
  data: TickerFinancials;
  c: string;
  t: ReturnType<typeof useT>["t"];
}) {
  const years = data.fiscalYears;
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-[11px] tabular-nums border-collapse">
        <thead>
          <tr className="text-muted">
            <th className="sticky left-0 bg-card text-left font-medium py-1 pr-3 z-10">FY</th>
            {years.map((y) => (
              <th key={y} className="font-medium py-1 px-2 text-right whitespace-nowrap">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => {
            const rows = data.metrics.filter((m) => m.group === group);
            if (rows.length === 0) return null;
            return (
              <FragmentGroup key={group} groupLabel={t(`financials.grp_${group}` as TKey)} span={years.length + 1}>
                {rows.map((m) => {
                  const trend = trendClass(m);
                  return (
                    <tr key={m.key} className="border-t border-hairline/50">
                      <td className="sticky left-0 bg-card py-1 pr-3 text-muted whitespace-nowrap z-10">
                        {label(t, m.key)}
                      </td>
                      {m.values.map((v, i) => (
                        <td
                          key={i}
                          className={`py-1 px-2 text-right whitespace-nowrap ${
                            i === m.values.length - 1 ? trend : "text-emph"
                          }`}
                        >
                          {fmtMetric(v, m.format, c)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </FragmentGroup>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentGroup({
  groupLabel,
  span,
  children,
}: {
  groupLabel: string;
  span: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={span}
          className="pt-3 pb-1 text-[9px] uppercase tracking-widest text-muted/70 font-semibold"
        >
          {groupLabel}
        </td>
      </tr>
      {children}
    </>
  );
}
