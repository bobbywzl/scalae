---
slug: graham-lectures-1946-47-lecture-10
investor: graham-dodd
url: https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture10.pdf
wordCount: 6500
chunksRead: 1 of 1
coverage: 100%
---
## Verbatim quotes
- > "An investment operation is one which, on thorough analysis, promises safety of principal and a satisfactory return." @line 44
- > "Speculation, I imagine, is a theme almost as popular as love; but in both cases most of the comments made are rather trite and not particularly helpful." @line 21
- > "Of the price of $38, which it averaged in 1939, we said the analyst might conclude that about $25 a share represented the investment component and as much as $13 a share represented the speculative component." @line 82
- > "General Electric will vary over a price range almost as wide as that of any secondary stock belonging in more or less the same price class." @line 139
- > "Consequently, in the General Shareholdings case, you have that typically attractive speculative combination" @line 222
- > "The fact of the matter is you would need a 70 per cent increase in the value of the Allegheny portfolio merely to be even with the market price of the common as far as asset value coverage is concerned." @line 245
- > "Intelligent speculation presupposes at least that the mathematical possibilities are not against the speculation, basing the measurement of these odds on experience and the careful weighing of relevant facts." @line 290
- > "If the probabilities, as measure by our mathematical test, are definitely in favor of the speculation, then we can transform these separate intelligent speculations into investment by the simple device of diversification." @line 303
- > "Very little has been done in Wall Street to work out these arithmetical aspects of intelligent speculation based on favorable odds." @line 315
- > "The trouble with market forecasting is not that it is done by unintelligent and unskillful people. Quite to the contrary, the trouble is that it is done by so many really expert people that their efforts constantly neutralize each other, and end up almost exactly in zero." @line 422
- > "The market already reflects, almost at every time, everything that the experts can reliably say about its future." @line 425
- > "It is a great mistake to believe that a speculation has been unwise if you lose money at it." @line 467
- > "A speculation is unwise only if it is made on insufficient study and by poor judgment." @line 468
- > "In one important respect we have made practically no progress at all, and that is in human nature." @line 513

## Question patterns
- **pattern**: What portion of this security's quoted price represents speculation versus discernible investment value? — askWhen: valuation of any security; common stocks especially where price swings widely, anchor: business-model
  > "Of the price of $38, which it averaged in 1939, we said the analyst might conclude that about $25 a share represented the investment component and as much as $13 a share represented the speculative component." @line 82

- **pattern**: What mathematical or probabilistic edge exists before committing capital to this speculative operation? — askWhen: contemplating any purchase where analysis cannot predicate a safe, certain result, anchor: business-model
  > "Intelligent speculation presupposes at least that the mathematical possibilities are not against the speculation, basing the measurement of these odds on experience and the careful weighing of relevant facts." @line 290

- **pattern**: How much balance-sheet leverage and senior-claim cushion protect against portfolio or asset-value decline? — askWhen: examining common stock of investment companies, holding companies, or leveraged vehicles, anchor: business-model
  > "At the end of 1945 the company had about $85-million of assets, and against it there were $125-million claims in the form of bonds and preferred stocks, including unpaid dividends." @line 230

- **pattern**: Can this cluster of independent speculative opportunities be diversified to make the aggregate bet an investment with favorable odds? — askWhen: assembling a portfolio where individual positions carry irreducible risk, anchor: business-model
  > "If the probabilities, as measure by our mathematical test, are definitely in favor of the speculation, then we can transform these separate intelligent speculations into investment by the simple device of diversification." @line 303

## Search directives
- **directive**: Decompose a holding-company or investment-company common stock into leverage profile, asset values, senior claims, and market-price discount; test whether the position justifies its price. — queryShapes: ["Compare <HOLDING-COMPANY> book value per share vs. market price, senior debt/preferred at par", "For <COMPANY> with <SENIOR-CLAIMS>, how much asset-value growth would recover to parity with market cap?"], sourcePriority: Balance sheets, reported senior securities, asset composition
  > "At the end of 1945 the company had about $85-million of assets, and against it there were $125-million claims in the form of bonds and preferred stocks, including unpaid dividends." @line 230

- **directive**: Chart price fluctuations of highest-grade investment securities across different market regimes to expose the speculative component embedded even in blue chips. — queryShapes: ["Track <LARGE-CAP> price range during expansion vs. recession vs. war years", "Compare earnings stability vs. price stability for <BLUE-CHIP> over a market cycle"], sourcePriority: Historical price tables, earnings records, dividend history; long-series comparison
  > "During the year 1937 alone, it declined from about 50 to 21, and the following year went down to 17." @line 119

## Concepts
- **title**: Speculative component in valuation — question: How much of a security's quoted price rests on changeable psychology versus durable economic reality?, test: Decompose price into two layers: investment value and speculative premium, evidence: Quality stocks carry embedded speculation even in blue chips; history shows wide price swings despite stable earnings, anchor: business-model
  > "Of the price of $38, which it averaged in 1939, we said the analyst might conclude that about $25 a share represented the investment component and as much as $13 a share represented the speculative component." @line 82

- **title**: Intelligent versus unintelligent speculation — question: Can an analyst distinguish sound speculation from mere guesswork through experience and calculation?, test: Measure the mathematical odds of success against the market price implied odds; only commit when odds favor the speculation, evidence: Two investments at similar prices can have radically different leverage profiles and protection, anchor: business-model
  > "One turns out to be an intelligent and the other an unintelligent speculation." @line 252

- **title**: Transformation of speculation into investment through diversification — question: Can independent speculative bets become investment-grade through portfolio assembly and the law of averages?, test: Assemble multiple uncorrelated speculations where aggregate probability favors gain, evidence: Ten such ventures with fifty-fifty odds per venture yields fifty percent aggregate return, anchor: business-model
  > "For in ten such operations you would get $50 back for an investment of $30, if you have average luck." @line 312

- **title**: Timing via valuation, not market prediction — question: Can the analyst avoid the impossible task of predicting markets by instead buying cheap and selling dear?, test: Apply security analysis to establish buy and sell zones; execute when price enters those zones, evidence: Requires no opinion on market direction; safety comes from price relative to value, anchor: business-model
  > "That sounds like timing; but when you consider it you will see that it is not really timing at all but rather the purchase and sale of securities by the method of valuation." @line 441

## Metrics
- **name**: Speculative component (in dollars and percent) — formula: Market price minus calculated investment value, reading: A large speculative component signals vulnerability to sentiment reversals; one-third of price for highest-grade stocks indicates pervasive speculation, anchor: business-model
  > "Of the price of $38, which it averaged in 1939, we said the analyst might conclude that about $25 a share represented the investment component and as much as $13 a share represented the speculative component." @line 82

- **name**: Leverage coverage — formula: Asset appreciation required to reach parity with market equity price, reading: Allegheny required seventy percent asset increase to reach market price; low coverage indicates unintelligent speculation; high coverage indicates intelligent leverage, anchor: business-model
  > "The fact of the matter is you would need a 70 per cent increase in the value of the Allegheny portfolio merely to be even with the market price of the common as far as asset value coverage is concerned." @line 245

- **name**: Mathematical odds test — formula: Probability of success measured from experience versus odds implied by market price, reading: Odds must favor the speculation before capital commits; diversification of favorable-odds independent bets yields long-term gain, anchor: business-model
  > "If the probabilities, as measure by our mathematical test, are definitely in favor of the speculation, then we can transform these separate intelligent speculations into investment by the simple device of diversification." @line 303

## Nothing-found notes
Nothing found — all required categories populated.
