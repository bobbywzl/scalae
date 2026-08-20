---
slug: factors-needed-to-make-money-in-the-stock-market
investor: schloss
url: https://valuehunter.wordpress.com/wp-content/uploads/2009/03/schloss_factors.pdf
wordCount: 554
chunksRead: 1 of 1
coverage: 100%
---

## Verbatim quotes

- > "Factors needed to- make money in the stock mar et" @line 11
- > "Price is the most important factor to use in relation to value." @line 15
- > "Try to establish the value of the company. Kemember that a share of stock represents a part of a business and is not just a piece of pape" @line 17-18
- > "Use book value as a starting point to try and establish the value of the enterprise." @line 20-21
- > "Be sure that debt does not equal 100% of the equity. (Capital and surplus for the common stock)." @line 21-22
- > "Have patience. Stocks don't go up immediately. Don't buy on tips or for a quick move." @line 24, 26
- > "Don't buy on tips or for a quick move. Let the professionals do that, if they can." @line 26-27
- > "Don't be afraid to be a loner but be sure that you are correct in your judgment." @line 29-30
- > "You can't be 100% certain but try to look for wak weaknesses in your thinking. Buy on a scale and sell on a scale up." @line 30-31
- > "Have the courage of your convictions once you have made a decision." @line 33
- > "Have a philosophy of investment and try to follow it. The above is a way that. I've found successful." @line 35-36
- > "Don't be in too much of a hurry to sell. If the stock reaches a price th you think is a fair one, then you can sell" @line 38-39
- > "often because a stock goes up say 50%, people say sell it and button up your profit." @line 39-40
- > "Before selling try to reevaluate the company again and see where the stock sells in relation to its book value." @line 40-42
- > "Be aware of the level of the stock market. Are yi= las low and P-E ratios high." @line 42-44
- > "If the stock market historically high. Are people very optimistic etc?" @line 44-46
- > "When buying a stock, I find it helpful to buy near the low of the past few years." @line 48-49
- > "A stock may go as igh as 125 and then decline to 60 and you think it attractive." @line 49-50
- > "3 years before the stock sold at 20 which shows that there is some vulnerability in it." @line 50-51
- > "Try to buy assets at a discount than to buy earnings. Earnings can" @line 53
- > "change dramatically in a short time. Usually assets change slowly." @line 62
- > "Usually assets change slowly. One has to know much more about a company if one buys earnings." @line 62-63
- > "Listen to suggestions frcem peole you respect. This doesn't mean you have to accept them." @line 65-66
- > "Remember it's your money and generally it is harder to keep money than to make it." @line 66-67
- > "Once you lose a lost of money it is nard to make it back." @line 67-68
- > "Gry not to let your emotions affect your judgment. "ear and greed are probably the worst emotions to have in connection with the purchase and sale of stocks." @line 70-72
- > "Remember the work compounding. For example, if you can make 12% . year and reinvest the moneyback,you will double your money in 6 yrs, taxes excluded." @line 74-76
- > "emember the rule of 72.Your rate of return into 72 will tell you the number of years to ccuble your money." @line 76-77
- > "Prefer stogks over bonds; ponds will limit your gains and inflation" @line 79-80
- > "Be careful of leverage. It can go against you." @line 84

## Question patterns

- **pattern**: What is the relationship between market price and the true value of a business? — askWhen: evaluating whether to buy, anchor: business-model
  > "Price is the most important factor to use in relation to value." @line 15

- **pattern**: How long should an investor typically wait for a stock position to appreciate? — askWhen: assessing holding period, anchor: business-model
  > "Have patience. Stocks don't go up immediately. Don't buy on tips or for a quick move." @line 24, 26

- **pattern**: How can an investor prevent emotional reactions from undermining investment returns? — askWhen: considering buying or selling decisions, anchor: business-model
  > "Gry not to let your emotions affect your judgment." @line 70

