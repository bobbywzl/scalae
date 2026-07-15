import { NextResponse } from "next/server";
import { getTicker, listFocusAreas, listNoteSections, listNotes } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { NotesPayload } from "@/lib/types";

type Params = { params: Promise<{ symbol: string }> };

/** The notes page payload: sections in order, each with its notepads. */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const [sections, notes, focusAreas] = await Promise.all([
    listNoteSections(user.id, symbol),
    listNotes(user.id, symbol),
    listFocusAreas(user.id, symbol),
  ]);
  const byId = new Map(sections.map((s) => [s.id, { ...s, notes: [] as typeof notes }]));
  for (const n of notes) byId.get(n.sectionId)?.notes.push(n);
  const existing = new Set(sections.map((s) => s.title.toLowerCase()));
  const payload: NotesPayload = {
    sections: [...byId.values()],
    focusAreaTitles: focusAreas.map((f) => f.title).filter((t) => !existing.has(t.toLowerCase())),
  };
  return NextResponse.json(payload);
}
