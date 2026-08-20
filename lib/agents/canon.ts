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
 * APPLICATION IS CONTEXTUAL, NEVER ROTE (the investor's standing rule): the
 * canon is a reference library, not a checklist. An entry speaks only when
 * THIS company's situation — its business model, its industry, its current
 * events — or the investor's specific query summons it; on most runs, most
 * of the shelf stays silent, and zero canon items engaged is a normal,
 * healthy outcome. Nothing here is a static battery to be recited on every
 * research run, memo, or bench pass.
 *
 * Investor order (ledger priority): Graham/Dodd → Templeton → Lynch →
 * Klarman → Li Lu → Schloss → Greenblatt → Pabrai.
 *
 * AUDITED 2026-08-13 (adversarial pass, playbook §8-E): 3 random entries per
 * synthesized investor (seed "scalae-canon-audit-1"), each quote re-verified
 * against the REFETCHED source document, not just the extraction. 21 of 25
 * checks (21 originals + 4 supplements for wayback-blocked draws) matched
 * verbatim in the refetched sources — including 3 image-only PDFs
 * independently re-OCR'd, converging with the extraction pipeline's OCR —
 * and every quote fairly represents its surrounding context. 4 original
 * draws cite web.archive.org sources unreachable from the audit container;
 * those remain covered by the extraction-verbatim check (tests/) plus the
 * corpus verify.ts chain. No entries required fixing or deletion.
 *
 * TIER 2 AUDIT EXTENSION 2026-08-13: all 11 Tier 2 additions (not a
 * sample; 8 first-wave + 3 from the late Schloss/Greenblatt close-outs)
 * re-verified against freshly refetched sources — 11 of 11 quotes present
 * (one confirmed by page-image inspection where this container's OCR
 * misread one character the printed page shows plainly; the Schloss
 * liquidation memo's page image also confirms the 15-20% range its OCR
 * renders as "15.20%", and carries Schloss's handwritten worked example of
 * Graham's special-situation formula) and fairly represented. One fix from
 * the fair-representation read: the earnings-yield metric had blended a
 * companion equity gate and a testing-duration claim belonging to
 * the-simplest-way-to-select-bargain-stocks into an entry citing
 * an-hour-with-mr-graham; the gate is now its own metric with its own
 * verified citation, and the duration claim now matches its source.
 *
 * TIER 3 AUDIT 2026-08-15: all 4 Tier 3 additions (Graham/Dodd's
 * advocacy-stake QP, dividend round-trip and hidden-equity metrics;
 * Templeton's this-time-it's-different QP) verified verbatim against
 * freshly refetched sources at synthesis time — the two lecture citations
 * against the compiled PDF's clean text layer with context matching the
 * Northern Pacific figures line by line, the round-trip quote via
 * independent OCR of both stock-dividend scans, the Wikiquote page live.
 * The other five investors' Tier 3 blocks resolved to documented honest
 * empties; Pabrai remains blocked on his missing catalog.
 *
 * STAGE 2/3 RE-SYNTHESIS 2026-08-20: all 158 extraction files across all 7
 * synthesized investors were massively expanded (richer verbatim quotes,
 * question patterns, search directives, concepts, metrics, plus a new
 * "## Other" section per file, each re-sourced from freshly refetched
 * corpus-cache/ full texts) — this pass re-mined the enriched files for
 * canon instruments the original synthesis (built from the thinner
 * pre-expansion extractions) had not yet captured. 84 new entries added
 * (23 questions, 20 directives, 19 concepts, 22 metrics; one Li Lu directive
 * citing a Chinese-language quote was dropped post-merge — the corpus
 * verify.ts chain accepts non-ASCII verbatim quotes, but the canon's own
 * §3 test 2 word-count check is whitespace-based and does not segment CJK
 * text, so no zh-quoted entries are carried in CANON_* until that check
 * either adds a CJK code-point-count branch or such entries route around
 * it — flagged here rather than weakening the test). Total shelf: 213
 * entries (67 questions, 53 directives, 37 concepts, 56 metrics). Every
 * new entry's {doc, quote} was checked against the current extraction
 * files at merge time (not the pre-expansion versions); every new concept/
 * metric title was checked against CORE_LENSES (framework.ts) and every
 * existing CANON_CONCEPTS/CANON_METRICS title (all investors) for the
 * no-overlap rule before inclusion. tests/canon.test.ts and
 * tests/canon-provenance.test.ts both pass on the merged shelf.
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
  // --- 1. Benjamin Graham & David Dodd ---
  {
    pattern:
      "Are the earnings the market is capitalizing normal-period earnings or boom/abnormal-period earnings — and what would the record's normalized multi-year average actually support?",
    askWhen:
      "valuing off recent results after an unusually strong stretch (boom demand, shortage pricing, windfall margins) or when current margins sit far above the company's own multi-decade record",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-05",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture5.pdf",
      quote:
        "They do not emphasize enough the fact that the earnings they are dealing with are earnings of a boom period; but the technique of analysis should take that carefully into account.",
    },
  },
  {
    pattern:
      "Do the reported earnings reconcile with the change in balance-sheet equity plus dividends over the same span — and if not, through which reserve or surplus account is the difference being routed?",
    askWhen:
      "reviewing a multi-year record, an earnings jump, or any company with heavy reserves, restructuring charges, or surplus adjustments",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-01",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture1.pdf",
      quote:
        "In analyzing a company's showing over the war period it is quite important that you should do it by the balance sheet method, or at least use the balance sheet as a check.",
    },
  },
  {
    pattern:
      "Have depreciation, depletion, or amortization charges been reduced — via asset write-downs, lengthened lives, or method changes — for the purpose of inflating reported earnings rather than reflecting the assets actually consumed?",
    askWhen:
      "a sudden earnings improvement coincides with an impairment, a big-bath write-down, or a change in depreciation assumptions",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "security-analysis-2nd-edition-principles-and-technique",
      url: "https://archive.org/details/dli.ernet.7983",
      quote:
        "excessive write-downs of fixed assets, for the avowed or obvious purpose of decreasing depreciation and increasing reported earnings, constitute an inexcusable subterfuge and should not be condoned by the accounting profession.",
    },
  },
  {
    pattern:
      "Is each retained dollar demonstrably needed by the business, or is retention the unexamined default while owners receive a payout far below what normalized earnings would support?",
    askWhen:
      "cash-rich balance sheets, low payout ratios, or management rationalizing parsimony with conservatism language",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-09",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture9.pdf",
      quote:
        "Is it true that the outside stockholder invariably benefits from the retention of earnings in the business, as distinct from the payment of a fair return on the value of his equity in the form of dividends?",
    },
  },
  {
    pattern:
      "Does the board behave as trustee for the outside owners — dividends fair to the normalized record, buybacks not timed against the sellers it created, material information reaching all stockholders at once?",
    askWhen:
      "governance diligence; buybacks during suspended or cut dividends; any hint of selective disclosure or insider-convenient timing",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "security-analysis-2nd-edition-principles-and-technique",
      url: "https://archive.org/details/dli.ernet.7983",
      quote:
        "Corporations are in law the mere creatures and property of the stockholders who own them; the officers are only the paid employees of the stockholders; the directors, however chosen, are virtually trustees, whose legal duty it is to act solely in behalf of the owners of the business.",
    },
  },
  {
    pattern:
      "Is the market pricing this business below its net-current-asset (liquidating) value — and is the implied judgment of losing power actually evidenced in the record, or should liquidation, sale, or return of capital be on the owners' table?",
    askWhen:
      "a persistent, unexplained discount of price to net current assets or to unencumbered cash on an asset-heavy balance sheet",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "security-analysis-2nd-edition-principles-and-technique",
      url: "https://archive.org/details/dli.ernet.7983",
      quote:
        "When a common stock sells persistently below its liquidating value, then either the price is too low or the company should be liquidated",
    },
  },
  {
    pattern:
      "How much of the current quotation rests on demonstrated earning power, and how much is a speculative component priced on unproven expectations — how large is the layer that sentiment alone can remove?",
    askWhen:
      "the margin-of-safety check, whenever price embeds high multiples on recent results or a widely-told growth story",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-10",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture10.pdf",
      quote:
        "Of the price of $38, which it averaged in 1939, we said the analyst might conclude that about $25 a share represented the investment component and as much as $13 a share represented the speculative component.",
    },
  },
  {
    pattern:
      "Does management's incentive plan pay out only above a hurdle tied to what the owners actually received — or does it pay regardless of shareholder outcomes?",
    askWhen:
      "compensation-structure diligence, proxy season, or any change in incentive design",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "stock-market-study-senate-testimony-graham-excerpt-1955",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_testimony.pdf",
      quote:
        "We pay ourselves salaries on. the order of $25,000 and $15,000, and we also have a profit-sharing plan under which after a-$40-a-share dividend is earned and paid in any year the management as a whole receives 20 percent of the additional amount earned and paid.",
    },
  },
  // Tier 3 addition — Graham/Dodd:
  {
    pattern:
      "Does the source arguing this valuation or policy case disclose its own financial stake and its disputes with the subject's management — and does the argument still stand once that interest is priced in? Graham disclosed his own; a source that doesn't has already answered a character question.",
    askWhen:
      "weighing an analyst note, activist letter, short report, or any advocacy piece that argues for a specific valuation, transaction, or corporate-policy outcome",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "the-rediscovered-benjamin-graham-lectures-compiled-text-of-the-1",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham-lectures.pdf",
      quote:
        "my investment company has an interest in the New Amsterdam Casualty Company, and I have had a dispute with the management as to proper dividend policy.",
    },
  },

  // --- 2. John Templeton ---
  {
    pattern:
      "Is the pessimism around this company (or its industry) permanent or temporary — which specific evidence separates structural impairment (obsolescence, wrecked balance sheet, broken cost position) from a cycle, a sentiment swing, or forced selling?",
    askWhen:
      "the company or its industry is deeply out of favor and priced far below its own record's normal relation to earnings or assets",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "successful-investing-methods-address-to-the-empire-club-of-canad",
      url: "https://empireclubfoundation.org/speech/succesful-investing-methods/",
      quote:
        "We search for those areas that are unpopular and then we study them to see if that unpopularity is permanent.",
    },
  },
  {
    pattern:
      "Is the product line still in favor with the customers it serves — does the company's cost or technology advantage still attach to something customers actually want more of each year?",
    askWhen:
      "moat-durability review, especially for low-cost producers and technology leaders whose advantage presumes the product itself stays wanted",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "16-rules-for-investment-success",
      url: "https://www.franklintempleton.com/forms-literature/download/TL-R16",
      quote:
        "A company may be the low-cost producer, for example, but it is not a quality stock if its product line is falling out of favor with customers.",
    },
  },
  {
    pattern:
      "Is the read on this company unanimous — and if every source tells the same story, which unexamined assumption is everyone repeating, and what evidence would test it?",
    askWhen:
      "the desk's evidence sources converge on one narrative, or a thesis rests on what 'everyone knows' about the company",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "successful-investing-methods-address-to-the-empire-club-of-canad",
      url: "https://empireclubfoundation.org/speech/succesful-investing-methods/",
      quote:
        "If you get the same answer from twelve security analysts about which stock to buy you can be pretty sure it's the wrong stock.",
    },
  },
  {
    pattern:
      "How does this business fare under sustained inflation — can it reprice faster than its costs rise, or does inflation quietly confiscate its margins and its replacement capex?",
    askWhen:
      "inflationary periods, pricing-power reviews, or capital-intensive models whose depreciation understates replacement cost",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "successful-investing-methods-address-to-the-empire-club-of-canad",
      url: "https://empireclubfoundation.org/speech/succesful-investing-methods/",
      quote:
        "So more than ever before we are searching for shares of companies that will not suffer much from inflation or maybe even would benefit from inflation.",
    },
  },
  // Tier 3 addition — Templeton:
  {
    pattern:
      "Where does this thesis depend on a historically reliable regularity failing to apply this once — a peak capitalized as the new normal, a cycle declared dead, a valuation law suspended for this company — and has that exceptionalism claim been priced as the extraordinary claim it is?",
    askWhen:
      "any thesis (bull or bear) whose load-bearing step is 'this time is different'; boom-margin extrapolations, 'the cycle is structurally over' arguments, category exemptions from valuation discipline",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "john-templeton-wikiquote",
      url: "https://en.wikiquote.org/wiki/John_Templeton",
      quote:
        "The four most expensive words in the English language are \"this time it's different.\"",
    },
  },

  // --- 3. Peter Lynch ---
  {
    pattern:
      "Can the desk state, in two minutes and in plain language, why this business will earn materially more in five years — the specific driver, not the valuation?",
    askWhen:
      "before any thesis is written or a signal proposed on a new thread; whenever a holding's rationale has drifted into valuation-speak",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "peter-lynch-on-making-money-in-the-u-s-stock-market",
      url: "https://moiglobal.com/peter-lynch-1994/",
      quote:
        "If you can't explain to a 10-year-old in two minutes or less why you own a stock, you shouldn't own it.",
    },
  },
  {
    pattern:
      "Something material just moved — ignore the quote: what happened to the STORY? Which stated reason for the thesis is now more true, less true, or dead?",
    askWhen:
      "after any large move, surprising quarter, guidance change, or thesis-relevant event — the attribution must name a business cause",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "lessons-from-an-investing-legend-peter-lynch-secrets-to-success",
      url: "https://web.archive.org/web/20190919130623/https://www.fidelity.com/viewpoints/investing-ideas/peter-lynch-investment-strategy",
      quote:
        "The important thing is not the fact that the stock went from $3 to $6. Why did it go up? What happened to the story?",
    },
  },
  {
    pattern:
      "How much growing room is actually left — counted from where the company does and does not yet operate — and does the count support or refute the 'nowhere to grow' (or the endless-runway) narrative?",
    askWhen:
      "any growth thesis, any saturation claim, and whenever unit growth decelerates two periods running",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9703c02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9703C02.html",
      quote:
        "Don't believe them until you check for yourself. Look carefully at where the company does business and at how much growing room is left.",
    },
  },
  {
    pattern:
      "Is management exploiting the franchise it owns or diversifying away from it — of the last several capital commitments, which used the same operating skill and reached the same customer as the core?",
    askWhen:
      "a new segment, acquisition, or platform initiative is announced; the segment count rises while returns do not",
    anchor: "culture",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9806f02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9806F02.html",
      quote:
        "Block has made some mistakes. In particular, it has occasionally been too attracted to the idea of diversifying its business rather than exploiting its name.",
    },
  },
  {
    pattern:
      "Of every reason NOT to own this company, which are genuine worries — with a named observable that would confirm or retire them — and which are bogeymen no evidence would ever settle?",
    askWhen:
      "a company with an improving record stays cheap while every conversation repeats the same unfalsifiable fear",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9304e02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9304E02.html",
      quote:
        "Many companies give investors a lot to worry about, but there are genuine worries and then there's the \"bogeyman in the closet\" variety.",
    },
  },
  {
    pattern:
      "In this offering or secondary, what share of proceeds enters the business versus cashing out existing holders — and which insiders are net sellers at this price?",
    askWhen:
      "any issuance, spin-off, conversion, or insider selling into strength — read the use-of-proceeds and selling-shareholder tables",
    anchor: "culture",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9303e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9303E01.html",
      quote:
        "Whenever I see insiders using the IPO as an excuse to cash out, I ask myself: If they have no faith in the future of their company, why should I?",
    },
  },
  {
    pattern:
      "What did management demonstrably GIVE UP to make the claimed transformation real — and if the de-risking or reinvention cost nothing, why believe it happened?",
    askWhen:
      "any 'we're not that company anymore' narrative: de-risking, restructuring, quality pivots, culture overhauls",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9505e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9505E01.html",
      quote:
        "By borrowing long and issuing callable debt, it has lessened its earnings in the short run and given up the chance of making the occasional killing when interest rates go its way.",
    },
  },
  {
    pattern:
      "The company's end-market has a contested platform or standards war — does this business prosper regardless of which combatant wins, or is its fate tied to one winner?",
    askWhen:
      "suppliers, toolmakers and infrastructure providers in industries with unresolved format or share wars",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "use-your-edge-by-peter-lynch",
      url: "https://www.rbcpa.com/commentary-archive/use-your-edge-by-peter-lynch/",
      quote:
        "This is the old combat theory of investing: When there's a war going on, don't buy the companies that are doing the fighting; buy the companies that sell the bullets.",
    },
  },

  // --- 4. Seth Klarman ---
  {
    pattern:
      "Not only IS this security undervalued, but WHY is it undervalued — who is selling, under what constraint, and is their reason about the business or about themselves?",
    askWhen:
      "any thesis that begins from cheapness; whenever a discount widens without business news",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-2000-06-28",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-00-000708.txt",
      quote:
        "Because investing is a highly competitive activity, we consider for each of our investments not only whether a security is undervalued but why it is undervalued.",
    },
  },
  {
    pattern:
      "What specific, nameable event converts this discount into realized value within a year or two — and if none exists, why won't today's multi-year low simply become a deeper one?",
    askWhen:
      "any thesis whose principal support is price history ('cheapest in a decade') rather than a dated realization path",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "masters-in-business-seth-klarman-full-transcript",
      url: "https://ritholtz.com/2026/06/transcript-seth-klarman/",
      quote:
        "If we can't make an argument for why it's turned around in the next year or two, it might be nice that it's trading at a five-year low, but that doesn't mean it's not going to be at a seven-year low and a ten-year low.",
    },
  },
  {
    pattern:
      "If conditions got materially worse than the bear case — a depression-grade outcome — would this company still be okay on its own balance sheet and contracts? Survival is an entry condition, not a scenario weight.",
    askWhen:
      "underwriting any position during dislocation, and whenever the bear case is drawn only from a benign post-war sample",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "masters-in-business-seth-klarman-full-transcript",
      url: "https://ritholtz.com/2026/06/transcript-seth-klarman/",
      quote:
        "in every case we were stress-testing: hey, if the world got even worse, if this turned out to be 1933, will this investment be okay?",
    },
  },
  {
    pattern:
      "How much of this company's smooth, meets-or-beats record is manufactured — write-ups and write-downs, accounting-policy changes, actuarial-assumption revisions, one-time items — and what ownership base is applying the pressure to smooth?",
    askWhen:
      "any long meets-or-beats streak or unusually low earnings variability, especially with a relative-performance-driven shareholder register",
    anchor: "culture",
    source: {
      investor: "Seth Klarman",
      doc: "the-baupost-fund-shareholder-letter-fy1999-form-n-30d",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt",
      quote:
        "there is enormous pressure on managements to smooth their results and pull the occasional rabbit out of a hat to deliver the desired quarterly outcomes.",
    },
  },
  {
    pattern:
      "Whose earnings per share are these — how many shares can be issued to management at fixed prices, and what do the per-share figures look like on a fully-loaded count?",
    askWhen:
      "option-heavy issuers, and whenever per-share arithmetic anchors a valuation or a compensation claim",
    anchor: "culture",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1998-06-29",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0000950135-98-004072.txt",
      quote:
        "Reported earnings per share are potentially overstated to the extent that additional shares can be issued to management at fixed prices.",
    },
  },
  {
    pattern:
      "The arrogance test: buying asserts we know more than the seller and as much or more than every other prospective buyer — what, specifically, is that knowledge for this company, stated in writing?",
    askWhen:
      "the desk's final honesty check before any conviction is recorded; whenever a thesis cannot name its informational or analytical edge",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1996-12-30",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0000903893-96-001136.txt",
      quote:
        "We regard investing as an arrogant act; an investor who buys is effectively saying that he or she knows more than the seller and the same or more than other prospective buyers.",
    },
  },

  // --- 5. Li Lu ---
  {
    pattern:
      "The multiple looks low — but WHY: are the earnings at a cyclical peak, padded with one-time or windfall elements, or genuinely long-term, stable and sustainable? Decompose before the ratio means anything.",
    askWhen:
      "any statistically cheap reading — a low multiple on undecomposed earnings is a story, not a fact",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "global-value-investing-in-our-era",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/67a4f75703627bd3a927077e_Global%20Value%20Investing%20in%20Our%20Era%20%282024-12-07%29.pdf",
      quote:
        "are the earnings cyclical? If the P/E is low, is it because it is at the peak of the cycle, because the earnings include many one-time or cyclical elements, or because the earnings are genuinely long-term, stable, and sustainable?",
    },
  },
  {
    pattern:
      "Through this drawdown, has the company's own value-creation series — sales, earnings, book value — kept compounding, or did the business itself break? Do we truly know how much value it created this year?",
    askWhen:
      "a holding or watched company falls hard; the desk's understanding is only confirmed when a severe decline forces re-examination and the thesis still holds",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "global-value-investing-in-our-era",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/67a4f75703627bd3a927077e_Global%20Value%20Investing%20in%20Our%20Era%20%282024-12-07%29.pdf",
      quote:
        "Another example is BYD, which we've held for 22 years. During this time, its stock has dropped by more than 50% at least six times, once even by more than 80%.",
    },
  },
  {
    pattern:
      "Whose interest does this company's own pricing structure serve — does it get paid for value delivered to the customer, or paid regardless, the way professional fees reflect the professionals?",
    askWhen:
      "fee-based, agency, advisory and intermediary business models; any model where the customer cannot judge product quality",
    anchor: "culture",
    source: {
      investor: "Li Lu",
      doc: "the-prospect-of-value-investing-in-china",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5ef3c7300432b46a7e659977_The%20Prospect%20of%20Value%20Investing%20in%20China%20English%20Translation.pdf",
      quote:
        "The pricing structure basically reflects the interests of professionals, and not so much those of the client.",
    },
  },
  {
    pattern:
      "Is there behavioral evidence — not claims — that this management treats outside capital like their own family's hard-earned savings? What have they actually done with other people's money when nobody was forcing them?",
    askWhen:
      "trust-and-stewardship diligence: related-party history, treatment of minority holders, conduct in past ventures",
    anchor: "culture",
    source: {
      investor: "Li Lu",
      doc: "the-prospect-of-value-investing-in-china",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5ef3c7300432b46a7e659977_The%20Prospect%20of%20Value%20Investing%20in%20China%20English%20Translation.pdf",
      quote:
        "Every penny entrusted to you by your client should be treated as though it were the money your parents had worked hard to earn and saved thriftily over their lifetime.",
    },
  },
  // Tier 2 additions — Li Lu:
  {
    pattern:
      "Can the desk state this company's WORST CASE ten years out — and if it cannot, does it actually understand the business at all? Understanding is verified by the downside forecast, not the upside story.",
    askWhen:
      "the desk's understanding check on any thesis; directly serves the certainty-gap master question's ten-year horizon",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "q-a-with-li-lu",
      url: "https://www.longriverinv.com/thought/qampa-with-li-lu",
      quote:
        "if they really understand a company they're researching, then they must be able to say what will be the worst case for that company after ten years",
    },
  },
  {
    pattern:
      "Toward strangers with no tie to management — minority shareholders, anonymous customers, arms-length suppliers — does this company act with the honesty it shows insiders and relationship partners? The untested stranger edge is where trustworthiness shows first.",
    askWhen:
      "relationship-driven, founder-led or family-controlled businesses, where conduct toward the five insider relationships tells you little about conduct toward the sixth",
    anchor: "culture",
    source: {
      investor: "Li Lu",
      doc: "a-discussion-of-modernization",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5ef3c7300432b403eb659976_Li%20Lu%20on%20Discussion%20of%20Modernization%202016%20Final.pdf",
      quote:
        "So how should a righteous, trustworthy, loving and respectful person treat a complete stranger? I feel the best answer is with honesty.",
    },
  },
  {
    pattern:
      "If this company (or its home market) were cut off from the largest open market it trades in — restrictions, delisting, sanctions, decoupling — how fast would it fall behind, and is that isolation trend currently widening or narrowing?",
    askWhen:
      "cross-border businesses and geopolitically exposed tickers; isolation costs compound (lost idea-exchange, not just lost revenue), which is what makes this a kill-path with a clock",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "a-discussion-of-modernization",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5ef3c7300432b403eb659976_Li%20Lu%20on%20Discussion%20of%20Modernization%202016%20Final.pdf",
      quote:
        "The best way to fall behind is to close itself off from other countries. Such is the Iron Law of Civilization 3.0.",
    },
  },

  // --- 6. Walter Schloss ---
  {
    pattern:
      "Who protects the assets while the thesis waits — does management own enough stock that dissipating the company's substance would be self-harm, and is their fairness to outside holders on the record?",
    askWhen:
      "asset-anchored theses with long, uncertain waits; depressed companies where the danger is the assets leaking away before value is recognized",
    anchor: "culture",
    source: {
      investor: "Walter Schloss",
      doc: "the-right-stuff-why-walter-schloss-is-such-a-great-investor",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Walter%20Schloss%20-%20The%20Right%20Stuff%20-%20Barrons%20-%2002-25-85.pdf",
      quote: "the management owned a lot of the stock, and they were not going to throw it down the drain.",
    },
  },
  {
    pattern:
      "If this thesis buys earnings rather than assets, does the desk actually carry the much-heavier knowledge burden earnings demand — and would the thesis survive on asset value alone?",
    askWhen:
      "any valuation resting on earnings persistence; whenever the earnings story outruns what the desk demonstrably knows about competitive position and durability",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "factors-needed-to-make-money-in-the-stock-market",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/schloss_factors.pdf",
      quote: "One has to know much more about a company if one buys earnings.",
    },
  },

  // --- 7. Joel Greenblatt ---
  {
    pattern:
      "How good a business is this, measured before anything else: what pre-tax return does it earn on the tangible capital actually tied up in it — and what would incremental capital earn?",
    askWhen:
      "the first read on any company, before valuation; whenever growth spending is being credited as value creation",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote: "The first thing I look at ROIC = EBIT/ (NWC + Net Equipment). How good a business is this?",
    },
  },
  {
    pattern:
      "Can normalized earnings three or four years out be estimated with real confidence — and if they cannot, is the honest verdict 'pass' rather than a dressed-up guess?",
    askWhen:
      "every valuation exercise; fashion-driven, patent-cliff, or opaque businesses where normalization is the whole question",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote: "If I am unable to normalize earnings, then pass on the opportunity or set aside.",
    },
  },
  {
    pattern:
      "Can the desk name the causal mechanism tying this signal to THIS company's future cash flows — or is the case resting on a correlation that may be cyclical, crowded, or already arbitraged away?",
    askWhen:
      "any thesis justified mainly by a screen, factor label, or historical pattern rather than a company-specific mechanism",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "transcript-joel-greenblatt-masters-in-business-relative-value",
      url: "https://ritholtz.com/2020/10/transcript-joel-greenblatt-2/",
      quote:
        "although it’s correlated with good returns in the past, that’s not what I would continue doing even though it’s correlated. I’m looking for causation.",
    },
  },
  {
    pattern:
      "Follow the money through this transaction's structure: what exactly is in it for the insiders — ownership, option strikes, fees — and does their payoff align with outside holders or come at their expense?",
    askWhen:
      "spin-offs, recapitalizations, mergers, rights offerings — any structured transaction whose documents disclose who gets what",
    anchor: "culture",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "FOLLOW THE MONEY! No matter how a transaction is structured, if you can figure out what is in it for the insiders, you will have discovered one of the most important keys to selecting the best spin-off opportunities.",
    },
  },
  {
    pattern:
      "How many more units at this return — can the demonstrated unit economics actually be replicated a thousand times, and at what point does the marginal return decay toward the cost of capital?",
    askWhen:
      "any replication growth thesis (stores, branches, plants, cohorts) — growth is part of value only at high incremental returns",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "rwh003-how-to-win-the-investing-game-w-joel-greenblatt",
      url: "https://www.theinvestorspodcast.com/richer-wiser-happier/how-to-win-the-investing-game-w-joel-greenblatt/",
      quote: "The real question is, can I open a thousand of those stores that earn 30%?",
    },
  },
  {
    pattern:
      "Does this management measure itself on outputs — what customers actually got — or on inputs (spend, headcount, credentials, effort), and which do its own reported success metrics track?",
    askWhen:
      "reading management's self-chosen KPIs, incentive metrics, and progress narratives",
    anchor: "culture",
    source: {
      investor: "Joel Greenblatt",
      doc: "rwh003-how-to-win-the-investing-game-w-joel-greenblatt",
      url: "https://www.theinvestorspodcast.com/richer-wiser-happier/how-to-win-the-investing-game-w-joel-greenblatt/",
      quote:
        "most of schooling is done with inputs, meaning, well, if we get this teacher and they have this much experience and we get whatever, but if you’re measuring outputs, which is, are the kids learning?",
    },
  },
  // Tier 2 addition — Greenblatt:
  {
    pattern:
      "Today's news hands the desk an obvious reason not to touch this cheap name — has that reason been judged temporary or permanent, knowing a newspaper-legible repellent is the expected signature of a real bargain, not by itself a disqualifier?",
    askWhen:
      "a statistically cheap candidate feels uncomfortable because of a current, well-publicized problem; the behavioral half of the lens's nothing-is-cheap-for-no-reason rule (and the name-level cousin of Templeton's market-level maximum-pessimism entries)",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "briefing-book-joel-greenblatt-intelligent-investing-with-steve-f",
      url: "https://images.forbes.com/media/pdfs/2010/04/Joel_Greenblatt_Briefing_Book.pdf",
      quote:
        "if you go through the whole list of top-ranked companies, there is a reason, and you know it because you just read the paper, why you wouldn't buy any one of them.",
    },
  },
  // ---------------------------------------------------------------------------
  // STAGE 2/3 RE-SYNTHESIS 2026-08-20: new CANON_QUESTIONS mined from the massively expanded
  // extraction files (all 158 corpus files were substantially enriched in the same
  // pass). Checked for duplication against every entry already above (this file,
  // all investors) and against CORE_LENSES in framework.ts before inclusion; every
  // quote below re-verified verbatim against its cited extraction file at merge time.
  // ---------------------------------------------------------------------------
  // Benjamin Graham & David Dodd:
{
    pattern:
      "If the fiduciary duty against trading on non-public information legally binds only officers, directors, and major stockholders, does an outside analyst who receives selective management color sit outside that duty entirely — and should the desk treat information obtained that way as clean simply because it is legal?",
    askWhen:
      "the desk is offered non-public color through an analyst day, expert network, or one-on-one management access not equally available to all stockholders",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "stock-market-study-senate-testimony-graham-excerpt-1955",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_testimony.pdf",
      quote:
        "trading on inside information applies only to those who = have a fiduciary relationship toward the stockholders, namely, officers, directors, and major stockholders.",
    },
  },
  {
    pattern:
      "Does this thesis's expected success depend on correctly forecasting which way the market or economy will move, or would the position's value be realized regardless of that direction — is the thesis structurally independent of any view of the future?",
    askWhen:
      "reviewing a proposed thesis's load-bearing assumptions, before treating a favorable macro or market-direction call as a reason to act",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "stock-market-study-senate-testimony-graham-excerpt-1955",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_testimony.pdf",
      quote:
        "if you can make your results: independent of any views as to the future you are that much better off.",
    },
  },
  {
    pattern:
      "Does this 'good company' recommendation state an explicit valuation range showing what the buyer is paying for quality and growth (the penetrating approach), or does it rest on quality-and-prospects language alone with no stated value anchor (the conventional approach) — and is the price actually within fair-value range?",
    askWhen:
      "evaluating any recommendation to buy a well-regarded, high-quality business, especially one pushed on reputation or momentum rather than a stated price discipline",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-07",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture7.pdf",
      quote:
        "Investors do not make mistakes, or bad mistakes, in buying good stocks at fair prices. They make their serious mistakes by buying poor stocks, particularly the ones that are pushed for various reasons.",
    },
  },
  // John Templeton:
{
    pattern:
      "Given that roughly a third of an elite index's or ranking's constituents typically turn over within a decade (decline, acquisition, going-private, bankruptcy), what is the base-rate case that THIS company's current membership, rank, or market position will still hold in ten years — and what evidence, beyond its incumbency, supports treating it as an exception?",
    askWhen:
      "a thesis leans on inclusion in a prestige index, 'blue-chip' status, or a market-leader ranking as evidence of durability, rather than on the underlying economics that would sustain that rank",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "16-rules-for-investment-success",
      url: "https://www.franklintempleton.com/forms-literature/download/TL-R16",
      quote:
        "From 1978 through 1990, one of every three issues changed—because the company was in decline, or was acquired, or went private, or went bankrupt.",
    },
  },
  {
    pattern:
      "Is the current valuation driven predominantly by demonstrated business value, or partly by a surplus of investable cash (pension flows, buyback demand, index inflows) chasing a scarce supply of quality shares — and would the multiple survive a reversal of that flow?",
    askWhen:
      "elevated sector-wide or market-wide multiples where the fundamental (earnings/moat) case looks weaker than the price action, or when explaining an unusually high multiple purely by 'demand' rather than by the record",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "successful-investing-methods-address-to-the-empire-club-of-canad",
      url: "https://empireclubfoundation.org/speech/succesful-investing-methods/",
      quote:
        "the stocks don't necessarily sell at a high price because of value. Value is only half of the equation. The other half of the equation is how much cash.",
    },
  },
  // Peter Lynch:
{
    pattern:
      "During a genuinely closed season (or any stretch when the company structurally cannot disclose new operating information), has anything actually changed about the business — or is a price decline necessarily pure sentiment, since there is no operating news to react to?",
    askWhen:
      "a seasonal, cyclical-reporting, or otherwise dormant-disclosure business (amusement parks, agriculture, holiday retail) moves sharply between its own reporting windows with no company-specific announcement",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9503e02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9503E02.html",
      quote:
        "The good news is out, and for a few months the parks will be closed and the roller coasters turned off, so nothing is going to happen to affect the company's prospects for a prosperous1995 and beyond.",
    },
  },
  {
    pattern:
      "When several independent, skilled buy-side pickers each name their current highest-conviction ideas, what category or sector is conspicuously ABSENT from the combined list — and does that shared avoidance mark exactly where risk/reward has turned unfavorable?",
    askWhen:
      "synthesizing a cross-manager idea canvass or comparing several named professionals' current top picks; the gap in the list is itself the finding, not just the names on it",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9803c01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9803C01.html",
      quote:
        "I suggest you start by thinking about what isn't on it. There are no technology stocks-no Microsoft, no Intel, no Cisco Systems.",
    },
  },
  {
    pattern:
      "Is this candidate simultaneously rejected by growth-style buyers (growth rate too slow), value-style buyers (price too rich relative to that growth rate), AND momentum/technical buyers (chart looks bad) — and if so, does the triple rejection reflect real deterioration, or three different style boxes each finding a different, non-overlapping reason to pass?",
    askWhen:
      "a company with improving underlying fundamentals stays unowned across every investing style simultaneously, with no single camp offering a falsifiable objection",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9701e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9701E01.html",
      quote:
        "If you're a value guy, you say, 'Wal-Mart is trading at a premium to its growth rate.' So the value guys aren't interested either.",
    },
  },
  // Seth Klarman:
{
    pattern:
      "Would we still be comfortable holding this position if the market for it closed for the next five years — or does the thesis secretly depend on being able to sell to someone else soon?",
    askWhen:
      "the desk's final gut-check on any thesis, distinguishing genuine long-term ownership conviction (investing) from a disguised trading bet dressed up as investing (speculation)",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "the-baupost-fund-shareholder-letter-fy1999-form-n-30d",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt",
      quote:
        "Very few investors would choose to hold their current portfolios if they thought the stock market might be closed for trading for the next five years; since we are investing and not speculating, we would be comfortable with our portfolio under such conditions.",
    },
  },
  {
    pattern:
      "Is this company's funding or liquidity plan quietly assuming that credit markets will always behave the way they have for the past several decades — rollover debt always available, terms always benign — with no stated contingency for when they don't?",
    askWhen:
      "assessing refinancing risk, commercial-paper or short-term-debt reliance, and any balance sheet whose survival depends on continuously accessible external credit rather than on its own cash generation",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "opportunities-for-patient-investors",
      url: "https://rpc.cfainstitute.org/research/financial-analysts-journal/2010/opportunities-for-patient-investors",
      quote:
        "GE assumed that the markets would be the same as they had been for decades and that it could always roll commercial paper—and when it couldn't, the government rescued it.",
    },
  },
  {
    pattern:
      "When every knowledgeable voice in the room — board, management, sell-side, the company's own prior public statements — agrees on the same rosy outlook, does that unanimity raise or lower the odds the outlook is actually correct?",
    askWhen:
      "stress-testing a thesis or a management narrative that draws its confidence from broad consensus rather than from falsifiable evidence; strongest as a red-flag check immediately before a position is sized around a widely-shared view",
    anchor: "culture",
    source: {
      investor: "Seth Klarman",
      doc: "opportunities-for-patient-investors",
      url: "https://rpc.cfainstitute.org/research/financial-analysts-journal/2010/opportunities-for-patient-investors",
      quote:
        "All of our partners instinctively said, \"Wow! That's groupthink. We better be really careful before assuming that because everyone thinks that, it is definitely going to happen.\"",
    },
  },
  {
    pattern:
      "Does this company's actual behavior — its holdings, its risk-taking, its capital deployment — still match the disciplined identity it claims for itself, or has that identity quietly become a label with nothing behind it?",
    askWhen:
      "any company or manager whose investment thesis rests partly on a stated discipline, philosophy or brand (a 'conservative underwriter,' a 'value' fund, a 'low-risk lender') — audit the label against what was actually done, not what is claimed",
    anchor: "culture",
    source: {
      investor: "Seth Klarman",
      doc: "the-baupost-fund-shareholder-letter-fy1999-form-n-30d",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt",
      quote:
        "One prominent \"value investor\" owns among his ten largest holdings big stakes in Microsoft, IBM, Cisco Systems, America Online and Amazon.com.",
    },
  },
  // Li Lu:
{
    pattern:
      "A screen surfaces a statistically cheap security — is there a specific, checkable reason for the market's neglect (no capital-markets need so no sell-side coverage, concentrated family control with no minority voting rights, an unresolved litigation overhang, a guidance miss that soured sentiment), or is the cheapness simply unexplained?",
    askWhen:
      "after a valuation screen (low P/E, low P/B, new-low list) surfaces a candidate, before committing research time or capital — Li Lu's own practice was to name the specific mechanism keeping the price down before trusting it",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "li-lu-s-investing-masterclass-at-columbia-business-school-2006-t",
      url: "https://roiss.substack.com/p/li-lus-investing-masterclass-at-columbia",
      quote:
        "Why is it so cheap? If you are a business owner, you would buy this company for this price.",
    },
  },
  {
    pattern:
      "Has this specific insight or mispricing already been captured by the broader market — has 'the room filled up' with other investors and institutions chasing the same idea — signaling the informational edge has closed even though the business itself may still be sound?",
    askWhen:
      "monitoring a position whose thesis rested on a genuine information or analytical edge rather than a hard valuation floor; a rising crowd of coverage, institutional buyers, or repeated media attention on the same idea is the observable symptom to track",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "li-lu-s-investing-masterclass-at-columbia-business-school-2006-t",
      url: "https://roiss.substack.com/p/li-lus-investing-masterclass-at-columbia",
      quote:
        "At the end of 2000 the room was packed with 50 or more people and major institutions started to look at the company. That's when I knew it was time to sell.",
    },
  },
  {
    pattern:
      "Given the desk's actual intended holding horizon for this position, which factor is really doing the work of protecting the moat — people (management's skill, decisions, relationships), which matters more over a short horizon, or industry structure (competitive dynamics, barriers, customer switching costs), which matters more over a long one — and has the diligence weighting been matched to the right one?",
    askWhen:
      "sizing conviction or diligence effort for a multi-year vs. a short-horizon position on the same company; a management-quality-heavy thesis intended to be held for a decade, or an industry-structure-heavy thesis intended for a short hold, both signal a horizon/driver mismatch worth naming explicitly",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "q-a-with-li-lu",
      url: "https://www.longriverinv.com/thought/qampa-with-li-lu",
      quote:
        "The longer your investment horizon, the more important industry dynamics become for protecting your moat.",
    },
  },
  // Walter Schloss:
{
    pattern:
      "Is this holding's price decline driven by fundamental deterioration in the business, or by mechanical, tax-motivated selling unrelated to its value?",
    askWhen:
      "a position falls further after purchase — especially late in the calendar year — before deciding whether to add to it or reassess the thesis",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "sixty-five-years-on-wall-street",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Schloss-Sixty-Five-Years.pdf",
      quote:
        "So sometimes the stocks that are going down go down more than they should. It's simply because people are trying to save some money by selling it to take the tax loss.",
    },
  },
  {
    pattern:
      "Has the price fallen far enough below asset value that the discount itself signals real business deterioration rather than opportunity — is this statistically cheap, or a candidate for 'going down the tubes'?",
    askWhen:
      "screening deep-discount / net-net candidates before committing capital, especially where the discount is unusually wide even by net-net standards",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "the-right-stuff-why-walter-schloss-is-such-a-great-investor",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Walter%20Schloss%20-%20The%20Right%20Stuff%20-%20Barrons%20-%2002-25-85.pdf",
      quote:
        "when you got them too cheap, they maybe ended up going down the tubes. So you try to be a little careful.",
    },
  },
  {
    pattern:
      "Given management's structural incentive to sound optimistic — especially at a troubled company — how much weight should their own outlook commentary receive against the filed numbers?",
    askWhen:
      "a company in visible difficulty is being assessed and management's public tone reads more confident than the operating trend supports",
    anchor: "culture",
    source: {
      investor: "Walter Schloss",
      doc: "why-we-invest-the-way-we-do",
      url: "https://web.archive.org/web/20201108184717/https://www8.gsb.columbia.edu/sites/valueinvesting/files/files/Why%20We%20Invest%20the%20Way%20We%20Do.pdf",
      quote:
        'Very rarely will an officer say, "We are doing badly, the outlook is poor and we are very pessimistic about our future".',
    },
  },
  {
    pattern:
      "Can this valuation case be made on the company's own numbers — book value, price history, statistical cheapness — or does it actually depend on a qualitative read of industry structure and competitive position the desk hasn't done?",
    askWhen:
      "deciding how much industry/competitive research is actually necessary to support an asset-anchored thesis",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "going-out-on-top-walter-edwin-schloss",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Bottom%20Line%20April%2017%20-%20Walter%20Schloss.pdf",
      quote:
        "he was using the statistics. he wasn't using industry analysis. he was using the value of the company.",
    },
  },
  // Joel Greenblatt:
{
    pattern:
      "If a merger security (warrant, exchangeable debenture, contingent value right) looks worthless or 'junk' on its face because disinterested holders are dumping it, what is it actually worth used as currency to acquire the more valuable security bundled with it?",
    askWhen:
      "reading the 'merger consideration' section of a takeover proxy that bundles a discounted or unwanted security together with the deal's primary consideration",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "I could buy $70 of face value of these securities for only $42.00 (60% of $70). I would have this right for five years.",
    },
  },
  {
    pattern:
      "Does the desk actually have the procedural and legal grasp of the bankruptcy process needed to judge how creditors, the judge, and other claim-holders will behave — on top of the underlying asset valuation — before sizing any position in this distressed name?",
    askWhen:
      "considering any bond, bank-debt, or trade-claim purchase in a company that is in or near bankruptcy",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "What is needed to be a distress investor: legal and procedural knowledge of the bankruptcy process, valuing assets and companies and being a good investor.",
    },
  },
  {
    pattern:
      "In this risk-arbitrage or merger-securities bet, what do I actually stand to lose if the deal breaks — not just what annualized spread I collect if it closes?",
    askWhen:
      "sizing any risk-arbitrage or takeover-related position, where the quoted spread makes the trade look like easy, low-risk money",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "I look at it as a risk reward business. I can make a dollar but I can lose $10 and all this happens in three months.",
    },
  },
  {
    pattern:
      "How is this management's 'bread buttered' — do they hold meaningful equity relative to salary, or is compensation mostly cash with little personal capital genuinely at risk?",
    askWhen:
      "evaluating any management team's incentive alignment, especially ahead of a spin-off, recapitalization, or other structured transaction",
    anchor: "culture",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "You want to see how the management's bread buttered. How much of their salary vs. share ownership?",
    },
  },
];

