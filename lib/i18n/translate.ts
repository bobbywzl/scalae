import { createHash } from "node:crypto";
import { claudeJSON } from "../ai/claude";
import { resolveModel } from "../ai/models";
import type { UsageMeta } from "../ai/usage";
import { getTranslations, saveTranslations } from "../db";
import type {
  DeskPayload,
  DigestItem,
  DiligencePayload,
  DiligenceResearch,
  DiligenceSynthesis,
  FocusArea,
  Reading,
  Run,
  SectionSuggestion,
  Signal,
  SignalWithReadings,
} from "../types";
import type { Lang } from "./config";

/**
 * Display-language layer for AI-generated research content.
 *
 * The desk's canonical record (signals, readings, briefs, dossiers, digests)
 * is stored in English regardless of the investor's language — so switching
 * languages never forks the data, and the analyst pipeline keeps one
 * doctrine. When a payload is served to a non-English device, every
 * AI-authored text field passes through here: a content-addressed cache
 * (translations table) answers instantly for anything seen before, and only
 * cache misses go to the cheap `translate`-role model, batched. Failures
 * degrade to the original text — the desk never blocks on translation.
 *
 * Chat is NOT translated here: the analyst simply converses in the
 * investor's language (see the language directive in lib/agents/chat.ts),
 * and history stays in the language it was written, like any conversation.
 */

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Rough CJK share of the letters in a string. */
function cjkRatio(s: string): number {
  let cjk = 0;
  let letters = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    const isCjk =
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
      (code >= 0x3400 && code <= 0x4dbf) || // Extension A
      (code >= 0x3000 && code <= 0x30ff); // CJK punctuation + kana (close enough)
    if (isCjk) {
      cjk++;
      letters++;
    } else if (/\p{L}/u.test(ch)) {
      letters++;
    }
  }
  return letters === 0 ? 0 : cjk / letters;
}

/**
 * Does this text need translating to reach `lang`? Pure-number/markup strings
 * never do; English canonical text needs work only for zh; CJK-heavy text
 * (e.g. a proposal the analyst drafted mid-Chinese-conversation) needs work
 * only for en. This filter is what makes the layer free for English users.
 */
export function needsTranslation(text: string, lang: Lang): boolean {
  const t = text.trim();
  if (!t || !/\p{L}/u.test(t)) return false;
  const ratio = cjkRatio(t);
  return lang === "zh" ? ratio < 0.3 : ratio > 0.3;
}

const BATCH_MAX_ITEMS = 20;
const BATCH_MAX_CHARS = 9_000;
const MAX_PARALLEL_BATCHES = 6;

const TRANSLATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["translations"],
  properties: {
    translations: {
      type: "array",
      items: { type: "string" },
      description: "One translation per input item, same order, same count.",
    },
  },
} as const;

function translationSystem(lang: Lang): string {
  const target = lang === "zh" ? "Simplified Chinese (简体中文)" : "English";
  return `You are the display-translation layer of Scalae, a Buffett/Munger-style value-investing research desk. Translate each input item into ${target}.

Rules:
- Professional investing register, natural phrasing (never word-for-word). Consistent terminology: moat 护城河, owner earnings 所有者盈余, capital allocation 资本配置, buyback 回购, margin of safety 安全边际, pricing power 定价权, filing 申报文件, earnings call 财报电话会, guidance 业绩指引, signal 信号.
- PRESERVE VERBATIM: ticker symbols (AAPL, 7203.T), company and person names written in Latin script, URLs, numbers, currency amounts, percentages, dates.
- PRESERVE MARKUP EXACTLY: markdown (**bold**, lists, headings, [text](url) links — translate only the link text), bracketed citation indexes like [12] or [3][17] (keep ASCII brackets, never full-width 【】), and internal markers like [[sig:abc]] or {{S1}} (copy them through untouched, in place).
- Return exactly one translation per input, same order. If an item is already in ${target}, return it unchanged. No notes, no commentary.`;
}

