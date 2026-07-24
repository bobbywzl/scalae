import { NextResponse, after } from "next/server";
import {
  chatBusyKey,
  chatCancelKey,
  chatErrorKey,
  chatTurnBusy,
  chatTurnError,
  handleChatTurn,
} from "@/lib/agents/chat";
import { friendlyAIError } from "@/lib/ai/claude";
import { executeRun, startRun } from "@/lib/agents/research";
import { getSignal, listMessages, setSetting } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";
import type { Attachment } from "@/lib/types";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/** The signal's focused chat history (separate thread from the ticker desk). */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal || (signal.userId && signal.userId !== user.id))
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const [messages, analystBusy, analystError] = await Promise.all([
    listMessages(user.id, signal.symbol, 200, { signalId: id }),
    chatTurnBusy(user.id, signal.symbol, id),
    chatTurnError(user.id, signal.symbol, id),
  ]);
  return NextResponse.json({ messages, analystBusy, analystError });
}

/**
 * One chat turn with the analyst, scoped to this signal: same analyst and
 * desk powers, context narrowed to the signal's thesis, readings and evidence.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal || (signal.userId && signal.userId !== user.id))
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    retry?: boolean;
    attachments?: Attachment[];
  };
  const retry = body.retry === true;
  const message = (body.message ?? "").trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!message && attachments.length === 0 && !retry) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  try {
    const result = await handleChatTurn(user.id, signal.symbol, message, {
      retry,
      attachments,
      signalId: id,
      lang: await requestLang(user.id),
    });
    if (result.startResearch) {
      const { run, started } = await startRun(user.id, signal.symbol);
      if (started) after(() => executeRun(user.id, run.id, signal.symbol));
    }
    return NextResponse.json({
      reply: result.message,
      paused: result.paused === true,
      researchStarted: result.startResearch,
    });
  } catch (e) {
    console.error(`[scalae] signal chat (${id}) failed:`, e instanceof Error ? e.message : e);
    // Record the SPECIFIC failure for this signal's thread and clear busy, so
    // the state stays honest across reloads.
    await setSetting(user.id, chatBusyKey(signal.symbol, id), "").catch(() => {});
    await setSetting(user.id, chatErrorKey(signal.symbol, id), friendlyAIError(e)).catch(() => {});
    return NextResponse.json({ error: friendlyAIError(e), retryable: true }, { status: 502 });
  }
}

/** Pause the in-flight analyst turn on this signal's thread. */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal || (signal.userId && signal.userId !== user.id))
    return NextResponse.json({ error: "not found" }, { status: 404 });
  await setSetting(user.id, chatCancelKey(signal.symbol, id), new Date().toISOString()).catch(() => {});
  await setSetting(user.id, chatBusyKey(signal.symbol, id), "").catch(() => {});
  return NextResponse.json({ ok: true });
}
