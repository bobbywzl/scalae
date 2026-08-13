<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product vision

The app's purpose and non-negotiable product rules live in `FOUNDATION.md` (two
anchors: every signal must relate to the ticker's **business model** or **corporate
culture**; no overlapping/duplicate signals; human approval gates). Any change to
signals, prompts, or agent behavior must stay consistent with it — `lib/agents/framework.ts`
is its executable form.

# Investor-corpus ingestion rules
- The catalog files in docs/investor-corpus/ are POINTERS. Never extract knowledge from their
  annotations; knowledge comes only from the cached full texts in corpus-cache/.
- To ingest a document: Read its corpus-cache .txt in sequential chunks to EOF, then write the
  extraction file per the schema in docs/investor-corpus/10-INGESTION-PLAYBOOK.md §4.
- Every extracted question/directive/concept/metric carries a verbatim quote (≥8 words) with a
  location anchor. No quote, no entry.
- Run scripts/corpus/verify.ts after each extraction; update LEDGER.md only on pass.
- Process LEDGER.md strictly in order, tier-major: ALL Tier 1 documents first (investor order:
  Graham/Dodd → Templeton → Lynch → Klarman → Li Lu → Schloss → Greenblatt → Pabrai), then ALL
  Tier 2 in the same investor order, and so on (Tier 3, then manual/book rows) — each tier pass
  completes before the next begins. Never start a row from a later tier while an earlier tier
  has pending rows, and never skip an unfinished row without marking it BLOCKED with a reason
  (paywall, OCR failure, dead link).
- If a document is unreadable, mark it BLOCKED — never substitute a summary, a memory of the
  document, or a web search result for its text.
- lib/agents/canon.ts entries must cite {doc, quote} pairs that exist verbatim in an extraction
  file. The canon proposes; FOUNDATION.md's anchors, no-overlap rule and human gates govern.