/** Split texts into model-call-sized batches. */
function batches(texts: string[]): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const t of texts) {
    if (cur.length > 0 && (cur.length >= BATCH_MAX_ITEMS || chars + t.length > BATCH_MAX_CHARS)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(t);
    chars += t.length;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

async function translateBatch(
  texts: string[],
  lang: Lang,
  model: string,
  meta?: UsageMeta
): Promise<string[]> {
  const payload = texts.map((t, i) => `<item index="${i}">\n${t}\n</item>`).join("\n");
  const out = await claudeJSON<{ translations: string[] }>({
    model,
    // Static per-language instructions, reused across every batch in a pass.
    system: [{ text: translationSystem(lang), cache: true }],
    messages: [
      {
        role: "user",
        content: `Translate these ${texts.length} items (return exactly ${texts.length} translations, in order):\n\n${payload}`,
      },
    ],
    schema: TRANSLATION_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: Math.min(32_000, 2_000 + texts.reduce((n, t) => n + t.length, 0) * 2),
    effort: "low",
    meta: { ...meta, feature: "translate" },
  });
  if (!Array.isArray(out.translations) || out.translations.length !== texts.length) {
    throw new Error(`translation batch shape mismatch (${out.translations?.length}/${texts.length})`);
  }
  return out.translations.map((t, i) => (typeof t === "string" && t.trim() ? t : texts[i]));
}

/** A translate function over a fixed set of source strings. */
export type Translated = (text: string | null | undefined) => string;

/**
 * Resolve translations for every candidate string (cache first, then batched
 * model calls for misses), returning a lookup that maps source → translated
 * (identity for anything untranslatable, unknown, or failed).
 */
export async function makeTranslator(
  candidates: Iterable<string | null | undefined>,
  lang: Lang,
  meta?: UsageMeta
): Promise<Translated> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (typeof c !== "string" || seen.has(c)) continue;
    seen.add(c);
    if (needsTranslation(c, lang)) unique.push(c);
  }
  const map = new Map<string, string>();
  const identity: Translated = (t) => (typeof t === "string" ? (map.get(t) ?? t) : "");

  if (unique.length === 0) return identity;

  const hashes = new Map(unique.map((t) => [t, sha256(t)]));
  try {
    const cached = await getTranslations(lang, [...hashes.values()]);
    const misses: string[] = [];
    for (const t of unique) {
      const hit = cached.get(hashes.get(t)!);
      if (hit != null) map.set(t, hit);
      else misses.push(t);
    }
    if (misses.length > 0) {
      const model = await resolveModel("translate");
      const groups = batches(misses);
      // Bounded parallelism; each batch caches independently, so partial
      // success still pays off on the next load.
      for (let i = 0; i < groups.length; i += MAX_PARALLEL_BATCHES) {
        const window = groups.slice(i, i + MAX_PARALLEL_BATCHES);
        const settled = await Promise.allSettled(
          window.map((g) => translateBatch(g, lang, model, meta))
        );
        for (let j = 0; j < window.length; j++) {
          const res = settled[j];
          if (res.status !== "fulfilled") {
            console.error(
              `[scalae] translation batch failed (${window[j].length} items):`,
              res.reason instanceof Error ? res.reason.message : res.reason
            );
            continue;
          }
          const entries: { hash: string; text: string }[] = [];
          window[j].forEach((src, k) => {
            const tr = res.value[k];
            map.set(src, tr);
            entries.push({ hash: hashes.get(src)!, text: tr });
          });
          void saveTranslations(lang, entries).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error("[scalae] translation layer degraded to originals:", e instanceof Error ? e.message : e);
  }
  return identity;
}

// ---------------------------------------------------------------------------
// Payload localizers — every AI-authored field, nothing else. Company names,
// user messages, external source titles and URLs pass through untouched.
// ---------------------------------------------------------------------------

function* signalTexts(s: Signal): Generator<string | null | undefined> {
  yield s.name;
  yield s.thesis;
  yield s.measurementPlan;
  yield s.scale;
  yield s.focusArea;
  yield s.backstory;
  yield s.backstoryBrief;
}

function localizeSignal<T extends Signal>(s: T, tr: Translated): T {
  return {
    ...s,
    name: tr(s.name),
    thesis: tr(s.thesis),
    measurementPlan: tr(s.measurementPlan),
    scale: tr(s.scale),
    focusArea: tr(s.focusArea),
    backstory: s.backstory != null ? tr(s.backstory) : s.backstory,
    backstoryBrief: s.backstoryBrief != null ? tr(s.backstoryBrief) : s.backstoryBrief,
  };
}

function localizeReading(r: Reading, tr: Translated): Reading {
  return { ...r, rationale: tr(r.rationale) };
}

function localizeWithReadings(s: SignalWithReadings, tr: Translated): SignalWithReadings {
  return {
    ...localizeSignal(s, tr),
    latest: s.latest ? localizeReading(s.latest, tr) : s.latest,
    history: s.history.map((r) => localizeReading(r, tr)),
  };
}

function localizeDigestItem(d: DigestItem, tr: Translated): DigestItem {
  return {
    ...d,
    headline: tr(d.headline),
    summary: tr(d.summary),
    sourceNote: d.sourceNote != null ? tr(d.sourceNote) : d.sourceNote,
    // Same source strings as the signals' names → same cached translations,
    // so name-keyed chips and cross-links keep matching after localization.
    signalNames: d.signalNames.map((n) => tr(n)),
  };
}

function localizeFocusArea(f: FocusArea, tr: Translated): FocusArea {
  return { ...f, title: tr(f.title), description: tr(f.description) };
}

export function runTexts(run: Run): (string | null | undefined)[] {
  return [run.brief, run.dossier, run.stageDetail, run.error, ...(run.questions ?? [])];
}

function applyRun(run: Run, tr: Translated): Run {
  return {
    ...run,
    brief: run.brief != null ? tr(run.brief) : run.brief,
    dossier: run.dossier != null ? tr(run.dossier) : run.dossier,
    stageDetail: tr(run.stageDetail),
    questions: (run.questions ?? []).map((q) => tr(q)),
    error: run.error != null ? tr(run.error) : run.error,
  };
}

/** Localize a single run object (run-start response, polling). */
export async function localizeRun(run: Run, lang: Lang, meta?: UsageMeta): Promise<Run> {
  if (lang === "en") return run; // canonical content is English — nothing to do
  const tr = await makeTranslator(runTexts(run), lang, meta);
  return applyRun(run, tr);
}

/** Localize the whole desk payload in one translator pass (one cache round-trip). */
export async function localizeDeskPayload(
  p: DeskPayload,
  lang: Lang,
  meta?: UsageMeta
): Promise<DeskPayload> {
  const candidates: (string | null | undefined)[] = [];
  for (const s of [...p.active, ...p.retired]) {
    candidates.push(...signalTexts(s));
    if (s.latest) candidates.push(s.latest.rationale);
    for (const r of s.history) candidates.push(r.rationale);
  }
  for (const s of [...p.suggested, ...p.dismissed]) candidates.push(...signalTexts(s));
  for (const f of p.focusAreas) candidates.push(f.title, f.description);
  for (const d of p.digest) candidates.push(d.headline, d.summary, d.sourceNote, ...d.signalNames);
  if (p.latestRun) candidates.push(...runTexts(p.latestRun));

  const tr = await makeTranslator(candidates, lang, meta);
  return {
    ...p,
    focusAreas: p.focusAreas.map((f) => localizeFocusArea(f, tr)),
    active: p.active.map((s) => localizeWithReadings(s, tr)),
    retired: p.retired.map((s) => localizeWithReadings(s, tr)),
    suggested: p.suggested.map((s) => localizeSignal(s, tr)),
    dismissed: p.dismissed.map((s) => localizeSignal(s, tr)),
    digest: p.digest.map((d) => localizeDigestItem(d, tr)),
    latestRun: p.latestRun ? applyRun(p.latestRun, tr) : p.latestRun,
  };
}

/** Localize a backstory research result ({ backstory, brief } shapes). */
export async function localizeBackstory<T extends { backstory?: string | null; brief?: string | null }>(
  result: T,
  lang: Lang,
  meta?: UsageMeta
): Promise<T> {
  if (lang === "en") return result;
  const tr = await makeTranslator([result.backstory, result.brief], lang, meta);
  return {
    ...result,
    backstory: result.backstory != null ? tr(result.backstory) : result.backstory,
    brief: result.brief != null ? tr(result.brief) : result.brief,
  };
}

// ---------------------------------------------------------------------------
// Due-diligence record. Only desk-authored fields translate — the investor's
// own notes, section titles and research steers stay verbatim, exactly like
// chat messages (their thinking is never rewritten by the display layer).
// ---------------------------------------------------------------------------

function localizeResearch(r: DiligenceResearch, tr: Translated): DiligenceResearch {
  return {
    ...r,
    memo: r.memo != null ? tr(r.memo) : r.memo,
    insights: r.insights != null ? tr(r.insights) : r.insights,
  };
}

function applySynthesis(s: DiligenceSynthesis, tr: Translated): DiligenceSynthesis {
  return { ...s, content: tr(s.content) };
}

export async function localizeDiligenceSynthesis(
  s: DiligenceSynthesis,
  lang: Lang,
  meta?: UsageMeta
): Promise<DiligenceSynthesis> {
  if (lang === "en") return s;
  const tr = await makeTranslator([s.content], lang, meta);
  return applySynthesis(s, tr);
}

export async function localizeDiligencePayload(
  p: DiligencePayload,
  lang: Lang,
  meta?: UsageMeta
): Promise<DiligencePayload> {
  if (lang === "en") return p;
  const candidates: (string | null | undefined)[] = [p.synthesis?.content];
  for (const s of p.sections) {
    for (const r of s.research) candidates.push(r.memo, r.insights);
  }
  // Signal names use the same cached strings the desk payload translates, so
  // chips here match the board's localized names.
  for (const s of p.activeSignals) candidates.push(s.name, s.focusArea);
  const tr = await makeTranslator(candidates, lang, meta);
  return {
    ...p,
    synthesis: p.synthesis ? applySynthesis(p.synthesis, tr) : p.synthesis,
    sections: p.sections.map((s) => ({
      ...s,
      research: s.research.map((r) => localizeResearch(r, tr)),
    })),
    activeSignals: p.activeSignals.map((s) => ({
      ...s,
      name: tr(s.name),
      focusArea: tr(s.focusArea),
    })),
  };
}

export async function localizeSectionSuggestions(
  suggestions: SectionSuggestion[],
  lang: Lang,
  meta?: UsageMeta
): Promise<SectionSuggestion[]> {
  if (lang === "en") return suggestions;
  const candidates: (string | null | undefined)[] = [];
  for (const s of suggestions) candidates.push(s.title, s.rationale, ...s.signalNames);
  const tr = await makeTranslator(candidates, lang, meta);
  return suggestions.map((s) => ({
    title: tr(s.title),
    rationale: tr(s.rationale),
    signalNames: s.signalNames.map((n) => tr(n)),
  }));
}
