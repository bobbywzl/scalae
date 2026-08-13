---
slug: briefing-book-joel-greenblatt-intelligent-investing-with-steve-f
investor: greenblatt
url: https://images.forbes.com/media/pdfs/2010/04/Joel_Greenblatt_Briefing_Book.pdf
wordCount: 10817
chunksRead: 1 of 1
coverage: 100%
---

## Verbatim quotes
- > "And the two things I look at are earnings yield, which is how cheap is the company." @line 60-61
- > "We use EBIT - earnings before interest and taxes - and we compare that to enterprise value, which is the market value of a company's stock plus the long-term debt that a company has." @line 65-67
- > "we're not looking for the cheapest company, we're not looking for the best return on capital, we're looking for those companies that have the best combinations of those two." @line 106-108
- > "the S&P was actually down 1.5% during that period. If you followed this strategy, you would have been up 289% during that same period." @line 116-118
- > "over that 10 year period, you beat the market by over 14.5% a year annualized and over the last five years about 11%." @line 121-122
- > "If it always worked, everyone would do it and then it would get ruined." @line 140-141
- > "It's simple value investing. It's a systematic, very quantitative and disciplined way of effectively being a value investor." @line 143-144
- > "the top 10% of companies ranked did 17.2% a year and the bottom 10% did 2.5% a year." @line 169-170
- > "It's really basic value investing, you know, based on both Benjamin Graham and Warren Buffett. I started investing back in the early '80s and we were quite successful for a period of time." @line 589-591
- > "Figure out what something's worth and pay a lot less for it." @line 594
- > "we're just sort of leveling the playing field for companies that take on debt and companies that don't." @line 605-606
- > "If he can lay out $400,000 once and it spins out $200,000 a year, that's a 50% return on capital for each store that he can open." @line 634-636
- > "the top decile beat the second decile, beat the third decile all the way down to the tenth decile in order." @line 688-689
- > "over the last 22 years, there have been one-year periods, two-year periods, and an occasional three-year period where the formula has not beaten the market." @line 726-728
- > "only about 60% of the companies actually end up outperforming. You're not sure which ones are going to." @line 752-753
- > "Think of an insurance bet. If you insure 1,000 lives, you know there'll be some unfortunate people who bought, you know, term life insurance, that next year won't work out for them, but you don't know which ones they will be." @line 791-793
- > "I started Gotham Capital in 1985 and we returned all our outside capital at the end of 1994 after 10 years. And we had a good run. We averaged 50% a year while we were running money." @line 829-832
- > "if you use bad data, garbage in, garbage out, you'll have some of the outliers coming to the top." @line 861-862
- > "if everyone used the formula, the bargains would disappear and the magic formula would be ruined!" @line 465-467

## Question patterns
- **pattern**: Does this business rank well on BOTH an earnings-yield cheapness measure and a return-on-capital quality measure at once, rather than on either one alone? — askWhen: initial quantitative screening of a candidate, before any qualitative work begins, anchor: business-model
  > "we're not looking for the cheapest company, we're not looking for the best return on capital, we're looking for those companies that have the best combinations of those two." @line 106-108

- **pattern**: Given the strategy itself has already gone one, two, or three years without beating the market before, am I judging it — or my own multi-quarter drawdown — on too short a horizon? — askWhen: a live rules-based value position or strategy is underperforming and abandonment is being considered, anchor: culture
  > "over the last 22 years, there have been one-year periods, two-year periods, and an occasional three-year period where the formula has not beaten the market." @line 726-728

- **pattern**: If I read today's news about this name, is there an obvious, topical reason "why you wouldn't buy" it — and does that shared discomfort across the whole ranked list explain the mispricing rather than argue against it? — askWhen: a top-ranked screen result feels uncomfortable to buy (asked in response to Forbes's "what are the seemingly looking doggie stocks and industries now?"), anchor: business-model
  > "if you go through the whole list of top-ranked companies, there is a reason, and you know it because you just read the paper, why you wouldn't buy any one of them." @line 747-749

- **pattern**: Is this specific name expected to be one of the roughly 60% that work out, or am I relying on the basket — sized so that even the names that don't work out "didn't...pay very much for them"? — askWhen: sizing conviction in an individual name inside a systematic/basket value strategy, anchor: business-model
  > "only about 60% of the companies actually end up outperforming. You're not sure which ones are going to." @line 752-753

