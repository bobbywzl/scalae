import { NextResponse } from "next/server";
import { deleteNote, getNote, updateNote } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Notepad content is capped well above any real document, guarding the row size. */
const MAX_CONTENT_BYTES = 400_000;

function validDoc(content: string): boolean {
  if (content.length > MAX_CONTENT_BYTES) return false;
  try {
    const doc = JSON.parse(content) as { type?: string; content?: unknown };
    return doc?.type === "doc" && Array.isArray(doc.content);
  } catch {
    return false;
  }
}

/** Autosave: title and/or content (TipTap JSON). */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await getNote(user.id, id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { title, content } = (await req.json().catch(() => ({}))) as {
    title?: string;
    content?: string;
  };
  if (title === undefined && content === undefined) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  if (content !== undefined && !validDoc(content)) {
    return NextResponse.json({ error: "invalid content" }, { status: 400 });
  }
  await updateNote(user.id, id, { title, content });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await getNote(user.id, id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await deleteNote(user.id, id);
  return NextResponse.json({ ok: true });
}
