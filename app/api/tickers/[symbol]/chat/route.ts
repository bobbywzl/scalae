import { NextResponse, after } from "next/server";
import { chatBusyKey, chatCancelKey, chatErrorKey, handleChatTurn } from "@/lib/agents/chat";
import { friendlyAIError } from "@/lib/ai/claude";
import { executeRun, startRun } from "@/lib/agents/research";
import { getTicker, setSetting } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sanitizeAttachments } from "@/lib/attachments";
import { requestLang } from "@/lib/i18n/server";
import type { Attachment } from "@/lib/types";

// A chat turn may kick off a full research run via after(). 300s is the Vercel
// Hobby ceiling; above the plan cap Vercel rejects the deployment.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/**
 * One chat turn with the desk analyst. Body: { message, attachments? } for a
 * normal turn, or { retry: true } to re-run the analyst on existing history
 * after a failure (the user's message is already persisted).
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!(await getTicker(user.id, symbol))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    retry?: boolean;
    attachments?: unknown;
  };
  const retry = body.retry === true;
  const message = (body.message ?? "").trim();
  const attachments = sanitizeAttachments(body.attachments);
  if ("error" in attachments && !Array.isArray(attachments)) {
    return NextResponse.json({ error: attachments.error }, { status: 400 });
  }
  const files = attachments as Attachment[];
  if (!message && files.length === 0 && !retry) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  try {
    const result = await handleChatTurn(user.id, symbol, message, {
      retry,
      attachments: files,
      lang: await requestLang(user.id),
    });
    if (result.startResearch) {
      const { run, started } = await startRun(user.id, symbol);
      if (started) after(() => executeRun(user.id, run.id, symbol));
    }
    return NextResponse.json({
      reply: result.message,
      paused: result.paused === true,
      researchStarted: result.startResearch,
    });
  } catch (e) {
    console.error(`[scalae] chat (${symbol}) failed:`, e instanceof Error ? e.message : e);
    // Record the SPECIFIC failure so the thread shows an honest reason even
    // after a reload (the client may be long gone), and clear the busy marker.
    await setSetting(user.id, chatBusyKey(symbol, null), "").catch(() => {});
    await setSetting(user.id, chatErrorKey(symbol, null), friendlyAIError(e)).catch(() => {});
    return NextResponse.json({ error: friendlyAIError(e), retryable: true }, { status: 502 });
  }
}

/** Pause the in-flight analyst turn: its reply is discarded, no desk action taken. */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  await setSetting(user.id, chatCancelKey(symbol, null), new Date().toISOString()).catch(() => {});
  await setSetting(user.id, chatBusyKey(symbol, null), "").catch(() => {});
  return NextResponse.json({ ok: true });
}
