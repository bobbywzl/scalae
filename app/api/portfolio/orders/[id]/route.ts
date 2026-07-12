import { NextResponse } from "next/server";
import { cancelOrder, getOrder } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** Cancel a working order. Filled/expired orders can't be canceled. */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ok = await cancelOrder(id);
  if (!ok) {
    return NextResponse.json(
      { error: `Order is already ${order.status} — only working orders can be canceled.` },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
