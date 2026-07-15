import { NextResponse } from "next/server";
import { getTicker } from "@/lib/db";
import { getPeers } from "@/lib/financials";
import { requireUser } from "@/lib/auth";

// Peer comparison is fetched only when the investor asks for it (each peer is a
// couple of Yahoo calls), so it lives on its own route, not in the desk payload.
export const maxDuration = 120;

type Params = { params: Promise<{ symbol: string }> };

/** Industry-matched peer comparison, or the investor's own `?tickers=A,B,C`. */
export async function GET(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const tickersParam = new URL(req.url).searchParams.get("tickers");
  const custom = tickersParam
    ? tickersParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5)
    : undefined;
  const comparison = await getPeers(symbol, custom).catch(() => null);
  if (!comparison) {
    return NextResponse.json({ error: "Peer comparison is unavailable." }, { status: 502 });
  }
  return NextResponse.json({ comparison });
}
