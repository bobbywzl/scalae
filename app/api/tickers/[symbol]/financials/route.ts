import { NextResponse } from "next/server";
import { getTicker } from "@/lib/db";
import { getFinancials } from "@/lib/financials";
import { requireUser } from "@/lib/auth";

// Fetching a fresh set of statements hits Yahoo several times; that only happens
// on a cache miss (cached in Postgres for a few days), but give the route room.
export const maxDuration = 120;

type Params = { params: Promise<{ symbol: string }> };

/** Value-investor financials for a ticker: 10 FY of metrics + snapshot + peers. */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const financials = await getFinancials(symbol);
  if (!financials) {
    return NextResponse.json({ error: "Financials are unavailable for this ticker." }, { status: 502 });
  }
  return NextResponse.json({ financials });
}
