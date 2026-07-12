import { NextResponse, after } from "next/server";
import { handleChatTurn } from "@/lib/agents/chat";
import { friendlyAIError } from "@/lib/ai/claude";
import { executeRun, startRun } from "@/lib/agents/research";
import { getTicker } from "@/lib/db";
import type { Attachment, AttachmentKind } from "@/lib/types";

// A chat turn may kick off a full research run via after(). 300s is the Vercel
// Hobby ceiling; above the plan cap Vercel rejects the deployment.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

const MAX_ATTACHMENTS = 6;
// Caps on base64/text payload length per kind, and per request in total.
const KIND_CAPS: Record<AttachmentKind, number> = {
  image: 3_000_000,
  pdf: 6_000_000,
  text: 400_000,
};
const TOTAL_CAP = 9_000_000;

/** Keep only well-formed attachments with expected fields (drop everything else). */
function sanitizeAttachments(raw: unknown): Attachment[] | { error: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: "attachments must be an array" };
  if (raw.length > MAX_ATTACHMENTS) return { error: `At most ${MAX_ATTACHMENTS} files per message.` };
  const out: Attachment[] = [];
  let total = 0;
  for (const a of raw as Partial<Attachment>[]) {
    const kind = a?.kind as AttachmentKind;
    if (kind !== "image" && kind !== "pdf" && kind !== "text") {
      return { error: "Unsupported attachment kind." };
    }
    if (typeof a.data !== "string" || a.data.length === 0) {
      return { error: "Attachment is missing its data." };
    }
    if (a.data.length > KIND_CAPS[kind]) {
      return { error: `"${a.name ?? "file"}" is too large — attach a smaller ${kind}.` };
    }
    total += a.data.length;
    if (total > TOTAL_CAP) return { error: "Attachments exceed the per-message size limit." };
    out.push({
      kind,
      name: String(a.name ?? "file").slice(0, 200),
      mediaType: String(a.mediaType ?? "").slice(0, 100),
      size: typeof a.size === "number" ? a.size : 0,
      data: a.data,
    });
  }
  return out;
}

/**
 * One chat turn with the desk analyst. Body: { message, attachments? } for a
 * normal turn, or { retry: true } to re-run the analyst on existing history
 * after a failure (the user's message is already persisted).
 */
export async function POST(req: Request, { params }: Params) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!(await getTicker(symbol))) return NextResponse.json({ error: "not found" }, { status: 404 });

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
    const result = await handleChatTurn(symbol, message, { retry, attachments: files });
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
