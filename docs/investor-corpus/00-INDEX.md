# Value-Investor Corpus Library — Index & Scalae Integration

> Scalae corpus library · file 00 of 09 · compiled 2026-08-12 for the Scalae repo (`bobbywzl/scalae`).

Nine markdown files cataloging the complete legitimately-accessible online corpus of the value-investing canon below Buffett and Munger: every substantial text in each investor's own words — books, letters, lectures, speeches, interviews, columns, testimony — found, verified by fetch, tiered by importance, and annotated for ingestion. 391 links total. Built as source-of-truth input for Scalae's investor-perspective research; every link was live on 2026-08-12 unless tagged.

## Files

| File | Investor | Why they're canon | Public corpus size |
|---|---|---|---|
| `01-graham-dodd.md` | Benjamin Graham & David Dodd | Invented the discipline; Scalae's name is Graham's weighing machine | ~250–350k words of articles/lectures/testimony + 5 books |
| `02-john-templeton.md` | Sir John Templeton | Global bargain hunting; buy at the point of maximum pessimism | ~15–20k words clean text + 4–6 hrs video + books |
| `03-walter-schloss.md` | Walter Schloss | Purest Graham practice: cheap on assets, documents only, 47-year record | ~30–40k words + 1 video — small and complete |
| `04-peter-lynch.md` | Peter Lynch | Know what you own; the amateur's edge; earnings follow the business | ~400k words (books, ~46 Worth columns, transcripts) |
| `05-seth-klarman.md` | Seth Klarman | Risk-first margin of safety; the living Graham-and-Dodd standard | ~60–80k words public + ~7 hrs media (≈5% of his output is public) |
| `06-joel-greenblatt.md` | Joel Greenblatt | Value made teachable: special situations, then cheap+good quantified | ~500–700k words (312-pp class notes are the jewel) |
| `07-mohnish-pabrai.md` | Mohnish Pabrai | Dhandho, cloning, checklists; largest living oral corpus, self-transcribed | 4–6M raw words; ~1/3 unique after dedup |
| `08-li-lu.md` | Li Lu | Munger's heir; value investing joined to China's modernization | ~150–200k words EN + zh originals |
| `09-shared-archives.md` | Cross-investor archives | Graham & Doddsville, Heilbrunn, WealthTrack, OID, EDGAR — one archive, many voices | ~20 archives with harvest routes |

## How entries work

Every catalog entry is `**[Exact Title](URL)** — Year · Format · Host — one line on what it is and why it matters.` Three tiers per investor: **Tier 1 Canon** (ingest first, highest voice-per-token), **Tier 2 Important**, **Tier 3 Supplementary**. Tags: `[paywall]` legitimate but paid; `[unverified-fetch]` link corroborated but the page blocked automated fetch (YouTube, CNBC, EDGAR UI, etc.); `[zh]` Chinese-language original; `[context]` third-party document kept only because it carries the investor's words or record. Each file also carries a **Books** section (legitimate access paths only), a **Known to exist, not legitimately online** section (what's missing and how to source it), and **Ingestion notes** (dedup traps, transcript quality, OCR needs).

## Ingestion order

Investor priority (fixed): **Graham & Dodd → Templeton → Lynch → Klarman → Li Lu**, then **Schloss → Greenblatt → Pabrai**. Within each investor: Tier 1 in catalog order, then Tier 2, then books. Buffett's "Superinvestors of Graham-and-Doddsville" rides with Graham as the bridge document. `10-INGESTION-PLAYBOOK.md` turns this order into an enforceable ledger.

The canonical spine, in that order:

1. Graham & Dodd: the ten 1946–47 lectures + "A Conversation with Benjamin Graham" (1976) + the 1963 San Francisco speech + the 1932 Forbes trilogy + Superinvestors (1984)
2. Templeton: 16 Rules (1993) + Empire Club address (1979) + the client-letter series + "Financial Chaos" memo (2005)
3. Lynch: the Worth column run (1992–99, via the Wayback index) + 1994 Press Club transcript (MOI) + Frontline interview
4. Klarman: FAJ 2010 Q&A + MIT 2007 remarks + "The Forgotten Lessons of 2008" + the EDGAR Baupost Fund letters (1996–2001)
5. Li Lu: 2015 PKU lecture + 2019 "Practice of Value Investing" + 2024 "Global Value Investing in Our Era" + the PCA foreword
6. Schloss: 16 Factors memo (1994) + "Sixty-five Years on Wall Street" (1998) + the Columbia archive documents
7. Greenblatt: the 312-pp Columbia class notes + Graham & Doddsville Fall 2012 + the 1981 JPM paper
8. Pabrai: G&D 2008 + G&D 2019 (the before/after pair) + "Circle the Wagons" (UNO 2023) + one recent annual meeting transcript

Then the remaining Tier 2, Tier 3, video needing ASR, and the shared-archives bulk harvests (file 09 has the scripted-download paths).

