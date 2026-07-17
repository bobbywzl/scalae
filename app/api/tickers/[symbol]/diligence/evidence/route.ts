import { NextResponse } from "next/server";
import { getNoteSection, getTicker, insertDiligenceEvidence } from "@/lib/db";
import { sanitizeEvidence } from "@/lib/attachments";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ symbol: string }> };

/**
 * File one piece of evidence into a section's locker — any file type, with a
 * caption. The body carries the payload's FIRST chunk plus the total length;
 * when more is coming the row is created incomplete and the client appends
 * the rest via POST /api/diligence/evidence/[id]/chunk (the platform caps a
 * single request body, so big files can't arrive whole). Multi-file drops
 * queue sequentially on the page.
 * Body: { sectionId, caption?, file: { kind, name, mediaType, size, data, expectedLength? } }.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    sectionId?: string;
    caption?: string;
    file?: unknown;
  };
  if (!body.sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });
  const section = await getNoteSection(user.id, body.sectionId);
  if (!section || section.symbol !== symbol) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const file = sanitizeEvidence(body.file);
  if ("error" in file) return NextResponse.json({ error: file.error }, { status: 400 });

  const complete = file.expectedLength === file.data.length;
  const evidence = await insertDiligenceEvidence(
    user.id,
    symbol,
    section.id,
    file,
    typeof body.caption === "string" ? body.caption : "",
    complete
  );
  return NextResponse.json({ evidence, complete });
}
