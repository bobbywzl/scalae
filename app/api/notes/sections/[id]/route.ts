import { NextResponse } from "next/server";
import { deleteNoteSection, getNoteSection, renameNoteSection } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await getNoteSection(user.id, id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { title } = (await req.json().catch(() => ({}))) as { title?: string };
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });
  await renameNoteSection(user.id, id, title);
  return NextResponse.json({ ok: true });
}

/** Deletes the section AND its notepads (the page confirms first). */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await getNoteSection(user.id, id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await deleteNoteSection(user.id, id);
  return NextResponse.json({ ok: true });
}
