import YahooFinance from "yahoo-finance2";
import type { Quote } from "./types";

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
