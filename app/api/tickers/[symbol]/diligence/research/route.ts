import { NextResponse, after } from "next/server";
import { executeSectionResearch } from "@/lib/agents/diligence";
import {
  createDiligenceResearch,
  getNoteSection,
  getTicker,
  listDiligenceResearch,
  reapStuckDiligence,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";

// The deep-research pass (three grounded sweeps + one memo synthesis) runs
// inside this budget via after(). 300s is the Vercel Hobby ceiling.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/**
 * Kick off a deep-research pass on one section's topic — strictly on the
 * investor's ask (FOUNDATION: research is proposed, never imposed; the result
 * parks at 'pending' for their review). Body: { sectionId, question? }.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { sectionId, question } = (await req.json().catch(() => ({}))) as {
    sectionId?: string;
    question?: string;
  };
  if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });
  const section = await getNoteSection(user.id, sectionId);
  if (!section || section.symbol !== symbol) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // One pass at a time per section — the review gate stays legible.
  await reapStuckDiligence(user.id, symbol);
  const existing = await listDiligenceResearch(user.id, symbol);
  if (existing.some((r) => r.sectionId === sectionId && r.status === "running")) {
    return NextResponse.json(
      { error: "Research is already running on this section." },
      { status: 409 }
    );
  }

  const research = await createDiligenceResearch(
    user.id,
    symbol,
    sectionId,
    typeof question === "string" ? question : ""
  );
  after(() => executeSectionResearch(user.id, research.id));
  return NextResponse.json({ research });
}
