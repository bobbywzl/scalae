import {
  getDeskContext,
  getDiligenceSynthesis,
  getRun,
  latestFinSuggestRun,
  listAccumulations,
  listAnnotations,
  listDiligenceEvidence,
  listDiligenceResearch,
  listFinAdjustments,
  listFinCleansingEvents,
  listFocusAreas,
  listNoteSections,
  listNotes,
  listSignals,
  readingsForSymbol,
  recentDigest,
  recentFinMessages,
  recentMessages,
  recentRuns,
} from "./db";
import { docToPlainText } from "./notes";

/**
 * Desk-wide text search: one query across every text block a ticker's three
 * surfaces hold — Due diligence (sections, notepads,
 * evidence captions, highlights), Signals (signals, backstories, readings,
 * evidence feed, brief, dossier, chat, focus areas) and Finance (adjustments,
 * analyst chat, audit log, moderation passes). A desk is one investor's record
 * for one ticker — small enough to match in memory, so search reuses the
 * data layer's parsers (TipTap flattening, JSON columns) instead of new SQL.
 */

export type SearchPill = "signals" | "dd" | "fin";

export type SearchBlockType =
  // Due diligence
  | "section"
  | "note"
  | "memo"
  | "synthesis"
  | "evidence"
  | "annotation"
  // Signals
  | "signal"
  | "backstory"
  | "reading"
  | "digest"
  | "brief"
  | "dossier"
  | "chat"
  | "focus"
  // Finance
  | "adjustment"
  | "finChat"
  | "finLog"
  | "finPass"
  // Agent-only blocks (see deskCorpus): part of the desk's record and of the
  // analyst's recall memory, but not rendered surfaces the investor can open,
  // so desk search never returns them.
  | "accumulation"
  | "contextBoard"
  | "questions"
  // Derived views the analyst's memory adds on top of the stored record (see
  // lib/agents/memory.ts): the reported-financials summary and the bench's
  // current raw → cleansed state.
  | "finTable"
  | "finBench";

export interface DeskSearchHit {
  /** Stable key: "<type>:<row id>". */
  id: string;
  pill: SearchPill;
  type: SearchBlockType;
  /** Directory segments (the investor's own labels: section titles, signal names, file names). */
  path: string[];
  /** Small status chip when the row carries one (e.g. "pending", "applied", "FY2025"). */
  meta?: string;
  /** Plain-text excerpt around the first match. */
  snippet: string;
  /** ISO timestamp of the row, when it has one. */
  date?: string;
  score: number;
}

/**
 * One text block of a desk's record: the unit both desk search and the
 * analyst's recall memory (lib/agents/memory.ts) work in. Title text
 * outweighs body text when matching.
 */
export interface DeskBlock {
  /** Stable key: "<type>:<row id>" — the same anchor annotations use. */
  id: string;
  pill: SearchPill;
  type: SearchBlockType;
  /** Directory segments (the investor's own labels). */
  path: string[];
  /** Small status chip when the row carries one (e.g. "pending", "FY2025"). */
  meta?: string;
  date?: string;
  title: string;
  body: string;
  /**
   * True for blocks that are part of the record but not an openable surface
   * (memos, the standing synthesis, accumulations, the context board, a run's
   * answered questions). Desk search skips them; the analyst's memory reads
   * them.
   */
  agentOnly?: boolean;
  /** Extra retrieval terms (signal names an item bears on, its section). */
  tags?: string[];
}

const MAX_HITS = 100;
const SNIPPET_RADIUS = 90;

/** Markdown → readable plain text for snippets (memos, briefs, backstories). */
function stripMd(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/\[([^\]\n]+)\]\((?:[^)\s]+)\)/g, "$1")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const clean = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

/** Case-insensitive positions of every token; empty array when one is missing. */
function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
}

