import { NextResponse } from "next/server";
import { getDeskSource, setDeskSourceStatus, updateDeskSource } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { DeskSourceKind } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const KINDS: DeskSourceKind[] = ["primary", "trade", "narrative", "avoid"];

/**
 * The human gate on one source-map entry. Body: { action } and/or edits
 * { kind, note, label }.
 *   approve    → suggested → active (the entry joins the map)
 *   dismiss    → suggested/active → dismissed
 *   reactivate → dismissed → suggested (back through the gate)
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const source = await getDeskSource(id);
  if (!source || (source.userId && source.userId !== user.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    kind?: string;
    note?: string;
    label?: string;
  };

  const edits: { kind?: DeskSourceKind; note?: string; label?: string } = {};
  if (KINDS.includes(body.kind as DeskSourceKind)) edits.kind = body.kind as DeskSourceKind;
  if (typeof body.note === "string") edits.note = body.note.slice(0, 300);
  if (typeof body.label === "string") edits.label = body.label.slice(0, 200);
  if (Object.keys(edits).length > 0) await updateDeskSource(id, edits);

  if (body.action === "approve" && source.status === "suggested") {
    await setDeskSourceStatus(id, "active");
  } else if (body.action === "dismiss" && (source.status === "suggested" || source.status === "active")) {
    await setDeskSourceStatus(id, "dismissed");
  } else if (body.action === "reactivate" && source.status === "dismissed") {
    await setDeskSourceStatus(id, "suggested");
  } else if (body.action) {
    return NextResponse.json(
      { error: "action must be approve | dismiss | reactivate (valid for the current status)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ source: await getDeskSource(id) });
}
