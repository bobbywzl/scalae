# Corpus → Scalae Ingestion Playbook (for Claude Code)

> Scalae corpus library · file 10 · written 2026-08-12 against the current repo (`lib/agents/framework.ts` @ 1,148 lines, `research.ts` @ 1,395). Companion to `00-INDEX.md`.

This file answers three questions: how corpus knowledge becomes app behavior in the four target surfaces, how to run the ingestion with Claude Code in Bobby's priority order, and how to make "actually read the documents" verifiable instead of hoped-for.

## 1. How Claude Code gets knowledge into an app — the general model

Claude Code has no memory and no runtime presence. Each session it reads `CLAUDE.md`/`AGENTS.md` automatically, reads whatever files you point it at, and writes repo artifacts. So "ingesting the corpus" cannot mean "Claude Code knows the corpus" — it means Claude Code **compiles** the corpus into artifacts your runtime actually loads. Scalae already works exactly this way: `FOUNDATION.md` is doctrine, `lib/agents/framework.ts` is its executable form — typed data (`LENSES`, `MISJUDGMENT_TENDENCIES`) plus doctrine strings (`RUN_QUESTIONS_DOCTRINE`, `CLEANSING_DOCTRINE`) that `research.ts`/`diligence.ts`/`cleansing.ts` splice into prompts.

The corpus should land the same way: a **distillation compile**, done once per document, producing a typed, quote-cited module the four surfaces import. Do NOT make runtime agents fetch the hyperlinks — slow, flaky (OCR scans, bot-blocked hosts), unauditable, and it re-derives the same distillate every run. Runtime RAG over the full texts is a possible later layer for quote-level retrieval in memos; it is not needed for these four surfaces.

## 2. Target artifact: `lib/agents/canon.ts`

One new module (or a `lib/agents/canon/` directory with one file per investor + an index), mirroring the existing `Lens` pattern. Everything carries provenance.

```ts
export interface CanonSource { investor: string; doc: string; url: string; quote: string } // quote = verbatim, ≥8 words

export interface CanonQuestionPattern {   // → question suggestor
  pattern: string;        // the question form, company-agnostic ("What is the earliest observable symptom of <kill-path>?")
  askWhen: string;        // trigger: business classification, market state, record state
  anchor: "business-model" | "culture";
  source: CanonSource;
}

export interface CanonSearchDirective {   // → scout sweeps
  directive: string;      // a search behavior, not a literal query ("check insider buying vs. the stock's 2-year low", "compare the same business across listed markets before judging cheapness")
  queryShapes: string[];  // 1-3 concrete query templates with <COMPANY>/<INDUSTRY> slots
  sourcePriority: string; // what this investor treats as primary (filings-only for Schloss; store-level/channel evidence for Lynch; [zh] disclosures for Li Lu)
  source: CanonSource;
}

export interface CanonConcept extends Lens {  // → research analyst's latticework (same shape as framework.ts Lens)
  investor: string;       // whose vocabulary this is
  source: CanonSource;    // title, question, test, evidence inherited from Lens
}

export interface CanonMetric {            // → financial analyst / cleansing bench
  name: string;           // "Return on tangible capital (Greenblatt)"
  formula: string;        // stated in reported-line terms compatible with the bench (EBIT / (NWC + net fixed assets))
  reading: string;        // what it means, thresholds the investor actually used, in his words
  benchNotes: string;     // how it interacts with cleansing law (never EBITDA-family; depreciation is real; which cleansed lines feed it)
  anchor: "business-model" | "culture";
  source: CanonSource;
}
```

Plus text builders in the style of `lensListText()`: `canonQuestionText(classification)`, `canonSearchText(anchor)`, `canonConceptText()`, `canonMetricText()`.

Governance rule (add one paragraph to `framework.ts` and keep it): **the canon proposes, the charter disposes.** Canon entries are candidate questions/directives/concepts/metrics; the two anchors, the certainty-gap master question, the no-overlap rule, and human gates in the existing doctrines still govern. Where a canon concept duplicates an existing `LENSES` entry (Lynch's diworseification ⊂ Capital Allocation; Graham's margin of safety already lives in filter 4), extend that lens's `test`/`evidence` with the cited addition instead of adding a near-twin — the no-overlap rule applied to doctrine itself.

## 3. The four wire-in points (exact symbols)

