import { listFinAdjustments } from "../db";
import { financialsSummary, peekFinancials } from "../financials";
import { deskCorpus, type DeskBlock } from "../search";
import { benchLines } from "./context";

/**
 * THE DESK'S RECALL MEMORY.
 *
 * One connected desk (FOUNDATION.md) means the analyst can be asked about
 * anything on it — a note the investor wrote in Due diligence, a reading from
 * three weeks ago, a bench adjustment, something the desk itself said last
 * month — and must answer EXACTLY. Two failure modes are unacceptable and
 * this module exists to close both:
 *
 *   1. Fabrication. An analyst that "remembers" a note it never read invents
 *      the investor's own thinking back at them. So recall is grounded: every
 *      answer is drawn from records carried VERBATIM into the prompt, each
 *      with a stable citable ref ("note:china-price-war"), and every reply is
 *      checked after the fact — a ref that isn't on the desk, or a quotation
 *      that isn't in the record, is marked unverified rather than shipped.
 *
 *   2. Blind spots. An analyst that is shown a third of the record and told
 *      it is "the record" confidently says "you never wrote that". So the
 *      pack always carries the INVENTORY: every record on the desk, by
 *      category, as ref + title + date. The analyst always knows what exists,
 *      even when its body wasn't retrieved this turn — and it can ask for any
 *      of it by ref (`recallRequest`), which opens those bodies in the same
 *      turn.
 *
 * Token efficiency is the third constraint: a desk with a year of history is
 * far bigger than any sensible prompt. So bodies are RETRIEVED, not dumped —
 * the query is routed to the memory categories it actually touches, records
 * are ranked inside them, and the rest of the record stays a one-line
 * inventory entry. A question about a bench adjustment does not pay for
 * eleven months of readings.
 *
 * The corpus is lib/search.ts's `deskCorpus` — the same blocks desk search
 * matches on — so what the investor can find and what the analyst can recall
 * are the same record by construction.
 */

// ---------------------------------------------------------------------------
// Categories — the memory's filing system
// ---------------------------------------------------------------------------

export const MEMORY_CATEGORIES = [
  "signals",
  "readings",
  "feed",
  "diligence",
  "research",
  "financials",
  "briefs",
  "conversation",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

/** What each category holds, in the analyst's own terms (rendered in the pack). */
export const CATEGORY_DESCRIPTION: Record<MemoryCategory, string> = {
  signals: "the signal board — signal definitions, focus areas, signal deep-history backstories",
  readings: "every dated reading the desk has taken of every signal",
  feed: "the daily evidence feed — headlines the research runs filed, with sources",
  diligence:
    "the investor's due-diligence record — sections, their notepads, filed evidence captions, highlights, the standing synthesis",
  research:
    "the desk's own research record — deep-research memos, research accumulations, the context board, past runs' focus questions and their answers",
  financials:
    "the reported financials and the finance-cleansing bench — adjustments, the audit log, moderation passes",
  briefs: "the daily briefs and the standing business-model & culture dossier",
  conversation: "past desk conversation — this desk's chat and the financial analyst desk's chat",
};

/** Desk-search block type → memory category. */
const CATEGORY_OF: Record<string, MemoryCategory> = {
  signal: "signals",
  focus: "signals",
  backstory: "signals",
  reading: "readings",
  digest: "feed",
  section: "diligence",
  note: "diligence",
  evidence: "diligence",
  annotation: "diligence",
  synthesis: "diligence",
  memo: "research",
  accumulation: "research",
  contextBoard: "research",
  questions: "research",
  brief: "briefs",
  dossier: "briefs",
  adjustment: "financials",
  finLog: "financials",
  finPass: "financials",
  finTable: "financials",
  finBench: "financials",
  chat: "conversation",
  finChat: "conversation",
};

/** Block type → the short word that opens a record's citable ref. */
const REF_KIND: Record<string, string> = {
  signal: "signal",
  focus: "focus",
  backstory: "backstory",
  reading: "reading",
  digest: "feed",
  section: "section",
  note: "note",
  evidence: "file",
  annotation: "highlight",
  synthesis: "synthesis",
  memo: "memo",
  accumulation: "insight",
  contextBoard: "context-board",
  questions: "questions",
  brief: "brief",
  dossier: "dossier",
  adjustment: "adjustment",
  finLog: "bench-log",
  finPass: "bench-pass",
  finTable: "financials",
  finBench: "bench",
  chat: "chat",
  finChat: "fin-chat",
};

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface MemoryRecord {
  /** Stable, human-citable reference: "note:china-price-war". */
  ref: string;
  /** The desk-wide block key ("note:<row id>") — the surface anchor. */
  key: string;
  category: MemoryCategory;
  /** The underlying block type ("note", "reading", "adjustment", …). */
  type: string;
  title: string;
  /** ISO timestamp, or "" when the row carries none. */
  date: string;
  /** Status chip ("applied", "FY2025", "assistant"), or "". */
  meta: string;
  /** The investor's own labels for where it lives ("Industry map" › "China price war"). */
  path: string[];
  /** The record's text, verbatim. Cuts happen at render time and are marked. */
  body: string;
  /** Extra retrieval terms (signal names it bears on, its section title). */
  tags: string[];
}

export interface DeskMemory {
  symbol: string;
  records: MemoryRecord[];
  byRef: Map<string, MemoryRecord>;
  counts: Record<MemoryCategory, number>;
}

const emptyCounts = (): Record<MemoryCategory, number> =>
  Object.fromEntries(MEMORY_CATEGORIES.map((c) => [c, 0])) as Record<MemoryCategory, number>;

/**
 * Slug for a ref: lowercase words, CJK kept as-is (a Chinese note still gets a
 * readable ref), everything else collapsed to single hyphens.
 */
export function slugify(text: string, max = 40): string {
  const s = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9㐀-䶿一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max).replace(/-+$/, "");
}

