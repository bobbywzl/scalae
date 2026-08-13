---
slug: graham-doddsville-issue-xvi-joel-greenblatt-interview
investor: greenblatt
url: https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham%20&%20Doddsville%20-%20Issue%2016%20-%20Fall%202012_vFINAL2.pdf
wordCount: 20466
chunksRead: 1-7 of 7
coverage: 100%
---

## Verbatim quotes
- > "I went to Wharton, and, as they still do today, they taught the efficient market theory." @line 336-339
- > "My definition of value investing is figuring out what something is worth and paying a lot less for it." @line 616-617
- > "I make a guarantee the first day of class every year that if you're good at valuing companies, the market will agree with you." @line 617-621
- > "I just don't guarantee when. It could be a couple weeks or it could be two or three years." @line 621-623
- > "there is an agency problem where the people who are allocating the capital are not making the investment decisions." @line 702-707
- > "I think time arbitrage will be the "last man standing," pretty clearly." @line 764-767
- > "I wrote about spinoffs in Stock Market Genius. Of course a lot of people follow spin-offs, yet if you look at the studies, they still seem to outperform the market after they're spun off." @line 673-679
- > "those companies that were in the top decile, based on quantitative measures indicating that they were both cheap and good, performed better than those in the second decile, which performed better than those in the third, and so on in order." @line 827-836
- > "There's absolutely nothing wrong with what I wrote in You Could Be a Stock Market Genius – it's what I did for almost 30 years." @line 852-856
- > "Part of the future is unknowable but there are some instances where you can take a calculated risk/reward bet." @line 968-971
- > "the results showed that you couldn't figure out a compounded rate of return because you lost all of your money." @line 1040-1044
- > "we're in about the 87th percentile towards cheap, meaning that the market as measured by the Russell 1000 on a free cash flow basis has only been cheaper 13% of the time over the last 23 years." @line 1083-1091
- > "Not losing money is a good way to ensure that your portfolio has a good risk/reward profile." @line 1118-1121
- > "people would say 'how can you own only six or eight companies,' because during a lot of my career, six or eight positions represented 80+% of my portfolio." @line 1256-1261
- > "I look at it differently. I look at stocks not as pieces of paper that bounce around. I look at them as ownership stakes in businesses." @line 1266-1270
- > "If you can't explain it very simply and straightforwardly, then you probably don't understand it all that well yourself." @line 1524-1527

## Question patterns
- **pattern**: Does this business rank well on both a cheapness measure and a quality/return-on-capital measure at once, rather than on either factor alone? — askWhen: initial quantitative screening of a candidate, anchor: business-model
  > "those companies that were in the top decile, based on quantitative measures indicating that they were both cheap and good, performed better than those in the second decile, which performed better than those in the third, and so on in order." @line 827-836

- **pattern**: Am I holding this position because I trust the underlying business's earning power, or only because the paper hasn't moved against me yet? — askWhen: a macro shock or price swing tempts a sale, anchor: business-model
  > "I look at it differently. I look at stocks not as pieces of paper that bounce around. I look at them as ownership stakes in businesses." @line 1266-1270

- **pattern**: On a bottoms-up, market-cap-weighted basis, is the index cheap or expensive relative to its own multi-decade free-cash-flow-yield range right now? — askWhen: setting overall net long exposure or gauging market-level risk appetite, anchor: business-model
  > "we're in about the 87th percentile towards cheap, meaning that the market as measured by the Russell 1000 on a free cash flow basis has only been cheaper 13% of the time over the last 23 years." @line 1083-1091

- **pattern**: Could I explain this thesis very simply and straightforwardly — and if not, do I actually understand the business? — askWhen: before committing capital or presenting an investment idea, anchor: culture
  > "If you can't explain it very simply and straightforwardly, then you probably don't understand it all that well yourself." @line 1524-1527

