import { NextResponse } from "next/server";
import { cancelOrder, getOrder } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Cancel a working order. Filled/expired orders can't be canceled. */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const order = await getOrder(id);
  if (!order || ((order as { userId?: string }).userId ?? user.id) !== user.id)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const ok = await cancelOrder(user.id, id);
  if (!ok) {
    return NextResponse.json(
      { error: `Order is already ${order.status} — only working orders can be canceled.` },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
