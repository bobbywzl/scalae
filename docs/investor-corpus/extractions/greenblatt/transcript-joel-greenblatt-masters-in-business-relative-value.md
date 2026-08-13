---
slug: transcript-joel-greenblatt-masters-in-business-relative-value
investor: greenblatt
url: https://ritholtz.com/2020/10/transcript-joel-greenblatt-2/
wordCount: 13098
chunksRead: 1 of 1
coverage: 100%
---

## Verbatim quotes

- > "money is fungible, so who pays the most? The depositors. Who lends money to borrowers the cheapest and with the easiest terms is who wins." @line 132
- > "The industry is competitive and it’s very leveraged. So pretty straightforward why banks are wired to get into trouble." @line 132
- > "the incentives are set-up that both the board and management are incented by the combined value of the equity and the preferred as if they’re stapled together as one security." @line 156
- > "we then align the incentives exactly how they should be, that shareholders whether the preferred or common will take all the losses, not the government." @line 168
- > "If you define value like we do, which is figure out what a business is worth and pay a lot less, that’s what I define as value investing." @line 296
- > "Ben Graham would say leave a large margin of safety, then that’s never really going to go out of style." @line 296
- > "No private equity firm buys a business because it’s a low price book or little price sales. They’re really looking at cash flows." @line 296
- > "As Buffett would always say, growth and value were tied at the hip. They’re part of the same equation, figuring out value." @line 302
- > "If you bought every company that lost money in 2019 that had a market cap over $1 billion, and so they’re about 261 of those and you bought every single one of those companies, you’ll be up 65 percent so far this year." @line 322
- > "But there are hundreds of companies with — that rhyme with them." @line 328
- > "We’re looking for causation not correlation. We’re not looking for that low price book, low price sales momentum of correlated." @line 332
- > "I have this real estate strategy, I’m just going to buy all the houses that were up the most in the last three months." @line 334
- > "although it’s correlated with good returns in the past, that’s not what I would continue doing even though it’s correlated. I’m looking for causation." @line 338
- > "Some are smart when you’re buying it below what the business is worth, and some are not so smart when you’re — let’s say borrowing money to overpay for your own stock." @line 346
- > "There’s nothing inherently good or bad about it. It depends what price they pay." @line 346
- > "They are some of the best businesses in the history that we’ve ever seen." @line 352
- > "And these are moats that are very tough to beat." @line 352
- > "most of them will have their comeuppance where eventually you have to earn money." @line 372
- > "right now the pre-tax cash flow yields of the S&P 500 is about four percent, a little under four percent." @line 394
- > "If I can buy good business cheap even better, quality matters a lot even more now than it did 30 years ago." @line 432
- > "you want to be in a good business that has a good franchise and grow for a long period of time." @line 434

## Question patterns

- **pattern**: Is this "cheap" reading built from what a private-equity buyer would actually pay for the business's cash flows, or from a low price-to-book/price-to-sales multiple that says nothing about owner earnings? — askWhen: sanity-checking a statistically-cheap screen hit before spending further diligence time on it, anchor: business-model
  > "No private equity firm buys a business because it’s a low price book or little price sales. They’re really looking at cash flows." @line 296

- **pattern**: Can we name the causal mechanism tying this correlated signal (low price/book, momentum, buyback activity, a factor label) to this specific company's future cash flows, or are we relying on a historical correlation that may already be crowded, cyclical, or arbitraged away? — askWhen: a position is being justified mainly by a factor screen or a historical pattern rather than a company-specific mechanism, anchor: business-model
  > "We’re looking for causation not correlation. We’re not looking for that low price book, low price sales momentum of correlated." @line 332

- **pattern**: When management is repurchasing stock, is the price paid below management's own honest estimate of intrinsic value, or is the company borrowing money to defend a rich price? — askWhen: reading a buyback program as a signal of management quality and capital-allocation discipline, anchor: culture
  > "Some are smart when you’re buying it below what the business is worth, and some are not so smart when you’re — let’s say borrowing money to overpay for your own stock." @line 346

- **pattern**: For an unprofitable company priced as if it will become the next dominant platform, what specific, named mechanism will let it actually earn money — and how many other companies in its peer group are being priced on the identical, unverified story? — askWhen: diligencing a richly-valued, cash-burning grower that is being compared to an established mega-cap winner, anchor: business-model
  > "most of them will have their comeuppance where eventually you have to earn money." @line 372

- **pattern**: Is a capital or incentive structure actually engineered so that equity holders absorb losses first, or does it quietly leave the downside with someone else (taxpayers, creditors, minority holders) while insiders keep the upside? — askWhen: assessing whether a proposed or existing capital/compensation structure genuinely aligns management and the board with shareholders, anchor: culture
  > "we then align the incentives exactly how they should be, that shareholders whether the preferred or common will take all the losses, not the government." @line 168

## Search directives

- **directive**: Before trusting a bank or other highly leveraged, competitive-industry name as "statistically cheap," check how thin its equity cushion actually is and who is structurally first in line to absorb losses — leverage plus competition is a structural fragility, not just a valuation discount. — queryShapes: "<BANK> tier 1 / common equity ratio history", "<BANK> capital cushion vs regulatory minimum", "<BANK> subordinated debt conversion-to-equity risk", sourcePriority: regulatory filings and capital-adequacy disclosures over sell-side "cheap vs. history" notes
  > "The industry is competitive and it’s very leveraged. So pretty straightforward why banks are wired to get into trouble." @line 132