- **pattern**: Is the capital behind this security structurally short-horizon — an agency problem forcing 1-3 year judgment — in a way that would keep smart money from correcting an obvious mispricing for years? — askWhen: assessing how durable a time-arbitrage opportunity is likely to be, anchor: business-model
  > "there is an agency problem where the people who are allocating the capital are not making the investment decisions." @line 702-707

## Search directives
- **directive**: Screen the universe on a combined rank of cheapness (earnings yield) and quality (return on capital) rather than on either factor alone, and prefer names near the top of the combined ranking. — queryShapes: ["<COMPANY> return on tangible capital rank vs sector", "<COMPANY> earnings yield vs enterprise value history", "<COMPANY> combined cheap-and-good decile screen result"], sourcePriority: reported financial statements and a systematic multi-factor screener
  > "those companies that were in the top decile, based on quantitative measures indicating that they were both cheap and good, performed better than those in the second decile, which performed better than those in the third, and so on in order." @line 827-836

- **directive**: Track newly completed and upcoming corporate spin-offs for the structural, non-analytical selling (index and institutional overhang) that keeps the spun-off entity mispriced after separation. — queryShapes: ["<COMPANY> spin-off completion date and index-inclusion timeline", "<TICKER> post spin-off institutional ownership change", "spin-off <COMPANY> analyst coverage initiation lag"], sourcePriority: SEC Form 10 / Form 8-K spin-off filings and index-reconstitution announcements
  > "I wrote about spinoffs in Stock Market Genius. Of course a lot of people follow spin-offs, yet if you look at the studies, they still seem to outperform the market after they're spun off." @line 673-679

- **directive**: Recompute the market's own bottoms-up, market-cap-weighted free cash flow yield and locate it against its trailing multi-decade percentile range before sizing overall exposure. — queryShapes: ["Russell 1000 aggregate free cash flow yield current percentile", "market-cap-weighted FCF yield vs 20-year history", "forward 1-2 year index return conditional on current FCF-yield percentile"], sourcePriority: index-level fundamentals built bottoms-up from constituent filings
  > "we're in about the 87th percentile towards cheap, meaning that the market as measured by the Russell 1000 on a free cash flow basis has only been cheaper 13% of the time over the last 23 years." @line 1083-1091

## Concepts
- **title**: Cheap and Good (combined value + quality ranking) — question: Does the stock rank well on both an absolute cheapness measure and a return-on-capital quality measure, rather than on just one?, test: Sort candidates by a combined decile of earnings yield and return on capital; prefer top-decile combined names over names that are merely cheap or merely high-quality in isolation, evidence: Greenblatt's own backtest showed decile-one (cheap+good) beating decile-two, decile-two beating decile-three, "and so on in order" down through decile ten
  > "those companies that were in the top decile, based on quantitative measures indicating that they were both cheap and good, performed better than those in the second decile, which performed better than those in the third, and so on in order." @line 827-836

- **title**: Ownership-Stake Framing for Concentration — question: Would I be comfortable holding this position through an unrelated macro scare because I trust the long-run earning power of this specific business?, test: Size positions as if buying a real, private local business rather than a liquid quote that bounces daily; concentration is acceptable only when each name has been researched carefully, evidence: Greenblatt held six to eight positions as 80%+ of his portfolio precisely because he treated them as ownership stakes, not paper
  > "people would say 'how can you own only six or eight companies,' because during a lot of my career, six or eight positions represented 80+% of my portfolio." @line 1256-1261

- **title**: Time Arbitrage via Institutional Agency Problem — question: Is this mispricing durable because the capital that would correct it is structurally judged on a 1-3 year lookback rather than free to wait for 2-3 year intrinsic-value convergence?, test: Identify situations where asset-allocation decision-makers (who are not the ones investing) cannot observe manager skill except through short-term performance, keeping patient capital structurally scarce, evidence: Greenblatt ties the durability of the value edge directly to this agency problem and calls time arbitrage the "last man standing" inefficiency
  > "I think time arbitrage will be the "last man standing," pretty clearly." @line 764-767