/** The label a record's ref is built from. */
function refLabel(b: DeskBlock): string {
  const day = (b.date ?? "").slice(0, 10);
  switch (b.type) {
    case "reading":
      return `${b.path[0] ?? "signal"}-${day}`;
    case "digest":
      return `${day}-${b.title}`;
    case "brief":
    case "dossier":
    case "questions":
      return day;
    case "synthesis":
    case "contextBoard":
      return "current";
    case "chat":
    case "finChat":
      return `${day}-${b.meta === "assistant" ? "desk" : "investor"}`;
    case "annotation":
      return `${day}-${b.title || b.body.slice(0, 30)}`;
    case "finLog":
      return `${day}-${b.meta ?? "event"}`;
    default:
      return b.title || b.path.join("-") || day;
  }
}

/** Deterministic ordering so refs stay the same from turn to turn. */
function orderForRefs(a: DeskBlock, b: DeskBlock): number {
  return (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id);
}

/** Blocks → records with unique, stable refs. */
export function toRecords(blocks: DeskBlock[]): MemoryRecord[] {
  const taken = new Set<string>();
  const records: MemoryRecord[] = [];
  for (const b of [...blocks].sort(orderForRefs)) {
    const kind = REF_KIND[b.type] ?? b.type;
    // A ref must survive a title the slugger can't render (emoji-only, empty):
    // fall back to the row id's head, which is stable and unique.
    const base = slugify(refLabel(b)) || b.id.split(":")[1]?.slice(0, 8) || "item";
    let ref = `${kind}:${base}`;
    for (let n = 2; taken.has(ref); n++) ref = `${kind}:${base}-${n}`;
    taken.add(ref);
    records.push({
      ref,
      key: b.id,
      category: CATEGORY_OF[b.type] ?? "research",
      type: b.type,
      title: b.title || b.path.join(" › ") || kind,
      date: b.date ?? "",
      meta: b.meta ?? "",
      path: b.path.filter(Boolean),
      body: b.body,
      tags: b.tags ?? [],
    });
  }
  return records;
}

/**
 * Load the whole desk into memory: the searchable corpus plus the derived
 * financial views (the reported summary and the bench's current state), which
 * are computed rather than stored and so have no block of their own.
 */
export async function loadDeskMemory(userId: string, symbol: string): Promise<DeskMemory> {
  const [blocks, fin, adjustments] = await Promise.all([
    deskCorpus(userId, symbol, { includeAgentOnly: true }).catch(() => [] as DeskBlock[]),
    peekFinancials(symbol).catch(() => null),
    listFinAdjustments(userId, symbol).catch(() => []),
  ]);
  const all = [...blocks];
  if (fin && fin.fiscalYears.length > 0) {
    all.push({
      id: `finTable:${symbol}`,
      pill: "fin",
      type: "finTable",
      path: ["Financials"],
      date: undefined,
      title: `Reported financials (${fin.source})`,
      body: financialsSummary(fin),
      agentOnly: true,
    });
    all.push({
      id: `finBench:${symbol}`,
      pill: "fin",
      type: "finBench",
      path: ["Cleansing bench"],
      date: undefined,
      title: "Finance-cleansing bench — current state",
      body: benchLines(fin, adjustments),
      agentOnly: true,
    });
  }
  const records = toRecords(all);
  const counts = emptyCounts();
  for (const r of records) counts[r.category]++;
  return { symbol, records, byRef: new Map(records.map((r) => [r.ref, r])), counts };
}