- **pattern**: When a stock price has already run up substantially, should the investor sell mechanically at a fixed gain, or re-underwrite the business first? — askWhen: deciding whether to lock in a large unrealized gain, anchor: sell-discipline
  > "often because a stock goes up say 50%, people say sell it and button up your profit. Before selling try to reevaluate the company again and see where the stock sells in relation to its book value." @line 39-42

- **pattern**: Is broad stock-market valuation (P/E level, historical highs, investor optimism) worth checking before deciding whether to sell a position? — askWhen: timing a sell decision, anchor: market-cycle
  > "Be aware of the level of the stock market. Are yi= las low and P-E ratios high. If the stock market historically high. Are people very optimistic etc?" @line 42-46

- **pattern**: Should an investor act on outside suggestions from people he respects, or filter them through his own judgment first? — askWhen: incorporating third-party ideas into the process, anchor: process-discipline
  > "Listen to suggestions frcem peole you respect. This doesn't mean you have to accept them." @line 65-66

## Search directives

- **directive**: Investigate multi-year stock price history to identify vulnerability and intrinsic weakness — queryShapes: historical price movements, past lows/highs, vulnerability indicators, sourcePriority: company filings, price history databases
  > "A stock may go as igh as 125 and then decline to 60 and you think it attractive. 3 years before the stock sold at 20 which shows that there is some vulnerability in it." @line 49-51

- **directive**: Examine balance sheet composition and asset-based value, not near-term earnings changes — queryShapes: book value, equity, debt levels, asset composition, sourcePriority: balance sheets, financial statements
  > "Try to buy assets at a discount than to buy earnings. Earnings can" @line 53
  > "change dramatically in a short time. Usually assets change slowly." @line 62

- **directive**: Assess broad stock market valuation levels and investor sentiment before deciding to sell — queryShapes: P/E ratios, market optimism, historical levels, investor behavior, sourcePriority: market analysis, sentiment indicators
  > "Be aware of the level of the stock market. Are yi= las low and P-E ratios high. If the stock market historically high. Are people very optimistic etc?" @line 42-46

- **directive**: When entering a position, buy near the multi-year low of a stock's own trading range rather than at an arbitrary current price — queryShapes: ["<COMPANY> price vs multi-year low", "entry price relative to 3-5 year range"], sourcePriority: price history, not analyst price targets
  > "When buying a stock, I find it helpful to buy near the low of the past few years." @line 48-49

- **directive**: Check whether a company carries leverage that could work against the position under stress, treating high debt-to-equity as a standalone red flag independent of valuation appeal — queryShapes: ["debt-to-equity for <COMPANY>", "leverage risk under downside scenario"], sourcePriority: balance sheet, debt schedules
  > "Be sure that debt does not equal 100% of the equity. (Capital and surplus for the common stock)." @line 21-22

## Concepts

- **title**: Price vs. Intrinsic Value — fundamental distinction between what the market prices an asset at versus its true business value
  > "Price is the most important factor to use in relation to value." @line 15

- **title**: Stock as Business Ownership — understanding that owning stock means owning a fractional interest in an actual operating business, not a speculative instrument
  > "Try to establish the value of the company. Kemember that a share of stock represents a part of a business and is not just a piece of pape" @line 17-18

- **title**: Asset-Based vs. Earnings-Based Valuation — contrasting approaches where assets are stable and durable while earnings can fluctuate rapidly
  > "Try to buy assets at a discount than to buy earnings. Earnings can" @line 53
  > "change dramatically in a short time. Usually assets change slowly." @line 62

- **title**: Emotional Discipline — managing fear and greed as decision-making filters to avoid destructive buying and selling patterns
  > "Gry not to let your emotions affect your judgment. "ear and greed are probably the worst emotions to have in connection with the purchase and sale of stocks." @line 70-72

- **title**: Patience and Long-Term Perspective — recognizing that stock price appreciation takes time and requires resisting the urge to trade frequently
  > "Don't buy on tips or for a quick move. Let the professionals do that, if they can." @line 26-27

