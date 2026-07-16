import { NextResponse } from "next/server";
import {
  createNote,
  decideDiligenceResearch,
  deleteNote,
  getDiligenceResearch,
  getNoteSection,
} from "@/lib/db";
import { researchNoteDoc } from "@/lib/notes";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * The investor's review decision on a pending research memo — the approval
 * gate that admits desk research into the record. Body: { action }.
 *   accept  → the memo becomes a dated, fully-editable notepad in its section
 *   dismiss → the record stays untouched
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "accept" && action !== "dismiss") {
    return NextResponse.json({ error: "action must be accept or dismiss" }, { status: 400 });
  }

  const research = await getDiligenceResearch(user.id, id);
  if (!research) return NextResponse.json({ error: "not found" }, { status: 404 });
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
