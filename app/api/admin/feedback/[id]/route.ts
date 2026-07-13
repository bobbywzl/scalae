import { NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/admin-auth";
import { appOrigin } from "@/lib/auth";
import { addFeedbackMessage, getFeedback, getSetting, getUser, setFeedbackStatus } from "@/lib/db";
import { feedbackResponseEmail, isRealEmail, sendEmail } from "@/lib/email";
import { isLang } from "@/lib/i18n/config";
import type { FeedbackStatus } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const MAX_BODY = 5_000;

/** Full thread for any ticket (admin view, attachment payloads included). */
export async function GET(_req: Request, { params }: Params) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const { id } = await params;
  const ticket = await getFeedback(id.toUpperCase());
  if (!ticket) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

/**
 * Respond and/or set status. Body: { message?, status? }. A response marks the
 * ticket "responded" and emails the requester (when email is configured and
 * the account has a real address); an explicit status then overrides — so
 * "reply and close" works in one call.
 */
export async function POST(req: Request, { params }: Params) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const { id } = await params;
  const ticket = await getFeedback(id.toUpperCase());
  if (!ticket) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { message?: unknown; status?: unknown };
  const message = String(body.message ?? "").trim();
  const status = body.status as FeedbackStatus | undefined;
  if (status !== undefined && status !== "open" && status !== "responded" && status !== "closed") {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (!message && !status) {
    return NextResponse.json({ error: "Provide a response message and/or a status." }, { status: 400 });
  }
  if (message.length > MAX_BODY) {
    return NextResponse.json({ error: `Keep the response under ${MAX_BODY.toLocaleString()} characters.` }, { status: 400 });
  }

  let emailed = false;
  if (message) {
    await addFeedbackMessage(ticket.id, "admin", message, []);
    const requester = await getUser(ticket.userId);
    if (requester && isRealEmail(requester.email)) {
      // Notify in the requester's app language (their account setting).
      const requesterLang = await getSetting(ticket.userId, "language").catch(() => null);
      const mail = feedbackResponseEmail({
        requestId: ticket.id,
        subject: ticket.subject,
        response: message,
        origin: appOrigin(req),
        lang: isLang(requesterLang) ? requesterLang : "en",
      });
      emailed = await sendEmail({ to: requester.email, ...mail });
    }
  }
  if (status) await setFeedbackStatus(ticket.id, status);

  return NextResponse.json({ ok: true, emailed, ticket: await getFeedback(ticket.id) });
}
