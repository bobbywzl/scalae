import type {
  CleansedCell,
  CleansedFinancials,
  FinAdjustment,
  FinAdjustmentOp,
  FinancialMetric,
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
 * 5. BOARD EDITS (op ≠ "delta") reshape the view, never the record: "set"
 *    pins a cell to an exact value (a pinned cell always beats a recompute);
 *    "addRow" materializes a custom row whose reported values are null;
 *    "addYear" widens the grid with an empty column; "removeRow"/"removeYear"
 *    only hide — derived rows and the DCF medians keep computing on the full
 *    grid, because a hidden year spliced out of a growth series would
 *    manufacture numbers the record never reported.
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

/** Numeric-aware fiscal-year ordering (labels are 4-digit years in practice). */
const cmpYear = (a: string, b: string): number => {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.localeCompare(b);
};

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
  // Board edits ride alongside deltas; partition by op (legacy rows = delta).
  const ops = (o: FinAdjustmentOp) => applied.filter((a) => (a.op ?? "delta") === o);
  const deltas = ops("delta");
  // Oldest-first so the investor's LATEST applied pin on a cell wins.
  const sets = ops("set").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const addRows = ops("addRow").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const hiddenRowKeys = new Set(ops("removeRow").map((a) => a.metricKey));
  const addedYears = [
    ...new Set(ops("addYear").map((a) => a.fiscalYear)),
  ].filter((y) => !!y && !fin.fiscalYears.includes(y));
  const hiddenYearLabels = new Set(ops("removeYear").map((a) => a.fiscalYear));

  // The working grid: reported years plus applied addYear columns, in fiscal
  // order. Reported rows remap onto it (null in the added columns); custom
  // rows (addRow) exist only in the cleansed view, so their raw side is null.
  const years = [...fin.fiscalYears, ...addedYears].sort(cmpYear);
  const oldIdx = new Map(fin.fiscalYears.map((y, i) => [y, i]));
  const remap = (values: (number | null)[]): (number | null)[] =>
    years.map((y) => {
      const i = oldIdx.get(y);
      return i == null ? null : (values[i] ?? null);
    });
  const customRows: FinancialMetric[] = addRows.map((a) => ({
    key: a.metricKey,
    group: a.rowGroup ?? "custom",
    format: a.rowFormat ?? "money",
    polarity: 0,
    values: years.map(() => null),
  }));
  const customKeys = new Set(customRows.map((m) => m.key));
  const allMetrics: FinancialMetric[] = [
    ...fin.metrics.map((m) => ({ ...m, values: remap(m.values) })),
    ...customRows,
  ];
  const raw = new Map<string, (number | null)[]>(allMetrics.map((m) => [m.key, m.values]));
  const vals = new Map<string, (number | null)[]>(allMetrics.map((m) => [m.key, [...m.values]]));

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

  // --- 1a. custom-row cells (addRow) — direct placements of the row's values ---
  for (const a of addRows) {
    const row = vals.get(a.metricKey);
    if (!row || !a.cells) continue;
    for (const [year, v] of Object.entries(a.cells)) {
      const i = years.indexOf(year);
      if (i < 0 || v == null || !Number.isFinite(v)) continue;
      row[i] = v;
      direct.add(cellKey(a.metricKey, i));
      addContrib(a.metricKey, i, [a.id]);
    }
  }

  // --- 1b. set ops: pin cells to exact values (any row, incl. custom and
  // derived rows). A pinned cell is the investor's explicit figure — it always
  // beats a recompute (setDerived skips direct cells below).
  for (const s of sets) {
    if (s.value == null || !Number.isFinite(s.value)) continue;
    const i = years.indexOf(s.fiscalYear);
    const row = vals.get(s.metricKey);
    if (i < 0 || !row) continue;
    row[i] = s.value;
    direct.add(cellKey(s.metricKey, i));
    addContrib(s.metricKey, i, [s.id]);
  }

  // --- 1c. direct deltas on the whitelisted base rows ---
  for (const a of deltas) {
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
  // A directly-set (pinned) cell never recomputes — the investor's figure wins.
  const setDerived = (k: string, i: number, v: number | null, inputs: [string, number][]) => {
    if (direct.has(cellKey(k, i))) return;
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
  // Delta-propagation rows (netDebt, fcf, eps) prefer raw + Δ of inputs; where
  // the raw base is null (an added-year column, or a provider gap the investor
  // filled with sets) there is no provider figure to reconcile against, so
  // they fall back to the exact formula over the current values.
  for (let i = 0; i < years.length; i++) {
    // Net debt: provider-sourced raw → delta-propagation (Δdebt − Δcash).
    if (moved("totalDebt", i) || moved("cash", i)) {
      const base = rawAt("netDebt", i);
      if (base != null) {
        setDerived("netDebt", i, base + deltaOf("totalDebt", i) - deltaOf("cash", i), [
          ["totalDebt", i],
          ["cash", i],
        ]);
      } else if (at("totalDebt", i) != null && at("cash", i) != null) {
        setDerived("netDebt", i, at("totalDebt", i)! - at("cash", i)!, [
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
    // fcf adjustment or pin wins outright (setDerived skips direct cells).
    if (moved("ocf", i) || moved("capex", i)) {
      const base = rawAt("fcf", i);
      if (base != null) {
        setDerived("fcf", i, base + deltaOf("ocf", i) + deltaOf("capex", i), [
          ["ocf", i],
          ["capex", i],
        ]);
      } else if (at("ocf", i) != null && at("capex", i) != null) {
        setDerived("fcf", i, at("ocf", i)! + at("capex", i)!, [
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
      } else if (base == null && adjRatio != null) {
        setDerived("eps", i, adjRatio, [
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
  // Custom rows are excluded (they have no reported side — the addRow
  // adjustment itself is their record), as are hidden rows/years (not part of
  // the visible view; the hiding edit is its own auditable record).
  const cells: CleansedCell[] = [];
  for (const m of allMetrics) {
    if (customKeys.has(m.key) || hiddenRowKeys.has(m.key)) continue;
    for (let i = 0; i < years.length; i++) {
      if (hiddenYearLabels.has(years[i])) continue;
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

  // --- 5. project to the visible view: hidden years/rows drop out of the
  // payload; the full grid stays the computation substrate above.
  const visIdx = years
    .map((y, i) => (hiddenYearLabels.has(y) ? -1 : i))
    .filter((i) => i >= 0);
  return {
    fiscalYears: visIdx.map((i) => years[i]),
    metrics: allMetrics
      .filter((m) => !hiddenRowKeys.has(m.key))
      .map((m) => ({ ...m, values: visIdx.map((i) => vals.get(m.key)![i]) })),
    dcfInputs,
    cells,
    addedYears: addedYears.filter((y) => !hiddenYearLabels.has(y)).sort(cmpYear),
    hiddenYears: [...hiddenYearLabels].filter((y) => years.includes(y)).sort(cmpYear),
    hiddenRows: [...hiddenRowKeys],
  };
}

// ---------------------------------------------------------------------------
// Shared formatting + agent context
// ---------------------------------------------------------------------------

/** Compact money scale shared by the signed/unsigned formatters below. */
function moneyScale(v: number): string {
  const a = Math.abs(v);
  return a >= 1e12 ? (a / 1e12).toFixed(2) + "T"
    : a >= 1e9 ? (a / 1e9).toFixed(2) + "B"
    : a >= 1e6 ? (a / 1e6).toFixed(1) + "M"
    : a >= 1e3 ? (a / 1e3).toFixed(0) + "k"
    : a.toFixed(0);
}

/** Compact signed money for audit-log lines and agent context ("−$1.2B", "+¥340B" style). */
export function fmtDelta(v: number, currency: string | null): string {
  const cc = !currency || currency === "USD" ? "$" : `${currency} `;
  return `${v < 0 ? "−" : "+"}${cc}${moneyScale(v)}`;
}

/** Compact unsigned-positive money for pinned (set) values ("$1.2B", "CNY 340B"). */
export function fmtAmount(v: number, currency: string | null): string {
  const cc = !currency || currency === "USD" ? "$" : `${currency} `;
  return `${v < 0 ? "−" : ""}${cc}${moneyScale(v)}`;
}

/**
 * The frozen human line an audit-log event stores, op-aware:
 * "netIncome FY2025 −$1.2B — SpaceX IPO gain", "add row \"R&D expense\" …",
 * "hide FY2016 column — …".
 */
export function describeAdjustment(
  a: Pick<FinAdjustment, "metricKey" | "fiscalYear" | "delta" | "title"> &
    Partial<Pick<FinAdjustment, "op" | "value" | "rowLabel" | "cells">>,
  currency: string | null
): string {
  switch (a.op ?? "delta") {
    case "set": {
      const v = a.value;
      const amount =
        v == null ? "cleared"
        : a.metricKey === "shares" ? `${Math.abs(v).toLocaleString("en-US")} shares`
        : Math.abs(v) >= 1e4 ? fmtAmount(v, currency)
        : String(v);
      return `${a.metricKey} FY${a.fiscalYear} = ${amount} — ${a.title}`;
    }
    case "addRow": {
      const n = a.cells ? Object.values(a.cells).filter((v) => v != null).length : 0;
      return `add row "${a.rowLabel ?? a.metricKey}"${n > 0 ? ` (${n} value${n === 1 ? "" : "s"})` : ""} — ${a.title}`;
    }
    case "removeRow":
      return `hide row ${a.metricKey} — ${a.title}`;
    case "addYear":
      return `add FY${a.fiscalYear} column — ${a.title}`;
    case "removeYear":
      return `hide FY${a.fiscalYear} column — ${a.title}`;
    default: {
      const amount =
        a.metricKey === "shares"
          ? `${a.delta < 0 ? "−" : "+"}${Math.abs(a.delta).toLocaleString("en-US")} shares`
          : fmtDelta(a.delta, currency);
      return `${a.metricKey} FY${a.fiscalYear} ${amount} — ${a.title}`;
    }
  }
}

/**
 * The reported table as plain text for the cleansing agents — exact raw
 * values (no display rounding) so proposed deltas reconcile with what was
 * actually reported. Bounded: ~33 rows × 10 FYs of numerics. The currency
 * discipline is stated up front: deltas live in the STATEMENT currency, and
 * an ADR's trading currency is called out as a trap, never a unit.
 */
export function reportedTableText(fin: TickerFinancials): string {
  const cur = fin.currency ?? "USD";
  const lines = [
    `STATEMENT CURRENCY: ${cur} — every money value below, and EVERY delta you propose, is in raw ${cur} units (never millions/billions shorthand, never any other currency). Fiscal years: ${fin.fiscalYears.join(", ")}.`,
  ];
  if (fin.currencyMismatch && fin.tradingCurrency) {
    lines.push(
      `⚠ CURRENCY TRAP: the listing trades in ${fin.tradingCurrency}, but the statements are reported in ${cur}. Filings, ADR press coverage and data providers will quote some amounts in ${fin.tradingCurrency} — those are NOT usable as deltas. Only propose an adjustment when the ${cur} amount is disclosed (or the disclosure is natively ${cur}); NEVER convert with an assumed FX rate, and say in the rationale which currency the disclosure used.`
    );
  }
  lines.push(
    `Each row: metricKey = FY:value pairs (money in raw ${cur} units; pct as decimals; null = not reported).`
  );
  for (const m of fin.metrics) {
    const cells = m.values
      .map((v, i) => `${fin.fiscalYears[i]}:${v == null ? "null" : String(v)}`)
      .join(" ");
    lines.push(`${m.key} (${m.format}${ADJUSTABLE.has(m.key) ? ", adjustable" : ""}) = ${cells}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Delta-anomaly scan: which reported line-years moved FAR outside that line's
// own typical period-over-period variation? Deterministic (no model), run
// before the moderation sweeps so the research targets the outliers — the
// places a one-time or abnormal addition most likely hides. A flagged move is
// a QUESTION, never a verdict: a genuine collapse in earnings must stand.
// ---------------------------------------------------------------------------

/** One abnormal period-over-period move in the reported table. */
export interface DeltaAnomaly {
  metricKey: string;
  /** Fiscal year the move landed in, and the prior period it's measured against. */
  year: string;
  prevYear: string;
  prev: number;
  value: number;
  change: number;
  /** change / |prev| (null when the prior value is 0). */
  pct: number | null;
  /** |change| as a multiple of this line's median absolute period-over-period move. */
  vsTypical: number;
}

/**
 * Scan the ADJUSTABLE base lines for abnormal period-over-period moves.
 * "Abnormal" = several times the line's own median absolute change AND a
 * material relative move — so a steadily compounding line never flags its own
 * growth, and a line that always swings never flags at all. Needs 3+
 * consecutive-period changes of history; capped, largest outliers first.
 */
export function deltaAnomalies(fin: TickerFinancials, cap = 10): DeltaAnomaly[] {
  const out: DeltaAnomaly[] = [];
  for (const m of fin.metrics) {
    if (!ADJUSTABLE.has(m.key)) continue;
    const changes: { i: number; change: number; prev: number; value: number }[] = [];
    for (let i = 1; i < m.values.length; i++) {
      const prev = m.values[i - 1];
      const v = m.values[i];
      if (prev == null || v == null) continue; // only consecutive reported pairs
      changes.push({ i, change: v - prev, prev, value: v });
    }
    if (changes.length < 3) continue;
    const median = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };
    const medAbs = median(changes.map((c) => Math.abs(c.change)));
    if (!(medAbs > 0)) continue;
    // Typical RELATIVE move too: a steady compounder's absolute changes grow
    // every year, so the multiple-of-median test alone would flag plain
    // growth — the percentage move must also stand out against the line's own
    // typical percentage move.
    const pcts = changes
      .filter((c) => c.prev !== 0)
      .map((c) => Math.abs(c.change / Math.abs(c.prev)));
    const medPct = pcts.length >= 3 ? median(pcts) : 0;
    for (const c of changes) {
      const vsTypical = Math.abs(c.change) / medAbs;
      const pct = c.prev !== 0 ? c.change / Math.abs(c.prev) : null;
      if (
        vsTypical >= 2.5 &&
        (pct == null || Math.abs(pct) >= Math.max(0.25, 2 * medPct))
      ) {
        out.push({
          metricKey: m.key,
          year: fin.fiscalYears[c.i],
          prevYear: fin.fiscalYears[c.i - 1],
          prev: c.prev,
          value: c.value,
          change: c.change,
          pct,
          vsTypical,
        });
      }
    }
  }
  out.sort((a, b) => b.vsTypical - a.vsTypical);
  return out.slice(0, cap);
}

/** The anomaly scan as prompt lines (raw statement-currency units, the table's idiom). */
export function deltaAnomalyLines(anomalies: DeltaAnomaly[], currency: string | null): string {
  if (anomalies.length === 0) {
    return "(none — no reported line moved far outside its own typical period-over-period variation)";
  }
  const cur = currency ?? "USD";
  return anomalies
    .map(
      (a) =>
        `- ${a.metricKey} FY${a.prevYear}→FY${a.year}: ${a.prev} → ${a.value} (change ${a.change} raw ${cur} units${
          a.pct != null ? `, ${(a.pct * 100).toFixed(0)}%` : ""
        }; ~${a.vsTypical.toFixed(1)}× this line's typical move)`
    )
    .join("\n");
}

/** Existing adjustments as prompt lines (dedupe context + the analyst's working set). */
export function adjustmentLines(adjustments: FinAdjustment[], currency: string | null): string {
  if (adjustments.length === 0) return "(none)";
  return adjustments
    .map((a) => {
      const op = a.op ?? "delta";
      // Board edits label themselves by op; a custom row also exposes its
      // stable key so the analyst can target it with set/removeRow ops.
      const tag = op === "delta" ? a.kind : op;
      const rowKey = op === "addRow" ? ` (row key: ${a.metricKey})` : "";
      return `- [id ${a.id}] (${a.status}, ${tag}) ${describeAdjustment(a, currency)}${rowKey}${
        a.rationale ? ` | rationale: ${a.rationale.slice(0, 220)}` : ""
      }`;
    })
    .join("\n");
}
