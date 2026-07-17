import { NextResponse } from "next/server";
import {
  appendEvidenceChunk,
  completeEvidenceUpload,
  deleteDiligenceEvidence,
} from "@/lib/db";
import { EVIDENCE_CAPS, EVIDENCE_CHUNK_MAX } from "@/lib/attachments";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * Append one chunk to an in-flight chunked evidence upload (created
 * incomplete by the evidence POST). Chunks arrive sequentially; `last: true`
 * finalizes the row, which is when it joins the record. A row that blows its
 * kind's assembled-size cap is deleted outright — no half-filed evidence.
 * Body: { data, last? }.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data, last } = (await req.json().catch(() => ({}))) as {
    data?: string;
    last?: boolean;
  };
  if (typeof data !== "string" || data.length === 0) {
    return NextResponse.json({ error: "data required" }, { status: 400 });
  }
  if (data.length > EVIDENCE_CHUNK_MAX) {
    return NextResponse.json({ error: "Upload chunk too large." }, { status: 400 });
  }

  const appended = await appendEvidenceChunk(user.id, id, data);
  if (!appended) {
    // Finished, reaped as stale, or never existed — the upload can't continue.
    return NextResponse.json({ error: "Upload is no longer open." }, { status: 409 });
  }
  if (appended.length > EVIDENCE_CAPS[appended.kind]) {
    await deleteDiligenceEvidence(user.id, id).catch(() => {});
    return NextResponse.json({ error: "File exceeds the evidence size limit." }, { status: 413 });
  }
  if (last === true) {
    await completeEvidenceUpload(user.id, id);
  }
  return NextResponse.json({ ok: true, length: appended.length, complete: last === true });
}
