import { NextResponse } from "next/server";
import { deleteAnnotation } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  // Ownership is enforced in the query itself (userId in the WHERE clause).
  await deleteAnnotation(user.id, id);
  return NextResponse.json({ ok: true });
}
