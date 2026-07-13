import { NextResponse } from "next/server";
import { listOpenOrders, listOrderHistory } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { placeOrder, sweepOpenOrders } from "@/lib/orders";
import type { OrderInput } from "@/lib/types";

export const maxDuration = 60;

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [open, history] = await Promise.all([listOpenOrders(user.id), listOrderHistory(user.id)]);
  return NextResponse.json({ open, history });
}

/**
 * Place a paper order (stocks). Market orders — and marketable limit/stop
 * orders — fill immediately at the live quote and land in the ledger; the
 * rest stay working and are swept against live prices on every portfolio load.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Partial<OrderInput>;
  const input: OrderInput = {
    symbol: String(body.symbol ?? "").trim().toUpperCase(),
    side: body.side === "sell" ? "sell" : "buy",
    quantity: Number(body.quantity),
    orderType: (body.orderType ?? "market") as OrderInput["orderType"],
    limitPrice: body.limitPrice != null ? Number(body.limitPrice) : undefined,
    stopPrice: body.stopPrice != null ? Number(body.stopPrice) : undefined,
    tif: body.tif === "day" ? "day" : "gtc",
    note: typeof body.note === "string" ? body.note.slice(0, 400) : "",
  };
  const res = await placeOrder(user.id, input);
  if (res.error) return NextResponse.json({ error: res.error }, { status: res.status });
  // A newly placed order can also unblock older ones (fresh quote in cache).
  await sweepOpenOrders(user.id).catch(() => {});
  return NextResponse.json({ order: res.order }, { status: 201 });
}
