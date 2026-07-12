import type { PnlPoint, Position, TickerInvolvement, Trade } from "./types";

/**
 * Pure portfolio math — no I/O, no market imports — so the ledger and P&L
 * reconstruction are unit-testable in isolation. Orchestration (quotes, FX,
 * option marks) lives in lib/portfolio.ts.
 *
 * Method notes:
 * - Average cost with SIGNED quantities: longs and shorts share one code path;
 *   unrealized = (mark − avgCost) × qty × multiplier holds for both signs.
 * - Option premiums are per share; cash amounts multiply by the contract
 *   multiplier (default 100).
 * - Series identity: P&L(t) = market value of open positions at t (USD)
 *   + cumulative signed cashflow to t (USD at each trade day's FX). This
 *   captures unrealized + realized + fees + FX drift uniformly.
 */

export function positionKey(t: {
  symbol: string;
  kind: string;
  optionType?: string | null;
  strike?: number | null;
  expiry?: string | null;
}): string {
  return t.kind === "option"
    ? `${t.symbol}|${t.optionType === "put" ? "P" : "C"}|${t.strike}|${t.expiry}`
    : t.symbol;
}

/** Human label for an option position: "SEP 18 '26 80 CALL". */
export function optionLabel(p: {
  optionType: string | null;
  strike: number | null;
  expiry: string | null;
}): string {
  const d = p.expiry ? new Date(p.expiry) : null;
  const when =
    d && !isNaN(d.getTime())
      ? d
          .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" })
          .toUpperCase()
      : (p.expiry ?? "?");
  return `${when} ${p.strike ?? "?"} ${(p.optionType ?? "call").toUpperCase()}`;
}

export const intrinsic = (type: "call" | "put", S: number, K: number) =>
  Math.max(0, type === "call" ? S - K : K - S);

/**
 * Replay the ledger into positions (signed average-cost). Crossing zero
 * realizes the closed side fully, then opens the remainder at the trade
 * price. Fees always reduce realized P&L.
 */
