import { NextResponse } from "next/server";
import { refreshDiligenceSynthesis } from "@/lib/agents/diligence";
import { friendlyAIError } from "@/lib/ai/claude";
import { getTicker, saveDiligenceSynthesis } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";
import { localizeDiligenceSynthesis } from "@/lib/i18n/translate";

// One synthesis call over the stored record (no web research) — runs inline
// and returns the fresh synthesis. Same budget idiom as the chat route.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/** Refresh the record's standing synthesis of core insights — on demand only. */
export async function POST(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const synthesis = await refreshDiligenceSynthesis(user.id, symbol);
    const lang = await requestLang(user.id);
    return NextResponse.json({
      synthesis: await localizeDiligenceSynthesis(synthesis, lang, { userId: user.id }),
    });
  } catch (e) {
    console.error(`[scalae] diligence synthesis (${symbol}) failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: friendlyAIError(e) }, { status: 502 });
  }
}

/**
 * Save the investor's own edit of the standing synthesis. The record is
 * theirs — the desk regenerates it only on their ask, and an edit here is
 * simply the record's owner writing in it.
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { content?: string };
  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  const synthesis = await saveDiligenceSynthesis(user.id, symbol, body.content.trim());
  return NextResponse.json({ synthesis });
}