- **pattern**: Am I holding enough names — Greenblatt's own stated floor is 20 to 30 — that being wrong about any single idea can't meaningfully hurt the portfolio? — askWhen: constructing or reviewing position count in a systematic value portfolio (asked in response to Forbes's "the minimum number you figure is 24, 25 stocks?"), anchor: business-model
  > "What I suggest in the book was 20 to 30 stocks at a minimum is what you should do." @line 755-756

## Search directives
- **directive**: Recompute EBIT-based earnings yield (EBIT ÷ enterprise value) and EBIT-based return on tangible capital (EBIT ÷ [net working capital + net fixed assets]) from primary filings for the eligible universe, and rank on the combined score rather than on either metric alone. — queryShapes: ["<COMPANY> EBIT enterprise value earnings yield history", "<COMPANY> EBIT net working capital net fixed assets return on capital", "<COMPANY> magic formula combined rank current"], sourcePriority: reported income-statement (EBIT) and balance-sheet (working capital, fixed assets, debt) line items over adjusted/non-GAAP figures
  > "We use EBIT - earnings before interest and taxes - and we compare that to enterprise value, which is the market value of a company's stock plus the long-term debt that a company has." @line 65-67

- **directive**: Before treating a rules-based value strategy's underperformance as a broken edge, check it against the strategy's own history of one-to-three-year losing stretches within its multi-decade record. — queryShapes: ["<STRATEGY> historical 1-3 year underperformance stretches vs S&P 500", "magic formula drawdown periods since 1988", "value factor multi-year losing-streak base rate"], sourcePriority: the strategy's own disclosed year-by-year live/backtested returns
  > "over the last 22 years, there have been one-year periods, two-year periods, and an occasional three-year period where the formula has not beaten the market." @line 726-728

- **directive**: Before trusting a quantitative cheap-and-good screen outside the U.S., independently verify the underlying fundamentals database's data quality rather than assuming U.S. results transfer, since bad inputs concentrate in exactly the outlier names a rank-based formula would otherwise select. — queryShapes: ["<COUNTRY> equity fundamentals database data quality vs Compustat", "non-US EBIT enterprise value data reliability screen", "international value quant screen outlier false positives"], sourcePriority: primary financial-statement filings in the target market, cross-checked against a second independent data vendor
  > "if you use bad data, garbage in, garbage out, you'll have some of the outliers coming to the top." @line 861-862

## Concepts
- **title**: Cheap-and-Good Combined Rank (Magic Formula) — question: Does this business rank well on both a cheapness measure (earnings yield) and a quality measure (return on capital) at once, rather than on either alone?, test: Rank the eligible universe separately on EBIT/enterprise-value earnings yield and EBIT/tangible-capital return on capital, sum the two ranks, and prefer names near the best (lowest) combined score rather than the single cheapest or single highest-quality name., evidence: Greenblatt's own decile back-test found performance ordered monotonically — the top decile beat the second, which beat the third, "all the way down to the tenth decile in order."
  > "the top decile beat the second decile, beat the third decile all the way down to the tenth decile in order." @line 688-689

- **title**: Self-Limiting Edge (why a working formula stays inefficient) — question: If everyone adopted this exact approach, would it stop working — and does the strategy's own history of periodic underperformance explain why capital hasn't already crowded in and erased the edge?, test: Look for visible one-to-three-year losing stretches in the strategy's live/backtested record; treat their presence as consistent with (not contrary to) a durable edge, since a formula that worked every single period would attract enough capital to ruin itself., evidence: Greenblatt ties the durability of the edge directly to its own discomfort and inconsistency, warning that broad adoption would mean "the bargains would disappear and the magic formula would be ruined."
  > "if everyone used the formula, the bargains would disappear and the magic formula would be ruined!" @line 465-467

- **title**: Discomfort-as-Signal (behavioral/agency filter) — question: Would reading today's news about this name give me an obvious reason to avoid it — and is that shared discomfort across the ranked list the actual source of the mispricing rather than a warning sign?, test: Pull the names at the top of the combined screen and check whether each has a current, newspaper-legible reason to avoid it; the presence of that reason, not its absence, is the expected signature of a screen that hasn't been arbitraged away., evidence: Greenblatt states that going through the ranked list, "there is a reason, and you know it because you just read the paper, why you wouldn't buy any one of them."
  > "if you go through the whole list of top-ranked companies, there is a reason, and you know it because you just read the paper, why you wouldn't buy any one of them." @line 747-749

- **title**: Basket Insurance, Not Single-Name Conviction — question: Is my protection on this idea coming from the price paid across a diversified, similarly-screened basket, rather than from confidence that this specific name will work out?, test: Hold a minimum of 20-30 names selected the same way; expect a minority to disappoint, and treat underpaying for every name (not being right about every name) as what actually limits the damage., evidence: Greenblatt compares the approach directly to insuring 1,000 lives — you don't know in advance which ones "won't work out for them," only that the price paid caps the loss.
  > "Think of an insurance bet. If you insure 1,000 lives, you know there'll be some unfortunate people who bought, you know, term life insurance, that next year won't work out for them, but you don't know which ones they will be." @line 791-793

## Metrics
- **name**: Earnings Yield (magic formula cheapness leg) — formula: EBIT ÷ Enterprise Value, where enterprise value is stock price plus debt per share, so leverage and tax differences across companies are neutralized before ranking., reading: Used purely as a cross-sectional rank across the eligible universe (higher yield = cheaper = better rank), not as an absolute buy/sell cutoff., benchNotes: Deliberately substitutes EBIT for reported net income and enterprise value for share price/market cap specifically so companies with different debt loads and tax rates can be compared on a level footing.
  > "We use EBIT - earnings before interest and taxes - and we compare that to enterprise value, which is the market value of a company's stock plus the long-term debt that a company has." @line 65-67

- **name**: Return on (Tangible) Capital (magic formula quality leg) — formula: EBIT ÷ tangible capital employed (net working capital + net fixed assets); illustrated with a $400,000 buildout earning $200,000/yr EBIT = 50% return on capital, versus the same $400,000 earning $10,000/yr = 2.5%., reading: Higher is better; ranked cross-sectionally and combined with the earnings-yield rank to produce the single magic-formula sort., benchNotes: Financials and utilities are excluded entirely from the ranking universe — banks don't read sensibly on an EBIT basis and utility returns are set by regulators rather than competition, so "they don't follow the same rules" the formula assumes.
  > "If he can lay out $400,000 once and it spins out $200,000 a year, that's a 50% return on capital for each store that he can open." @line 634-636

- **name**: Magic Formula Live/Backtested Excess Return — formula: Not a per-security ratio — a track-record read of cumulative and annualized return versus the S&P 500 over trailing windows., reading: In Greenblatt's own account (Jan. 2010), trailing 10 years through Sept. 30, 2009: strategy +289% vs. S&P -1.5% (over 14.5%/yr annualized excess); trailing 5 years: strategy +75% vs. S&P +5% (about 11%/yr excess). A second retelling later in the same document gives close but not identical figures (+288% and +72%, ">10%/yr"), consistent with the two interviews being recorded on separate occasions rather than from one fixed data pull — see Nothing-found notes., benchNotes: The same 22-year record that produced this excess also contained one-year, two-year, and occasional three-year stretches of underperformance — the edge is presented as a long-horizon property, not a monthly or annual guarantee.
  > "the S&P was actually down 1.5% during that period. If you followed this strategy, you would have been up 289% during that same period." @line 116-118

## Nothing-found notes
None of the five required categories came up empty — Verbatim quotes, Question patterns, Search directives, Concepts, and Metrics were all populated directly from Joel Greenblatt's own words.

Three scope notes, recorded after reading the cached text in full to true EOF (line 881, one Read call — the file is 880 lines / 10,817 words, well under a single chunk):
1. Per the task instruction to extract Greenblatt's own words rather than the interviewer's, no quote above is drawn from Steve Forbes's or Alexandra Zendrian's interview questions; where a question gives useful framing it is paraphrased inline (e.g., "asked in response to Forbes's...") rather than quoted.
2. The document also contains a ~390-line block (lines 189-579) of third-party "Greenblatt in Forbes" guru-screen journalism by Stephanie Dahle and John P. Reese, describing and back-testing Greenblatt's formula rather than presenting his own speech. It was read in full but not drawn on for quotes, except for two short fragments that are Greenblatt's own book text quoted verbatim within Reese's article (marked "Greenblatt writes"/"he writes"): the "if everyone used the formula..." quote (@line 465-467) and one other such fragment, both used above since they are Greenblatt's own words, not Reese's paraphrase. Reese's own computed figures (e.g., the 30.8%/12.4% 17-year backtest gloss) were deliberately left out of the Metrics section for the same reason — they are Reese's restatement, not a Greenblatt quote.
3. The two interview transcripts restate the same 10-year/5-year track record with slightly different numbers (289%/75%/"over 14.5%"/"about 11%" in the Zendrian debriefing vs. 288%/72%/">10%" in the Forbes interview) — both are given verbatim rather than reconciled to one figure; see the Magic Formula Live/Backtested Excess Return metric above.