export function buildPositions(trades: Trade[]): Map<string, Position> {
  const out = new Map<string, Position>();
  const sorted = [...trades].sort(
    (a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.createdAt.localeCompare(b.createdAt)
  );
  for (const t of sorted) {
    const key = positionKey(t);
    let p = out.get(key);
    if (!p) {
      p = {
        key,
        symbol: t.symbol,
        kind: t.kind,
        optionType: t.optionType,
        strike: t.strike,
        expiry: t.expiry,
        multiplier: t.kind === "option" ? t.multiplier || 100 : 1,
        qty: 0,
        avgCost: 0,
        realized: 0,
        trades: 0,
      };
      out.set(key, p);
    }
    p.trades += 1;
    const mult = p.multiplier;
    const signed = t.side === "buy" ? t.quantity : -t.quantity;

    if (p.qty === 0 || Math.sign(p.qty) === Math.sign(signed)) {
      // Opening or adding: weighted-average the cost.
      const newAbs = Math.abs(p.qty) + Math.abs(signed);
      p.avgCost = (Math.abs(p.qty) * p.avgCost + Math.abs(signed) * t.price) / newAbs;
      p.qty += signed;
    } else {
      // Reducing / closing / crossing zero.
      const closeQty = Math.min(Math.abs(signed), Math.abs(p.qty));
      p.realized += (t.price - p.avgCost) * closeQty * Math.sign(p.qty) * mult;
      const remainder = Math.abs(signed) - closeQty;
      p.qty = Math.sign(p.qty) * (Math.abs(p.qty) - closeQty);
      if (remainder > 0) {
        p.qty = Math.sign(signed) * remainder;
        p.avgCost = t.price;
      } else if (p.qty === 0) {
        p.avgCost = 0;
      }
    }
    p.realized -= t.fees;
  }
  return out;
}

/** Carry-forward series lookup that walks an ascending date axis in order. */
export class Walker {
  private i = 0;
  private last: number | null = null;
  constructor(private rows: { date: string; close: number }[]) {}
  at(date: string): number | null {
    while (this.i < this.rows.length && this.rows[this.i].date <= date) {
      this.last = this.rows[this.i].close;
      this.i++;
    }
    return this.last;
  }
}

export interface SeriesInputs {
  trades: Trade[];
  /** underlying symbol → ascending daily closes */
  closes: Map<string, { date: string; close: number }[]>;
  /** currency → ascending daily CUR→USD rates (USD omitted) */
  fx: Map<string, { date: string; close: number }[]>;
  /** underlying symbol → native currency */
  currencyOf: Map<string, string>;
  /** live per-unit marks for the final point, by position key (optional) */
  liveMarks?: Map<string, number>;
  /** injectable "today" for tests (ISO date) */
  today?: string;
}

/**
 * Pure P&L series: walk the union of trading days, apply trades as their date
 * passes, and emit P&L = equity + cumulative cashflow (USD). Options are
 * marked at intrinsic value historically; the final point uses liveMarks when
 * provided; expired options mark at 0.
 */
export function computeSeries(inp: SeriesInputs): PnlPoint[] {
  const trades = [...inp.trades].sort(
    (a, b) => a.tradeDate.localeCompare(b.tradeDate) || a.createdAt.localeCompare(b.createdAt)
  );
  if (trades.length === 0) return [];
  const firstDate = trades[0].tradeDate.slice(0, 10);
  const today = inp.today ?? new Date().toISOString().slice(0, 10);

  const axisSet = new Set<string>();
  for (const rows of inp.closes.values()) {
    for (const r of rows) if (r.date >= firstDate) axisSet.add(r.date);
  }
  axisSet.add(today); // final "now" point even before today's close prints
  const axis = [...axisSet].sort();

  const closeWalkers = new Map<string, Walker>();
  for (const [s, rows] of inp.closes) closeWalkers.set(s, new Walker(rows));
  const fxWalkers = new Map<string, Walker>();
  for (const [c, rows] of inp.fx) fxWalkers.set(c, new Walker(rows));
  const fxLast = new Map<string, number>();
  const fxAt = (cur: string, date: string): number => {
    if (!cur || cur.toUpperCase() === "USD") return 1;
    const w = fxWalkers.get(cur);
    const v = w ? w.at(date) : null;
    if (v != null) fxLast.set(cur, v);
    return v ?? fxLast.get(cur) ?? 1;
  };

  interface Open {
    qty: number;
    kind: Trade["kind"];
    symbol: string;
    optionType: Trade["optionType"];
    strike: number | null;
    expiry: string | null;
    mult: number;
  }
  const open = new Map<string, Open>();
  let cashUsd = 0;
  let ti = 0;
  const points: PnlPoint[] = [];

  for (const date of axis) {
    while (ti < trades.length && trades[ti].tradeDate.slice(0, 10) <= date) {
      const t = trades[ti++];
      const key = positionKey(t);
      const mult = t.kind === "option" ? t.multiplier || 100 : 1;
      let o = open.get(key);
      if (!o) {
        o = {
          qty: 0,
          kind: t.kind,
          symbol: t.symbol,
          optionType: t.optionType,
          strike: t.strike,
          expiry: t.expiry,
          mult,
        };
        open.set(key, o);
      }
      o.qty += t.side === "buy" ? t.quantity : -t.quantity;
      const cur = inp.currencyOf.get(t.symbol) ?? "USD";
      const rate = fxAt(cur, date);
      const gross = t.price * t.quantity * mult;
      cashUsd += (t.side === "buy" ? -gross : gross) * rate - t.fees * rate;
    }

    let equityUsd = 0;
    const isLast = date === axis[axis.length - 1];
    for (const [key, o] of open) {
      if (o.qty === 0) continue;
      const cur = inp.currencyOf.get(o.symbol) ?? "USD";
      const rate = fxAt(cur, date);
      const live = isLast ? inp.liveMarks?.get(key) : undefined;
      let unit: number | null = null;
      if (live != null) {
        unit = live;
      } else {
        const close = closeWalkers.get(o.symbol)?.at(date) ?? null;
        if (o.kind === "stock") unit = close;
        else if (o.expiry && date > o.expiry) unit = 0;
        else if (close != null && o.optionType && o.strike != null)
          unit = intrinsic(o.optionType, close, o.strike);
      }
      if (unit != null) equityUsd += o.qty * unit * o.mult * rate;
    }
    points.push({
      date,
      pnl: Math.round((equityUsd + cashUsd) * 100) / 100,
      value: Math.round(equityUsd * 100) / 100,
    });
  }
  return points;
}

/** One-line involvement summary for the analyst's context (native currency). */
export function involvementLine(inv: TickerInvolvement | null): string {
  if (!inv) return "";
  const cur = inv.currency === "USD" ? "$" : `${inv.currency} `;
  const parts: string[] = [];
  if (inv.stock) {
    const s = inv.stock;
    const pct =
      s.unrealizedPct != null
        ? ` (${s.unrealizedPct >= 0 ? "+" : ""}${s.unrealizedPct.toFixed(1)}%)`
        : "";
    parts.push(
      `${s.qty > 0 ? "long" : "short"} ${Math.abs(s.qty)} shares @ ${cur}${s.avgCost.toFixed(2)} avg${
        s.mark != null ? `, now ${cur}${s.mark.toFixed(2)}${pct}` : ""
      }`
    );
  }
  for (const o of inv.options) {
    parts.push(
      `${o.qty > 0 ? "long" : "short"} ${Math.abs(o.qty)}× ${optionLabel(o)} @ ${cur}${o.avgCost.toFixed(2)} premium`
    );
  }
  if (inv.realized !== 0) parts.push(`realized to date ${cur}${inv.realized.toFixed(2)}`);
  return parts.join("; ");
}
