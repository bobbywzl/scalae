import { NextResponse } from "next/server";
import { getDiligenceEvidenceWithData } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * Serve a filed evidence file's bytes back to its owner. Images and PDFs
 * render inline (thumbnails, in-tab preview); everything else downloads under
 * its original filename. Private to the session — never cached shared.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const evidence = await getDiligenceEvidenceWithData(user.id, id);
  if (!evidence) return NextResponse.json({ error: "not found" }, { status: 404 });

  // kind 'text' stores raw text; every other kind stores base64.
  const bytes =
    evidence.kind === "text"
      ? new TextEncoder().encode(evidence.data)
      : Buffer.from(evidence.data, "base64");
  const inline = evidence.kind === "image" || evidence.kind === "pdf";
  const filename = evidence.name.replace(/["\r\n]/g, "") || "evidence";
  return new NextResponse(bytes, {
    headers: {
      "content-type": evidence.mediaType || "application/octet-stream",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
