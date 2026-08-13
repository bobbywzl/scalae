---
slug: worth-z9411e01
investor: lynch
url: https://web.archive.org/web/20000815201628/http://www.worth.com/articles/Z9411E01.html
wordCount: 1695
chunksRead: 1 of 1
coverage: 100%
---

## Verbatim quotes
- > "There's no rush to buy shares at the outset, because there's an excellent chance they can be picked up more cheaply a few months down the road once they've started trading." @line 23-24
- > "People complain that only fat cats and institutions can get their hands on IPOs at the premarket prices, but in many cases brokerage houses are doing small investors a favor by shutting them out." @line 25-28
- > "For some reason, taking a loss is a pleasurable exercise -- many stock pickers look forward to it even though the tax break itself is no more than a partial compensation." @line 34-36
- > "One bad earnings report and the stock gets tossed out." @line 54
- > "Perfectly good businesses with excellent prospects are marked down to a fraction of their actual worth." @line 62-63
- > "This creates a perennial opportunity for bargain hunters who rummage through the list of IPO losers." @line 65-66
- > "You could start by looking for the companies that have no debt." @line 73
- > "If the stock is selling for $2 per share, then you're in the enviable position of paying $2 to get back $3, with the company itself thrown in for free." @line 80-83
- > "A company that is losing money will go through cash quite rapidly, so the next thing you want to worry about is whether it can make a living." @line 86-87
- > "Even when they do know the details, the stock jockeys on Wall Street -- fund managers and so forth -- have a low tolerance for even a single stumble, or a "negative surprise," as it is called, from any new enterprise." @line 48-51
- > "Many of them shot out of the starting gate and attracted attention. But it's a lot harder to generate good news after that first blush." @line 17-18
- > "Some names on the losers list come from biotech or high tech, and their appeal is based entirely on an invention that has yet to be tested or a wonder drug that hasn't emerged from the petri dishes." @line 93-95

## Question patterns
- **pattern**: What makes a "bargain" IPO worth buying after it has declined from its offering price? — askWhen: valuation screening, anchor: business-model
  > "This creates a perennial opportunity for bargain hunters who rummage through the list of IPO losers." @line 65-66

- **pattern**: How can investors systematically separate solid IPO prospects from speculative failures? — askWhen: risk assessment, anchor: business-model
  > "So the first task of the bargain hunter is to narrow the field and separate the solid prospects from the ones that are counting on hopes, prayers, and miracles." @line 69-71

- **pattern**: When is the optimal time to buy fallen IPOs, and what market dynamics create these opportunities? — askWhen: market timing, anchor: business-model
  > "Because we've entered the fall selling season. That's when trees drop their leaves, and investors drop the losers from their portfolios." @line 30-32

## Search directives
- **directive**: Screen for debt-free companies as foundational safety filter — queryShapes: debt = 0, sourcePriority: financial statements
  > "You could start by looking for the companies that have no debt. If a company is debt-free, then at least you don't have to worry that it will default on a loan." @line 73-75

- **directive**: Identify companies trading below tangible cash value per share — queryShapes: price per share < cash per share, sourcePriority: balance sheet analysis
  > "Say a company has a million shares outstanding and $3 million in cash in the bank. That's $3 in cash per share. If the stock is selling for $2 per share, then you're in the enviable position of paying $2 to get back $3, with the company itself thrown in for free." @line 78-83

- **directive**: Filter for positive earnings and low valuation multiples among fallen IPOs — queryShapes: earnings > 0 AND p/e < 10, sourcePriority: income statement screening
  > "Add a third element to your search: From among companies that have no debt and are selling for less than cash, look for companies that actually have earnings. You can take this a step further and seek out companies whose stocks are priced at less than ten times those earnings." @line 88-91

## Concepts
- **title**: Tax-loss harvesting creates systematic undervaluation of small-cap IPOs — question/test/evidence in Lens shape
  > "It's fall, when one investor's tax loss is another's bargain buy. Some of the best values may be in last year's IPOs." @line 7-8

- **title**: IPO losers reflect multiple-year trading momentum, not fundamental deterioration — question/test/evidence in Lens shape
  > "The dropping prices create more losses, which other investors are tempted to take. The selling leads to more selling. Below $5, a stock no longer can be counted as collateral in a margin account, so the margin buyers join in with the tax-loss crowd, the portfolio managers, and the camp followers who sell because everybody else is doing it." @line 57-62

- **title**: Small-cap stocks lack research coverage and analyst follow-up post-IPO — question/test/evidence in Lens shape
  > "As a rule, they aren't followed by Wall Street analysts beyond the initial coverage that accompanies the underwriting. So information about these companies and their prospects is hard to come by." @line 43-46

- **title**: Wall Street applies asymmetrically high performance standards to newly public companies — question/test/evidence in Lens shape
  > "Even when they do know the details, the stock jockeys on Wall Street -- fund managers and so forth -- have a low tolerance for even a single stumble, or a "negative surprise," as it is called, from any new enterprise." @line 48-51

## Metrics
- **name**: 20-20-20 rule for IPO quality screening — formula as stated: 20% sales growth for 3+ years, 20% earnings growth, 20% debt-to-capitalization ratio, bench notes: Manish Shah's criteria for identifying structurally sound IPOs
  > "He looks for companies in the 20-20-20 club: 20 percent sales growth for three years or more, 20 percent earnings growth, and a 20 percent ratio of debt to capitalization." @line 133-135

- **name**: Price-to-earnings multiple screening at sub-10x — formula as stated: stock price must be less than 10x earnings per share, bench notes: applies only to debt-free companies also trading below cash
  > "You can take this a step further and seek out companies whose stocks are priced at less than ten times those earnings." @line 90-91

- **name**: Cash value per share compared to market price — formula as stated: cash on balance sheet divided by shares outstanding equals intrinsic per-share floor, bench notes: identifies margin of safety when price falls below cash value
  > "Say a company has a million shares outstanding and $3 million in cash in the bank. That's $3 in cash per share. If the stock is selling for $2 per share, then you're in the enviable position of paying $2 to get back $3, with the company itself thrown in for free." @line 78-82

## Nothing-found notes
None — this column discusses valuation metrics, screening rules, and opportunistic market timing extensively. All sections yield substantive investor guidance.
