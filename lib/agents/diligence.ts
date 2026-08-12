import type Anthropic from "@anthropic-ai/sdk";
import { claudeJSON } from "../ai/claude";
import { geminiGroundedSearch } from "../ai/gemini";
import { resolveModel } from "../ai/models";
import { withDomain } from "../citations";
import { attachmentBlocks } from "./chat";
import { cleansingBenchContext } from "./context";
import { withDeadline } from "./research";
import {
  DESK_DOCTRINE,
  deskIdentity,
  DILIGENCE_MEMO_DOCTRINE,
  DILIGENCE_MEMO_SCHEMA,
  DILIGENCE_SYNTHESIS_DOCTRINE,
  DILIGENCE_SYNTHESIS_SCHEMA,
  SECTION_SUGGESTIONS_SCHEMA,
} from "./framework";
import {
  diligenceResearchStatus,
  evidenceDataForSection,
  failDiligenceResearch,
  finishDiligenceResearch,
  getDiligenceResearch,
  getDiligenceSynthesis,
  getNoteSection,
  getTicker,
  latestRun,
  listDiligenceEvidence,
  listDiligenceResearch,
  listFocusAreas,
  listNoteSections,
  listNotes,
  listSignals,
  readingsForSignal,
  saveDiligenceSynthesis,
} from "../db";
import { docToPlainText } from "../notes";
import type {
  Attachment,
  Citation,
  DiligenceEvidence,
  DiligenceSynthesis,
  NoteSection,
  SectionSuggestion,
  Ticker,
} from "../types";

/**
 * The due-diligence record's agents (FOUNDATION.md: "The due-diligence record
 * is the desk's centre"). Everything here runs ONLY on the investor's explicit
 * ask, and nothing here writes into the record itself — a finished research
 * pass parks at status 'pending' for the investor's accept/dismiss review, and
 * the synthesis is a separate standing document, never the investor's notes.
 */

interface MemoOutput {
  memo: string;
  insights: string;
}

// The deep-research route runs within a 300s maxDuration budget: three
// parallel sweeps (internally capped at ~120s each by lib/ai/gemini) followed
// by one synthesis call, which gets the larger share of what remains.
const SWEEP_LIMIT_MS = 120_000;
const MEMO_SYNTHESIS_LIMIT_MS = 150_000;

const DD_SCOUT_RULES = `Be exhaustively company- and industry-specific: name the company, its predecessors, its actual competitors, regulators and industry events — never generic "the market" narrative. Date everything. Prefer authentic and primary sources — filings, transcripts, regulator documents, the company's own archival record, serious trade press and business histories — over aggregator retellings, and note when a finding's only source is an interested party. Skip stock-price commentary and analyst target chatter. Label anything unverifiable "(unverified)"; where a period's record is genuinely thin, say so plainly rather than filling the gap.`;

/** The section's world as text: the topic, the investor's notes, prior memos. */
interface SectionRecord {
  section: NoteSection;
  /** Plain-text of the section's notepads (the investor's own words). */
  notesText: string;
  /** Insights from earlier ACCEPTED memos on this section (newest first). */
  priorInsights: string[];
}

