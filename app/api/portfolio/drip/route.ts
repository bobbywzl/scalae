import { NextResponse } from "next/server";
import { dripEnabled, setDrip } from "@/lib/db";

/** Toggle dividend reinvestment for one symbol (applies to future applies). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { symbol?: string; enabled?: boolean };
  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  await setDrip(symbol, !!body.enabled);
  return NextResponse.json({ symbol, enabled: await dripEnabled(symbol) });
}
