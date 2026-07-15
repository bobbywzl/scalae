import { NextResponse } from "next/server";
import { createNote, getNoteSection } from "@/lib/db";
import { emptyDoc } from "@/lib/notes";
import { requireUser } from "@/lib/auth";

/** Create a notepad inside a section (starts as an empty document). */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sectionId, title } = (await req.json().catch(() => ({}))) as {
    sectionId?: string;
    title?: string;
  };
  if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });
  const section = await getNoteSection(user.id, sectionId);
  if (!section) return NextResponse.json({ error: "not found" }, { status: 404 });
  const note = await createNote(user.id, sectionId, section.symbol, title ?? "", emptyDoc());
  return NextResponse.json({ note });
}
