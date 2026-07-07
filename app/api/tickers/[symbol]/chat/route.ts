import { NextResponse, after } from "next/server";
import { handleChatTurn } from "@/lib/agents/chat";
import { friendlyAIError } from "@/lib/ai/claude";
import { executeRun, startRun } from "@/lib/agents/research";
import { getTicker } from "@/lib/db";

export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/**
 * One chat turn with the desk analyst. Body: { message } for a normal turn,
 * or { retry: true } to re-run the analyst on existing history after a
 * failure (the user's message is already persisted).
 */
export async function POST(req: Request, { params }: Params) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!(await getTicker(symbol))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { message?: string; retry?: boolean };
  const retry = body.retry === true;
  const message = (body.message ?? "").trim();
  if (!message && !retry) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  try {
    const result = await handleChatTurn(symbol, message, { retry });
    if (result.startResearch) {
      const { run, started } = await startRun(symbol);
      if (started) after(() => executeRun(run.id, symbol));
    }
    return NextResponse.json({ reply: result.message, researchStarted: result.startResearch });
  } catch (e) {
    console.error(`[scalae] chat (${symbol}) failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: friendlyAIError(e), retryable: true }, { status: 502 });
  }
}
