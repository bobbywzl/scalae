import { NextResponse, after } from "next/server";
import { executeSectionPlan, executeSectionResearch } from "@/lib/agents/diligence";
import {
  createDiligenceResearch,
  getNoteSection,
  getTicker,
  listDiligenceResearch,
  reapStuckDiligence,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";

// The deep-research pass (three grounded sweeps + one memo synthesis) runs
// inside this budget via after(). 300s is the Vercel Hobby ceiling.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/**
 * Kick off a deep-research pass on one section's topic — strictly on the
 * investor's ask (FOUNDATION: research is proposed, never imposed; the result
 * parks at 'pending' for their review). Body: { sectionId, question?, mode? }.
 *   mode "run" (default) → sweeps start immediately (today's behavior)
 *   mode "plan"          → the plan gate: the desk drafts the research plan
 *                          first and parks it for the investor's edit/approval
 *                          ("the plan is the analysis" — cooperative research,
 *                          the investor's choice at kickoff).
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { sectionId, question, mode } = (await req.json().catch(() => ({}))) as {
    sectionId?: string;
    question?: string;
    mode?: string;
  };
  if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });
  const section = await getNoteSection(user.id, sectionId);
  if (!section || section.symbol !== symbol) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // One pass at a time per section — the review gate stays legible. A drafted
  // plan awaiting the investor's decision blocks too: start it or discard it.
  await reapStuckDiligence(user.id, symbol);
  const existing = await listDiligenceResearch(user.id, symbol);
  const busy = existing.find(
    (r) =>
      r.sectionId === sectionId &&
      (r.status === "running" || r.status === "planning" || r.status === "planned")
  );
  if (busy) {
    return NextResponse.json(
      {
        error:
          busy.status === "planned"
            ? "A drafted plan is awaiting your decision on this section — start it or discard it first."
            : "Research is already running on this section.",
      },
      { status: 409 }
    );
  }

  const planFirst = mode === "plan";
  const research = await createDiligenceResearch(
    user.id,
    symbol,
    sectionId,
    typeof question === "string" ? question : "",
    planFirst ? "planning" : "running"
  );
  after(() =>
    planFirst ? executeSectionPlan(user.id, research.id) : executeSectionResearch(user.id, research.id)
  );
  return NextResponse.json({ research });
}