Three rules regardless of phase. Dedup on (investor, event/issue, year), never on URL — syndication is rampant and Pabrai/Schloss reuse anecdotes across dozens of documents. Prefer official transcripts over auto-captions and fan transcriptions; each file's ingestion notes name the authoritative version. Budget an OCR pass — most pre-1990 material is typewriter scans without text layers.

## Wiring into Scalae

Suggested placement: `docs/investor-corpus/` in the repo (no `docs/` exists yet), referenced from `FOUNDATION.md` rather than pasted into it — the charter stays doctrine, this library stays evidence.

The nine map onto the existing charter cleanly. Each is a lens the desk can reason through, and each reinforces a doctrine already in `FOUNDATION.md`:

| Lens | Reinforces in FOUNDATION.md | The question they'd ask at the desk |
|---|---|---|
| Graham & Dodd | The two anchors' root; margin of safety as the last filter; Mr. Market; the app's namesake law | Is this an investment operation or a speculation, and what does the arithmetic say? |
| Templeton | Lollapalooza in reverse — crisis readings as opportunity; "this time it's different" as a red flag | Is this the point of maximum pessimism, and am I comparing bargains across every market? |
| Schloss | Mechanism-level evidence outranks narrative — he never talked to management; balance-sheet resilience | What do the filings alone say, and can I sleep at night if it halves? |
| Lynch | Circle of competence; the staged intake's two-minute drill; earnings line = business-model anchor; diworseification as a kill-path | Can the owner explain this business to a ten-year-old, and is the story checkable in the real world? |
| Klarman | Invert, always invert — the kill question; absolute over relative performance; honest "nothing happened today"; cash as residual | What can I lose, what are the chances, and what is the forced seller giving me? |
| Greenblatt | The finance-cleansing bench — owner earnings, EBIT/EV, return on tangible capital; forced/uneconomic selling as signal | What is it worth, am I paying a lot less, and who is selling for reasons that have nothing to do with value? |
| Pabrai | History is the base rate — checklists built from other investors' documented mistakes; few bets, big bets | Which documented failure does this rhyme with, and is the downside truly capped? |
| Li Lu | The certainty-gap master question — true knowledge vs. opinion (知行合一); circle of competence as a hard boundary | Do I actually know this, would I be comfortable on the other side of the trade, and how does the 10-year arc of this economy carry it? |

Drop-in paragraph for `FOUNDATION.md`, to adapt:

> **The bench behind the desk.** The desk reasons in the Buffett/Munger framework above. Behind it sits a bench of nine forebears and peers — Graham & Dodd, Templeton, Schloss, Lynch, Klarman, Greenblatt, Pabrai, Li Lu — whose primary texts are cataloged in `docs/investor-corpus/`. They are not extra voices on the board; they are reference lenses research agents may cite when a section, signal, or verdict benefits from a second discipline: Graham for price-vs-value arithmetic, Schloss for documents-only evidence, Klarman for risk-first inversion, Greenblatt for owner-earnings normalization, Lynch for circle-of-competence stories, Templeton for maximum pessimism, Li Lu for honesty about what is truly known, Pabrai for checklists built from documented failure. Every lens still answers to the two anchors, the certainty-gap question, and the evidence discipline.

Two repo-specific notes. The Li Lu file tags official Chinese originals `[zh]` with authoritative-translation guidance — directly useful for zh-CN surfaces (the 林悦 persona in `persona.md` probes exactly this). And the Graham file is the pedagogical spine for beginner users (the Priya persona arrives having just read *The Intelligent Investor*).

## Sourcing policy and known gaps

No pirated links anywhere in the library. Out-of-print books, leaked letters, and paywalled archives are cataloged in each file's "Known to exist, not legitimately online" section with the legitimate sourcing route instead. A desk whose charter says "never fabricate; every claim traces to a source" should not stand on links that die or draw takedowns.

The five gaps that matter most: Klarman's *Margin of Safety* and the Baupost partnership letters (the EDGAR Baupost Fund N-30D letters 1996–2001 are the legitimate substitute); Outstanding Investor Digest back issues (the deepest Schloss, Klarman, and Templeton interviews — purchasable by inquiry); the bulk Worth-column PDF (use the per-column Wayback captures in the Lynch file instead); Templeton's fund-era memos (legitimately reproduced inside *Templeton's Way with Money*); Li Lu's 2020 book (Chinese print only — the official himcap chapter PDFs cover most of it in English).

## Maintenance

Re-verify quarterly; link rot is the main decay mode, and the Wayback Machine is the standing fallback (several entries already point there deliberately). Known hazards, current as of 2026-08-12: sirjohntempleton.org is dead and serves spam — Wayback only; csinvesting.org is unstable/compromised — harvest via Wayback; the legacy pabraifunds.com articles page shows injected spam — use chaiwithpabrai.com; himcap CDN PDFs intermittently 403 datacenter IPs; YouTube upload titles misdate old footage — date from internal evidence. When two hosts carry the same document, the files already name the authoritative one; keep that ordering when replacing dead links.
