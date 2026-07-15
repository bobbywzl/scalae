import { NextResponse } from "next/server";
import { createNoteSection, getTicker } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Create a notes section on a ticker (custom title, or a focus-area title). */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw, title } = (await req.json().catch(() => ({}))) as {
    symbol?: string;
    title?: string;
  };
  const symbol = raw?.trim().toUpperCase();
  if (!symbol || !title?.trim()) {
    return NextResponse.json({ error: "symbol and title required" }, { status: 400 });
  }
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const section = await createNoteSection(user.id, symbol, title);
  return NextResponse.json({ section });
}