- **title**: Asymmetric, Downside-Protected Sizing — question: Is the downside on this position genuinely capped even where the upside is hard to quantify, such that being wrong is cheap?, test: Load capital into positions with well-protected downside rather than into the single highest theoretical-payoff position; not-losing-money is treated as the primary driver of good risk/reward, evidence: Greenblatt states plainly that limited-downside positions, not biggest-payoff positions, are what he loaded up on
  > "Not losing money is a good way to ensure that your portfolio has a good risk/reward profile." @line 1118-1121

## Metrics
- **name**: Free Cash Flow Yield Percentile (Russell 1000, bottoms-up) — formula: Market-cap-weighted free cash flow yield of the Russell 1000, built stock-by-stock (bottoms-up) each day, ranked against its own trailing ~23-year distribution to produce a cheap/expensive percentile, reading: 87th percentile toward cheap as of the interview — cheaper only 13% of the time in 23 years, historically associated with about 17% forward one-year and roughly mid-30s% cumulative two-year returns, benchNotes: Bottoms-up construction is the point (avoids mega-cap/index-composition distortion); used to set overall long tilt, not for single-stock selection
  > "we're in about the 87th percentile towards cheap, meaning that the market as measured by the Russell 1000 on a free cash flow basis has only been cheaper 13% of the time over the last 23 years." @line 1083-1091

- **name**: Magic Formula Decile Rank (earnings yield x return on capital) — formula: Rank the universe on a combined score of cheapness (earnings yield) and quality (return on capital) and sort into deciles, decile one being the best combined cheap-and-good score and decile ten the worst, reading: Decile one beat decile two, decile two beat decile three, "and so on in order" through decile ten in Greenblatt's original test, benchNotes: The tested, working use is going long decile one; a pure decile-one-long/decile-ten-short pairing, held a full year without rebalancing, failed badly around Q1 2000 when the book's own afterword test lost all of its money
  > "the results showed that you couldn't figure out a compounded rate of return because you lost all of your money." @line 1040-1044

- **name**: Position Concentration (six-to-eight names ≈ 80%+ of portfolio) — formula: Concentrate capital in the six-to-eight highest-conviction, most-thoroughly-researched ideas, sized so this core represents the large majority of invested capital, reading: "six or eight positions represented 80+% of my portfolio" through a large part of Greenblatt's career, benchNotes: Justified only when each name has been researched carefully, with strong management and good franchises — framed explicitly as conservative rather than as concentration for its own sake
  > "people would say 'how can you own only six or eight companies,' because during a lot of my career, six or eight positions represented 80+% of my portfolio." @line 1256-1261

## Nothing-found notes
None — Verbatim quotes, Question patterns, Search directives, Concepts, and Metrics were all populated directly from Joel Greenblatt's own words in the interview; no category required an empty declaration.

Two scope notes on what was deliberately left out despite being read in full to reach EOF (chunks 1-7 of 7):
1. The cached document is the full Issue XVI newsletter, not just the Greenblatt piece: after Greenblatt's interview ends (~line 1747) the same .txt continues with a full separate interview of Loews Corporation's Jim Tisch and Joe Rosenberg (~lines 1759-2989) and a group interview with Royce & Associates' Chuck Royce, Charlie Dreifus, Whitney George and Buzz Zaino (~lines 2991-4096), plus newsletter boilerplate to EOF at line 4176. Per the task's instruction to extract only Joel Greenblatt's own words, none of that later material was drawn on for quotes, patterns, directives, concepts, or metrics above, even though it was read.
2. Within the Greenblatt interview itself, the "Page 13" span (~lines 1637-1751, covering the Success Academy discussion and closing remarks) is corrupted by the PDF-to-text conversion: two print columns were merged word-fragment-by-word-fragment onto single lines (e.g. line 1656 literally reads "regular public schools, all of JG: If you want to get good", splicing two unrelated columns together), so no reliably contiguous verbatim quote could be pulled from that span. It was read but intentionally not quoted, rather than risk a misquote.
