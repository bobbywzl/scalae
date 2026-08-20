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
- > "From January 1991 through September of this year, 1,765 new domestic companies were hatched on Wall Street -- a record for such a short period." @line 12-14
- > "The newcomers outnumber the entire population of the New York Stock Exchange." @line 14-15
- > "Of the recent arrivals, 831 were selling at press time for less than the prices at which they came public." @line 18-20
- > "There's a psychological benefit to tossing the bums out: The names disappear from the monthly brokerage statements; we're no longer reminded of our mistakes." @line 36-38
- > "Everybody wants these nice pretty quarters after a company comes public," says Mary Lisanti, a small-cap fund manager at Bankers Trust who frequently searches for what she calls broken IPOs." @line 51-53
- > "Of course, whether this cash does you any good in the end depends on whether the company uses it wisely or fritters it away." @line 82-84
- > "You have to be an insider, an expert, a gambler, or all three to want to put money into these shares." @line 95-97
- > "But along with the risky what-ifs are the companies that have proved themselves with several years of consistent earnings growth." @line 97-98
- > "I've contacted three experts in the field who offer their own favorite downtrodden IPOs, and I've also put together a group of my own candidates for further study" @line 103-106
- > "Robert Natale, editor of Standard & Poor's Special and Emerging Situations newsletter, says that picking from the losers' bin is not his favorite tactic, because the majority of the losers will go from worse to terrible." @line 116-119
- > "A man after my own heart, he believes in doing research first and investing later, and he doesn't rush in to buy shares from the underwriters." @line 126-128
- > "People shouldn't get caught up in the first hour of trading," he says. I couldn't agree more." @line 128-129
- > "It's the first two years, three years, five years, that really count." @line 129-130
- > "To pass his muster, a company must also have a niche -- some sort of specialized product or service -- and the capacity to expand globally." @line 135-137
- > "I can't leave this without repeating the usual Lynch disclaimer: These are not hot tips to take to the broker's office or the bank or the nearest trading desk." @line 151-153
- > "They are starting points for calling the company, getting the annual reports, quarterlies, and IPO prospectuses, and doing the research." @line 153-155
- > "Somewhere from among the 1,765 recent new issues, the future corporate giants will arise." @line 161-163

## Question patterns
- **pattern**: What makes a "bargain" IPO worth buying after it has declined from its offering price? — askWhen: valuation screening, anchor: business-model
  > "This creates a perennial opportunity for bargain hunters who rummage through the list of IPO losers." @line 65-66

- **pattern**: How can investors systematically separate solid IPO prospects from speculative failures? — askWhen: risk assessment, anchor: business-model
  > "So the first task of the bargain hunter is to narrow the field and separate the solid prospects from the ones that are counting on hopes, prayers, and miracles." @line 69-71

- **pattern**: When is the optimal time to buy fallen IPOs, and what market dynamics create these opportunities? — askWhen: market timing, anchor: business-model
  > "Because we've entered the fall selling season. That's when trees drop their leaves, and investors drop the losers from their portfolios." @line 30-32

- **pattern**: Does the newly public company have niche specialization and the capacity to scale beyond a single market? — askWhen: applying a proven external screener's qualitative filter, anchor: business-model
  > "a company must also have a niche -- some sort of specialized product or service -- and the capacity to expand globally" @line 135-137

- **pattern**: Is it better to wait past the first hours/days of trading, since the first years of a stock's public life are what actually determine the outcome? — askWhen: timing entry into a newly public company, anchor: business-model
  > "People shouldn't get caught up in the first hour of trading," he says. I couldn't agree more. It's the first two years, three years, five years, that really count." @line 128-130

## Search directives
- **directive**: Screen for debt-free companies as foundational safety filter — queryShapes: debt = 0, sourcePriority: financial statements
  > "You could start by looking for the companies that have no debt. If a company is debt-free, then at least you don't have to worry that it will default on a loan." @line 73-75

- **directive**: Identify companies trading below tangible cash value per share — queryShapes: price per share < cash per share, sourcePriority: balance sheet analysis
  > "Say a company has a million shares outstanding and $3 million in cash in the bank. That's $3 in cash per share. If the stock is selling for $2 per share, then you're in the enviable position of paying $2 to get back $3, with the company itself thrown in for free." @line 78-83

- **directive**: Filter for positive earnings and low valuation multiples among fallen IPOs — queryShapes: earnings > 0 AND p/e < 10, sourcePriority: income statement screening
  > "Add a third element to your search: From among companies that have no debt and are selling for less than cash, look for companies that actually have earnings. You can take this a step further and seek out companies whose stocks are priced at less than ten times those earnings." @line 88-91

- **directive**: Solicit and compare multiple named small-cap specialists' own bargain-IPO shortlists before doing individual research — queryShapes: ["<SMALL-CAP FUND MANAGER> broken IPO picks", "<NEWSLETTER EDITOR> emerging situations picks"], sourcePriority: named-specialist-shortlists
  > "I've contacted three experts in the field who offer their own favorite downtrodden IPOs, and I've also put together a group of my own candidates for further study" @line 103-106

- **directive**: Treat any list of candidate names (from Lynch or any expert) only as a starting point for calling the company and reading primary filings, never as an actionable tip — queryShapes: ["<COMPANY> annual report request", "<COMPANY> IPO prospectus"], sourcePriority: primary-filings-after-screening
  > "These are not hot tips to take to the broker's office or the bank or the nearest trading desk. They are starting points for calling the company, getting the annual reports, quarterlies, and IPO prospectuses, and doing the research." @line 152-155

