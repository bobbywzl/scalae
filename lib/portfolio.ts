import {
  dripEnabled,
  getInitialCapital,
  listDividends,
  listOpenOrders,
  listOrderHistory,
  listTrades,
} from "./db";
import {
  getDailyCloses,
  getFxCloses,
  getFxRate,
  getOptionMark,
  getPriceQuote,
} from "./market";
import { pendingDividends } from "./orders";
import {
  buildPositions,
  computeSeries,
  intrinsic,
  involvementLine,
  optionLabel,
  type SeriesInputs,
} from "./portfolio-math";
import type {
  DividendReceipt,
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

async function seriesInputs(
  trades: Trade[],
  valued: ValuedPosition[],
  dividends: DividendReceipt[] = []
): Promise<SeriesInputs> {
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
  const cashEvents = dividends.map((d) => ({
    date: d.exDate,
    amount: d.amount,
    currency: d.currency,
  }));
  return { trades, closes, fx, currencyOf, liveMarks, cashEvents };
}

/** The full portfolio payload for /api/portfolio. */
export async function computePortfolio(userId: string): Promise<PortfolioPayload> {
  const [trades, dividends, openOrders, orderHistory, initialCapital] = await Promise.all([
    listTrades(userId),
    listDividends(userId),
    listOpenOrders(userId),
    listOrderHistory(userId),
    getInitialCapital(userId),
  ]);
  const { valued, unpriced } = await valueAll(trades);
  const series = computeSeries(await seriesInputs(trades, valued, dividends));

  // Detected-but-unapplied dividends and per-symbol DRIP settings for the UI.
  const appliedKeys = new Set(dividends.map((d) => `${d.symbol}|${d.exDate}`));
  const pending = await pendingDividends(userId, appliedKeys).catch(() => []);
  const heldSymbols = [...new Set(valued.filter((v) => v.kind === "stock" && v.qty !== 0).map((v) => v.symbol))];
  const drip: Record<string, boolean> = {};
  await Promise.all(
    heldSymbols.map(async (s) => {
      drip[s] = await dripEnabled(userId, s);
    })
  );

  const openPositions = valued.filter((v) => v.qty !== 0);
  const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
  const marketValue = sum(openPositions.map((v) => (v.marketValue ?? 0) * v.fxToUsd));
  const costBasis = sum(openPositions.map((v) => v.qty * v.avgCost * v.multiplier * v.fxToUsd));
  const unrealized = sum(openPositions.map((v) => (v.unrealized ?? 0) * v.fxToUsd));
  const realized = sum(valued.map((v) => v.realized * v.fxToUsd));
  // Convert dividend receipts by their own currency — a receipt can outlive
  // its position, so the valued-position FX map is not a safe fallback.
  const divCurrencies = [...new Set(dividends.map((d) => d.currency).filter((c) => c !== "USD"))];
  const divFx = new Map<string, number | null>(
    await Promise.all(divCurrencies.map(async (c) => [c, await getFxRate(c)] as const))
  );
  // USD per receipt — summed both in total and per symbol (the rows note each
  // name's dividend cash; the summary keeps the book-level figure).
  const dividendsBySymbol: Record<string, number> = {};
  const dividendsUsd = sum(
    dividends.map((d) => {
      let usd: number;
      if (d.currency === "USD") usd = d.amount;
      else {
        const rate = divFx.get(d.currency);
        if (rate == null) {
          console.warn(`[scalae] no FX rate for ${d.currency} dividend on ${d.symbol} — excluded from USD total`);
          return 0;
        }
        usd = d.amount * rate;
      }
      dividendsBySymbol[d.symbol] = (dividendsBySymbol[d.symbol] ?? 0) + usd;
      return usd;
    })
  );
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const nonUsd = new Set(openPositions.filter((v) => v.currency !== "USD").map((v) => v.currency));

  const summary: PortfolioSummary = {
    marketValue,
    costBasis,
    unrealized,
    realized,
    dividends: dividendsUsd,
    totalPnl: unrealized + realized + dividendsUsd,
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

  // Cash = initial capital + cumulative ledger cashflow. The series identity
  // P&L = equity + cashflow makes that (last.pnl − last.value) — no new math.
  const cashflowToDate = last ? last.pnl - last.value : 0;
  const cash = initialCapital != null ? initialCapital + cashflowToDate : null;

  return {
    summary,
    series,
    stocks,
    options,
    trades: [...trades].reverse(),
    openOrders,
    orderHistory,
    pendingDividends: pending,
    dividends,
    dividendsBySymbol,
    drip,
    initialCapital,
    cash,
    unpriced,
  };
}

/** Involvement in one symbol (ticker desk card, watchlist badge, analyst context). */
export async function computeInvolvement(userId: string, symbol: string): Promise<TickerInvolvement | null> {
  const sym = symbol.toUpperCase();
  const trades = await listTrades(userId, sym);
  if (trades.length === 0) return null;
  const [{ valued }, allDividends, drip] = await Promise.all([
    valueAll(trades),
    listDividends(userId).catch(() => []),
    dripEnabled(userId, sym).catch(() => false),
  ]);
  const stock = valued.find((v) => v.kind === "stock" && v.qty !== 0) ?? null;
  const options = valued.filter((v) => v.kind === "option" && v.qty !== 0);
  const realized = valued.reduce((a, v) => a + v.realized, 0);
  // Native currency — a symbol's receipts share its trading currency.
  const dividends = allDividends
    .filter((d) => d.symbol === sym)
    .reduce((a, d) => a + d.amount, 0);
  if (!stock && options.length === 0 && realized === 0 && dividends === 0) return null;
  const held = [stock, ...options].filter(Boolean) as ValuedPosition[];
  const unrealized = held.some((v) => v.unrealized != null)
    ? held.reduce((a, v) => a + (v.unrealized ?? 0), 0)
    : null;
  const currency = stock?.currency ?? options[0]?.currency ?? "USD";
  // Honest FX: null when unavailable (valueAll's fxToUsd defaults to 1, which
  // would render a WRONG "USD" figure for a non-USD name — never guess here).
  const fxToUsd = currency === "USD" ? 1 : await getFxRate(currency).catch(() => null);
  return {
    symbol: sym,
    currency,
    stock,
    options,
    realized,
    unrealized,
    dividends,
    drip,
    fxToUsd,
  };
}