function countOccurrences(haystack: string, needle: string, cap: number): number {
  let n = 0;
  for (let i = haystack.indexOf(needle); i >= 0 && n < cap; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
}

/**
 * Length-preserving case fold: per code point, keep the original character
 * whenever lowercasing would change its length (e.g. 'İ' → 'i̇' gains a
 * combining mark) so indexes computed on the fold stay valid in the source.
 */
function foldForIndexing(source: string): string {
  let out = "";
  for (const ch of source) {
    const l = ch.toLowerCase();
    out += l.length === ch.length ? l : ch;
  }
  return out;
}

/** Excerpt around the earliest token match, expanded to word boundaries. */
function makeSnippet(body: string, title: string, tokens: string[]): string {
  const source = body || title;
  const lower = foldForIndexing(source);
  let first = -1;
  for (const tok of tokens) {
    const i = lower.indexOf(tok);
    if (i >= 0 && (first < 0 || i < first)) first = i;
  }
  if (first < 0) return source.slice(0, SNIPPET_RADIUS * 2);
  let start = Math.max(0, first - SNIPPET_RADIUS);
  let end = Math.min(source.length, first + SNIPPET_RADIUS);
  if (start > 0) {
    const sp = source.indexOf(" ", start);
    if (sp >= 0 && sp < first) start = sp + 1;
  }
  if (end < source.length) {
    const sp = source.lastIndexOf(" ", end);
    if (sp > first) end = sp;
  }
  return `${start > 0 ? "…" : ""}${source.slice(start, end).trim()}${end < source.length ? "…" : ""}`;
}

function match(block: DeskBlock, tokens: string[]): DeskSearchHit | null {
  const title = block.title.toLowerCase();
  const body = block.body.toLowerCase();
  let score = 0;
  for (const tok of tokens) {
    const inTitle = countOccurrences(title, tok, 3);
    const inBody = countOccurrences(body, tok, 5);
    if (inTitle === 0 && inBody === 0) return null; // AND semantics — every word must appear
    score += inTitle * 3 + inBody;
  }
  return {
    id: block.id,
    pill: block.pill,
    type: block.type,
    path: block.path,
    meta: block.meta,
    snippet: makeSnippet(block.body, block.title, tokens),
    date: block.date,
    score,
  };
}

/**
 * Assemble EVERY text block on one desk — the shared corpus behind desk
 * search and the analyst's recall memory. One builder, so what the investor
 * can find and what the analyst can recall never drift apart.
 *
 * `includeAgentOnly` adds the record's non-rendered blocks (research memos,
 * the standing synthesis, accumulations, the context board, a run's answered
 * questions): memory reads them, search does not.
 */
export async function deskCorpus(
  userId: string,
  symbol: string,
  opts: { includeAgentOnly?: boolean } = {}
): Promise<DeskBlock[]> {
  const agentOnly = opts.includeAgentOnly === true;
  const [
    sections,
    notes,
    research,
    evidence,
    annotations,
    signals,
    focusAreas,
    readings,
    digest,
    runs,
    messages,
    finAdjustments,
    finEvents,
    finMessages,
    finPass,
    accumulations,
    synthesis,
    contextBoard,
  ] = await Promise.all([
    listNoteSections(userId, symbol),
    listNotes(userId, symbol),
    listDiligenceResearch(userId, symbol),
    listDiligenceEvidence(userId, symbol),
    listAnnotations(userId, symbol),
    listSignals(userId, symbol),
    listFocusAreas(userId, symbol),
    readingsForSymbol(userId, symbol),
    recentDigest(userId, symbol, 300),
    recentRuns(userId, symbol, 5),
    recentMessages(userId, symbol, 400),
    listFinAdjustments(userId, symbol),
    listFinCleansingEvents(userId, symbol, 300),
    recentFinMessages(userId, symbol, 400),
    latestFinSuggestRun(userId, symbol),
    agentOnly ? listAccumulations(userId, symbol, 120) : Promise.resolve([]),
    agentOnly ? getDiligenceSynthesis(userId, symbol).catch(() => null) : Promise.resolve(null),
    agentOnly ? getDeskContext(userId, symbol).catch(() => undefined) : Promise.resolve(undefined),
  ]);

  const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));
  const signalById = new Map(signals.map((s) => [s.id, s]));
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const researchById = new Map(research.map((r) => [r.id, r]));
  const digestById = new Map(digest.map((d) => [d.id, d]));
  const readingById = new Map(readings.map((r) => [r.id, r]));

  const blocks: DeskBlock[] = [];

  // ---- Due diligence ----
  for (const s of sections) {
    blocks.push({
      id: `section:${s.id}`,
      pill: "dd",
      type: "section",
      path: [s.title],
      date: s.createdAt,
      title: s.title,
      body: "",
    });
  }
  for (const n of notes) {
    blocks.push({
      id: `note:${n.id}`,
      pill: "dd",
      type: "note",
      path: [sectionTitle.get(n.sectionId) ?? "", n.title].filter(Boolean),
      date: n.updatedAt,
      title: clean(n.title),
      body: clean(docToPlainText(n.content)),
    });
  }
  // Research memos and the standing synthesis no longer render on the DD
  // page, so they are not searchable surfaces — accepted memos live on as
  // ordinary notepads (indexed above), and the rows are still fetched for
  // labeling any old highlights made on them.
  for (const e of evidence) {
    blocks.push({
      id: `evidence:${e.id}`,
      pill: "dd",
      type: "evidence",
      path: [sectionTitle.get(e.sectionId) ?? "", e.name].filter(Boolean),
      meta: e.kind,
      date: e.createdAt,
      title: clean(e.name),
      body: clean(e.caption),
    });
  }
  for (const a of annotations) {
    // A highlight belongs to the pill of the surface it was made on.
    const sid = a.surfaceId;
    let pill: SearchPill = "signals";
    let path: string[] = [];
    if (sid === "synthesis" || sid.startsWith("memo:") || sid.startsWith("note:")) {
      pill = "dd";
      if (sid.startsWith("note:")) {
        const n = noteById.get(sid.slice(5));
        if (n) path = [sectionTitle.get(n.sectionId) ?? "", n.title].filter(Boolean);
      } else if (sid.startsWith("memo:")) {
        const r = researchById.get(sid.slice(5));
        if (r) path = [sectionTitle.get(r.sectionId) ?? ""].filter(Boolean);
      }
    } else if (sid.startsWith("signal:")) {
      const s = signalById.get(sid.split(":")[1]);
      if (s) path = [s.name];
    } else if (sid.startsWith("reading:")) {
      const r = readingById.get(sid.slice(8));
      if (r) path = [r.signalName];
    } else if (sid.startsWith("digest:")) {
      const d = digestById.get(sid.slice(7));
      if (d) path = [d.headline.slice(0, 60)];
    }
    blocks.push({
      id: `annotation:${a.id}`,
      pill,
      type: "annotation",
      path,
      date: a.createdAt,
      title: clean(a.comment),
      body: clean(a.selectedText),
    });
  }

  // ---- Signals ----
  for (const s of signals) {
    blocks.push({
      id: `signal:${s.id}`,
      pill: "signals",
      type: "signal",
      path: [s.focusArea, s.name].filter(Boolean),
      meta: s.status,
      date: s.createdAt,
      title: clean(s.name),
      body: clean([s.thesis, s.measurementPlan, s.scale].filter(Boolean).join(" · ")),
    });
    if (s.backstory) {
      blocks.push({
        id: `backstory:${s.id}`,
        pill: "signals",
        type: "backstory",
        path: [s.focusArea, s.name].filter(Boolean),
        date: s.backstoryAt ?? undefined,
        title: "",
        body: stripMd([s.backstoryBrief ?? "", s.backstory].join(" ")),
      });
    }
  }
  for (const f of focusAreas) {
    blocks.push({
      id: `focus:${f.id}`,
      pill: "signals",
      type: "focus",
      path: [f.title],
      date: f.createdAt,
      title: clean(f.title),
      body: clean(f.description),
    });
  }
  for (const r of readings) {
    blocks.push({
      id: `reading:${r.id}`,
      pill: "signals",
      type: "reading",
      path: [r.signalName, r.date.slice(0, 10)],
      meta: r.level,
      date: r.date,
      title: "",
      body: clean(r.rationale),
    });
  }
  for (const d of digest) {
    blocks.push({
      id: `digest:${d.id}`,
      pill: "signals",
      type: "digest",
      path: [clean(d.source ?? "")].filter(Boolean),
      meta: d.impact,
      date: d.date,
      title: clean(d.headline),
      body: clean([d.summary, d.sourceNote ?? ""].join(" ")),
    });
  }
  // recentRuns returns finished board runs newest-first. The newest one's
  // brief/dossier are what the page renders; earlier ones are still part of
  // the desk's record, so recent briefs stay findable too.
  const fullRuns = (await Promise.all(runs.map((r) => getRun(r.id)))).filter(
    (r): r is NonNullable<typeof r> => r != null
  );
  fullRuns.forEach((run, i) => {
    if (run.brief) {
      blocks.push({
        id: `brief:${run.id}`,
        pill: "signals",
        type: "brief",
        path: [run.startedAt.slice(0, 10)],
        date: run.startedAt,
        title: "",
        body: stripMd(run.brief),
      });
    }
    // Only the newest dossier: it is a STANDING view that carries forward
    // run to run — older copies are near-duplicates, not distinct records.
    if (i === 0 && run.dossier) {
      blocks.push({
        id: `dossier:${run.id}`,
        pill: "signals",
        type: "dossier",
        path: [],
        date: run.startedAt,
        title: "",
        body: stripMd(run.dossier),
      });
    }
  });
  for (const m of messages) {
    const signalName = m.signalId ? signalById.get(m.signalId)?.name : undefined;
    blocks.push({
      id: `chat:${m.id}`,
      pill: "signals",
      type: "chat",
      path: signalName ? [signalName] : [],
      meta: m.role,
      date: m.createdAt,
      title: "",
      body: m.role === "assistant" ? stripMd(m.content) : clean(m.content),
    });
  }

  // ---- Finance ----
  for (const a of finAdjustments) {
    blocks.push({
      id: `adjustment:${a.id}`,
      pill: "fin",
      type: "adjustment",
      path: [a.title],
      meta: `${a.status} · FY${a.fiscalYear}`,
      date: a.createdAt,
      title: clean(a.title),
      body: clean([a.metricKey, a.rationale].join(" — ")),
    });
  }
  for (const e of finEvents) {
    blocks.push({
      id: `finLog:${e.id}`,
      pill: "fin",
      type: "finLog",
      path: [],
      meta: e.action,
      date: e.at,
      title: "",
      body: clean(e.detail),
    });
  }
  for (const m of finMessages) {
    blocks.push({
      id: `finChat:${m.id}`,
      pill: "fin",
      type: "finChat",
      path: [],
      meta: m.role,
      date: m.createdAt,
      title: "",
      body: m.role === "assistant" ? stripMd(m.content) : clean(m.content),
    });
  }
  if (finPass?.note) {
    blocks.push({
      id: `finPass:${finPass.id}`,
      pill: "fin",
      type: "finPass",
      path: [],
      date: finPass.finishedAt ?? finPass.createdAt,
      title: "",
      body: clean(finPass.note),
    });
  }

  // ---- Agent-only record (memory reads these; search never returns them) ----
  if (agentOnly) {
    // Deep-research memos: the pending ones the investor has not decided yet
    // and the accepted ones (whose text also lives on as a notepad — the
    // memo row keeps the desk's own distillation and its source list).
    for (const r of research) {
      if (r.status !== "accepted" && r.status !== "pending") continue;
      const body = clean([r.insights ?? "", stripMd(r.memo ?? "")].filter(Boolean).join("\n\n"));
      if (!body) continue;
      blocks.push({
        id: `memo:${r.id}`,
        pill: "dd",
        type: "memo",
        path: [sectionTitle.get(r.sectionId) ?? "", r.question || "desk research"].filter(Boolean),
        meta: r.status,
        date: r.createdAt,
        title: clean(r.question) || "Desk research memo",
        body,
        agentOnly: true,
        tags: [sectionTitle.get(r.sectionId) ?? ""].filter(Boolean),
      });
    }
    if (synthesis?.content) {
      blocks.push({
        id: "synthesis:current",
        pill: "dd",
        type: "synthesis",
        path: ["Standing synthesis"],
        meta: synthesis.origin ?? undefined,
        date: synthesis.updatedAt,
        title: "Standing synthesis of the due-diligence record",
        body: stripMd(synthesis.content),
        agentOnly: true,
      });
    }
    for (const a of accumulations) {
      blocks.push({
        id: `accumulation:${a.id}`,
        pill: "signals",
        type: "accumulation",
        path: [a.topic],
        date: a.createdAt,
        title: clean(a.topic),
        body: clean(a.insight),
        agentOnly: true,
        tags: a.signalNames,
      });
    }
    if (contextBoard?.content) {
      blocks.push({
        id: "contextBoard:current",
        pill: "signals",
        type: "contextBoard",
        path: ["Context board"],
        date: contextBoard.updatedAt,
        title: "Desk context board (answered questions · established context · open threads)",
        body: stripMd(contextBoard.content),
        agentOnly: true,
      });
    }
    for (const run of fullRuns) {
      if (run.questions.length === 0) continue;
      const lines = run.questions.map((qn, i) => {
        const a = run.questionAnswers[i];
        return `Q: ${qn}${a?.answer ? `\nA: ${stripMd(a.answer)}` : "\nA: (no answer recorded)"}`;
      });
      blocks.push({
        id: `questions:${run.id}`,
        pill: "signals",
        type: "questions",
        path: [run.startedAt.slice(0, 10)],
        date: run.startedAt,
        title: `Focus questions the ${run.startedAt.slice(0, 10)} run asked, and what it answered`,
        body: clean(lines.join("\n")),
        agentOnly: true,
      });
    }
  }

  return blocks;
}

/** Assemble the desk's blocks, then match the query against each. */
export async function searchDesk(
  userId: string,
  symbol: string,
  query: string
): Promise<DeskSearchHit[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const blocks = await deskCorpus(userId, symbol);
  const hits: DeskSearchHit[] = [];
  for (const block of blocks) {
    if (block.agentOnly) continue;
    const hit = match(block, tokens);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => b.score - a.score || (b.date ?? "").localeCompare(a.date ?? ""));
  return hits.slice(0, MAX_HITS);
}