/** Build a memory from already-loaded blocks (tests, and callers that hold them). */
export function deskMemoryFromBlocks(symbol: string, blocks: DeskBlock[]): DeskMemory {
  const records = toRecords(blocks);
  const counts = emptyCounts();
  for (const r of records) counts[r.category]++;
  return { symbol, records, byRef: new Map(records.map((r) => [r.ref, r])), counts };
}

// ---------------------------------------------------------------------------
// Routing — which categories does THIS question touch?
// ---------------------------------------------------------------------------

/**
 * Trigger vocabulary per category, English and Simplified Chinese (the desk
 * speaks both). Matching is substring-based on a normalized query, so entries
 * are written as the shortest unambiguous stem.
 */
const LEXICON: Record<MemoryCategory, string[]> = {
  signals: [
    "signal", "board", "track", "tracking", "watch", "watching", "indicator", "focus area",
    "thesis", "measurement", "retire", "propose", "proposal", "monitor", "coverage",
    "信号", "看板", "跟踪", "追踪", "指标", "关注领域", "论点", "提案",
  ],
  readings: [
    "reading", "readings", "level", "latest", "trend", "moved", "worsen", "improv", "delta",
    "confidence", "deteriorat", "escalat", "flag", "amber", "red", "green", "history of the signal",
    "读数", "水平", "趋势", "恶化", "改善", "变化", "置信",
  ],
  feed: [
    "news", "headline", "evidence feed", "article", "story", "reported", "digest", "press",
    "announce", "today", "yesterday", "this week", "last week", "source said", "coverage of",
    "新闻", "消息", "头条", "报道", "证据流", "本周", "昨天", "今天",
  ],
  diligence: [
    "note", "notes", "notepad", "section", "due diligence", "diligence", "dd", "record",
    "i wrote", "we wrote", "my write", "wrote about", "synthesis", "highlight", "annotation",
    "filed", "evidence file", "document i", "my thinking", "my view", "kill list", "checklist",
    "笔记", "尽调", "尽职调查", "记录", "章节", "批注", "高亮", "归档", "我写",
  ],
  research: [
    "research", "memo", "deep dive", "deep research", "accumulation", "insight", "open thread",
    "established", "answered", "focus question", "context board", "what did the desk find",
    "研究", "备忘", "深度", "洞见", "积累", "结论", "开放问题", "问题清单",
  ],
  financials: [
    "revenue", "sales", "margin", "cash flow", "cashflow", "earnings", "ebit", "ebitda", "capex",
    "balance sheet", "debt", "adjustment", "cleansing", "bench", "fy20", "fy 20", "roic", "roe",
    "owner earnings", "buyback", "dividend", "financial", "income statement", "p/e", "valuation",
    "net income", "free cash", "share count", "dilution", "restat", "one-off", "one off", "impair",
    "财务", "营收", "收入", "利润", "毛利", "现金流", "调整", "清洗", "资产负债", "估值", "回购", "分红",
  ],
  briefs: [
    "brief", "dossier", "summary", "overview", "recap", "what changed", "business model",
    "yesterday's brief", "daily", "digest of the day",
    "简报", "档案", "摘要", "综述", "概览", "商业模式",
  ],
  conversation: [
    "you said", "you told", "we discussed", "we talked", "earlier you", "last time", "our chat",
    "conversation", "you mentioned", "i asked", "i told you", "we agreed", "you suggested",
    "你说", "你提到", "我们讨论", "我们聊", "上次", "我问", "你建议",
  ],
};

/**
 * Phrases that mark a RECALL question — the investor asking the desk for
 * something already on the record rather than for fresh analysis. These turns
 * get a wider net and full record bodies: being exactly right matters more
 * than being cheap.
 */
const RECALL_TRIGGERS = [
  "recall", "remind", "remember", "what did", "what do we", "what does the record", "did we",
  "did i", "did you", "have we", "have i", "earlier", "previously", "before", "you said",
  "i wrote", "we noted", "on record", "exactly", "verbatim", "quote", "when did", "how many",
  "list all", "list the", "show me", "look up", "find the", "was there", "who said",
  "记得", "回顾", "之前", "原话", "准确", "引用", "列出", "查一下", "查询", "说过", "写过", "多少",
];

/** Normalize a query for substring matching (case-folded, whitespace-collapsed). */
const normalizeQuery = (q: string): string => (q || "").toLowerCase().replace(/\s+/g, " ").trim();

export interface Routing {
  categories: MemoryCategory[];
  withheld: MemoryCategory[];
  /** The lexicon terms that put each category in scope (for the pack's honesty line). */
  matched: string[];
  recall: boolean;
  /** True when nothing matched and the default working set was used. */
  fallback: boolean;
}

