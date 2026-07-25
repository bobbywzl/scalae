import type {
  CleansedCell,
  CleansedFinancials,
  FinAdjustment,
  TickerFinancials,
} from "./types";

/**
 * The finance-cleansing engine: a DETERMINISTIC overlay of the investor's
 * applied adjustments on the raw reported financials. The raw provider data
 * is never modified — cleansing recomputes a parallel metric table, and every
 * differing cell is reported as a raw → cleansed diff so the history stays
 * fully auditable (FOUNDATION: evidence discipline; never fabricate).
 *
 * Care rules, in order of authority:
 * 1. Only whitelisted BASE line items accept direct deltas (the reported
 *    figures an adjustment can trace to a disclosure). Derived rows are never
 *    directly adjusted.
 * 2. A derived row recomputes ONLY when one of its inputs actually changed —
 *    an untouched number never moves, so formula differences between this
 *    engine and the data provider can never leak into the cleansed view.
 * 3. Rows built by lib/financials.ts from other table rows (margins, growth,
 *    ROE, owner earnings, …) recompute EXACTLY with the same formula. Rows
 *    whose raw values may come straight from the provider (net debt, FCF,
 *    EPS) move by DELTA-PROPAGATION (raw + Δ of inputs), so a provider/formula
 *    mismatch can't masquerade as part of the cleansing.
 * 4. Rows whose true inputs aren't in the table at all (ROIC, ROA, NOPAT,
 *    FCFF, tax rate, gross margin, current ratio, interest coverage, DPS)
 *    stay raw — the UI says so rather than serving approximations.
 */

/** Base line items that accept direct deltas (traceable reported figures). */
export const ADJUSTABLE_METRIC_KEYS = [
  "revenue",
  "operatingIncome",
  "netIncome",
  "ocf",
  "fcf",
  "da",
  "capex",
  "changeNWC",
  "equity",
  "totalDebt",
  "cash",
  "buybacks",
  "dividendsPaid",
  "shares",
] as const;

const ADJUSTABLE = new Set<string>(ADJUSTABLE_METRIC_KEYS);

// Derived rows the engine recomputes when their inputs change: netDebt,
// operatingMargin, netMargin, revenueGrowth, roe, debtToEquity, fcf,
// ownerEarnings, reinvestment, reinvestmentRate, eps, bookValuePerShare —
// see the per-cell passes in applyCleansing.

/** Rows that never move under cleansing (inputs not in the table) — for the UI's honesty note. */
export const RAW_ONLY_KEYS = [
  "grossMargin", "roic", "roa", "taxRate", "nopat", "fcff",
  "currentRatio", "interestCoverage", "dps",
] as const;

const div = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b !== 0 ? a / b : null;

/** Relative-epsilon equality so float recomputes don't register phantom diffs. */
function near(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9;
}