async function loadSectionRecord(
  userId: string,
  symbol: string,
  sectionId: string
): Promise<SectionRecord | null> {
  const section = await getNoteSection(userId, sectionId);
  if (!section || section.symbol !== symbol) return null;
  const [notes, research] = await Promise.all([
    listNotes(userId, symbol),
    listDiligenceResearch(userId, symbol),
  ]);
  const notesText = notes
    .filter((n) => n.sectionId === sectionId)
    .map((n) => {
      const text = docToPlainText(n.content).replace(/\s+/g, " ").slice(0, 900);
      return text ? `• ${n.title ? `${n.title}: ` : ""}${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
  const priorInsights = research
    .filter((r) => r.sectionId === sectionId && r.status === "accepted" && r.insights)
    .map((r) => `(${r.createdAt.slice(0, 10)}) ${r.insights}`);
  return { section, notesText, priorInsights };
}

/** One evidence line for prompts: caption first (the investor's words), then the file. */
export function evidenceLine(e: DiligenceEvidence): string {
  return `- ${e.caption ? `"${e.caption}"` : "(no caption)"} — ${e.name} (${e.kind}, filed ${e.createdAt.slice(0, 10)})`;
}

/**
 * The section's evidence locker, prepared for the memo call: a metadata list
 * of EVERY filed item (any kind), plus Claude content blocks for the
 * machine-readable ones (image/pdf/text) within a total payload budget —
 * the memo agent reads what it can and knows about the rest.
 */
// Bounded by the model API's total-request ceiling with room for the sweeps
// and system prompt; files past the budget stay caption-only in the prompt.
const EVIDENCE_INLINE_BUDGET = 10_000_000;

async function loadSectionEvidence(
  userId: string,
  sectionId: string
): Promise<{ listText: string; blocks: Anthropic.ContentBlockParam[] }> {
  const rows = await evidenceDataForSection(userId, sectionId).catch(() => []);
  if (rows.length === 0) return { listText: "", blocks: [] };
  const blocks: Anthropic.ContentBlockParam[] = [];
  let budget = EVIDENCE_INLINE_BUDGET;
  const lines: string[] = [];
  for (const e of rows) {
    const readable = e.kind !== "file" && e.data.length <= budget;
    lines.push(`${evidenceLine(e)}${readable ? "" : " — not machine-readable here; judge it from its caption"}`);
    if (!readable) continue;
    budget -= e.data.length;
    // Caption travels immediately before its file so the model can pair them.
    blocks.push({
      type: "text",
      text: `Filed evidence "${e.name}"${e.caption ? ` — investor's caption: ${e.caption}` : ""}:`,
    });
    blocks.push(
      ...attachmentBlocks([
        { kind: e.kind, name: e.name, mediaType: e.mediaType, size: e.size, data: e.data } as Attachment,
      ])
    );
  }
  return { listText: lines.join("\n"), blocks };
}

// ---------------------------------------------------------------------------
// Scout prompts — three angles on one section topic: the long-horizon company
// record, the outside (industry/base-rate) view, and the authentic current
// state. Mirrors the daily pipeline's idiom at topic depth instead of breadth.
// ---------------------------------------------------------------------------

function topicLine(t: Ticker, rec: SectionRecord, question: string): string {
  return `The due-diligence topic: "${rec.section.title}" for ${t.name} (${t.symbol}).${
    question.trim() ? ` The investor's steer for this pass: ${question.trim()}` : ""
  }`;
}

function topicHistoryPrompt(t: Ticker, rec: SectionRecord, question: string): string {
  return `You are a business-history researcher for a Buffett-style value-investing desk covering ${t.name} (${t.symbol}). Today is ${new Date().toDateString()}.

${topicLine(t, rec, question)}

Trace the LONG-HORIZON COMPANY RECORD of this topic: how this aspect of ${t.name} actually evolved over years and decades — its origins, the management decisions and inflection points that shaped it, rough levels or trajectories per era where numbers exist, and the stress episodes (recessions, price wars, scandals, regulatory strikes, the company's own crises) that tested it, with how it fared through each. Go as far back as the public record supports. ${DD_SCOUT_RULES}`;
}

function topicOutsidePrompt(t: Ticker, rec: SectionRecord, question: string): string {
  return `You are a research scout for a Buffett-style value-investing desk covering ${t.name} (${t.symbol}). Today is ${new Date().toDateString()}.

${topicLine(t, rec, question)}

Build the OUTSIDE VIEW of this topic: how it looks across ${t.name}'s actual industry and closest competitors — the industry's structural record on this aspect (consolidation, price wars, capacity cycles, substitution, regulation), which competitors' versions of it strengthened, weakened or died (name them — the failures are the base rates), where ${t.name} sits relative to peers today, and specifically the DISCONFIRMING evidence: findings that cut against the obvious bull reading of this topic for ${t.name}. ${DD_SCOUT_RULES}`;
}

function topicCurrentPrompt(t: Ticker, rec: SectionRecord, question: string): string {
  return `You are a primary-source research scout for a Buffett-style value-investing desk covering ${t.name} (${t.symbol}). Today is ${new Date().toDateString()}.

${topicLine(t, rec, question)}

Establish the AUTHENTIC CURRENT STATE of this topic from roughly the last 12-18 months, favouring the company's and regulators' own words over press retellings: securities filings and exchange disclosures, earnings releases and call transcripts, proxy statements and incentive disclosures, investor-relations materials, regulator filings/orders, court documents, plus substantive trade-press reporting. For each document: what it actually says on this topic (with the concrete numbers), and any gap between the primary source and how the press has characterized it. ${DD_SCOUT_RULES}`;
}

// ---------------------------------------------------------------------------
// The deep-research pass (kicked off by the route via after()).
// ---------------------------------------------------------------------------

/**
 * Execute a deep-research pass created by the route: three parallel grounded
 * sweeps on the section's topic, then one memo synthesis against the
 * investor's existing record. Finishes at status 'pending' (the review gate) —
 * never writes into the record itself. Failures land at status 'error'.
 */
export async function executeSectionResearch(
  userId: string,
  researchId: string
): Promise<void> {
  try {
    const research = await getDiligenceResearch(userId, researchId);
    if (!research || research.status !== "running") return;
    const ticker = await getTicker(userId, research.symbol);
    if (!ticker) throw new Error(`Unknown ticker ${research.symbol}`);
    const rec = await loadSectionRecord(userId, research.symbol, research.sectionId);
    if (!rec) throw new Error("Unknown section for this desk.");
    const filed = await loadSectionEvidence(userId, research.sectionId);

    const [deepModel, memoModel] = await Promise.all([
      resolveModel("scoutDeep"),
      resolveModel("diligence"),
    ]);

    const jobs = [
      { label: "Company record", prompt: topicHistoryPrompt(ticker, rec, research.question) },
      { label: "Outside view", prompt: topicOutsidePrompt(ticker, rec, research.question) },
      { label: "Authentic current state", prompt: topicCurrentPrompt(ticker, rec, research.question) },
    ];
    const settled = await Promise.allSettled(
      jobs.map((j) =>
        withDeadline(
          `dd-sweep:${j.label}`,
          (signal) =>
            geminiGroundedSearch(j.prompt, {
              model: deepModel,
              meta: { userId, feature: "diligence" },
              signal,
            }),
          SWEEP_LIMIT_MS
        ).then((r) => ({ label: j.label, text: r.text, sources: r.sources }))
      )
    );
    const sweeps = settled
      .filter(
        (s): s is PromiseFulfilledResult<{ label: string; text: string; sources: Citation[] }> =>
          s.status === "fulfilled"
      )
      .map((s) => s.value);
    if (sweeps.length === 0) throw new Error("All research sweeps failed — try again.");

    // Cooperative cancellation: the investor may have stopped this pass while
    // the sweeps ran — bail before spending the memo synthesis. (The finish/
    // fail guards below are running-only, so a stopped row can't resurrect
    // regardless; this checkpoint just saves the flagship call.)
    if ((await diligenceResearchStatus(researchId)) !== "running") {
      console.log(`[scalae] due-diligence research ${researchId} stopped by the investor.`);
      return;
    }

    // Number the deduped sources so the memo cites [n] (the runs' idiom).
    const allSources: Citation[] = [];
    const indexOf = new Map<string, number>();
    for (const s of sweeps) {
      for (const src of s.sources) {
        if (!indexOf.has(src.url)) {
          indexOf.set(src.url, allSources.length);
          allSources.push(withDomain({ ...src, foundBy: [`Diligence: ${s.label}`] }));
        }
      }
    }

    // Board + bench context: what the desk already watches and how the
    // investor reads the numbers, so the memo speaks to the same connected
    // desk the investor sees (signals ↔ financials ↔ this record).
    const [signals, benchBlock] = await Promise.all([
      listSignals(userId, research.symbol, "active"),
      cleansingBenchContext(userId, research.symbol).catch(() => ""),
    ]);
    const boardLines = (
      await Promise.all(
        signals.map(async (s) => {
          const latest = (await readingsForSignal(s.id, 1))[0];
          return `- "${s.name}" (${s.focusArea})${latest ? ` — latest: ${latest.level}` : ""}`;
        })
      )
    ).join("\n");

    const researchBlock = sweeps
      .map(
        (s) =>
          `=== ${s.label} ===\n${s.text}\nSources used by this sweep: ${
            s.sources.map((src) => `[${indexOf.get(src.url)}] ${src.title}`).join(", ") || "(none)"
          }`
      )
      .join("\n\n");
    const sourceList = allSources.map((s, i) => `[${i}] ${s.title} — ${s.url}`).join("\n");

    const task = `Today is ${new Date().toDateString()}.

THE DUE-DILIGENCE SECTION THIS MEMO SERVES:
"${rec.section.title}"${research.question.trim() ? `\nThe investor's steer for this pass: ${research.question.trim()}` : ""}

THE INVESTOR'S OWN NOTES IN THIS SECTION (verbatim; engage with them by name, never contradict silently):
${rec.notesText || "(nothing written yet)"}

THE INVESTOR'S FILED EVIDENCE IN THIS SECTION (their captions are their words — machine-readable files are attached above this message; engage each by filename, and treat captions as the investor's claims about what the file shows, to be weighed like any interested-party framing):
${filed.listText || "(none filed)"}

EARLIER ACCEPTED RESEARCH ON THIS SECTION (extend the record, do not re-narrate it):
${rec.priorInsights.join("\n") || "(none)"}

THE DESK'S ACTIVE SIGNAL BOARD (for reference, so the memo speaks to what is already watched):
${boardLines || "(no active signals)"}

${benchBlock ? `THE REPORTED NUMBERS AND THE INVESTOR'S CLEANSED VIEW (for reference — engage where the topic touches the financial record):\n${benchBlock}\n` : ""}
FIELD RESEARCH (three grounded sweeps on this topic; numbered sources listed at the end):
${researchBlock}

NUMBERED SOURCES:
${sourceList || "(none)"}

TASK: Write the section's deep-research memo per the memo doctrine — long-horizon arc first, authentic sources weighed by their incentive origin, framework anchoring in plain prose, engagement with the investor's existing notes, disconfirming evidence leading, [n] citations on load-bearing claims, closing with "What this settles and what it doesn't" and "Worth watching". Also produce the 2-4 sentence "insights" distillation for the record's standing synthesis.

LANGUAGE: Write every output field in English — the record's stored form is canonical English; the app translates for display.`;

    const out = await withDeadline(
      "dd-memo",
      (signal) =>
        claudeJSON<MemoOutput>({
          model: memoModel,
          signal,
          system: [
            { text: DESK_DOCTRINE, cache: true },
            { text: `${deskIdentity(research.symbol, ticker.name)}\n\n${DILIGENCE_MEMO_DOCTRINE}` },
          ],
          // Filed evidence rides first (each file preceded by its caption),
          // the research task last — same reading order the prompt describes.
          messages: [
            { role: "user", content: [...filed.blocks, { type: "text", text: task }] },
          ],
          schema: DILIGENCE_MEMO_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 10000,
          effort: "medium",
          meta: { userId, feature: "diligence" },
        }),
      MEMO_SYNTHESIS_LIMIT_MS
    );

    const memo = out.memo?.trim();
    if (!memo) throw new Error("Memo synthesis came back empty — try again.");
    await finishDiligenceResearch(
      researchId,
      memo,
      (out.insights ?? "").trim().slice(0, 600),
      allSources
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[scalae] due-diligence research ${researchId} failed:`, msg);
    await failDiligenceResearch(researchId, msg).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// The standing synthesis of core insights (refreshed on the investor's ask).
// ---------------------------------------------------------------------------

interface SynthesisOutput {
  synthesis: string;
}

/**
 * Distill the whole record — sections, the investor's notes, accepted memos —
 * plus the board's current state into the standing synthesis. Pure synthesis
 * of what the record already contains: no web research, no new facts.
 */
export async function refreshDiligenceSynthesis(
  userId: string,
  symbol: string
): Promise<DiligenceSynthesis> {
  const ticker = await getTicker(userId, symbol);
  if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
  const [sections, notes, research, evidence, signals, focusAreas, run, benchBlock] = await Promise.all([
    listNoteSections(userId, symbol),
    listNotes(userId, symbol),
    listDiligenceResearch(userId, symbol),
    listDiligenceEvidence(userId, symbol),
    listSignals(userId, symbol, "active"),
    listFocusAreas(userId, symbol),
    latestRun(userId, symbol),
    cleansingBenchContext(userId, symbol).catch(() => ""),
  ]);
  if (sections.length === 0) throw new Error("Open at least one section before synthesizing.");

  const notesBySection = new Map<string, string[]>();
  for (const n of notes) {
    const text = docToPlainText(n.content).replace(/\s+/g, " ").slice(0, 1200);
    if (!text) continue;
    if (!notesBySection.has(n.sectionId)) notesBySection.set(n.sectionId, []);
    notesBySection.get(n.sectionId)!.push(`${n.title ? `${n.title}: ` : ""}${text}`);
  }
  const accepted = research.filter((r) => r.status === "accepted");
  const recordBlock = sections
    .map((s) => {
      const parts: string[] = [`## ${s.title}`];
      for (const r of accepted.filter((r) => r.sectionId === s.id)) {
        parts.push(`Accepted desk research (${r.createdAt.slice(0, 10)}): ${r.insights ?? ""}`);
      }
      const ns = notesBySection.get(s.id) ?? [];
      for (const t of ns) parts.push(`Investor note — ${t}`);
      for (const e of evidence.filter((e) => e.sectionId === s.id)) {
        parts.push(`Filed evidence ${evidenceLine(e).slice(2)}`);
      }
      if (parts.length === 1) parts.push("(section opened, nothing written yet)");
      return parts.join("\n");
    })
    .join("\n\n");

  const boardLines = (
    await Promise.all(
      signals.map(async (s) => {
        const latest = (await readingsForSignal(s.id, 1))[0];
        return `- "${s.name}" (${s.focusArea})${latest ? `: ${latest.level} — ${latest.rationale.slice(0, 140)}` : ": no readings yet"}`;
      })
    )
  ).join("\n");

  const task = `Today is ${new Date().toDateString()}.

THE DUE-DILIGENCE RECORD (every section, the investor's notes, accepted desk research):
${recordBlock}

FOCUS AREAS: ${focusAreas.map((f) => f.title).join("; ") || "(none)"}

THE SIGNAL BOARD'S CURRENT READINGS (for the tensions check — where the record and the board disagree):
${boardLines || "(no active signals)"}

${benchBlock ? `THE REPORTED NUMBERS AND THE INVESTOR'S CLEANSED VIEW (for the tensions check too — where the record and the numbers disagree):\n${benchBlock}\n` : ""}
${run?.dossier ? `THE DESK'S STANDING DOSSIER (the board's own synthesis, for contrast):\n${run.dossier}` : ""}

TASK: Write the standing synthesis of this record per the synthesis doctrine — the thesis as written (referring to sections by their **bolded titles**), the tensions, and the open fronts where the circle of competence should expand next. Work ONLY from the material above.

LANGUAGE: Write in English — the record's stored form is canonical English; the app translates for display.`;

  const out = await claudeJSON<SynthesisOutput>({
    model: await resolveModel("diligence"),
    system: [
      { text: DESK_DOCTRINE, cache: true },
      { text: `${deskIdentity(symbol, ticker.name)}\n\n${DILIGENCE_SYNTHESIS_DOCTRINE}` },
    ],
    messages: [{ role: "user", content: task }],
    schema: DILIGENCE_SYNTHESIS_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 6000,
    effort: "medium",
    meta: { userId, feature: "diligence" },
  });
  const content = out.synthesis?.trim();
  if (!content) throw new Error("Synthesis came back empty — try again.");
  return saveDiligenceSynthesis(userId, symbol, content);
}

// ---------------------------------------------------------------------------
// Section-topic suggestions — the signal board proposing "the right things to
// look at" when the investor is organizing due diligence.
// ---------------------------------------------------------------------------

interface SuggestionsOutput {
  suggestions: SectionSuggestion[];
}

/**
 * Suggest 3-6 section topics from the desk's current picture: the board's
 * signals and focus areas, the dossier, minus everything the record already
 * covers. Suggestions are chips the investor may click — nothing persists
 * until they create the section themselves.
 */
export async function suggestDiligenceSections(
  userId: string,
  symbol: string
): Promise<SectionSuggestion[]> {
  const ticker = await getTicker(userId, symbol);
  if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
  const [sections, signals, focusAreas, run, synthesis, benchBlock] = await Promise.all([
    listNoteSections(userId, symbol),
    listSignals(userId, symbol, "active"),
    listFocusAreas(userId, symbol),
    latestRun(userId, symbol),
    getDiligenceSynthesis(userId, symbol),
    cleansingBenchContext(userId, symbol).catch(() => ""),
  ]);

  const task = `THE DESK'S ACTIVE SIGNALS:
${signals.map((s) => `- "${s.name}" (${s.focusArea}): ${s.thesis}`).join("\n") || "(none yet)"}

FOCUS AREAS: ${focusAreas.map((f) => `${f.title} — ${f.description}`).join("; ") || "(none)"}

${run?.dossier ? `THE STANDING DOSSIER:\n${run.dossier}\n` : ""}
${synthesis?.content ? `THE RECORD'S CURRENT SYNTHESIS (note its "open fronts"):\n${synthesis.content}\n` : ""}
${benchBlock ? `THE REPORTED NUMBERS AND THE INVESTOR'S CLEANSED VIEW (topics often hide in what the investor chose to strip or pin):\n${benchBlock}\n` : ""}
SECTIONS THE RECORD ALREADY HAS (do NOT suggest these or near-duplicates of them):
${sections.map((s) => `- ${s.title}`).join("\n") || "(none yet)"}

TASK: Suggest 3-6 due-diligence section topics for ${ticker.name} (${ticker.symbol}) — the large qualitative topics an industry veteran would say this investor most needs to understand deeply, given what the board watches and what the record still ignores. Each topic must anchor to the business model or the corporate culture, be specific to THIS company (name its actual mechanisms, not generic checklist entries), and none may overlap an existing section. For each, name the desk signals (exact names) it would give qualitative depth to — the topic is where the investor builds the understanding those signals' long-run trends feed.`;

  const out = await claudeJSON<SuggestionsOutput>({
    model: await resolveModel("diligence"),
    system: [
      { text: DESK_DOCTRINE, cache: true },
      { text: deskIdentity(symbol, ticker.name) },
    ],
    messages: [{ role: "user", content: task }],
    schema: SECTION_SUGGESTIONS_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 4000,
    effort: "medium",
    meta: { userId, feature: "diligence" },
  });
  const existing = new Set(sections.map((s) => s.title.toLowerCase().trim()));
  return (out.suggestions ?? [])
    .filter((s) => s.title?.trim() && !existing.has(s.title.toLowerCase().trim()))
    .slice(0, 6)
    .map((s) => ({
      title: s.title.trim().slice(0, 120),
      rationale: (s.rationale ?? "").trim().slice(0, 300),
      signalNames: Array.isArray(s.signalNames) ? s.signalNames.slice(0, 6) : [],
    }));
}
