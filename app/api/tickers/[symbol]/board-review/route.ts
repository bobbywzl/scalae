import { NextResponse } from "next/server";
import { executeBoardReview } from "@/lib/agents/review";
import { friendlyAIError } from "@/lib/ai/claude";
import { getTicker, runningRun } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// One heavy review call over the assembled desk state — synchronous (the
// investor waits on the memo), inside the Vercel Hobby 300s ceiling like the
// research-run route.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/**
 * Run a board review on the investor's ask: assess every active signal
 * (keep / sharpen / replace / retire), park any proposals for approval, and
 * land the memo in the desk chat. Runs synchronously and returns the memo.
 */
export async function POST(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // One research process per desk: a review re-judging signals while a run is
  // mid-flight would assess a board the run is about to move.
  if (await runningRun(user.id, symbol)) {
    return NextResponse.json(
      { error: "Research is running — wait for it to finish." },
      { status: 409 }
    );
  }

  try {
    const { review, proposalCount } = await executeBoardReview(user.id, symbol);
    return NextResponse.json({ review, proposalCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Known preconditions → 4xx like sibling routes; everything else is the
    // AI layer's problem and reads as a friendly 502.
    if (msg.startsWith("Unknown ticker")) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (msg.startsWith("Approve at least one signal")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error(`[scalae] board review (${symbol}) failed:`, msg);
    return NextResponse.json({ error: friendlyAIError(e) }, { status: 502 });
  }
}
