import { NextResponse } from "next/server";
import { computePortfolio } from "@/lib/portfolio";

export const maxDuration = 60;

/** Full portfolio: summary, P&L series, valued positions, trade history. */
export async function GET() {
  try {
    return NextResponse.json(await computePortfolio());
  } catch (e) {
    console.error("[scalae] portfolio failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to compute portfolio." }, { status: 500 });
  }
}
