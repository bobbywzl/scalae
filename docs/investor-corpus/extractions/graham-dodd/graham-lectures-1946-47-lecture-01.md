---
slug: graham-lectures-1946-47-lecture-01
investor: graham-dodd
url: https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture1.pdf
wordCount: 4911
chunksRead: 1 of 1
coverage: 100%
---

## Verbatim quotes

- > "The correct attitude of the security analyst toward the stock market might well be that of a man toward his wife." @chars 3837

- > "First, with regard to continuity: The extraordinary thing about the securities market, if you judge it over a long period of years, is the fact that it does not go off on tangents permanently, but it remains in continuous orbit." @chars 4942

- > "No doubt there was a general feeling that the company's prospects were not good, primarily because it was thought that war would not be a very good thing for a luxury type of business such as whiskey is politely considered to be." @chars 10285

- > "History shows this to be a very plausible idea but an extremely misleading one; that is why I referred to this concept of selectivity as deceptive." @chars 9894

- > "The method of selectivity which I believe does work well is one that is based on demonstrated value differentials representing the application of security analysis techniques which have been well established and well tested." @chars 12112

- > "The rapidity with which many new securities, whose evident hazards are plainly stated in a registration statement and prospectus, are gobbled up at prices far exceeding any reasonable likelihood of return gives ample evidence that the prevalent demand for securities includes a marked element of blind recklessness." @chars 15280

- > "It is bad enough, of course, to offer to the public anything on the basis of a six months' earnings figure alone, when all the other figures make the price appear so extraordinarily high." @chars 17665

- > "Among the astonishing things is the fact that the poorer the security the higher relatively was the price it was sold at." @chars 15633

- > "how much profit can a company make in this line of business -- operating on purchase contracts with automobile and other manufacturers -- in relation both to its invested capital and its sales?" @chars 18560

- > "In the six months ended June 1946 the company earned 15 per cent on its sales after taxes. It had previously tended to earn somewhere around three or four per cent on sales after taxes." @chars 18755

- > "The contrast that I am giving you illustrates to my mind not only the obvious abuses of the securities market in the last two years, but it also illustrates the fact that the security analyst can in many cases come to pretty definite conclusions that one security is relatively unattractive and other securities are attractive." @chars 23884

- > "When I mentioned Curtiss-Wright selling at two thirds or less of its working capital alone, my mind goes back again to the last war; and I think this might be a good point more or less to close on, because it gives you an idea of the continuity of the security markets." @chars 24485

- > "In analyzing a company's showing over the war period it is quite important that you should do it by the balance sheet method, or at least use the balance sheet as a check." @chars 26845

## Question patterns

- **pattern**: What sustainable profit margin and return on capital should a business in this industry realistically earn, given its competitive position and capital requirements? — askWhen: Evaluating sustainable profitability of a manufacturing or service business against its current market valuation, anchor: business-model
  > "how much profit can a company make in this line of business -- operating on purchase contracts with automobile and other manufacturers -- in relation both to its invested capital and its sales?" @chars 18560

- **pattern**: Does the market's current valuation of the company reflect its actual earning history, or is it driven by speculative sentiment about competitive prospects? — askWhen: Comparing a stock's price to its historical returns and adjusting for temporary competitive headwinds, anchor: business-model
  > "No doubt there was a general feeling that the company's prospects were not good, primarily because it was thought that war would not be a very good thing for a luxury type of business such as whiskey is politely considered to be." @chars 10285

- **pattern**: Are reported earnings this period a fair representation of sustainable earning power, or do they reflect temporary capacity constraints, seller's market conditions, or accounting reserve releases? — askWhen: Analyzing earnings during abnormal periods (post-war transition, peak capacity, constrained supply), anchor: business-model
  > "In the six months ended June 1946 the company earned 15 per cent on its sales after taxes. It had previously tended to earn somewhere around three or four per cent on sales after taxes." @chars 18755

## Search directives

