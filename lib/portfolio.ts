import { listTrades } from "./db";
import {
  getDailyCloses,
  getFxCloses,
  getFxRate,
  getOptionMark,
  getPriceQuote,
} from "./market";
import {
  buildPositions,
  computeSeries,
  intrinsic,
  involvementLine,
  optionLabel,
  type SeriesInputs,
} from "./portfolio-math";
import type {
  PortfolioPayload,
  PortfolioSummary,
  Position,
  TickerInvolvement,
  Trade,
  ValuedPosition,
} from "./types";

export { involvementLine, optionLabel };

/**
 * Portfolio orchestration: fetch quotes/FX/option marks, value the ledger
 * (math in lib/portfolio-math.ts), and reconstruct the P&L series. Totals are
 * USD (multi-currency books can't be summed raw); positions stay native.
 * Options are marked at intrinsic value historically — time value needs an
 * options-history feed nobody gives away — and at live contract marks for
 * current values when available (labeled in the UI).
 */

const todayISO = () => new Date().toISOString().slice(0, 10);

async function valuePosition(
  p: Position,
  quote: { price: number | null; currency: string; changePercent: number | null } | null,
  fxToUsd: number
): Promise<ValuedPosition> {
  const currency = quote?.currency ?? "USD";
  const expired = p.kind === "option" && !!p.expiry && p.expiry < todayISO();

  let mark: number | null = null;
  let markSource: ValuedPosition["markSource"] = "none";
  let dayChangePct: number | null = null;

  if (p.kind === "stock") {
    mark = quote?.price ?? null;
    markSource = mark != null ? "live" : "none";
    dayChangePct = quote?.changePercent ?? null;
  } else if (expired) {
    mark = 0; // worthless expiry; record exercise/assignment as a closing trade
    markSource = "intrinsic";
  } else if (p.optionType && p.strike != null && p.expiry) {
    const live = await getOptionMark(p.symbol, p.optionType, p.strike, p.expiry);
    if (live != null) {
      mark = live;
      markSource = "live";
    } else if (quote?.price != null) {
      mark = intrinsic(p.optionType, quote.price, p.strike);
      markSource = "intrinsic";
    }
  }

  const mult = p.multiplier;
  const marketValue = mark != null ? p.qty * mark * mult : null;
  const unrealized = mark != null ? (mark - p.avgCost) * p.qty * mult : null;
  const denom = Math.abs(p.qty) * p.avgCost * mult;
  const unrealizedPct = unrealized != null && denom > 0 ? (unrealized / denom) * 100 : null;

  return {
    ...p,
    currency,
    mark,
    markSource,
    marketValue,
    unrealized,
    unrealizedPct,
    dayChangePct,
    expired,
    fxToUsd,
  };
}

/** Value every position for a set of trades (shared by portfolio + involvement). */
async function valueAll(trades: Trade[]): Promise<{ valued: ValuedPosition[]; unpriced: string[] }> {
  const positions = [...buildPositions(trades).values()];
  const symbols = [...new Set(positions.map((p) => p.symbol))];
  const quotes = new Map(
    await Promise.all(symbols.map(async (s) => [s, await getPriceQuote(s)] as const))
  );
  const currencies = [...new Set([...quotes.values()].map((q) => q?.currency ?? "USD"))];
  const fx = new Map(
    await Promise.all(currencies.map(async (c) => [c, (await getFxRate(c)) ?? 1] as const))
  );
  const valued = await Promise.all(
    positions.map((p) => {
      const q = quotes.get(p.symbol) ?? null;
      return valuePosition(p, q, fx.get(q?.currency ?? "USD") ?? 1);
    })
  );
  const unpriced = symbols.filter((s) => quotes.get(s)?.price == null);
  return { valued, unpriced };
}

