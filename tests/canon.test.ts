/**
 * The three canon wire-in tests (ingestion playbook §3):
 *   1. each doctrine string carries its canon section — exactly when the
 *      canon has entries for it (empty canon = byte-identical doctrine);
 *   2. every canon entry cites a non-empty verbatim quote (≥8 words) with
 *      doc/url/investor provenance;
 *   3. no canon concept title duplicates a core lens title (the no-overlap
 *      rule applied to doctrine itself), and merged LENSES stays dupe-free.
 *
 * Run: npm test (tsx --test). Kept import-light: framework.ts + canon.ts
 * only — the research.ts splice is exercised through canonSearchText(),
 * which is the exact string the sweep prompts embed.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  CLEANSING_DOCTRINE,
  CORE_LENSES,
  DESK_DOCTRINE,
  LENSES,
  QUESTION_METHOD,
  RUN_QUESTIONS_DOCTRINE,
  FIN_ANALYST_DOCTRINE,
} from "../lib/agents/framework";
import {
  CANON_CONCEPTS,
  CANON_DIRECTIVES,
  CANON_METRICS,
  CANON_QUESTIONS,
  canonMetricText,
  canonQuestionText,
  canonSearchText,
  type CanonSource,
} from "../lib/agents/canon";

const ALL_ENTRIES: { kind: string; label: string; source: CanonSource }[] = [
  ...CANON_QUESTIONS.map((e) => ({ kind: "question", label: e.pattern, source: e.source })),
  ...CANON_DIRECTIVES.map((e) => ({ kind: "directive", label: e.directive, source: e.source })),
  ...CANON_CONCEPTS.map((e) => ({ kind: "concept", label: e.title, source: e.source })),
  ...CANON_METRICS.map((e) => ({ kind: "metric", label: e.name, source: e.source })),
];

test("§3 test 1 — each doctrine string carries its canon section exactly when populated", () => {
  // Question suggestor surface (QUESTION_METHOD + RUN_QUESTIONS_DOCTRINE).
  // Canon self-awareness (DESK_DOCTRINE names its inheritance so agents
  // can describe their value-investor grounding instead of denying it).
  const canonTotal =
    CANON_QUESTIONS.length + CANON_CONCEPTS.length + CANON_DIRECTIVES.length + CANON_METRICS.length;
  assert.equal(
    DESK_DOCTRINE.includes("THE DESK'S INHERITED CANON"),
    canonTotal > 0,
    "DESK_DOCTRINE provenance section must appear iff the canon has entries"
  );
  // Moderation suggest surface (CLEANSING_DOCTRINE's normalization shelf).
  assert.equal(
    CLEANSING_DOCTRINE.includes("THE CANON'S NORMALIZATION CONVENTIONS"),
    CANON_METRICS.length > 0,
    "CLEANSING_DOCTRINE canon section must appear iff canon metrics exist"
  );
  assert.equal(
    QUESTION_METHOD.includes("9. The bench's question patterns"),
    CANON_QUESTIONS.length > 0,
    "QUESTION_METHOD §9 must appear iff canon question patterns exist"
  );
  assert.equal(
    RUN_QUESTIONS_DOCTRINE.includes("Canon patterns"),
    CANON_QUESTIONS.length > 0,
    "RUN_QUESTIONS_DOCTRINE canon rule line must appear iff canon question patterns exist"
  );
  if (CANON_QUESTIONS.length > 0) {
    assert.ok(
      QUESTION_METHOD.includes(canonQuestionText()),
      "QUESTION_METHOD must embed canonQuestionText() verbatim"
    );
  }

  // Financial analyst surface (FIN_ANALYST_DOCTRINE).
  assert.equal(
    FIN_ANALYST_DOCTRINE.includes("CANON METRICS"),
    CANON_METRICS.length > 0,
    "FIN_ANALYST_DOCTRINE CANON METRICS section must appear iff canon metrics exist"
  );
  if (CANON_METRICS.length > 0) {
    assert.ok(
      FIN_ANALYST_DOCTRINE.includes(canonMetricText()),
      "FIN_ANALYST_DOCTRINE must embed canonMetricText() verbatim"
    );
  }

  // Research-analyst surface: every canon concept rides LENSES (and from
  // there lensDoctrineText()/DESK_DOCTRINE) — zero extra plumbing.
  for (const c of CANON_CONCEPTS) {
    assert.ok(
      LENSES.some((l) => l.title === c.title),
      `canon concept "${c.title}" must be merged into LENSES`
    );
  }

  // Scout-sweep surface: the anchor filter must partition the directives —
  // the culture sweep sees exactly the culture directives, the company sweep
  // exactly the business-model ones (this is the string research.ts embeds).
  const bm = canonSearchText("business-model");
  const cu = canonSearchText("culture");
  for (const d of CANON_DIRECTIVES) {
    assert.equal(bm.includes(d.directive), d.anchor === "business-model");
    assert.equal(cu.includes(d.directive), d.anchor === "culture");
    assert.ok(canonSearchText().includes(d.directive), "unanchored text carries every directive");
  }
});

test("§3 test 2 — every canon entry cites a verbatim quote ≥8 words with provenance", () => {
  for (const e of ALL_ENTRIES) {
    const words = e.source.quote.trim().split(/\s+/).filter(Boolean);
    assert.ok(
      words.length >= 8,
      `${e.kind} "${e.label}": source.quote must be ≥8 words (got ${words.length})`
    );
    assert.ok(e.source.doc.trim().length > 0, `${e.kind} "${e.label}": source.doc is empty`);
    assert.ok(e.source.url.trim().length > 0, `${e.kind} "${e.label}": source.url is empty`);
    assert.ok(
      e.source.investor.trim().length > 0,
      `${e.kind} "${e.label}": source.investor is empty`
    );
  }
});

test("§3 test 3 — no canon concept title duplicates a lens title; merged LENSES is dupe-free", () => {
  const coreTitles = new Set(CORE_LENSES.map((l) => l.title.trim().toLowerCase()));
  for (const c of CANON_CONCEPTS) {
    assert.ok(
      !coreTitles.has(c.title.trim().toLowerCase()),
      `canon concept "${c.title}" duplicates a core lens title — extend that lens instead (no-overlap rule)`
    );
  }
  const seen = new Set<string>();
  for (const l of LENSES) {
    const key = l.title.trim().toLowerCase();
    assert.ok(!seen.has(key), `duplicate title in merged LENSES: "${l.title}"`);
    seen.add(key);
  }
});
