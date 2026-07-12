import {
  dripEnabled,
  insertDividend,
  insertOrder,
  insertTrade,
  listOpenOrders,
  listTrades,
  markOrderFilled,
  setOrderStatus,
} from "./db";
import { getDailyCloses, getDividendEvents, getPriceQuote } from "./market";
import { fillDecision, fillNote, validateOrder } from "./order-math";
import { sharesHeldOn } from "./portfolio-math";
import type { DividendReceipt, Order, OrderInput, PendingDividend, Trade } from "./types";

export { fillDecision, fillNote, validateOrder };

/**
 * Paper order execution + dividend accounting. Orders are checked against
 * LIVE quotes whenever the portfolio is loaded or an order is placed — there
 * is no exchange behind this, so fills are simulated: a working order fills
 * at the current market price once it crosses the trigger, and the fill is
 * recorded as an ordinary ledger trade. Honest by construction: no intraday
 * fills you couldn't have gotten, but also no guarantee your real broker
 * would have filled at the same price.
 */

const round = (v: number, dp = 4) => Math.round(v * 10 ** dp) / 10 ** dp;
const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Order orchestration (pure decisions live in lib/order-math.ts)
// ---------------------------------------------------------------------------

async function executeFill(order: Order, price: number): Promise<Order> {
  const trade = await insertTrade({
    symbol: order.symbol,
    kind: "stock",
    side: order.side,
    quantity: order.quantity,
    price,
    fees: 0,
    tradeDate: todayISO(),
    optionType: null,
    strike: null,
    expiry: null,
    multiplier: 1,
    note: order.note ? `${order.note} · ${fillNote(order)}` : fillNote(order),
  });
  await markOrderFilled(order.id, price, trade.id);
  return { ...order, status: "filled", fillPrice: price, tradeId: trade.id, filledAt: trade.createdAt };
}

/**
 * Sweep working orders against live quotes: expire yesterday's day orders,
 * fill anything whose trigger the market has crossed. Runs on every portfolio
 * load and after placing an order. Returns the orders that just filled.
 */
export async function sweepOpenOrders(): Promise<Order[]> {
  const open = await listOpenOrders();
  if (open.length === 0) return [];
  const today = todayISO();
  const fills: Order[] = [];
  for (const o of open) {
    if (o.tif === "day" && o.placedAt.slice(0, 10) < today) {
      await setOrderStatus(o.id, "expired");
      continue;
    }
    const q = await getPriceQuote(o.symbol);
    if (q?.price == null) continue;
    const d = fillDecision(o, q.price);
    if (d.fills) fills.push(await executeFill(o, d.price));
  }
  return fills;
}

/**
 * Place an order. Market orders execute immediately at the live quote;
 * marketable limit/stop orders fill on the spot too; everything else stays
 * working until a sweep crosses it.
 */
export async function placeOrder(
  input: OrderInput
): Promise<{ order: Order; error?: undefined } | { order?: undefined; error: string; status: number }> {
  const err = validateOrder(input);
  if (err) return { error: err, status: 400 };
  const symbol = input.symbol.trim().toUpperCase();
  const quote = await getPriceQuote(symbol);
  if (quote?.price == null) {
    return {
      error: `No live market price for ${symbol} — check the symbol, or record the trade manually.`,
      status: 422,
    };
  }
  const order = await insertOrder({
    symbol,
    side: input.side,
    quantity: input.quantity,
    orderType: input.orderType,
    limitPrice: input.limitPrice ?? null,
    stopPrice: input.stopPrice ?? null,
    tif: input.tif ?? "gtc",
    note: input.note?.trim() ?? "",
  });
  const d = fillDecision(order, quote.price);
  if (d.fills) return { order: await executeFill(order, d.price) };
  return { order };
}

// ---------------------------------------------------------------------------
// Dividends: detect from market data, apply on confirmation (cash or DRIP)
// ---------------------------------------------------------------------------

