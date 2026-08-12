import { NextResponse } from "next/server";
import { generateNoteVisual } from "@/lib/agents/visualize";
import { friendlyAIError } from "@/lib/ai/claude";
import { getNote } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";
import type { VisualKind } from "@/lib/types";

// One interactive Claude call; inline like the suggest route.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

const FORMS = new Set<VisualKind>(["line", "bar", "timeline", "flow"]);

/**
 * The highlight toolkit's visualizer: generate ONE visual spec from a
 * highlighted passage, read against the whole notebook. Nothing persists —
 * the dialog shows the result and keeping it is a separate explicit POST
 * (the keep gate, consistent with the record's other agent contributions).
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const note = await getNote(user.id, id);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    selectedText?: string;
    ask?: string;
    form?: string;
  };
  const selectedText = body.selectedText?.trim() ?? "";
  const ask = body.ask?.trim() ?? "";
  const form = FORMS.has(body.form as VisualKind) ? (body.form as VisualKind) : null;
  if (!selectedText) {
    return NextResponse.json({ error: "no passage selected" }, { status: 400 });
  }
  // The intent gate: the dialog always asks first — a request with neither a
  // lens nor an ask means the client skipped the question stage.
  if (!ask && !form) {
    return NextResponse.json({ error: "say what to visualize first" }, { status: 400 });
  }

  try {
    const lang = await requestLang(user.id);
    const result = await generateNoteVisual(user.id, note, {
      selectedText: selectedText.slice(0, 2000),
      ask: ask.slice(0, 500),
      form,
      lang,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error(`[scalae] note visual (${note.symbol}) failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: friendlyAIError(e) }, { status: 502 });
  }
}