- **directive**: Use historical price levels and stock market cycle peaks as reference points to gauge current valuations and identify danger zones where reversals become likely. — queryShapes: ["What was <COMPANY>'s price range in 1938-1940 and 1929-1932?", "Has <STOCK> ever traded above its current level in the past 10-20 years?", "At what historical high does <INDUSTRY group> peak before major pullbacks?"], sourcePriority: Long-term price history; Dow-Jones Industrial Average chart; prior market cycle peaks and troughs
  > "When I mentioned Curtiss-Wright selling at two thirds or less of its working capital alone, my mind goes back again to the last war; and I think this might be a good point more or less to close on, because it gives you an idea of the continuity of the security markets." @chars 24485

- **directive**: Compare company earnings across different time periods (prewar, war, immediate postwar) to identify abnormal and normalized earning power. Flag when current earnings diverge sharply from long-term average. — queryShapes: ["What was <COMPANY>'s average earnings per share 1930-1940, 1940-1945, and 1945-present?", "How does current margin/ROE compare to the 10-year average for <COMPANY>?", "Which earnings years represent abnormal conditions (war, shortage, rationing)?"], sourcePriority: Historical income statements spanning 15-30 years; competitive landscape analysis
  > "In the six months ended June 1946 the company earned 15 per cent on its sales after taxes. It had previously tended to earn somewhere around three or four per cent on sales after taxes." @chars 18755

- **directive**: Use balance sheet reconciliation method to extract true economic earnings, especially during abnormal periods where reserve charges and accounting discretion are high. — queryShapes: ["Calculate: (Ending Equity - Beginning Equity + Dividends) for <COMPANY> 1940-1946", "What major reserve charges appear in <COMPANY> financial statements for war years?", "Compare reported earnings to balance-sheet-derived earnings for each year <COMPANY> 1940-1945"], sourcePriority: Detailed balance sheets with reserve and liability detail; footnotes on accounting method changes; management discussions
  > "In analyzing a company's showing over the war period it is quite important that you should do it by the balance sheet method, or at least use the balance sheet as a check." @chars 26845

## Concepts

- **title**: Continuity of market levels and mean reversion — question: Do stock prices and earnings permanently break from historical ranges due to wars, technological shifts, or economic transformations, or do they revert to historical trading bands?, test: Track index and individual stock prices across 20+ years through major market disruptions (wars, depressions, new eras); identify whether prices ever escape previous high levels permanently or return to them; compute average earnings over 30-year periods to test for anchoring, evidence: The Dow-Jones Industrial Average has never broken permanently above historical price ranges despite world wars, deflationary crashes, atomic age arrival, and economic booms. Dow earnings centered around $10/unit from 1915–1945 despite year-to-year swings to $22 or $0.
  > "First, with regard to continuity: The extraordinary thing about the securities market, if you judge it over a long period of years, is the fact that it does not go off on tangents permanently, but it remains in continuous orbit." @chars 4942

- **title**: Deceptive selectivity — the futility of chasing obvious business prospects — question: Does buying securities with obviously bright earnings prospects or avoiding stocks with poor prospects actually lead to superior returns compared to systematic quantitative selection?, test: Compare returns on stocks chosen for obvious prospects (either good or bad sentiment) to returns on stocks chosen by quantitative investment criteria applied blindly; track performance over 5-10 year periods, evidence: National Distillers, disfavored for being "bad for wartime," rose 500% by 1946. United Aircraft, favored for defense contracts, delivered minimal gain or loss. Quantitative selections from 1938 gained 190% vs. only 8–20% for sentiment-picked stocks.
  > "History shows this to be a very plausible idea but an extremely misleading one; that is why I referred to this concept of selectivity as deceptive." @chars 9894

- **title**: Demonstrated value differentials through systematic security analysis — question: Can consistent application of established valuation tests identify reliably undervalued or overvalued securities better than qualitative business prospect analysis?, test: Apply quantitative investment tests (price-to-asset ratios, earnings yields, margin of safety thresholds) to securities; compare future performance of test-selected stocks to narrative/opinion-selected stocks over 5+ years, evidence: Stocks meeting Graham's 1938 quantitative investment tests gained 190% by 1946, vastly outperforming speculatively selected groups. The same tests worked because they identified genuine value differentials independent of market opinion.
  > "The method of selectivity which I believe does work well is one that is based on demonstrated value differentials representing the application of security analysis techniques which have been well established and well tested." @chars 12112