## Concepts
- **title**: Tax-loss harvesting creates systematic undervaluation of small-cap IPOs — question/test/evidence in Lens shape
  > "It's fall, when one investor's tax loss is another's bargain buy. Some of the best values may be in last year's IPOs." @line 7-8

- **title**: IPO losers reflect multiple-year trading momentum, not fundamental deterioration — question/test/evidence in Lens shape
  > "The dropping prices create more losses, which other investors are tempted to take. The selling leads to more selling. Below $5, a stock no longer can be counted as collateral in a margin account, so the margin buyers join in with the tax-loss crowd, the portfolio managers, and the camp followers who sell because everybody else is doing it." @line 57-62

- **title**: Small-cap stocks lack research coverage and analyst follow-up post-IPO — question/test/evidence in Lens shape
  > "As a rule, they aren't followed by Wall Street analysts beyond the initial coverage that accompanies the underwriting. So information about these companies and their prospects is hard to come by." @line 43-46

- **title**: Wall Street applies asymmetrically high performance standards to newly public companies — question/test/evidence in Lens shape
  > "Even when they do know the details, the stock jockeys on Wall Street -- fund managers and so forth -- have a low tolerance for even a single stumble, or a "negative surprise," as it is called, from any new enterprise." @line 48-51

- **title**: Forced/technical selling compounds a decline beyond the fundamental deterioration — once a stock drops below a margin-eligibility price threshold, mechanical sellers (margin calls, tax-loss harvesters, momentum followers) pile on independent of the business's actual worth — test: Has the stock fallen below a common margin-collateral threshold (e.g. $5), and is the incremental selling pressure distinguishable from a fundamentals-driven reassessment?
  > "Below $5, a stock no longer can be counted as collateral in a margin account, so the margin buyers join in with the tax-loss crowd, the portfolio managers, and the camp followers who sell because everybody else is doing it." @line 58-62

- **title**: Cross-checking multiple independent expert screens converges on higher-conviction candidates — comparing several specialists' separately derived shortlists (a fund manager's, a newsletter editor's, a quant-screener's) surfaces names that show up on more than one list as a soft confirmation signal — test: Does a candidate name recur across independently constructed expert lists (e.g. Wandel & Goltermann appearing on two lists)?
  > "Wandel & Goltermann (also on Lisanti's list), and Radica Games (hand-held casino games)" @line 148-149

## Metrics
- **name**: 20-20-20 rule for IPO quality screening — formula as stated: 20% sales growth for 3+ years, 20% earnings growth, 20% debt-to-capitalization ratio, bench notes: Manish Shah's criteria for identifying structurally sound IPOs
  > "He looks for companies in the 20-20-20 club: 20 percent sales growth for three years or more, 20 percent earnings growth, and a 20 percent ratio of debt to capitalization." @line 133-135

- **name**: Price-to-earnings multiple screening at sub-10x — formula as stated: stock price must be less than 10x earnings per share, bench notes: applies only to debt-free companies also trading below cash
  > "You can take this a step further and seek out companies whose stocks are priced at less than ten times those earnings." @line 90-91

- **name**: Cash value per share compared to market price — formula as stated: cash on balance sheet divided by shares outstanding equals intrinsic per-share floor, bench notes: identifies margin of safety when price falls below cash value
  > "Say a company has a million shares outstanding and $3 million in cash in the bank. That's $3 in cash per share. If the stock is selling for $2 per share, then you're in the enviable position of paying $2 to get back $3, with the company itself thrown in for free." @line 78-82

- **name**: IPO loser ratio — formula: number of new issues trading below offering price / total new issues over a stated window, reading: 831 of 1,765 (about 47%) below offering price defines the size of the "loser list" bargain-hunting pool
  > "Of the recent arrivals, 831 were selling at press time for less than the prices at which they came public." @line 18-20

- **name**: Margin-collateral price threshold — formula: stated dollar price below which a stock stops qualifying as margin collateral, reading: the $5 threshold is the trigger point where forced/technical selling compounds a decline
  > "Below $5, a stock no longer can be counted as collateral in a margin account" @line 58-59

## Other

- **named-expert survey structure**: The column's back half is organized as a survey of three named professional stock-pickers (Mary Lisanti, Robert Natale, Manish Shah) each contributing their own screened shortlist — an unusually explicit "compare independent experts" structure rather than Lynch's single voice.
  > "Manish Shah runs a small investment company called Otiva and also publishes a newsletter, IPO Maven" @line 125-126

- **explicit disclaimer**: Lynch names his own recurring habit of disclaiming stock lists as "the usual Lynch disclaimer" — evidence he was self-aware about readers over-interpreting his mentions as recommendations, a recurring device across the Worth column.
  > "I can't leave this without repeating the usual Lynch disclaimer" @line 151-152

- **optimistic closing frame**: Lynch closes by naming now-famous companies (Home Depot, Microsoft, Apple, Federal Express) that once sat on exactly this kind of unglamorous new-issue list, reframing the "losers list" screening exercise as prospecting for future giants.
  > "It's easy to overlook the fact that Home Depot, Microsoft, Apple Computer, Federal Express, United Healthcare, and other well-known companies that are the modern leaders of their industries" @line 157-159

## Nothing-found notes
None — this column discusses valuation metrics, screening rules, and opportunistic market timing extensively. All sections yield substantive investor guidance.