/** Categories consulted when the question matches no lexicon at all. */
const DEFAULT_CATEGORIES: MemoryCategory[] = ["signals", "briefs", "diligence"];

/** Route a question to the memory categories it actually touches. */
export function routeQuery(
  query: string,
  opts: { context?: string; force?: MemoryCategory[]; exclude?: MemoryCategory[] } = {}
): Routing {
  const q = normalizeQuery(query);
  const matched: string[] = [];
  const hit = new Set<MemoryCategory>(opts.force ?? []);
  const matchInto = (text: string) => {
    for (const category of MEMORY_CATEGORIES) {
      for (const term of LEXICON[category]) {
        if (!text.includes(term)) continue;
        hit.add(category);
        if (!matched.includes(term)) matched.push(term);
      }
    }
  };
  // The live question decides. Only when it names nothing does the recent
  // conversation get a vote — a follow-up ("and in 2019?") inherits the
  // categories the exchange it continues was already about.
  matchInto(q);
  const namedByQuestion = hit.size > (opts.force?.length ?? 0);
  if (!namedByQuestion && opts.context) matchInto(normalizeQuery(opts.context));
  const recall = RECALL_TRIGGERS.some((t) => q.includes(t));
  const fallback = hit.size === 0;
  if (fallback) {
    for (const c of DEFAULT_CATEGORIES) hit.add(c);
  }
  // A recall question that named no category is a search of the WHOLE record
  // ("what did we say about the CEO?"). Withholding categories there is
  // exactly how an analyst comes to deny its own record — so open the filing
  // system and let relevance, not routing, decide what surfaces.
  if (recall && !namedByQuestion) for (const c of MEMORY_CATEGORIES) hit.add(c);
  for (const c of opts.exclude ?? []) hit.delete(c);
  const categories = MEMORY_CATEGORIES.filter((c) => hit.has(c));
  return {
    categories,
    withheld: MEMORY_CATEGORIES.filter((c) => !hit.has(c) && !(opts.exclude ?? []).includes(c)),
    matched,
    recall,
    fallback,
  };
}

// ---------------------------------------------------------------------------
// Retrieval — rank the records inside the routed categories
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "at", "by",
  "from", "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these",
  "those", "we", "i", "you", "me", "my", "our", "your", "they", "them", "their", "what",
  "which", "who", "whom", "when", "where", "why", "how", "did", "do", "does", "done", "have",
  "has", "had", "can", "could", "would", "should", "will", "about", "into", "over", "again",
  "please", "tell", "say", "said", "show", "give", "get", "any", "all", "some", "there",
]);

/**
 * Query → match tokens. Latin words of 3+ characters, plus CJK bigrams (which
 * carry the meaning in Chinese, where the query has no spaces to split on).
 */
