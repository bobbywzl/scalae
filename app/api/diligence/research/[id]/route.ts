import { NextResponse, after } from "next/server";
import { executeSectionResearch } from "@/lib/agents/diligence";
import {
  createNote,
  decideDiligenceResearch,
  deleteNote,
  dismissPlannedResearch,
  getDiligenceResearch,
  getNoteSection,
  startPlannedDiligenceResearch,
  stopDiligenceResearch,
} from "@/lib/db";
import { researchNoteDoc } from "@/lib/notes";
import { requireUser } from "@/lib/auth";

// "start" launches the sweeps + memo synthesis via after() — same budget as
// the kickoff route. 300s is the Vercel Hobby ceiling.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * The investor's review decisions on a research pass. Body: { action, plan? }.
 *   accept       → the pending memo becomes a dated notepad in its section
 *   dismiss      → the record stays untouched
 *   start        → run a 'planned' pass now; body.plan (their edited text, if
 *                  any) is binding — the plan gate's approval gesture
 *   discard_plan → drop a drafted plan without running it
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { action, plan } = (await req.json().catch(() => ({}))) as {
    action?: string;
    plan?: string;
  };
  if (action !== "accept" && action !== "dismiss" && action !== "start" && action !== "discard_plan") {
    return NextResponse.json(
      { error: "action must be accept | dismiss | start | discard_plan" },
      { status: 400 }
    );
  }

  const research = await getDiligenceResearch(user.id, id);
  if (!research) return NextResponse.json({ error: "not found" }, { status: 404 });

  // The plan gate's two decisions (only a 'planned' row accepts them).
  if (action === "start") {
    const finalPlan = typeof plan === "string" && plan.trim() ? plan : (research.plan ?? "");
    const started = await startPlannedDiligenceResearch(user.id, id, finalPlan);
    if (!started) {
      return NextResponse.json({ error: "This pass is not awaiting a start." }, { status: 409 });
    }
    after(() => executeSectionResearch(user.id, id));
    return NextResponse.json({ research: started });
  }
  if (action === "discard_plan") {
    const dismissed = await dismissPlannedResearch(user.id, id);
    if (!dismissed) {
      return NextResponse.json({ error: "This pass is not awaiting a start." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (research.status !== "pending" || !research.memo) {
    return NextResponse.json({ error: "This memo has already been decided." }, { status: 409 });
  }

  if (action === "dismiss") {
    await decideDiligenceResearch(user.id, id, false);
    return NextResponse.json({ ok: true });
  }

  const section = await getNoteSection(user.id, research.sectionId);
  if (!section) {
    return NextResponse.json(
      { error: "The section this research belongs to was deleted." },
      { status: 409 }
    );
  }
  // Create the notepad first, then flip the status — the pending→accepted
  // update is the concurrency guard (a double-click can't append twice), and
  // this order can never leave an accepted memo without its document.
  const note = await createNote(
    user.id,
    section.id,
    section.symbol,
    `Deep research — ${research.createdAt.slice(0, 10)}`,
    researchNoteDoc({
      memo: research.memo,
      sources: research.sources,
      createdAt: research.createdAt,
      question: research.question,
    })
  );
  const decided = await decideDiligenceResearch(user.id, id, true);
  if (!decided) {
    await deleteNote(user.id, note.id).catch(() => {});
    return NextResponse.json({ error: "This memo has already been decided." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, note });
}

/**
 * Stop an in-flight research pass. The section frees immediately for a fresh
 * pass; the background pipeline bails at its next checkpoint (see
 * executeSectionResearch — a stopped row can never resurrect).
 */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await getDiligenceResearch(user.id, id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const stopped = await stopDiligenceResearch(user.id, id);
  return NextResponse.json({ stopped });
}
