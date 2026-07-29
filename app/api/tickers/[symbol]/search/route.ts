import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getTicker } from "@/lib/db";
import { searchDesk } from "@/lib/search";

/**
 * Desk-wide search for one ticker: every text block across the three pills
 * (Signals, Due diligence, Finance), matched server-side and returned with a
 * directory path + snippet. Owner-scoped like every desk route.
 */

type Params = { params: Promise<{ symbol: string }> };

export async function GET(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).trim().toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const hits = await searchDesk(user.id, symbol, q);
  return NextResponse.json({ hits });
}
