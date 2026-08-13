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

  // --- 2. John Templeton ---
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
