import { NextResponse } from "next/server";
import { getInitialCapital, setInitialCapital } from "@/lib/db";

/**
 * Set, change or clear the book's starting cash (USD). Cash on hand is then
 * derived from it: initial capital + every ledger cashflow to date.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { amount?: number | null };
  if (body.amount == null) {
    await setInitialCapital(null);
    return NextResponse.json({ initialCapital: null });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) {
    return NextResponse.json(
      { error: "amount must be a number between 0 and 1,000,000,000,000 (USD)" },
      { status: 400 }
    );
  }
  await setInitialCapital(Math.round(amount * 100) / 100);
  return NextResponse.json({ initialCapital: await getInitialCapital() });
}
