import YahooFinance from "yahoo-finance2";
import { getCachedFinancials, setCachedFinancials } from "./db";
import { extractStatements, fetchCompanyFacts, type SplitEvent } from "./edgar";
import type {
  DcfInputs,
  FinancialMetric,
  FinancialsSnapshot,
  FiscalQuarter,
  FyEstimate,
  MetricFormat,
  MetricGroup,
  PeerComparison,
  PeerMetric,
  TickerFinancials,
} from "./types";

// The DCF/financials data layer. Statements come from Yahoo's
// `fundamentalsTimeSeries` (the legacy quoteSummary statement modules were
// gutted in Nov 2024); the point-in-time valuation snapshot comes from
// `quoteSummary`. Because the providers only serve the last ~4–5 annual
// periods and ~5 quarters, SEC filers are supplemented from EDGAR's XBRL
// facts (lib/edgar.ts) — provider values win wherever both cover a period —
// which is what makes the ten-plus-year history and the five years of
// clickable quarterly columns possible. Everything is fail-soft (returns null
// on error) and cached in Postgres per symbol — fundamentals move quarterly,
// so a multi-day TTL is plenty and keeps these heavy calls off the desk
// page's fast poll loop.

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** Annual statements move quarterly — refresh at most every few days. */
const TTL_MS = 3 * 24 * 3600_000;
/** Table depth: at least ten fiscal years (or back to the IPO) when the record reaches that far. */
const MAX_YEARS = 20;
/** Quarterly columns are carried for this many most-recent fiscal years (+ the current one). */
const QUARTER_FY_WINDOW = 5;
/**
 * The DCF medians normalize over at most this many recent fiscal years — the
 * original 10-FY design intent. The deep (EDGAR) history extends the TABLE,
 * not the normalization window, so a 20-year record doesn't quietly re-anchor
 * existing DCF inputs. lib/cleansing.ts mirrors this window.
 */
const DCF_MEDIAN_WINDOW = 10;
const MAX_PEERS = 5;
/** Overall wall-clock cap on the (multi-call) Yahoo fetch. */
const FETCH_TIMEOUT_MS = 60_000;
const DAY_MS = 864e5;

type Rec = Record<string, unknown>;

/** Coerce Yahoo's number | {raw:number} | undefined into a finite number or null. */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v && typeof v === "object" && "raw" in v) {
    const r = (v as { raw?: unknown }).raw;
    return typeof r === "number" && Number.isFinite(r) ? r : null;
  }
  return null;
}

const div = (a: number | null, b: number | null): number | null =>
  a != null && b != null && b !== 0 ? a / b : null;

const sub = (a: number | null, b: number | null): number | null =>
  a != null && b != null ? a - b : null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("financials fetch timed out")), ms)),
  ]);
}

// ---------------------------------------------------------------------------
// Per-year extraction & derived value-investor returns
// ---------------------------------------------------------------------------

interface YearData {
  year: string;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  ebit: number | null;
  interestExpense: number | null;
  taxRate: number | null;
  equity: number | null;
  totalDebt: number | null;
  cash: number | null;
  netDebt: number | null;
  totalAssets: number | null;
  investedCapital: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  ocf: number | null;
  capex: number | null; // Yahoo reports this negative (an outflow)
  changeNWC: number | null; // cash-flow signed: a NWC increase is negative cash
  fcf: number | null;
  dep: number | null;
  dividendsPaid: number | null;
  buybacks: number | null;
  shares: number | null;
  eps: number | null;
  dps: number | null;
}

function extractYear(r: Rec): YearData {
  const revenue = num(r.totalRevenue);
  const operatingIncome = num(r.operatingIncome);
  const netIncome = num(r.netIncome) ?? num(r.netIncomeCommonStockholders);
  const ebit = num(r.EBIT) ?? operatingIncome;
  const pretax = num(r.pretaxIncome);
  const tax = num(r.taxProvision);
  const taxRate = num(r.taxRateForCalcs) ?? (pretax && pretax !== 0 ? div(tax, pretax) : null);
  const totalDebt = num(r.totalDebt);
  const cash = num(r.cashAndCashEquivalents) ?? num(r.cashCashEquivalentsAndShortTermInvestments);
  const capex = num(r.capitalExpenditure);
  const ocf = num(r.operatingCashFlow);
  return {
    year: String(new Date(r.date as string | number | Date).getUTCFullYear()),
    revenue,
    grossProfit: num(r.grossProfit),
    operatingIncome,
    netIncome,
    ebit,
    interestExpense: num(r.interestExpense),
    taxRate: taxRate != null ? Math.min(0.6, Math.max(0, taxRate)) : null,
    equity: num(r.stockholdersEquity) ?? num(r.commonStockEquity),
    totalDebt,
    cash,
    netDebt: num(r.netDebt) ?? (totalDebt != null && cash != null ? totalDebt - cash : null),
    totalAssets: num(r.totalAssets),
    investedCapital: num(r.investedCapital),
    currentAssets: num(r.currentAssets),
    currentLiabilities: num(r.currentLiabilities),
    ocf,
    capex,
    changeNWC: num(r.changeInWorkingCapital),
    fcf: num(r.freeCashFlow) ?? (ocf != null && capex != null ? ocf + capex : null),
    dep: num(r.reconciledDepreciation) ?? num(r.depreciationAndAmortization),
    dividendsPaid: num(r.cashDividendsPaid) ?? num(r.commonStockDividendPaid),
    buybacks: num(r.repurchaseOfCapitalStock),
    shares: num(r.dilutedAverageShares) ?? num(r.basicAverageShares),
    eps: num(r.dilutedEPS) ?? num(r.basicEPS),
    dps: num(r.dividendPerShare),
  };
}

/** NOPAT / invested capital — the value investor's core return-on-capital. */
function roic(y: YearData): number | null {
  if (y.ebit == null) return null;
  const nopat = y.ebit * (1 - (y.taxRate ?? 0.21));
  // Prefer Yahoo's invested capital; else approximate as equity + debt − cash.
  const ic =
    y.investedCapital ??
    (y.equity != null && y.totalDebt != null ? y.equity + y.totalDebt - (y.cash ?? 0) : null);
  return div(nopat, ic);
}

/** Buffett owner earnings (approx): net income + D&A − capex (capex is negative). */
const ownerEarnings = (y: YearData): number | null =>
  y.netIncome != null && y.dep != null && y.capex != null ? y.netIncome + y.dep + y.capex : null;

/** After-tax operating profit — the numerator a DCF unlevers to. */
const nopat = (y: YearData): number | null =>
  y.ebit != null ? y.ebit * (1 - (y.taxRate ?? 0.21)) : null;

/** Net reinvestment (Damodaran): net capex + increase in working capital, in
 *  positive spend terms (capex/ΔNWC are stored cash-flow-signed, i.e. negative
 *  for an outflow). */
function reinvestment(y: YearData): number | null {
  if (y.capex == null && y.changeNWC == null) return null;
  const capexSpend = -(y.capex ?? 0);
  const nwcIncrease = -(y.changeNWC ?? 0);
  return capexSpend - (y.dep ?? 0) + nwcIncrease;
}

