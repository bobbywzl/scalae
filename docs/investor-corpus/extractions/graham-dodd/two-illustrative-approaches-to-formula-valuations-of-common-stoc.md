---
slug: two-illustrative-approaches-to-formula-valuations-of-common-stoc
investor: graham-dodd
url: https://valuehunter.wordpress.com/wp-content/uploads/2009/03/graham_approaches_valuation.pdf
wordCount: 4686
chunksRead: 1 of 1
coverage: 100%
---

## Verbatim quotes

- > "the most widely accepted is that which estimates the average earnings and dividends for a period of years in the future" @line 13-15

- > "its application permits of the widest range of techniques and assumptions, including plain guesswork" @line 20-22

- > "there is no a priori rule governing the number of years to which the valuer should look forward in the future" @line 28-29

- > "in security analysis the past is always being thrown out of the window of theory and coming in again through the back door of practice" @line 43-44

- > "construct a plausible picture of a company's future from his study of its past performance" @line 57-58

- > "(1) Past earnings times X equal future earnings. (2) Future earnings times Y equal Present Value" @line 98-99

- > "It is the XY factor, or multiplier of past earnings, that my students would dearly love to learn about and to calculate" @line 104-105

- > "there is no dependable method of finding this multiplier" @line 106-107

- > "they may be suggestive and useful as composite reflections of the past record, taken by itself" @line 167-168

- > "The rate of earnings on invested capital is perhaps the most logical measure of the success and quality of an enterprise" @line 242-243

- > "the expected future growth is in fact the major influence upon Current price-earnings ratios" @line 258-259

- > "It is quite evident from Table I that the stock market fixes its valuation of a given common stock on the basis" @line 409-410

## Question patterns

- **pattern**: How can an analyst bridge the gap between easily-measurable past performance and unmeasurable future forecasting? — askWhen: during stock valuation process, anchor: business-model
  > "construct a plausible picture of a company's future from his study of its past performance" @line 57-58

- **pattern**: What multiplier of past earnings legitimately reflects both known quality factors and uncertain future expectations? — askWhen: converting past earnings to present value, anchor: business-model
  > "It is the XY factor, or multiplier of past earnings, that my students would dearly love to learn about" @line 104-105

- **pattern**: Does the market's price imply realistic expectations about future earnings growth, or is it departing unjustifiably from past reality? — askWhen: comparing formula values to market prices, anchor: business-model
  > "It is quite evident from Table I that the stock market fixes its valuation of a given common stock on the basis" @line 409-410

- **pattern**: What components of business quality—profitability, growth momentum, stability, dividend policy—most reliably predict future earning power? — askWhen: rating a company's merit, anchor: business-model
  > "These criteria demonstrate the quality of the company's earnings (and dividend policy) and thus may control the multiplier" @line 232-233

## Search directives

- **directive**: Compare formula valuations (derived from past statistical performance) to current market prices; identify large discrepancies as signals that the market is pricing in divergent future expectations — queryShapes: "which stocks are 20%+ above or below formula value?", "does the high-premium group share common growth characteristics?", sourcePriority: comparative valuation tables, multi-decade earnings trends
  > "Seven issues were selling at 20% or more above their formula value, and an equal number at 20% or more below such value" @line 384-385

- **directive**: Back-calculate implied future growth rates from current market prices; use the delta between implied and actual past growth to detect where market sentiment is departing from historical reality — queryShapes: "what growth rate is the market pricing in?", "does this match the company's track record?", sourcePriority: multi-decade earnings comparison, forward earnings estimates
  > "From that figure we readily derive the earnings expected for the future period, in our case 1957-1966" @line 149-150

- **directive**: Examine whether market divergence from formula values stems from rational reassessment of business quality, or from speculative pricing disconnected from earning-power changes — queryShapes: "has the business model changed?", "is stability deteriorating?", sourcePriority: management commentary, industry dynamics, earnings variability trends
  > "the market often has concepts of future earnings changes which cannot be derived from the companies' past performance" @line 616-617

## Concepts

- **title**: Backward-Looking Analysis as Incomplete Foundation for Forward Valuation — test: does past performance correlation to future returns hold across different market regimes?, evidence: past record provides data but not certainty; analyst judgment must bridge gap
  > "the relationship between past and future proves significant enough to justify the analyst's preoccupation with the statistical record" @line 54-55

- **title**: Built-in Instability in Growth-Stock Valuations — test: do high-growth stocks show greater valuation volatility across market cycles?, evidence: no a priori rule limits forward-looking period; investor mood (bull vs. bear) drives horizon assumption
  > "in bull markets investors and analysts will tend to see far and hopefully ahead, whereas at other times they will not" @line 30-32

- **title**: Quality Elements as Bounded Multipliers — test: can a company's profitability, growth, stability, and payout ratio be reduced to a single quality index?, evidence: equal weighting of four factors provides composite quality score applicable as earnings multiplier
  > "of the company as against the over-all quality of the group" @line 239-240

- **title**: Asset Value as Long-Run Insurance Despite Current Market Indifference — test: do asset values eventually exert pricing pressure through M&A, management change, or competitive repositioning?, evidence: legal valuations (tax/merger cases) consistently weight assets; current market ignores but future may reassert
  > "the asset value has no perceptible influence on current market price. But it may have some long-run effect on future market price" @line 302-303

## Metrics

- **name**: Quality Index from Composite of Four Earnings Factors — formula: (Profitability + Growth + Stability + Payout) / 4, where each component is indexed to Dow-Jones Average = 100, reading: Allied Chemical's index = 84% means its multiplier should be 16% below group multiplier
  > "of the company as against the over-all quality of the group" @line 239-240

- **name**: Profitability as Return on Invested Capital — formula: 1956 earnings / 1956 net assets, bench notes: Dow-Jones baseline 13.0%; measure of productive efficiency; stronger predictor of price-earnings ratio than past growth alone
  > "The rate of earnings on invested capital is perhaps the most logical measure of the success and quality of an enterprise" @line 242-243

- **name**: Growth as Multi-Period Per-Share Earnings Comparison — formula: (1947-56 average vs. 1947 actual) + (1956 vs. 1947-56 average); weak correlation to current P/E despite market focus, bench notes: Dow growth = 56%; examples show 31% past growth priced at 47x while 93% growth at 9.1x
  > "the expected future growth is in fact the major influence upon Current price-earnings ratios" @line 258-259

- **name**: Stability as Percentage Earnings Retained in Crisis — formula: earnings in worst shrinkage year / earnings in preceding peak (1937-38 and 1947-56 periods), bench notes: companies with high multipliers show greater than average stability
  > "Stability—as measured by the greatest shrinkage of profits in the periods 1937-1938 and 1947-1956" @line 220-221

- **name**: Dividend Pay-Out Ratio as Investor Expectation Signal — formula: 1956 dividends / 1956 earnings (or 1947-56 average if current below average), bench notes: Dow ratio = 64.3%; proxy for earning quality perception; equal weight to growth/profitability/stability
  > "Pay-out—as measured by the ratio of 1956 dividends to 1956 earnings" @line 226-227

- **name**: Implied Future Growth from Market Price (8G² Formula) — formula: Price = 8G² × E (where E = 1947-56 average; G = expected growth 1957-66 vs. 1947-56); solving G = √(Price / 8E), reading: Dow price 500 implies G = 1.5 (50% growth); price 400 implies G = 1.30 (30% growth)
  > "Price equals (E X G) X (8 X G), or 8G? x E, where E is the per-share earnings for 1947-56" @line 457-458

## Nothing-found notes

None — this document comprehensively covers all sections.