/** Median of the non-null values (mirrors lib/financials.ts). */
function median(vals: (number | null)[]): number | null {
  const xs = vals.filter((v): v is number => v != null).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * Overlay the APPLIED adjustments on the raw financials. Pass only applied
 * rows; the caller filters. Deterministic and side-effect free.
 */
export function applyCleansing(
  fin: TickerFinancials,
  applied: FinAdjustment[]
): CleansedFinancials {
  const years = fin.fiscalYears;
  const raw = new Map<string, (number | null)[]>(fin.metrics.map((m) => [m.key, m.values]));
  const vals = new Map<string, (number | null)[]>(fin.metrics.map((m) => [m.key, [...m.values]]));

  // Per-cell adjustment provenance ("metricKey:yearIndex" → adjustment ids).
  const contrib = new Map<string, Set<string>>();
  const direct = new Set<string>();

  const rawAt = (k: string, i: number): number | null => raw.get(k)?.[i] ?? null;
  const at = (k: string, i: number): number | null => vals.get(k)?.[i] ?? null;
  const deltaOf = (k: string, i: number): number => {
    const a = at(k, i);
    const r = rawAt(k, i);
    return (a ?? 0) - (r ?? 0);
  };
  const cellKey = (k: string, i: number) => `${k}:${i}`;
  const addContrib = (k: string, i: number, ids: Iterable<string>) => {
    const key = cellKey(k, i);
    const set = contrib.get(key) ?? new Set<string>();
    for (const id of ids) set.add(id);
    contrib.set(key, set);
  };
  const idsAt = (k: string, i: number): string[] => [...(contrib.get(cellKey(k, i)) ?? [])];

  // --- 1. direct deltas on the whitelisted base rows ---
  for (const a of applied) {
    if (!ADJUSTABLE.has(a.metricKey) || !Number.isFinite(a.delta) || a.delta === 0) continue;
    const i = years.indexOf(a.fiscalYear);
    if (i < 0) continue;
    const row = vals.get(a.metricKey);
    if (!row) continue;
    row[i] = (row[i] ?? 0) + a.delta;
    direct.add(cellKey(a.metricKey, i));
    addContrib(a.metricKey, i, [a.id]);
  }

  // A cell "moved" when its current value differs from raw (direct or derived).
  const moved = (k: string, i: number): boolean => !near(at(k, i), rawAt(k, i));

  // Set a recomputed value; provenance is the union of its inputs' contributors.
  const setDerived = (k: string, i: number, v: number | null, inputs: [string, number][]) => {
    const row = vals.get(k);
    if (!row) return;
    row[i] = v;
    if (!near(v, rawAt(k, i))) {
      addContrib(k, i, inputs.flatMap(([ik, ii]) => idsAt(ik, ii)));
    } else {
      contrib.delete(cellKey(k, i)); // recompute landed back on raw — no diff
    }
  };

  // --- 2. derived rows, in dependency order ---
  for (let i = 0; i < years.length; i++) {
    // Net debt: provider-sourced raw → delta-propagation (Δdebt − Δcash).
    if (moved("totalDebt", i) || moved("cash", i)) {
      const base = rawAt("netDebt", i);
      if (base != null) {
        setDerived("netDebt", i, base + deltaOf("totalDebt", i) - deltaOf("cash", i), [
          ["totalDebt", i],
          ["cash", i],
        ]);
      }
    }
    // Margins: exact recompute (same formula as lib/financials.ts buildMetrics).
    if (moved("operatingIncome", i) || moved("revenue", i)) {
      setDerived("operatingMargin", i, div(at("operatingIncome", i), at("revenue", i)), [
        ["operatingIncome", i],
        ["revenue", i],
      ]);
    }
    if (moved("netIncome", i) || moved("revenue", i)) {
      setDerived("netMargin", i, div(at("netIncome", i), at("revenue", i)), [
        ["netIncome", i],
        ["revenue", i],
      ]);
    }
    if (moved("netIncome", i) || moved("equity", i)) {
      setDerived("roe", i, div(at("netIncome", i), at("equity", i)), [
        ["netIncome", i],
        ["equity", i],
      ]);
    }
    if (moved("totalDebt", i) || moved("equity", i)) {
      setDerived("debtToEquity", i, div(at("totalDebt", i), at("equity", i)), [
        ["totalDebt", i],
        ["equity", i],
      ]);
    }
    // FCF: provider-sourced raw → delta-propagation from OCF/capex. A direct
    // fcf adjustment wins outright (already applied above; no recompute).
    if (!direct.has(cellKey("fcf", i)) && (moved("ocf", i) || moved("capex", i))) {
      const base = rawAt("fcf", i);
      if (base != null) {
        setDerived("fcf", i, base + deltaOf("ocf", i) + deltaOf("capex", i), [
          ["ocf", i],
          ["capex", i],
        ]);
      }
    }
    // Owner earnings = net income + D&A + capex (capex stored negative).
    if (moved("netIncome", i) || moved("da", i) || moved("capex", i)) {
      const n = at("netIncome", i), d = at("da", i), c = at("capex", i);
      setDerived("ownerEarnings", i, n != null && d != null && c != null ? n + d + c : rawAt("ownerEarnings", i), [
        ["netIncome", i],
        ["da", i],
        ["capex", i],
      ]);
    }
    // Reinvestment = −capex − D&A − ΔNWC (mirrors lib/financials.ts exactly).
    if (moved("capex", i) || moved("da", i) || moved("changeNWC", i)) {
      const c = at("capex", i), nwc = at("changeNWC", i);
      const v = c == null && nwc == null ? null : -(c ?? 0) - (at("da", i) ?? 0) - (nwc ?? 0);
      setDerived("reinvestment", i, v, [
        ["capex", i],
        ["da", i],
        ["changeNWC", i],
      ]);
    }
    if (moved("reinvestment", i)) {
      setDerived("reinvestmentRate", i, div(at("reinvestment", i), at("nopat", i)), [
        ["reinvestment", i],
      ]);
    }
    // EPS: provider-sourced raw → delta-propagation of net income ÷ shares.
    if (moved("netIncome", i) || moved("shares", i)) {
      const base = rawAt("eps", i);
      const adjRatio = div(at("netIncome", i), at("shares", i));
      const rawRatio = div(rawAt("netIncome", i), rawAt("shares", i));
      if (base != null && adjRatio != null && rawRatio != null) {
        setDerived("eps", i, base + (adjRatio - rawRatio), [
          ["netIncome", i],
          ["shares", i],
        ]);
      }
    }
    if (moved("equity", i) || moved("shares", i)) {
      setDerived("bookValuePerShare", i, div(at("equity", i), at("shares", i)), [
        ["equity", i],
        ["shares", i],
      ]);
    }
  }
  // Revenue growth needs the prior year too — separate pass over pairs.
  for (let i = 1; i < years.length; i++) {
    if (moved("revenue", i) || moved("revenue", i - 1)) {
      const prev = at("revenue", i - 1);
      const v = prev != null && prev !== 0 && at("revenue", i) != null
        ? (at("revenue", i)! - prev) / prev
        : null;
      setDerived("revenueGrowth", i, v, [
        ["revenue", i],
        ["revenue", i - 1],
      ]);
    }
  }

  // --- 3. DCF inputs: recompute the normalized medians whose rows moved ---
  const rowMoved = (k: string) => years.some((_, i) => moved(k, i));
  const dcfInputs = { ...fin.dcfInputs };
  if (rowMoved("revenueGrowth")) dcfInputs.medianRevenueGrowth = median(vals.get("revenueGrowth") ?? []);
  if (rowMoved("operatingMargin")) dcfInputs.medianOperatingMargin = median(vals.get("operatingMargin") ?? []);
  if (rowMoved("reinvestmentRate")) dcfInputs.medianReinvestmentRate = median(vals.get("reinvestmentRate") ?? []);
  if (rowMoved("revenue")) {
    // FCFF margin = FCFF ÷ revenue (FCFF row stays raw; see engine rules).
    dcfInputs.medianFcffMargin = median(
      years.map((_, i) => div(at("fcff", i), at("revenue", i)))
    );
  }
  const last = years.length - 1;
  if (last >= 0 && moved("netDebt", last) && at("netDebt", last) != null) {
    dcfInputs.netDebt = at("netDebt", last); // the EV→equity bridge follows the latest FY
  }

  // --- 4. the raw → cleansed diff (metric order, then year order) ---
  const cells: CleansedCell[] = [];
  for (const m of fin.metrics) {
    for (let i = 0; i < years.length; i++) {
      if (!moved(m.key, i)) continue;
      cells.push({
        metricKey: m.key,
        year: years[i],
        raw: rawAt(m.key, i),
        cleansed: at(m.key, i),
        adjustmentIds: idsAt(m.key, i),
        derived: !direct.has(cellKey(m.key, i)),
      });
    }
  }

  return {
    metrics: fin.metrics.map((m) => ({ ...m, values: vals.get(m.key)! })),
    dcfInputs,
    cells,
  };
}

// ---------------------------------------------------------------------------
// Shared formatting + agent context
// ---------------------------------------------------------------------------

/** Compact signed money for audit-log lines and agent context ("−$1.2B", "+¥340B" style). */
export function fmtDelta(v: number, currency: string | null): string {
  const cc = !currency || currency === "USD" ? "$" : `${currency} `;
  const a = Math.abs(v);
  const s =
    a >= 1e12 ? (a / 1e12).toFixed(2) + "T"
    : a >= 1e9 ? (a / 1e9).toFixed(2) + "B"
    : a >= 1e6 ? (a / 1e6).toFixed(1) + "M"
    : a >= 1e3 ? (a / 1e3).toFixed(0) + "k"
    : a.toFixed(0);
  return `${v < 0 ? "−" : "+"}${cc}${s}`;
}

/** The frozen human line an audit-log event stores ("netIncome FY2025 −$1.2B — SpaceX IPO gain"). */
export function describeAdjustment(
  a: Pick<FinAdjustment, "metricKey" | "fiscalYear" | "delta" | "title">,
  currency: string | null
): string {
  const amount =
    a.metricKey === "shares" ? `${a.delta < 0 ? "−" : "+"}${Math.abs(a.delta).toLocaleString("en-US")} shares` : fmtDelta(a.delta, currency);
  return `${a.metricKey} FY${a.fiscalYear} ${amount} — ${a.title}`;
}

/**
 * The reported table as plain text for the cleansing agents — exact raw
 * values (no display rounding) so proposed deltas reconcile with what was
 * actually reported. Bounded: ~33 rows × 10 FYs of numerics.
 */
export function reportedTableText(fin: TickerFinancials): string {
  const lines = [
    `Reporting currency: ${fin.currency ?? "USD"}. Fiscal years: ${fin.fiscalYears.join(", ")}.`,
    `Each row: metricKey = FY:value pairs (money in raw currency units, not millions; pct as decimals; null = not reported).`,
  ];
  for (const m of fin.metrics) {
    const cells = m.values
      .map((v, i) => `${fin.fiscalYears[i]}:${v == null ? "null" : String(v)}`)
      .join(" ");
    lines.push(`${m.key} (${m.format}${ADJUSTABLE.has(m.key) ? ", adjustable" : ""}) = ${cells}`);
  }
  return lines.join("\n");
}

/** Existing adjustments as prompt lines (dedupe context + the analyst's working set). */
export function adjustmentLines(adjustments: FinAdjustment[], currency: string | null): string {
  if (adjustments.length === 0) return "(none)";
  return adjustments
    .map(
      (a) =>
        `- [id ${a.id}] (${a.status}, ${a.kind}) ${describeAdjustment(a, currency)}${
          a.rationale ? ` | rationale: ${a.rationale.slice(0, 220)}` : ""
        }`
    )
    .join("\n");
}