/** Unlevered free cash flow (FCFF) = NOPAT − reinvestment — what a WACC DCF discounts. */
function fcff(y: YearData): number | null {
  const n = nopat(y);
  const r = reinvestment(y);
  return n != null && r != null ? n - r : null;
}

const reinvestmentRate = (y: YearData): number | null => {
  const n = nopat(y);
  const r = reinvestment(y);
  return n != null && n !== 0 && r != null ? r / n : null;
};

/** Median of the non-null values (for normalizing DCF drivers across years). */
function median(vals: (number | null)[]): number | null {
  const xs = vals.filter((v): v is number => v != null).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Data providers. Yahoo is the default; Financial Modeling Prep is opt-in via
// FMP_API_KEY (higher fidelity + a real industry-peers endpoint). Both normalize
// to the SAME bare-key record shape the compute layer above consumes, so
// extractYear / buildSnapshot / buildDcfInputs never learn which provider ran.
// ---------------------------------------------------------------------------

interface Provider {
  source: string;
  statements(symbol: string, years: number): Promise<Rec[]>; // oldest → newest
  quarterlyStatements(symbol: string): Promise<Rec[]>; // oldest → newest
  summary(symbol: string): Promise<Rec>; // Yahoo-shaped sub-objects
  peers(symbol: string): Promise<string[]>; // candidate peer symbols
}

// ---- Yahoo ----
async function yahooTimeSeries(symbol: string, type: "annual" | "quarterly", years: number): Promise<Rec[]> {
  const period1 = new Date(Date.now() - (years + 1) * 365 * DAY_MS);
  const res = (await yf.fundamentalsTimeSeries(
    symbol,
    { period1, type, module: "all" },
    { validateResult: false }
  )) as unknown as Rec[];
  const rows = (res ?? []).filter((r) => r && r.date != null);
  rows.sort(
    (a, b) =>
      new Date(a.date as string | number | Date).getTime() -
      new Date(b.date as string | number | Date).getTime()
  );
  return rows;
}

async function yahooStatements(symbol: string, years: number): Promise<Rec[]> {
  return (await yahooTimeSeries(symbol, "annual", years)).slice(-years);
}

/** Yahoo serves only the last ~5 quarters however far back you ask. */
async function yahooQuarterlyStatements(symbol: string): Promise<Rec[]> {
  return yahooTimeSeries(symbol, "quarterly", 2);
}

/**
 * Share-split history, for restating EDGAR's as-filed per-share facts onto
 * today's share basis. null = UNKNOWN (lookup failed) — the EDGAR layer then
 * omits per-share history rather than mixing bases; [] = known split-free.
 */
async function yahooSplits(symbol: string): Promise<SplitEvent[] | null> {
  try {
    const res = (await yf.chart(
      symbol,
      { period1: new Date(Date.now() - 30 * 365 * DAY_MS), interval: "1mo", events: "split" },
      { validateResult: false }
    )) as unknown as { events?: { splits?: unknown } };
    const raw = res?.events?.splits;
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
        ? Object.values(raw)
        : [];
    const out: SplitEvent[] = [];
    for (const s of list as Rec[]) {
      const numerator = num(s.numerator);
      const denominator = num(s.denominator);
      const d = s.date as unknown;
      const dateMs =
        d instanceof Date
          ? d.getTime()
          : typeof d === "number"
            ? d * 1000 // chart events carry epoch seconds
            : d
              ? Date.parse(String(d))
              : NaN;
      if (numerator && denominator && Number.isFinite(dateMs)) {
        out.push({ dateMs, ratio: numerator / denominator });
      }
    }
    return out;
  } catch {
    return null;
  }
}

async function yahooSummary(symbol: string): Promise<Rec> {
  return (await yf.quoteSummary(
    symbol,
    { modules: ["price", "summaryDetail", "defaultKeyStatistics", "financialData", "assetProfile"] },
    { validateResult: false }
  )) as unknown as Rec;
}

async function yahooPeers(symbol: string): Promise<string[]> {
  const rec = (await yf.recommendationsBySymbol(symbol)) as unknown as {
    recommendedSymbols?: { symbol?: string }[];
  };
  return (rec?.recommendedSymbols ?? []).map((r) => r.symbol).filter((s): s is string => !!s);
}

const yahoo: Provider = {
  source: "Yahoo Finance",
  statements: yahooStatements,
  quarterlyStatements: yahooQuarterlyStatements,
  summary: yahooSummary,
  peers: yahooPeers,
};

// ---- Financial Modeling Prep (opt-in) ----
async function fmpGet(path: string): Promise<Rec[]> {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY not set");
  const url = `https://financialmodelingprep.com/api${path}${path.includes("?") ? "&" : "?"}apikey=${key}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`FMP ${res.status}`);
    const json = await res.json();
    return (Array.isArray(json) ? json : [json]) as Rec[];
  } finally {
    clearTimeout(timer);
  }
}

/** FMP → the canonical (Yahoo-key) statement record shape. */
async function fmpPeriodStatements(
  symbol: string,
  period: "annual" | "quarter",
  limit: number
): Promise<Rec[]> {
  const [inc, bal, cf, km] = await Promise.all([
    fmpGet(`/v3/income-statement/${symbol}?period=${period}&limit=${limit}`),
    fmpGet(`/v3/balance-sheet-statement/${symbol}?period=${period}&limit=${limit}`),
    fmpGet(`/v3/cash-flow-statement/${symbol}?period=${period}&limit=${limit}`),
    fmpGet(`/v3/key-metrics/${symbol}?period=${period}&limit=${limit}`).catch(() => [] as Rec[]),
  ]);
  // Annual rows join on the fiscal year; quarterly rows join on the exact period end.
  const yrKey = (r: Rec) =>
    period === "annual"
      ? String(r.calendarYear ?? (r.date as string | undefined)?.slice(0, 4) ?? "")
      : String(r.date ?? "");
  const index = (arr: Rec[]) => new Map(arr.map((r) => [yrKey(r), r]));
  const bM = index(bal), cM = index(cf), kM = index(km);
  const rows: Rec[] = inc.map((i) => {
    const yr = yrKey(i);
    const b = bM.get(yr) ?? {};
    const c = cM.get(yr) ?? {};
    const k = kM.get(yr) ?? {};
    return {
      date: i.date,
      reportedCurrency: i.reportedCurrency, // statement currency (ADR trap guard)
      totalRevenue: i.revenue,
      grossProfit: i.grossProfit,
      operatingIncome: i.operatingIncome,
      netIncome: i.netIncome,
      netIncomeCommonStockholders: i.netIncome,
      EBIT: i.operatingIncome, // FMP income has no clean EBIT; operating income is the standard proxy
      pretaxIncome: i.incomeBeforeTax,
      taxProvision: i.incomeTaxExpense,
      interestExpense: i.interestExpense,
      reconciledDepreciation: i.depreciationAndAmortization ?? c.depreciationAndAmortization,
      depreciationAndAmortization: c.depreciationAndAmortization,
      dilutedAverageShares: i.weightedAverageShsOutDil,
      basicAverageShares: i.weightedAverageShsOut,
      dilutedEPS: i.epsdiluted,
      basicEPS: i.eps,
      stockholdersEquity: b.totalStockholdersEquity,
      commonStockEquity: b.totalStockholdersEquity,
      totalDebt: b.totalDebt,
      netDebt: b.netDebt,
      cashAndCashEquivalents: b.cashAndCashEquivalents,
      cashCashEquivalentsAndShortTermInvestments: b.cashAndShortTermInvestments,
      totalAssets: b.totalAssets,
      currentAssets: b.totalCurrentAssets,
      currentLiabilities: b.totalCurrentLiabilities,
      investedCapital: k.investedCapital,
      operatingCashFlow: c.operatingCashFlow ?? c.netCashProvidedByOperatingActivities,
      capitalExpenditure: c.capitalExpenditure, // negative (outflow), like Yahoo
      changeInWorkingCapital: c.changeInWorkingCapital,
      freeCashFlow: c.freeCashFlow,
      cashDividendsPaid: c.dividendsPaid,
      commonStockDividendPaid: c.dividendsPaid,
      repurchaseOfCapitalStock: c.commonStockRepurchased,
      dividendPerShare: k.dividendPerShare ?? null,
    } as Rec;
  });
  rows.sort(
    (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
  );
  return rows;
}

const fmpStatements = (symbol: string, years: number): Promise<Rec[]> =>
  fmpPeriodStatements(symbol, "annual", years).then((rows) => rows.slice(-years));

const fmpQuarterlyStatements = (symbol: string): Promise<Rec[]> =>
  fmpPeriodStatements(symbol, "quarter", 4 * (QUARTER_FY_WINDOW + 1));

/** FMP → the Yahoo-shaped `summary` object buildSnapshot/buildDcfInputs read. */
async function fmpSummary(symbol: string): Promise<Rec> {
  const [profileArr, evArr, ratiosArr] = await Promise.all([
    fmpGet(`/v3/profile/${symbol}`).catch(() => [] as Rec[]),
    fmpGet(`/v3/enterprise-values/${symbol}?period=annual&limit=1`).catch(() => [] as Rec[]),
    fmpGet(`/v3/ratios-ttm/${symbol}`).catch(() => [] as Rec[]),
  ]);
  const p = profileArr[0] ?? {};
  const ev = evArr[0] ?? {};
  const r = ratiosArr[0] ?? {};
  return {
    price: { marketCap: p.mktCap, currency: p.currency, trailingPE: r.priceEarningsRatioTTM },
    summaryDetail: { marketCap: p.mktCap, trailingPE: r.priceEarningsRatioTTM },
    defaultKeyStatistics: {
      enterpriseValue: ev.enterpriseValue,
      priceToBook: r.priceToBookRatioTTM,
      enterpriseToEbitda: r.enterpriseValueMultipleTTM,
      beta: p.beta,
    },
    financialData: {
      returnOnEquity: r.returnOnEquityTTM,
      returnOnAssets: r.returnOnAssetsTTM,
      grossMargins: r.grossProfitMarginTTM,
      operatingMargins: r.operatingProfitMarginTTM,
      profitMargins: r.netProfitMarginTTM,
      currentRatio: r.currentRatioTTM,
      financialCurrency: p.currency,
    },
    assetProfile: { industry: p.industry, sector: p.sector },
  } as Rec;
}

/** FMP's real industry-peers endpoint (far better than Yahoo's "also viewed"). */
async function fmpPeers(symbol: string): Promise<string[]> {
  const res = await fmpGet(`/v4/stock_peers?symbol=${symbol}`).catch(() => [] as Rec[]);
  const list = (res[0]?.peersList ?? []) as unknown;
  return Array.isArray(list) ? (list.filter((s) => typeof s === "string") as string[]) : [];
}

const fmp: Provider = {
  source: "Financial Modeling Prep",
  statements: fmpStatements,
  quarterlyStatements: fmpQuarterlyStatements,
  summary: fmpSummary,
  peers: fmpPeers,
};

/** The active provider: FMP when a key is configured, else Yahoo. */
function provider(): Provider {
  return process.env.FMP_API_KEY ? fmp : yahoo;
}

/** One candidate's comparable metrics + its industry (for the same-industry filter). */
async function peerMetric(s: string): Promise<PeerMetric> {
  const p = provider();
  const [qs, stmts] = await Promise.all([
    p.summary(s),
    p.statements(s, 2).catch(() => [] as Rec[]),
  ]);
  const fd = (qs.financialData ?? {}) as Rec;
  const price = (qs.price ?? {}) as Rec;
  const profile = (qs.assetProfile ?? {}) as Rec;
  const latest = stmts.length ? extractYear(stmts[stmts.length - 1]) : null;
  const dte = num(fd.debtToEquity); // Yahoo returns this as a percent (e.g. 154.9)
  return {
    symbol: s,
    name: (price.shortName ?? price.longName ?? null) as string | null,
    industry: (profile.industry ?? null) as string | null,
    roe: num(fd.returnOnEquity) ?? (latest ? div(latest.netIncome, latest.equity) : null),
    roic: latest ? roic(latest) : null,
    netMargin: num(fd.profitMargins) ?? (latest ? div(latest.netIncome, latest.revenue) : null),
    operatingMargin:
      num(fd.operatingMargins) ?? (latest ? div(latest.operatingIncome, latest.revenue) : null),
    debtToEquity:
      latest && latest.equity ? div(latest.totalDebt, latest.equity) : dte != null ? dte / 100 : null,
  };
}

const normIndustry = (s: string | null | undefined) => (s ?? "").toLowerCase().trim();

async function targetIndustry(sym: string): Promise<string | null> {
  try {
    const cached = await peekFinancials(sym);
    if (cached?.industry) return cached.industry;
    const qs = await provider().summary(sym);
    return ((qs.assetProfile as Rec | undefined)?.industry as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Peer comparison — loaded ON DEMAND (never as part of the main financials
 * fetch). With `customTickers` the investor's exact picks are compared as-is.
 * Otherwise candidates come from Yahoo's related tickers but are kept ONLY when
 * their industry matches the target's — comparing a retailer to banks is noise,
 * so an unknown or non-matching industry yields no auto peers rather than junk.
 * Auto results are cached per symbol; custom sets aren't. Fail-soft throughout.
 */
export async function getPeers(symbol: string, customTickers?: string[]): Promise<PeerComparison> {
  const sym = symbol.toUpperCase();
  const industry = await targetIndustry(sym);

  if (customTickers && customTickers.length) {
    const syms = customTickers
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && s !== sym)
      .slice(0, MAX_PEERS);
    const settled = await Promise.allSettled(syms.map(peerMetric));
    const peers = settled
      .filter((r): r is PromiseFulfilledResult<PeerMetric> => r.status === "fulfilled")
      .map((r) => r.value);
    return { industry, peers, custom: true };
  }

  const key = `${sym}:PEERS`;
  try {
    const c = await getCachedFinancials(key);
    if (c && Date.now() - Date.parse(c.fetchedAt) < TTL_MS) {
      return JSON.parse(c.data) as PeerComparison;
    }
  } catch {
    /* fall through to refetch */
  }

  let candidates: string[] = [];
  try {
    candidates = (await provider().peers(sym))
      .filter((s) => !!s && s.toUpperCase() !== sym)
      .slice(0, 10);
  } catch {
    candidates = [];
  }
  const settled = await Promise.allSettled(candidates.map(peerMetric));
  const all = settled
    .filter((r): r is PromiseFulfilledResult<PeerMetric> => r.status === "fulfilled")
    .map((r) => r.value);
  // Same-industry only; without a known target industry we can't guarantee that,
  // so we return none rather than mixing industries.
  const peers = industry
    ? all.filter((p) => normIndustry(p.industry) === normIndustry(industry)).slice(0, MAX_PEERS)
    : [];
  const result: PeerComparison = { industry, peers, custom: false };
  if (peers.length > 0) await setCachedFinancials(key, JSON.stringify(result)).catch(() => {});
  return result;
}

// ---------------------------------------------------------------------------
// Metric table + snapshot assembly
// ---------------------------------------------------------------------------

function metric(
  key: string,
  group: MetricGroup,
  format: MetricFormat,
  polarity: 1 | -1 | 0,
  values: (number | null)[]
): FinancialMetric {
  return { key, group, format, polarity, values };
}

function buildMetrics(ys: YearData[]): FinancialMetric[] {
  const col = <T,>(f: (y: YearData) => T): T[] => ys.map(f);
  return [
    // Income
    metric("revenue", "income", "money", 1, col((y) => y.revenue)),
    metric("operatingIncome", "income", "money", 1, col((y) => y.operatingIncome)),
    metric("netIncome", "income", "money", 1, col((y) => y.netIncome)),
    metric("grossMargin", "income", "pct", 1, col((y) => div(y.grossProfit, y.revenue))),
    metric("operatingMargin", "income", "pct", 1, col((y) => div(y.operatingIncome, y.revenue))),
    metric("netMargin", "income", "pct", 1, col((y) => div(y.netIncome, y.revenue))),
    // Returns on capital
    metric("roe", "returns", "pct", 1, col((y) => div(y.netIncome, y.equity))),
    metric("roic", "returns", "pct", 1, col(roic)),
    metric("roa", "returns", "pct", 1, col((y) => div(y.netIncome, y.totalAssets))),
    // Balance sheet / solvency
    metric("equity", "balance", "money", 1, col((y) => y.equity)),
    metric("totalDebt", "balance", "money", -1, col((y) => y.totalDebt)),
    metric("netDebt", "balance", "money", -1, col((y) => y.netDebt)),
    metric("cash", "balance", "money", 1, col((y) => y.cash)),
    metric("debtToEquity", "balance", "ratio", -1, col((y) => div(y.totalDebt, y.equity))),
    metric("currentRatio", "balance", "ratio", 1, col((y) => div(y.currentAssets, y.currentLiabilities))),
    metric("interestCoverage", "balance", "x", 1, col((y) => div(y.ebit, y.interestExpense))),
    // Cash flow
    metric("ocf", "cashflow", "money", 1, col((y) => y.ocf)),
    metric("fcf", "cashflow", "money", 1, col((y) => y.fcf)),
    metric("ownerEarnings", "cashflow", "money", 1, col(ownerEarnings)),
    metric("buybacks", "cashflow", "money", 0, col((y) => y.buybacks)),
    metric("dividendsPaid", "cashflow", "money", 0, col((y) => y.dividendsPaid)),
    // DCF drivers — the inputs to build an unlevered (FCFF) discounted cash flow
    metric(
      "revenueGrowth",
      "dcf",
      "pct",
      1,
      ys.map((y, i) => (i > 0 ? div(sub(y.revenue, ys[i - 1].revenue), ys[i - 1].revenue) : null))
    ),
    metric("taxRate", "dcf", "pct", -1, col((y) => y.taxRate)),
    metric("nopat", "dcf", "money", 1, col(nopat)),
    metric("da", "dcf", "money", 0, col((y) => y.dep)),
    metric("capex", "dcf", "money", 0, col((y) => y.capex)),
    metric("changeNWC", "dcf", "money", 0, col((y) => y.changeNWC)),
    metric("reinvestment", "dcf", "money", 0, col(reinvestment)),
    metric("reinvestmentRate", "dcf", "pct", -1, col(reinvestmentRate)),
    metric("fcff", "dcf", "money", 1, col(fcff)),
    // Per share
    metric("eps", "perShare", "perShare", 1, col((y) => y.eps)),
    metric("dps", "perShare", "perShare", 1, col((y) => y.dps)),
    metric("bookValuePerShare", "perShare", "perShare", 1, col((y) => div(y.equity, y.shares))),
    metric("shares", "perShare", "shares", -1, col((y) => y.shares)),
  ];
}

/**
 * The point-in-time snapshot. CURRENCY DISCIPLINE: market-side figures
 * (market cap, provider EV, P/E, P/B) live in the TRADING currency;
 * statement-side figures (net debt, EBIT, FCF) live in the STATEMENT
 * currency. When the two differ (the ADR trap — PDD trades in USD, reports
 * in CNY), every value that would DIVIDE or ADD across the pair is omitted
 * (null) rather than computed as garbage — an honest gap beats a confident
 * wrong number (FOUNDATION: evidence discipline).
 */
function buildSnapshot(qs: Rec, latest: YearData | null, mismatch: boolean): FinancialsSnapshot {
  const price = (qs.price ?? {}) as Rec;
  const detail = (qs.summaryDetail ?? {}) as Rec;
  const stats = (qs.defaultKeyStatistics ?? {}) as Rec;
  const fd = (qs.financialData ?? {}) as Rec;

  const marketCap = num(price.marketCap) ?? num(detail.marketCap);
  const netDebt = latest?.netDebt ?? sub(num(fd.totalDebt), num(fd.totalCash));
  // Provider EV is internally consistent (trading currency); our fallback
  // (mkt cap + statement net debt) is legal only when currencies match.
  const enterpriseValue =
    num(stats.enterpriseValue) ??
    (!mismatch && marketCap != null && netDebt != null ? marketCap + netDebt : null);
  const fcf = latest?.fcf ?? num(fd.freeCashflow);
  const dteRaw = num(fd.debtToEquity);
  return {
    marketCap,
    enterpriseValue,
    netDebt,
    trailingPE: num(detail.trailingPE) ?? num(price.trailingPE),
    forwardPE: num(stats.forwardPE) ?? num(detail.forwardPE),
    priceToBook: num(stats.priceToBook),
    evToEbit: mismatch ? null : div(enterpriseValue, latest?.ebit ?? null),
    evToEbitda: num(stats.enterpriseToEbitda),
    evToRevenue:
      num(stats.enterpriseToRevenue) ??
      (mismatch ? null : div(enterpriseValue, latest?.revenue ?? null)),
    roe: (latest ? div(latest.netIncome, latest.equity) : null) ?? num(fd.returnOnEquity),
    roic: latest ? roic(latest) : null,
    grossMargin: num(fd.grossMargins),
    operatingMargin: num(fd.operatingMargins) ?? (latest ? div(latest.operatingIncome, latest.revenue) : null),
    netMargin: num(fd.profitMargins) ?? (latest ? div(latest.netIncome, latest.revenue) : null),
    debtToEquity:
      (latest ? div(latest.totalDebt, latest.equity) : null) ?? (dteRaw != null ? dteRaw / 100 : null),
    currentRatio: num(fd.currentRatio) ?? (latest ? div(latest.currentAssets, latest.currentLiabilities) : null),
    interestCoverage: latest ? div(latest.ebit, latest.interestExpense) : null,
    fcfYield: mismatch ? null : div(fcf, enterpriseValue),
  };
}

function buildDcfInputs(
  ys: YearData[],
  qs: Rec,
  snap: FinancialsSnapshot,
  mismatch: boolean
): DcfInputs {
  const stats = (qs.defaultKeyStatistics ?? {}) as Rec;
  const latest = ys.length ? ys[ys.length - 1] : null;
  const totalDebt = latest?.totalDebt ?? null;
  const mc = snap.marketCap;
  // Capital-structure weights mix market cap (trading currency) with balance-
  // sheet debt (statement currency) — meaningless across an ADR pair; omit.
  const capBase = !mismatch && mc != null && totalDebt != null ? mc + totalDebt : null;
  // Normalize over the recent window only — the deep filing history widens the
  // table without silently re-anchoring the DCF drivers to a different era.
  const win = ys.slice(-DCF_MEDIAN_WINDOW);
  const revGrowth = win.map((y, i) => (i > 0 ? div(sub(y.revenue, win[i - 1].revenue), win[i - 1].revenue) : null));
  return {
    beta: num(stats.beta),
    effectiveTaxRate: median(win.map((y) => y.taxRate)),
    costOfDebt: latest ? div(latest.interestExpense, latest.totalDebt) : null,
    equityWeight: div(mc, capBase),
    debtWeight: div(totalDebt, capBase),
    netDebt: snap.netDebt,
    sharesOutstanding: num(stats.sharesOutstanding) ?? latest?.shares ?? null,
    // Trading-currency figures don't belong in a statement-currency worksheet
    // when the pair differs — the snapshot carries them, properly labeled.
    marketCap: mismatch ? null : mc,
    enterpriseValue: mismatch ? null : snap.enterpriseValue,
    medianRevenueGrowth: median(revGrowth),
    medianOperatingMargin: median(win.map((y) => div(y.operatingIncome, y.revenue))),
    medianRoic: median(win.map(roic)),
    medianReinvestmentRate: median(win.map(reinvestmentRate)),
    medianFcffMargin: median(win.map((y) => div(fcff(y), y.revenue))),
  };
}

// ---------------------------------------------------------------------------
// EDGAR merge, quarterly columns, and the current-FY estimate column
// ---------------------------------------------------------------------------

/** Fiscal-year label a statement row files under (year of the period end). */
const labelOf = (r: Rec): string =>
  String(new Date(r.date as string | number | Date).getUTCFullYear());

const rowTime = (r: Rec): number => new Date(r.date as string | number | Date).getTime();

/** A row with none of the anchor figures isn't a statement — drop it. */
const hasSubstance = (y: YearData): boolean =>
  y.revenue != null || y.netIncome != null || y.equity != null || y.ocf != null;

/** Overlay `top`'s non-null fields onto `base` (provider beats EDGAR per field). */
function overlay(base: Rec | undefined, top: Rec | undefined): Rec {
  const out: Rec = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(top ?? {})) if (v != null) out[k] = v;
  return out;
}

/** Merge annual rows by fiscal-year label; the provider's fields win, EDGAR fills. */
function mergeAnnual(provider: Rec[], edgar: Rec[]): Rec[] {
  const byLabel = new Map<string, Rec>();
  for (const r of edgar) byLabel.set(labelOf(r), r);
  for (const r of provider) byLabel.set(labelOf(r), overlay(byLabel.get(labelOf(r)), r));
  return [...byLabel.values()]
    .sort((a, b) => rowTime(a) - rowTime(b))
    .filter((r) => hasSubstance(extractYear(r)));
}

/** Merge quarterly rows by period end (a few days of drift tolerated); provider fields win. */
function mergeQuarterly(provider: Rec[], edgar: Rec[]): Rec[] {
  const rows = edgar.map((r) => ({ t: rowTime(r), rec: r }));
  for (const p of provider) {
    const t = rowTime(p);
    const close = rows.find((r) => Math.abs(r.t - t) <= 10 * DAY_MS);
    if (close) close.rec = overlay(close.rec, p);
    else rows.push({ t, rec: p });
  }
  return rows
    .sort((a, b) => a.t - b.t)
    .map((r) => r.rec)
    .filter((r) => hasSubstance(extractYear(r)));
}

interface QuarterPoint {
  yd: YearData;
  endMs: number;
  fiscalYear: string;
  quarter: number; // slot 1–4 within the fiscal year
}

/**
 * Assign each quarterly row to its fiscal year — the first annual close on or
 * after the quarter's end — and to a slot 1–4 by distance from that close.
 * Quarters past the latest close belong to the in-progress fiscal year.
 */
function placeQuarters(qRecs: Rec[], annualRecs: Rec[]): QuarterPoint[] {
  if (annualRecs.length === 0) return [];
  const closes = annualRecs.map((r) => ({ label: labelOf(r), endMs: rowTime(r) }));
  const lastClose = closes[closes.length - 1];
  const points: QuarterPoint[] = [];
  for (const rec of qRecs) {
    const endMs = rowTime(rec);
    const close =
      closes.find((c) => c.endMs >= endMs - 6 * DAY_MS) ??
      { label: String(Number(lastClose.label) + 1), endMs: lastClose.endMs + 365 * DAY_MS };
    // A quarter that ends more than a fiscal year before its close belongs to
    // a year the record doesn't cover — drop rather than mislabel.
    if (endMs <= close.endMs - 360 * DAY_MS) continue;
    const quarter = Math.min(4, Math.max(1, 4 - Math.round((close.endMs - endMs) / (91.3 * DAY_MS))));
    points.push({ yd: extractYear(rec), endMs, fiscalYear: close.label, quarter });
  }
  // One row per (fiscal year, slot) — keep the latest end when filings drift.
  const bySlot = new Map<string, QuarterPoint>();
  for (const q of points) {
    const key = `${q.fiscalYear}|${q.quarter}`;
    const prev = bySlot.get(key);
    if (!prev || q.endMs > prev.endMs) bySlot.set(key, q);
  }
  return [...bySlot.values()].sort((a, b) => a.endMs - b.endMs);
}

/**
 * One quarter's slice of the metrics table. Only rows whose quarterly reading
 * is unit-compatible with the annual row carry values: quarter flows,
 * same-period margins/ratios, point-in-time balance items, and YoY revenue
 * growth. Annualized-rate rows (ROE/ROIC/ROA) are deliberately absent — a
 * single quarter's flow over a full balance sheet is not the number the
 * annual row prints, and an honest gap beats a confident wrong number.
 */
function quarterMetricValues(
  y: YearData,
  sameQuarterLastYear: YearData | null,
  fallbackShares: number | null
): Record<string, number | null> {
  const shares = y.shares ?? fallbackShares;
  return {
    revenue: y.revenue,
    operatingIncome: y.operatingIncome,
    netIncome: y.netIncome,
    grossMargin: div(y.grossProfit, y.revenue),
    operatingMargin: div(y.operatingIncome, y.revenue),
    netMargin: div(y.netIncome, y.revenue),
    equity: y.equity,
    totalDebt: y.totalDebt,
    netDebt: y.netDebt,
    cash: y.cash,
    debtToEquity: div(y.totalDebt, y.equity),
    currentRatio: div(y.currentAssets, y.currentLiabilities),
    interestCoverage: div(y.ebit, y.interestExpense),
    ocf: y.ocf,
    fcf: y.fcf,
    ownerEarnings: ownerEarnings(y),
    buybacks: y.buybacks,
    dividendsPaid: y.dividendsPaid,
    revenueGrowth: sameQuarterLastYear
      ? div(sub(y.revenue, sameQuarterLastYear.revenue), sameQuarterLastYear.revenue)
      : null,
    taxRate: y.taxRate,
    nopat: nopat(y),
    da: y.dep,
    capex: y.capex,
    changeNWC: y.changeNWC,
    reinvestment: reinvestment(y),
    reinvestmentRate: reinvestmentRate(y),
    fcff: fcff(y),
    eps: y.eps,
    dps: y.dps,
    bookValuePerShare: div(y.equity, shares),
    shares,
  };
}

/** Strict sum — null unless every element is present (never understate a year). */
const sumStrict = (vals: (number | null)[]): number | null =>
  vals.length > 0 && vals.every((v) => v != null)
    ? (vals as number[]).reduce((a, b) => a + b, 0)
    : null;

/** Don't project a fiscal year whose record has gone stale (delisted, halted filings). */
const ESTIMATE_MAX_AGE_DAYS = 550;

/**
 * Quarterly columns + the current-fiscal-year estimate column ("2026E").
 *
 * Reported quarters are carried for the latest QUARTER_FY_WINDOW closed
 * fiscal years plus the in-progress year. The in-progress year's missing
 * quarters are projected FROM ANNUAL TTM TRENDS: revenue = same quarter last
 * year × trailing-twelve-month YoY growth; every other flow line = projected
 * revenue × its TTM share of revenue (falling back to the latest fiscal
 * year's ratio); balance-sheet lines hold at the last reported quarter. The
 * estimate column is those reported + projected quarters summed, with derived
 * rows recomputed — and it is DISPLAY-ONLY: it never enters fiscalYears, the
 * DCF medians, or the cleansing bench.
 *
 * Exported for the unit tests (pure: statement rows in, columns out).
 */
export function buildQuartersAndEstimate(
  annualRecs: Rec[],
  qRecs: Rec[]
): { quarters: FiscalQuarter[]; estimate: FyEstimate | null } {
  const annualYs = annualRecs.map(extractYear);
  const placed = placeQuarters(qRecs, annualRecs);
  if (annualYs.length === 0 || placed.length === 0) return { quarters: [], estimate: null };

  const closedLabels = annualRecs.map(labelOf);
  const lastLabel = closedLabels[closedLabels.length - 1];
  const currentLabel = String(Number(lastLabel) + 1);
  const keepLabels = new Set([...closedLabels.slice(-QUARTER_FY_WINDOW), currentLabel]);
  const lastCloseMs = rowTime(annualRecs[annualRecs.length - 1]);

  const bySlot = new Map<string, QuarterPoint>();
  for (const q of placed) bySlot.set(`${q.fiscalYear}|${q.quarter}`, q);
  const sqlyOf = (fy: string, slot: number): QuarterPoint | null =>
    bySlot.get(`${Number(fy) - 1}|${slot}`) ?? null;

  const sharesByLabel = new Map(annualYs.map((y) => [y.year, y.shares]));
  const lastFY = annualYs[annualYs.length - 1];
  const fallbackShares = (fy: string): number | null =>
    sharesByLabel.get(fy) ?? lastFY.shares ?? null;

  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const quarters: FiscalQuarter[] = placed
    .filter((q) => keepLabels.has(q.fiscalYear))
    .map((q) => ({
      fiscalYear: q.fiscalYear,
      quarter: q.quarter,
      endDate: iso(q.endMs),
      estimated: false,
      values: quarterMetricValues(q.yd, sqlyOf(q.fiscalYear, q.quarter)?.yd ?? null, fallbackShares(q.fiscalYear)),
    }));

  // ---- the current-FY projection ----
  const staleDays = (Date.now() - lastCloseMs) / DAY_MS;
  if (staleDays > ESTIMATE_MAX_AGE_DAYS) return { quarters, estimate: null };

  // TTM windows over the reported quarters (whatever fiscal years they span).
  const ttmOf = (f: (y: YearData) => number | null, offset = 0): number | null => {
    const win = placed.slice(placed.length - 4 - offset, placed.length - offset);
    return win.length === 4 ? sumStrict(win.map((q) => f(q.yd))) : null;
  };
  const ttmRev = ttmOf((y) => y.revenue);
  const prevTtmRev = ttmOf((y) => y.revenue, 4);
  const prevFY = annualYs.length > 1 ? annualYs[annualYs.length - 2] : null;
  // The annual TTM trend for the top line; latest closed FY growth as fallback.
  const gRev =
    div(sub(ttmRev, prevTtmRev), prevTtmRev) ??
    (prevFY ? div(sub(lastFY.revenue, prevFY.revenue), prevFY.revenue) : null);
  if (gRev == null) return { quarters, estimate: null };

  /** A flow line's TTM share of revenue; the latest FY's share when TTM is short. */
  const ratioOf = (f: (y: YearData) => number | null): number | null =>
    div(ttmOf(f), ttmRev) ?? div(f(lastFY), lastFY.revenue);

  const reportedCurrent = placed.filter((q) => q.fiscalYear === currentLabel);
  const lastPoint = placed[placed.length - 1];
  const ttmTaxRate = median(placed.slice(-4).map((q) => q.yd.taxRate)) ?? lastFY.taxRate;
  const ttmDps = ttmOf((y) => y.dps);

  const slotYds = new Map<number, YearData>();
  for (const q of reportedCurrent) slotYds.set(q.quarter, q.yd);
  const estQuarters: FiscalQuarter[] = [];
  for (let slot = 1; slot <= 4; slot++) {
    if (slotYds.has(slot)) continue;
    const sqly = sqlyOf(currentLabel, slot);
    const revenue = sqly?.yd.revenue != null ? sqly.yd.revenue * (1 + gRev) : null;
    const scale = (f: (y: YearData) => number | null): number | null => {
      const r = ratioOf(f);
      if (revenue != null && r != null) return revenue * r;
      const base = sqly ? f(sqly.yd) : null;
      return base != null ? base * (1 + gRev) : null;
    };
    const anchor = lastPoint.yd; // balance sheet holds at the last reported quarter
    const ocf = scale((y) => y.ocf);
    const capex = scale((y) => y.capex);
    const netIncome = scale((y) => y.netIncome);
    const shares = anchor.shares ?? lastFY.shares;
    const yd: YearData = {
      year: currentLabel,
      revenue,
      grossProfit: scale((y) => y.grossProfit),
      operatingIncome: scale((y) => y.operatingIncome),
      netIncome,
      ebit: scale((y) => y.ebit),
      interestExpense: scale((y) => y.interestExpense),
      taxRate: ttmTaxRate,
      equity: anchor.equity,
      totalDebt: anchor.totalDebt,
      cash: anchor.cash,
      netDebt: anchor.netDebt,
      totalAssets: anchor.totalAssets,
      investedCapital: anchor.investedCapital,
      currentAssets: anchor.currentAssets,
      currentLiabilities: anchor.currentLiabilities,
      ocf,
      capex,
      changeNWC: scale((y) => y.changeNWC),
      fcf: ocf != null && capex != null ? ocf + capex : null,
      dep: scale((y) => y.dep),
      dividendsPaid: scale((y) => y.dividendsPaid),
      buybacks: scale((y) => y.buybacks),
      shares,
      eps: div(netIncome, shares),
      dps: ttmDps != null ? ttmDps / 4 : (sqly?.yd.dps ?? null),
    };
    slotYds.set(slot, yd);
    estQuarters.push({
      fiscalYear: currentLabel,
      quarter: slot,
      endDate: iso(sqly ? sqly.endMs + 365 * DAY_MS : lastCloseMs + Math.round(slot * 91.3 * DAY_MS)),
      estimated: true,
      values: quarterMetricValues(yd, sqly?.yd ?? null, shares),
    });
  }

  // The estimated fiscal year: four slots summed (flows), balance sheet from
  // the last reported quarter, derived rows recomputed via buildMetrics.
  const slots = [1, 2, 3, 4].map((s) => slotYds.get(s)!);
  const sum4 = (f: (y: YearData) => number | null) => sumStrict(slots.map(f));
  const anchor = lastPoint.yd;
  const niE = sum4((y) => y.netIncome);
  const sharesE = anchor.shares ?? lastFY.shares;
  const estYd: YearData = {
    year: currentLabel,
    revenue: sum4((y) => y.revenue),
    grossProfit: sum4((y) => y.grossProfit),
    operatingIncome: sum4((y) => y.operatingIncome),
    netIncome: niE,
    ebit: sum4((y) => y.ebit),
    interestExpense: sum4((y) => y.interestExpense),
    taxRate: ttmTaxRate,
    equity: anchor.equity,
    totalDebt: anchor.totalDebt,
    cash: anchor.cash,
    netDebt: anchor.netDebt,
    totalAssets: anchor.totalAssets,
    investedCapital: anchor.investedCapital,
    currentAssets: anchor.currentAssets,
    currentLiabilities: anchor.currentLiabilities,
    ocf: sum4((y) => y.ocf),
    capex: sum4((y) => y.capex),
    changeNWC: sum4((y) => y.changeNWC),
    fcf: sum4((y) => y.fcf),
    dep: sum4((y) => y.dep),
    dividendsPaid: sum4((y) => y.dividendsPaid),
    buybacks: sum4((y) => y.buybacks),
    shares: sharesE,
    eps: div(niE, sharesE),
    dps: sum4((y) => y.dps),
  };
  if (estYd.revenue == null && estYd.netIncome == null) return { quarters, estimate: null };

  const withEst = buildMetrics([...annualYs, estYd]);
  const estimate: FyEstimate = {
    fiscalYear: currentLabel,
    label: `${currentLabel}E`,
    values: Object.fromEntries(withEst.map((m) => [m.key, m.values[m.values.length - 1]])),
    method: "ttm-trend",
  };
  const all = [...quarters, ...estQuarters].sort(
    (a, b) => Number(a.fiscalYear) - Number(b.fiscalYear) || a.quarter - b.quarter
  );
  return { quarters: all, estimate };
}

// ---------------------------------------------------------------------------
// Public entry — cached, fail-soft
// ---------------------------------------------------------------------------

async function computeFinancials(symbol: string): Promise<TickerFinancials> {
  const p = provider();
  const [statements, qs, providerQuarters, facts, splits] = await Promise.all([
    p.statements(symbol, MAX_YEARS),
    p.summary(symbol),
    p.quarterlyStatements(symbol).catch(() => [] as Rec[]),
    fetchCompanyFacts(symbol), // fail-soft inside (null for non-SEC filers)
    yahooSplits(symbol),
  ]);
  const price = (qs.price ?? {}) as Rec;
  const profile = (qs.assetProfile ?? {}) as Rec;
  const fd = (qs.financialData ?? {}) as Rec;

  // THE ADR TRAP: the quote currency (price.currency — USD for PDD/BABA
  // ADRs) is NOT the currency the statements are reported in
  // (financialCurrency — CNY). The table shows statement data, so the
  // payload's `currency` is the STATEMENT currency; the quote currency
  // rides separately, and a mismatch disables every cross-currency combo.
  const tradingCurrency = ((price.currency ?? null) as string | null)?.toUpperCase() ?? null;
  const statementCurrency =
    ((statements[statements.length - 1]?.reportedCurrency ?? // FMP rows carry it
      fd.financialCurrency ?? // Yahoo's statement currency
      price.currency ??
      null) as string | null)?.toUpperCase() ?? null;
  const currencyMismatch =
    !!statementCurrency && !!tradingCurrency && statementCurrency !== tradingCurrency;
  if (currencyMismatch) {
    console.warn(
      `[scalae] ${symbol}: statements in ${statementCurrency}, listing trades in ${tradingCurrency} — cross-currency ratios omitted.`
    );
  }

  // The EDGAR supplement (SEC filers): filing history in the statement
  // currency deepens the annual record to ten-plus years and supplies the
  // five-year quarterly grid. Provider figures win on every overlap.
  let edgarAnnual: Rec[] = [];
  let edgarQuarterly: Rec[] = [];
  try {
    const edgar = extractStatements(facts, statementCurrency, splits);
    edgarAnnual = edgar?.annual ?? [];
    edgarQuarterly = edgar?.quarterly ?? [];
  } catch {
    /* provider data stands alone */
  }
  const annualRecs = mergeAnnual(statements, edgarAnnual).slice(-MAX_YEARS);
  const quarterRecs = mergeQuarterly(providerQuarters, edgarQuarterly);

  const years = annualRecs.map(extractYear);
  const latest = years.length ? years[years.length - 1] : null;
  const snapshot = buildSnapshot(qs, latest, currencyMismatch);
  const { quarters, estimate } = buildQuartersAndEstimate(annualRecs, quarterRecs);

  return {
    symbol,
    currency: statementCurrency,
    tradingCurrency,
    currencyMismatch,
    sector: (profile.sector ?? null) as string | null,
    industry: (profile.industry ?? null) as string | null,
    fiscalYears: years.map((y) => y.year),
    metrics: buildMetrics(years),
    quarters,
    estimate,
    snapshot,
    dcfInputs: buildDcfInputs(years, qs, snapshot, currencyMismatch),
    source: p.source,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Analyst-context summary + cache-only peek (hot paths must not trigger a fetch)
// ---------------------------------------------------------------------------

const m$ = (v: number | null, c: string | null): string => {
  if (v == null) return "n/a";
  const cc = c && c !== "USD" ? c + " " : "$";
  const a = Math.abs(v);
  const s =
    a >= 1e12 ? (a / 1e12).toFixed(2) + "T"
    : a >= 1e9 ? (a / 1e9).toFixed(1) + "B"
    : a >= 1e6 ? (a / 1e6).toFixed(0) + "M"
    : a.toFixed(0);
  return `${v < 0 ? "-" : ""}${cc}${s}`;
};
const nfmt = (v: number | null): string =>
  v == null ? "n/a" : Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + "B" : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(0) + "M" : String(Math.round(v));
const pf = (v: number | null): string => (v == null ? "n/a" : (v * 100).toFixed(1) + "%");
const xf = (v: number | null): string => (v == null ? "n/a" : v.toFixed(1) + "x");

/** A compact plain-text financials brief for the analyst's desk context. */
export function financialsSummary(f: TickerFinancials): string {
  const s = f.snapshot;
  const yrs = f.fiscalYears;
  const vals = (k: string) => f.metrics.find((m) => m.key === k)?.values ?? [];
  const first = (a: (number | null)[]) => a.find((v) => v != null) ?? null;
  const last = (a: (number | null)[]) => [...a].reverse().find((v) => v != null) ?? null;
  const rev = vals("revenue"), ni = vals("netIncome"), fcf = vals("fcf"), sh = vals("shares");
  const span = yrs.length ? `${yrs[0]}–${yrs[yrs.length - 1]}` : "n/a";
  const d = f.dcfInputs;
  // Market-side figures are quoted in the TRADING currency; statement figures
  // in the STATEMENT currency. Say so plainly whenever the two differ.
  const tc = f.tradingCurrency ?? f.currency;
  return [
    `FINANCIALS (${f.source}, ${yrs.length} FY ${span}${f.industry ? `; industry: ${f.industry}` : ""}; statement currency ${f.currency ?? "n/a"}):`,
    f.currencyMismatch
      ? `CURRENCY WARNING: statements are reported in ${f.currency} but the listing trades in ${tc}. Statement figures below are ${f.currency}; market cap/EV are ${tc}. Never mix the two, and never convert with an assumed FX rate.`
      : "",
    `Cost to own now: EV ${m$(s.enterpriseValue, tc)}, mkt cap ${m$(s.marketCap, tc)}, net debt ${m$(s.netDebt, f.currency)}, P/E ${xf(s.trailingPE)}, EV/EBIT ${xf(s.evToEbit)}, P/B ${xf(s.priceToBook)}, FCF yield ${pf(s.fcfYield)}.`,
    `Returns/health (latest FY): ROIC ${pf(s.roic)}, ROE ${pf(s.roe)}; margins gross ${pf(s.grossMargin)}/op ${pf(s.operatingMargin)}/net ${pf(s.netMargin)}; debt/equity ${s.debtToEquity != null ? s.debtToEquity.toFixed(2) : "n/a"}, interest cover ${xf(s.interestCoverage)}, current ratio ${s.currentRatio != null ? s.currentRatio.toFixed(2) : "n/a"}.`,
    `Trajectory over ${yrs.length}y: revenue ${m$(first(rev), f.currency)}→${m$(last(rev), f.currency)}, net income ${m$(first(ni), f.currency)}→${m$(last(ni), f.currency)}, latest FCF ${m$(last(fcf), f.currency)}, diluted shares ${nfmt(first(sh))}→${nfmt(last(sh))}.`,
    `DCF inputs (normalized): median rev growth ${pf(d.medianRevenueGrowth)}, median op margin ${pf(d.medianOperatingMargin)}, median ROIC ${pf(d.medianRoic)}, median reinvestment ${pf(d.medianReinvestmentRate)}; beta ${d.beta != null ? d.beta.toFixed(2) : "n/a"}, cost of debt ${pf(d.costOfDebt)}, eff. tax ${pf(d.effectiveTaxRate)}, equity/debt weights ${pf(d.equityWeight)}/${pf(d.debtWeight)}; bridge: net debt ${m$(d.netDebt, f.currency)}, shares ${nfmt(d.sharesOutstanding)}.`,
    f.estimate
      ? `Current-FY ESTIMATE (${f.estimate.label}, TTM-trend projection, display-only): revenue ${m$(f.estimate.values.revenue ?? null, f.currency)}, net income ${m$(f.estimate.values.netIncome ?? null, f.currency)}. Estimates are NOT reported figures — they sit outside the fiscal-year record and the cleansing bench never adjusts them.`
      : "",
    f.quarters?.length
      ? `Quarterly columns on the board: ${f.quarters.filter((q) => !q.estimated).length} reported + ${f.quarters.filter((q) => q.estimated).length} estimated quarters across FY${f.quarters[0].fiscalYear}–FY${f.quarters[f.quarters.length - 1].fiscalYear} (display detail; adjustments stay per fiscal year).`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Cache-only read — returns the stored financials (even if slightly stale) or
 * null, and NEVER triggers a Yahoo fetch. For hot paths (chat context) that
 * must not pay the multi-call fetch latency; the desk page warms the cache.
 */
export async function peekFinancials(symbol: string): Promise<TickerFinancials | null> {
  try {
    const cached = await getCachedFinancials(symbol.toUpperCase());
    return cached ? parseFinancials(cached.data) : null;
  } catch {
    return null;
  }
}

/**
 * Parse a cached financials blob, rejecting entries written before the current
 * schema (missing dcfInputs / source, the pre-currency-fix shape whose
 * `currency` was the QUOTE currency, or the pre-quarterly shape without the
 * quarters/estimate fields) — a deploy that changes semantics must never
 * serve the older shape; those simply refetch.
 */
function parseFinancials(json: string): TickerFinancials | null {
  try {
    const f = JSON.parse(json) as TickerFinancials;
    return f &&
      f.dcfInputs &&
      f.source &&
      Array.isArray(f.metrics) &&
      Array.isArray(f.quarters) &&
      f.estimate !== undefined &&
      typeof f.currencyMismatch === "boolean"
      ? f
      : null;
  } catch {
    return null;
  }
}

/**
 * Financials for a symbol — from the Postgres cache when fresh, otherwise
 * fetched from the active provider and cached. Returns null (never throws) when
 * the data can't be obtained, so callers can degrade gracefully. If a refetch
 * fails but a fresh-enough cache exists, the cached copy is served over nothing.
 */
export async function getFinancials(symbol: string): Promise<TickerFinancials | null> {
  const sym = symbol.toUpperCase();
  let cached: { data: string; fetchedAt: string } | null = null;
  try {
    cached = await getCachedFinancials(sym);
  } catch {
    cached = null;
  }
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < TTL_MS) {
    const f = parseFinancials(cached.data);
    if (f) return f;
    // else stale schema → fall through to refetch
  }

  try {
    const fresh = await withTimeout(computeFinancials(sym), FETCH_TIMEOUT_MS);
    // Only cache if we actually got statements — don't pin an empty result.
    if (fresh.fiscalYears.length > 0) {
      await setCachedFinancials(sym, JSON.stringify(fresh)).catch(() => {});
    }
    return fresh;
  } catch {
    // Refetch failed — serve a schema-valid cached copy if we have one.
    return cached ? parseFinancials(cached.data) : null;
  }
}
