import { NextResponse } from "next/server";
import { createNoteVisual, getNote } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizeVisualSpec } from "@/lib/visual-spec";
import type { VisualSpec } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Keep a generated visual beneath its notepad — the investor's explicit
 * gesture (the generate route persists nothing). The spec is re-normalized
 * server-side: the browser's copy is never trusted into the record.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const note = await getNote(user.id, id);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    selectedText?: string;
    ask?: string;
    spec?: VisualSpec;
  };
  const spec = normalizeVisualSpec(body.spec);
  const selectedText = body.selectedText?.trim() ?? "";
  if (!spec || !selectedText) {
    return NextResponse.json({ error: "invalid visual" }, { status: 400 });
  }
  const visual = await createNoteVisual(user.id, note, {
    selectedText,
    ask: body.ask?.trim() ?? "",
    spec,
  });
  return NextResponse.json({ visual });
}
