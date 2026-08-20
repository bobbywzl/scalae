---
slug: graham-the-mysteries-of-the-stock-market
investor: graham-dodd
url: https://novelinvestor.com/graham-mysteries-stock-market/
wordCount: 1221
chunksRead: 1 of 1
coverage: 100%
---

## Verbatim quotes

- > "That is one of the mysteries of our business, and it is a mystery to me as well as to everybody else." @line 30
- > "We know from experience that eventually the market catches up with value." @line 30
- > "The true measure of common stock values, of course, is not found by reference to price movements alone, but price in relation to earnings, dividends, future prospects, and, to a small extent, asset values." @line 38
- > "Present concepts of common stock valuation turn largely on estimating average future earnings and dividends and applying thereto a suitable capitalization rate or multiplier." @line 40
- > "Since these elements are all matters of prediction or judgment, there is room for a wide difference of informed opinion as to the proper value for a single stock or group of stocks at any time." @line 40
- > "Uninformed or speculative opinion will, of course, cover an even wider range as the market swings from the depths of pessimism to the heights of optimism." @line 40
- > "The Dow Jones industrials are now at a lower ratio to their average earnings in the past than they were at their highs in 1929, 1937, and 1946." @line 44
- > "The same applies to General Electric as an individual stock." @line 44
- > "Lower basic interest rates presumably justify a higher value for each dollar of dividends or earnings." @line 44
- > "In my view, the fundamental reason for the rise was the swing from doubt to confidence – from emphasis on the risks in common stocks to the emphasis on the opportunities in common stocks." @line 50
- > "In effect, the multiplier advanced from about 8 for the Dow-Jones industrials in 1948-50 to 10 in 1953, and to a current 14, which is slightly less than the 1936-40 average." @line 54
- > "My studies have led to the conclusion that sentiment alone, not supported by any visible change in value, will produce a swing on the order of 100 to 250 or 100 to 300 in price." @line 56
- > "When you find a special situation and you decide, just for illustration, that you can buy for 10 and it is worth 30, and you take a position, and then you cannot realize it until a lot of other people decide it is worth 30, how is that process brought about" @line 26
- > "It is clear that the issues referred to – which may be considered as reasonably representative of the larger industrials as a whole – have a considerable way to go before reaching the ratios shown at their former tops." @line 44
- > "However, such comparisons fail to take into account the extent of the subsequent declines from past bull market highs." @line 46
- > "Since the Dow-Jones average lost 90 percent of its price from 1929 to 1932, it is evident not only that 381 was much too high in 1929, but that the market had entered dangerous ground at a point far below that figure" @line 46
- > "I should like to emphasize more than he did the role of investment and speculative sentiment in determining the wide variations in stock market prices." @line 48
- > "There has been no change of importance in the earnings of the Dow-Jones industrial average since 1949." @line 52
- > "It was the mildness of the shrinkage – especially in gross national product and disposible incomes – that reversed the tide of sentiment and gave currency to the view that we no longer have to fear deep depressions." @line 52
- > "It is interesting to note that while American Telephone & Telegraph has paid a uniform dividend of $9 since 1922, and while its earnings have fluctuated comparatively little, its price advanced from 115 in 1922 to 310 in 1929, declined to 70 in 1932, and since then it has fluctuated between lows of about 110 and highs of about 200." @line 56

## Question patterns

- **pattern**: What is the true measure of a common stock's value? — askWhen: company valuation inquiry, anchor: business-model
  > "The true measure of common stock values, of course, is not found by reference to price movements alone, but price in relation to earnings, dividends, future prospects, and, to a small extent, asset values." @line 38

- **pattern**: How do sentiment swings drive valuations independently of fundamental changes? — askWhen: market euphoria or pessimism, anchor: business-model
  > "In my view, the fundamental reason for the rise was the swing from doubt to confidence – from emphasis on the risks in common stocks to the emphasis on the opportunities in common stocks." @line 50

