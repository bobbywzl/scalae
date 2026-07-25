import { NextResponse } from "next/server";
import {
  finChatBusyKey,
  finChatCancelKey,
  finChatErrorKey,
  handleFinAnalystTurn,
} from "@/lib/agents/cleansing";
import { friendlyAIError } from "@/lib/ai/claude";
import { getTicker, setSetting } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";

// One analyst turn (flagship call over the bench context). 300s ceiling.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/**
 * One turn with the financial analyst desk. Body: { message } for a normal
 * turn, or { retry: true } to re-run the analyst on existing history after a
 * failure (the user's message is already persisted).
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { message?: string; retry?: boolean };
  const retry = body.retry === true;
  const message = (body.message ?? "").trim();
  if (!message && !retry) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  try {
    const result = await handleFinAnalystTurn(user.id, symbol, message, {
      retry,
      lang: await requestLang(user.id),
    });
    return NextResponse.json({ reply: result.message, paused: result.paused === true });
  } catch (e) {
    console.error(`[scalae] fin analyst chat (${symbol}) failed:`, e instanceof Error ? e.message : e);
    // Record the SPECIFIC failure so the thread shows an honest reason even
    // after a reload, and clear the busy marker (the chat route's idiom).
    await setSetting(user.id, finChatBusyKey(symbol), "").catch(() => {});
    await setSetting(user.id, finChatErrorKey(symbol), friendlyAIError(e)).catch(() => {});
    return NextResponse.json({ error: friendlyAIError(e), retryable: true }, { status: 502 });
  }
}

/** Pause the in-flight analyst turn: its reply is discarded, no bench action taken. */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  await setSetting(user.id, finChatCancelKey(symbol), new Date().toISOString()).catch(() => {});
  await setSetting(user.id, finChatBusyKey(symbol), "").catch(() => {});
  return NextResponse.json({ ok: true });
}
