---
slug: graham-lectures-1946-47-lecture-04
investor: graham-dodd
url: https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture4.pdf
wordCount: 7188
chunksRead: 1 of 1
coverage: 100%
---
## Verbatim quotes
> "investment in apparently undervalued common stocks can be carried on with a fair degree of over-all success, provided average alertness and good judgment are used in passing on the future prospect question" @line 19
> "it was not our conclusion that the level of one-eight-five was statistically very high. The conclusion, was that it was historically very high. That is quite a difference." @line 30-31
> "in bear markets securities sell for less than they are worth, just as they sell for more than they are worth in bull markets" @line 49
> "for the investor it is better to have his money invested than it is to feel around for the bottom of the securities market" @line 53
> "Our purpose tonight is to start our discussion of the factor of future earnings in the analysis of securities." @line 72
> "past earning power is certainly definite enough and it should mean the average earnings over a stated period which would ordinarily be identified in the discussion" @line 87
> "would be a five-year period, and that when we speak of future earning power of a company, we should have in mind ordinarily the average earnings over the next five years" @line 95-97
> "I think that represents a very dangerous kind of thinking in Wall Street, and one which the security analyst should get as far away from as he can" @line 136
> "The concept that investment value is dependent upon expected future earnings is undoubtedly a more persuasive and a more logical one than thinking of value in relation to past earnings only" @line 209
> "the element which is determinative of value, the future earnings, is just the thing which he cannot analyze with any real feeling of assurance as to the correctness of his conclusions" @line 217
> "there tends to be a rough relationship or continuing connection between past earnings and future earnings" @line 221
> "where the past margin of safety that you demand for your security is high enough, in practically every such case the future will measure one" @line 237
> "you go back to the earnings of a past year which you think will correspond to a typical future year and arrive at the figures that way" @line 408-409

## Question patterns found
- **pattern**: How does the analyst project forward-looking sales or revenue figures when historical data may not represent normal future conditions? — askWhen: valuing going concerns with post-war reorganization or abnormal recent sales, anchor: business-model
  > "We believe however, even giving consideration to normal retail business, that the chain can reasonably be anticipated to average sales of $18-million, which was the amount realized in 1945 by the 53 restaurants" @line 405-406

- **pattern**: When multiple parties (SEC, trustees, common stockholders) disagree on key forward estimates, on what grounds does the analyst judge which estimate merits weight? — askWhen: during reorganizations or valuations where interested and disinterested parties propose different futures, anchor: business-model
  > "They would say that the SEC is competent and impartial; that their guess is probably a better guess than one advanced by an interested party such as a common-stock holder." @line 418-419

- **pattern**: For a business with relatively stable cost-of-goods-sold percentages, how does a change in the absolute price level (inflation/deflation) affect the percentage margins and total volume? — askWhen: valuing businesses where input costs are volatile but historically tracked as a percentage of sales, anchor: business-model
  > "In other words, give them a price level, they work both their costs and selling prices up and down accordingly." @line 443

- **pattern**: Should the analyst estimate future earnings before or after income taxes, and does this choice materially affect valuation conclusions? — askWhen: during SEC-style valuations or when comparing analyst methods across firms, anchor: business-model
  > "There has been a great deal of discussion in academic circles on the incidence of the corporation tax, -- as to whether it is really paid by the consumer or whether it is paid by the prosperous corporation" @line 477-479

## Search directives found
- **directive**: When projecting future business volumes or sales, locate and study the historical record of a stable or representative past year rather than accept management's estimate of future performance uncritically. — queryShapes: historical sales by year for <COMPANY>; prior-year unit volumes; comparable <INDUSTRY> chain results, sourcePriority: audited historical financial data for the company and peer companies in the same industry
  > "Rather than take a figure completely out of the air, you go back to the earnings of a past year which you think will correspond to a typical future year and arrive at the figures that way." @line 407-409

- **directive**: Study the spread between what a market prices a security at and what the business fundamentals (earnings, margins, assets) indicate it should be worth; then look for the psychological or temporal factor explaining the gap. — queryShapes: price of <SECURITY> vs. estimated valuation; earnings multiple for <COMPANY> vs. <INDUSTRY> average; market level vs. historical average valuation, sourcePriority: market quotations and prior SEC valuations or court cases in the same industry
  > "The difference between 14 and 140 meant that the market believed that the prospects for Dow Chemical were very good and those for Distillers Seagrams were indifferent or worse than that." @line 132-134

## Concepts found
- **title**: Margin of Safety — question: Given a company's past earnings and its current price, how much room does the analyst have if the future turns out less favorable than assumed?, test: Compare the historical earnings multiple to the premium (or discount) at which you would buy; require high-grade securities to offer large earned income relative to price so that deterioration in business still leaves earnings coverage., evidence: High past earnings relative to price, or sustained earnings even in adverse conditions, indicate adequate margin; any company reliant on optimistic future developments to justify its price lacks it., anchor: business-model
  > "where the past margin of safety that you demand for your security is high enough, in practically every such case the future will measure one. This type of investment will not require any great gifts of prophesy" @line 237-239

- **title**: Continuity Principle — question: If future earnings (not past earnings) determine value, how can an analyst build conviction when the future is unknowable?, test: Look for evidence of a continuing connection between past and future earning power, evidenced by stable business models, industry position, and management track record., evidence: When past earnings show consistency and the company's competitive position is durable, assume future earnings will track the past absent specific adverse developments., anchor: business-model
  > "While it is true that it is the expected future earnings and not the past that determines value, it is also true that there tends to be a rough relationship or continuing connection between past earnings and future earnings." @line 221-223

- **title**: Future Earning Power (defined) — question: What time horizon should the analyst use when estimating a company's earning capacity?, test: Calculate average earnings expected over the next five years, adjusted for any abnormal conditions (war aftermath, boom cycles); apply a realistic multiple based on industry and quality., evidence: Five-year forward average earnings, capitalized at a defensible multiple, gives a rational intrinsic value against which to compare market price., anchor: business-model
  > "You all know, of course, that the dependability of past earnings as a guide to the future is sufficient to make it possible to rely almost exclusively on them in the selection of a high grade investment" @line 227-229

## Metrics found
- **name**: Earnings capitalization rate / earnings multiple — formula: Market price ÷ estimated future average earnings (usually next five-year average); or stated as reciprocal (1 ÷ capitalization rate = multiple), reading: A company priced at 14x earnings suggests the market has modest confidence in future business; one at 140x suggests extraordinary confidence. The analyst must judge whether the future justifies the multiple; a company with identical past earnings at 14x and 140x likely reflects different psychological beliefs about durability and growth, not different economic facts., anchor: business-model
  > "The stock that was selling at 140 was Dow Chemical; the one that was selling at 14 was distillers Seagrams. Obviously, the difference between 14 and 140 meant that the market believed that the prospects for Dow Chemical were very good" @line 130-133

- **name**: Profit margin percentage (cost of goods sold and operating expense ratio) — formula: Operating profit ÷ total sales; or cost of goods sold ÷ sales (as percentage), reading: A restaurant chain with 34.7% merchandise costs in 1938 and 38.5% in 1945 shows rising cost pressures. In a business where price increases pass through to customers, this ratio should stabilize once a new price level equilibrates; the analyst should not assume permanent margin compression or expansion., anchor: business-model
  > "Child's merchandise costs have risen from 34.7 per cent in 1938 to 38.5 per cent in 1945." @line 451

## Nothing-found notes
- none — all categories populated