1. **Question suggestor** — `RUN_QUESTIONS_DOCTRINE` + `QUESTION_METHOD` (framework.ts) consumed by `frameRunQuestions()` (research.ts:357). Splice `canonQuestionText(...)` in as a new numbered subsection of `QUESTION_METHOD` ("9. The bench's question patterns — cited forms from Graham, Templeton, Lynch, Klarman, Li Lu…"), and add one rule line to `RUN_QUESTIONS_DOCTRINE`: at most 1-2 canon-pattern questions per run, each instantiated to THIS company and named gap — patterns never emitted verbatim.
2. **Search words / focus direction** — the scout prompt builders in research.ts (~lines 220–295): `SCOUT_RULES`, the signal/company/culture sweep prompts, `questionSweepPrompt`, and the deep-dive probe prompt. Append `canonSearchText(anchor)` to the matching sweep: culture sweep gets culture-anchored directives, the company sweep gets business-model ones, probes get the directive whose `askWhen` matches. Directives contribute query shapes and source priorities — they must not override `SCOUT_RULES`' grounding requirements.
3. **Concepts for the research analyst** — `LENSES`/`lensDoctrineText()` and `DILIGENCE_MEMO_DOCTRINE`/`SYNTHESIS_DOCTRINE` (framework.ts). Merge distinct canon concepts (maximum pessimism, forced/uneconomic selling, Dhandho asymmetry, true-knowledge-vs-opinion, net-current-asset floor…) as additional `Lens` entries tagged with investor + source; extend existing lenses where they overlap. `lensDoctrineText()` then carries them everywhere lenses already flow — memos, synthesis, signal proposals — with zero extra plumbing.
4. **Financial metrics** — `CLEANSING_DOCTRINE`, `FIN_ANALYST_DOCTRINE`, `CLEANSING_SUGGEST_SCHEMA` (framework.ts:528–625) and cleansing.ts. Add `canonMetricText()` as a "CANON METRICS" section of `FIN_ANALYST_DOCTRINE`: metrics the analyst may compute/propose as custom rows (the `addRow` op) or cite in rationales — each with formula in reported-line terms and its bench interaction. Bench laws are unchanged: canon metrics that need undisclosed inputs are named as missing, never estimated; nothing EBITDA-family enters.

Tests to ask Claude Code for: a snapshot test that each doctrine string contains its canon section; a schema test that every canon entry has a non-empty `source.quote`; a dedup test that no canon concept title duplicates a `LENSES` title.

## 4. The compile pipeline (map → reduce, one document at a time)

