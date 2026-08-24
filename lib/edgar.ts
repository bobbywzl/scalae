// SEC EDGAR XBRL supplement for the financials data layer. The market-data
// providers (Yahoo / FMP-free) only serve the last ~4–5 annual statements and
// a handful of quarters; EDGAR's companyfacts API carries the full XBRL filing
// history (≈2009 onward) for SEC filers — enough to show at least ten fiscal
// years (or every year since the IPO for younger listings) and five years of
// quarterly statements. Everything here maps us-gaap concepts onto the SAME
// bare-key record shape lib/financials.ts extracts (Yahoo key names, Yahoo
// sign conventions: capex/dividends/buybacks are cash-flow-signed, i.e.
// negative for an outflow), so the compute layer never learns which rows came
// from filings. Fail-soft throughout: any error yields null/empty and the
// provider data stands alone.

type Rec = Record<string, unknown>;

// SEC asks automated clients to identify themselves; a descriptive UA with a
// reachable URL satisfies that without attaching anyone's personal address.
const EDGAR_UA = "scalae/0.1 (+https://scalae.vercel.app)";
const EDGAR_TIMEOUT_MS = 25_000;
const TICKER_MAP_TTL_MS = 24 * 3600_000;

/** Day-precision millisecond helpers (EDGAR dates are YYYY-MM-DD strings). */
const DAY_MS = 864e5;
const days = (a: number, b: number) => (a - b) / DAY_MS;

async function edgarJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EDGAR_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": EDGAR_UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`EDGAR ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Symbol → CIK. One ~800KB mapping file covers every registered ticker; cache
// it per server instance rather than re-downloading per symbol.
// ---------------------------------------------------------------------------

let tickerMapCache: { at: number; map: Map<string, string> } | null = null;

/** EDGAR writes share classes as "BRK-B"; normalize dots and case to match. */
const normSymbol = (s: string) => s.trim().toUpperCase().replace(/\./g, "-");

async function tickerToCik(symbol: string): Promise<string | null> {
  const now = Date.now();
  if (!tickerMapCache || now - tickerMapCache.at > TICKER_MAP_TTL_MS) {
    const raw = (await edgarJson("https://www.sec.gov/files/company_tickers.json")) as Record<
      string,
      { cik_str?: number; ticker?: string }
    >;
    const map = new Map<string, string>();
    for (const row of Object.values(raw ?? {})) {
      if (row?.ticker && row.cik_str != null) {
        map.set(normSymbol(row.ticker), String(row.cik_str).padStart(10, "0"));
      }
    }
    if (map.size === 0) throw new Error("EDGAR ticker map empty");
    tickerMapCache = { at: now, map };
  }
  return tickerMapCache.map.get(normSymbol(symbol)) ?? null;
}

// ---------------------------------------------------------------------------
// companyfacts fetch
// ---------------------------------------------------------------------------

interface RawFact {
  start?: string;
  end?: string;
  val?: unknown;
  filed?: string;
}

export interface CompanyFacts {
  facts?: { "us-gaap"?: Record<string, { units?: Record<string, RawFact[]> }> };
}

/**
 * The full XBRL fact history for a symbol, or null when the symbol isn't an
 * SEC filer (or EDGAR is unreachable). Network errors surface as null — the
 * caller treats EDGAR as a best-effort supplement, never a dependency.
 */
