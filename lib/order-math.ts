import type { Order, OrderInput } from "./types";

/**
 * Pure order logic — no I/O — shared by the server engine (lib/orders.ts),
 * the client order ticket (marketability preview), and unit tests.
 */

/** Validate an order ticket; returns an error message or null when placeable. */
export function validateOrder(o: OrderInput): string | null {
  if (!o.symbol?.trim()) return "symbol is required";
  if (o.side !== "buy" && o.side !== "sell") return "side must be buy | sell";
  if (!Number.isFinite(o.quantity) || o.quantity <= 0) return "quantity must be > 0";
  if (o.quantity > 1_000_000_000) return "quantity is implausibly large";
  const types = ["market", "limit", "stop", "stop_limit"];
  if (!types.includes(o.orderType)) return "orderType must be market | limit | stop | stop_limit";
  const needsLimit = o.orderType === "limit" || o.orderType === "stop_limit";
  const needsStop = o.orderType === "stop" || o.orderType === "stop_limit";
  if (needsLimit && !(Number.isFinite(o.limitPrice) && (o.limitPrice as number) > 0))
    return "limitPrice must be > 0 for limit orders";
  if (needsStop && !(Number.isFinite(o.stopPrice) && (o.stopPrice as number) > 0))
    return "stopPrice must be > 0 for stop orders";
  if (o.orderType === "stop_limit") {
    const s = o.stopPrice as number;
    const l = o.limitPrice as number;
    if (o.side === "buy" && l < s)
      return "buy stop-limit: limit must be at or above the stop (or the order can never fill)";
    if (o.side === "sell" && l > s)
      return "sell stop-limit: limit must be at or below the stop (or the order can never fill)";
  }
  if (o.tif && o.tif !== "day" && o.tif !== "gtc") return "tif must be day | gtc";
  return null;
}

/**
 * Does a working order fill at the current price? Fill price is the market
 * price (price improvement on marketable limits, like a real broker).
 */
export function fillDecision(
  o: Pick<Order, "side" | "orderType" | "limitPrice" | "stopPrice">,
  price: number
): { fills: boolean; price: number } {
  const buy = o.side === "buy";
  switch (o.orderType) {
    case "market":
      return { fills: true, price };
    case "limit": {
      const L = o.limitPrice ?? NaN;
      return { fills: buy ? price <= L : price >= L, price };
    }
    case "stop": {
      const S = o.stopPrice ?? NaN;
      return { fills: buy ? price >= S : price <= S, price };
    }
    case "stop_limit": {
      const S = o.stopPrice ?? NaN;
      const L = o.limitPrice ?? NaN;
      const triggered = buy ? price >= S : price <= S;
      const limitOk = buy ? price <= L : price >= L;
      return { fills: triggered && limitOk, price };
    }
    default:
      return { fills: false, price };
  }
}

/** Human note recorded on the ledger trade a fill creates. */
export function fillNote(o: Pick<Order, "orderType" | "limitPrice" | "stopPrice">): string {
  const label =
    o.orderType === "stop_limit"
      ? `stop-limit ${o.stopPrice}/${o.limitPrice}`
      : o.orderType === "limit"
        ? `limit ${o.limitPrice}`
        : o.orderType === "stop"
          ? `stop ${o.stopPrice}`
          : "market";
  return `${label} order — simulated fill at market`;
}

/** Short human label: "Limit 84.50 · GTC", "Stop-limit 80/78 · Day", "Market". */
export function orderLabel(
  o: Pick<Order, "orderType" | "limitPrice" | "stopPrice" | "tif">
): string {
  const type =
    o.orderType === "stop_limit"
      ? `Stop-limit ${o.stopPrice}/${o.limitPrice}`
      : o.orderType === "limit"
        ? `Limit ${o.limitPrice}`
        : o.orderType === "stop"
          ? `Stop ${o.stopPrice}`
          : "Market";
  return o.orderType === "market" ? type : `${type} · ${o.tif.toUpperCase()}`;
}
