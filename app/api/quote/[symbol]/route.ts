import { NextResponse } from "next/server";
import { getQuoteCard } from "@/lib/market";

type Params = { params: Promise<{ symbol: string }> };

/** Brokerage-grade quote for the trade ticket (pre-trade information). */
export async function GET(_req: Request, { params }: Params) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  const quote = await getQuoteCard(symbol);
  if (!quote) return NextResponse.json({ error: "no quote" }, { status: 404 });
  return NextResponse.json({ quote });
}
