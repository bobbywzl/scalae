import { NextResponse } from "next/server";
import { getTicker, insertLesson, listLessons } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ symbol: string }> };

/** The desk's standing orders (the lessons ledger), every status. */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ lessons: await listLessons(user.id, symbol) });
}

/**
 * The investor writes a standing order directly. Their write IS the approval
 * (the cleansing-bench precedent: an explicit instruction applies in the same
 * gesture), so it activates immediately. Body: { text }.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
  const id = await insertLesson(user.id, symbol, {
    text: text.trim().slice(0, 500),
    origin: "investor",
    status: "active",
  });
  if (!id) {
    return NextResponse.json(
      { error: "An identical standing order already exists." },
      { status: 409 }
    );
  }
  return NextResponse.json({ lessons: await listLessons(user.id, symbol) });
}
