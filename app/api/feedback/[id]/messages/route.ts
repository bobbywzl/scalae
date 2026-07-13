import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sanitizeAttachments } from "@/lib/attachments";
import { addFeedbackMessage, getFeedback } from "@/lib/db";
import type { Attachment } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const MAX_BODY = 5_000;

/** Reply on your own request's thread (re-opens a responded/closed ticket). */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ticket = await getFeedback(id.toUpperCase());
  if (!ticket || ticket.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { message?: unknown; attachments?: unknown };
  const message = String(body.message ?? "").trim();
  const attachments = sanitizeAttachments(body.attachments);
  if ("error" in attachments && !Array.isArray(attachments)) {
    return NextResponse.json({ error: attachments.error }, { status: 400 });
  }
  const files = attachments as Attachment[];
  if (!message && files.length === 0) {
    return NextResponse.json({ error: "Write a reply (or attach a file)." }, { status: 400 });
  }
  if (message.length > MAX_BODY) {
    return NextResponse.json({ error: `Keep the reply under ${MAX_BODY.toLocaleString()} characters.` }, { status: 400 });
  }

  const msg = await addFeedbackMessage(ticket.id, "user", message, files);
  return NextResponse.json({ message: msg }, { status: 201 });
}
