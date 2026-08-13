# Extraction files — Stage 1 output (playbook §4, enforced by scripts/corpus/verify.ts)

One file per ledger document: `extractions/<investor>/<slug>.md`, where `<investor>` and
`<slug>` match `corpus-cache/manifest.json`. Produce it ONLY by Reading the cached
`corpus-cache/<investor>/<slug>.txt` in sequential chunks to EOF — never from the catalog
annotations, memory, or a web search (AGENTS.md). If the text is unreadable, mark the
ledger row BLOCKED instead of writing an extraction.

Exact format (verify.ts enforces every rule):

```md
---
slug: worth-z9906j01
investor: lynch
url: https://web.archive.org/web/19991008105720/http://www.worth.com/articles/Z9906J01.html
wordCount: 2143          # must equal the manifest wordCount (fresh recount)
chunksRead: 1-2 of 2     # sequential Read chunks to EOF; "1 of 1" for one-chunk docs
coverage: 100%
---

## Verbatim quotes
- > "Far more money has been lost by investors preparing for corrections than has been lost in corrections themselves." @chars 4210
- > "…at least ten of these, each ≥8 words, each with an @anchor…" @p.2

## Question patterns
- **pattern**: What is the earliest observable symptom of <kill-path>? — askWhen: …, anchor: business-model
  > "supporting verbatim quote from the text, eight words minimum" @chars 990

## Search directives
- **directive**: … — queryShapes: …, sourcePriority: …
  > "supporting verbatim quote for the directive, eight words minimum" @chars 1500

## Concepts
- **title**: … — question/test/evidence in Lens shape
  > "supporting verbatim quote for the concept, eight words minimum" @p.4

## Metrics
- **name**: … — formula as stated, reading, bench notes
  > "supporting verbatim quote stating the formula or threshold" @chars 7301

## Nothing-found notes
Metrics: nothing found — this column discusses temperament only.
```

Rules verify.ts enforces: quotes are lines starting `> ` (optionally `- > `); text between
`> ` and the trailing `@anchor` must substring-match the cached text after
whitespace/quote-glyph normalization (a fallback pass forgives PDF hyphenation); ≥10 quotes
under **Verbatim quotes**; ≥3 question patterns and ≥1 directive/concept/metric each with a
supporting quote — or an explicit nothing-found note in the section (or naming the category
under **Nothing-found notes**); `chunksRead` must reach EOF (`1-N of N`) and `coverage: 100%`.
Anchors: `@chars <offset>`, `@p.<page>`, `@line <n>`, or `@loc <…>`.

Keep each file to the required quotes plus ≤ ~600 words of structured findings (§8b) —
these are compile intermediates, not essays. Honest empties beat padded categories.

After writing: `node scripts/corpus/verify.ts --doc <slug>` — update LEDGER.md to
`extracted` only on PASS (then `verified` once a full verify run passes).
