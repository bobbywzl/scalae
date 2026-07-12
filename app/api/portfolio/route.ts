import { NextResponse } from "next/server";
import { clearPortfolio } from "@/lib/db";
import { sweepOpenOrders } from "@/lib/orders";
import { computePortfolio } from "@/lib/portfolio";

export const maxDuration = 60;

/**
 * Full portfolio: summary, P&L series, valued positions, working orders,
 * dividends, trade history. Working orders are swept against live quotes
 * first, so fills land in the ledger before it's valued.
 */
export async function GET() {
  try {
    await sweepOpenOrders().catch((e) => {
      console.error("[scalae] order sweep failed:", e instanceof Error ? e.message : e);
    });
    return NextResponse.json(await computePortfolio());
  } catch (e) {
    console.error("[scalae] portfolio failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to compute portfolio." }, { status: 500 });
  }
}

/** Clear the whole paper book (trades, orders, dividends, DRIP settings). */
export async function DELETE() {
  try {
    await clearPortfolio();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[scalae] clear portfolio failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to clear portfolio." }, { status: 500 });
  }
}