async function seriesInputs(trades: Trade[], valued: ValuedPosition[]): Promise<SeriesInputs> {
  if (trades.length === 0) {
    return { trades, closes: new Map(), fx: new Map(), currencyOf: new Map() };
  }
  const firstDate = trades.map((t) => t.tradeDate.slice(0, 10)).sort()[0];
  const symbols = [...new Set(trades.map((t) => t.symbol))];
  const currencyOf = new Map<string, string>();
  for (const v of valued) currencyOf.set(v.symbol, v.currency);

  const closes = new Map<string, { date: string; close: number }[]>();
  await Promise.all(
    symbols.map(async (s) => {
      closes.set(s, await getDailyCloses(s, firstDate));
    })
  );
  const currencies = [...new Set([...currencyOf.values()])].filter(
    (c) => c && c.toUpperCase() !== "USD"
  );
  const fx = new Map<string, { date: string; close: number }[]>();
  await Promise.all(
    currencies.map(async (c) => {
      fx.set(c, await getFxCloses(c, firstDate));
    })
  );

  const liveMarks = new Map<string, number>();
  for (const v of valued) if (v.mark != null) liveMarks.set(v.key, v.mark);
  return { trades, closes, fx, currencyOf, liveMarks };
}

/** The full portfolio payload for /api/portfolio. */
export async function computePortfolio(): Promise<PortfolioPayload> {
  const trades = await listTrades();
  const { valued, unpriced } = await valueAll(trades);
  const series = computeSeries(await seriesInputs(trades, valued));

  const openPositions = valued.filter((v) => v.qty !== 0);
  const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
  const marketValue = sum(openPositions.map((v) => (v.marketValue ?? 0) * v.fxToUsd));
  const costBasis = sum(openPositions.map((v) => v.qty * v.avgCost * v.multiplier * v.fxToUsd));
  const unrealized = sum(openPositions.map((v) => (v.unrealized ?? 0) * v.fxToUsd));
  const realized = sum(valued.map((v) => v.realized * v.fxToUsd));
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const nonUsd = new Set(openPositions.filter((v) => v.currency !== "USD").map((v) => v.currency));

  const summary: PortfolioSummary = {
    marketValue,
    costBasis,
    unrealized,
    realized,
    totalPnl: unrealized + realized,
    dayChange: last && prev ? Math.round((last.pnl - prev.pnl) * 100) / 100 : null,
    currencyNote:
      nonUsd.size > 0
        ? `Totals in USD (${[...nonUsd].join(", ")} converted); positions shown in native currency.`
        : "All amounts USD.",
  };

  const stocks = openPositions
    .filter((v) => v.kind === "stock")
    .sort((a, b) => (b.marketValue ?? 0) * b.fxToUsd - (a.marketValue ?? 0) * a.fxToUsd);
  const options = openPositions
    .filter((v) => v.kind === "option")
    .sort((a, b) => (a.expiry ?? "").localeCompare(b.expiry ?? ""));

  return {
    summary,
    series,
    stocks,
    options,
    trades: [...trades].reverse(),
    unpriced,
  };
}

/** Involvement in one symbol (ticker desk card, watchlist badge, analyst context). */
export async function computeInvolvement(symbol: string): Promise<TickerInvolvement | null> {
  const trades = await listTrades(symbol.toUpperCase());
  if (trades.length === 0) return null;
  const { valued } = await valueAll(trades);
  const stock = valued.find((v) => v.kind === "stock" && v.qty !== 0) ?? null;
  const options = valued.filter((v) => v.kind === "option" && v.qty !== 0);
  const realized = valued.reduce((a, v) => a + v.realized, 0);
  if (!stock && options.length === 0 && realized === 0) return null;
  const held = [stock, ...options].filter(Boolean) as ValuedPosition[];
  const unrealized = held.some((v) => v.unrealized != null)
    ? held.reduce((a, v) => a + (v.unrealized ?? 0), 0)
    : null;
  return {
    symbol: symbol.toUpperCase(),
    currency: stock?.currency ?? options[0]?.currency ?? "USD",
    stock,
    options,
    realized,
    unrealized,
  };
}
