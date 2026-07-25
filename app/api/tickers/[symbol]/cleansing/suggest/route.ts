import { NextResponse, after } from "next/server";
import { executeCleansingSuggest } from "@/lib/agents/cleansing";
import {
  createFinSuggestRun,
  getTicker,
  latestFinSuggestRun,
  reapStuckFinSuggestRuns,
  stopFinSuggestRun,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Two grounded sweeps + one synthesis run inside this budget via after().
// 300s is the Vercel Hobby ceiling.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/**
 * Kick off a "suggest moderations" pass — the cleansing bench's analogue of a
 * research run. Strictly on the investor's ask; every proposal parks at
 * 'suggested' for their review (FOUNDATION: proposed, never imposed).
 */
export async function POST(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await reapStuckFinSuggestRuns(user.id, symbol).catch(() => {});
  const latest = await latestFinSuggestRun(user.id, symbol);
  if (latest?.status === "running") {
    return NextResponse.json(
      { error: "A moderation pass is already running on this ticker." },
      { status: 409 }
    );
  }

  const run = await createFinSuggestRun(user.id, symbol);
  after(() => executeCleansingSuggest(user.id, run.id, symbol));
  return NextResponse.json({ run });
}

/** Stop the in-flight pass (best-effort; the pipeline bails at its next checkpoint). */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const stopped = await stopFinSuggestRun(user.id, symbol);
  return NextResponse.json({ stopped });
}
