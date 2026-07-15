import YahooFinance from "yahoo-finance2";
import { getCachedFinancials, setCachedFinancials } from "./db";
import type {
  FinancialMetric,
  FinancialsSnapshot,
  MetricFormat,
  MetricGroup,
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

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchStatements(symbol: string, years: number): Promise<Rec[]> {
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

async function fetchSummary(symbol: string): Promise<Rec> {
  return (await yf.quoteSummary(
    symbol,
    {
      modules: ["price", "summaryDetail", "defaultKeyStatistics", "financialData", "assetProfile"],
    },
    { validateResult: false }
  )) as unknown as Rec;
}

async function fetchPeers(symbol: string): Promise<PeerMetric[]> {
  let syms: string[] = [];
  try {
    const rec = (await yf.recommendationsBySymbol(symbol)) as unknown as {
      recommendedSymbols?: { symbol?: string }[];
    };
    syms = (rec?.recommendedSymbols ?? [])
      .map((r) => r.symbol)
      .filter((s): s is string => !!s && s !== symbol)
      .slice(0, MAX_PEERS);
  } catch {
    return [];
  }
  const settled = await Promise.allSettled(
    syms.map(async (s): Promise<PeerMetric> => {
      const [qs, stmts] = await Promise.all([
        fetchSummary(s),
        fetchStatements(s, 2).catch(() => [] as Rec[]),
      ]);
      const fd = (qs.financialData ?? {}) as Rec;
      const price = (qs.price ?? {}) as Rec;
      const latest = stmts.length ? extractYear(stmts[stmts.length - 1]) : null;
      const dte = num(fd.debtToEquity); // Yahoo returns this as a percent (e.g. 154.9)
      return {
        symbol: s,
        name: (price.shortName ?? price.longName ?? null) as string | null,
        roe: num(fd.returnOnEquity) ?? (latest ? div(latest.netIncome, latest.equity) : null),
        roic: latest ? roic(latest) : null,
        netMargin: num(fd.profitMargins) ?? (latest ? div(latest.netIncome, latest.revenue) : null),
        operatingMargin:
          num(fd.operatingMargins) ?? (latest ? div(latest.operatingIncome, latest.revenue) : null),
        debtToEquity:
          latest && latest.equity ? div(latest.totalDebt, latest.equity) : dte != null ? dte / 100 : null,
      };
    })
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<PeerMetric> => r.status === "fulfilled")
    .map((r) => r.value);
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

// ---------------------------------------------------------------------------
// Public entry — cached, fail-soft
// ---------------------------------------------------------------------------

async function computeFinancials(symbol: string): Promise<TickerFinancials> {
  const [statements, qs, peers] = await Promise.all([
    fetchStatements(symbol, MAX_YEARS),
    fetchSummary(symbol),
    fetchPeers(symbol).catch(() => [] as PeerMetric[]),
  ]);
  const years = statements.map(extractYear);
  const latest = years.length ? years[years.length - 1] : null;
  const price = (qs.price ?? {}) as Rec;
  const profile = (qs.assetProfile ?? {}) as Rec;
  const fd = (qs.financialData ?? {}) as Rec;

  return {
    symbol,
    currency: (price.currency ?? fd.financialCurrency ?? null) as string | null,
    sector: (profile.sector ?? null) as string | null,
    industry: (profile.industry ?? null) as string | null,
    fiscalYears: years.map((y) => y.year),
    metrics: buildMetrics(years),
    snapshot: buildSnapshot(qs, latest),
    peers,
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
  const peers = f.peers.map((p) => `${p.symbol} (ROE ${pf(p.roe)}, ROIC ${pf(p.roic)})`).join("; ");
  const span = yrs.length ? `${yrs[0]}–${yrs[yrs.length - 1]}` : "n/a";
  return [
    `FINANCIALS (Yahoo, ${yrs.length} FY ${span}${f.industry ? `; industry: ${f.industry}` : ""}):`,
    `Cost to own now: EV ${m$(s.enterpriseValue, f.currency)}, mkt cap ${m$(s.marketCap, f.currency)}, net debt ${m$(s.netDebt, f.currency)}, P/E ${xf(s.trailingPE)}, EV/EBIT ${xf(s.evToEbit)}, P/B ${xf(s.priceToBook)}, FCF yield ${pf(s.fcfYield)}.`,
    `Returns/health (latest FY): ROIC ${pf(s.roic)}, ROE ${pf(s.roe)}; margins gross ${pf(s.grossMargin)}/op ${pf(s.operatingMargin)}/net ${pf(s.netMargin)}; debt/equity ${s.debtToEquity != null ? s.debtToEquity.toFixed(2) : "n/a"}, interest cover ${xf(s.interestCoverage)}, current ratio ${s.currentRatio != null ? s.currentRatio.toFixed(2) : "n/a"}.`,
    `Trajectory over ${yrs.length}y: revenue ${m$(first(rev), f.currency)}→${m$(last(rev), f.currency)}, net income ${m$(first(ni), f.currency)}→${m$(last(ni), f.currency)}, latest FCF ${m$(last(fcf), f.currency)}, diluted shares ${nfmt(first(sh))}→${nfmt(last(sh))}.`,
    peers ? `Peer returns: ${peers}.` : "",
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
    return cached ? (JSON.parse(cached.data) as TickerFinancials) : null;
  } catch {
    return null;
  }
}

/**
 * Financials for a symbol — from the Postgres cache when fresh, otherwise
 * fetched from Yahoo and cached. Returns null (never throws) when the data
 * can't be obtained, so callers can degrade gracefully. If a refetch fails but
 * a stale cache exists, the stale copy is served rather than nothing.
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
    try {
      return JSON.parse(cached.data) as TickerFinancials;
    } catch {
      /* fall through to refetch */
    }
  }

  try {
    const fresh = await withTimeout(computeFinancials(sym), FETCH_TIMEOUT_MS);
    // Only cache if we actually got statements — don't pin an empty result.
    if (fresh.fiscalYears.length > 0) {
      await setCachedFinancials(sym, JSON.stringify(fresh)).catch(() => {});
    }
    return fresh;
  } catch {
    // Refetch failed — serve stale cache if we have any, else give up softly.
    if (cached) {
      try {
        return JSON.parse(cached.data) as TickerFinancials;
      } catch {
        return null;
      }
    }
    return null;
  }
}