export const CANON_DIRECTIVES: CanonSearchDirective[] = [
  // --- 1. Benjamin Graham & David Dodd ---
  {
    directive:
      "When reported per-share earnings jump sharply or diverge from peers, reconcile the change in shareholders' equity (plus dividends, minus new stock issued) against cumulative reported earnings over the same span; a persistent gap flags nonrecurrent items, reserve games, or charges routed around the income account.",
    queryShapes: [
      "<COMPANY> change in shareholders equity vs cumulative reported net income",
      "<COMPANY> reserve charges surplus adjustments annual report",
      "<COMPANY> items charged directly to equity bypassing income statement",
    ],
    sourcePriority:
      "successive balance sheets from primary filings (both year-ends), over any single-year income statement or summary manual",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "security-analysis-2nd-edition-principles-and-technique",
      url: "https://archive.org/details/dli.ernet.7983",
      quote: "and the truer story told by the successive balance sheets",
    },
  },
  {
    directive:
      "Check the market price against net current assets (current assets minus ALL liabilities, zero for plant and goodwill); when the quote sits below that floor, test whether the implied losing-power judgment is evidenced in the operating record or is unexamined pessimism.",
    queryShapes: [
      "<COMPANY> market capitalization vs net current assets",
      "<COMPANY> net working capital per share balance sheet",
      "<INDUSTRY> companies trading below net current asset value",
    ],
    sourcePriority:
      "the balance sheet itself (cash, receivables, inventory, total liabilities) over price action or market narrative",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "forbes-series-i-inflated-treasuries-and-deflated-stockholders",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_forbes_1932_3.pdf",
      quote:
        "companies listed on the New York Stock Exchange, disclosed that over 200 of them--or fully one out of three--have been selling at less than their net quick assets.",
    },
  },
  {
    directive:
      "Before accepting a company's stated depreciation policy, cross-check book depreciation against the tax-basis figure (today: the deferred-tax disclosures and cash taxes paid); a persistent book-vs-tax gap is a reliable tell of overstated reported earnings.",
    queryShapes: [
      "<COMPANY> deferred tax liability depreciation timing difference 10-K",
      "<COMPANY> book vs tax depreciation gap",
      "<COMPANY> cash taxes paid vs reported tax expense trend",
    ],
    sourcePriority:
      "SEC filings' tax footnotes and deferred-tax disclosures over management's own earnings presentation",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "security-analysis-2nd-edition-principles-and-technique",
      url: "https://archive.org/details/dli.ernet.7983",
      quote:
        "we now can advance no less than five major reasons for accepting, in general, the income tax figure rather than the income-account basis of depreciation.",
    },
  },
  {
    directive:
      "When a value-realization thesis exists, locate the specific corporate event it depends on (reorganization, recapitalization, spinoff, liquidation, merger) and its documented timeline, rather than a hoped-for general re-rating.",
    queryShapes: [
      "<COMPANY> reorganization OR recapitalization OR merger timeline filings",
      "<COMPANY> spinoff OR breakup plan announced terms",
      "<COMPANY> plan of liquidation OR return of capital proposal",
    ],
    sourcePriority: "SEC/court filings and merger proxies over news commentary",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "stock-market-study-senate-testimony-graham-excerpt-1955",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_testimony.pdf",
      quote:
        "movement of stock prices in general, but related to some development in the company's affairs. That would be particularly a matter such as recapitalization and reorganization.",
    },
  },
  {
    directive:
      "Test dividend-policy fairness: compare the payout against the multi-year average of earnings (never a single weak year) and against a near-identical peer's policy, and check each of management's stated reasons for a low payout against that normalized record.",
    queryShapes: [
      "<COMPANY> dividend payout vs 5-year average earnings",
      "<INDUSTRY> peer dividend policy comparison similar earnings assets",
      "<COMPANY> management explanation dividend policy conservatism",
    ],
    sourcePriority:
      "the dividend record and filed financials over management commentary; peer filings for the comparison",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-09",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture9.pdf",
      quote:
        "Dividend policy should be based upon average earnings in the past and upon expected average earnings in the future",
    },
  },
  // Tier 2 addition — Graham/Dodd:
  {
    directive:
      "Back-calculate the expectations the current price implies — the future growth rate the quote assumes — and compare them against the company's actual demonstrated record; a large gap between implied expectations and the record is the finding, whichever direction it runs.",
    queryShapes: [
      "<COMPANY> growth rate implied by current valuation vs historical",
      "<COMPANY> earnings growth record 10 years vs consensus expectations",
      "<COMPANY> what the market is pricing in analysis",
    ],
    sourcePriority:
      "the company's own multi-year reported record for the demonstrated side; the implied side is arithmetic from the price, never a target",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "two-illustrative-approaches-to-formula-valuations-of-common-stoc",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_approaches_valuation.pdf",
      quote:
        "the market often has concepts of future earnings changes which cannot be derived from the companies' past performance",
    },
  },
  {
    directive:
      "When the company repurchases stock, check the conduct around it: were dividends maintained, was the repurchase disclosed to all owners, and is management buying from stockholders at prices its own withholding depressed?",
    queryShapes: [
      "<COMPANY> buyback while dividend suspended or cut",
      "<COMPANY> repurchase timing vs disclosure of material information",
      "<COMPANY> insider purchases during depressed price history",
    ],
    sourcePriority:
      "repurchase and dividend records from filings; disclosure timelines from company releases and regulator documents",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "forbes-series-ii-should-rich-corporations-return-stockholders-ca",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_forbes_1932_return_cash.pdf",
      quote:
        "To withhold the owners' money from them by suspending dividends, and then to use this same money to buy back their stock at the abnormally low price thus created, comes perilously close to sharp practice.",
    },
  },

  // --- 2. John Templeton ---
  {
    directive:
      "Compare the same business across every market where it (or its closest comparable) is listed before judging cheapness or dearness — the estimate of value is worldwide, and the best comparable often trades in another country's market.",
    queryShapes: [
      "<COMPANY> valuation vs closest comparables listed in other markets",
      "<INDUSTRY> price to earnings by country listed peers",
      "<COMPANY> dual listing ADR vs home market disclosure differences",
    ],
    sourcePriority:
      "primary filings and disclosures across ALL listings, including the foreign comparable's home-market documents — never one market's narrative about another",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "john-templeton-warren-buffett-and-robert-wilson-adam-smith-s-mon",
      url: "https://www.gurufocus.com/news/611156/a-rare-interview-of-john-templeton-warren-buffett-and-robert-wilson",
      quote:
        "We are worldwide bargain hunters. We search all over the world and make estimates of the values of each corporation and buy those shares that have the lowest market price at the time in relation to our estimated value.",
    },
  },
  {
    directive:
      "Work the corners other analysts are not working: local-language disclosures, subsidiary and segment filings, small trade journals, regulator dockets nobody summarizes — evidence found where no one is looking moves the value estimate most.",
    queryShapes: [
      "<COMPANY> local language regulatory filing detail",
      "<COMPANY> subsidiary annual report segment disclosure",
      "<INDUSTRY> specialist trade journal coverage <COMPANY>",
    ],
    sourcePriority:
      "under-read primary documents (local filings, subsidiary reports, niche trade press) over the widely-circulated coverage everyone already holds",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "john-templeton-warren-buffett-and-robert-wilson-adam-smith-s-mon",
      url: "https://www.gurufocus.com/news/611156/a-rare-interview-of-john-templeton-warren-buffett-and-robert-wilson",
      quote:
        "But since the best results are obtained by [buying] in those areas where other security analysts were not working, we just say we would buy the best bargains we can find and later find out what nation it's in.",
    },
  },
  {
    directive:
      "When the company or its industry is deeply out of favor, gather the evidence that decides whether the unpopularity is permanent: demand trend (structural vs. cyclical), substitution threat, worst-case survivability of the balance sheet, and cost position through a trough.",
    queryShapes: [
      "<INDUSTRY> demand trend structural decline vs cyclical trough evidence",
      "<COMPANY> balance sheet survivability downturn scenario",
      "<INDUSTRY> substitution threat adoption data",
    ],
    sourcePriority:
      "industry volume/price data and the company's filed balance sheet over sentiment coverage; the pessimists' own strongest documents, read directly",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "successful-investing-methods-address-to-the-empire-club-of-canad",
      url: "https://empireclubfoundation.org/speech/succesful-investing-methods/",
      quote:
        "We search for nations or industries where the stock prices are extremely low and they are only extremely low when there are good reasons for it.",
    },
  },
  {
    directive:
      "Track the company's own buying as revealed valuation opinion: repurchase pace and prices, insider purchases, and credible strategic-acquirer interest — the people with the most information voting with cash rather than words.",
    queryShapes: [
      "<COMPANY> share repurchase pace and average price paid",
      "<COMPANY> insider open-market purchases record",
      "<COMPANY> strategic acquirer takeover interest reported terms",
    ],
    sourcePriority:
      "repurchase disclosures, insider-transaction filings and deal documents over commentary about them",
    anchor: "culture",
    source: {
      investor: "John Templeton",
      doc: "john-templeton-warren-buffett-and-robert-wilson-adam-smith-s-mon",
      url: "https://www.gurufocus.com/news/611156/a-rare-interview-of-john-templeton-warren-buffett-and-robert-wilson",
      quote:
        "This takeover mania proves the fact that corporations on the stock exchange are selling for much less than what they are worth.",
    },
  },

  // --- 3. Peter Lynch ---
  {
    directive:
      "Gather store-level and channel evidence before financial evidence: what customers, employees and local coverage say about the actual operation — traffic, queues, service quality, whether new units look like the old ones. The web-scale version of Lynch's mall visit.",
    queryShapes: [
      "<COMPANY> customer reviews complaints store locations recent",
      "<COMPANY> new location openings local press coverage",
      "<COMPANY> product review vs <COMPETITOR> switching users",
    ],
    sourcePriority:
      "first-hand/consumer/practitioner sources (reviews, local trade press, user forums) for the facts filings don't report; company unit disclosures to check the count; analyst narrative last",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9304e02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9304E02.html",
      quote:
        "One of the benefits of visiting a retail outlet is that it brings the numbers alive. You can study a company's earnings potential all day long, but bullish forecasts always seem more believable after you've seen the evidence in person at the mall.",
    },
  },
  {
    directive:
      "Identify the one or two industry-specific operating indicators that lead this company's earnings — a physical quantity or realized price, not a forecast — and track those instead of any macro series.",
    queryShapes: [
      "<INDUSTRY> inventory levels monthly trend data",
      "<INDUSTRY> used equipment secondary market prices",
      "<COMPANY> capacity utilization backlog channel inventory",
    ],
    sourcePriority:
      "trade and industry operating data and first-hand observation, explicitly ahead of economist or strategist forecasts",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "peter-lynch-on-making-money-in-the-u-s-stock-market",
      url: "https://moiglobal.com/peter-lynch-1994/",
      quote:
        "When I own auto stocks, I want to know what's happening to used car prices. When used car prices rise, it's a good indicator.",
    },
  },
  {
    directive:
      "Convert every growth story into a countable penetration gap: enumerate units, markets and geographies served versus serviceable from primary disclosures, and refuse both the saturation claim and the endless-TAM claim until the count is done.",
    queryShapes: [
      "<COMPANY> store count locations by state 10-K",
      "<COMPANY> units opened per year expansion plan disclosure",
      "<INDUSTRY> penetration rate installed base addressable",
    ],
    sourcePriority:
      "the company's own unit/geography disclosures first, trade-association penetration data second, sell-side TAM estimates last (they are the claim under test)",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9703c02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9703C02.html",
      quote:
        "Only 10 to 20 percent of the schools have been wired into networks, and don't forget about office buildings, hospitals, and government agencies nationwide. Petsmart is hardly at the end of its rope -- its 320 stores are in only 34 states.",
    },
  },
  {
    directive:
      "Pull the segment footnote on any company whose name implies one business and establish which unit actually produces the earnings — hunt for a good business obscured by an unrelated one, and for the separation event that would let the market see it.",
    queryShapes: [
      "<COMPANY> segment earnings breakdown 10-K footnote",
      "<COMPANY> spin-off separation announced terms",
      "<COMPANY> sum-of-the-parts segment pure-play comparables",
    ],
    sourcePriority:
      "10-K segment reporting and separation filings first; management presentations second",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9810f02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9810F02.html",
      quote:
        "This wasn't a retail company; it was a crazy quilt of financial-services outfits stitched to a retail operation.",
    },
  },
  {
    directive:
      "In a price-taking industry, research the company's place on the cost curve, not the commodity: cash and total cost per unit versus the industry average, plus the hedge/contract book — the spread is what survives a price collapse.",
    queryShapes: [
      "<COMPANY> cash cost total cost per unit produced",
      "<INDUSTRY> average production cost per unit curve",
      "<COMPANY> hedging contracts fixed price volumes years",
    ],
    sourcePriority:
      "company operating statistics and filings first, industry cost-curve benchmarks second; commodity price forecasts explicitly excluded",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9711e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9711E01.html",
      quote:
        "I mentioned that the average company is now spending $317 to get an ounce of gold out of the ground.",
    },
  },
  {
    directive:
      "Read the offering documents for the money trail: use of proceeds, selling shareholders, insider purchases, and the gap between preliminary and final terms — what the people with the most information did with their own position.",
    queryShapes: [
      "<COMPANY> prospectus use of proceeds selling shareholders",
      "<COMPANY> S-1 insider purchases directors officers",
      "<COMPANY> secondary offering who is selling",
    ],
    sourcePriority:
      "the filings themselves, first and last; underwriter research is an interested party",
    anchor: "culture",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9303e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9303E01.html",
      quote: "A prospectus also tells you what happens to the money that was raised in the stock sale.",
    },
  },
  {
    directive:
      "Time-anchor capital-allocation judgment to the industry's worst collective decision: find the period peers reached for yield, leverage or fashionable assets, and document what this company did with the same dollars — costly abstinence during a mania is the highest-grade allocation evidence.",
    queryShapes: [
      "<COMPANY> investment portfolio composition vs <INDUSTRY> peers boom years",
      "<INDUSTRY> writedowns losses which companies avoided",
      "<COMPANY> annual report criticized conservative policy hindsight",
    ],
    sourcePriority:
      "historical balance-sheet composition and the peers' subsequent impairments from filings; management's retrospective account last",
    anchor: "culture",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9403e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9403E01.html",
      quote:
        "AFLAC took a less sophisticated approach and put the money into boring old Treasury bonds, so today its $12 billion portfolio is one of the strongest and safest on earth.",
    },
  },

  // --- 4. Seth Klarman ---
  {
    directive:
      "When the company's securities are falling, establish whether holders are exiting under a RULE (rating breach, index removal, size or mandate criteria, redemptions, tax calendar) or on new information about the business — mechanical selling is the mispricing source, informed selling is a stop sign.",
    queryShapes: [
      "<COMPANY> credit rating downgrade below investment grade date",
      "<COMPANY> index removal deletion announcement",
      "<COMPANY> largest holders exited 13F mandate change",
    ],
    sourcePriority:
      "rating-agency actions and index-committee announcements first; covenant and holder disclosures second; sentiment commentary last",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "masters-in-business-seth-klarman-full-transcript",
      url: "https://ritholtz.com/2026/06/transcript-seth-klarman/",
      quote:
        "They were responding to credit downgrades, so it wasn't just nervousness that things are going to be bad — this bond is no longer investment grade, and maybe my mandate is I can only own investment-grade bonds; or this bond has defaulted and I can no longer hold it.",
    },
  },
  {
    directive:
      "Watch for orphaning events around the company: spin-off distributions to holders who never chose them, index deletions, market-cap threshold exits, evaporating analyst coverage — a shareholder base being mechanically disqualified while the market position stays intact.",
    queryShapes: [
      "<COMPANY> spin-off Form 10 information statement selling pressure",
      "<COMPANY> market capitalization index criteria exit",
      "<COMPANY> analyst coverage dropped orphaned",
    ],
    sourcePriority:
      "SEC Form 10/spin-off registration statements and index-reconstitution announcements over sell-side notes (missing coverage is the condition itself)",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "the-baupost-fund-shareholder-letter-fy1999-form-n-30d",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt",
      quote:
        "Selling pressure has turned this market leader into a micro-capitalization stock, forcing many holders to exit because it no longer meets their size criteria.",
    },
  },
  {
    directive:
      "Do the analysis others won't: read the hard filings end-to-end — multi-segment footnotes, subsidiary structures, plans of reorganization, unusual capital structures — because the difficulty is why the information is still unpriced. The circle of competence still governs: complexity is opportunity only where it is genuinely analyzable.",
    queryShapes: [
      "<COMPANY> 10-K footnotes subsidiary structure exhibits",
      "<COMPANY> plan of reorganization disclosure statement",
      "<COMPANY> holding company structure dual class stub",
    ],
    sourcePriority:
      "primary filings read in full over any summary or screen — the summary is where the complexity (and the payoff) gets discarded",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1997-12-30",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0000903893-97-001392.txt",
      quote: "The payoff to fundamental analysis rises proportionately with the difficulty of performing it.",
    },
  },
  {
    directive:
      "Run the smoothing-forensics checklist on the filings: accounting-principle changes and their cumulative effects, pension and actuarial assumption revisions, write-ups and write-downs, 'one-time' items — the named techniques by which a meets-or-beats record is manufactured.",
    queryShapes: [
      "<COMPANY> 10-K change in accounting principle cumulative effect",
      "<COMPANY> pension discount rate actuarial assumption change",
      "<COMPANY> restructuring charge reversal non-recurring items history",
    ],
    sourcePriority:
      "10-K accounting-policy and pension footnotes and restatement disclosures over the earnings release and any 'adjusted' presentation",
    anchor: "culture",
    source: {
      investor: "Seth Klarman",
      doc: "the-baupost-fund-shareholder-letter-fy1999-form-n-30d",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt",
      quote:
        "A great many companies meet or exceed estimates only with a great deal of accounting legerdemain: write-ups and write-downs, changes in accounting procedures, modifications to actuarial assumptions, one time charges or gains and other forms of chicanery.",
    },
  },
  {
    directive:
      "Read the whole capital structure as evidence on the equity: where the debt trades, what the indentures and credit agreements actually permit, and where in the stack the business's value runs out — the debt market's read on survivability often leads the equity narrative.",
    queryShapes: [
      "<COMPANY> bonds trading price yield distressed",
      "<COMPANY> credit agreement covenants indenture terms",
      "<COMPANY> debt maturity schedule refinancing 10-K",
    ],
    sourcePriority:
      "indentures, credit agreements and debt schedules from filings; bond-market pricing where public; equity narrative last",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-2000-12-28",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-00-001065.txt",
      quote:
        "Today, we are again finding opportunities to buy stable, cash-generating assets of overleveraged companies at very substantial discounts to their underlying value through the purchase of senior debt securities.",
    },
  },
  {
    directive:
      "Keep a live catalyst inventory for the company: asset sales, spin-offs, repurchase authorizations, restructurings — announced, in progress, or under exploration — each with its stage and expected timing; these are the dated events that close value gaps.",
    queryShapes: [
      "<COMPANY> announced asset sale divestiture strategic alternatives",
      "<COMPANY> share repurchase authorization remaining amount",
      "<COMPANY> spin-off separation timeline announced",
    ],
    sourcePriority:
      "8-K filings, board authorizations and proxies first; call transcripts for 'exploring' language; press retellings last",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1998-06-29",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0000950135-98-004072.txt",
      quote:
        "We have identified numerous companies in the midst of asset sales, spin-offs, and share repurchases, and others actively exploring such transactions.",
    },
  },

  // --- 5. Li Lu ---
  {
    directive:
      "Before crediting long-run share performance to the business, decompose the return into the company's own earnings growth versus multiple re-rating — the earnings component is the business, the re-rating component is borrowed from a future buyer.",
    queryShapes: [
      "<COMPANY> EPS growth 10 year vs total shareholder return",
      "<COMPANY> earnings multiple start vs end of period",
      "<COMPANY> revenue growth vs margin trend same period",
    ],
    sourcePriority:
      "primary financial statements over index-level or narrative return summaries",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "the-prospect-of-value-investing-in-china",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5ef3c7300432b46a7e659977_The%20Prospect%20of%20Value%20Investing%20in%20China%20English%20Translation.pdf",
      quote: "The core value of stock lies in the growth of its earnings discounted to present value.",
    },
  },
  {
    directive:
      "Read the shareholder register before reading a price move as information: in a market or float dominated by short-horizon holders (Li Lu's home-market base rate — retail-driven, high turnover), swings carry less information per move; check ownership composition and turnover in the company's home-market disclosures.",
    queryShapes: [
      "<COMPANY> free float retail vs institutional ownership percentage",
      "<COMPANY> shareholder register turnover rate",
      "<COMPANY> home market exchange ownership disclosure",
    ],
    sourcePriority:
      "exchange and registrar ownership disclosures — including the home market's own filings for foreign-listed companies — over sentiment commentary",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "the-prospect-of-value-investing-in-china",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5ef3c7300432b46a7e659977_The%20Prospect%20of%20Value%20Investing%20in%20China%20English%20Translation.pdf",
      quote:
        "70% of the players in the Chinese capital market are retail investors focusing on short trades, even institutional investors.",
    },
  },
  {
    directive:
      "Read the litigation record end-to-end, not the coverage of it: download the case files — shareholder complaints, plaintiff statements, resolutions — and read them first page to last; grievance patterns are primary conduct evidence.",
    queryShapes: [
      "<COMPANY> shareholder lawsuit complaint filings docket",
      "<COMPANY> litigation history settlements resolution terms",
      "<COMPANY> minority shareholder dispute court record",
    ],
    sourcePriority:
      "court dockets and filed case documents over press summaries of them",
    anchor: "culture",
    source: {
      investor: "Li Lu",
      doc: "li-lu-s-investing-masterclass-at-columbia-business-school-2006-t",
      url: "https://roiss.substack.com/p/li-lus-investing-masterclass-at-columbia",
      quote:
        "Absolutely. Go and download every single case file and read them carefully from the first to the last page. It is important to have a curious mind, because if you only do it for the money it is hard to dig as deep.",
    },
  },
  {
    directive:
      "Research the principals' biographical record the way an embedded observer would: past ventures and how partners fared, community and philanthropic conduct over decades, how long-time associates describe them — character evidence accumulated across a life, not a news cycle.",
    queryShapes: [
      "<COMPANY> founder previous ventures outcome partners",
      "<COMPANY> CEO biography community philanthropy record",
      "<COMPANY> management long-time associates interviews reputation",
    ],
    sourcePriority:
      "biographical and community records, past-venture filings and long-form interviews over current-cycle press",
    anchor: "culture",
    source: {
      investor: "Li Lu",
      doc: "li-lu-s-investing-masterclass-at-columbia-business-school-2006-t",
      url: "https://roiss.substack.com/p/li-lus-investing-masterclass-at-columbia",
      quote:
        "You go to their community, their church or synagogue and integrate yourself into that community. Introduce yourself to their friends and neighbours and spend a few weeks there, it is worth it.",
    },
  },
  // Tier 2 addition — Li Lu:
  {
    directive:
      "Before crediting management skill for growth earned in a state-active market, decompose the business into the portion competing in the open international market versus the portion operating under domestic protection or subsidy — and for the protected portion, ask whether a planner could plausibly have authorized both this company's rise and its displaced rival's fall; only the openly-competed portion is evidence of durable skill a policy shift cannot revoke.",
    queryShapes: [
      "<COMPANY> government subsidy OR tax incentive OR state support disclosure",
      "<COMPANY> export vs domestic revenue segment breakdown filing",
      "<COMPANY> industry state-owned competitor protection licensing",
    ],
    sourcePriority:
      "primary filings and segment disclosures over management commentary or sell-side narrative on the same growth",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "a-discussion-of-modernization",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5ef3c7300432b403eb659976_Li%20Lu%20on%20Discussion%20of%20Modernization%202016%20Final.pdf",
      quote:
        "Chinese foreign trade is in fact just a part of the international trade operating on essentially free market principles.",
    },
  },

  // --- 6. Walter Schloss ---
  {
    directive:
      "Work the company from its filed figures before any narrative or access: the long balance-sheet and annual-report record read cold, with no management meetings and no story — a desk without access loses nothing when the figures are the source, and gains immunity from charmed narratives.",
    queryShapes: [
      "<COMPANY> annual report balance sheet ten year record",
      "<COMPANY> book value per share history filings",
      "<COMPANY> capital structure debt equity history 10-K",
    ],
    sourcePriority:
      "the filed record itself — balance sheets, annual reports, proxies — read before and weighted above management meetings, calls, and access-driven narrative (Schloss's practice: the figures told the story)",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "columbia-business-school-upper-level-seminar-in-value-investing",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/schloss_lecture.pdf",
      quote: "Ben Graham didn't visit managements because he thought the figures told the story.",
    },
  },

  // --- 7. Joel Greenblatt ---
  {
    directive:
      "When any structured transaction is announced (spin-off, recap, merger, rights offering), read the transaction documents themselves for the insider economics: ownership stakes, incentive-option strike timing, fees, and who ends up holding what — the structure tells you whose transaction it is.",
    queryShapes: [
      "<COMPANY> Form 10 information statement insider ownership incentive options",
      "<COMPANY> merger proxy consideration insider payments fees",
      "<COMPANY> spin-off management equity plan strike price timing",
    ],
    sourcePriority:
      "the SEC transaction filings (Form 10, DEFM14A/S-4, 8-K) read directly — the insider economics live in the documents, not the coverage",
    anchor: "culture",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "The to-be-spun-off company must file form-10 with the SEC. For the trained eyes, there is a lot of good information there to facilitate detailed research.",
    },
  },
  {
    directive:
      "Hunt the maintenance-vs-growth capex split: MD&A disclosures, per-unit refurbishment cycles, management's own explanation of the number — companies usually understate maintenance capex, and the understatement flatters owner earnings.",
    queryShapes: [
      "<COMPANY> 10-K maintenance capital expenditures disclosure",
      "<COMPANY> capex new units vs existing base breakdown",
      "<INDUSTRY> refurbishment cycle cost per unit",
    ],
    sourcePriority:
      "10-K/10-Q MD&A and capex footnotes, then management's direct explanation of the split; treat undisclosed splits as a named gap",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote: "I ask for an explanation for mcx and how do they get there. Usually the company understates mcx.",
    },
  },
  {
    directive:
      "Rebuild any cheapness claim the way a whole-business buyer would: from the cash flows and from prices actually paid for comparable businesses and assets — never from a ratio label like low price-to-book or price-to-sales that no acquirer relies on.",
    queryShapes: [
      "<INDUSTRY> comparable transaction acquisition multiples paid",
      "<COMPANY> asset sale price vs implied valuation",
      "<COMPANY> free cash flow basis private buyer valuation",
    ],
    sourcePriority:
      "completed transaction terms and the company's own cash-flow record over screen labels and factor classifications",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "transcript-joel-greenblatt-masters-in-business-relative-value",
      url: "https://ritholtz.com/2020/10/transcript-joel-greenblatt-2/",
      quote:
        "No private equity firm buys a business because it’s a low price book or little price sales. They’re really looking at cash flows.",
    },
  },
  // Tier 2 addition — Greenblatt:
  {
    directive:
      "When a company's figures screen as an extreme outlier — spectacularly cheap, impossibly profitable — verify the underlying data against primary filings before trusting the finding, especially outside the largest and best-covered markets: bad data concentrates in exactly the outliers any ranking surfaces.",
    queryShapes: [
      "<COMPANY> annual report primary filing figures vs aggregator discrepancy",
      "<COMPANY> restatement correction historical financials",
      "<MARKET> fundamentals data vendor reliability coverage gaps",
    ],
    sourcePriority:
      "the company's own filings in its home market, cross-checked against a second independent source, over any single data vendor's figures",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "briefing-book-joel-greenblatt-intelligent-investing-with-steve-f",
      url: "https://images.forbes.com/media/pdfs/2010/04/Joel_Greenblatt_Briefing_Book.pdf",
      quote:
        "if you use bad data, garbage in, garbage out, you'll have some of the outliers coming to the top.",
    },
  },
  // ---------------------------------------------------------------------------
  // STAGE 2/3 RE-SYNTHESIS 2026-08-20: new CANON_DIRECTIVES mined from the massively expanded
  // extraction files (all 158 corpus files were substantially enriched in the same
  // pass). Checked for duplication against every entry already above (this file,
  // all investors) and against CORE_LENSES in framework.ts before inclusion; every
  // quote below re-verified verbatim against its cited extraction file at merge time.
  // ---------------------------------------------------------------------------
  // Benjamin Graham & David Dodd:
{
    directive:
      "Track the market-wide count of names passing a simple valuation screen (a stated P/E ceiling, or price below net working capital) over successive periods, not just as a one-time snapshot; a materially shrinking eligible-name count is itself a market-temperature warning, independent of what any single name's story says.",
    queryShapes: [
      "<UNIVERSE> count of names trading at P/E ≤ <N> or below net working capital, current period vs. prior periods",
      "has the count of names passing <SCREEN> shrunk materially from its historical range?",
      "<INDUSTRY> breadth of names meeting a stated cheapness threshold, tracked over the last several years",
    ],
    sourcePriority:
      "a recurring, dated exchange-wide screen output tracked over time, over a single company's narrative or a one-time market snapshot",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "the-simplest-way-to-select-bargain-stocks",
      url: "https://alphaarchitect.com/wp-content/uploads/2011/04/Simple-and-Easy-Approach-Medical-Economics-Graham-1976.pdf",
      quote:
        "in periods when the market as a whole is overpriced you'd have trouble finding stocks to reinvest in that meet my criteria.",
    },
  },
  {
    directive:
      "When citing an outside analyst, advisory service, or research report's bullish or bearish valuation call, check whether that same source showed comparable skepticism (or comparable conviction) at the OPPOSITE market extreme in its own publication history — a source whose 'fair value' conclusions merely track the direction prices already moved is echoing sentiment, not adding independent judgment.",
    queryShapes: [
      "<SOURCE>'s published valuation calls at the last major market low vs. its calls at the current high — symmetric or one-sided?",
      "did <ADVISORY SERVICE> revise its stated valuation framework specifically when market direction changed?",
    ],
    sourcePriority:
      "the source's own historical publication record spanning at least one full market cycle (a prior low and the current high), not its current commentary alone",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "stock-market-warning-danger-ahead",
      url: "http://www.safalniveshak.com/wp-content/uploads/2012/07/Stock-Market-Warning-Benjamin-Graham.pdf",
      quote:
        "All my experience goes to show that most investment advisers take their opinions and measures of stock values from stock prices. In the stock market, value standards do not determine prices; prices determine value standards,",
    },
  },
  {
    directive:
      "When a source claims skill at market forecasting or mechanical timing (chart theories, technical signals), require a dated, multi-year replay of the actual signals given — not reputation or a curated set of successful calls — and test the concrete standard Graham applied to the Dow Theory: would following the signals mechanically ever have allowed rebuying the same security lower than it was sold?",
    queryShapes: [
      "<SOURCE>'s specific buy/sell signal dates and the price realized on each, replayed mechanically over a multi-year window",
      "would following <FORECASTER>'s signals across the full sample period have allowed rebuying lower than the prior sell?",
    ],
    sourcePriority:
      "a dated, mechanically-applied signal history over the full sample period, over the forecaster's own summary or a curated highlight reel",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "securities-in-an-insecure-world-annotated-transcript-by-jason-zw",
      url: "https://jasonzweig.com/a-rediscovered-masterpiece-by-benjamin-graham/",
      quote:
        "I found peculiarly enough that in no case in the next 25 years did one benefit through following the Dow signals mechanically. By this I mean that one was never able to buy his stocks back at a lower price than he sold them for.",
    },
  },
  // John Templeton:
{
    directive:
      "Study each jurisdiction's own history of nationalizing or heavily regulating the SPECIFIC asset class this company depends on — banks, mines, oil, railways, rents/utilities — before weighting political-regime risk in the thesis; a country's track record with this type of asset predicts its future conduct better than generic political-risk commentary does.",
    queryShapes: [
      "<COMPANY> jurisdiction history of nationalization <INDUSTRY> (banks/mines/oil/railways/utilities)",
      "<COUNTRY> rent control OR price control OR expropriation history <INDUSTRY>",
      "<COMPANY> sovereign risk precedent for this asset class in this jurisdiction",
    ],
    sourcePriority:
      "comparative country-by-country nationalization and regulation case histories over general political-risk narrative or headline rhetoric",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "successful-investing-methods-address-to-the-empire-club-of-canad",
      url: "https://empireclubfoundation.org/speech/succesful-investing-methods/",
      quote:
        "we study all nations where information is available to see what happened where socialism has become serious. Did they nationalize the banks or the mines or the oil companies or the railways? Did they regulate rents so that they became uneconomic?",
    },
  },
  // Peter Lynch:
{
    directive:
      "For quality growth names, chart price against reported EPS over the longest available window (10-35 years) and watch the seasonal institutional bid-up: portfolio managers roll estimates forward and buy quality growers in Q3/Q4, so treat second-half strength in these names as calendar-driven rather than fundamental, and use spring/early-summer weakness as the research and entry window.",
    queryShapes: [
      "<COMPANY> 10-year 35-year price vs earnings historical chart",
      "<COMPANY> Q3 Q4 institutional buying seasonal pattern quality growth",
      "<COMPANY> spring early-summer price weakness vs Q4 strength",
    ],
    sourcePriority:
      "long-run price/earnings charts (the Securities Research Co. style Lynch used) read directly, over any single quarter's price action or a single analyst's seasonal call",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9406e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9406E01.html",
      quote:
        "This Second-Half Effect is caused by portfolio managers who bid up the prices for quality growth stocks in the third and fourth quarters.",
    },
  },
  {
    directive:
      "Read a mutual-to-stock conversion (thrift, mutual insurer, credit union demutualization) prospectus for the offering price against pro-forma post-conversion book value, and confirm officers and directors are buying at that same offering price — the conversion windfall exists only where new capital flows entirely into equity with no prior owners to compensate, and insider purchase at the identical price is the check that the deal is a clean full conversion rather than a bailout.",
    queryShapes: [
      "<THRIFT> conversion prospectus offering price vs pro-forma book value",
      "<THRIFT> insider director officer purchases at IPO offering price",
      "<THRIFT> equity-to-assets ROA nonperforming assets conversion prospectus",
    ],
    sourcePriority:
      "the conversion prospectus (red herring and final) read directly over underwriter research or press coverage of the deal",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9404c01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9404C01.html",
      quote:
        "Corporate insiders are not known to be self-destructive. They don't buy company stock unless they expect to make money on it.",
    },
  },
  {
    directive:
      "When a holding has performed badly, triage in a fixed order before touching the stock price: first the balance sheet (can it survive bankers and creditors long enough to work out its problems), then management's specific strategic response to what actually went wrong, and only then the remaining upside — never react to the quote itself as the diagnosis.",
    queryShapes: [
      "<COMPANY> debt to equity book value distressed balance sheet",
      "<COMPANY> management response strategic pivot after earnings decline",
      "<COMPANY> franchise growth runway remaining after underperformance",
    ],
    sourcePriority:
      "the company's own balance sheet and management's stated operational response over analyst price targets or headline commentary",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9701e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9701E01.html",
      quote:
        "Whenever a company does as poorly as this one has, and you own it, the first thing you want to check is its finances.",
    },
  },
  // Seth Klarman:
{
    directive:
      "Read published short-seller research and theses on the company as a primary analytical source, not noise to dismiss because of the author's motive — Klarman held that short sellers do more rigorous analysis than long buyers because a wrong short thesis is punished quickly and visibly. Weigh the analytical content of the case separately from the minority of short activity that is rumor-mongering rather than research.",
    queryShapes: [
      "<COMPANY> short seller report thesis",
      "<COMPANY> short interest activist research",
      "<COMPANY> bear case detailed analysis",
    ],
    sourcePriority:
      "published short-seller research reports and detailed bear theses over sell-side coverage or momentum commentary; treat rumor/manipulation-style short attacks with no analytical content as the one carve-out to weight down",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "opportunities-for-patient-investors",
      url: "https://rpc.cfainstitute.org/research/financial-analysts-journal/2010/opportunities-for-patient-investors",
      quote:
        "my experience is that short sellers do far better analysis than long buyers because they have to",
    },
  },
  {
    directive:
      "Measure how concentrated the broader index's or sector's returns are in a small number of largest constituents (top-20 contribution to index return, market-cap-weighted vs. equal-weighted or small-cap-index divergence) as a leading indicator of narrow, fragile market leadership — and treat the resulting neglected mid/small-cap universe as the opportunity pool that concentration creates.",
    queryShapes: [
      "<INDEX> top 20 constituents contribution to annual return",
      "<SECTOR> market-cap-weighted vs equal-weighted index divergence",
      "<COMPANY> peer group small-cap neglect discount",
    ],
    sourcePriority:
      "index-provider constituent-level return attribution and market-breadth statistics over headline index-level return figures",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1998-12-23",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0000950135-98-006396.txt",
      quote:
        "As of mid-December 1998, nearly all of the S&P's return for the year can be attributed to its largest 20 constituents.",
    },
  },
  {
    directive:
      "In management-quality diligence, ask directly for the biggest mistake this executive or team has ever made, and evaluate the intellectual honesty of the answer — genuine ownership of a specific error versus a deflected, sanitized or self-serving non-answer. Run this as a screen on any key hire or leader being assessed, not only at fund-manager due diligence.",
    queryShapes: [
      "<EXECUTIVE> biggest mistake admitted interview",
      "<COMPANY> management post-mortem failed project accountability",
      "<EXECUTIVE> track record error correction candor",
    ],
    sourcePriority:
      "direct interview transcripts, shareholder-letter mea culpas and post-mortem disclosures over polished investor-day narratives or PR-vetted biographies",
    anchor: "culture",
    source: {
      investor: "Seth Klarman",
      doc: "opportunities-for-patient-investors",
      url: "https://rpc.cfainstitute.org/research/financial-analysts-journal/2010/opportunities-for-patient-investors",
      quote:
        "We ask people, What is the biggest mistake you've ever made? It's a very open-ended question because it's not solely an investment question, although prospective hires often answer as if it were.",
    },
  },
  {
    directive:
      "Treat credit ratings as a conflicted starting point, never a substitute for the desk's own collateral, coverage and recovery analysis — ratings agencies are paid by issuers and have structurally missed adverse selection and moral hazard in past cycles. Re-underwrite the collateral quality behind any rated security rather than relying on the letter grade.",
    queryShapes: [
      "<ISSUER> credit rating vs collateral quality independent analysis",
      "<ISSUER> rating agency methodology conflicts issuer-pays",
      "<SECURITY> underlying collateral tape rating agency assumptions",
    ],
    sourcePriority:
      "deal prospectuses, collateral tapes and the desk's own recovery/coverage work over the rating-agency letter grade itself",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "the-forgotten-lessons-of-2008",
      url: "https://fs.blog/the-forgotten-lessons-of-2008/",
      quote:
        "Ratings agencies are highly conflicted, unimaginative dupes. They are blissfully unaware of adverse selection and moral hazard.",
    },
  },
  // Li Lu:
  {
    directive:
      "When a company shows no sell-side analyst coverage, do not treat the absence as a default red flag: check first whether it reflects the company simply having no need to access debt or equity capital markets (self-funded, low leverage) — coverage tracks capital-markets need, not quality, so a well-capitalized niche business can go uncovered for structural reasons that are themselves a positive sign.",
    queryShapes: [
      "<COMPANY> debt issuance OR equity offering history",
      "<COMPANY> analyst coverage OR lack thereof",
      "<COMPANY> balance sheet reliance on capital markets financing",
    ],
    sourcePriority:
      "financing/issuance history and balance-sheet filings over the mere fact of no analyst coverage",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "li-lu-s-investing-masterclass-at-columbia-business-school-2006-t",
      url: "https://roiss.substack.com/p/li-lus-investing-masterclass-at-columbia",
      quote:
        "The company doesn't have a lot of debt on their balance sheet, maybe the company has no claim to the capital market and as a result no analyst from the sell side is covering them.",
    },
  },
  // Walter Schloss:
{
    directive:
      "When screening asset-based candidates, specifically look for former growth/'story' stocks whose premium has collapsed to a discount to their own hard assets — a reversal from being priced for a bright future to being priced for none is a distinct, higher-quality asset-play pattern, not just any low price.",
    queryShapes: [
      "<COMPANY> price history premium to book collapse",
      "<COMPANY> former growth stock now trading below net asset value",
      "<COMPANY> historical valuation multiple compression premium to discount",
    ],
    sourcePriority:
      "historical price and book-value series spanning a full cycle (boom and bust), not just the current quote",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "sixty-five-years-on-wall-street",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Schloss-Sixty-Five-Years.pdf",
      quote:
        "it was Boeing Airplane. And Boeing Airplane, before W.W.II, sold at a big premium over its assets because it had a great future.",
    },
  },
  {
    directive:
      "Track management/insider ownership percentage as a signal that cuts both ways: it aligns management's stake with the outcome, but a high enough stake can also entrench control and block a takeover that might otherwise realize the discount — weigh both readings together rather than treating high insider ownership as an unambiguous positive.",
    queryShapes: [
      "<COMPANY> insider ownership percentage proxy statement",
      "<COMPANY> management stock ownership poison pill takeover defense",
      "<COMPANY> largest shareholders SEC ownership filings",
    ],
    sourcePriority:
      "proxy statements and SEC ownership filings, read for the ownership percentage AND any takeover-defense provisions together, not the percentage alone",
    anchor: "culture",
    source: {
      investor: "Walter Schloss",
      doc: "the-right-stuff-why-walter-schloss-is-such-a-great-investor",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Walter%20Schloss%20-%20The%20Right%20Stuff%20-%20Barrons%20-%2002-25-85.pdf",
      quote:
        'management owns about 40% of the stock. So a lot of people say, "Oh, I don\'t want that; it can\'t be taken over." But on the other hand, management has an inter-est in seeing that this company is a success.',
    },
  },
  {
    directive:
      "Cross-reference archived investment-manual and fund-holdings listings for small, practically unknown companies that are cheap on the numbers — the classic net-net opportunity set skews toward obscure names with essentially zero public profile, not recognizable blue chips.",
    queryShapes: [
      "Moody's Investment Manual <COMPANY> historical holdings small-cap",
      "obscure microcap balance sheet discount screen <PERIOD>",
      "<COMPANY> unknown company book value discount historical",
    ],
    sourcePriority:
      "historical investment manuals and fund holdings lists over press coverage or analyst attention — coverage itself is evidence a name is no longer cheap in this sense",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "benjamin-graham-and-security-analysis-a-reminiscence",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/04/graham_reminiscence.pdf",
      quote:
        "If one wants to get hold of Moody's Investment Manuals for the 1947–1956 period, it is interesting to see Graham-Newman's holdings. Many of them were small, practically unknown companies but they were cheap on the numbers.",
    },
  },
  {
    directive:
      "For a declared liquidation or work-out specifically, don't rely on the filed payout estimate alone — seek direct, in-person or phone confirmation from the actual officer responsible (e.g. the treasurer) that management is thinking along the same timeline before sizing or adding to the position.",
    queryShapes: [
      "<COMPANY> liquidation trustee treasurer investor contact",
      "<COMPANY> work-out payout schedule officer confirmation",
      "<COMPANY> liquidation timeline company statement management",
    ],
    sourcePriority:
      "direct confirmation from the named officer responsible for the payout, sought explicitly rather than inferred from the filed estimate alone — narrower than the general filed-figures-only practice, specific to declared liquidation/work-out events",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "criteria-for-liquidations-where-money-is-held-by-company",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/schloss_liquidations.pdf",
      quote:
        "To satisfy ourselves that the management is thinking along these lines, I would suggest that Lawrence Kessel go to Baltimore and talk with J. B. Wharton,Jr. the Treasurer, who is the active officer.",
    },
  },
  // Joel Greenblatt:
{
    directive:
      "Search bankruptcy-court dockets and plan-of-reorganization/disclosure-statement filings directly for distressed bond and post-emergence equity situations — the creditor negotiation and asset-valuation detail live in the court record, not in secondary coverage.",
    queryShapes: [
      "<COMPANY> plan of reorganization disclosure statement",
      "<COMPANY> Chapter 11 docket filings PACER",
      "<COMPANY> bondholders committee negotiation update",
    ],
    sourcePriority:
      "PACER bankruptcy-court dockets and disclosure statements read directly, over distressed-debt desk commentary or news summaries",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "the ensuing months, the company and its advisors (Houlihan Lokey and Bingham Dana) worked with creditors on a plan of reorganization",
    },
  },
  {
    directive:
      "Read the 'merger consideration' section of every takeover proxy line by line for exchangeable debentures, warrants, and contingent value rights bundled into the deal currency — these frequently trade as if worthless because uninterested holders dump them indiscriminately, while their embedded value as currency to acquire the more valuable security can be substantial.",
    queryShapes: [
      "<COMPANY> DEFM14A merger consideration warrants debentures",
      "<COMPANY> contingent value rights terms proxy",
      "<MERGER> exchangeable debenture face value redemption terms",
    ],
    sourcePriority:
      "SEC merger proxy filings (DEFM14A/S-4) read directly for the consideration structure, over deal-coverage summaries",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "It pays to check out merger securities! Only invest in the ones that are attractive and that you understand.",
    },
  },
  {
    directive:
      "Source hated-business candidates from 52-week-low lists and negative-momentum/high-short-interest screens before doing any thesis-vs-antithesis workup — an entire industry showing up on these screens together is raw material for the bad-business taxonomy triage, not a reason to skip the sector.",
    queryShapes: [
      "52-week low list <exchange or sector>",
      "highest short interest <sector> screen",
      "<INDUSTRY> negative momentum consensus press coverage",
    ],
    sourcePriority:
      "exchange new-lows lists and negative-momentum screens (e.g. Investors' Business Daily) over analyst sector recommendations",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "Everyone makes fun of Investors' Business Daily but you can go in there and find negative momentum industries where everyone hates the industry(s).",
    },
  },
];