- **title**: The Power of Compounding — mathematical principle that consistent returns compound over time, creating exponential wealth growth
  > "Remember the work compounding. For example, if you can make 12% . year and reinvest the moneyback,you will double your money in 6 yrs" @line 74-76

- **title**: Willingness to Stand Alone, Conditioned on Self-Correction — question: does the investor treat contrarian conviction as a virtue only when paired with an active check on his own reasoning, rather than as stubbornness for its own sake? test: does he pair "don't be afraid to be a loner" with an explicit instruction to hunt for weaknesses in his own thinking? evidence below.
  > "Don't be afraid to be a loner but be sure that you are correct in your judgment. You can't be 100% certain but try to look for wak weaknesses in your thinking. Buy on a scale and sell on a scale up." @line 29-31

- **title**: Equities Preferred Over Fixed Income as a Structural Stance — question: is a blanket preference for stocks over bonds treated as a standing rule rather than a case-by-case call? test: does the investor state the preference plainly, tied to inflation protection and return ceiling concerns on bonds? evidence below.
  > "Prefer stogks over bonds; ponds will limit your gains and inflation" @line 79-80

## Metrics

- **name**: Rule of 72 — formula: divide 72 by annual rate of return to determine years to double money; reading: clarifies long-term growth potential, bench notes: practical tool for comparing returns
  > "emember the rule of 72.Your rate of return into 72 will tell you the number of years to ccuble your money." @line 76-77

- **name**: Book Value as Starting Point — approach: use equity (capital and surplus) as baseline valuation anchor; reading: avoids circular earnings dependency, bench notes: verify debt is not 100% of equity
  > "Use book value as a starting point to try and establish the value of the enterprise. Be sure that debt does not equal 100% of the equity." @line 20-22

- **name**: Multi-Year Price Low — observation method: track a stock's lowest price over several years to identify vulnerability and realistic floor; reading: reveals whether current price is truly attractive, bench notes: detects structural weakness
  > "A stock may go as igh as 125 and then decline to 60 and you think it attractive. 3 years before the stock sold at 20 which shows that there is some vulnerability in it." @line 49-51

- **name**: 12% Compounding Doubling Period — formula as stated: reinvest returns at 12% per year to double principal in 6 years, taxes excluded, reading: worked numeric example paired directly with the Rule of 72 to make the compounding math concrete, bench notes: excludes tax drag explicitly — a caveat Schloss states himself rather than an omission
  > "if you can make 12% . year and reinvest the moneyback,you will double your money in 6 yrs, taxes excluded." @line 74-76

- **name**: Debt-to-Equity Ceiling — formula as stated: debt should not equal 100% of equity (capital and surplus for the common stock), reading: a hard qualitative ceiling used as a screening filter, not a scored ratio, bench notes: applied at the point of establishing enterprise value from book value, before any earnings-based analysis
  > "Be sure that debt does not equal 100% of the equity. (Capital and surplus for the common stock)." @line 21-22

## Other

- **buying "on a scale" and selling "on a scale up"**: Schloss's practical mechanism for managing conviction without pretending to certainty — he builds and unwinds positions incrementally as the price moves against or with him, rather than betting the full position at a single price.
  > "You can't be 100% certain but try to look for wak weaknesses in your thinking. Buy on a scale and sell on a scale up." @line 30-31

- **"harder to keep money than to make it"**: A characteristically blunt, plain-spoken aphorism that reframes the investor's job away from chasing gains and toward preserving what has already been earned — echoing the "don't lose money" ethic found across the Schloss corpus.
  > "Remember it's your money and generally it is harder to keep money than to make it. Once you lose a lost of money it is nard to make it back." @line 66-68

- **a personal, tested "philosophy" offered without hedging**: Schloss closes the numbered list by naming the whole document as simply "a way that I've found successful" — modest phrasing for what is, in effect, his entire investment philosophy distilled to sixteen plain rules.
  > "Have a philosophy of investment and try to follow it. The above is a way that. I've found successful." @line 35-36

## Nothing-found notes

No sections omitted — question patterns, search directives, concepts, and metrics all present in the source text.
