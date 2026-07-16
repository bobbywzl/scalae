import { NextResponse } from "next/server";
import {
  deleteDiligenceEvidence,
  getDiligenceEvidenceWithData,
  updateDiligenceEvidenceCaption,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Recaption a filed piece of evidence. Body: { caption }. */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await getDiligenceEvidenceWithData(user.id, id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { caption } = (await req.json().catch(() => ({}))) as { caption?: string };
  if (typeof caption !== "string") {
    return NextResponse.json({ error: "caption required" }, { status: 400 });
  }
  await updateDiligenceEvidenceCaption(user.id, id, caption);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await getDiligenceEvidenceWithData(user.id, id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await deleteDiligenceEvidence(user.id, id);
  return NextResponse.json({ ok: true });
}
