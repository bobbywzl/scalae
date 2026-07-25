import { NextResponse } from "next/server";
import { deleteDigestItem, getTicker } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ symbol: string }> };

/**
 * Remove one item from the desk's evidence feed. Curation only: the readings
 * that cited the underlying source keep their citations and the evidence
 * catalog is untouched — this deletes the feed entry, nothing else.
 */
export async function DELETE(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id?.trim()) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteDigestItem(user.id, body.id.trim());
  return NextResponse.json({ ok: true });
}
