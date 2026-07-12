import YahooFinance from "yahoo-finance2";
import type { Quote, RichQuote } from "./types";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface SearchHit {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export async function searchTickers(q: string): Promise<SearchHit[]> {
  try {
    const res = await yf.search(q, { quotesCount: 8, newsCount: 0 });
    const quotes = res.quotes as Array<Record<string, unknown>>;
    return quotes
      .filter((x) => typeof x.symbol === "string" && x.symbol)
      .filter((x) => {
        const t = String(x.quoteType ?? "").toUpperCase();
        return t === "EQUITY" || t === "ETF";
      })
      .slice(0, 6)
      .map((x) => ({
        symbol: String(x.symbol),
        name: String(x.shortname ?? x.longname ?? x.symbol),
        exchange: String(x.exchDisp ?? ""),
        type: String(x.quoteType ?? ""),
      }));
  } catch {
    return [];
  }
}

/** Validate a symbol and return its display name, or null if unknown. */
export async function resolveSymbol(symbol: string): Promise<string | null> {
  try {
    const q = await yf.quote(symbol);
    if (!q || !q.symbol) return null;
    return q.longName || q.shortName || q.symbol;
  } catch {
    return null;
  }
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  try {
    const [q, spark] = await Promise.all([yf.quote(symbol), getSpark(symbol)]);
    if (!q) return null;
    return {
      symbol,
      name: q.longName || q.shortName || symbol,
      price: q.regularMarketPrice ?? null,
      changePercent: q.regularMarketChangePercent ?? null,
      currency: q.currency ?? null,
      marketCap: q.marketCap ?? null,
      trailingPE: q.trailingPE ?? null,
      marketState: q.marketState ?? null,
      spark,
    };
  } catch {
    return null;
  }
}

async function getSpark(symbol: string): Promise<number[]> {
  try {
    const c = await yf.chart(symbol, {
      period1: new Date(Date.now() - 32 * 3600_000),
      interval: "15m",
    });
    return c.quotes
      .map((p) => p.close)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Portfolio market data: light quotes, daily closes, FX, option marks.
// Small in-process TTL caches — /api/portfolio is polled and re-valuates
// everything on each call.
// ---------------------------------------------------------------------------

export interface PriceQuote {
  price: number | null;
  currency: string;
  changePercent: number | null;
}

const caches = ((globalThis as unknown as {
  __scalaeMkt?: Map<string, { v: unknown; at: number }>;
}).__scalaeMkt ??= new Map<string, { v: unknown; at: number }>());

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = caches.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await fn();
  // Don't cache nulls long — retry sooner.
  caches.set(key, { v, at: v == null ? Date.now() - ttlMs + 30_000 : Date.now() });
  return v;
}

/** Price/currency/day-change only (no spark) — cheap enough to batch. */
export async function getPriceQuote(symbol: string): Promise<PriceQuote | null> {
  return cached(`pq:${symbol}`, 60_000, async () => {
    try {
      const q = await yf.quote(symbol);
      if (!q) return null;
      return {
        price: q.regularMarketPrice ?? null,
        currency: q.currency ?? "USD",
        changePercent: q.regularMarketChangePercent ?? null,
      };
    } catch {
      return null;
    }
  });
}

/** Daily closes (ISO date → close), ascending, from `fromISO` to today. */
export async function getDailyCloses(
  symbol: string,
  fromISO: string
): Promise<{ date: string; close: number }[]> {
  return cached(`cl:${symbol}:${fromISO}`, 15 * 60_000, async () => {
    try {
      const c = await yf.chart(symbol, {
        period1: new Date(fromISO),
        interval: "1d",
      });
      const out: { date: string; close: number }[] = [];
      for (const p of c.quotes) {
        if (typeof p.close === "number" && Number.isFinite(p.close) && p.date) {
          out.push({ date: new Date(p.date).toISOString().slice(0, 10), close: p.close });
        }
      }
      return out;
    } catch {
      return [];
    }
  });
}

/**
 * Dividend events (ex-date, per-share amount) since `fromISO`, ascending.
 * Cached long — dividend calendars move slowly.
 */
export async function getDividendEvents(
  symbol: string,
  fromISO: string
): Promise<{ date: string; amount: number }[]> {
  return cached(`dv:${symbol}:${fromISO}`, 6 * 3600_000, async () => {
    try {
      const c = await yf.chart(symbol, {
        period1: new Date(fromISO),
        interval: "1d",
        events: "div",
      });
      const divs = (c as { events?: { dividends?: { date: Date | number; amount: number }[] } })
        .events?.dividends;
      if (!divs) return [];
      return divs
        .filter((d) => typeof d.amount === "number" && Number.isFinite(d.amount) && d.amount > 0)
        .map((d) => ({
          date: new Date(typeof d.date === "number" ? d.date * 1000 : d.date)
            .toISOString()
            .slice(0, 10),
          amount: d.amount,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      return [];
    }
  });
}

/** Live CUR→USD rate (1 for USD; null if unavailable). */
export async function getFxRate(currency: string): Promise<number | null> {
  if (!currency || currency.toUpperCase() === "USD") return 1;
  // LSE quotes arrive in pence ("GBp"): 1 GBp = GBP/100.
  if (currency === "GBp") {
    const q = await getPriceQuote("GBPUSD=X");
    return q?.price != null ? q.price / 100 : null;
  }
  const q = await getPriceQuote(`${currency.toUpperCase()}USD=X`);
  return q?.price ?? null;
}

/** Historical CUR→USD daily rates from `fromISO` (empty for USD/unavailable). */
export async function getFxCloses(
  currency: string,
  fromISO: string
): Promise<{ date: string; close: number }[]> {
  if (!currency || currency.toUpperCase() === "USD") return [];
  if (currency === "GBp") {
    const rows = await getDailyCloses("GBPUSD=X", fromISO);
    return rows.map((r) => ({ date: r.date, close: r.close / 100 }));
  }
  return getDailyCloses(`${currency.toUpperCase()}USD=X`, fromISO);
}

/**
 * Brokerage-grade quote for the trade ticket: last/bid/ask, ranges, volume,
 * valuation basics and a sparkline — everything a broker shows before an
 * order. Cached briefly; null when the symbol has no market data.
 */
export async function getQuoteCard(symbol: string): Promise<RichQuote | null> {
  return cached(`rq:${symbol}`, 45_000, async () => {
    try {
      const [q, spark] = await Promise.all([
        yf.quote(symbol),
        getSpark(symbol).catch(() => [] as number[]),
      ]);
      if (!q || q.regularMarketPrice == null) return null;
      const divFrac =
        q.trailingAnnualDividendYield ??
        (typeof q.dividendYield === "number" ? q.dividendYield / 100 : null);
      return {
        symbol: q.symbol ?? symbol,
        name: q.longName || q.shortName || symbol,
        exchange: q.fullExchangeName ?? null,
        currency: q.currency ?? "USD",
        marketState: q.marketState ?? null,
        price: q.regularMarketPrice ?? null,
        change: q.regularMarketChange ?? null,
        changePercent: q.regularMarketChangePercent ?? null,
        previousClose: q.regularMarketPreviousClose ?? null,
        open: q.regularMarketOpen ?? null,
        bid: q.bid ?? null,
        ask: q.ask ?? null,
        bidSize: q.bidSize ?? null,
        askSize: q.askSize ?? null,
        dayLow: q.regularMarketDayLow ?? null,
        dayHigh: q.regularMarketDayHigh ?? null,
        wk52Low: q.fiftyTwoWeekLow ?? null,
        wk52High: q.fiftyTwoWeekHigh ?? null,
        volume: q.regularMarketVolume ?? null,
        avgVolume: q.averageDailyVolume3Month ?? null,
        marketCap: q.marketCap ?? null,
        trailingPE: q.trailingPE ?? null,
        epsTTM: q.epsTrailingTwelveMonths ?? null,
        dividendYieldPct: divFrac != null ? divFrac * 100 : null,
        spark,
      } satisfies RichQuote;
    } catch {
      return null;
    }
  });
}

/** Yahoo/OCC option contract symbol, e.g. AAPL260116C00200000. */
export function occSymbol(
  underlying: string,
  optionType: "call" | "put",
  strike: number,
  expiryISO: string
): string {
  const root = underlying.toUpperCase();
  const ymd = expiryISO.slice(2, 10).replace(/-/g, "");
  const k = String(Math.round(strike * 1000)).padStart(8, "0");
  return `${root}${ymd}${optionType === "call" ? "C" : "P"}${k}`;
}

/**
 * Live market mark for an option contract (per share), or null. Works for
 * US-listed contracts; non-US underlyings fall back to intrinsic upstream.
 */
export async function getOptionMark(
  underlying: string,
  optionType: "call" | "put",
  strike: number,
  expiryISO: string
): Promise<number | null> {
  const sym = occSymbol(underlying, optionType, strike, expiryISO);
  return cached(`om:${sym}`, 5 * 60_000, async () => {
    try {
      const q = await yf.quote(sym);
      const p = q?.regularMarketPrice;
      return typeof p === "number" && Number.isFinite(p) ? p : null;
    } catch {
      return null;
    }
  });
}

/** One-line valuation context for prompts, e.g. "Price $311.61 (+0.96% today), mkt cap $4.6T, trailing P/E 33.8". */
export function quoteLine(q: Quote | null): string {
  if (!q || q.price == null) return "No market quote available.";
  const parts = [`Price ${q.currency === "USD" || !q.currency ? "$" : q.currency + " "}${q.price.toFixed(2)}`];
  if (q.changePercent != null) parts.push(`${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}% today`);
  if (q.marketCap) parts.push(`market cap ${humanCap(q.marketCap)}`);
  if (q.trailingPE) parts.push(`trailing P/E ${q.trailingPE.toFixed(1)}`);
  return parts.join(", ") + ".";
}

function humanCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n}`;
}