export function queryTokens(query: string, limit = 24): string[] {
  const q = normalizeQuery(query);
  const out: string[] = [];
  const push = (t: string) => {
    if (t && !out.includes(t)) out.push(t);
  };
  for (const w of q.split(/[^a-z0-9㐀-䶿一-鿿']+/)) {
    if (!w) continue;
    if (/[㐀-䶿一-鿿]/.test(w)) {
      if (w.length === 1) push(w);
      for (let i = 0; i + 1 < w.length; i++) push(w.slice(i, i + 2));
      continue;
    }
    // Anything carrying a digit is kept whole and short — "12", "fy2025",
    // "2019" are the sharpest discriminators a recall question has.
    if (/\d/.test(w)) {
      push(w);
      continue;
    }
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    push(w);
    // Cheap stemming so "margins" finds "margin" and "buybacks" finds "buyback".
    if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) push(w.slice(0, -1));
  }
  return out.slice(0, limit);
}

function countUpTo(haystack: string, needle: string, cap: number): number {
  let n = 0;
  for (let i = haystack.indexOf(needle); i >= 0 && n < cap; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
}

interface Scored {
  record: MemoryRecord;
  score: number;
  /** How many distinct query tokens the record matched. */
  hits: number;
  /** Which ones — so a multi-topic question can cover every topic it asked about. */
  matched: string[];
}

/** Rank records against the query's tokens (IDF-weighted, title-heavy). */
export function scoreRecords(
  records: MemoryRecord[],
  tokens: string[],
  now = Date.now()
): Scored[] {
  if (tokens.length === 0) return [];
  const fields = records.map((r) => ({
    head: `${r.title} ${r.path.join(" ")} ${r.tags.join(" ")} ${r.meta}`.toLowerCase(),
    body: r.body.toLowerCase(),
  }));
  const df = new Map<string, number>();
  for (const t of tokens) {
    let n = 0;
    for (const f of fields) if (f.head.includes(t) || f.body.includes(t)) n++;
    df.set(t, n);
  }
  const N = Math.max(1, records.length);
  const out: Scored[] = [];
  records.forEach((record, i) => {
    const f = fields[i];
    let score = 0;
    const matched: string[] = [];
    for (const t of tokens) {
      const inHead = countUpTo(f.head, t, 3);
      const inBody = countUpTo(f.body, t, 5);
      if (inHead === 0 && inBody === 0) continue;
      matched.push(t);
      const idf = Math.log(1 + N / (1 + (df.get(t) ?? 0)));
      score += idf * (3 * inHead + inBody);
    }
    if (score === 0) return;
    // Long records must not win on length alone; recent ones edge out equals.
    score /= 1 + Math.log(1 + record.body.length / 1500);
    if (record.date) {
      const ageDays = Math.max(0, (now - Date.parse(record.date)) / 86_400_000);
      if (Number.isFinite(ageDays)) score *= 1 + 0.3 * Math.exp(-ageDays / 45);
    }
    out.push({ record, score, hits: matched.length, matched });
  });
  out.sort((a, b) => b.score - a.score || (b.record.date || "").localeCompare(a.record.date || ""));
  return out;
}

export interface RetrieveOptions {
  /** The investor's question this turn. */
  query: string;
  /** Recent conversation, for routing context only (never scored as a query). */
  context?: string;
  /** Categories to force into scope (a desk always carries its own board). */
  force?: MemoryCategory[];
  /** Categories the caller renders in full itself (the bench, on the fin desk). */
  exclude?: MemoryCategory[];
  /** Records to open regardless of score — the analyst's own `recallRequest`. */
  pin?: string[];
  /** Block keys already inlined elsewhere in the prompt (the live chat window). */
  excludeKeys?: string[];
  /** Character budget for retrieved bodies. Defaults by mode. */
  maxChars?: number;
  /** Per-record body cap before an honest cut marker. Defaults by mode. */
  maxRecordChars?: number;
  /** Hard ceiling on how many records open at once. Defaults by mode. */
  maxRecords?: number;
  /** Force recall mode (wide net, full bodies) regardless of the phrasing. */
  recall?: boolean;
  now?: number;
}

export interface MemoryPack {
  /** The rendered prompt block. */
  text: string;
  routing: Routing;
  /** Records whose bodies are in the pack. */
  retrieved: MemoryRecord[];
  /** Refs of the retrieved records. */
  refs: Set<string>;
  /** Refs of EVERY record on the desk (the inventory) — the verification set. */
  allRefs: Set<string>;
  recall: boolean;
  /** Rendered size, for cost accounting. */
  chars: number;
}

const NORMAL_BUDGET = 9_000;
const RECALL_BUDGET = 24_000;
const NORMAL_RECORD_CAP = 1_400;
const RECALL_RECORD_CAP = 6_000;
/** Inventory lines per category before the tail is summarized. */
const INVENTORY_LINES = 10;
const RECALL_INVENTORY_LINES = 24;
/**
 * A record scoring below this fraction of the best match is left to the
 * inventory (the three best always open, however flat the field): on a desk
 * with sixty adjustments, "adjustment" alone is not a match — it is noise
 * that would crowd out the one record the question is actually about.
 */
const RELEVANCE_FLOOR = 0.45;
/** How many extra records the topic-coverage pass may admit (see below). */
const COVERAGE_ADMISSIONS = 4;
/** Character ceiling for the inventory section (lines per category shrink to fit). */
const INVENTORY_BUDGET = 4_500;
const RECALL_INVENTORY_BUDGET = 9_000;
/** High-volume categories: a shorter inventory head, the rest as a range. */
const DENSE: MemoryCategory[] = ["readings", "feed", "conversation"];

const cutTo = (text: string, max: number): string =>
  text.length <= max
    ? text
    : `${text.slice(0, max)}… [cut here — ${text.length - max} more characters in the record; ask for this record by ref to read it in full]`;

const dateOf = (r: MemoryRecord): string => (r.date ? r.date.slice(0, 10) : "undated");

/** One inventory line: what exists, where, and how to ask for it. */
function inventoryLine(r: MemoryRecord): string {
  const where = r.path.length ? ` · ${r.path.join(" › ")}` : "";
  const meta = r.meta ? ` · ${r.meta}` : "";
  return `- [${r.ref}] "${r.title}"${where}${meta} · ${dateOf(r)}`;
}

/** One retrieved record: header line plus its verbatim body. */
function recordBlock(r: MemoryRecord, cap: number): string {
  const where = r.path.join(" › ");
  const meta = r.meta ? ` · ${r.meta}` : "";
  // The title repeats on rows whose only label IS their path — print it once.
  const title = r.title && r.title !== where ? `${r.title}\n` : "";
  return `[${r.ref}] ${r.category} · ${r.type}${where ? ` · ${where}` : ""}${meta} · ${dateOf(r)}\n${title}${cutTo(r.body, cap)}`;
}

/**
 * Retrieve the slice of the desk's memory this question needs, and render it
 * as the prompt's recall block: routing (why these categories), the full
 * inventory (what exists), and the retrieved records verbatim.
 */
export function retrieveMemory(memory: DeskMemory, opts: RetrieveOptions): MemoryPack {
  const routing = routeQuery(opts.query, {
    context: opts.context,
    force: opts.force,
    exclude: opts.exclude,
  });
  const recall = opts.recall === true || routing.recall;
  const budget = opts.maxChars ?? (recall ? RECALL_BUDGET : NORMAL_BUDGET);
  const recordCap = opts.maxRecordChars ?? (recall ? RECALL_RECORD_CAP : NORMAL_RECORD_CAP);
  const excludedCats = new Set(opts.exclude ?? []);
  const excludeKeys = new Set(opts.excludeKeys ?? []);

  const visible = memory.records.filter(
    (r) => !excludedCats.has(r.category) && !excludeKeys.has(r.key)
  );
  const inScope = new Set(routing.categories);
  const tokens = queryTokens(opts.query);
  const ranked = scoreRecords(visible, tokens, opts.now ?? Date.now());

  // Pinned records (the analyst asked for these by ref) always open first.
  const pinned = (opts.pin ?? [])
    .map((ref) => memory.byRef.get(ref))
    .filter((r): r is MemoryRecord => !!r);

  const chosen: MemoryRecord[] = [];
  const seen = new Set<string>();
  let used = 0;
  const take = (r: MemoryRecord, cap: number): boolean => {
    if (seen.has(r.ref)) return false;
    const cost = Math.min(r.body.length, cap) + 120;
    if (chosen.length > 0 && used + cost > budget) return false;
    seen.add(r.ref);
    chosen.push(r);
    used += cost;
    return true;
  };
  // A pinned record is opened in full: it was asked for by name.
  for (const r of pinned) take(r, Math.max(recordCap, RECALL_RECORD_CAP));

  // Relevance floor: a record that merely shares a common word with the
  // question ("adjustment" on a desk with sixty adjustments) is noise, and
  // sixty of them crowd out the one that answers. Everything below a fraction
  // of the best match is left to the inventory, where one ask still opens it.
  const floor = (ranked[0]?.score ?? 0) * RELEVANCE_FLOOR;
  const maxRecords = opts.maxRecords ?? (recall ? 30 : 14);
  for (const [i, { record, hits, score }] of ranked.entries()) {
    if (chosen.length >= maxRecords) break;
    if (i >= 3 && score < floor) break;
    const routed = inScope.has(record.category);
    // Spillover: an unrouted record earns a slot only on a strong match (two
    // distinct query terms), so routing stays the thing that decides cost
    // without ever making part of the record structurally invisible.
    if (!routed && hits < 2) continue;
    take(record, recordCap);
    if (used >= budget) break;
  }

  // Cover every topic the question asked about. The floor above ranks by
  // total score, so a two-topic question ("the price war AND the subsidy")
  // can spend every slot on the louder topic. For each discriminative term no
  // chosen record covers, admit the single best record that does.
  const byRef = new Map(ranked.map((r) => [r.record.ref, r]));
  const frequency = new Map<string, number>();
  for (const r of ranked) for (const t of r.matched) frequency.set(t, (frequency.get(t) ?? 0) + 1);
  const discriminative = tokens.filter((t) => {
    const n = frequency.get(t) ?? 0;
    return n > 0 && n <= Math.max(3, ranked.length * 0.4);
  });
  const covered = new Set(chosen.flatMap((r) => byRef.get(r.ref)?.matched ?? []));
  let admitted = 0;
  for (const t of discriminative) {
    if (covered.has(t) || chosen.length >= maxRecords || admitted >= COVERAGE_ADMISSIONS) continue;
    // Category, here, yields to the question's own words: the investor named
    // this term, and the record that carries it answers them even if routing
    // did not send the turn to its shelf. Bounded, so it stays a correction
    // and not a second retrieval.
    const best = ranked.find((r) => !seen.has(r.record.ref) && r.matched.includes(t));
    if (best && take(best.record, recordCap)) {
      admitted++;
      for (const x of best.matched) covered.add(x);
    }
  }

  // A question with nothing to match on ("what's new?", "how is it going?")
  // still gets the routed categories' most recent records — recency is the
  // only honest ranking when the words give the scorer nothing to work with.
  // When the scorer DID find matches, they stand alone: padding a precise
  // answer with today's headlines is exactly the noise routing exists to cut.
  if (ranked.length === 0) {
    const recent = visible
      .filter((r) => inScope.has(r.category) && r.body.trim())
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    for (const r of recent) {
      if (chosen.length >= 6) break;
      take(r, recordCap);
    }
  }

  // ---- inventory: every record on the desk, by category ----
  // Titles only, so the analyst always knows what exists; the head of each
  // category is listed and the tail is named with its date range, never
  // silently dropped. Kept inside its own budget so a desk with a year of
  // history doesn't spend the turn listing itself.
  const renderInventory = (perCategory: number): string => {
    const blocks: string[] = [];
    for (const category of MEMORY_CATEGORIES) {
      const rows = memory.records
        .filter((r) => r.category === category)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      if (rows.length === 0) continue;
      const cap = DENSE.includes(category) ? Math.max(3, Math.min(6, perCategory)) : perCategory;
      const head = rows.slice(0, cap);
      const rest = rows.length - head.length;
      const oldest = rows[rows.length - 1];
      const tail =
        rest > 0
          ? `\n- (+${rest} more ${category} record(s) on file, back to ${dateOf(oldest)} — ask for any of them by ref or by what you're looking for, and I'll open them)`
          : "";
      const note = excludedCats.has(category)
        ? " [your own board — rendered in full elsewhere in this prompt; anything older than what is shown there can still be opened by ref]"
        : inScope.has(category)
          ? ""
          : " [not opened this turn]";
      blocks.push(
        `${category} (${rows.length})${note} — ${CATEGORY_DESCRIPTION[category]}:\n${head
          .map(inventoryLine)
          .join("\n")}${tail}`
      );
    }
    return blocks.join("\n\n");
  };
  const inventoryBudget = recall ? RECALL_INVENTORY_BUDGET : INVENTORY_BUDGET;
  let inventory = renderInventory(recall ? RECALL_INVENTORY_LINES : INVENTORY_LINES);
  for (
    let perCategory = recall ? RECALL_INVENTORY_LINES : INVENTORY_LINES;
    inventory.length > inventoryBudget && perCategory > 3;
    perCategory = Math.floor(perCategory / 2)
  ) {
    inventory = renderInventory(Math.max(3, Math.floor(perCategory / 2)));
  }

  const total = memory.records.length;
  const countLine = MEMORY_CATEGORIES.filter((c) => memory.counts[c] > 0)
    .map((c) => `${c} ${memory.counts[c]}`)
    .join(" · ");
  const routedLine = routing.fallback
    ? `Routing: the question named no particular part of the record, so the desk consulted ${routing.categories.join(", ")}.`
    : `Routing: this question was routed to ${routing.categories.join(", ")} (matched: ${routing.matched
        .slice(0, 8)
        .map((t) => `"${t}"`)
        .join(", ")}).`;
  const withheldLine = routing.withheld.length
    ? ` Not opened this turn (nothing in the question pointed at them): ${routing.withheld.join(", ")} — they are listed in the inventory below and one ask opens any of them.`
    : "";
  const excludedLine = excludedCats.size
    ? ` Rendered in full elsewhere in this prompt: ${[...excludedCats].join(", ")}.`
    : "";

  const pinnedRefs = new Set(pinned.map((r) => r.ref));
  const body = chosen.length
    ? chosen
        .map((r) =>
          recordBlock(r, pinnedRefs.has(r.ref) ? Math.max(recordCap, RECALL_RECORD_CAP) : recordCap)
        )
        .join("\n\n")
    : "(nothing on the desk matched this question — say so plainly rather than filling the gap)";

  const text = `DESK MEMORY — THE RECORD OF THIS DESK, RETRIEVED FOR THIS QUESTION${recall ? " (recall question: wide net, full record bodies)" : ""}
${routedLine}${withheldLine}${excludedLine}
On file: ${total} record(s) — ${countLine || "none yet"}.

INVENTORY — every record on file in the desk's record window (the same record desk search covers). Titles only; the bodies below are what was opened this turn. If the answer needs a record listed here but not opened, ask for it by ref (recallRequest) instead of reconstructing it from memory.
${inventory || "(the desk holds no records yet)"}

RETRIEVED RECORDS — verbatim, in the desk's and the investor's own words. This text IS the record; quote it exactly and cite each recalled fact with its [ref].
${body}`;

  return {
    text,
    routing,
    retrieved: chosen,
    refs: new Set(chosen.map((r) => r.ref)),
    allRefs: new Set(memory.records.map((r) => r.ref)),
    recall,
    chars: text.length,
  };
}

/**
 * Re-retrieve with records the analyst asked for by ref opened in full — the
 * second half of the `recallRequest` loop: it reads the inventory, names what
 * it needs, and answers over the real text in the same turn.
 */
export function expandMemory(
  memory: DeskMemory,
  opts: RetrieveOptions,
  refs: string[],
  limit = 20
): MemoryPack {
  const wanted = refs
    .map((r) => r.trim().replace(/^\[|\]$/g, ""))
    .filter((r) => memory.byRef.has(r))
    .slice(0, limit);
  return retrieveMemory(memory, {
    ...opts,
    pin: [...(opts.pin ?? []), ...wanted],
    recall: true,
  });
}

/** Refs the analyst asked for that the desk does not hold (say so, don't invent). */
export function unknownRefs(memory: DeskMemory, refs: string[]): string[] {
  return refs
    .map((r) => r.trim().replace(/^\[|\]$/g, ""))
    .filter((r) => r && !memory.byRef.has(r));
}

// ---------------------------------------------------------------------------
// Verification — the reply is checked against the record before it ships
// ---------------------------------------------------------------------------

/** A [kind:slug] record reference inside a reply. */
const REF_PATTERN = /\[([a-z][a-z-]{1,20}):([A-Za-z0-9㐀-䶿一-鿿][A-Za-z0-9㐀-䶿一-鿿-]{0,60})\]/g;
/** A quotation long enough to be a claim about the record's exact words. */
const QUOTE_PATTERN = /[“"]([^”"\n]{40,400})[”"]/g;
const MIN_QUOTED_WORDS = 8;

/** Normalize for verbatim comparison: fold case, collapse whitespace/punctuation spacing. */
const normalizeForQuote = (s: string): string =>
  s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

export interface RecallViolation {
  kind: "unknown-ref" | "unverified-quote";
  detail: string;
}

export interface RecallCheck {
  /** The reply, with unverifiable references marked and a caveat appended. */
  text: string;
  violations: RecallViolation[];
}

/**
 * Check a reply against the record before it is persisted. Two mechanical
 * checks, both conservative — they never rewrite the analyst's reasoning,
 * they only refuse to let an unverifiable claim pass as recall:
 *
 *  - every [ref] must be a record this desk actually holds;
 *  - every quotation of 8+ words must appear verbatim in a record that was
 *    opened this turn, or in what the investor themselves wrote.
 *
 * Anything that fails is marked in place and named in a short caveat, so the
 * investor sees exactly which part of the answer is not backed by the record.
 */
export function verifyRecall(
  reply: string,
  pack: MemoryPack,
  opts: { lang?: "en" | "zh"; allowText?: string[] } = {}
): RecallCheck {
  const violations: RecallViolation[] = [];
  if (!reply?.trim()) return { text: reply, violations };

  let text = reply.replace(REF_PATTERN, (whole, kind: string, slug: string) => {
    const ref = `${kind}:${slug}`;
    if (pack.allRefs.has(ref)) return whole;
    violations.push({ kind: "unknown-ref", detail: ref });
    return `[unverified ref: ${ref}]`;
  });

  const haystack = normalizeForQuote(
    [...pack.retrieved.map((r) => `${r.title} ${r.body}`), ...(opts.allowText ?? [])].join("\n")
  );
  for (const m of reply.matchAll(QUOTE_PATTERN)) {
    const quoted = m[1];
    if (quoted.trim().split(/\s+/).length < MIN_QUOTED_WORDS) continue;
    if (haystack.includes(normalizeForQuote(quoted))) continue;
    violations.push({ kind: "unverified-quote", detail: quoted.slice(0, 80) });
  }

  if (violations.length > 0) {
    const unknown = violations.filter((v) => v.kind === "unknown-ref").map((v) => v.detail);
    const quotes = violations.filter((v) => v.kind === "unverified-quote").length;
    const parts: string[] = [];
    if (opts.lang === "zh") {
      if (unknown.length) parts.push(`引用了本研究台没有的记录：${unknown.join("、")}`);
      if (quotes) parts.push(`${quotes} 处引文无法在记录中逐字核对`);
      text += `\n\n---\n⚠️ 记录核验：${parts.join("；")}。请把这些部分视为未经核实——让我重新核对，我会以记录原文作答。`;
    } else {
      if (unknown.length) parts.push(`referenced record(s) this desk does not hold (${unknown.join(", ")})`);
      if (quotes) parts.push(`${quotes} quotation(s) I could not match verbatim to the record`);
      text += `\n\n---\n⚠️ Recall check: this reply ${parts.join(" and ")}. Treat those parts as unverified — ask me to check again and I'll answer from the record's own words.`;
    }
  }

  return { text, violations };
}