**Stage 0 — fetch to cache.** `scripts/corpus/fetch.ts`: read the catalog files, download every Tier 1 + Tier 2 URL to `corpus-cache/<investor>/<slug>.{pdf,html}`, extract text to `<slug>.txt` (pdftotext; OCR via tesseract where the catalog's ingestion notes flag image-only scans), and write `corpus-cache/manifest.json`: `{slug, investor, tier, url, title, sha256, wordCount, fetchedAt, status: fetched|ocr-needed|blocked|manual}`. Books and `[paywall]` items get `status: manual` (drop purchased EPUBs/texts in by hand or skip). **Add `corpus-cache/` to `.gitignore`** — these are third-party full texts; keep them local, ship only the quote-level distillate.

**Stage 1 — extract per document.** For each doc in ledger order, read the cached `.txt` fully and write `docs/investor-corpus/extractions/<investor>/<slug>.md`:

```
---
slug, investor, url, wordCount, chunksRead: [1-6 of 6], coverage: 100%
---
## Verbatim quotes (≥10, each with char-offset or page anchor)
## Question patterns found (≥3 where present; each with supporting quote)
## Search directives found (each with quote)
## Concepts found (Lens shape; each with quote)
## Metrics found (each with formula as stated + quote)
## Nothing-found notes (which categories this doc genuinely lacks — honest empties allowed)
```

**Stage 2 — synthesize per investor.** From that investor's extraction files ONLY (never the catalog annotations), write the investor's canon module entries. Every entry cites `{doc, quote}` copied from an extraction file.

**Stage 3 — merge.** Cross-investor pass: dedupe concepts/metrics (same idea in two vocabularies → one entry, dual sources, primary vocabulary chosen by ledger priority), run the overlap check against `LENSES`, emit `canon.ts` + wire-ins.

**Stage 4 — verify (the guarantee, see §6).** `scripts/corpus/verify.ts` must pass before the ledger row advances.

## 5. Ingestion order — the ledger

`docs/investor-corpus/LEDGER.md`, one row per document. Priority is Bobby's order; within each investor, Tier 1 in catalog order, then Tier 2. Books are `manual` rows at the end of each block.

| Priority | Investor | Files |
|---|---|---|
| 1 | Benjamin Graham & David Dodd (+ Superinvestors bridge doc) | `01-graham-dodd.md` |
| 2 | John Templeton | `02-john-templeton.md` |
| 3 | Peter Lynch | `04-peter-lynch.md` |
| 4 | Seth Klarman | `05-seth-klarman.md` |
| 5 | Li Lu | `08-li-lu.md` |
| 6 | Walter Schloss | `03-walter-schloss.md` |
| 7 | Joel Greenblatt | `06-joel-greenblatt.md` |
| 8 | Mohnish Pabrai | `07-mohnish-pabrai.md` |
| 9 | Shared archives (bulk harvests) | `09-shared-archives.md` |

Row columns: `doc slug · url · status(fetched → extracted → verified → synthesized) · date`. Claude Code updates a row only when the stage's artifact exists and verify passes. The ledger is what makes the order enforceable and the whole job resumable — any new session reads `LEDGER.md`, finds the first incomplete row, and continues; order survives session boundaries, crashes, and /clear.

Scale expectation: Tier 1 across the eight investors ≈ 85 documents plus the ~46 Lynch Worth columns; roughly 700k–900k words of cached text. At one subagent per document this is an overnight batch, not an afternoon. Pabrai is deliberately last: his corpus is the largest and most repetitive — extract the ledger's Tier 1 subset, not all 90+ transcripts.

## 6. Guaranteeing Claude Code reads contents, not summaries

Plain truth: no instruction can *guarantee* an LLM read every word — instructions get skimmed exactly like documents do. The guarantee comes from structure: make the full text the only convenient source, make the required output impossible to produce without it, and verify mechanically.

1. **Cache first, then read locally.** The single highest-leverage move. `WebFetch` inside a coding session truncates, summarizes, and fails on PDFs/OCR/bot-blocked hosts — which quietly turns "read the source" into "read whatever came back." After Stage 0, "read the document" = `Read` on a local `.txt`, chunked to EOF — reliable, repeatable, auditable, and immune to link rot.
2. **Outputs that summaries can't fake.** The Stage 1 schema forces ≥10 verbatim quotes with location anchors and a chunk-coverage line. My catalog files contain one-line annotations per document; nothing in them can produce ten anchored quotes. An extraction produced without reading will contain invented quotes — which step 3 catches.
3. **Mechanical verification.** `scripts/corpus/verify.ts`: for every extraction file, (a) whitespace-normalize each quote and substring-match it against the cached text — any miss fails the doc; (b) check coverage says all chunks read; (c) check category minimums or an explicit nothing-found note; (d) recompute manifest wordCount. Wire it so the ledger row can't advance without a pass, and run it in CI. This converts "did it really read?" from trust into a failing test — fabricated or paraphrased-from-summary quotes do not survive a grep.
4. **Standing rules in CLAUDE.md** (§7) so every future session inherits the discipline — including the rule that catalog annotations are pointers, never sources.
5. **Session hygiene.** One investor per session (or one subagent per document, fanned out); `/clear` between investors; never let a context-stuffed session "remember" a document it read 200k tokens ago — the extraction file is the memory.

## 7. Paste into CLAUDE.md (or AGENTS.md)

```md
# Investor-corpus ingestion rules
- The catalog files in docs/investor-corpus/ are POINTERS. Never extract knowledge from their
  annotations; knowledge comes only from the cached full texts in corpus-cache/.
- To ingest a document: Read its corpus-cache .txt in sequential chunks to EOF, then write the
  extraction file per the schema in docs/investor-corpus/10-INGESTION-PLAYBOOK.md §4.
- Every extracted question/directive/concept/metric carries a verbatim quote (≥8 words) with a
  location anchor. No quote, no entry.
- Run scripts/corpus/verify.ts after each extraction; update LEDGER.md only on pass.
- Process LEDGER.md strictly in order: Graham/Dodd → Templeton → Lynch → Klarman → Li Lu →
  Schloss → Greenblatt → Pabrai. Never skip ahead past an unfinished row without marking it
  BLOCKED with a reason (paywall, OCR failure, dead link).
- If a document is unreadable, mark it BLOCKED — never substitute a summary, a memory of the
  document, or a web search result for its text.
- lib/agents/canon.ts entries must cite {doc, quote} pairs that exist verbatim in an extraction
  file. The canon proposes; FOUNDATION.md's anchors, no-overlap rule and human gates govern.
```

## 8. Claude Code run prompts (in order)

- **A — scaffold:** "Read docs/investor-corpus/10-INGESTION-PLAYBOOK.md. Build scripts/corpus/fetch.ts and scripts/corpus/verify.ts per §4/§6, generate LEDGER.md from the catalog files in the §5 order, gitignore corpus-cache/, run the fetcher for investor #1, and report the manifest (fetched / ocr-needed / blocked / manual counts)."
- **B — extract (repeat per investor):** "Continue LEDGER.md ingestion for <investor>. For each pending doc in order: Read the cached .txt fully in chunks to EOF, write the extraction file per the §4 schema, run verify, update the ledger. Use one subagent per document where docs are independent. Stop and mark BLOCKED rather than substituting summaries."
- **C — synthesize (per investor):** "From docs/investor-corpus/extractions/<investor>/ only, write the <investor> entries for lib/agents/canon.ts per the §2 schema. Every entry cites a {doc, quote} pair present in an extraction file. Run the §3 dedup check against LENSES and earlier investors."
- **D — wire in:** "Wire canon.ts into the four surfaces per §3 (QUESTION_METHOD/RUN_QUESTIONS_DOCTRINE, the research.ts scout prompts, LENSES/lensDoctrineText, FIN_ANALYST_DOCTRINE). Add the three tests from §3. Keep FOUNDATION.md governance: canon proposes, charter disposes."
- **E — audit:** "Adversarial pass: sample 3 random canon entries per investor, re-open their cached source texts, and confirm each quote exists and the entry fairly represents its context. Report discrepancies; fix or delete offenders."

Run A once, then B→C per investor in ledger order, then D once, E once. Every prompt names the playbook so a fresh session needs no other context. Ship in two milestones: run D the first time after investors 1–5 (Graham/Dodd, Templeton, Lynch, Klarman, Li Lu) so the four surfaces improve immediately; investors 6–8 then extend `canon.ts` without touching the wiring.

## 8b. Doing it efficiently

The pipeline is already shaped for cost — these rules keep it that way:

- **Scripts do the bulk work, tokens do the thinking.** Fetching, PDF→text, OCR, wordcounts, quote verification, ledger bookkeeping are deterministic scripts — zero LLM cost. The model spends tokens on exactly two things: reading cached text and writing extractions/synthesis.
- **Read each document once, ever.** The extraction file is the permanent memory of the read; Stages 2–4 and every future session work from extractions, never by re-reading sources. If a synthesis feels thin, the fix is a better extraction pass on named docs, not ad-hoc re-reads.
- **Tier the models.** Stage 1 extraction is disciplined reading, not judgment — run it on a cheaper/faster model (in Claude Code: subagents via the Task tool with a lighter model, or a dedicated session with `/model`). Reserve the strong model for Stage 2–3 synthesis, the §3 wire-in, and the §8-E audit.
- **Parallelize the map, serialize the reduce.** Documents within an investor are independent — fan out one subagent per document in parallel batches. Synthesis and merge are sequential by design (they enforce order and dedup).
- **Don't read what you won't use.** Compile v1 = Tier 1 only (~85 docs + the Worth columns). Books are skipped at v1 — their core ideas are restated in the Tier 1 talks/articles (each catalog file says where). Tier 2 enters only when a surface is demonstrably thin. Pabrai gets the ledger's Tier 1 subset only; his own ingestion notes say unique content ≈ ⅓ of raw tokens.
- **Cap the artifacts.** Extraction files: the required quotes plus ≤ ~600 words of structured findings — they are compile intermediates, not essays. `canon.ts` is the only artifact prompts pay for at runtime, so keep entries dense; the doctrine strings it feeds are read on every run.
- **Budget expectation.** ~85 Tier-1 docs, most under 15k words: one overnight batch of parallel extraction subagents, one synthesis session per investor (minutes each), one wire-in session. The expensive failure mode is re-reading — the ledger + extraction files exist to make that structurally unnecessary.

## 9. Two cautions

**Copyright:** the cache holds full third-party texts — keep it gitignored/local (fine for a compile input); the shipped artifact quotes at excerpt level with attribution, which is also what Walt-persona's citation-clicking expects.

**Voice drift:** don't average an investor across eras — extraction files carry dates, and synthesis should prefer late-career restatements where an investor revised himself (Pabrai's cigar-butts→compounders turn, Klarman's 2023–26 register) while keeping the early docs as history. The catalog files' ingestion notes flag these per investor.
