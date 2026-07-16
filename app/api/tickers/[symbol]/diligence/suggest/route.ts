import { NextResponse } from "next/server";
import { suggestDiligenceSections } from "@/lib/agents/diligence";
import { friendlyAIError } from "@/lib/ai/claude";
import { getTicker } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";
import { localizeSectionSuggestions } from "@/lib/i18n/translate";

// One interactive Claude call; inline like the chat route.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/**
 * Suggest section topics — the board proposing "the right things to look at"
 * for the record (the signals → due-diligence half of the loop). Nothing
 * persists; the investor creates sections themselves.
 */
export async function POST(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const suggestions = await suggestDiligenceSections(user.id, symbol);
    const lang = await requestLang(user.id);
    return NextResponse.json({
      suggestions: await localizeSectionSuggestions(suggestions, lang, { userId: user.id }),
    });
  } catch (e) {
    console.error(`[scalae] diligence suggestions (${symbol}) failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: friendlyAIError(e) }, { status: 502 });
  }
}
