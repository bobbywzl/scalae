"use client";

import { useMemo, useState } from "react";
import { useT } from "./PrefsProvider";
import { api, timeAgo } from "./util";
import type { TKey } from "@/lib/i18n/dictionaries";
import type {
  CleansedCell,
  CleansedFinancials,
  DcfInputs,
  FinAdjustment,
  FinancialMetric,
  MetricFormat,
  MetricGroup,
  PeerComparison,
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

export function fmtMetric(v: number | null, format: MetricFormat, c: string): string {
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

const GROUPS: MetricGroup[] = ["income", "returns", "balance", "cashflow", "dcf", "perShare"];

/** Tab-separated export with RAW numeric values (Excel/CapIQ-ready), so the
 *  investor can build their own DCF — not the display-formatted strings.
 *  Exports whichever view (reported or cleansed) is active. */
function buildTSV(
  symbol: string,
  fiscalYears: string[],
  metrics: FinancialMetric[],
  d: DcfInputs,
  t: ReturnType<typeof useT>["t"]
): string {
  const cell = (v: number | null) => (v == null ? "" : String(v));
  const lines: string[] = [];
  lines.push([symbol, ...fiscalYears].join("\t"));
  for (const g of GROUPS) {
    const rows = metrics.filter((m) => m.group === g);
    if (!rows.length) continue;
    lines.push(t(`financials.grp_${g}` as TKey));
    for (const m of rows) lines.push([label(t, m.key), ...m.values.map(cell)].join("\t"));
  }
  lines.push("", t("financials.dcfTitle"));
  const kv: [string, number | null][] = [
    ["beta", d.beta],
    ["effectiveTaxRate", d.effectiveTaxRate],
    ["costOfDebt", d.costOfDebt],
    ["equityWeight", d.equityWeight],
    ["debtWeight", d.debtWeight],
    ["netDebt", d.netDebt],
    ["sharesOutstanding", d.sharesOutstanding],
    ["enterpriseValue", d.enterpriseValue],
    ["medianRevenueGrowth", d.medianRevenueGrowth],
    ["medianOperatingMargin", d.medianOperatingMargin],
    ["medianRoic", d.medianRoic],
    ["medianReinvestmentRate", d.medianReinvestmentRate],
    ["medianFcffMargin", d.medianFcffMargin],
  ];
  for (const [k, v] of kv) lines.push([label(t, k), v == null ? "" : String(v)].join("\t"));
  return lines.join("\n");
}

/**
 * The financials section — the finance-cleansing screen's centrepiece. Fed by
 * the page (no self-fetch): the raw reported payload, plus the cleansed
 * overlay when applied adjustments exist. The view toggle switches the 10-FY
 * table and DCF inputs between "as reported" and "cleansed"; moved cells are
 * highlighted with their raw value and contributing adjustments on hover.
 * The valuation snapshot and peer panel always show reported figures.
 */
export function FinancialsSection({
  symbol,
  data,
  cleansed,
  adjustments,
}: {
  symbol: string;
  data: TickerFinancials;
  cleansed: CleansedFinancials | null;
  adjustments: FinAdjustment[];
}) {
  const { t } = useT();
  const [showTable, setShowTable] = useState(true);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"cleansed" | "reported">(cleansed ? "cleansed" : "reported");

  const c = data.currency ?? "USD";
  const years = data.fiscalYears;
  const cleansedActive = view === "cleansed" && cleansed != null;
  const metrics = cleansedActive ? cleansed.metrics : data.metrics;
  const dcfInputs = cleansedActive ? cleansed.dcfInputs : data.dcfInputs;

  // "metricKey:year" → moved cell, for highlighting + hover provenance.
  const movedCells = useMemo(() => {
    const m = new Map<string, CleansedCell>();
    if (cleansed) for (const cell of cleansed.cells) m.set(`${cell.metricKey}:${cell.year}`, cell);
    return m;
  }, [cleansed]);
  const titleById = useMemo(
    () => new Map(adjustments.map((a) => [a.id, a.title])),
    [adjustments]
  );
  const tipFor = (m: FinancialMetric, yearIdx: number): string | undefined => {
    if (!cleansedActive) return undefined;
    const cell = movedCells.get(`${m.key}:${years[yearIdx]}`);
    if (!cell) return undefined;
    return t("financials.cellReportedTip", {
      raw: fmtMetric(cell.raw, m.format, c),
      titles: cell.adjustmentIds.map((id) => titleById.get(id) ?? "…").join(", ") || "—",
    });
  };

  const appliedCount = adjustments.filter((a) => a.status === "applied").length;

  return (
    <section className="rounded-2xl bg-card border border-hairline p-5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="text-[0.6875rem] uppercase tracking-widest text-muted font-semibold">
          {t("financials.title")}
        </h2>
        {/* The statement currency, always visible — deltas and the table live in it. */}
        <span
          className={`rounded-full px-2 py-0.5 text-[0.625rem] font-semibold ${
            data.currencyMismatch
              ? "bg-warn/15 text-warn"
              : "bg-ink/6 text-muted"
          }`}
        >
          {data.currencyMismatch && data.tradingCurrency
            ? t("financials.currencyChipMismatch", {
                fin: c,
                trade: data.tradingCurrency,
              })
            : t("financials.currencyChip", { c })}
        </span>
        <span className="text-[0.6875rem] text-muted/80">
          {t("financials.subtitle", { n: years.length })}
        </span>
        <span className="ml-auto text-[0.625rem] text-muted/70">
          {t("financials.sourceNote", { source: data.source, n: years.length })} ·{" "}
          {t("financials.asOf", { when: timeAgo(data.fetchedAt, t) })}
        </span>
      </div>

      {/* Raw ↔ cleansed switch (only once applied adjustments exist). */}
      {cleansed && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 rounded-full border border-hairline bg-ink/4 p-0.5">
            {(
              [
                { v: "cleansed", label: t("financials.viewCleansed") },
                { v: "reported", label: t("financials.viewReported") },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => setView(o.v)}
                className={`rounded-full px-2.5 py-0.5 text-[0.6875rem] transition-colors ${
                  view === o.v ? "bg-accent/15 text-accent font-semibold" : "text-muted hover:text-emph"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="text-[0.625rem] text-muted/70">
            {t("financials.viewCleansedNote", { n: appliedCount, m: cleansed.cells.length })}
          </span>
        </div>
      )}

      <Snapshot data={data} c={c} t={t} />

      <DcfInputsBlock d={dcfInputs} n={years.length} c={c} t={t} />

      <PeerPanel data={data} symbol={symbol} t={t} />

      {years.length > 0 && (
        <>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowTable((v) => !v)}
              className="rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2.5 py-1 text-[0.625rem] text-muted hover:text-emph transition-colors"
            >
              {showTable ? t("financials.hideTable") : t("financials.showTable")}
            </button>
            <button
              onClick={() => {
                navigator.clipboard
                  ?.writeText(buildTSV(data.symbol, years, metrics, dcfInputs, t))
                  .then(
                    () => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    },
                    () => {}
                  );
              }}
              className="rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2.5 py-1 text-[0.625rem] text-muted hover:text-emph transition-colors"
            >
              {copied ? t("financials.copied") : t("financials.copyTable")}
            </button>
            <span className="text-[0.625rem] text-muted/60">{t("financials.accuracyNote")}</span>
          </div>
          {showTable && (
            <MetricsTable years={years} metrics={metrics} c={c} t={t} tipFor={tipFor} />
          )}
        </>
      )}
    </section>
  );
}

// --- the "what it costs to own it now" valuation snapshot (always reported) ---
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
  // Market-side figures (EV, market cap) are quoted in the TRADING currency;
  // statement-side figures (net debt) in the statement currency — never blur
  // the two on an ADR (PDD trades USD, reports CNY).
  const tc = data.tradingCurrency ?? c;
  const cells: { key: string; value: string; tip?: string }[] = [
    { key: "enterpriseValue", value: fmtMoney(s.enterpriseValue, tc), tip: t("financials.desc_enterpriseValue") },
    { key: "marketCap", value: fmtMoney(s.marketCap, tc) },
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
      <p className="text-[0.625rem] uppercase tracking-wider text-muted mb-1.5">
        {t("financials.snapshotTitle")}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-x-4 gap-y-2.5">
        {cells.map((cell) => (
          <div key={cell.key} className="min-w-0" title={cell.tip}>
            <p className="text-[0.5625rem] uppercase tracking-wider text-muted flex items-center gap-1">
              {label(t, cell.key)}
              {cell.tip && <span className="text-muted/50">ⓘ</span>}
            </p>
            <p className="text-[0.75rem] tabular-nums text-emph mt-px truncate">{cell.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- normalized inputs for the investor's own DCF (follows the active view) ---
function DcfInputsBlock({
  d,
  n,
  c,
  t,
}: {
  d: DcfInputs;
  n: number;
  c: string;
  t: ReturnType<typeof useT>["t"];
}) {
  const cells: { key: string; value: string }[] = [
    { key: "medianRevenueGrowth", value: fmtMetric(d.medianRevenueGrowth, "pct", c) },
    { key: "medianOperatingMargin", value: fmtMetric(d.medianOperatingMargin, "pct", c) },
    { key: "medianRoic", value: fmtMetric(d.medianRoic, "pct", c) },
    { key: "medianReinvestmentRate", value: fmtMetric(d.medianReinvestmentRate, "pct", c) },
    { key: "medianFcffMargin", value: fmtMetric(d.medianFcffMargin, "pct", c) },
    { key: "beta", value: d.beta == null ? "—" : neg(d.beta.toFixed(2)) },
    { key: "costOfDebt", value: fmtMetric(d.costOfDebt, "pct", c) },
    { key: "effectiveTaxRate", value: fmtMetric(d.effectiveTaxRate, "pct", c) },
    { key: "equityWeight", value: fmtMetric(d.equityWeight, "pct", c) },
    { key: "debtWeight", value: fmtMetric(d.debtWeight, "pct", c) },
    { key: "netDebt", value: fmtMoney(d.netDebt, c) },
    { key: "sharesOutstanding", value: fmtInt(d.sharesOutstanding) },
  ];
  return (
    <div className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.04] p-3">
      <p className="text-[0.625rem] uppercase tracking-wider text-muted">
        {t("financials.dcfTitle")}
        <span className="text-muted/60 normal-case tracking-normal ml-1.5">
          · {t("financials.dcfNote", { n })}
        </span>
      </p>
      <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-x-4 gap-y-2.5">
        {cells.map((cell) => (
          <div key={cell.key} className="min-w-0">
            <p className="text-[0.5625rem] uppercase tracking-wider text-muted truncate">{label(t, cell.key)}</p>
            <p className="text-[0.75rem] tabular-nums text-emph mt-px truncate">{cell.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- returns & margins vs. INDUSTRY peers (loaded only on request; reported figures) ---
function PeerPanel({
  data,
  symbol,
  t,
}: {
  data: TickerFinancials;
  symbol: string;
  t: ReturnType<typeof useT>["t"];
}) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [comp, setComp] = useState<PeerComparison | null>(null);
  const [input, setInput] = useState("");

  const run = (tickers?: string) => {
    setState("loading");
    const qs = tickers && tickers.trim() ? `?tickers=${encodeURIComponent(tickers.trim())}` : "";
    api<{ comparison: PeerComparison }>(
      `/api/tickers/${encodeURIComponent(symbol)}/financials/peers${qs}`
    )
      .then((res) => {
        setComp(res.comparison);
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  if (state === "idle") {
    return (
      <button
        onClick={() => run()}
        className="mt-4 rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2.5 py-1 text-[0.625rem] text-muted hover:text-emph transition-colors"
      >
        {t("financials.comparePeers")}
      </button>
    );
  }

  const s = data.snapshot;
  const cols: { key: string; get: (p: PeerMetric) => number | null; self: number | null }[] = [
    { key: "roe", get: (p) => p.roe, self: s.roe },
    { key: "roic", get: (p) => p.roic, self: s.roic },
    { key: "operatingMargin", get: (p) => p.operatingMargin, self: s.operatingMargin },
    { key: "netMargin", get: (p) => p.netMargin, self: s.netMargin },
    { key: "debtToEquity", get: (p) => p.debtToEquity, self: s.debtToEquity },
  ];
  const pct = (v: number | null) => (v == null ? "—" : neg((v * 100).toFixed(1)) + "%");
  const cell = (key: string, v: number | null) =>
    key === "debtToEquity" ? (v == null ? "—" : neg(v.toFixed(2))) : pct(v);

  return (
    <div className="mt-4">
      <p className="text-[0.625rem] uppercase tracking-wider text-muted">
        {t("financials.peersTitle")}
        <span className="text-muted/60 normal-case tracking-normal ml-1.5">
          ·{" "}
          {comp?.custom
            ? t("financials.peersCustomNote")
            : comp?.industry
              ? comp.industry
              : t("financials.peersNote")}
        </span>
      </p>

      {state === "loading" && <p className="text-muted text-xs italic mt-1.5">{t("financials.peersLoading")}</p>}
      {state === "error" && <p className="text-muted text-xs italic mt-1.5">{t("financials.peersError")}</p>}

      {state === "ready" && comp && (
        <>
          {comp.peers.length === 0 ? (
            <p className="text-muted text-xs mt-1.5">{t("financials.peersNoneAuto")}</p>
          ) : (
            <div className="overflow-x-auto mt-1.5">
              <table className="w-full text-[0.6875rem] tabular-nums">
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
                      <span className="text-[0.5625rem] text-accent uppercase">{t("financials.thisCompany")}</span>
                    </td>
                    {cols.map((col) => (
                      <td key={col.key} className="py-1 px-2 text-right text-emph">
                        {cell(col.key, col.self)}
                      </td>
                    ))}
                  </tr>
                  {comp.peers.map((p) => (
                    <tr key={p.symbol} className="border-t border-hairline/60">
                      <td className="py-1 pr-3 text-emph whitespace-nowrap" title={p.name ?? undefined}>
                        {p.symbol}
                      </td>
                      {cols.map((col) => (
                        <td key={col.key} className="py-1 px-2 text-right text-muted">
                          {cell(col.key, col.get(p))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add your own comparables (any industry — your call). */}
          <form
            className="mt-2.5 flex items-center gap-2 flex-wrap"
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) run(input);
            }}
          >
            <span className="text-[0.625rem] text-muted">{t("financials.addPeersLabel")}</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("financials.addPeersPlaceholder")}
              className="rounded-md border border-hairline bg-ink/4 px-2 py-1 text-[0.6875rem] w-48 focus:outline-none focus:border-accent/50"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 disabled:opacity-40 px-2.5 py-1 text-[0.625rem] text-muted hover:text-emph transition-colors"
            >
              {t("financials.addPeersGo")}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

// --- the full 10-FY metrics × years table (view-aware, moved cells highlighted) ---
function MetricsTable({
  years,
  metrics,
  c,
  t,
  tipFor,
}: {
  years: string[];
  metrics: FinancialMetric[];
  c: string;
  t: ReturnType<typeof useT>["t"];
  /** Hover text for a moved cell in the cleansed view (undefined = untouched). */
  tipFor: (m: FinancialMetric, yearIdx: number) => string | undefined;
}) {
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-[0.6875rem] tabular-nums border-collapse">
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
            const rows = metrics.filter((m) => m.group === group);
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
                      {m.values.map((v, i) => {
                        const tip = tipFor(m, i);
                        return (
                          <td
                            key={i}
                            title={tip}
                            className={`py-1 px-2 text-right whitespace-nowrap ${
                              tip
                                ? "text-accent font-semibold underline decoration-dotted decoration-accent/50 underline-offset-2 cursor-help"
                                : i === m.values.length - 1
                                  ? trend
                                  : "text-emph"
                            }`}
                          >
                            {fmtMetric(v, m.format, c)}
                          </td>
                        );
                      })}
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
          className="pt-3 pb-1 text-[0.5625rem] uppercase tracking-widest text-muted/70 font-semibold"
        >
          {groupLabel}
        </td>
      </tr>
      {children}
    </>
  );
}
