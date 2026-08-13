/**
 * The investor canon: quote-cited distillate of the corpus library
 * (docs/investor-corpus/ catalogs → corpus-cache/ full texts →
 * docs/investor-corpus/extractions/ → this module), per the ingestion
 * playbook (docs/investor-corpus/10-INGESTION-PLAYBOOK.md §2).
 *
 * Every entry carries provenance: a {doc, quote} pair copied VERBATIM from an
 * extraction file, which scripts/corpus/verify.ts has substring-matched
 * against the cached full text. No quote, no entry. Knowledge here comes only
 * from extraction files — never from the catalog annotations.
 *
 * Governance: THE CANON PROPOSES, THE CHARTER DISPOSES. Entries are candidate
 * questions, search directives, concepts and metrics; FOUNDATION.md's two
 * anchors, the certainty-gap master question, the no-overlap rule and the
 * human approval gates in the existing doctrines still govern everything.
 * Where a canon concept duplicates an existing framework.ts lens, the lens's
 * test/evidence is EXTENDED with the cited addition instead of a near-twin
 * entry being added — the no-overlap rule applied to doctrine itself.
 *
 * Investor order (ledger priority): Graham/Dodd → Templeton → Lynch →
 * Klarman → Li Lu → Schloss → Greenblatt → Pabrai.
 */

import type { Lens } from "./framework";

// ---------------------------------------------------------------------------
// Shapes (playbook §2)
// ---------------------------------------------------------------------------

/** Provenance for every canon entry. quote = verbatim from the source, ≥8 words. */
export interface CanonSource {
  investor: string;
  doc: string; // extraction/doc slug, e.g. "graham-lectures-1946-47-lecture-01"
  url: string;
  quote: string;
}

/** → question suggestor (QUESTION_METHOD / frameRunQuestions). */
export interface CanonQuestionPattern {
  /** The question form, company-agnostic ("What is the earliest observable symptom of <kill-path>?"). */
  pattern: string;
  /** Trigger: business classification, market state, record state. */
  askWhen: string;
  anchor: "business-model" | "culture";
  source: CanonSource;
}

/** → scout sweeps (research.ts prompt builders). */
export interface CanonSearchDirective {
  /** A search behavior, not a literal query. */
  directive: string;
  /** 1-3 concrete query templates with <COMPANY>/<INDUSTRY> slots. */
  queryShapes: string[];
  /** What this investor treats as primary evidence. */
  sourcePriority: string;
  /** Which sweep this directive belongs to (culture sweep vs. company/business sweeps). */
  anchor: "business-model" | "culture";
  source: CanonSource;
}

/** → the research analyst's latticework (merged into LENSES; same shape). */
export interface CanonConcept extends Lens {
  /** Whose vocabulary this is. */
  investor: string;
  source: CanonSource;
}

/** → financial analyst / cleansing bench (FIN_ANALYST_DOCTRINE). */
export interface CanonMetric {
  /** e.g. "Return on tangible capital (Greenblatt)". */
  name: string;
  /** Stated in reported-line terms compatible with the bench. */
  formula: string;
  /** What it means, thresholds the investor actually used, in his words. */
  reading: string;
  /** How it interacts with cleansing law (never EBITDA-family; depreciation is real). */
  benchNotes: string;
  anchor: "business-model" | "culture";
  source: CanonSource;
}

// ---------------------------------------------------------------------------
// Entries, ordered by ledger priority. Populated investor-by-investor as each
// investor's Tier 1 extraction block verifies (playbook §4 stage 2); each
// entry's {doc, quote} must exist verbatim in docs/investor-corpus/extractions/.
// ---------------------------------------------------------------------------

export const CANON_QUESTIONS: CanonQuestionPattern[] = [
  // (populated per investor as extraction blocks verify)
];

export const CANON_DIRECTIVES: CanonSearchDirective[] = [
  // (populated per investor as extraction blocks verify)
];

export const CANON_CONCEPTS: CanonConcept[] = [
  // (populated per investor as extraction blocks verify)
];

export const CANON_METRICS: CanonMetric[] = [
  // (populated per investor as extraction blocks verify)
];

// ---------------------------------------------------------------------------
// Text builders (the style of lensListText()) — how the canon reaches prompts.
// ---------------------------------------------------------------------------

/** Short attribution tag rendered after every canon line. */
function cite(s: CanonSource): string {
  return `(${s.investor} — "${s.quote}")`;
}

/**
 * The bench's question patterns, for QUESTION_METHOD. Company-agnostic forms
 * with their ask-when triggers; the question suggestor instantiates them to
 * the specific company and named gap (never emits them verbatim). Optional
 * classification filter narrows to patterns whose askWhen mentions it.
 */
export function canonQuestionText(classification?: string): string {
  const rows = classification
    ? CANON_QUESTIONS.filter((q) =>
        q.askWhen.toLowerCase().includes(classification.toLowerCase())
      )
    : CANON_QUESTIONS;
  return rows
    .map(
      (q, i) =>
        `${i + 1}. [${q.anchor}] ${q.pattern}\n   Ask when: ${q.askWhen} ${cite(q.source)}`
    )
    .join("\n");
}

/**
 * Search directives for the scout sweeps, filtered by anchor: the culture
 * sweep gets culture-anchored directives, the company/business sweeps get
 * business-model ones; no argument = all (deep-dive probes). Directives
 * contribute query shapes and source priorities — they never override the
 * sweep's own grounding rules.
 */
export function canonSearchText(anchor?: "business-model" | "culture"): string {
  const rows = anchor ? CANON_DIRECTIVES.filter((d) => d.anchor === anchor) : CANON_DIRECTIVES;
  return rows
    .map(
      (d, i) =>
        `${i + 1}. ${d.directive}\n   Query shapes: ${d.queryShapes.join(" · ")}\n   Source priority: ${d.sourcePriority} ${cite(d.source)}`
    )
    .join("\n");
}

/** The canon concepts as attributed lens lines (LENSES carries them everywhere). */
export function canonConceptText(): string {
  return CANON_CONCEPTS.map(
    (c, i) =>
      `${i + 1}. ${c.title} (${c.investor})\n   Question: ${c.question}\n   Doctrine: ${c.test}\n   Evidence that moves it: ${c.evidence}`
  ).join("\n");
}

/** Canon metrics for the financial analyst — formulas in reported-line terms. */
export function canonMetricText(): string {
  return CANON_METRICS.map(
    (m, i) =>
      `${i + 1}. ${m.name} [${m.anchor}]\n   Formula: ${m.formula}\n   Reading: ${m.reading}\n   Bench notes: ${m.benchNotes} ${cite(m.source)}`
  ).join("\n");
}
