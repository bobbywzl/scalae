/**
 * Outbound email — used to notify a requester when their support ticket gets a
 * response. Zero dependencies: POSTs to Resend's REST API when RESEND_API_KEY
 * is configured, and silently no-ops when it isn't (the response still appears
 * in the in-app thread; email is an upgrade, not a requirement).
 *
 * Env:
 *   RESEND_API_KEY       — enables sending
 *   FEEDBACK_FROM_EMAIL  — verified sender, e.g. "Scalae <support@yourdomain>"
 *                          (default: Resend's onboarding sender, fine for testing)
 */

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM_EMAIL || "Scalae <onboarding@resend.dev>",
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      console.error("[scalae] email send failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[scalae] email send failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Addresses we can actually reach (the implicit local account has no inbox). */
export function isRealEmail(email: string | null | undefined): boolean {
  return !!email && email.includes("@") && !email.endsWith("@scalae");
}

/**
 * The notification sent when an admin responds to a support request, in the
 * requester's app language (the admin's response body is quoted as written).
 */
export function feedbackResponseEmail(p: {
  requestId: string;
  subject: string;
  response: string;
  origin: string;
  lang?: "en" | "zh";
}): { subject: string; text: string } {
  if (p.lang === "zh") {
    return {
      subject: `[Scalae] 您的请求 ${p.requestId} 有了新回复 — ${p.subject}`,
      text: [
        `您的 Scalae 支持请求 ${p.requestId}（"${p.subject}"）有了新回复：`,
        ``,
        p.response,
        ``,
        `回复或查看完整会话：${p.origin}/support`,
        ``,
        `— Scalae 团队`,
        `请求编号：${p.requestId}（请妥善保存以便查询）`,
      ].join("\n"),
    };
  }
  return {
    subject: `[Scalae] Response to your request ${p.requestId} — ${p.subject}`,
    text: [
      `Your Scalae support request ${p.requestId} ("${p.subject}") has a new response:`,
      ``,
      p.response,
      ``,
      `Reply or review the full thread: ${p.origin}/support`,
      ``,
      `— The Scalae team`,
      `Request ID: ${p.requestId} (keep this for reference)`,
    ].join("\n"),
  };
}
