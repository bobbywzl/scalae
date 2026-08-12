import { NextResponse } from "next/server";
import { deleteNoteVisual } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Remove a kept visual (the notepad's text is untouched — visuals live beside it). */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteNoteVisual(user.id, id);
  return NextResponse.json({ ok: true });
}
