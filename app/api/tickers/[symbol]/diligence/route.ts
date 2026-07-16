import { NextResponse } from "next/server";
import {
  getDiligenceSynthesis,
  getTicker,
  listDiligenceEvidence,
  listDiligenceResearch,
  listFocusAreas,
  listNoteSections,
  listNotes,
  listSignals,
  reapStuckDiligence,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";
import { localizeDiligencePayload } from "@/lib/i18n/translate";
import type { DiligencePayload } from "@/lib/types";

type Params = { params: Promise<{ symbol: string }> };

/** The due-diligence page payload: the whole record plus board context. */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const ticker = await getTicker(user.id, symbol);
  if (!ticker) return NextResponse.json({ error: "not found" }, { status: 404 });

  await reapStuckDiligence(user.id, symbol);
  const [sections, notes, research, evidence, synthesis, focusAreas, activeSignals] =
    await Promise.all([
      listNoteSections(user.id, symbol),
      listNotes(user.id, symbol),
      listDiligenceResearch(user.id, symbol),
      listDiligenceEvidence(user.id, symbol),
      getDiligenceSynthesis(user.id, symbol),
      listFocusAreas(user.id, symbol),
      listSignals(user.id, symbol, "active"),
    ]);

  const byId = new Map(
    sections.map((s) => [
      s.id,
      { ...s, notes: [] as typeof notes, research: [] as typeof research, evidence: [] as typeof evidence },
    ])
  );
  for (const n of notes) byId.get(n.sectionId)?.notes.push(n);
  for (const r of research) byId.get(r.sectionId)?.research.push(r);
  for (const e of evidence) byId.get(e.sectionId)?.evidence.push(e);

  // Staleness is shown, never acted on: the record changed after the synthesis
  // was written (new section, edited note, accepted memo, filed evidence) —
  // refresh stays a human decision (FOUNDATION: on-demand only).
  let latestActivity = "";
  for (const s of sections) if (s.createdAt > latestActivity) latestActivity = s.createdAt;
  for (const n of notes) if (n.updatedAt > latestActivity) latestActivity = n.updatedAt;
  for (const e of evidence) if (e.createdAt > latestActivity) latestActivity = e.createdAt;
  for (const r of research) {
    if (r.status === "accepted" && r.decidedAt && r.decidedAt > latestActivity) {
      latestActivity = r.decidedAt;
    }
  }
  const synthesisStale = !!synthesis && latestActivity > synthesis.updatedAt;

  const existing = new Set(sections.map((s) => s.title.toLowerCase()));
  const payload: DiligencePayload = {
    ticker,
    sections: [...byId.values()],
    synthesis: synthesis ?? null,
    synthesisStale,
    focusAreaTitles: focusAreas.map((f) => f.title).filter((t) => !existing.has(t.toLowerCase())),
    activeSignals: activeSignals.map((s) => ({ id: s.id, name: s.name, focusArea: s.focusArea })),
  };
  const lang = await requestLang(user.id);
  return NextResponse.json(await localizeDiligencePayload(payload, lang, { userId: user.id }));
}