- **directive**: When a buyback is cited as a management-quality signal, pull the company's actual repurchase price by quarter and compare it against an independent intrinsic-value estimate for that same period, rather than trusting the aggregate dollar total or share-count reduction alone. — queryShapes: "<COMPANY> share repurchase average price by quarter", "<COMPANY> buyback funded by debt issuance", "<COMPANY> buyback timing vs insider selling", sourcePriority: cash-flow-statement and press-release repurchase prices over aggregate buyback totals in earnings headlines
  > "I would look at stock by stock and see if their buybacks were made good prices relative to my assessment of value or whether we made it too high prices with borrowed money." @line 346

- **directive**: Before writing "the next Amazon/Google" into a thesis, size how many other unprofitable, richly-priced companies in the same cohort are being told the identical story, and treat a large basket-wide rally in money-losers as a market-froth read, not as confirmation of any one name's mechanism. — queryShapes: "unprofitable companies market cap over $1B total return YTD", "<SECTOR> loss-making peer basket performance <YEAR>", "<COMPANY> disclosed path to profitability mechanism", sourcePriority: company unit-economics/10-K risk factors and basket-level return data over growth-narrative sell-side notes
  > "If you bought every company that lost money in 2019 that had a market cap over $1 billion, and so they’re about 261 of those and you bought every single one of those companies, you’ll be up 65 percent so far this year." @line 322

## Concepts

- **title**: Causation over correlation as the screen for any factor — question: does this statistically-associated signal (low price/book, momentum, buybacks, a "value" or "quality" label) have a named causal link to this specific company's future cash flows, or is it a historical correlation that could be cyclical, crowded, or already arbitraged away?; test: require the analyst to state the mechanism in owner-earnings terms before relying on any screen result — a pattern that "has always worked" is not itself a reason it keeps working; evidence: the real-estate-momentum analogy and the causation/correlation statement
  > "although it’s correlated with good returns in the past, that’s not what I would continue doing even though it’s correlated. I’m looking for causation." @line 338

- **title**: Value is business-worth-minus-price, not a multiple — question: is "cheap" here measured against an estimate of what the business is actually worth on a private-equity-style cash-flow basis, or only against a low price-to-book/price-to-sales ratio that no buyer of the whole business would rely on?; test: rebuild the case the way a private-equity buyer would (cash flows, growth, durability) and discard the "value" label if it rests on the ratio alone; evidence: the private-equity-buyer quote and the "figure out what a business is worth and pay a lot less" definition
  > "If you define value like we do, which is figure out what a business is worth and pay a lot less, that’s what I define as value investing." @line 296

- **title**: Smart vs. dumb capital allocation is a price question, not a buyback-or-not binary — question: did management repurchase stock below its own honest estimate of intrinsic value (value-accretive), or borrow to defend a rich price (value-destructive)?; test: compare each disclosed repurchase price to an independently built intrinsic-value estimate for that same period, rather than scoring buybacks generically as good or bad; evidence: the buyback smart/dumb quote and the "depends what price they pay" line
  > "There’s nothing inherently good or bad about it. It depends what price they pay." @line 346

- **title**: Eventual comeuppance for unprofitable "rhymers" — question: among a crowd of unprofitable companies priced as the next dominant platform, which ones have no named path to actually earning money — marking them for comeuppance rather than survival — versus the small set of real moats that earned their premium?; test: separate the handful of dominant, cash-generative moats (not to be fought on valuation grounds alone) from the much larger basket of money-losing "rhymers" priced on the same story, and track whether each rhymer ever names a profitability mechanism; evidence: "some of the best businesses" vs. "hundreds of companies... that rhyme with them" and the comeuppance line
  > "But there are hundreds of companies with — that rhyme with them." @line 328

## Metrics

- **name**: Pre-tax free cash flow yield vs. S&P 500 (relative-value screen) — formula as stated: a company's pre-tax cash flow yield (cash flow / price) measured against the S&P 500's aggregate pre-tax cash flow yield (about four percent at the time of this interview) and against each candidate's growth rate; reading: a name clears Greenblatt's relative-value bar either by yielding at/above the index with equal-or-better growth and fundamentals, or by yielding below the index but justified by materially higher growth; bench notes: must be built from a cleansed, owner-earnings-style cash flow figure, never an EBITDA-family number — anchor: business-model
  > "right now the pre-tax cash flow yields of the S&P 500 is about four percent, a little under four percent." @line 394

- **name**: Unprofitable-cohort return as a froth gauge (261 loss-makers, +65% YTD) — formula as stated: the equal-weighted, buy-and-hold return of every US-listed company with market cap over $1 billion that lost money in the prior fiscal year (261 names in the 2019 cohort cited); reading: a large, broad-based rally in this basket is Greenblatt's evidence of speculative froth in "story" stocks, distinct from and not an argument against the small set of moat-protected mega-caps he considers fairly priced; bench notes: a market-regime/breadth context check, not a per-security ratio — use to flag frothy conditions around a specific unprofitable candidate, never as a buy signal on its own — anchor: business-model
  > "If you bought every company that lost money in 2019 that had a market cap over $1 billion, and so they’re about 261 of those and you bought every single one of those companies, you’ll be up 65 percent so far this year." @line 322

## Nothing-found notes

All five required categories found sufficient material; none is empty. Two scope notes for synthesis: (1) roughly the first half of this transcript is Greenblatt discussing his policy book "Common Sense" — charter schools, alternative certification, bank capital regulation, Social Security/retirement savings, skilled immigration — which is societal/policy commentary, not per-ticker business-model or culture evidence, so it was left out of the extraction above in favor of the value-investing back half (bank economics at @line 132 is the one piece of that front half kept, because it doubles as a business-model statement about leveraged competitive industries generally). (2) Greenblatt's culture-anchored material here is thin and indirect — he does not describe a method for reading a target company's internal culture; the culture-anchored entries above are inferred from his commentary on incentive/capital-structure design (the bank-preferred-stock proposal) and on buyback capital-allocation discipline, the closest analogues in this transcript to a management-quality lens.