- **title**: Hidden economic earnings revealed through balance sheet forensics — question: Do reported earnings accurately represent sustainable economic profit, or do accounting reserve decisions, wartime cost controls, and abnormal demand mask true earning power?, test: Derive economic earnings from balance sheet comparison (ending equity minus beginning equity, plus distributions, adjusted for capital transactions); compare to reported income statement earnings; investigate large reserve movements and write-offs, evidence: Curtiss-Wright showed ~$44 million difference between reported earnings and balance-sheet-derived earnings over the war period due to large reserves charged against reported earnings that later appeared as balance sheet assets; this hidden $6+/share was invisible in income statements alone.
  > "In analyzing a company's showing over the war period it is quite important that you should do it by the balance sheet method, or at least use the balance sheet as a check." @chars 26845

## Metrics

- **name**: Post-tax profit margin (abnormal vs. normalized) — formula: Net profit after taxes ÷ Sales; reading: Calculate separately for abnormal period (wartime/shortage) and historical "normal" period. When abnormal margin (15%) vs. normalized margin (3–4%) show >2x divergence, flag as cyclical peak. Use normalized margin as base case for long-term valuation, benchNotes: Northern Engraving and similar contract manufacturers showed 15% margins during post-war seller's market vs. 3–4% historical average. Analyst must discount to historical margin for sustainable valuation.
  > "In the six months ended June 1946 the company earned 15 per cent on its sales after taxes. It had previously tended to earn somewhere around three or four per cent on sales after taxes." @chars 18755

- **name**: Long-term earnings anchor (multi-decade mean) — formula: Average earnings per unit over 20-30 year period; track deviations from mean, reading: Use 30-year average as anchor price level. Deviations >50% signal cyclical extremes; reversion becomes likely. For Dow-Jones Industrial Average, earnings centered ~$10/unit from 1915–1945; current multiple vs. this anchor indicates valuation relative to history, benchNotes: Dow earnings returned to $10/unit multiple times across booms, crashes, and wars despite year-to-year swings from $0 to $22. This stickiness to the mean over 30 years is the clearest evidence of market continuity and reversion.
  > "First, with regard to continuity: The extraordinary thing about the securities market, if you judge it over a long period of years, is the fact that it does not go off on tangents permanently, but it remains in continuous orbit." @chars 4942

- **name**: Price-to-working-capital ratio (deep value signal) — formula: Market capitalization ÷ Current working capital; reading: Trading below 0.67x of working capital alone (cash, receivables, inventory minus current liabilities) signals extreme pessimism or hidden weakness. When a large, profitable competitor trades at <2/3 working capital, it indicates market distrust of future earning power. Paired with strong recent returns, it becomes a value signal, benchNotes: Curtiss-Wright trading at 60% of working capital with $130M working capital and profitable history; United Aircraft/Wright Aeronautical precedent shows market periodically dismisses entire industries to valuations below tangible asset value.
  > "When I mentioned Curtiss-Wright selling at two thirds or less of its working capital alone, my mind goes back again to the last war; and I think this might be a good point more or less to close on, because it gives you an idea of the continuity of the security markets." @chars 24485

- **name**: Risk of relying on recent abnormal earnings for valuation — formula: Price ÷ (6-month annualized earnings); vs. Price ÷ (10-year average normalized earnings), reading: Never value on recent 6-month or single-year earnings alone when they diverge >50% from historical average. Northern Engraving valued at 6.5x recent $2.54 (annualized from $1.27 6-month) but 25x prewar $0.65 average—the P/E misleads without normalization, benchNotes: War-period manufacturing saw unsustainable margins due to lack of civilian competition and price controls. Post-war IPOs that priced on wartime earnings collapsed when normalized margins returned; analyst must identify which years were abnormal.
  > "It is bad enough, of course, to offer to the public anything on the basis of a six months' earnings figure alone, when all the other figures make the price appear so extraordinarily high." @chars 17665

## Nothing-found notes

None — lecture contains extensive treatment of all categories. This is an introductory lecture heavy on methodology, market philosophy, and illustrative examples; culture/temperament aspects appear in later lectures in the series.
