import { NextResponse } from "next/server";
import { getTicker, removeFocusAreaIfUnused } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ symbol: string }> };

/**
 * Remove a focus area from the desk. Guarded server-side: refused (409) while
 * any active or pending signal still carries the area's title, so the board
 * can never lose the grouping of a live instrument. An area removed here
 * returns automatically if the investor later approves a signal into it
 * (setSignalStatus materializes areas on activation — the human gate).
 */
export async function DELETE(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const removed = await removeFocusAreaIfUnused(user.id, symbol, id);
  if (!removed) {
    return NextResponse.json(
      { error: "This focus area still has active or pending signals (or was already removed)." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
