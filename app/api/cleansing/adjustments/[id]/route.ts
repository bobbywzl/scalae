import { NextResponse } from "next/server";
import { describeAdjustment } from "@/lib/cleansing";
import {
  getFinAdjustment,
  insertFinCleansingEvent,
  transitionFinAdjustment,
} from "@/lib/db";
import { peekFinancials } from "@/lib/financials";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * The investor's decision on one adjustment — the cleansing bench's human
 * gate. Body: { action: "apply" | "dismiss" | "revert" }. Transitions are
 * guarded to their legal predecessor (a stale click can't double-apply), and
 * every decision lands in the append-only audit log.
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getFinAdjustment(user.id, id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "apply" && action !== "dismiss" && action !== "revert") {
    return NextResponse.json({ error: "action must be apply, dismiss or revert" }, { status: 400 });
  }

  const updated = await transitionFinAdjustment(user.id, id, action);
  if (!updated) {
    return NextResponse.json(
      { error: "This adjustment already moved on — reload to see its current state." },
      { status: 409 }
    );
  }
  // Cache-only currency lookup — the audit line must never pay a provider fetch.
  const fin = await peekFinancials(existing.symbol);
  await insertFinCleansingEvent(
    user.id,
    existing.symbol,
    id,
    action === "apply" ? "applied" : action === "dismiss" ? "dismissed" : "reverted",
    describeAdjustment(updated, fin?.currency ?? null)
  ).catch(() => {});
  return NextResponse.json({ adjustment: updated });
}
