import { claudeJSON, effortFromEnv } from "../ai/claude";
import { CLAUDE_OVERLOAD_FALLBACK } from "../ai/fallback";
import { resolveModel } from "../ai/models";
import { withDeadline } from "./research";
import { DESK_DOCTRINE, deskIdentity, NOTE_VISUAL_DOCTRINE, NOTE_VISUAL_SCHEMA } from "./framework";
import {
  getDiligenceSynthesis,
  getTicker,
  listNoteSections,
  listNotes,
} from "../db";
import type { Lang } from "../i18n/config";
import { docToPlainText } from "../notes";
import { normalizeVisualSpec } from "../visual-spec";
import type { Note, VisualKind, VisualSpec } from "../types";

/**
 * The note visualizer — the highlight toolkit's chart tool. One interactive
 * call on the investor's explicit ask: read the highlighted passage against
 * the WHOLE notebook (the containing notepad in full, the section's sibling
 * notes, the rest of the record in excerpt, the standing synthesis) and emit
 * one visual spec — or an honest "insufficient". Nothing here persists;
 * keeping the visual is a separate explicit gesture (the keep route).
 */

/** What the generator returns: a renderable spec, or an honest decline. */
export type VisualResult = { spec: VisualSpec } | { insufficient: string };

/** Flat model output per NOTE_VISUAL_SCHEMA (all fields required, "" = unused). */
interface RawVisualOutput {
  result: "chart" | "insufficient";
  reason: string;
  kind: VisualKind;
  title: string;
  subtitle: string;
  unit: string;
  series: { name: string; points: { x: string; y: number }[] }[];
  events: { date: string; label: string; detail: string }[];
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; label: string }[];
  sourceNote: string;
  caveat: string;
}

// The dialog waits synchronously — one bounded interactive call.
const VISUALIZE_LIMIT_MS = 120_000;

/** Human name of each form for the prompt (the ask may arrive as a form pick only). */
const FORM_JOB: Record<VisualKind, string> = {
  line: "a trend over time (line)",
  bar: "a magnitude comparison across named things (bar)",
  timeline: "a sequence of dated events (timeline)",
  flow: "a mechanism / relationship map (flow)",
};

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

export async function generateNoteVisual(
  userId: string,
  note: Note,
  input: { selectedText: string; ask: string; form: VisualKind | null; lang: Lang }
): Promise<VisualResult> {
  const ticker = await getTicker(userId, note.symbol);
  if (!ticker) throw new Error(`Unknown ticker ${note.symbol}`);
  const [sections, notes, synthesis] = await Promise.all([
    listNoteSections(userId, note.symbol),
    listNotes(userId, note.symbol),
    getDiligenceSynthesis(userId, note.symbol),
  ]);
  const section = sections.find((s) => s.id === note.sectionId);

  // The whole notebook, budgeted from the passage outward: the containing
  // notepad in full, its section siblings next, the rest of the record as a
  // titled map with excerpts — closeness to the highlight buys detail.
  const noteText = clean(docToPlainText(note.content), 9000);
  const siblingLines = notes
    .filter((n) => n.sectionId === note.sectionId && n.id !== note.id)
    .map((n) => {
      const text = clean(docToPlainText(n.content), 1100);
      return text ? `• ${n.title ? `${n.title}: ` : ""}${text}` : "";
    })
    .filter(Boolean);
  let siblingBudget = 5000;
  const siblings = siblingLines.filter((l) => (siblingBudget -= l.length) > 0).join("\n");

  const restLines: string[] = [];
  let restBudget = 2800;
  for (const s of sections) {
    if (s.id === note.sectionId) continue;
    const heads = notes
      .filter((n) => n.sectionId === s.id)
      .map((n) => {
        const text = clean(docToPlainText(n.content), 220);
        return text ? `  - ${n.title ? `${n.title}: ` : ""}${text}` : "";
      })
      .filter(Boolean);
    const block = [`## ${s.title}`, ...(heads.length ? heads : ["  - (nothing written yet)"])].join("\n");
    if ((restBudget -= block.length) < 0) break;
    restLines.push(block);
  }

  const task = `Today is ${new Date().toDateString()}.

THE HIGHLIGHTED PASSAGE (the subject of the visual — from the notepad below):
"${clean(input.selectedText, 2000)}"

THE INVESTOR'S ASK: ${input.ask.trim() ? clean(input.ask, 500) : "(none — they picked a lens only)"}
REQUESTED FORM: ${input.form ? FORM_JOB[input.form] : "(the desk's choice — pick the form the record supports)"}

THE NOTEPAD THE PASSAGE LIVES IN — "${note.title || "untitled"}" in section "${section?.title ?? "—"}" — full text:
${noteText || "(empty)"}

THE SECTION'S OTHER NOTES:
${siblings || "(none)"}

THE REST OF THE RECORD (titled sections with excerpts — context only, same iron rule):
${restLines.join("\n") || "(no other sections)"}

${synthesis?.content ? `THE RECORD'S STANDING SYNTHESIS (the investor's own distillation):\n${clean(synthesis.content, 700)}\n` : ""}
TASK: Per the visual doctrine, draw the ONE visual that answers the ask from THIS record — or return result "insufficient" with a plain reason. The passage is the subject; the rest of the notebook may supply the passage's numbers and context, but nothing outside this material may.

LANGUAGE: Write title, subtitle, labels, sourceNote, caveat and reason in ${input.lang === "zh" ? "简体中文" : "English"} — this visual belongs to the investor's own notebook, in the language they are working in.`;

  // An explicit ask on the record — the diligence role's tier (see lib/ai/models).
  const model = await resolveModel("diligence");
  const out = await withDeadline(
    "note-visual",
    (signal) =>
      claudeJSON<RawVisualOutput>({
        model,
        signal,
        system: [
          { text: DESK_DOCTRINE, cache: true },
          { text: `${deskIdentity(note.symbol, ticker.name)}\n\n${NOTE_VISUAL_DOCTRINE}` },
        ],
        messages: [{ role: "user", content: task }],
        schema: NOTE_VISUAL_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 6000,
        // Interactive dialog: low effort answers in seconds; raise via env
        // once latency headroom is proven (the README's effort doctrine).
        effort: effortFromEnv("CLAUDE_VISUALIZE_EFFORT", "low"),
        fallbackModel: CLAUDE_OVERLOAD_FALLBACK,
        meta: { userId, feature: "visualize" },
      }),
    VISUALIZE_LIMIT_MS
  );

  if (out.result === "insufficient") {
    return { insufficient: clean(out.reason, 400) || "The record does not support this visual yet." };
  }
  const spec = normalizeVisualSpec(out);
  if (!spec) {
    // The model said "chart" but the drawing fields don't survive the bounds —
    // surface it as the honest decline it actually is, never a broken card.
    return {
      insufficient:
        clean(out.reason, 400) ||
        "The desk could not draw a well-formed visual from the record — try a narrower ask.",
    };
  }
  return { spec };
}