export const CANON_CONCEPTS: CanonConcept[] = [
  // --- 1. Benjamin Graham & David Dodd ---
  // Dedup notes: margin of safety already governs as the charter's price filter
  // (filter 4) and normalization/speculative-component content rides the canon
  // question patterns; trend-reversion discipline already lives in
  // QUESTION_METHOD 8 (distrust projections). The four below are the Graham
  // instruments the ten core lenses do not carry.
  {
    title: "Net-Current-Asset Floor (Graham)",
    question:
      "What would an orderly liquidation of the current assets alone realize per share, and is the enterprise being quoted below that floor?",
    test:
      "Compute net current assets — current assets minus ALL liabilities, with zero for plant, fixed assets and goodwill — and compare to the market's valuation of the whole enterprise. Haircut by asset class where realization matters (receivables ~80%, inventory ~two-thirds, fixed and miscellaneous ~15%). A price persistently below the floor forces one of two conclusions: the price is wrong, or continuing the business as-is is wrong — and management's refusal to weigh liquidation, sale, or return of capital is itself evidence. Graham's group of such purchases returned ~20% a year across three decades.",
    evidence:
      "Balance-sheet net current assets vs. market capitalization; unencumbered cash vs. the quote; the operating record that would justify (or refute) the implied losing-power verdict; management and board response to a persistent discount — capital returns weighed, or the question never asked.",
    investor: "Benjamin Graham & David Dodd",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "a-conversation-with-benjamin-graham",
      url: "http://www.grahamanddoddsville.net/wordpress/Files/Gurus/Benjamin%20Graham/A%20Conversation%20with%20Ben%20Graham%20-%20Financial%20Analysts%20Journal%20-%201976.pdf",
      quote:
        "My first, more limited, technique confines itself to the purchase of common stocks at less than their working-capital value, or net-current-asset value, giving no weight to the plant and other fixed assets, and deducting all liabilities in full from the current assets",
    },
  },
  {
    title: "Normal Earning Power (Graham)",
    question:
      "What does the multi-year record say this business earns across a full cycle — and is the current figure normal, boom, or trough?",
    test:
      "Value from the normalized multi-year average (five to seven years or more), never a single strong year. Check that the average is a modal cluster the individual years actually gather around, not an arithmetical accident of unrelated good and bad years. Value boom-period excess separately and briefly: normal earning power gets the full multiplier, the temporary excess a small one (Graham's American Radiator method). Split pre-tax from after-tax to keep tax artifacts out of the operating read.",
    evidence:
      "Margins and returns vs. the company's own multi-decade record; the spread of individual years around the average; which recent years were abnormal (war, shortage, subsidy, windfall pricing) and what the record reverts to after each; pre-tax vs. after-tax margin trends against a distant baseline.",
    investor: "Benjamin Graham & David Dodd",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-05",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture5.pdf",
      quote:
        "Thus, if you want to attempt a serious evaluation of a company like American Radiator, the only proper method is to take what you would assume to be its normal earning power, not its optimum earning power, evaluate that, and then add to it a fair allowance for the fact that it is facing some very good years.",
    },
  },
  {
    title: "The Balance-Sheet Check (Graham)",
    question:
      "Do the reported profits survive reconciliation against the successive balance sheets — does the equity walk agree with what the income statement claimed?",
    test:
      "Compute earnings the balance-sheet way: ending equity minus beginning equity, plus dividends paid, minus new stock sold. A material divergence from cumulative reported earnings means items are being routed around the income account — reserves padded in good years and quietly drawn later, charges taken straight to surplus, or the opposite game of over-reserving that hides real earning power. The reserve accounts themselves are the tell: reserves actually consumed by their stated purpose are real; reserves that only ever grow are earnings in a costume.",
    evidence:
      "The equity walk vs. cumulative reported earnings over the same span; reserve and surplus account movements year by year; items charged directly to equity; the gap's direction and consistency (habitual under- or over-statement is a culture datum for the candor lens).",
    investor: "Benjamin Graham & David Dodd",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-02",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture2.pdf",
      quote:
        "the balance sheet comparison is a relatively simple idea. You take the equity for the stock",
    },
  },
  {
    title: "Stockholder Trusteeship (Graham)",
    question:
      "Does this company treat its outside stockholders as the owners the law says they are — or as a docile constituency whose capital, payout, and information can be managed for insiders' convenience?",
    test:
      "Directors are trustees for the owners; test the conduct, not the language. Fair payout of what the business demonstrably does not need, judged against normalized earnings; repurchases that do not exploit sellers the company's own withholding impoverished; material information reaching all owners at once; and a board whose composition is not officials, bankers and business partners with the owner-interested director in a scant minority. The docile-and-apathetic stockholder is the condition this conduct exploits — a company that cultivates it earns the discount it trades at.",
    evidence:
      "Dividend record vs. normalized earnings and stated rationale; buyback timing vs. dividend policy and disclosure; information-parity conduct (who learns material facts first); board composition and whose interests each seat serves; how management answers the retention question when owners actually ask it.",
    investor: "Benjamin Graham & David Dodd",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "security-analysis-2nd-edition-principles-and-technique",
      url: "https://archive.org/details/dli.ernet.7983",
      quote: "the typical American stockholder is the most docile and apathetic animal in captivity.",
    },
  },
  // Tier 3 note (Graham/Dodd): five verified Tier 3 docs resolved to +1
  // question pattern (advocacy-stake disclosure) and +2 metrics (dividend
  // round-trip, hidden-equity add-back), all in their arrays. Skips: the
  // compiled 1946-47 lectures restate the ten per-lecture Tier 1 extractions
  // — the earning-power-horizon and retention-reason candidates are already
  // carried by the boom-earnings and retained-dollar QPs, net-deductions
  // coverage and the speculative-component split are Tier 1 entries, and the
  // capital-deployment-drift check rides the retained-dollar QP's evidence;
  // 'Mysteries of the Stock Market' restates founding doctrine (the weighing
  // machine, sentiment multipliers); 'The Flexible Work Year' is labor-policy
  // macro the charter refuses; 'How to Handle Your Money' is personal-finance
  // allocation, its enterprise test and below-working-capital rule already
  // core and NCAV respectively.

  // --- 2. John Templeton ---
  // Dedup notes: contrarian independence of the DESK's own reasoning already
  // lives in the misjudgment checklist (social proof, availability); the
  // market-of-stocks principle is the charter itself; stewardship-of-capital
  // overlaps Graham's Stockholder Trusteeship. The two below are Templeton
  // instruments no core lens or earlier entry carries.
  {
    title: "Maximum Pessimism & the Permanence Test (Templeton)",
    question:
      "Is this business being read (and priced) at maximum pessimism or maximum popularity — and is the prevailing mood about it permanent or temporary?",
    test:
      "Unpopularity is only ever a reason to STUDY, never by itself a verdict: extremely low valuations exist for reasons, and the work is separating permanent impairment (obsolescence, broken cost position, wrecked balance sheet) from a cycle, a fashion, or forced selling. The symmetric law holds at the top — popularity always proves temporary, and when lost it won't return for many years, so a popularity premium on the company is a wasting asset. The extreme of pessimism arrives while investors still EXPECT bad news, before it clears; the extreme of optimism while they expect only good.",
    evidence:
      "What the pessimists' (or promoters') own strongest documents actually claim vs. the filed record; structural-vs-cyclical demand evidence; substitution data; worst-case survivability arithmetic; who is selling or buying and why (forced sellers, the company's own repurchases); how far the current mood's premium or discount has drifted from the record's normal relation.",
    investor: "John Templeton",
    source: {
      investor: "John Templeton",
      doc: "the-22-maxims-of-john-templeton-the-time-tested-maxims-of-the-te",
      url: "https://novelinvestor.com/maxims-john-templeton/",
      quote:
        "If a particular industry or type of security becomes popular with investors, that popularity will always prove temporary and, when lost, won't return for many years.",
    },
  },
  {
    title: "Real-Return & Inflation Resilience (Templeton)",
    question:
      "Does this business preserve and grow purchasing power — the only return that counts is after taxes and after inflation?",
    test:
      "Apply the real-return arithmetic to the business itself: 4% inflation cuts a third of purchasing power in a decade, so a company whose pricing lags its cost inflation, or whose historical-cost depreciation understates replacement capex, is shrinking in real terms while reporting nominal growth. The standard is the company that will not suffer much from inflation or would even benefit — repricing faster than costs, with assets that do not silently demand ever-more nominal capital to stand still.",
    evidence:
      "Price-increase cadence vs. input-cost inflation, with the lag measured; replacement capex vs. depreciation over time; the revenue and earnings record deflated against the period's inflation (real growth vs. nominal); margin behavior through past inflationary episodes.",
    investor: "John Templeton",
    source: {
      investor: "John Templeton",
      doc: "16-rules-for-investment-success",
      url: "https://www.franklintempleton.com/forms-literature/download/TL-R16",
      quote:
        "This means the return on invested dollars after taxes and after inflation. This is the only rational objective for most long-term investors.",
    },
  },

  // --- 3. Peter Lynch ---
  // Tier 3 note (Lynch): the one verified Tier 3 doc (his section of PBS's
  // multi-contributor 'Bear Market Musings' page) is market-decline base
  // rates, stomach-over-brain temperament, and horizon suitability — index-
  // level statistics and investor practice the charter keeps out; the
  // temperament half is the misjudgment checklist's ground. An honest empty.
  // Tier 2 note (Lynch): the one verified Tier 2 doc (the PBS broadcast
  // script) is soundbites drawn from the Tier 1 on-camera interview —
  // understandable-business, store-level observation and multi-year patience
  // are already carried by The Edge, the store-level directive and the
  // charter's dormancy doctrine. An honest empty.
  // Dedup notes: "great company in a lousy industry" is expressed here as the
  // Low-Cost Survivor lens (an operator test) so it cannot be read against the
  // core industry-dynamics lens's economics-dominate rule; earnings-follow-
  // price convergence and "stocks do well for a reason" ride the desk doctrine
  // and the Story lens; the vanishing-protection question is already core
  // Lens 2 evidence ("technology or regulation that forces the moat to be
  // rebuilt"); blame-asymmetry supplier moats and regulatory "clout" were
  // judged too narrow for lens rank this pass.
  {
    title: "The Story & Its Scoreboard (Lynch)",
    question:
      "What is the story of this business — the specific driver of higher earnings — and which two or three trackable operating variables does the whole thing hinge on?",
    test:
      "Write the story at a level of detail a stranger could act on: the earnings driver, what must keep being true, and what would end it. Then instrument it — name the reported line or observable channel for each hinge variable, so the desk keeps score on the business itself. Every material change gets attributed to a named business cause ('what happened to the story?'); a thesis that can only be stated in valuation terms, or a move that can only be attributed to 'the market', means the story was never known.",
    evidence:
      "The written story and its named hinge variables; the attribution log tying each thesis-relevant change to a business fact; seasonal or periodic reporting checkpoints where the year is effectively settled (Lynch's third-quarter Cedar Fair report); failure mode — a file whose only reference point is the quote.",
    investor: "Peter Lynch",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9503e02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9503E02.html",
      quote:
        "That's the key ingredient in successful investing: finding companies you can keep track of so you've got a point of reference other than the stock price.",
    },
  },
  {
    title: "The Edge (Lynch)",
    question:
      "What does the desk (or the investor) know about this company from proximity — profession, supply chain, customer seat — that the filings and the coverage do not report, and what named fact has that edge actually produced?",
    test:
      "The edge is typed and pre-existing: an on-the-job edge (working relationship with the industry) or a consumer's edge (repeated experience as a customer) — never a tip. It must produce a specific, dateable external fact added to the math, not a self-assessment of understanding. And it has a boundary: in binary-outcome businesses (trial results, approvals, contract awards) the edge does not work — insiders and experts handicap those no better than anyone, and the honest verdict is 'too hard'. This is the active half of the circle of competence: competence as an evidence source to be exercised, not only a boundary to respect.",
    evidence:
      "The investor's own firsthand exposure (their intake answers, evidence-locker files, channel observations); practitioner and customer facts logged with source and date versus when coverage caught up; an explicit edge-type label on the file; the binary-outcome exclusion applied in writing.",
    investor: "Peter Lynch",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9301e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9301E01.html",
      quote:
        "Actually, there are two kinds of investor's edges: the on-the-job edge, in which you have a working relationship with an industry and the related companies with whom you do business; and the consumer's edge, with which you can capitalize on your experiences in restaurants, airports, and shopping malls.",
    },
  },
  {
    title: "Category Before Judgment (Lynch)",
    question:
      "Which category of business is this — steady grower, cyclical, turnaround, asset play — as the reported record defines it, and are we (and the market) applying the right category's rules?",
    test:
      "Assign the category from evidence, not the sector label: the shape of the long reported-EPS series (steady upward slope = grower; wobbling = cyclical) and the purchase-deferral test (do customers postpone this purchase when cash is short?). The category then dictates the analytical regime — a grower is judged on runway, a cyclical on industry conditions and never on peak earnings ('record EPS' in a cyclical is a peril, not a strength), a turnaround on solvency first. Mistaken identity is a mispricing class of its own: a company priced in its old category years after the record shows it changed.",
    evidence:
      "Ten-plus years of reported EPS and its shape; streaks that span a recession (category-reclassifying evidence) vs. streaks earned only in an expansion; the deferral behavior of the company's customers in past downturns; gaps between the record and the company's public identity or multiple.",
    investor: "Peter Lynch",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9309e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9309E01.html",
      quote:
        "When the earnings line has a steady upward slope, the way Merck's does, you're dealing with a growth stock. When it wobbles up and down, as Alcoa's does, you're probably dealing with a cyclical.",
    },
  },
  {
    title: "Low-Cost Survivor in a Depressed Industry (Lynch)",
    question:
      "Inside a distressed or commoditized industry, is this the operator whose cost position and contract book let it thrive while competitors struggle to survive?",
    test:
      "The investment is the operator, not the commodity, and no price forecast is required: rank the company on the industry cost curve (its total unit cost vs. the industry average — the spread is the margin that survives a price collapse), read the hedge/contract book as an extension of that protection, and treat peer mortality and acquired capacity as the moat evidence. The industry's distress is the entry filter — it is what makes the record go unexamined — but the thesis lives or dies on the operator's cost arithmetic through the trough.",
    evidence:
      "Unit-cost disclosures vs. industry benchmarks; capacity closures, bankruptcies and share shifts among peers; the survivor's acquisitions of weaker rivals across the cycle; margin behavior through past troughs; contract/hedge coverage of forward output.",
    investor: "Peter Lynch",
    source: {
      investor: "Peter Lynch",
      doc: "use-your-edge-by-peter-lynch",
      url: "https://www.rbcpa.com/commentary-archive/use-your-edge-by-peter-lynch/",
      quote:
        "Sometimes depressed industries can produce high returns. The best companies often thrive even as their competitors struggle to survive.",
    },
  },

  // --- 4. Seth Klarman ---
  // Tier 3 note (Klarman): the one verified Tier 3 doc (the sourced quote
  // collection) restates entries this canon already carries from primary
  // documents — room-to-be-wrong is Margin of Safety as Process, 50-cent
  // dollars is the discount-bar metric's own figure, risk-relative-to-price
  // and preservation-first are the charter itself, and cash-in-absence-of-
  // opportunity is portfolio practice. An honest empty.
  // Tier 2 note (Klarman): the one verified Tier 2 doc ('Consistency in a
  // Bubble') is a compilation of excerpts from the same 1995-2001 Baupost
  // letters synthesized above — catalysts, discipline-as-bearings and
  // demand-more-undervaluation are already carried by Catalysts & Duration,
  // Margin of Safety as Process and the discount-bar metric. An honest empty.
  // Dedup notes: securities-as-business-claims and Mr. Market are the charter
  // itself; the four-part gate's stable-value and able-management criteria are
  // core lenses; the hurdle-rate-on-idle-cash question is the Capital
  // Allocation lens's opportunity-cost master test; cash-level, hedging and
  // client-base material is out of the desk's scope entirely.
  {
    title: "Forced & Uneconomic Selling (Klarman)",
    question:
      "Is the price of this security being set by someone who MUST transact — mandate breach, index deletion, size criteria, redemptions, tax calendar — rather than by someone who knows something about the business?",
    test:
      "Down-in-price is never bargain-priced by itself: undervaluation is determined only by price against an independently derived value, never against price history. Identify the seller class and its constraint; the wider the gap between the seller's reason and the company's fundamentals, the better the evidence — and informed selling is a stop sign, not an opportunity. Contrarianism is never blind: being extremely early is tantamount to being wrong, so gauge whether the constrained holders have largely finished exiting before concluding the discount is actionable evidence.",
    evidence:
      "Rating actions, index reconstitutions, spin-off distribution mechanics and mandate-driven holder turnover around the company's securities; who is still selling and their remaining capacity; the independent value work the discount is measured against; the company's own buying on the other side of the forced flow.",
    investor: "Seth Klarman",
    source: {
      investor: "Seth Klarman",
      doc: "the-baupost-fund-shareholder-letter-fy1999-form-n-30d",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt",
      quote: "Frequently, we attempt to profit by providing liquidity to urgent sellers.",
    },
  },
  {
    title: "Margin of Safety as Process (Klarman)",
    question:
      "Where, specifically, does the safety in this thesis come from — and does it survive the key assumptions each being wrong in the unfavorable direction?",
    test:
      "The margin of safety is constructed per situation and sized to the analyst's own estimation error, not set as a market view: stress-test every load-bearing assumption with sensitivity analysis, write the downside case before computing any return (risk is underwritten first), and require survival of a depression-grade outcome as an entry condition. Risk is not inherent in an asset — it is always relative to the price paid — and uncertainty is not the same as risk: great uncertainty at a low enough price is often the safer purchase. A harder-to-value business demands a wider cushion.",
    evidence:
      "The written sensitivity work and downside case; which assumption breaks the thesis first and at what magnitude; the price-relative framing of every risk claim; conviction that survives stress rather than narrative confidence; the desk's honesty about estimation error in hard-to-value situations.",
    investor: "Seth Klarman",
    source: {
      investor: "Seth Klarman",
      doc: "mit-remarks-october-20-2007",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/04/seth_klarman_mit_speech.pdf",
      quote:
        "Buying at a discount creates a margin of safety for the investor—room for imprecision, error, bad luck or the vicissitudes of volatile markets and economies.",
    },
  },
  {
    title: "Catalysts & Duration (Klarman)",
    question:
      "Stocks are perpetuities with no maturity date — what identifiable event caps this thesis's holding period, and would the position still be worth holding if the event slipped?",
    test:
      "Map each realization event — spin-off completion, asset sale, repurchase program, restructuring, litigation resolution — with its stage and expected timing; a partial or full catalyst converts an open-ended claim into a limited-duration one and reduces dependence on the market ever agreeing. The discipline cuts both ways: buy only what passes on a hold-forever basis, so the catalyst shortens duration without becoming the load-bearing reason to own; and a thesis with no conceivable realization path is a bet on sentiment, however cheap.",
    evidence:
      "The catalyst inventory and its stages; buyback pace as a self-generated realization clock; management's control over (and incentive toward) each event; what happened to comparable gaps that had no catalyst; the thesis re-stated with every catalyst assumed to slip a year.",
    investor: "Seth Klarman",
    source: {
      investor: "Seth Klarman",
      doc: "the-baupost-fund-shareholder-letter-fy1999-form-n-30d",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt",
      quote:
        "While we frequently invest in stocks with a catalyst for value realization in order to create a portfolio of limited duration, we nevertheless buy only when we are prepared to hold for the long-term.",
    },
  },

  // --- 5. Li Lu ---
  // Dedup notes: stock-as-ownership, Mr. Market, permanent-loss-not-volatility
  // and inversion are the desk's core doctrine verbatim; circle-of-competence
  // is core Lens 1 (Lynch's Edge carries its active half, and Li Lu's
  // drawdown-tested-boundary rides the canon question patterns); the
  // purchasing-power frame folds into Templeton's Real-Return lens; owner's-
  // mindset folds into core Lens 5; falsifiable-premise naming is the iron
  // prescription. The two below are the Li Lu instruments the desk lacks.
  {
    title: "True Knowledge vs. Opinion (Li Lu)",
    question:
      "Is what the desk holds about this company true knowledge — evidence, logic, and named ignorance — or opinion absorbed from consensus and repetition?",
    test:
      "Run the four-part intellectual honesty test on the file: what do we know, what do we not know, what do we not need to know, and where might we not know that we don't know? Knowledge must be earned like an investigative journalist's: primary documents read end-to-end, one-sided answers refused, ideas credited by evidence and reason — never because people agree. A claim that cannot name its evidence chain, or an ignorance that has never been written down, marks the boundary of the circle; the honest file carries its don't-know list as prominently as its thesis.",
    evidence:
      "The file's explicit don't-know ledger and how it shrank over time; which claims trace to primary documents read fully versus absorbed narrative; whether contrary evidence was hunted or merely survived; the desk's willingness to say 'not knowable' and stop.",
    investor: "Li Lu",
    source: {
      investor: "Li Lu",
      doc: "graham-doddsville-interview",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/642e161699ad88498e9c681a_2013-03-28%20Graham%20%26%20Doddsville%20Article_LL.pdf",
      quote:
        "The most important thing in our business is intellectual honesty. What I mean is four different things: know what you know, know what you don't know, know what you don't have to know, and realize that there is always a possibility that \"you don't know that you don't know.\"",
    },
  },
  {
    title: "The Source of Return (Li Lu)",
    question:
      "Is this thesis paid by the business's own value creation, or by a counterparty's mistake — and if the latter, why is the desk certain it is the better-informed side?",
    test:
      "Classify every expected gain by its source. Returns from the company's compounding — profits growing with a sustainably growing economy — are positive-sum and need no loser; returns from trading behavior are a zero-sum transfer where gains and losses must equal, and claiming them asserts superiority over the specific person on the other side. Prefer theses that need no loser; where a thesis does rest on mispricing, the burden is Klarman's arrogance test, answered in writing. Re-rating hoped for without either source named is speculation wearing a valuation costume.",
    evidence:
      "The return decomposition (earnings growth vs. multiple change) on the thesis and on the company's own past decade; whether the projected gain survives with zero re-rating; who the implied counterparty is and what constraint or error the desk believes they are under.",
    investor: "Li Lu",
    source: {
      investor: "Li Lu",
      doc: "the-practice-of-value-investing",
      url: "https://www.longriverinv.com/thought/the-practice-of-value-investing-by-li-lu",
      quote:
        "If you speculate on other people's short-term trading behaviour, there can only be one result in the end: gains and losses must equal because this is a zero-sum game.",
    },
  },
  // Tier 3 note (Li Lu): his Tier 3 block resolved with zero extractable
  // docs (book list, hub pages and 13F filings BLOCKED or out of charter —
  // holdings disclosures are portfolio-copying, not doctrine; the Peking
  // speech is manual video). Separately, the Chinese modernization lecture
  // (a Tier 2 row unblocked late) was extracted and read: it is the same
  // lecture as the English sibling mined in Tier 2 — its Iron Law and
  // visible-hand material already ride the Tier 2 entries, the rest is the
  // civilizational treatise the charter skips. Zero additions.
  // Tier 2 note (Li Lu): the five Tier 2 documents resolved to +3 question
  // patterns and +1 directive above; zero new concepts or metrics. The two
  // Sino-US relations pieces and the John Jay speech are civilizational/
  // geopolitical treatises and biography — macro forecasting the charter
  // refuses, with no company-level instrument to extract. From the
  // modernization lectures and the Q&A: the drawdown-tested circle boundary,
  // refute-better-than-confirm, roughly-right-over-precisely-wrong, and the
  // 5-10-companies concentration frame are already carried by Tier 1 entries
  // or core doctrine; the sixth-cardinal-relationship honesty test and the
  // Iron Law isolation risk ride CANON_QUESTIONS rather than standing as
  // lenses (each is one question, not a repeatable test battery); the
  // visible-vs-invisible-hand decomposition rides CANON_DIRECTIVES with the
  // creative-destruction planner test folded in.

  // --- 6. Walter Schloss ---
  // Dedup notes: Schloss is Graham's most direct disciple, so most of his
  // frame is already in canon through his teacher — working-capital floors
  // (Graham's NCAV), groceries-not-perfume contrarianism (Templeton),
  // buy-from-forced-sellers (Klarman), fear-and-greed discipline (the
  // misjudgment checklist), simplicity and roughly-right (core doctrine).
  // One extraction pairing (a 20-year-record minimum supported by an
  // unrelated quote) was rejected on fair-representation grounds. The lens
  // below is his own.
  // Tier 3 note (Schloss): his two verified Tier 3 docs (the Ivey
  // Athanassakos discussion summary, the not-trying-to-be-Buffett column)
  // are practice and temperament: the new-lows-then-verify habit is carried
  // by Templeton's pessimism entries plus the filed-figures directive; the
  // no-management-visits point IS the filed-figures directive; style-fit,
  // diversification-as-ignorance-defense and never-short-the-US are
  // portfolio practice and country allocation the charter keeps out; the
  // eight remaining rows BLOCKED (six wayback-only, as in Tier 2). An
  // honest empty — and the tier's close.
  // Tier 2 note (Schloss): his Tier 2 block resolved 3 verified of 10 (the
  // rest BLOCKED — wayback-only PDFs and hub pages unreachable from the
  // extraction container). The Berkshire 2006 tribute and the Bottom Line
  // exit interview are manager-practice and biography: fee structures,
  // loss-make-up terms, position counts and the 2001 quit call are fund
  // practice and market-level timing the charter keeps out, and the
  // permanent-loss risk definition, no-projection humility and greed
  // discipline are core doctrine or his Tier 1 lens already. The
  // Graham-Newman liquidation-criteria memo is the real find: it yields the
  // liquidation work-out gates metric (in CANON_METRICS), the operational
  // companion to Graham's special-situation formula. (An earlier revision of
  // this note misread the ledger's Tier 1 block as Tier 2; its re-review of
  // the Tier 1 files — reminiscence as Graham-through-memoir, Superinvestors
  // as meta-case, fund-practice figures excluded, the 20-year pairing
  // rejected — stands, recorded in the Tier 1 dedup notes above.)
  {
    title: "Assets Before Earnings (Schloss)",
    question:
      "Is this thesis anchored on assets, which change slowly, or on earnings, which can change dramatically — and does the desk carry the heavier knowledge burden an earnings anchor demands?",
    test:
      "Prefer the anchor that matches what is actually known: book value as the starting point of value, asset discounts as the classic protection, because buying earnings requires knowing much more — competitive position, margin durability, the future — and that knowledge must be demonstrated, not assumed. An earnings-anchored thesis that cannot show the deeper work steps back to the asset floor or steps away. Watch the quality of the anchor itself: goodwill in book value, assets whose stated worth would not survive liquidation, and debt against the equity that funds them.",
    evidence:
      "Book value per share and its trend; asset composition (hard assets vs. goodwill and intangibles); the spread between asset-anchored and earnings-anchored value for the same company; which anchor the desk's past theses on this company actually rested on and how each fared.",
    investor: "Walter Schloss",
    source: {
      investor: "Walter Schloss",
      doc: "factors-needed-to-make-money-in-the-stock-market",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/schloss_factors.pdf",
      quote: "Try to buy assets at a discount than to buy earnings. Earnings can",
    },
  },

  // --- 7. Joel Greenblatt ---
  // Dedup notes: temporary-vs-permanent problems is Templeton's permanence
  // test; buyback-price discipline is core Lens 6 verbatim; spin-off
  // orphaning mechanics are Klarman's; stocks-as-businesses and patience are
  // the charter. The A/R-inventory divergence sharpens core Lens 9 as a
  // metric below rather than a near-twin lens.
  // Tier 3 note (Greenblatt): his Tier 3 block resolved with zero
  // extractable docs — the NPR interview and hedgefundalpha page BLOCKED,
  // Value Investors Club and Gotham Funds are hub/product pages, the rest
  // manual video. His four books sit as manual rows; if purchased texts are
  // ever dropped into corpus-cache they would be the richest remaining
  // Greenblatt sources. An honest empty.
  // Tier 2 note (Greenblatt): his Tier 2 block resolved 2 verified of 12
  // (the rest BLOCKED paywalls/hub chrome or manual video). The WealthTrack
  // page carried no transcript — teaser only, nothing to mine. The Forbes
  // briefing book mostly restates the Tier 1 class-notes material: the
  // combined rank, both formula legs, the self-limiting edge and the
  // periodic-underperformance defense are already the Cheap AND Good lens
  // and its metrics; basket sizing, the 60% hit rate and the 20-30-name
  // floor are portfolio allocation the charter refuses. Two additions ride
  // CANON_QUESTIONS (discomfort-as-signal — the behavioral half of
  // nothing-is-cheap-for-no-reason) and CANON_DIRECTIVES (outlier data
  // verification). (An earlier revision of this note misread the ledger's
  // Tier 1 block as Tier 2; the five files it described were and remain the
  // Tier 1 corpus, all cited by Tier 1 entries.)
  {
    title: "Cheap AND Good, Never Either Alone (Greenblatt)",
    question:
      "Is this business BOTH good — high pre-tax returns on the tangible capital tied up in it — and cheap — a high earnings yield on the whole enterprise? One without the other is how the two classic mistakes get made.",
    test:
      "Judge quality and price jointly: return on tangible capital (EBIT over net working capital plus net fixed assets) answers how good, earnings yield (EBIT over enterprise value, against a floor of ~6% however low rates go) answers how cheap. Cheapness alone buys value traps — and nothing is ever cheap for no reason, so the reason must be found and judged temporary or permanent. Quality alone overpays — the degree-of-difficulty is not compensated. The discipline's returns persist precisely because it periodically underperforms: value works because it doesn't always work.",
    evidence:
      "Pre-tax return on tangible capital, level and trend, with 20%+ marking a genuinely good business; earnings yield vs. the floor rate; the named reason the price is low; mean-reversion pressure on unusually high or low returns and what management is doing about it.",
    investor: "Joel Greenblatt",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote: "We sought companies with high ROIC and a high earnings yield. It doesn't sound that complicated.",
    },
  },
  {
    title: "Time Arbitrage (Greenblatt)",
    question:
      "Why does this mispricing exist and why would it persist — is the capital that should correct it structurally unable to wait, judged on one-to-three-year windows by allocators who are not the ones doing the investing?",
    test:
      "The durable edge is the horizon, and it is durable because of an agency problem: institutional capital cannot look wrong for long, so mispricings that need years to resolve stay available to whoever can wait. For any gap the desk identifies, name who is structurally unable to hold through it and why; a mispricing every horizon can exploit is probably not one. The other side of the coin is the guarantee's shape: good valuation work gets paid, but on the market's schedule, not the desk's — a couple of weeks or two to three years.",
    evidence:
      "The holder base's constraints and evaluation windows; how long comparable gaps in this security or sector have historically taken to close; whether the thesis survives being marked wrong for two years; what would force the desk itself to abandon it early.",
    investor: "Joel Greenblatt",
    source: {
      investor: "Joel Greenblatt",
      doc: "graham-doddsville-issue-xvi-joel-greenblatt-interview",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham%20&%20Doddsville%20-%20Issue%2016%20-%20Fall%202012_vFINAL2.pdf",
      quote: "I think time arbitrage will be the \"last man standing,\" pretty clearly.",
    },
  },
  // ---------------------------------------------------------------------------
  // STAGE 2/3 RE-SYNTHESIS 2026-08-20: new CANON_CONCEPTS mined from the massively expanded
  // extraction files (all 158 corpus files were substantially enriched in the same
  // pass). Checked for duplication against every entry already above (this file,
  // all investors) and against CORE_LENSES in framework.ts before inclusion; every
  // quote below re-verified verbatim against its cited extraction file at merge time.
  // ---------------------------------------------------------------------------
  // Benjamin Graham & David Dodd:
{
    title: "Holding-Company Breakup Value (Graham)",
    question:
      "Does the sum of a holding company's separable, valuable component securities exceed the market price the parent's own stock commands as a whole?",
    test:
      "Compare the aggregate distributable or realizable value of the components (subsidiary stakes, spun-off businesses) against the pre-breakup market price of the parent's own securities. Watch for the paradox that shares of a holding company actively contesting dissolution trade depressed by the fight itself, and re-rate once the fight is lost — the depression is procedural, not fundamental, so the timing hazard is the uncertain length of the contest, not the underlying arithmetic.",
    evidence:
      "Sum-of-the-parts value of named subsidiary stakes vs. parent's market capitalization; regulatory or litigated breakup proceedings under way and their stage; the parent's price behavior around litigation or regulatory milestones in the breakup fight.",
    investor: "Benjamin Graham & David Dodd",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "special-situations",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/05/special-situations.pdf",
      quote:
        "Their unique feature is that the profit in them depends upon the principle that a holding company is worth more dead than alive",
    },
  },
  {
    title: "Litigation-Claim Mispricing (Graham)",
    question:
      "Is the market pricing a security whose value depends substantially on pending litigation as though the outcome were already known — undervaluing the claim when it favors the holder, overvaluing it when it is a liability?",
    test:
      "Identify securities whose value is dominated by an unresolved damage suit, disputed tax liability, or reorganization appeal; independently estimate a probability-weighted expected value for the claim and compare it against the market's implied discount or premium, watching for the systematic asymmetry Graham observed across named cases spanning damage suits, tax disputes, and reorganization appeals.",
    evidence:
      "Named litigation status, procedural stage, and counsel's stated expectations; the security's price discount or premium relative to a scenario-weighted estimate of the claim's outcome; historical resolution patterns for comparable disputes.",
    investor: "Benjamin Graham & David Dodd",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "special-situations",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/05/special-situations.pdf",
      quote:
        "In general, the market undervalues a litigated claim as an asset and overvalues it as a liability, Hence the students of these situa- tions often have an opportunity to buy into them at less than their true value",
    },
  },
  {
    title: "Market Efficiency Is Not Sound Judgment (Graham)",
    question:
      "Does the market's access to complete, knowable information about this company actually guarantee that its current price reflects correct judgment about that information — or only that the information is available to be judged?",
    test:
      "Separate the claim 'the market has the facts' from the claim 'the market has priced the facts correctly.' Look for cases where the SAME company's price swung dramatically over a short interval without a matching change in the underlying fundamentals — a sign that judgment, not information, was the variable that actually moved.",
    evidence:
      "Price history vs. earnings/asset trend over the same window; whether the fundamental picture changed enough to justify the swing; the specific judgment failure (not information failure) identifiable in hindsight, such as a name whose price collapsed 80%+ with no comparable collapse in its reported results.",
    investor: "Benjamin Graham & David Dodd",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "the-decade-1965-1974-its-significance-for-financial-analysts-the",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/04/renaissance_value.pdf",
      quote:
        "Knowledge is only one ingredient . on arriving at a stock's pro er price. The ther 'in edient, Fully as Important as 'information is sound judgment",
    },
  },
  {
    title: "Deceptive Selectivity — Narrative Prospects vs. Demonstrated Value (Graham)",
    question:
      "Is this security being favored or avoided chiefly because of an obvious, widely-shared narrative about its near-term prospects — and does that narrative-based judgment actually predict returns better than a demonstrated, quantitative value differential?",
    test:
      "Track the subsequent performance of securities selected or rejected on an 'obvious' prospects narrative against a systematic value screen (asset value, earnings yield) applied without regard to the narrative; treat agreement with the obvious narrative as coincidence unless the value differential independently supports it.",
    evidence:
      "Cases where the obviously-favored name (favorable industry narrative) underperforms the obviously-disfavored name (unfavorable narrative) once measured against a demonstrated value test; the gap between a narrative-based selection group's returns and a quantitative-criteria selection group's returns over the same period.",
    investor: "Benjamin Graham & David Dodd",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-01",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture1.pdf",
      quote:
        "History shows this to be a very plausible idea but an extremely misleading one; that is why I referred to this concept of selectivity as deceptive.",
    },
  },
  // John Templeton:
{
    title: "Subconscious Client Psychology & Retention Engineering (Templeton)",
    question:
      "For a client- or customer-relationship business, is retention built on demonstrated performance transparently explained, or on subconscious retention technique — repetition of good news, obscured fee visibility, engineered familiarity, manufactured social proof — that could be propping up a weaker underlying offering?",
    test:
      "Templeton's own 1953 internal memo on client relations is unusually candid that 'the influences on the psychological attitudes, decisions, and beliefs of human beings are 90% subconscious and only 10% logical,' and prescribes deliberate technique on that premise: repeat a good record four or five times rather than once; keep fees custodian-paid or otherwise low-visibility so clients rarely see the bill; cultivate detailed personal knowledge and 'personal friendship... because this subconsciously encourages a favorable attitude'; and lean on comparative-performance artifacts and testimonial letters as recurring proof points. None of this is dishonest in itself — but a business whose retention machinery visibly matches this playbook (repetition-heavy comms, opaque or bundled fees, aggressive personalization, testimonial-driven marketing) deserves the harder question the memo itself implies: is the underlying performance record strong enough that these techniques are reinforcement, or is retention doing work the record cannot?",
    evidence:
      "Fee/billing structure and cost salience (bundled, auto-debit, custodian-paid vs. itemized and client-facing); frequency and tone of client/customer communications (repetition of favorable news vs. balanced disclosure of problems); depth of personalization relative to what the product objectively requires; use of comparative track-record materials and testimonials as a marketing staple; churn or retention rate holding steady even as performance or product quality lags — the closest observable proxy for retention decoupled from record.",
    investor: "John Templeton",
    source: {
      investor: "John Templeton",
      doc: "templeton-letter-the-templeton-letters-keeping-a-client-happy",
      url: "https://web.archive.org/web/20191207125622/https://sirjohntempleton.org/2010/05/13/the-templeton-letters-keeping-a-client-happy/",
      quote:
        "the influences on the psychological attitudes, decisions, and beliefs of human beings are 90% subconscious and only 10% logical",
    },
  },
  {
    title: "Monopoly Complacency Risk (Templeton)",
    question:
      "Does this company's dominant or near-monopoly market position remove its own incentive to keep improving — and is stagnating quality, service, or innovation showing up as a symptom, however strong the current numbers look, even in the absence of any visible competitive assault?",
    test:
      "Templeton's inversion of the standard moat-is-good framing, given as advice he says he would give a head of state: 'anybody that has such control has no incentive to do better.' Where core Lens 2 (Moat & Durability) tracks whether EXTERNAL assault on high returns is being repelled, this lens tracks the opposite failure mode — INTERNAL atrophy that sets in precisely because no assault is occurring. A monopoly or near-monopoly position is not itself the red flag; the absence of self-generated pressure to improve, unchecked by either competitors or an internal culture that manufactures its own urgency, is.",
    evidence:
      "R&D or reinvestment intensity trend versus the company's own multi-year history, not versus peers who may face genuine competitive pressure the subject does not; product/service quality proxies (complaint volume, satisfaction scores, churn) drifting despite dominant share; management's own language on calls about competitive urgency, or its conspicuous absence; regulatory scrutiny or antitrust attention substituting for the market discipline the company's position has removed.",
    investor: "John Templeton",
    source: {
      investor: "John Templeton",
      doc: "alan-b-lancz-interview-with-sir-john-templeton",
      url: "https://ablonline.com/templeton-interview/",
      quote:
        "don't think that monopolies where you give one corporation or industry control of things is a good idea. Because anybody that has such control has no incentive to do better.",
    },
  },
  // Peter Lynch:
{
    title: "The Mutual-to-Stock Conversion Windfall (Lynch)",
    question:
      "Was this a genuine mutual institution (depositor-owned, no prior stockholders) converting to stock form — and does the mechanical arithmetic of that conversion (all new capital landing in equity, nobody to buy out) still hand IPO buyers value the ordinary IPO structure cannot?",
    test:
      "In an ordinary IPO the proceeds compensate a founder or existing owners; in a true mutual conversion there are none, so every dollar raised drops straight into the company's book value, roughly doubling it overnight and letting new shareholders buy an established, profitable institution for close to nothing. The windfall is genuine only where the entity was truly depositor-owned (not a disguised bailout — Lynch's 'supervisory conversion' warning applies) and where professional 'conversion hunters' have not already captured the bulk of the allocation. Confirm soundness (profitable, no debt problem) separately: the windfall multiplies whatever the underlying business is worth, for better or worse.",
    evidence:
      "Whether the entity is a first-time full conversion vs. a partial mutual-holding-company structure; the offering price as a percentage of pro-forma post-conversion book value; insider (officer/director) purchases at the identical offering price; the share of shares actually reaching original depositors vs. professional conversion-hunters; the entity's profitability and asset quality independent of the conversion arithmetic.",
    investor: "Peter Lynch",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9510f04",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9510F04.html",
      quote:
        "That $20 million invested by the shareholders became their thrift-warming present to themselves; in effect, they were buying the business for nothing.",
    },
  },
  {
    title: "Spin-off Incentive Reset & Takeover Odds (Lynch)",
    question:
      "Has this business just been separated (or is it about to be) from a parent — and does the separation plausibly reset management's incentives toward cost discipline and entrepreneurial urgency, independent of any near-term technical selling pressure the spin-off creates?",
    test:
      "Spin-offs outperform for a structural, not lucky, reason: freed managers no longer take orders from above and grab the low-hanging cost cuts the old regime tolerated, and the parent typically retains an emotional (sometimes financial) stake in seeing the spin-off succeed rather than flop. The countable evidence is asymmetric: spin-off shareholders face roughly a 14% chance of a lucrative takeover within several years versus a 3-4% baseline for companies generally — a 3.5-4.5x higher probability, usually within the same industry. Expect (and do not mistake for a fundamental verdict) an initial overhang from index funds and other holders forced to dump shares in a new, often index-ineligible entity.",
    evidence:
      "The parent's stated rationale for the separation (genuine refocus vs. offloading a problem); management's concrete cost or capital-allocation actions in the first several quarters of independence; the new entity's index-membership status and any forced-selling flow around the distribution; subsequent M&A activity among comparable recently spun-off peers as a base rate.",
    investor: "Peter Lynch",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9508e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9508E01.html",
      quote:
        "I look at a lot of numbers every week, but the 14 percent takeoverrate made an impression.",
    },
  },
  {
    title: "The 95%-Distribution Constraint Forces External Growth Financing (Lynch)",
    question:
      "Because this entity's structure (REIT, or any legally mandated high-payout vehicle) forces most earnings straight back out the door, how is it actually funding growth — and is that specific funding method accretive or dilutive to the shares already outstanding?",
    test:
      "A REIT cannot retain earnings to self-fund expansion the way an ordinary corporation can; the 95%-of-net-income distribution requirement leaves only four levers — borrow, pay the legal minimum dividend, sell existing property at a gain, or issue more stock — and each has a different value signature. Debt and asset sales can be accretive if priced right; a stock issue is accretive only if it does not dilute existing holders below the property's true worth; a token dividend cut to fund growth is a red flag, not a virtue, in a vehicle whose whole legal purpose is high payout. The same structural constraint means p/e is unreliable across such vehicles (accounting for 'earnings' varies), so the growth-funding method matters more than the headline multiple.",
    evidence:
      "Which of the four levers (debt issuance, minimum-dividend retention, property sales, share issuance) funded the period's growth, in what mix; whether a stock issuance priced below net asset value diluted existing holders; whether a 'sold property for a profit' gain was redeployed into a higher-upside asset or simply booked; the entity's price-to-FFO trend against its funds-from-operation growth rate.",
    investor: "Peter Lynch",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9708e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9708E01.html",
      quote:
        "That's not simple, given the requirement that REITs distribute 95 percent of net income. A REIT can't hold its dividend down for a few quarters while it accumulates cash to buy more property.",
    },
  },
  {
    title: "The Partial-Conversion Discount — When the Windfall Doesn't Apply (Lynch)",
    question:
      "Is this a full, clean conversion to stock form — or a partial 'mutual holding company' structure that lets insiders retain permanent control of a majority stake while selling only a minority interest to the public?",
    test:
      "A small number of thrifts and mutual insurers adopt the mutual-holding-company hybrid specifically to sell a minority interest while insiders keep permanent control and block a future takeover. This structurally understates the entity's real earnings power and real book value relative to a full conversion, and removes the two biggest sources of the ordinary conversion's upside — the book-value windfall and the elevated takeover odds — because control is locked up and cannot be bid for. The discount is a rational market response to a genuinely inferior security, not a mispricing to be arbitraged.",
    evidence:
      "The percentage of the entity actually sold to the public versus retained by the mutual holding company; any charter or bylaw provision blocking a future takeover; the gap between the partial-conversion entity's price-to-book and a comparable full-conversion peer's; whether management has ever signaled intent to complete a second-step full conversion.",
    investor: "Peter Lynch",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9404c01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9404C01.html",
      quote:
        "A mutual savings bank has only depositors. There are no sellers to compensate.",
    },
  },
  // Seth Klarman:
{
    title: "Investment vs. Speculation: The Cash-Flow Line in the Sand (Klarman)",
    question:
      "Does this security's expected return come from cash flow the business itself generates and can be underwritten today, or does it depend entirely on what some future buyer will be willing to pay for it?",
    test:
      "Klarman's own dividing line: an asset with contractual or near-term-likely cash flow independent of resale price is an investment; an asset whose entire value rests on a future buyer's willingness to pay — collectibles, story stocks priced on projected results, anything with no cash-generating capacity of its own — is speculation, however plausible the narrative. Apply the test per security, not per asset class: a single stock can pass or fail it independent of what 'stocks' broadly are assumed to do over time.",
    evidence:
      "Contractual or already-declared cash flows (coupons, rents, dividends) versus cash flows that exist only inside a projection; whether a bear case can be built from currently-realized economics rather than an extrapolated growth path; management's own language for how the business becomes worth more (operating cash generation vs. a hoped-for re-rating, next funding round, or eventual sale).",
    investor: "Seth Klarman",
    source: {
      investor: "Seth Klarman",
      doc: "opportunities-for-patient-investors",
      url: "https://rpc.cfainstitute.org/research/financial-analysts-journal/2010/opportunities-for-patient-investors",
      quote:
        "The line I draw in the sand is that if an asset has cash flow or the likelihood of cash flow in the near term and is not purely dependent on what a future buyer might pay, then it's an investment.",
    },
  },
  {
    title: "The Twin-Mania Thesis: No Bubble Ends Until Its Flow Engine Breaks (Klarman)",
    question:
      "What structural capital-flow mechanism (mutual-fund inflows, indexing, passive rebalancing, margin-fueled buying) inflated this asset class — and has THAT mechanism actually reversed, or has only the price stopped rising?",
    test:
      "A price decline alone does not mark a mania's end if the flow machine that powered it is still intact. Klarman held that the U.S. equity mania of the late 1990s could not end without its structural twin — the decade-long, roughly tenfold surge in mutual-fund assets — also ending, and that once outflows began, reflexive dip-buying would worsen rather than cushion the decline. Distinguish a correction (price gives back gains while the flow source persists) from a genuine unwind (the flow source itself reverses).",
    evidence:
      "Fund-flow data (net inflows/outflows for the relevant vehicle class), redemption trends, index-fund/passive share of ownership, margin-debt levels, and whether buying-the-dip behavior is still being rewarded or has started being punished.",
    investor: "Seth Klarman",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1998-12-23",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0000950135-98-006396.txt",
      quote:
        "we do not believe the current market mania will end without the ending of its twin, the mutual fund mania.",
    },
  },
  // Li Lu:
{
    title: "Excellence as Intrinsic Margin of Safety (Li Lu)",
    question:
      "Does this company's own demonstrated pattern of exceeding expectations function as a margin of safety in its own right — distinct from, and potentially substituting for, a statistically low purchase price?",
    test:
      "Munger's departure from Graham's price-discount margin of safety, in Li Lu's own account: a genuinely exceptional business's excellence — its own repeated capacity to outperform conservative expectations — can itself function as protection against forecast error, because the gap between conservative underwriting and actually delivered results compounds in the owner's favor even at a fair (not statistically cheap) price. This does NOT license paying any price; it substitutes a demonstrated-excellence margin for a price-based one, and the desk must verify the excellence is actually demonstrated by a real multi-year record, never merely asserted by management or a growth narrative.",
    evidence:
      "A multi-year record of the company's own results running ahead of its own prior guidance, sell-side consensus, or its own historical base rate — and whether that gap is widening (compounding evidence) rather than merely holding steady or narrowing; whether the 'excellence' claim survives being checked against demonstrated returns on incremental capital rather than growth alone.",
    investor: "Li Lu",
    source: {
      investor: "Li Lu",
      doc: "q-a-with-li-lu",
      url: "https://www.longriverinv.com/thought/qampa-with-li-lu",
      quote:
        "He never emphasised that these companies had to be bought at a discount because their excellence was in itself a discount as it would allow them to continuously surpass expectations.",
    },
  },
  {
    title: "The Three Legitimate Sell Triggers (Li Lu)",
    question:
      "Is the desk selling (or considering selling) for one of the three disciplined reasons Li Lu names — a proven mistake, a valuation swing to speculative euphoria, or a strictly better alternative found — or is the decision drifting on some less disciplined basis (boredom, price noise, an unexamined narrative shift)?",
    test:
      "Classify every prospective sell decision into exactly one of three buckets before acting: (1) MISTAKE — the original thesis is proven wrong, even a 'correct mistake' where a low-probability adverse scenario simply occurred; sell fast regardless of ego cost. (2) EUPHORIA — valuation has swung to a speculative extreme disconnected from the business's demonstrated earning power; a large portion of the resulting gain functions like an interest-free, forced loan from the government (unrealized tax deferral) that compounds the cost of NOT selling into a decision of its own. (3) BETTER OPPORTUNITY — portfolio construction is fundamentally an opportunity-cost exercise, so a strictly superior use of the capital, fully underwritten, outranks the current holding. A sell that fits none of the three is undisciplined by Li Lu's own standard.",
    evidence:
      "Whether the stated sell rationale, in the desk's own words, maps cleanly onto one of the three buckets; whether a 'mistake' sale happened promptly once identified rather than being rationalized away; whether a 'better opportunity' sale names the specific foregone alternative and its underwriting, not just a vague preference for something new.",
    investor: "Li Lu",
    source: {
      investor: "Li Lu",
      doc: "graham-doddsville-interview",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/642e161699ad88498e9c681a_2013-03-28%20Graham%20%26%20Doddsville%20Article_LL.pdf",
      quote:
        "One should make sell decisions on one of three occasions. Number one, if you make a mistake, sell as fast as you can, even if it's a correct mistake.",
    },
  },
  {
    title: "The Self-Persuasion Trap in Persuasive Pitches (Li Lu)",
    question:
      "Is a management team's, promoter's, or sell-side source's unusually fluent, convincing communication actual evidence of the underlying business's quality — or evidence that the source, in the act of perfecting the pitch, persuaded themselves first, and is now the first victim of their own sales performance?",
    test:
      "Do not read polish and conviction in a pitch as a proxy for its truth. Li Lu's own diagnosis of the sell-side mindset: the ability to sell something especially well to OTHERS is usually downstream of having already sold it to ONESELF — the seller becomes the easiest person for the seller to fool. Weight a management narrative, IPO roadshow, or analyst note by its underlying mechanism-level evidence (Planck vs. chauffeur), not by how convincingly or how many times it has been told; a story's fluency should never substitute for the desk's own independent verification.",
    evidence:
      "Whether the polish of a management or promotional narrative has increased across retellings without new underlying evidence accompanying it; whether the source shows any of the ordinary hedges and uncertainty markers of someone reasoning from evidence, or only escalating certainty; how the pitch holds up when the desk asks the specific hard follow-up question the presenter has not been asked before.",
    investor: "Li Lu",
    source: {
      investor: "Li Lu",
      doc: "q-a-with-li-lu",
      url: "https://www.longriverinv.com/thought/qampa-with-li-lu",
      quote:
        "When you are able to sell something especially well to other people, it's usually because you've persuaded yourself too.",
    },
  },
  // Walter Schloss:
{
    title: "Director Self-Interest as Turnaround Catalyst (Schloss)",
    question:
      "Does the board have enough of a stake and self-interest to actually fix an underperforming business on its own, without the investor needing to intervene as an activist?",
    test:
      "Schloss's value-realization mechanism for a depressed, asset-based holding is delegated, not activist: 'no company wants to lose money continually,' and the directors — not the passive outside investor — are responsible for turning it around, whether by changing management or otherwise improving operations. The thesis therefore depends on the board's own incentive (ownership stake, reputational and financial exposure) being strong enough to force change, not on the investor's ability or willingness to push. Where directors have little skin in the game and no record of acting on sustained underperformance, this catalyst is absent and the thesis needs a different trigger.",
    evidence:
      "Board/director equity ownership and compensation structure; history of management changes or operational shifts following sustained underperformance at this company; time elapsed since the problem became visible versus board action actually taken; whether board composition includes owner-interested directors or is dominated by insiders with no independent stake.",
    investor: "Walter Schloss",
    source: {
      investor: "Walter Schloss",
      doc: "sixty-five-years-on-wall-street",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Schloss-Sixty-Five-Years.pdf",
      quote:
        "Graham's argument was that the directors of these companies are responsible for their success.",
    },
  },
  {
    title: "Independence from Persuasion, Even a Trusted One (Schloss)",
    question:
      "Is this conviction independently derived from the company's own numbers, or is it actually borrowed from a persuasive or trusted source — even one usually right?",
    test:
      "Schloss's own discipline, per Buffett's direct assessment, is being essentially unmoved by outside influence — including his own decades-long friendship with Buffett himself. A borrowed conviction collapses the moment the source is wrong or absent; an independently verified one, built from the desk's own filed-figures work, survives that test. The distinction matters most when the persuasive source is unusually credible, because that is precisely when unearned deference is hardest to notice in oneself.",
    evidence:
      "Whether the thesis document cites the company's own filings/figures as primary support, or leans on a named investor's or analyst's position; whether conviction changed when a respected source's view changed without any new company-level facts; overlap between this thesis and a prominent investor's publicly known holdings.",
    investor: "Walter Schloss",
    source: {
      investor: "Walter Schloss",
      doc: "the-superinvestors-of-graham-and-doddsville-warren-e-buffett",
      url: "https://web.archive.org/web/20151119203729/https://www8.gsb.columbia.edu/sites/valueinvesting/files/files/Buffett1984.pdf",
      quote: "That's one of his strengths: no one has much influence on him.",
    },
  },
  // Joel Greenblatt:
{
    title: "Bad-Business Hiding-Place Taxonomy (Greenblatt)",
    question:
      "Which of four buckets explains why the market hates this stock — unsustainable, bad balance sheet, cyclical, or merely dying — and does that bucket call for an outright pass, an option-like capital-structure read, earnings normalization, or a how-long-will-it-last survival analysis?",
    test:
      "Sort every 52-week-low or consensus-hated candidate into exactly one of the four buckets before any further valuation work, because each demands a different tool: unsustainable businesses (dot-com-bust names) get passed on outright, not analyzed further; bad-balance-sheet businesses get read as an option bet on the capital structure, with seniority in the structure determining the option's effective maturity; cyclical businesses get earnings normalized through the cycle rather than priced off the trough; merely-dying businesses get a survival-runway analysis (how long will it last, and where is the cash actually going) rather than a growth-story override. Applying one valuation technique across all four buckets is the error the taxonomy exists to prevent.",
    evidence:
      "Which bucket the market's own stated objection actually falls into; for bad-balance-sheet names, the debt structure's seniority and maturity ladder; for cyclical names, the multi-year earnings range and where today's print sits in it; for dying names, insider buying/selling and where cash is actually being deployed; whether management denies the bucket outright rather than naming it.",
    investor: "Joel Greenblatt",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "An unsustainable business is like an eToys.com, Pets.com. Something that collapses in 2001-2002 and you are looking at it.",
    },
  },
  {
    title: "LEAP-as-Non-Recourse-Loan (Greenblatt)",
    question:
      "What is the true implied interest rate embedded in a long-dated call option once the cost of its 'free' downside protection is added to the pure time-value borrowing cost — and is that leverage worth its price given the loan is non-recourse?",
    test:
      "Strip a call's premium into three pieces: intrinsic value, the interest saved by not laying out the full stock price, and the cost of the protective put implicitly bundled into the option's capped downside; treat the latter two together as the option's real, non-recourse borrowing rate. That rate typically runs two to three times the nominal risk-free rate — expensive financing — but the loan cannot be called and the maximum loss is capped at the premium paid, which is the actual trade being made, not a cheap-leverage trade.",
    evidence:
      "The option's quoted premium versus its intrinsic value; the implied annualized 'extra' premium once time value is backed out; how that annualized rate compares to the risk-free rate and to alternative financing; whether the desk is pricing the non-recourse protection explicitly or simply reaching for leverage.",
    investor: "Joel Greenblatt",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "The price of the Call includes your borrowing costs and the cost of your \"protection\"--so you are not getting anything for free, but you are leveraging your bet on the future performance of a particular stock.",
    },
  },
];

