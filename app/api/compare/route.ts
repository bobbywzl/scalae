import { NextResponse } from "next/server";
import { runComparison } from "@/lib/agents/comparison";
import { requireUser } from "@/lib/auth";
import { getTicker } from "@/lib/db";
import { requestLang } from "@/lib/i18n/server";

export const maxDuration = 120;

/**
 * The compare view's analyst verdict: pairwise opportunity-cost weighing of
 * two desks on their existing evidence. Stateless — nothing is persisted; the
 * desks themselves remain the record.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { a?: unknown; b?: unknown };
  const a = String(body.a ?? "").trim().toUpperCase();
  const b = String(body.b ?? "").trim().toUpperCase();
  if (!a || !b) return NextResponse.json({ error: "Both tickers (a, b) are required." }, { status: 400 });
  if (a === b) return NextResponse.json({ error: "Pick two different desks." }, { status: 400 });
  const [ta, tb] = await Promise.all([getTicker(user.id, a), getTicker(user.id, b)]);
  if (!ta || !tb) {
    return NextResponse.json(
      { error: `No desk for ${!ta ? a : b} — add it to the watchlist first.` },
      { status: 404 }
    );
  }
  try {
    const verdict = await runComparison(user.id, a, b, await requestLang(user.id));
    return NextResponse.json({ verdict });
  } catch (e) {
    console.error(`[scalae] comparison ${a} vs ${b} failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The comparison failed — try again." }, { status: 500 });
  }
}
