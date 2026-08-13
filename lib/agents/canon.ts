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
        "We pay ourselves salaries on. the order of $25,000 and $15,000, and we also have a profit-sharing plan under which after a $40-a-share dividend is earned and paid in any year the management as a whole receives 20 percent of the additional amount earned and paid.",
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
      quote: "And the management owned a lot of the stock, and they were not going to throw it down the drain.",
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
      quote: "ben graham didn't visit managements because he thought the figures told the story.",
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

  // --- 6. Walter Schloss ---
  // Dedup notes: Schloss is Graham's most direct disciple, so most of his
  // frame is already in canon through his teacher — working-capital floors
  // (Graham's NCAV), groceries-not-perfume contrarianism (Templeton),
  // buy-from-forced-sellers (Klarman), fear-and-greed discipline (the
  // misjudgment checklist), simplicity and roughly-right (core doctrine).
  // One extraction pairing (a 20-year-record minimum supported by an
  // unrelated quote) was rejected on fair-representation grounds. The lens
  // below is his own.
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
      quote:
        "Try to buy assets at a discount than to buy earnings. Earnings can change dramatically in a short time.",
    },
  },

  // --- 7. Joel Greenblatt ---
  // Dedup notes: temporary-vs-permanent problems is Templeton's permanence
  // test; buyback-price discipline is core Lens 6 verbatim; spin-off
  // orphaning mechanics are Klarman's; stocks-as-businesses and patience are
  // the charter. The A/R-inventory divergence sharpens core Lens 9 as a
  // metric below rather than a near-twin lens.
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
      "earnings yield ≥ 2 × the AAA bond yield, bounded by hard caps: never pay above 10× earnings however low rates go, never above 7× when rates run high (above ~7%); companion soundness gate — shareholders' equity ≥ 50% of total assets",
    reading:
      "The operational bounds of Graham's central-value test (above): the doubling rule ties what an earnings dollar is worth to the bond alternative, and the caps stop low rates from rationalizing any multiple. His late-career simplified system, reported as standing up under fifty years of his own testing.",
    benchNotes:
      "Cleansed EPS as the earnings line; equity and total assets from the bench's balance rows. Price stays in its margin-of-safety role — the caps are refusal bounds, never targets.",
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

  // --- 2. John Templeton ---
  // Tier 2 note (Templeton): his two verified Tier 2 docs (Lancz interview,
  // 1988 'Uncommon Sense' remarks) add no canon entries — the net-neutral
  // portfolio, index-level and real-estate material is outside the charter,
  // and the rest restates Tier 1 entries (cross-market comparison, maximum
  // pessimism, flexibility). An honest empty.
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