/** Close on/after `dateISO` (dividends pay after the ex-date), else null. */
function closeOnOrAfter(closes: { date: string; close: number }[], dateISO: string): number | null {
  for (const r of closes) if (r.date >= dateISO) return r.close;
  return null;
}

async function detectForSymbol(
  symbol: string,
  stockTrades: Trade[],
  appliedKeys: Set<string>
): Promise<PendingDividend[]> {
  const first = stockTrades[0].tradeDate.slice(0, 10);
  const events = await getDividendEvents(symbol, first);
  if (events.length === 0) return [];
  const [closes, quote, drip] = await Promise.all([
    getDailyCloses(symbol, first),
    getPriceQuote(symbol),
    dripEnabled(symbol),
  ]);
  const out: PendingDividend[] = [];
  for (const ev of events) {
    if (ev.date > todayISO()) continue; // declared but not yet ex
    if (appliedKeys.has(`${symbol}|${ev.date}`)) continue;
    const shares = sharesHeldOn(stockTrades, symbol, ev.date);
    if (shares === 0) continue;
    const amount = round(ev.amount * shares, 2);
    const px = closeOnOrAfter(closes, ev.date) ?? quote?.price ?? null;
    const reinvest = drip && shares > 0 && px != null && px > 0;
    out.push({
      symbol,
      exDate: ev.date,
      perShare: ev.amount,
      shares,
      amount,
      currency: quote?.currency ?? "USD",
      drip: drip && shares > 0,
      reinvestPrice: reinvest ? px : null,
      reinvestShares: reinvest ? round(amount / (px as number)) : null,
    });
  }
  return out;
}

/**
 * Dividends the held book has earned that aren't in the ledger yet — shares
 * held before each ex-date since the first trade, minus already-applied
 * receipts. Short positions show negative amounts (you owe the dividend).
 */
export async function pendingDividends(appliedKeys: Set<string>): Promise<PendingDividend[]> {
  const trades = await listTrades();
  const bySymbol = new Map<string, Trade[]>();
  for (const t of trades) {
    if (t.kind !== "stock") continue;
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, []);
    bySymbol.get(t.symbol)!.push(t);
  }
  const lists = await Promise.all(
    [...bySymbol.entries()].map(([sym, ts]) =>
      detectForSymbol(sym, ts, appliedKeys).catch(() => [] as PendingDividend[])
    )
  );
  return lists.flat().sort((a, b) => a.exDate.localeCompare(b.exDate));
}

/**
 * Apply one detected dividend into the book: a cash receipt (net of any tax
 * withheld at source), plus a DRIP buy (fractional shares at the ex-date
 * close, funded by the net amount) when reinvestment is on for the symbol
 * and the position is long.
 */
export async function applyDividend(
  p: PendingDividend,
  withholdingPct = 0
): Promise<DividendReceipt | null> {
  const w = Math.max(0, Math.min(60, withholdingPct)) || 0;
  const net = round(p.amount * (1 - w / 100), 2);
  let reinvestTradeId: string | null = null;
  let reinvested = 0;
  if (p.drip && p.shares > 0 && p.reinvestPrice != null && net > 0) {
    const netShares = round(net / p.reinvestPrice);
    if (netShares > 0) {
      const trade = await insertTrade({
        symbol: p.symbol,
        kind: "stock",
        side: "buy",
        quantity: netShares,
        price: p.reinvestPrice,
        fees: 0,
        tradeDate: p.exDate,
        optionType: null,
        strike: null,
        expiry: null,
        multiplier: 1,
        note: `DRIP — ${p.perShare}/sh dividend reinvested${w > 0 ? ` (net of ${w}% withholding)` : ""}`,
      });
      reinvestTradeId = trade.id;
      reinvested = 1;
    }
  }
  return insertDividend({
    symbol: p.symbol,
    exDate: p.exDate,
    perShare: p.perShare,
    shares: p.shares,
    amount: net,
    currency: p.currency,
    withholdingPct: w,
    reinvested,
    reinvestTradeId,
  });
}