export const CANON_METRICS: CanonMetric[] = [
  // --- 1. Benjamin Graham & David Dodd ---
  {
    name: "Net current asset value per share (Graham)",
    formula:
      "(total current assets − total liabilities) ÷ shares outstanding — zero weight to plant, fixed assets and goodwill; conservative variant haircuts receivables to ~80% and inventory to ~two-thirds before deducting liabilities",
    reading:
      "The floor liquidation value per share. A quote below it means the market prices the whole enterprise at less than its liquid working capital alone — either the price is wrong or continuation-as-is is wrong. Graham's diversified purchases below this floor returned roughly 20% a year over three decades.",
    benchNotes:
      "Pure reported balance-sheet arithmetic (current assets, total liabilities, share count) — computable from the bench's balance rows where disclosed; when the provider table lacks a current-assets split, the input is named as missing, never estimated. Uses the cleansed view's balance figures unchanged (cleansing touches flows, not this floor).",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "a-conversation-with-benjamin-graham",
      url: "http://www.grahamanddoddsville.net/wordpress/Files/Gurus/Benjamin%20Graham/A%20Conversation%20with%20Ben%20Graham%20-%20Financial%20Analysts%20Journal%20-%201976.pdf",
      quote:
        "My first, more limited, technique confines itself to the purchase of common stocks at less than their working-capital value, or net-current-asset value, giving no weight to the plant and other fixed assets, and deducting all liabilities in full from the current assets",
    },
  },
  {
    name: "Central value — 10-year average earnings vs. twice the bond rate (Graham)",
    formula:
      "central value = 10-year average earnings per share ÷ (2 × high-grade bond yield); equivalently, demand an earnings yield (10-year average EPS ÷ price) of at least twice the AAA bond rate",
    reading:
      "Graham's anchor for what a documented earnings record supports: with $33 average earnings and 4.3% bonds he capitalized at 8.6% (a ~12 multiplier) for a central value of ~380 against a 750 market — a caution reading, not a forecast. The spread between quote and central value measures how much of the price rests on expectations rather than record.",
    benchNotes:
      "Price enters ONLY in its sanctioned margin-of-safety role — this is valuation context, never a target. The 10-year average must be taken on the CLEANSED earnings series (the bench's owner-earnings view), which is exactly what the bench's normalization exists to supply; where the board lacks ten years, use what it holds and say so. Nothing EBITDA-family substitutes for the earnings line.",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "securities-in-an-insecure-world-annotated-transcript-by-jason-zw",
      url: "https://jasonzweig.com/a-rediscovered-masterpiece-by-benjamin-graham/",
      quote:
        "For example, at the present time, the average earnings for the last ten years are about $33 on the Dow Jones unit and the present rate on high-grade bonds is 4.3%. If you capitalize $33 at 8.6%, which is a multiplier of about 12, you would get a Central Value on the old basis of about 380, as compared with the present price of about 750.",
    },
  },
  {
    name: "Times fixed charges earned, total-deductions basis (Graham & Dodd)",
    formula:
      "earnings available for fixed charges ÷ ALL fixed charges taken together — senior and junior alike, rentals and equipment hire included (today: lease interest); never the prior-deductions method that covers senior charges first. Minimums Graham & Dodd used: utilities 1.5×, railroads 2×, industrials 3× (for preferred stock, add the preferred dividend to the charges and raise each bar)",
    reading:
      "Safety is the issuer's demonstrated ability to meet ALL obligations, not the paper protections of any one claim; the prior-deductions method is condemned for producing a deceptively strong exhibit. Coverage is judged on the normalized record, with the required margin scaling UP as the business's instability rises.",
    benchNotes:
      "Interest coverage is one of the rows whose true inputs (full fixed-charge detail, lease interest) the provider table often lacks — where undisclosed, the missing input is named, never estimated. Uses cleansed operating earnings; depreciation stays deducted (coverage from EBITDA-family numerators is exactly the deceptive exhibit this rule exists to refuse).",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "security-analysis-2nd-edition-principles-and-technique",
      url: "https://archive.org/details/dli.ernet.7983",
      quote:
        "Safety is measured not by specific lien or other contractual rights , but by the ability of the issuer to meet all of its obligations",
    },
  },
  {
    name: "Dividend payout vs. normalized earnings (Graham)",
    formula:
      "dividends per share ÷ 5-year average earnings per share (never a single year's) — read beside the same ratio for a near-identical peer",
    reading:
      "Payout policy should track average past and expected average earnings; a company earning multiples of its dividend even in a bad year can afford more, and its stated conservatism is then a rationalization to test. Graham's paired-company experiment (identical business, identical earnings, double the payout) showed the market pricing the difference — the withheld payout costs owners twice, in income and in valuation.",
    benchNotes:
      "Reported dividends over the bench's cleansed EPS average — both already on the board where disclosed. A payout persistently far below normalized earnings with no named reinvestment need is a culture datum (owner-treatment), not a cleansing candidate; nothing here adjusts the reported record.",
    anchor: "culture",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-09",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture9.pdf",
      quote:
        "For the five years 1941-45, the earnings are shown to have averaged $4.33, after taxes, as against which their maximum dividend has been one dollar per annum",
    },
  },
  {
    name: "Balance-sheet earnings check (Graham)",
    formula:
      "(ending shareholders' equity − beginning equity + dividends paid − new stock issued) compared against cumulative reported net income over the same span; investigate divergence beyond ~10%",
    reading:
      "The truer story of a period's earnings is told by the successive balance sheets: a positive gap means reported earnings understated reality (over-reserving), a negative gap means charges were routed around the income account (reserves released, write-offs to surplus). Graham's Curtiss-Wright reconciliation surfaced ~$44 million the income statements never showed.",
    benchNotes:
      "Pure reported-line arithmetic from the bench's balance rows plus dividends — computable per fiscal-year span the board holds. Gaps it surfaces become named cleansing candidates (the specific reserve or surplus item, with its disclosed amount), proposed through the normal park-for-approval gate; the check itself never adjusts anything.",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "security-analysis-2nd-edition-principles-and-technique",
      url: "https://archive.org/details/dli.ernet.7983",
      quote: "and the truer story told by the successive balance sheets",
    },
  },
  // Tier 2 additions — Graham/Dodd:
  {
    name: "Earnings-yield floor with absolute multiple caps (Graham)",
    formula:
      "earnings yield ≥ 2 × the AAA bond yield, bounded by hard caps: never pay above 10× earnings however low rates go, never above 7× when rates run high (above ~7%)",
    reading:
      "The operational bounds of Graham's central-value test (above): the doubling rule ties what an earnings dollar is worth to the bond alternative, and the caps stop low rates from rationalizing any multiple. His late-career simplified system — which he reported, after sixty years of experience, stood up under every test he made of it.",
    benchNotes:
      "Cleansed EPS as the earnings line. Price stays in its margin-of-safety role — the caps are refusal bounds, never targets. Pairs with the own-twice-what-it-owes soundness gate (next) as the two halves of the same late system.",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "an-hour-with-mr-graham-hartman-l-butler-jr-interview",
      url: "http://www.grahamanddoddsville.net/wordpress/Files/Gurus/Benjamin%20Graham/an-hour-ben-graham.pdf",
      quote:
        "Basically, I want to double the interest rate in terms of earnings return. However, in most years the interest rate was less than five percent on AAA bonds. Consequently, I have set two limits. A maximum multiple of 10 even when interest rates are under five percent, and a maximum multiple of 7 times even when interest rates are above seven percent as they are now.",
    },
  },
  {
    name: "Own twice what it owes — equity-to-assets floor (Graham)",
    formula:
      "shareholders' equity ÷ total assets ≥ 50% — equivalently, the company owns at least twice what it owes",
    reading:
      "The soundness half of Graham's late simplified system: the earnings-yield test (above) prices the earning power, and this balance-sheet gate refuses the leverage that makes cheap earning power fragile. A one-line test computable from any balance sheet.",
    benchNotes:
      "Equity and total assets straight from the bench's balance rows, no adjustments. Financial-sector balance sheets read under their own conventions instead (deposit funding is not industrial debt — see the lender's gauge). Distinct from the fixed-charges coverage test: that reads the income statement's ability to carry the debt, this reads the capital structure itself.",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "the-simplest-way-to-select-bargain-stocks",
      url: "https://alphaarchitect.com/wp-content/uploads/2011/04/Simple-and-Easy-Approach-Medical-Economics-Graham-1976.pdf",
      quote: "A company should own at least twice what It owes.",
    },
  },
  {
    name: "Special-situation indicated annual return (Graham)",
    formula:
      "indicated annual return = [G×C − L×(100%−C)] ÷ (Y×P), where G = expected gain on success, L = expected loss on failure, C = chance of success, Y = expected holding time in years, P = current price",
    reading:
      "Graham's arithmetic for event theses: an expected corporate development is underwritten as a probability-weighted annual return that charges for BOTH the failure case and the time the event takes. The desk's use is analytical — when a thesis rests on a spin-off, reorganization, or distribution (Klarman's catalysts), this is the honest way to state what the event is actually worth, and Graham's narrow-sense gate applies: the development must be under way, not merely hoped for.",
    benchNotes:
      "G, L and C must each trace to filed terms and stated reasoning — never invented precision; where they cannot be estimated the formula is not computed (an honest gap). Event context only; price appears in its margin-of-safety role.",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "special-situations",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/05/special-situations.pdf",
      quote:
        "By doing so we are able to conceive of these commitments in terms of an expected annual return on the investment.",
    },
  },
  {
    name: "Worst-year earnings retention (Graham)",
    formula:
      "earnings in the worst year of a stress period ÷ earnings in the preceding peak year — the share of earning power the business RETAINED through its hardest stretch",
    reading:
      "Graham's stability component: the sharpest single-number read on earnings durability, and the quantitative companion to normal earning power — a company that kept 80% of peak earnings through a recession is a different business from one that kept 20%, whatever their averages say. High-multiple companies in his data earned their premium largely on this measure.",
    benchNotes:
      "Computed on the cleansed earnings series over the board's year-columns; the stress period is named (which downturn), pairing with Lynch's recession-spanning streak and Li Lu's cycle-tested window as the three forms of the same law.",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "two-illustrative-approaches-to-formula-valuations-of-common-stoc",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_approaches_valuation.pdf",
      quote:
        "Stability—as measured by the greatest shrinkage of profits in the periods 1937-1938 and 1947-1956",
    },
  },
  // Tier 3 additions — Graham/Dodd:
  {
    name: "Dividend round-trip — net owner cash flow (Graham)",
    formula:
      "over a multi-year window: cash dividends paid OUT to common holders − cash raised BACK from them and their transferees (rights offerings, DRIPs, convertible exchanges, and the modern equivalent: issuance that settles stock compensation) — the NET flow to owners as a class",
    reading:
      "Graham's circular-financing catch: A.T.&T. paid $1,800 million in dividends across seven years while collecting nearly $2,700 million from the same stockholders — owners as a class financed their own dividend and paid personal tax on the round trip. A near-zero or negative net flow means the distribution is cosmetic: the payout ratio looks healthy while the capital loop destroys value through taxes and issuance costs.",
    benchNotes:
      "Cash-flow-statement rows only: dividends paid vs. equity issued (all forms), netted over 5-7 years. Pairs with the payout-vs-normalized-earnings metric (which polices the level) — this polices the loop. A company paying dividends while stock compensation quietly re-issues the shares is the contemporary A.T.&T. pattern.",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "stock-dividends-two-part-series",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/05/stock-dividends-part-1.pdf",
      quote:
        "A.T. & T. paid out $1,800 million in cash dividends at its traditional $9 rate. During the same seven years it received from its stockholders (and their transferees) nearly $2,700 million",
    },
  },
  {
    name: "Hidden equity — look-through earnings add-back (Graham)",
    formula:
      "reported EPS + (ownership % × investee's undistributed earnings per share) for stakes the income statement does not consolidate or equity-account, + income of off-income-statement asset departments — the look-through earning power of the whole position",
    reading:
      "Graham's Northern Pacific demonstration: reported earnings roughly doubled once the 48.5% Burlington stake's undistributed profits and the land-department income were added back — value the market never saw because the income statement never carried it. The modern homes of the pattern: sub-20% strategic stakes carried at cost or fair value, cross-shareholdings, and holdcos whose investees retain most of what they earn.",
    benchNotes:
      "Investee annual reports for the undistributed-earnings series; the add-back is computed and shown SEPARATELY from reported EPS, never blended silently — the bench states both figures and which the thesis uses. Where equity-method accounting already passes the share through, there is no hidden equity and no add-back (an honest zero).",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "the-rediscovered-benjamin-graham-lectures-compiled-text-of-the-1",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham-lectures.pdf",
      quote:
        "Thus you find that there is what used to be called a “hidden equity” of about $26 a share additional in those five years, making a total of about $53 that has gone back into the stockholders’ account for Northern Pacific as compared with the pre-war period.",
    },
  },

  // --- 2. John Templeton ---
  // Tier 2 note (Templeton): his two verified Tier 2 docs (Lancz interview,
  // 1988 'Uncommon Sense' remarks) add no canon entries — the net-neutral
  // portfolio, index-level and real-estate material is outside the charter,
  // and the rest restates Tier 1 entries (cross-market comparison, maximum
  // pessimism, flexibility). An honest empty.
  // Tier 3 note (Templeton): the one verified Tier 3 doc (the Wikiquote
  // collection) yields +1 question pattern — the 'this time it's different'
  // exceptionalism gate (in CANON_QUESTIONS). The rest is theology,
  // biography, and portfolio practice (humility-to-diversification, advice
  // hit rates) outside the charter's per-ticker scope.
  {
    name: "Doubling arithmetic at depressed multiples (Templeton)",
    formula:
      "years to double ≈ price ÷ earnings per share when earnings hold — at under 5× earnings, retained net worth plus dividends double the owner's stake inside five years",
    reading:
      "Templeton's maximum-pessimism arithmetic: at a sub-5 multiple the business itself repays the price in under five years without any re-rating, so the thesis needs only earnings persistence, not sentiment recovery. The honest companion question is whether the earnings ARE persistent (the normalization test) — a depressed multiple on unsustainable earnings is no bargain.",
    benchNotes:
      "Computed on the bench's CLEANSED earnings per share, never the reported figure a windfall inflated; price enters only in this margin-of-safety role, never as a target. Where the cleansed series shows the current rate is abnormal, use the normalized figure and say which.",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "templeton-letter-the-templeton-letters-the-upside-of-a-down-marke",
      url: "https://web.archive.org/web/20191207125622/https://sirjohntempleton.org/2010/06/17/the-templeton-letters-the-upside-of-a-down-market-part-2/",
      quote:
        "If the current rate of earnings is maintained, the net worth of his shares plus the dividends received will cause the value of his investment to double in less than five years.",
    },
  },
  {
    name: "Multi-metric bargain convergence (Templeton)",
    formula:
      "read four independent lenses on the same figures — price ÷ earnings, price ÷ liquidation value, price ÷ free cash flow, and dividend yield — and require them to AGREE before calling the record cheap",
    reading:
      "Templeton's Royal Dutch test: four times earnings, under half of liquidation value, three times free cash flow, and a dividend — independent lenses converging is what a real bargain looks like; one flattering ratio alone is a story, and divergence between the lenses is itself the finding to investigate (which lens is lying, and why?).",
    benchNotes:
      "Earnings and FCF come from the bench's cleansed rows; liquidation value needs the current-asset split and is named as missing where the provider table lacks it. Convergence is analytical context in the margin-of-safety role — never a target, and no EBITDA-family substitute in any of the four lenses.",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "john-templeton-warren-buffett-and-robert-wilson-adam-smith-s-mon",
      url: "https://www.gurufocus.com/news/611156/a-rare-interview-of-john-templeton-warren-buffett-and-robert-wilson",
      quote:
        "At the present price, it's selling for only four times what we think it will earn this year and we estimate that in the long run, it will earn more, and it's selling for less than half what they could liquidate for, and only about three times its present annual free cash flow and pays a little dividend.",
    },
  },
  {
    name: "Real-return deflation of the record (Templeton)",
    formula:
      "real growth = nominal growth of revenue/earnings minus the period's inflation; purchasing-power check: at 4% inflation a figure must grow 47% per decade merely to stand still",
    reading:
      "Templeton's only-rational-objective arithmetic applied to the company: deflate the multi-year revenue and earnings record and read whether the business grew in purchasing power or only in nominal dollars. A record that looks like compounding but deflates to a standstill is inflation wearing a growth costume — and the pattern usually shows first in pricing lag and rising replacement capex.",
    benchNotes:
      "An analytical overlay on the bench's existing rows — nothing is adjusted, converted, or estimated; inflation rates come from cited public sources, and the statement currency stays the only unit (its own inflation series, never an FX translation).",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "16-rules-for-investment-success",
      url: "https://www.franklintempleton.com/forms-literature/download/TL-R16",
      quote:
        "If inflation averages 4%, it will reduce the buying power of a $100,000 portfolio to $68,000 in just 10 years.",
    },
  },

  // --- 3. Peter Lynch ---
  {
    name: "P/E against the growth rate (Lynch)",
    formula:
      "price ÷ diluted EPS, read against the sustainable multi-year growth rate of that same EPS line — favorable when the multiple sits at or below the growth rate it is buying",
    reading:
      "A multiple is never high or low in the abstract: a P/E of 20 on a durable 25%-grower is not expensive, and the great compounders rarely ever look cheap. The load-bearing input is growth DURABILITY — the runway count and the category — not the ratio; a low multiple on unsustainable growth is the trap in the other direction.",
    benchNotes:
      "Uses the bench's cleansed EPS (a windfall-inflated denominator flatters the ratio); the growth rate is the multi-year cleansed trend, never one year. Price enters in its margin-of-safety role only — the ratio contextualizes, it never becomes a target.",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "use-your-edge-by-peter-lynch",
      url: "https://www.rbcpa.com/commentary-archive/use-your-edge-by-peter-lynch/",
      quote:
        "A key point to remember is that a p/e of 20 is not too much to pay for a company that's growing at 25 percent.",
    },
  },
  {
    name: "Unit sales-to-build-cost (Lynch)",
    formula:
      "annual revenue per unit ÷ capitalized construction cost per new unit (revenue ÷ average unit count; build cost from capex or unit-economics disclosures)",
    reading:
      "Lynch's rollout test: above 1.0 is viability, around 2.0 is a genuinely favorable expansion — the number that decides whether replication compounds owner value or merely consumes capital. Read with cohort honesty: do the newest units perform like the old ones?",
    benchNotes:
      "Needs unit counts and per-unit build cost from disclosures; where the provider table lacks them the inputs are named as missing, never estimated. Complements the core owner-earnings lens with the per-unit form of the incremental-return question.",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9303e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9303E01.html",
      quote:
        "A general rule for investing in restaurants is that annual sales should exceed the cost of construction. A two-to-one margin is quite favorable.",
    },
  },
  {
    name: "Cash-per-share floor, zero-debt gate (Lynch)",
    formula:
      "(cash + equivalents) ÷ diluted shares vs. the share price, applied only where total debt ≈ 0; voided for loss-makers unless the burn rate leaves years of survival",
    reading:
      "Lynch's survival clock: a debt-free company with cash per share near the price cannot be forced out of existence before the story has time to work — the operating business comes free and the downside is impairment, not extinction. Distinct from Graham's net-current-asset floor: cash only, no receivables or inventory, gated on zero debt, and read as a bankruptcy-exclusion rule rather than a valuation.",
    benchNotes:
      "Pure reported lines (cash, debt, share count) from the bench's balance rows. The burn qualifier uses the cleansed operating cash flow — a loss-maker's floor erodes at its burn rate and must be dated, not assumed.",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9601i06",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9601I06.html",
      quote: "I've never seen a company with a lot of cash and not much debt go bankrupt.",
    },
  },
  {
    name: "The lender triad (Lynch)",
    formula:
      "for any deposit-funded or balance-sheet lender: equity ÷ total assets (≥5% strong), return on assets (≥1% healthy), nonperforming assets ÷ total assets (<0.5% comforting, and the TREND declining), read together with a modest earnings multiple",
    reading:
      "Cheapness alone is meaningless in a lender: equity-to-assets is the loss-absorption firepower, ROA the underlying profitability, and the direction of nonperformers — not their level — the early signal. All three must agree; one flattering gauge is a story.",
    benchNotes:
      "All reported balance-sheet and income lines where the provider carries them for financials; nonperforming detail often lives only in filings and is named as missing when absent. Sector-scoped: apply to lenders, never generalized.",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9510f04",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9510F04.html",
      quote:
        "You want the price-to-earnings ratio to be relatively low (last year I suggested p/e's of 10 or below), the equity-to-assets ratio to be relatively high (5 or above), and the percentage of nonperforming assets to be on the decline.",
    },
  },
  {
    name: "Payout-ratio cushion (Lynch)",
    formula:
      "dividends per share ÷ earnings per share; ≤85% is safe, above 90% is the danger zone, ~50% survives an earnings halving",
    reading:
      "The dividend-cut early warning: the cushion between earnings and payout is what absorbs a bad year. The complement of Graham's payout-fairness test — Graham polices the payout that is too LOW for the record (owner-treatment), Lynch the payout too HIGH for the cushion (fragility); the same ratio, opposite tails, both culture-and-resilience data.",
    benchNotes:
      "Reported dividends over cleansed EPS — a payout ratio computed on windfall-inflated earnings understates the danger, which is exactly the distortion the bench exists to strip.",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9504e02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9504E02.html",
      quote:
        "A company that pays $1 in dividends and earns $2 per share has a ratio of 50 percent. Eighty-five percent or below is considered safe. Above 90 percent and you may be in the danger zone.",
    },
  },
  {
    name: "Consecutive-record streak spanning a recession (Lynch)",
    formula:
      "count of consecutive years (or quarters) of rising reported earnings, qualified by whether the streak covers at least one full recession",
    reading:
      "The streak is category and durability evidence, not a quality slogan: a record that survived a downturn reclassifies a company out of 'cyclical' (Lynch's Fannie Mae read), while a streak earned entirely inside an expansion proves nothing. Multi-decade streaks (30-40 years of up earnings) marked his durable-operator shortlist.",
    benchNotes:
      "Computed on reported (then cleansed) earnings only — a streak maintained by serial 'one-time' addbacks is the exact artifact the bench strips, and a streak that survives cleansing is the real signal. Needs year-depth; the board's addYear columns extend the window where the provider's is short.",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9505e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9505E01.html",
      quote:
        "Through seven years and one recession, Fannie Mae has turned in 28 consecutive quarters of record earnings.",
    },
  },

  // --- 4. Seth Klarman ---
  {
    name: "Discount to underlying / private-market value (Klarman)",
    formula:
      "(independently estimated underlying value − market price) ÷ estimated value, the estimate built from reported balance-sheet lines and segment-level private-market comparables — never from a hoped-for re-rating",
    reading:
      "Klarman's bar for 'compelling' sat at a 30-50%+ discount — a mid-teens gap is inside the estimate's own error band, not a margin of safety. The discount must be substantial, independently derived, and paired with the why-is-it-cheap answer before it counts as evidence.",
    benchNotes:
      "The value estimate uses the bench's cleansed figures and disclosed segment data; private-market comparables are cited [n] or the input is named as missing. Price appears only in this margin-of-safety role.",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1999-06-29",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000039.txt",
      quote:
        "Values in this portion of the portfolio are particularly compelling, with prices at discounts of 30% to 50% or more from our estimate of underlying asset values.",
    },
  },
  {
    name: "Depressed-earnings multiple, cash-flow cross-check (Klarman)",
    formula:
      "price ÷ CURRENT depressed after-tax earnings (deliberately not normalized upward), read beside price ÷ pretax cash flow — the spread between the two multiples is the diagnostic",
    reading:
      "Klarman's anti-optimism convention: underwrite the trough print so cheapness never depends on a recovery assumed into existence — the mirror of Graham's normalization, which works the other direction (normalize DOWN from booms; refuse to normalize UP from troughs). A wide spread between the earnings multiple and the cash-flow multiple flags capital-structure and tax artifacts in a leveraged or freshly separated entity worth understanding, not adjusting away.",
    benchNotes:
      "The pretax-cash-flow multiple is a capital-structure diagnostic ONLY — it never substitutes for earnings (nothing EBITDA-family enters as an earnings claim, and depreciation stays real). Both multiples run on reported-then-cleansed lines; the depressed-vs-normalized choice is stated explicitly whenever either is quoted.",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "the-baupost-fund-shareholder-letter-fy1999-form-n-30d",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt",
      quote:
        "the shares have slumped to around 10 times currently depressed after-tax earnings and about 5.5 times pretax cash flow.",
    },
  },
  {
    name: "Buyback pace as a realization clock (Klarman)",
    formula:
      "shares repurchased per year ÷ shares outstanding at period start (from the equity roll-forward), read against the price paid relative to value",
    reading:
      "Beyond the core allocation test (pace vs. price), Klarman read the repurchase RATE as duration: at a deep discount, a ~10%-a-year retirement is the clock on value realization with no external event and no re-rating required — the company is the thesis's own catalyst. The same pace at a rich price runs the clock in reverse.",
    benchNotes:
      "Reported lines only (repurchase amounts from the cash-flow statement, share counts from the cover/equity roll-forward). Feeds the catalyst inventory; never a cleansing adjustment.",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "the-baupost-fund-shareholder-letter-fy1999-form-n-30d",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt",
      quote: "The company is currently buying back around 10% of its stock per year.",
    },
  },
  {
    name: "Recurring 'one-time' write-offs and the ROE they overstate (Klarman)",
    formula:
      "sum of extraordinary/restructuring/'one-time' charges over a multi-year window ÷ sum of reported earnings over the same window; then restate return on equity with the written-off equity added back to the denominator and the recurring charges treated as operating costs",
    reading:
      "Charges that recur year after year are operating costs wearing a costume — and their second-order effect is the one that flatters: write-offs shrink the equity base, so the resulting high ROE is an artifact then used to justify the valuation. Klarman measured the era's write-offs at over 10% of reported earnings — the ratio tells you how much of the record is real.",
    benchNotes:
      "Bench-native on both sides: the recurring-charge pattern is exactly what bench law 2 flags as a culture datum instead of cleansing away, and the ROE restatement uses the board's own equity and earnings rows. Where charge detail is undisclosed, the missing input is named, never estimated.",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1998-06-29",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0000950135-98-004072.txt",
      quote:
        "are hardly one-time when they recur year after year. (These write-offs also result in an overstatement of return on equity; high return on equity is another argument used to justify record stock valuations.)",
    },
  },

  // --- 5. Li Lu ---
  {
    name: "Return decomposition: earnings vs. re-rating (Li Lu)",
    formula:
      "split total shareholder return over the period into (a) growth of earnings per share, (b) change in the multiple, (c) dividends — reported lines and market data, no estimates",
    reading:
      "The core value of a stock is its earnings growth; the re-rating component is borrowed from a future buyer and is the zero-sum part of any record. A company (or a thesis) whose historical return was mostly multiple expansion has not demonstrated compounding — it has demonstrated popularity, which Templeton's law says is temporary.",
    benchNotes:
      "EPS from the bench's cleansed series; the decomposition is analytical context in the margin-of-safety role and never produces a target. Apply it to the company's own past decade before crediting 'compounder' status.",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "the-prospect-of-value-investing-in-china",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5ef3c7300432b46a7e659977_The%20Prospect%20of%20Value%20Investing%20in%20China%20English%20Translation.pdf",
      quote: "The core value of stock lies in the growth of its earnings discounted to present value.",
    },
  },
  {
    name: "Cycle-tested record window (Li Lu)",
    formula:
      "before crediting a multi-year record — management's capital allocation, a strategy, a margin structure — require the window to include a down-or-flat stretch; Li Lu's practical bar is on the order of fifteen years",
    reading:
      "A record that spans only a rising tide cannot be told apart from the tide: US stocks went nowhere from 1966 to 1981, and any approach measured only outside such stretches is unproven. Applied to companies: an allocation record, a 'consistent' margin, or a growth story earned entirely inside one favorable regime gets provisional credit only, with the untested regimes named.",
    benchNotes:
      "A window-selection rule for reading the bench's own year-columns, not a computed row: state which macro stretch the displayed record spans and what it has never been through (pairs with Lynch's recession-spanning streak, which applies the same law to the earnings series).",
    anchor: "culture",
    source: {
      investor: "Li Lu",
      doc: "the-prospect-of-value-investing-in-china",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5ef3c7300432b46a7e659977_The%20Prospect%20of%20Value%20Investing%20in%20China%20English%20Translation.pdf",
      quote: "But in the ensuing 15 years (1966-1981) stock prices declined rather than grew.",
    },
  },

  // --- 6. Walter Schloss ---
  {
    name: "Debt-below-equity gate (Schloss)",
    formula:
      "total debt < 100% of shareholders' equity, straight from the balance sheet — with a standing preference for far less",
    reading:
      "Schloss's simplest resilience gate: an asset-anchored thesis with heavy leverage is on a clock it does not control, and low debt is what makes patience affordable (his average hold ran about four years, with the position usually falling first). Not a fine-grained coverage ratio — a coarse gate applied before any deeper work.",
    benchNotes:
      "Pure reported balance rows (total debt, total equity). Complements Graham's total-deductions coverage (flow-based) with the stock-based gate; where the provider table lacks a debt split, the input is named as missing.",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "factors-needed-to-make-money-in-the-stock-market",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/schloss_factors.pdf",
      quote: "Be sure that debt does not equal 100% of the equity.",
    },
  },
  {
    name: "Multi-year price range as vulnerability memory (Schloss)",
    formula:
      "the current quote read against the stock's range over roughly the past decade — with the LOW end treated as the market's remembered stress verdict on this business",
    reading:
      "Schloss's caution: a fall from 125 to 60 looks attractive until the 20 from three years earlier shows the vulnerability the business actually carries. The range is a memory of what stress did to this company's valuation, and the conditions that produced the extremes are the evidence to retrieve — never a pattern to trade.",
    benchNotes:
      "Price enters ONLY in its margin-of-safety role: this is context for judging a discount's adequacy and a prompt for the history lens (what happened at the extremes), never a signal input, a target, or chart analysis. The business conditions at the range's ends matter; the shape of the path does not.",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "factors-needed-to-make-money-in-the-stock-market",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/schloss_factors.pdf",
      quote:
        "A stock may go as igh as 125 and then decline to 60 and you think it attractive. 3 years before the stock sold at 20 which shows that there is some vulnerability in it.",
    },
  },
  // Tier 2 addition — Schloss:
  {
    name: "Liquidation work-out gates (Schloss)",
    formula:
      "three gates on a declared liquidation before Graham's special-situation arithmetic is trusted: indicated return ≥ 15-20% per annum on the estimated time and payments (the scan's OCR renders the memo's range as '15.20%'); the claim held is first in line for payment, never a junior security; and if litigation extends the clock, the issue must earn — or at least not lose — money while the desk waits",
    reading:
      "Schloss's Graham-Newman operating criteria for liquidation work-outs, the operational companion to Graham's indicated-annual-return formula (which the memo itself invokes): the hurdle charges for time, seniority protects the claim if the estimate is wrong, and the earnings condition stops the waiting period itself from consuming the value being collected.",
    benchNotes:
      "Declared events only — a liquidation actually resolved upon, Graham's narrow-sense gate. The memo's own warning travels with it: when specialists crowd the field, indicated returns compress, so the hurdle is checked against current work-out pricing, not assumed from history. Event context; price appears only in its margin-of-safety role.",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "criteria-for-liquidations-where-money-is-held-by-company",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/schloss_liquidations.pdf",
      quote:
        "Percent profit should be minimum 15.20% per annum based on estimate of time and payments to be made.",
    },
  },

  // --- 7. Joel Greenblatt ---
  {
    name: "Return on tangible capital (Greenblatt)",
    formula:
      "EBIT ÷ (net working capital + net fixed assets) — pre-tax operating earnings over the tangible capital the business actually needs, goodwill excluded",
    reading:
      "The 'good' half of the discipline: how well the business converts the working capital and equipment tied up in it into earnings. 20%+ pre-tax marks a genuinely good business; the same arithmetic on INCREMENTAL capital (new units, new capacity) is the growth question — a 50% return store is worth replicating, a 2.5% one is not, whatever the growth narrative.",
    benchNotes:
      "EBIT, never EBITDA — depreciation stays deducted, exactly the bench's law. Tangible capital from reported balance rows; where the provider table lacks the working-capital split, the input is named as missing. Goodwill exclusion measures the business, not the acquisition prices paid for it — read beside Klarman's write-off-restated ROE when goodwill history matters.",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote: "The first thing I look at ROIC = EBIT/ (NWC + Net Equipment). How good a business is this?",
    },
  },
  {
    name: "Earnings yield — EBIT to enterprise value (Greenblatt)",
    formula:
      "EBIT ÷ enterprise value, where EV = market capitalization + net interest-bearing debt − genuinely excess cash; compared against a hurdle never set below ~6% however low riskless rates go",
    reading:
      "The 'cheap' half: what the whole enterprise's pre-tax earnings stream yields a buyer of the entire capital structure — immune to the leverage distortions that make P/E and P/S incomparable across companies. Read on NORMALIZED EBIT (the bench's cleansed figure), and always jointly with return on tangible capital — cheapness alone is the classic trap.",
    benchNotes:
      "EBIT never EBITDA; price enters only in the margin-of-safety role. EV inputs are reported lines (market cap, debt including current portion, cash); the excess-cash judgment is stated, not silently assumed.",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "transcript-joel-greenblatt-masters-in-business",
      url: "https://ritholtz.com/2018/04/transcript-joel-greenblatt/",
      quote:
        "we really rank companies based on a simple metric that was earnings before interest and taxes to enterprise value",
    },
  },
  {
    name: "Maintenance capex and true owner earnings (Greenblatt)",
    formula:
      "split reported capex into maintenance (what keeps current earnings power flat — including amortized periodic refurbishments) and growth; owner earnings ≈ EBIT computed with maintenance capex in place of depreciation where the two diverge materially",
    reading:
      "Greenblatt's hotel arithmetic: $25/year of routine capex plus a $400 refurbishment every five years is $105/year of true maintenance spending, not $25 — and managements usually understate the number. The maintenance share is the capital intensity the business cannot escape; growth capex is a choice to be judged on its incremental return.",
    benchNotes:
      "Deepens the bench's real-costs law (maintenance capex is real, like depreciation): where the split is disclosed it refines owner earnings; where it is not, the gap is named — never estimated — and management's own explanation of the number is itself candor evidence.",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote: "Maintenance capex what it would take to keep earnings the same amount in the year you are looking at.",
    },
  },
  {
    name: "A/R and inventory divergence (Greenblatt)",
    formula:
      "year-over-year growth of accounts receivable and of inventory vs. growth of sales; within inventory, the finished-goods vs. raw-materials/WIP split — finished goods rising while WIP falls is the negative divergence",
    reading:
      "Greenblatt's best single predictor of coming downward earnings revisions: receivables outrunning sales flags pulled-forward or padded revenue; a negative inventory divergence flags production already slowing behind unsold goods. The divergences lead the announcement — that is the point.",
    benchNotes:
      "Pure reported balance and income lines, computable on the bench per fiscal year; the inventory split lives in footnotes and is named as missing where undisclosed. Sharpens core Lens 9's receivables/inventory red flag into a computed early-warning pair; findings feed signals and rationales, never cleansing adjustments.",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "The best method I have ever discovered to predict future downwards earnings revisions by Wall Street security analysts-is a careful analysis of A/R and inventories.",
    },
  },
  // ---------------------------------------------------------------------------
  // STAGE 2/3 RE-SYNTHESIS 2026-08-20: new CANON_METRICS mined from the massively expanded
  // extraction files (all 158 corpus files were substantially enriched in the same
  // pass). Checked for duplication against every entry already above (this file,
  // all investors) and against CORE_LENSES in framework.ts before inclusion; every
  // quote below re-verified verbatim against its cited extraction file at merge time.
  // ---------------------------------------------------------------------------
  // Benjamin Graham & David Dodd:
{
    name: "Premium-to-capital ratio — insurance underwriting leverage (Graham)",
    formula:
      "annual net premiums written ÷ stockholders' equity, compared against the SAME company's own ratio from an earlier baseline period when returns were satisfactory (not a generic industry average)",
    reading:
      "A falling ratio over decades signals capital has been built up faster than the business volume it supports, diluting return on equity even when per-dollar underwriting profitability is unchanged. Graham's remedy check: if the company returned the excess capital to restore its own historical ratio, would the remaining capital earn a satisfactory rate on what's left?",
    benchNotes:
      "Reported premiums-written and stockholders'-equity lines only, no adjustment. Compute alongside invested-assets-per-dollar-of-capital as a second leverage lens on the same question. Never treat a single year's ratio as diagnostic — anchor to the company's OWN multi-decade baseline, since the 'adequate' capital-per-premium-dollar varies by insurance line (fire vs. casualty) and this is not an EBITDA-family adjustment.",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "graham-lectures-1946-47-lecture-08",
      url: "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture8.pdf",
      quote:
        "The North River Company had $25-million of stockholders' capital and did about $9-million of business in 1945, which is a very small amount of business per dollar of capital",
    },
  },
  {
    name: "Implied growth rate from market price — the squared-growth formula (Graham)",
    formula:
      "Price = 8 × G² × E, where E = the company's own past-average earnings per share and G = the ratio of expected future-period earnings to that same past average (G=1 means no growth expected); solve G = √(Price ÷ (8 × E)) to back out what growth rate the current price is demanding",
    reading:
      "Growth expectations enter the price TWICE under this formula — once in the higher earnings figure assumed for the future, again in the higher multiplier the market applies to those higher earnings — so a modest change in assumed growth moves price by its square. Graham used this to show a Dow level of 500 implied G=1.5 (50% decade growth) versus 400 implying G=1.3 (30%).",
    benchNotes:
      "Use the bench's cleansed EPS series for E (a multi-year average, never a single strong year). The base multiplier (8x here) is Graham's own judgment-calibrated anchor for the no-growth case, not an empirically-fit constant — restate it explicitly if the desk's own no-growth base differs, and say so. Price stays in its margin-of-safety role; the output is what the market is IMPLYING, never a target to hit.",
    anchor: "business-model",
    source: {
      investor: "Benjamin Graham & David Dodd",
      doc: "two-illustrative-approaches-to-formula-valuations-of-common-stoc",
      url: "https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_approaches_valuation.pdf",
      quote:
        "Our basic formula says, somewhat arbitrarily, that where no growth is expected the current price will be 8 times both 1947-56 earnings and the expected 1957-66 earnings",
    },
  },
  // John Templeton:
{
    name: "Price vs. replacement/reproduction cost of assets (Templeton)",
    formula:
      "market price (or market cap) of the enterprise's productive assets ÷ current cost to reproduce those same assets from scratch — i.e., replacement/reproduction cost, NOT historical-cost book value; applied per unit for asset-heavy models (real estate, industrials, natural-resource processors)",
    reading:
      "Templeton's ceiling test, the structural mirror of Graham's NCAV floor: where Graham asks whether the market prices a business below its liquid current assets, this asks whether it prices assets above what a buyer could build the same productive capacity for today — 'real estate is worth no more than the cost to reproduce it.' Applied market-wide, the same test flagged a historic bargain when 'never has there been a time when common stocks were so cheap in relation to their replacement value' (successful-investing-methods speech) — historical-cost book value understates the ceiling in either direction, so the gap between book and replacement cost is itself informative for capital-intensive models.",
    benchNotes:
      "The bench's balance rows carry HISTORICAL cost; replacement cost requires an explicit reproduction-cost input (current construction/build cost, industry capacity-cost studies, appraisals) the bench does not supply natively — where cited, it is labeled clearly as replacement cost and never silently substituted for book value. Never estimated from inflation-adjusting book value alone.",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "alan-b-lancz-interview-with-sir-john-templeton",
      url: "https://ablonline.com/templeton-interview/",
      quote: "real estate is worth no more than the cost to reproduce it",
    },
  },
  {
    name: "Price-to-net-asset-value premium/discount (Templeton)",
    formula:
      "market price per share ÷ net asset value (liquidation/NAV) per share − 1, expressed as a % premium (if the ratio exceeds 1) or discount (if below 1); applies to closed-end funds, holding companies, REITs, and investment trusts whose disclosed or estimable NAV is the natural per-share value anchor",
    reading:
      "Templeton's caution against paying more for a claim than it could itself be liquidated for: an open-end vehicle is always redeemable at NAV, but a closed-end structure or holding company can trade at a persistent premium with no such backstop — 'In Berkshire Hathaway you would lose 40% from its current price to its current net asset value,' his stated reason for passing on an operator he explicitly admired. Read the other direction, a large NAV DISCOUNT is Templeton's classic liquidation-value bargain signal (the same logic behind his Royal Dutch multi-metric read, already in canon).",
    benchNotes:
      "NAV requires a disclosed or reasonably estimable liquidation/asset value per share (fund NAV reports, REIT NAV estimates, holding-company sum-of-parts); where undisclosed, the input is named as missing rather than estimated. Price stays in its margin-of-safety role — this is valuation context, and a premium is a caution flag, never itself a short thesis or a target.",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "alan-b-lancz-interview-with-sir-john-templeton",
      url: "https://ablonline.com/templeton-interview/",
      quote:
        "In Berkshire Hathaway you would lose 40% from its current price to its current net asset value.",
    },
  },
  {
    name: "Leveraged equity-slice appreciation capture under inflation (Templeton)",
    formula:
      "equity ÷ total capital (the 'equity slice') read against the expected appreciation rate of the debt-funded underlying assets: the thinner the equity slice, the larger the % return on equity produced by a given % rise in real-asset value — approximately, return on equity ≈ asset appreciation % ÷ equity-to-capital %",
    reading:
      "Templeton's explicit, named reversal of a standing conservatism rule: buying a 90%-debt real-estate company (Daon) he says 'forty years ago we would have stayed away from... because any company that's got ninety per cent debt in its structure is risky' — but 'if ninety per cent of their capital was in the form of debt then the owners of the ten per cent would receive the total appreciation,' a position that went on to return roughly ten times cost. The test is strictly conditional: it holds only where the debt funds REAL, genuinely appreciating assets in an inflationary regime, never for depreciating assets or fragile cash flows — and it must be read jointly with, never in place of, the core Balance Sheet Resilience lens's solvency test, since a thin equity slice that cannot service its debt through a downturn is still fragile regardless of the appreciation math.",
    benchNotes:
      "Computed from the bench's reported balance-sheet debt/equity split; the appreciation-rate assumption must be named and sourced (property/asset appraisal, published index) rather than invented, and stated as scenario/context analysis — it is never a valuation target and never overrides the solvency read.",
    anchor: "business-model",
    source: {
      investor: "John Templeton",
      doc: "successful-investing-methods-address-to-the-empire-club-of-canad",
      url: "https://empireclubfoundation.org/speech/succesful-investing-methods/",
      quote:
        "if ninety per cent of their capital was in the form of debt then the owners of the ten per cent would receive the total appreciation.",
    },
  },
  // Peter Lynch:
{
    name: "Commodity-producer profit leverage (Lynch)",
    formula:
      "per-unit producer profit = realized commodity price − roughly fixed cash cost per unit; because the cost side stays largely fixed, a given percentage rise in the commodity's spot price is leveraged into a much larger percentage rise in per-unit producer profit (illustrative case: a 39% spot-price gain drove an eightfold, i.e. ~700%, jump in modeled per-ounce mining profit)",
    reading:
      "Lynch's case for owning the low-cost producer rather than the physical commodity in a recovery thesis: the operator's earnings amplify the commodity move because production cost does not rise in lockstep with price. The same arithmetic cuts the other way on a price decline, which is why it is paired with a genuine low-cost-producer screen (cash cost vs. industry average) rather than applied to marginal, high-cost operators.",
    benchNotes:
      "Needs the company's own disclosed cash cost per unit (from filings or investor materials) and a scenario commodity price — never a forecast baked in as fact. Distinct from the bench's owner-earnings work: this is a sensitivity overlay on operating margin, not a substitute for cleansed earnings, and never uses an EBITDA-family proxy for the 'profit' side.",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9506e02",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9506E02.html",
      quote:
        "When gold hits $500, the company's profits suddenly jump to $160 an ounce. That's an eightfold increase in earnings.",
    },
  },
  {
    name: "Price-line/earnings-line chart divergence (Lynch)",
    formula:
      "plot the stock's price (P) against its reported EPS (E) on the same chart over the longest available window (10-35 years); read the vertical gap between the two lines as the market's current speculative premium (or discount) — widening gap = rising premium, P converging toward or dipping below E = the discount narrowing toward a buy zone",
    reading:
      "E is the reality of the company's performance; P is led around by Wall Street expectations, so the gap itself — not either line alone — is the signal. A gap as wide as it has ever been (Lynch's own McDonald's 1996 example, matching the pre-1987-crash width) is a caution flag; a gap that has closed or inverted, on a company whose E line is still climbing steadily, is where he looked to buy. Explicitly NOT a sell-timing or technical-analysis tool — Lynch used it only to find entry bargains among growth compounders he intended to hold long-term.",
    benchNotes:
      "E is the bench's cleansed EPS series, never a reported figure a one-time item has distorted; P enters only in its margin-of-safety context role. Requires year-depth beyond what most provider tables carry — the board's addYear columns extend the window where the provider's own history is short; where 10+ years of clean EPS are unavailable, the gap read is qualified as low-confidence rather than computed on a truncated series.",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9602e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9602E01.html",
      quote:
        "Perhaps you follow the progress of companies with the price-to-earningsratio, or p/e. A chart will tell you more: It tells the storyof the ongoing relationship between the P and the E.",
    },
  },
  {
    name: "REIT distribution & leverage triad — price/FFO, yield ceiling, debt/asset ceiling (Lynch)",
    formula:
      "(1) price ÷ funds from operation (FFO — reported earnings plus real-estate depreciation added back), never plain P/E, since REITs compute 'earnings' inconsistently; (2) dividend yield, flagged for further research above ~8%; (3) total debt ÷ estimated asset value, with conservative analysts uncomfortable above ~40%",
    reading:
      "P/E is structurally unreliable for cross-REIT comparison because depreciation treatment varies; price-to-FFO is the sector-appropriate substitute, with Lynch's own equity-REIT benchmark running around 11.3x. A dividend yield pushing past 8% is not automatically a bargain — it as often signals a stalled growth strategy or unsustainable payout as genuine undervaluation, and demands the debt/asset check before either conclusion is drawn. All three legs are read together; no single leg substitutes for the others.",
    benchNotes:
      "FFO is computed from the bench's cleansed operating-earnings row with real-estate depreciation (never other depreciation) added back — this is the one sanctioned depreciation add-back in the whole cleansing law, scoped strictly to REIT/real-estate-heavy balance sheets, and must be labeled as such rather than silently substituted wherever depreciation appears. Debt and estimated asset value come from reported balance rows; where the provider table lacks a current property-value estimate, the input is named as missing.",
    anchor: "business-model",
    source: {
      investor: "Peter Lynch",
      doc: "worth-z9708e01",
      url: "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9708E01.html",
      quote:
        "price-to-FFO ratio is a reasonable measure of valuation and means of comparison. The average equity REIT now sells at about 11.3 times FFO",
    },
  },
  // Seth Klarman:
{
    name: "Depression-proof loan-loss stress multiple (Klarman)",
    formula:
      "current annualized loan-loss / charge-off run rate × a stress multiplier (Klarman used 8x) applied against the loan/receivables book, then compare the resulting post-stress recovery value to the actual entry price paid for the related debt security (cents on the dollar)",
    reading:
      "Klarman's own worked example: buying auto-finance debt at 40 cents on the dollar, he sized the position so that even an 8x deterioration in the loss run rate — wiping out 40% of the entire loan portfolio — would still leave the bonds worth 60 cents, above the purchase price. A security only clears this bar if it survives a multiple-of-run-rate loss scenario, not merely a modest downside case.",
    benchNotes:
      "Runs on the bench's cleansed receivables/allowance lines and reported charge-off history; the stress multiplier is applied to the reported run rate, never to an EBITDA-style proxy, and the resulting recovery value is compared against the actual purchase price, not against par.",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "opportunities-for-patient-investors",
      url: "https://rpc.cfainstitute.org/research/financial-analysts-journal/2010/opportunities-for-patient-investors",
      quote:
        "If Ford's loan losses went from the existing run rate to eight times the run rate, 40 percent of the company's entire loan portfolio would be totally wiped out.",
    },
  },
  {
    name: "Implied share of future profit growth required by the multiple (Klarman)",
    formula:
      "back-solve the percentage of ALL future (economy-wide or industry) corporate profit growth a company or cohort's current multiple requires it to capture, then compare that implied share against the group's own trailing multi-decade share of total profit growth",
    reading:
      "Klarman's own example: the p/e multiples of the era's top 20 U.S. growth stocks implied they would need to capture 60% of ALL future U.S. corporate profit growth to justify their price — versus the 15% share that same cohort had actually provided over the prior 30 years. A wide gap between the implied share and the historical share is the diagnostic, not the multiple viewed in isolation.",
    benchNotes:
      "Uses reported historical earnings-growth contribution (cleansed, not EBITDA-derived) as the base rate; the implied-share figure is a back-solved diagnostic ratio, not a forecast the desk itself endorses — it exists to test whether the market's price already assumes a historically unprecedented outcome.",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1998-12-23",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0000950135-98-006396.txt",
      quote:
        "the current p/e multiples of the top 20 U.S. growth stocks required those companies to achieve 60% of ALL future U.S. corporate profit growth, a virtual impossibility.",
    },
  },
  {
    name: "Earnings-yield-to-bond-yield overvaluation spread (Klarman)",
    formula:
      "(net income ÷ market cap, i.e. the earnings yield) minus the prevailing long-term government bond yield, read against the historical average spread; Klarman cited valuation models that translate a given bond-yield level directly into an implied 'fair' index or company multiple",
    reading:
      "At 6.0% bond yields, Klarman cited models showing the S&P 500 more than 30% overvalued — and noted the overvaluation would be worse still if earnings fell or rates rose, i.e. the spread is a moving target that can tighten from both directions in a downturn. Applied to a single company, an unusually thin or negative earnings-yield-to-bond-yield spread flags that the price already assumes both persistent earnings and stable-or-falling rates.",
    benchNotes:
      "Earnings yield uses the bench's cleansed net income figure (never EBITDA) over market cap; the bond-yield leg is an explicit external input, and the entry notes that when either earnings or rates move adversely, the spread — and the overvaluation read — worsens on both legs at once.",
    anchor: "business-model",
    source: {
      investor: "Seth Klarman",
      doc: "baupost-n30d-1999-06-29",
      url: "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000039.txt",
      quote:
        "At 6.0% bond yields, the S&P 500 Index is calculated by these models to be more than 30% overvalued.",
    },
  },
  // Li Lu:
{
    name: "Fee-alignment structure — hurdle-and-carry vs. flat AUM fee (Li Lu)",
    formula:
      "compare a fee-based business's disclosed compensation structure against Li Lu's own operational benchmark: 0% flat management fee; the first ~6% of annual return passed to clients entirely free; a performance carry (Li Lu's own fund: 25%) taken ONLY on returns above that hurdle; and the manager's own capital held 100% inside the same vehicle clients are in (no side accounts) — read straight from the target company's disclosed fee schedule (fund prospectus, 10-K fee table, advisory agreement), never estimated",
    reading:
      "A business paid a flat fee regardless of client outcome (a pure AUM percentage with no hurdle or clawback) is structurally an 'information exploitation tax' — Li Lu's own phrase for asset management's default business model — because the same fee is earned whether the manager performs well or poorly. A structure that pays nothing until a client-favorable hurdle is cleared, and that keeps the principal's own capital in the identical vehicle, is evidence the whose-interest-does-the-pricing-serve question (already in the canon's Li Lu question shelf) resolves in the client's favor rather than the professional's.",
    benchNotes:
      "Applies when researching asset managers, insurers, wealth platforms, or any fee-based/agency business model where FOUNDATION.md's culture anchor (incentive alignment) is load-bearing. Read every input from the company's own disclosed fee tables and compensation filings — a management fee percentage, a hurdle rate, a carry percentage, and whether principal capital is co-invested are all disclosed-line items, never inferred. Distinct from a computed cleansing-bench ratio: this is a qualitative structural benchmark for comparing a target's actual disclosed terms against, not a row the bench recomputes.",
    anchor: "culture",
    source: {
      investor: "Li Lu",
      doc: "graham-doddsville-interview",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/642e161699ad88498e9c681a_2013-03-28%20Graham%20%26%20Doddsville%20Article_LL.pdf",
      quote:
        "We don't take any management fee. We provide a 6% return for free to our investors and then take 25% after that.",
    },
  },
  {
    name: "No-leverage 50% drawdown-survival threshold (Li Lu)",
    formula:
      "a capital structure (fund or company) is sized, via zero or minimal borrowed leverage, so that it can withstand a 50% peak-to-trough decline in the value of its portfolio or key assets/equity without triggering forced selling, covenant breach, or redemption-driven liquidation",
    reading:
      "Leverage, not business quality, is what converts an ordinary cyclical drawdown into a forced, value-destroying sale — Li Lu states this as the explicit reason his own fund carries no borrowed leverage: it must be able to survive a 50% portfolio decline and still meet client redemption requests by selling holdings on its own schedule, not the market's. Applied to a target company: can its balance sheet, covenant package, and funding structure survive a comparable magnitude decline in its own key asset values or equity price without a forced dilutive raise or asset fire-sale?",
    benchNotes:
      "A stress-survival threshold framed around the MAGNITUDE OF DECLINE withstood, not a static balance-sheet ratio — distinct from Schloss's 'Debt-below-equity gate' (total debt < 100% of equity, a snapshot ratio) already in the canon: this metric instead asks whether the capital structure survives a stated, severe stress scenario without forced action. Read covenant terms, maturity walls, and collateral/margin triggers from the company's own disclosed debt agreements; never estimate a stress-survival capacity the filings do not support.",
    anchor: "business-model",
    source: {
      investor: "Li Lu",
      doc: "global-value-investing-in-our-era",
      url: "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/67a4f75703627bd3a927077e_Global%20Value%20Investing%20in%20Our%20Era%20%282024-12-07%29.pdf",
      quote:
        "We adhere to the principle of not borrowing because only by doing so can we withstand a drop of 50% in the entire investment portfolio.",
    },
  },
  // Walter Schloss:
{
    name: "Two-thirds net working capital buy/sell rule (Schloss)",
    formula:
      "Buy at or below 2/3 of net working capital per share (current assets minus current liabilities, per share); target sale at or near 100% of net working capital per share — a roughly 50% gain on cost if the discount fully closes.",
    reading:
      "Schloss's own operational tightening of the classic net-net screen: a hard two-thirds discount to net working capital on entry, with the exit target set at par value of net working capital itself. 'The firm averaged about 20% a year on that basis, and it was a great deal, as long as these stocks were around' — until the working-capital-discount opportunity set itself dried up in later decades.",
    benchNotes:
      "Pure balance-sheet inputs (current assets, current liabilities) — no credit for fixed assets or goodwill. Stricter than Graham's own haircut-by-asset-class net-current-asset method (receivables ~80%, inventory ~two-thirds): Schloss applies one blanket discount to the whole net-working-capital figure rather than differentiated per-asset-class haircuts. Complements the already-canonized Debt-below-equity gate (Schloss); both apply before any earnings-based work.",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "the-right-stuff-why-walter-schloss-is-such-a-great-investor",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Walter%20Schloss%20-%20The%20Right%20Stuff%20-%20Barrons%20-%2002-25-85.pdf",
      quote:
        "We basically followed the idea of buying companies selling below working capital—at two-thirds of working capital—then, when the stocks' prices went up to match working capital per share, we'd have made 50% on our money.",
    },
  },
  {
    name: "Good-value P/E and book cross-check beyond net-nets (Schloss)",
    formula:
      "For holdings bought outside the classic net-net screen: price ÷ EPS at or near 10x, with the price reasonably close to (not far above) stated book value per share, cross-checked against dividend yield. Worked example given: book ~$27/share, EPS ~$4/share, price $40 (10x earnings), dividend $2.20/share.",
    reading:
      "Even Schloss's 'good value' (non-net-net) holdings had to clear a low-multiple bar and sit reasonably near book — he did not pay up for quality or growth just because the balance sheet was clean. His own gloss on why the multiple mattered: 'you couldn't start the business today for that.'",
    benchNotes:
      "Uses reported EPS, book value and dividend directly off the statements — no adjusted or non-GAAP substitutes. A companion screen to the net-working-capital rule above, for names too solid to qualify as classic net-nets but still bought on a plain numbers discipline.",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "the-right-stuff-why-walter-schloss-is-such-a-great-investor",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Walter%20Schloss%20-%20The%20Right%20Stuff%20-%20Barrons%20-%2002-25-85.pdf",
      quote:
        "It has a book of maybe 27, and it's got earnings of $4 a share, I'd say. It sells at 40; the dividend is $2.20, so it's selling at 10 times earnings.",
    },
  },
  {
    name: "20-year record + book-value premium ceiling (Schloss)",
    formula:
      "Purchase price at only a small premium over book value per share — typically a depressed market price relative to that book value — and an operating record extending back at least 20 years.",
    reading:
      "Schloss's late-career restatement of his buy screen ties the valuation test (small premium to book, depressed price) directly to a minimum company age: 20 years of history is what makes the book-value figure itself trustworthy rather than a snapshot of a business still finding its footing.",
    benchNotes:
      "Book value comes straight off the balance sheet; the 20-year figure is a qualitative operating-history-length gate, not a computed ratio — flag rather than reject where the record is shorter but otherwise compelling. Pairs with, and does not restate, the already-canonized Debt-below-equity gate (Schloss).",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "why-we-invest-the-way-we-do",
      url: "https://web.archive.org/web/20201108184717/https://www8.gsb.columbia.edu/sites/valueinvesting/files/files/Why%20We%20Invest%20the%20Way%20We%20Do.pdf",
      quote:
        "We want to buy cheap stocks based on a small premium over book value, usually a depressed market price, a record that goes back at least 20 years",
    },
  },
  {
    name: "Doubling threshold as sell trigger (Schloss/Graham)",
    formula:
      "Target sale once a position has approximately doubled from cost (roughly a 100% gain), rather than holding indefinitely toward an open-ended target price.",
    reading:
      "Schloss traces this rule directly to Graham: doubling was the whole target, not a step toward some larger multiple. A mechanical, pre-committed exit threshold rather than a re-forecast of fair value at each new high — though Schloss's own later practice (reevaluate the company again before selling, and check the stock's relation to book value) softens this into a re-underwriting checkpoint rather than a purely automatic trigger.",
    benchNotes:
      "Percentage-gain-from-cost trigger, not a valuation multiple — use alongside, not instead of, a fresh book-value/earnings re-check at the threshold, per Schloss's own qualification elsewhere in the corpus (factors-needed-to-make-money-in-the-stock-market).",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "going-out-on-top-walter-edwin-schloss",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Bottom%20Line%20April%2017%20-%20Walter%20Schloss.pdf",
      quote:
        "you would double your money and then get out of the stock. his focus was on doubling your money and that's it.",
    },
  },
  {
    name: "Replacement-cost floor beneath the quote (Schloss)",
    formula:
      "Estimate what it would cost to reproduce the company's core hard assets (timber reserves, real estate, plant and equipment) today, and compare that reproduction/replacement cost against the current market capitalization — a floor distinct from net current assets, since it credits fixed assets a strict net-current-asset test assigns zero value.",
    reading:
      "Schloss's own gloss on a timber-and-real-estate holding is the plainest statement of the test: the business is worth more to rebuild from scratch than the market is charging for the whole company. A companion floor to the net-working-capital rule above for asset-heavy names where fixed, not current, assets are the understated component.",
    benchNotes:
      "A qualitative reproduction-cost estimate (timber reserves, land, physical plant), not a reported balance-sheet line — flag the input basis (appraisal, comparable transaction, industry cost-per-unit) explicitly, since unlike net working capital it is not pulled directly from the financials.",
    anchor: "business-model",
    source: {
      investor: "Walter Schloss",
      doc: "the-right-stuff-why-walter-schloss-is-such-a-great-investor",
      url: "https://www.grahamanddoddsville.net/wordpress/Files/Gurus/Walter%20Schloss/Walter%20Schloss%20-%20The%20Right%20Stuff%20-%20Barrons%20-%2002-25-85.pdf",
      quote: "you couldn't replace it for what it sells for.",
    },
  },
  // Joel Greenblatt:
{
    name: "Negative Enterprise Value screen (Greenblatt)",
    formula:
      "EV = market capitalization + net interest-bearing debt − cash and equivalents; flag as a distinct extreme-margin-of-safety case whenever EV < 0 — the market is pricing the operating business at less than its net cash",
    reading:
      "A negative EV is Greenblatt's most extreme cheapness marker: the market is effectively paying to have the operating business taken off its hands on top of handing over the net cash. It is margin of safety in its starkest form — the standard earnings-yield metric (EBIT/EV) turns perverse or undefined at EV<=0, so a negative reading is flagged and investigated qualitatively (why is the whole enterprise valued below its own cash?) rather than ranked mechanically alongside ordinary cheap names.",
    benchNotes:
      "Built from the same reported lines as the existing EV metric already in canon.ts (market cap, debt including current portion, cash) — no adjustment beyond the same 'genuinely excess cash' judgment that metric already states. EV<0 is rare enough to be itself the finding, not a rank position, and the reason for the mispricing (index deletion, distressed headline, orphaned subsidiary) must be named per the 'nothing is cheap for no reason' rule already governing the Cheap AND Good concept.",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "The Enterprise Value (EV) at $1.22 was a negative $30 to $40 million! You had some room in terms of a margin of safety.",
    },
  },
  {
    name: "Effective LEAP borrowing rate — implied non-recourse interest (Greenblatt)",
    formula:
      "extra premium = (call market price − intrinsic value) − pure risk-free time-value component; annualize the extra premium over the option's remaining life to get the effective borrowing rate on the leverage embedded in the call",
    reading:
      "The rate is the true cost of the leverage plus downside insurance bundled into a call: Greenblatt's worked example paid $6.15 of extra premium on a two-year AXP LEAP, equating to a 14% two-year (7%/year) effective non-recourse borrowing cost against a roughly 3% risk-free rate — two to three times the nominal riskless rate, priced that way precisely because losses are capped at the premium paid, unlike a margin loan.",
    benchNotes:
      "Options-mechanics arithmetic built from quoted premiums and strikes, never from reported balance-sheet lines — feeds position-structuring and sizing decisions only, in the margin-of-safety role, never as a growth or earnings-quality input to the financial-statement bench.",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "I am paying $6.15, which is 14% cost of money over two years (14%/2 = 7%). So my effective borrowing cost is 7%.",
    },
  },
  {
    name: "Pre-tax free cash flow yield vs. benchmark (Greenblatt)",
    formula:
      "pre-tax free cash flow ÷ price, compared against a stated benchmark yield (e.g. the S&P 500's own aggregate pre-tax cash flow yield, ~4% in the cited period) and against the candidate's own growth rate",
    reading:
      "A relative-value earnings-yield variant distinct from the EBIT/EV metric already in canon.ts: a name clears the bar either by yielding at or above the benchmark with equal-or-better growth and fundamentals, or by yielding below the benchmark but justified by materially higher growth — value and growth 'tied at the hip,' in Greenblatt's phrase, rather than opposing style boxes.",
    benchNotes:
      "Cash flow must be the bench's cleansed, owner-earnings-style figure, never an EBITDA-family number; the benchmark yield is a stated comparator recomputed for the current period, not a fixed historical constant assumed to still hold.",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "transcript-joel-greenblatt-masters-in-business-relative-value",
      url: "https://ritholtz.com/2020/10/transcript-joel-greenblatt-2/",
      quote:
        "right now the pre-tax cash flow yields of the S&P 500 is about four percent, a little under four percent.",
    },
  },
  {
    name: "Bull-spread break-even and max-loss hurdle (Greenblatt)",
    formula:
      "net cost of a call spread = long lower-strike call premium − short higher-strike call premium; net cost = maximum loss; break-even = lower strike + net cost; maximum gain = (higher strike − lower strike) − net cost",
    reading:
      "Used to decide whether an outright in-the-money call is effectively 'buying the spread' versus a further out-of-the-money call: Greenblatt's own worked IBM $55/$60 example nets a $2.50 cost against a $5.00 maximum gain, a 100% return if the stock clears $60 — arithmetic that turns a qualitative 'which strike' choice into a quantified break-even and payoff comparison.",
    benchNotes:
      "Pure options-quote arithmetic computed from premiums at two strikes — never a substitute for, or blended with, earnings-based metrics; feeds position-structuring decisions only, in the margin-of-safety role, distinct from the LEAP-borrowing-rate metric above (a financing-cost read vs. a payoff-structure read).",
    anchor: "business-model",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "If I bought the $55 call for $10 and sold the $60 call for $7.50 for a net cost of $2.50 ($10 - $7.50, not including commissions). The most I can make if the stock is above $60 is $5.00 or a 100% return.",
    },
  },
  {
    name: "Spin-off management incentive equity pool, % of newco stock (Greenblatt)",
    formula:
      "shares reserved for management/employee incentive plans (options and restricted stock disclosed in the Form 10) ÷ total newco shares outstanding",
    reading:
      "A large disclosed incentive pool is an alignment signal to weigh, not a giveaway to flag by size alone: in the Host Marriott spin-off, 20% of the new company's stock was made available for management and employee incentives, which Greenblatt reads together with the strike price and timing of those options as evidence management has a real stake in the spinoff succeeding rather than merely being spun off to shed.",
    benchNotes:
      "Sourced from the Form 10 registration statement's incentive-plan disclosure — a capital-structure fact rather than an accounting ratio. Read jointly with the existing 'follow the money' insider-ownership directive already in canon.ts; the pool size alone is inconclusive without the strike-price/timing evidence that determines whether it is genuine incentive or a giveaway.",
    anchor: "culture",
    source: {
      investor: "Joel Greenblatt",
      doc: "special-situation-investing-classes-at-columbia-university-busin",
      url: "https://focusedcompounding.com/wp-content/uploads/2018/03/Joel-Greenblatt-Class.pdf",
      quote:
        "20% of new company stock, Host Marriot, was made available for mgt and employee incentives.",
    },
  },
];

// ---------------------------------------------------------------------------
// Text builders (the style of lensListText()) — how the canon reaches prompts.
// ---------------------------------------------------------------------------

/**
 * Short attribution tag rendered after every canon line. Deliberately name+doc
 * only — the verbatim quote stays in the data (auditable, test-enforced),
 * never in the prompt text, so the doctrine strings stay lean.
 */
function cite(s: CanonSource): string {
  return `(${s.investor} · ${s.doc})`;
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