- **pattern**: What role does informed versus uninformed opinion play in price movements? — askWhen: assessing market risk, anchor: culture
  > "Since these elements are all matters of prediction or judgment, there is room for a wide difference of informed opinion as to the proper value for a single stock or group of stocks at any time." @line 40

- **pattern**: When today's valuation multiples look low relative to prior bull-market peaks, does that comparison also account for how far those peaks subsequently fell — or only for how high they got? — askWhen: assessing whether "cheap relative to past tops" is actually a safety signal, anchor: business-model
  > "such comparisons fail to take into account the extent of the subsequent declines from past bull market highs." @line 46

- **pattern**: For a stock with a stable dividend and only modestly fluctuating earnings, how much of its price range over decades is explained by sentiment alone rather than any visible change in underlying value? — askWhen: separating price-driven risk from value-driven risk in a low-volatility-fundamentals name, anchor: business-model
  > "sentiment alone, not supported by any visible change in value, will produce a swing on the order of 100 to 250 or 100 to 300 in price." @line 56

## Search directives

- **directive**: Compare current stock prices to their historical earnings multiples across multiple prior bull market peaks to identify valuation safety margins — queryShapes: ["historical PE ratios <COMPANY> 1929 1937 1946 vs current", "earnings multiples analysis <INDUSTRY> bull market highs"], sourcePriority: reported earnings and historical price records
  > "The Dow Jones industrials are now at a lower ratio to their average earnings in the past than they were at their highs in 1929, 1937, and 1946." @line 44

- **directive**: When comparing today's multiple to a past bull-market peak's multiple, also check how far the market fell after that peak — a "still below the old top" reading is not itself evidence of safety if the old top was already in dangerous territory well before its final high — queryShapes: ["<INDEX/COMPANY> peak-to-trough decline following <YEAR> high, not just the peak multiple", "was the historical peak itself already overvalued relative to a level well below its eventual top?"], sourcePriority: full peak-to-trough price history, not peak-level multiples alone
  > "Since the Dow-Jones average lost 90 percent of its price from 1929 to 1932, it is evident not only that 381 was much too high in 1929, but that the market had entered dangerous ground at a point far below that figure" @line 46

- **directive**: Isolate how much of a broad market's price change since a given date is attributable to earnings changes versus multiplier (sentiment) changes — track the multiplier trend across multiple years to see whether the market's re-rating is proceeding steadily or accelerating — queryShapes: ["<INDEX> earnings trend vs P/E multiplier trend over the past N years", "how has the market's assigned multiplier changed year by year absent an earnings change?"], sourcePriority: reported aggregate earnings trend cross-referenced against reported multiplier/P-E trend
  > "In effect, the multiplier advanced from about 8 for the Dow-Jones industrials in 1948-50 to 10 in 1953, and to a current 14, which is slightly less than the 1936-40 average." @line 54

## Concepts

- **title**: The mystery of market timing and value realization — question: How do markets eventually recognize and price intrinsic value?, test: Does the company fundamentals eventually drive price?, evidence: Graham's observation of multi-year lags and eventual convergence
  > "That is one of the mysteries of our business, and it is a mystery to me as well as to everybody else. We know from experience that eventually the market catches up with value." @line 30

- **title**: Valuation as multifactorial and opinion-driven — question: What determines the "suitable" valuation multiple?, test: Can sentiment swings alone move prices 100-300 points without fundamental change?, evidence: Graham's 1922-1955 AT&T case showing wild price swings despite fixed dividend
  > "Since these elements are all matters of prediction or judgment, there is room for a wide difference of informed opinion as to the proper value for a single stock or group of stocks at any time." @line 40

