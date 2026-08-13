/**
 * Provenance check (AGENTS.md): every canon.ts entry must cite a {doc, quote}
 * pair that exists VERBATIM in an extraction file
 * (docs/investor-corpus/extractions/<investor>/<doc>.md).
 *
 * The extraction files are produced and owned by the corpus-extraction
 * pipeline; on a checkout that does not carry them (e.g. a branch not yet
 * merged with the extraction branch) the test SKIPS rather than fails.
 * Point CANON_EXTRACTIONS_DIR at an extractions directory to force the check
 * against a local copy.
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  CANON_CONCEPTS,
  CANON_DIRECTIVES,
  CANON_METRICS,
  CANON_QUESTIONS,
  type CanonSource,
} from "../lib/agents/canon";

const EXTRACTIONS_DIR =
  process.env.CANON_EXTRACTIONS_DIR ??
  path.join(__dirname, "..", "docs", "investor-corpus", "extractions");

const ALL: { kind: string; label: string; source: CanonSource }[] = [
  ...CANON_QUESTIONS.map((e) => ({ kind: "question", label: e.pattern, source: e.source })),
  ...CANON_DIRECTIVES.map((e) => ({ kind: "directive", label: e.directive, source: e.source })),
  ...CANON_CONCEPTS.map((e) => ({ kind: "concept", label: e.title, source: e.source })),
  ...CANON_METRICS.map((e) => ({ kind: "metric", label: e.name, source: e.source })),
];

/** Extraction files are read once per doc slug, found by walking the investor dirs. */
function loadExtractionIndex(): Map<string, string> | null {
  if (!fs.existsSync(EXTRACTIONS_DIR)) return null;
  const bySlug = new Map<string, string>();
  for (const investor of fs.readdirSync(EXTRACTIONS_DIR)) {
    const dir = path.join(EXTRACTIONS_DIR, investor);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".md")) {
        bySlug.set(path.basename(f, ".md"), fs.readFileSync(path.join(dir, f), "utf8"));
      }
    }
  }
  return bySlug.size > 0 ? bySlug : null;
}

/**
 * Quote matching mirrors the spirit of scripts/corpus/verify.ts: collapse
 * whitespace runs and normalize quote glyphs, then substring-match. Canon
 * quotes are copied from extraction files, so this should be near-exact.
 */
function normalize(s: string): string {
  return s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/—/g, "--")
    .replace(/\s+/g, " ")
    .trim();
}

test("every canon {doc, quote} pair exists verbatim in an extraction file", (t) => {
  const index = loadExtractionIndex();
  if (!index) {
    t.skip(
      `extractions not present at ${EXTRACTIONS_DIR} — set CANON_EXTRACTIONS_DIR to check provenance`
    );
    return;
  }
  for (const e of ALL) {
    const file = index.get(e.source.doc);
    assert.ok(
      file,
      `${e.kind} "${e.label}": no extraction file found for doc slug "${e.source.doc}"`
    );
    assert.ok(
      normalize(file as string).includes(normalize(e.source.quote)),
      `${e.kind} "${e.label}": quote not found verbatim in extractions/<investor>/${e.source.doc}.md`
    );
  }
});
