import YahooFinance from "yahoo-finance2";
import { getCachedFinancials, setCachedFinancials } from "./db";
import type {
  DcfInputs,
  FinancialMetric,
  FinancialsSnapshot,
  MetricFormat,
  MetricGroup,
  PeerComparison,
  PeerMetric,
  TickerFinancials,
} from "./types";

// The DCF/financials data layer. Statements come from Yahoo's
// `fundamentalsTimeSeries` (the legacy quoteSummary statement modules were
// gutted in Nov 2024); the point-in-time valuation snapshot comes from
// `quoteSummary`. Everything is fail-soft (returns null on error) and cached in
// Postgres per symbol — fundamentals move quarterly, so a multi-day TTL is
// plenty and keeps these heavy calls off the desk page's fast poll loop.

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** Annual statements move quarterly — refresh at most every few days. */
const TTL_MS = 3 * 24 * 3600_000;
const MAX_YEARS = 10;
const MAX_PEERS = 5;
/** Overall wall-clock cap on the (multi-call) Yahoo fetch. */
const FETCH_TIMEOUT_MS = 60_000;

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
  summary(symbol: string): Promise<Rec>; // Yahoo-shaped sub-objects
  peers(symbol: string): Promise<string[]>; // candidate peer symbols
}

// ---- Yahoo ----
async function yahooStatements(symbol: string, years: number): Promise<Rec[]> {
  const period1 = new Date(Date.now() - (years + 1) * 365 * 864e5);
  const res = (await yf.fundamentalsTimeSeries(
    symbol,
    { period1, type: "annual", module: "all" },
    { validateResult: false }
  )) as unknown as Rec[];
  const rows = (res ?? []).filter((r) => r && r.date != null);
  rows.sort(
    (a, b) =>
      new Date(a.date as string | number | Date).getTime() -
      new Date(b.date as string | number | Date).getTime()
  );
  return rows.slice(-years);
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
async function fmpStatements(symbol: string, years: number): Promise<Rec[]> {
  const [inc, bal, cf, km] = await Promise.all([
    fmpGet(`/v3/income-statement/${symbol}?period=annual&limit=${years}`),
    fmpGet(`/v3/balance-sheet-statement/${symbol}?period=annual&limit=${years}`),
    fmpGet(`/v3/cash-flow-statement/${symbol}?period=annual&limit=${years}`),
    fmpGet(`/v3/key-metrics/${symbol}?period=annual&limit=${years}`).catch(() => [] as Rec[]),
  ]);
  const yrKey = (r: Rec) => String(r.calendarYear ?? (r.date as string | undefined)?.slice(0, 4) ?? "");
  const index = (arr: Rec[]) => new Map(arr.map((r) => [yrKey(r), r]));
  const bM = index(bal), cM = index(cf), kM = index(km);
  const rows: Rec[] = inc.map((i) => {
    const yr = yrKey(i);
    const b = bM.get(yr) ?? {};
    const c = cM.get(yr) ?? {};
    const k = kM.get(yr) ?? {};
    return {
      date: i.date,
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
  return rows.slice(-years);
}

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

function buildSnapshot(qs: Rec, latest: YearData | null): FinancialsSnapshot {
  const price = (qs.price ?? {}) as Rec;
  const detail = (qs.summaryDetail ?? {}) as Rec;
  const stats = (qs.defaultKeyStatistics ?? {}) as Rec;
  const fd = (qs.financialData ?? {}) as Rec;

  const marketCap = num(price.marketCap) ?? num(detail.marketCap);
  const netDebt = latest?.netDebt ?? sub(num(fd.totalDebt), num(fd.totalCash));
  const enterpriseValue =
    num(stats.enterpriseValue) ?? (marketCap != null && netDebt != null ? marketCap + netDebt : null);
  const fcf = latest?.fcf ?? num(fd.freeCashflow);
  const dteRaw = num(fd.debtToEquity);
  return {
    marketCap,
    enterpriseValue,
    netDebt,
    trailingPE: num(detail.trailingPE) ?? num(price.trailingPE),
    forwardPE: num(stats.forwardPE) ?? num(detail.forwardPE),
    priceToBook: num(stats.priceToBook),
    evToEbit: div(enterpriseValue, latest?.ebit ?? null),
    evToEbitda: num(stats.enterpriseToEbitda),
    evToRevenue: num(stats.enterpriseToRevenue) ?? div(enterpriseValue, latest?.revenue ?? null),
    roe: (latest ? div(latest.netIncome, latest.equity) : null) ?? num(fd.returnOnEquity),
    roic: latest ? roic(latest) : null,
    grossMargin: num(fd.grossMargins),
    operatingMargin: num(fd.operatingMargins) ?? (latest ? div(latest.operatingIncome, latest.revenue) : null),
    netMargin: num(fd.profitMargins) ?? (latest ? div(latest.netIncome, latest.revenue) : null),
    debtToEquity:
      (latest ? div(latest.totalDebt, latest.equity) : null) ?? (dteRaw != null ? dteRaw / 100 : null),
    currentRatio: num(fd.currentRatio) ?? (latest ? div(latest.currentAssets, latest.currentLiabilities) : null),
    interestCoverage: latest ? div(latest.ebit, latest.interestExpense) : null,
    fcfYield: div(fcf, enterpriseValue),
  };
}

function buildDcfInputs(ys: YearData[], qs: Rec, snap: FinancialsSnapshot): DcfInputs {
  const stats = (qs.defaultKeyStatistics ?? {}) as Rec;
  const latest = ys.length ? ys[ys.length - 1] : null;
  const totalDebt = latest?.totalDebt ?? null;
  const mc = snap.marketCap;
  const capBase = mc != null && totalDebt != null ? mc + totalDebt : null;
  const revGrowth = ys.map((y, i) => (i > 0 ? div(sub(y.revenue, ys[i - 1].revenue), ys[i - 1].revenue) : null));
  return {
    beta: num(stats.beta),
    effectiveTaxRate: median(ys.map((y) => y.taxRate)),
    costOfDebt: latest ? div(latest.interestExpense, latest.totalDebt) : null,
    equityWeight: div(mc, capBase),
    debtWeight: div(totalDebt, capBase),
    netDebt: snap.netDebt,
    sharesOutstanding: num(stats.sharesOutstanding) ?? latest?.shares ?? null,
    marketCap: mc,
    enterpriseValue: snap.enterpriseValue,
    medianRevenueGrowth: median(revGrowth),
    medianOperatingMargin: median(ys.map((y) => div(y.operatingIncome, y.revenue))),
    medianRoic: median(ys.map(roic)),
    medianReinvestmentRate: median(ys.map(reinvestmentRate)),
    medianFcffMargin: median(ys.map((y) => div(fcff(y), y.revenue))),
  };
}

// ---------------------------------------------------------------------------
// Public entry — cached, fail-soft
// ---------------------------------------------------------------------------

async function computeFinancials(symbol: string): Promise<TickerFinancials> {
  const p = provider();
  const [statements, qs] = await Promise.all([
    p.statements(symbol, MAX_YEARS),
    p.summary(symbol),
  ]);
  const years = statements.map(extractYear);
  const latest = years.length ? years[years.length - 1] : null;
  const price = (qs.price ?? {}) as Rec;
  const profile = (qs.assetProfile ?? {}) as Rec;
  const fd = (qs.financialData ?? {}) as Rec;
  const snapshot = buildSnapshot(qs, latest);

  return {
    symbol,
    currency: (price.currency ?? fd.financialCurrency ?? null) as string | null,
    sector: (profile.sector ?? null) as string | null,
    industry: (profile.industry ?? null) as string | null,
    fiscalYears: years.map((y) => y.year),
    metrics: buildMetrics(years),
    snapshot,
    dcfInputs: buildDcfInputs(years, qs, snapshot),
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
  return [
    `FINANCIALS (${f.source}, ${yrs.length} FY ${span}${f.industry ? `; industry: ${f.industry}` : ""}):`,
    `Cost to own now: EV ${m$(s.enterpriseValue, f.currency)}, mkt cap ${m$(s.marketCap, f.currency)}, net debt ${m$(s.netDebt, f.currency)}, P/E ${xf(s.trailingPE)}, EV/EBIT ${xf(s.evToEbit)}, P/B ${xf(s.priceToBook)}, FCF yield ${pf(s.fcfYield)}.`,
    `Returns/health (latest FY): ROIC ${pf(s.roic)}, ROE ${pf(s.roe)}; margins gross ${pf(s.grossMargin)}/op ${pf(s.operatingMargin)}/net ${pf(s.netMargin)}; debt/equity ${s.debtToEquity != null ? s.debtToEquity.toFixed(2) : "n/a"}, interest cover ${xf(s.interestCoverage)}, current ratio ${s.currentRatio != null ? s.currentRatio.toFixed(2) : "n/a"}.`,
    `Trajectory over ${yrs.length}y: revenue ${m$(first(rev), f.currency)}→${m$(last(rev), f.currency)}, net income ${m$(first(ni), f.currency)}→${m$(last(ni), f.currency)}, latest FCF ${m$(last(fcf), f.currency)}, diluted shares ${nfmt(first(sh))}→${nfmt(last(sh))}.`,
    `DCF inputs (normalized): median rev growth ${pf(d.medianRevenueGrowth)}, median op margin ${pf(d.medianOperatingMargin)}, median ROIC ${pf(d.medianRoic)}, median reinvestment ${pf(d.medianReinvestmentRate)}; beta ${d.beta != null ? d.beta.toFixed(2) : "n/a"}, cost of debt ${pf(d.costOfDebt)}, eff. tax ${pf(d.effectiveTaxRate)}, equity/debt weights ${pf(d.equityWeight)}/${pf(d.debtWeight)}; bridge: net debt ${m$(d.netDebt, f.currency)}, shares ${nfmt(d.sharesOutstanding)}.`,
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
 * schema (missing dcfInputs / source) — a deploy that adds fields must never
 * serve an older shape the UI would choke on; those simply refetch.
 */
function parseFinancials(json: string): TickerFinancials | null {
  try {
    const f = JSON.parse(json) as TickerFinancials;
    return f && f.dcfInputs && f.source && Array.isArray(f.metrics) ? f : null;
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