export async function fetchCompanyFacts(symbol: string): Promise<CompanyFacts | null> {
  try {
    const cik = await tickerToCik(symbol);
    if (!cik) return null;
    return (await edgarJson(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
    )) as CompanyFacts;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Concept table: which us-gaap tags feed which Yahoo-shaped record key.
// Filers move between tags over the years (Alphabet's revenue lived in
// "Revenues" until 2017 and "RevenueFromContractWithCustomer…" after), so
// every concept is an ordered alias list resolved PER PERIOD — first tag with
// a value for that period wins.
// ---------------------------------------------------------------------------

type UnitKind = "money" | "shares" | "perShare";

interface Concept {
  tags: string[];
  unit: UnitKind;
  /** Point-in-time balance value (no duration) vs a flow over a period. */
  instant?: boolean;
  /**
   * Quarter values for additive flows can be reconstructed from year-to-date
   * entries (Q4 = FY − 9M). Weighted-average share counts are NOT additive —
   * they only ever use discretely reported quarters.
   */
  nonAdditive?: boolean;
}

const CONCEPTS = {
  revenue: {
    tags: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "SalesRevenueGoodsNet",
    ],
    unit: "money",
  },
  costOfRevenue: {
    tags: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
    unit: "money",
  },
  grossProfit: { tags: ["GrossProfit"], unit: "money" },
  operatingIncome: { tags: ["OperatingIncomeLoss"], unit: "money" },
  netIncome: {
    tags: ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
    unit: "money",
  },
  pretaxIncome: {
    tags: [
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    ],
    unit: "money",
  },
  taxProvision: { tags: ["IncomeTaxExpenseBenefit"], unit: "money" },
  interestExpense: {
    tags: ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt"],
    unit: "money",
  },
  equity: {
    tags: [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
    unit: "money",
    instant: true,
  },
  cash: {
    tags: [
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ],
    unit: "money",
    instant: true,
  },
  totalAssets: { tags: ["Assets"], unit: "money", instant: true },
  currentAssets: { tags: ["AssetsCurrent"], unit: "money", instant: true },
  currentLiabilities: { tags: ["LiabilitiesCurrent"], unit: "money", instant: true },
  // Debt arrives in pieces; assembled in resolveDebt (LongTermDebt already
  // includes the current portion — never add LongTermDebtCurrent to it).
  longTermDebt: { tags: ["LongTermDebt"], unit: "money", instant: true },
  longTermDebtNoncurrent: {
    tags: ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"],
    unit: "money",
    instant: true,
  },
  longTermDebtCurrent: {
    tags: ["LongTermDebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
    unit: "money",
    instant: true,
  },
  shortTermDebt: {
    tags: ["DebtCurrent", "ShortTermBorrowings", "CommercialPaper"],
    unit: "money",
    instant: true,
  },
  operatingLease: { tags: ["OperatingLeaseLiability"], unit: "money", instant: true },
  operatingLeaseNoncurrent: {
    tags: ["OperatingLeaseLiabilityNoncurrent"],
    unit: "money",
    instant: true,
  },
  operatingLeaseCurrent: { tags: ["OperatingLeaseLiabilityCurrent"], unit: "money", instant: true },
  ocf: {
    tags: [
      "NetCashProvidedByUsedInOperatingActivities",
      "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
    unit: "money",
  },
  capex: {
    tags: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    unit: "money",
  },
  depreciationAmortization: {
    tags: ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet"],
    unit: "money",
  },
  depreciationOnly: { tags: ["Depreciation"], unit: "money" },
  amortizationOnly: { tags: ["AmortizationOfIntangibleAssets"], unit: "money" },
  changeNWC: { tags: ["IncreaseDecreaseInOperatingCapital"], unit: "money" },
  dividendsPaid: {
    tags: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock", "PaymentsOfOrdinaryDividends"],
    unit: "money",
  },
  buybacks: { tags: ["PaymentsForRepurchaseOfCommonStock"], unit: "money" },
  sharesDiluted: {
    tags: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
    unit: "shares",
    nonAdditive: true,
  },
  sharesBasic: {
    tags: ["WeightedAverageNumberOfSharesOutstandingBasic"],
    unit: "shares",
    nonAdditive: true,
  },
  epsDiluted: { tags: ["EarningsPerShareDiluted"], unit: "perShare" },
  epsBasic: { tags: ["EarningsPerShareBasic"], unit: "perShare" },
  dps: {
    tags: ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"],
    unit: "perShare",
  },
} satisfies Record<string, Concept>;

type ConceptKey = keyof typeof CONCEPTS;

// ---------------------------------------------------------------------------
// Per-tag series: dedupe restatements, classify durations, reconstruct
// discrete quarters from year-to-date entries.
// ---------------------------------------------------------------------------

interface FactPoint {
  startMs: number | null;
  endMs: number;
  end: string;
  val: number;
  filed: string;
}

interface FiscalWindow {
  startMs: number;
  endMs: number;
  /** YYYY-MM-DD of the fiscal year end; null for the in-progress synthetic window. */
  end: string | null;
}

interface TagSeries {
  /** Fiscal-year-end date → full-year value (flows) / period-end value (instants). */
  annual: Map<string, number>;
  /** Quarter-end date → that quarter's discrete value (or point-in-time value). */
  quarter: Map<string, number>;
}

function factPoints(entries: RawFact[]): FactPoint[] {
  // Latest filing wins per (start,end): restatements reflect the current record.
  const byPeriod = new Map<string, FactPoint>();
  for (const e of entries ?? []) {
    if (typeof e?.val !== "number" || !Number.isFinite(e.val) || !e.end) continue;
    const endMs = Date.parse(e.end);
    if (!Number.isFinite(endMs)) continue;
    const startMs = e.start ? Date.parse(e.start) : null;
    if (e.start && !Number.isFinite(startMs!)) continue;
    const point: FactPoint = { startMs, endMs, end: e.end, val: e.val, filed: e.filed ?? "" };
    const key = `${e.start ?? ""}|${e.end}`;
    const prev = byPeriod.get(key);
    if (!prev || point.filed > prev.filed) byPeriod.set(key, point);
  }
  return [...byPeriod.values()].sort((a, b) => a.endMs - b.endMs);
}

const isAnnualSpan = (p: FactPoint) =>
  p.startMs != null && days(p.endMs, p.startMs) > 330 && days(p.endMs, p.startMs) < 400;
const isQuarterSpan = (p: FactPoint) =>
  p.startMs != null && days(p.endMs, p.startMs) > 60 && days(p.endMs, p.startMs) < 120;

/**
 * Build one tag's annual + discrete-quarter series across the fiscal windows.
 * Flows reconstruct missing discrete quarters from year-to-date entries
 * (Q4 = FY − 9M YTD) — but only across a quarter-sized gap, so a hole in the
 * record can never smear two quarters into one.
 */
function seriesFor(points: FactPoint[], windows: FiscalWindow[], instant: boolean, nonAdditive: boolean): TagSeries {
  const out: TagSeries = { annual: new Map(), quarter: new Map() };
  if (instant) {
    for (const p of points.filter((x) => x.startMs == null)) out.quarter.set(p.end, p.val);
    for (const w of windows) {
      if (!w.end) continue;
      const v = nearLookup(out.quarter, w.endMs);
      if (v != null) out.annual.set(w.end, v);
    }
    return out;
  }

  for (const p of points) if (isAnnualSpan(p)) out.annual.set(p.end, p.val);

  for (const w of windows) {
    // Cumulative-from-fiscal-year-start entries (Q1 discrete included) and
    // discretely reported quarters that end inside this window.
    const cum = new Map<number, number>();
    const disc = new Map<number, number>();
    for (const p of points) {
      if (p.startMs == null) continue;
      const inWindow = p.endMs > w.startMs && days(p.endMs, w.endMs) < 6;
      if (!inWindow) continue;
      if (Math.abs(days(p.startMs, w.startMs)) <= 10) cum.set(p.endMs, p.val);
      if (isQuarterSpan(p)) disc.set(p.endMs, p.val);
    }
    const ends = [...new Set([...cum.keys(), ...disc.keys()])].sort((a, b) => a - b);
    // Anchor the running cumulative at zero on the fiscal year's first day.
    let prevCum: number | null = 0;
    let prevEndMs = w.startMs - DAY_MS;
    for (const endMs of ends) {
      let c = cum.get(endMs) ?? null;
      let d = disc.get(endMs) ?? null;
      if (!nonAdditive) {
        const gapDays = days(endMs, prevEndMs);
        if (c == null && d != null && prevCum != null && gapDays < 120) c = prevCum + d;
        if (d == null && c != null && prevCum != null && gapDays > 60 && gapDays < 120) {
          d = c - prevCum;
        }
      }
      if (d != null) out.quarter.set(new Date(endMs).toISOString().slice(0, 10), d);
      prevCum = c;
      prevEndMs = endMs;
    }
  }
  return out;
}

/** Exact-or-nearby lookup (filers' period ends drift a few days across years). */
function nearLookup(map: Map<string, number>, endMs: number): number | null {
  let best: { dist: number; val: number } | null = null;
  for (const [end, val] of map) {
    const dist = Math.abs(days(Date.parse(end), endMs));
    if (dist <= 6 && (!best || dist < best.dist)) best = { dist, val };
  }
  return best?.val ?? null;
}

// ---------------------------------------------------------------------------
// Extraction: fiscal windows + per-period concept resolution → Yahoo-shaped rows
// ---------------------------------------------------------------------------

export interface EdgarStatements {
  /** Annual statement rows oldest → newest, extractYear-compatible. */
  annual: Rec[];
  /** Discrete-quarter rows oldest → newest, same shape. */
  quarterly: Rec[];
}

/** A share split (ratio 20 = 20-for-1), for restating as-filed per-share history. */
export interface SplitEvent {
  dateMs: number;
  ratio: number;
}

const MAX_EDGAR_YEARS = 25;
/**
 * Quarter rows are emitted for this many most-recent fiscal years + the
 * current one, PLUS one earlier year so the oldest displayed quarters can
 * still compute same-quarter-last-year growth.
 */
const QUARTER_YEARS = 5;

/**
 * XBRL facts are stated in the share basis of their FILING date — a 20-for-1
 * split restates every later filing but leaves earlier ones as filed, so a
 * naive read mixes pre- and post-split EPS in one row. Restate each entry by
 * the split ratios dated after it was filed. `splits === null` means the
 * split history is UNKNOWN (the lookup failed): per-share facts are then
 * omitted entirely rather than served on a possibly-mixed basis.
 */
function splitAdjust(points: FactPoint[], kind: UnitKind, splits: SplitEvent[] | null): FactPoint[] {
  if (kind === "money") return points;
  if (splits == null) return [];
  if (splits.length === 0) return points;
  const out: FactPoint[] = [];
  for (const p of points) {
    const filedMs = p.filed ? Date.parse(p.filed) : NaN;
    if (!Number.isFinite(filedMs)) continue; // basis unknowable without a filing date
    let factor = 1;
    for (const s of splits) if (s.dateMs > filedMs) factor *= s.ratio;
    out.push(factor === 1 ? p : { ...p, val: kind === "shares" ? p.val * factor : p.val / factor });
  }
  return out;
}

/**
 * Map a filer's XBRL facts onto provider-shaped statement rows, in the given
 * STATEMENT currency (facts filed in other currencies are ignored — the ADR
 * trap guard). Returns null when the facts don't yield a single fiscal year.
 */
export function extractStatements(
  facts: CompanyFacts | null,
  currency: string | null,
  splits: SplitEvent[] | null
): EdgarStatements | null {
  const gaap = facts?.facts?.["us-gaap"];
  const cur = (currency ?? "USD").toUpperCase();
  if (!gaap) return null;

  const unitKey = (u: UnitKind) => (u === "money" ? cur : u === "shares" ? "shares" : `${cur}/shares`);
  const pointsByConcept = new Map<ConceptKey, FactPoint[][]>();
  for (const [key, concept] of Object.entries(CONCEPTS) as [ConceptKey, Concept][]) {
    pointsByConcept.set(
      key,
      concept.tags.map((tag) =>
        splitAdjust(factPoints(gaap[tag]?.units?.[unitKey(concept.unit)] ?? []), concept.unit, splits)
      )
    );
  }

  // Fiscal windows come from the union of every flow concept's annual periods
  // (tag migrations leave holes in any single tag's history).
  const windowByEnd = new Map<string, FiscalWindow>();
  for (const [key, concept] of Object.entries(CONCEPTS) as [ConceptKey, Concept][]) {
    if (concept.instant) continue;
    for (const points of pointsByConcept.get(key)!) {
      for (const p of points) {
        if (isAnnualSpan(p) && !windowByEnd.has(p.end)) {
          windowByEnd.set(p.end, { startMs: p.startMs!, endMs: p.endMs, end: p.end });
        }
      }
    }
  }
  const windows = [...windowByEnd.values()].sort((a, b) => a.endMs - b.endMs).slice(-MAX_EDGAR_YEARS);
  if (windows.length === 0) return null;

  // The in-progress fiscal year: quarters reported after the latest annual close.
  const lastClosed = windows[windows.length - 1];
  const current: FiscalWindow = {
    startMs: lastClosed.endMs + DAY_MS,
    endMs: lastClosed.endMs + 400 * DAY_MS,
    end: null,
  };
  const allWindows = [...windows, current];

  const series = new Map<ConceptKey, TagSeries[]>();
  for (const [key, concept] of Object.entries(CONCEPTS) as [ConceptKey, Concept][]) {
    series.set(
      key,
      pointsByConcept
        .get(key)!
        .map((points) => seriesFor(points, allWindows, !!concept.instant, !!concept.nonAdditive))
    );
  }

  // First alias with a value for the period wins.
  const annualAt = (key: ConceptKey, end: string): number | null => {
    for (const s of series.get(key)!) {
      const v = s.annual.get(end) ?? nearLookup(s.annual, Date.parse(end));
      if (v != null) return v;
    }
    return null;
  };
  const quarterAt = (key: ConceptKey, endMs: number): number | null => {
    for (const s of series.get(key)!) {
      const v = nearLookup(s.quarter, endMs);
      if (v != null) return v;
    }
    return null;
  };

  const rowFor = (g: (key: ConceptKey) => number | null, date: string): Rec => {
    const sum2 = (a: number | null, b: number | null): number | null =>
      a != null || b != null ? (a ?? 0) + (b ?? 0) : null;
    const revenue = g("revenue");
    const costOfRevenue = g("costOfRevenue");
    const grossProfit =
      g("grossProfit") ?? (revenue != null && costOfRevenue != null ? revenue - costOfRevenue : null);
    // D&A: the combined tag when filed, else depreciation + intangible
    // amortization (amortization alone never stands in for the pair).
    const dep = g("depreciationOnly");
    const dna = g("depreciationAmortization") ?? (dep != null ? dep + (g("amortizationOnly") ?? 0) : null);
    // Yahoo's totalDebt ≈ borrowings incl. current portion + operating leases.
    const borrowings =
      g("longTermDebt") ?? sum2(g("longTermDebtNoncurrent"), g("longTermDebtCurrent"));
    const leases = g("operatingLease") ?? sum2(g("operatingLeaseNoncurrent"), g("operatingLeaseCurrent"));
    const totalDebt = sum2(sum2(borrowings, g("shortTermDebt")), leases);
    // EDGAR files outflows positive; the provider shape is cash-flow-signed.
    const flip = (v: number | null): number | null => (v == null ? null : -v);
    const row: Rec = {
      date,
      reportedCurrency: cur,
      totalRevenue: revenue,
      grossProfit,
      operatingIncome: g("operatingIncome"),
      netIncome: g("netIncome"),
      pretaxIncome: g("pretaxIncome"),
      taxProvision: g("taxProvision"),
      interestExpense: g("interestExpense"),
      stockholdersEquity: g("equity"),
      cashAndCashEquivalents: g("cash"),
      totalAssets: g("totalAssets"),
      currentAssets: g("currentAssets"),
      currentLiabilities: g("currentLiabilities"),
      totalDebt,
      operatingCashFlow: g("ocf"),
      capitalExpenditure: flip(g("capex")),
      reconciledDepreciation: dna,
      changeInWorkingCapital: flip(g("changeNWC")),
      cashDividendsPaid: flip(g("dividendsPaid")),
      repurchaseOfCapitalStock: flip(g("buybacks")),
      dilutedAverageShares: g("sharesDiluted"),
      basicAverageShares: g("sharesBasic"),
      dilutedEPS: g("epsDiluted"),
      basicEPS: g("epsBasic"),
      dividendPerShare: g("dps"),
    };
    for (const k of Object.keys(row)) if (row[k] == null) delete row[k];
    return row;
  };

  const annual = windows
    .map((w) => rowFor((key) => annualAt(key, w.end!), w.end!))
    .filter((r) => r.totalRevenue != null || r.netIncome != null || r.stockholdersEquity != null);

  // Quarter rows: every quarter end any concept reported, within the last
  // QUARTER_YEARS(+1 for YoY baselines) closed fiscal years and the
  // in-progress one. Nearby ends (a few days apart across concepts) cluster
  // into one canonical column.
  const quarterWindows = allWindows.slice(-(QUARTER_YEARS + 2));
  const endCandidates = new Set<number>();
  for (const [, list] of series) {
    for (const s of list) {
      for (const end of s.quarter.keys()) {
        const endMs = Date.parse(end);
        if (
          quarterWindows.some((w) => endMs > w.startMs && days(endMs, w.endMs) < 6) &&
          days(Date.now(), endMs) > -6
        ) {
          endCandidates.add(endMs);
        }
      }
    }
  }
  const clustered: number[] = [];
  for (const endMs of [...endCandidates].sort((a, b) => a - b)) {
    if (clustered.length && days(endMs, clustered[clustered.length - 1]) <= 6) {
      clustered[clustered.length - 1] = endMs; // keep the latest end of the cluster
    } else {
      clustered.push(endMs);
    }
  }
  const quarterly = clustered
    .map((endMs) => rowFor((key) => quarterAt(key, endMs), new Date(endMs).toISOString().slice(0, 10)))
    .filter((r) => r.totalRevenue != null || r.netIncome != null || r.stockholdersEquity != null);

  return { annual, quarterly };
}