- **title**: "Below the Old Peak" Is Not the Same as "Safe" — question: does a multiple that is still lower than a historical bull-market top actually establish that the market has margin left, or could the market already be in dangerous territory relative to a lower reference point?, test: check the full peak-to-trough decline of the historical comparison period, not just its peak level, evidence: Graham explicitly rejects the reassurance drawn from being below the 1929/1937/1946 peaks, pointing out the 1929 peak itself preceded a 90% collapse and unsafe territory was reached well before the final top
  > "Much has been made of these relationships as indicating that the market is still on safe ground. However, such comparisons fail to take into account the extent of the subsequent declines from past bull market highs." @line 46

- **title**: Sentiment Swing from Doubt to Confidence as the Primary Driver of a Rally — question: was a given market rise driven mainly by improved fundamentals, or by a shift in how the same fundamentals are perceived (doubt vs. confidence)?, test: check whether the underlying earnings actually moved, or whether only the public's assigned multiplier moved, evidence: Graham states there was "no change of importance" in Dow-Jones industrial earnings since 1949, yet the multiplier nearly doubled (8x to 14x) — attributed to sentiment, not earnings
  > "There has been no change of importance in the earnings of the Dow-Jones industrial average since 1949." @line 52

## Metrics

- **name**: Price-to-earnings ratio trend across bull markets — formula: Current stock price / earnings of preceding 1, 5, or 10 years; compare to ratios at 1929, 1937, 1946 peaks, reading: Lower ratios signal valuation safety; the 1955 market at P/E 14 was below 1936-40 average, bench notes: Graham measured earnings stability over multiple periods to smooth cyclicality; lower interest rates justify higher multiples mechanically
  > "In effect, the multiplier advanced from about 8 for the Dow-Jones industrials in 1948-50 to 10 in 1953, and to a current 14, which is slightly less than the 1936-40 average." @line 54

- **name**: Sentiment-Driven Price Swing Range, Fundamentals Held Constant — formula: observed price range (as multiple of a base, e.g. 100 to 250-300) attributable purely to sentiment when earnings/dividends show negligible change, reading: illustrated with AT&T's 1922-1955 record — a uniform $9 dividend and only modestly fluctuating earnings still saw the price move from 115 (1922) to 310 (1929) to 70 (1932) and then oscillate between roughly 110 and 200, benchNotes: this metric functions as an empirical ceiling/floor estimate for how much of any given price move should be attributed to sentiment rather than value change
  > "My studies have led to the conclusion that sentiment alone, not supported by any visible change in value, will produce a swing on the order of 100 to 250 or 100 to 300 in price." @line 56

## Other

- **The Chairman's original question is preserved verbatim, not paraphrased** — the article keeps the Senate committee chairman's exact framing (buy at 10, worth 30, waiting for others to agree) before Graham's famous non-answer, letting readers see precisely what dodge Graham was executing.
  > "When you find a special situation and you decide, just for illustration, that you can buy for 10 and it is worth 30, and you take a position, and then you cannot realize it until a lot of other people decide it is worth 30, how is that process brought about" @line 26

- **A named source citation anchors the whole excerpt to a specific government hearing** — the article closes by citing the exact Senate hearing title, chamber, congress number, and month, tying Graham's testimony to a verifiable public record rather than a secondhand account.
  > "Stock Market Study – Hearings Before the Committee on Banking and Currency, United States Senate, Eighty-Fourth Congress, First Session on Factors Affecting the Buying and Selling of Equity Securities, March 1955" @line 58

- **Graham explicitly credits and partially defers to another named expert's answer before adding his own emphasis** — rather than presenting his sentiment-driven-multiplier thesis as a lone dissenting view, Graham frames it as an addition to NYSE President Funston's prior answer to the same committee question, signaling collegial agreement with a caveat.
  > "in general I agree with the answers by President Funston, of the New York Stock Exchange, to question 1 of the committee's questionaire" @line 48

## Nothing-found notes

None — all five categories (verbatim quotes, question patterns, search directives, concepts, metrics) plus the new Other section are well-represented in Graham's testimony and prepared statement on stock market valuation.
