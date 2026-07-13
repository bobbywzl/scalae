import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sanitizeAttachments } from "@/lib/attachments";
import { countRecentFeedback, createFeedback, listFeedback } from "@/lib/db";
import type { Attachment, FeedbackCategory } from "@/lib/types";

const CATEGORIES = new Set<FeedbackCategory>(["bug", "idea", "question", "account", "other"]);
const MAX_SUBJECT = 120;
const MAX_BODY = 5_000;
const MAX_TICKETS_PER_DAY = 10;

/** The signed-in user's support requests, newest activity first. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ rows: await listFeedback(user.id) });
}

/** File a new support request (with optional evidence attachments). */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    category?: unknown;
    subject?: unknown;
    message?: unknown;
    attachments?: unknown;
  };
  const category = body.category as FeedbackCategory;
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Pick a category for the request." }, { status: 400 });
  }
  const subject = String(body.subject ?? "").trim().slice(0, MAX_SUBJECT);
  const message = String(body.message ?? "").trim();
  if (!subject) return NextResponse.json({ error: "Give the request a short subject." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Describe the issue or idea." }, { status: 400 });
  if (message.length > MAX_BODY) {
    return NextResponse.json({ error: `Keep the description under ${MAX_BODY.toLocaleString()} characters.` }, { status: 400 });
  }
  const attachments = sanitizeAttachments(body.attachments);
  if ("error" in attachments && !Array.isArray(attachments)) {
    return NextResponse.json({ error: attachments.error }, { status: 400 });
  }

  if ((await countRecentFeedback(user.id)) >= MAX_TICKETS_PER_DAY) {
    return NextResponse.json(
      { error: "You've filed quite a few requests today — please add to an existing thread instead." },
      { status: 429 }
    );
  }

  const ticket = await createFeedback(user.id, category, subject, message, attachments as Attachment[]);
  return NextResponse.json({ ticket }, { status: 201 });
}
