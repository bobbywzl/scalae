import { NextResponse } from "next/server";
import { listDividends } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { applyDividend, pendingDividends } from "@/lib/orders";

export const maxDuration = 60;

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const applied = await listDividends(user.id);
  const pending = await pendingDividends(user.id, new Set(applied.map((d) => `${d.symbol}|${d.exDate}`)));
  return NextResponse.json({ pending, applied });
}

/**
 * Apply detected dividends into the book — one ({symbol, exDate}) or all
 * ({all: true}). Cash receipt, plus a DRIP reinvestment buy when the symbol's
 * DRIP setting is on. Human-confirmed, like everything else that changes
 * the ledger.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    symbol?: string;
    exDate?: string;
    all?: boolean;
    /** Tax withheld at source, percent (0-60); credited amount is net of it. */
    withholdingPct?: number;
  };
  const applied = await listDividends(user.id);
  const pending = await pendingDividends(user.id, new Set(applied.map((d) => `${d.symbol}|${d.exDate}`)));

  const targets = body.all
    ? pending
    : pending.filter(
        (p) => p.symbol === String(body.symbol ?? "").toUpperCase() && p.exDate === body.exDate
      );
  if (targets.length === 0) {
    return NextResponse.json({ error: "No matching pending dividend." }, { status: 404 });
  }
  const withholding = Number.isFinite(body.withholdingPct) ? Number(body.withholdingPct) : 0;
  let count = 0;
  for (const p of targets) {
    if (await applyDividend(user.id, p, withholding)) count++;
  }
  return NextResponse.json({ applied: count });
}
