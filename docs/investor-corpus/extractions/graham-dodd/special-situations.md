---
slug: special-situations
investor: graham-dodd
url: https://valuehunter.wordpress.com/wp-content/uploads/2009/05/special-situations.pdf
wordCount: 3168
chunksRead: 1 of 1
coverage: 100%
---

## Verbatim quotes

- > "The period 1939-1942 was a heyday for operators in special situations and under- valued securities." @line 9-10
- > "By 1942 many in Wall Strect had come to believe that the only real and dependable income was to be made in special situations." @line 18-19
- > "As usually happens, this generalization proved wide of the mark." @line 19-20
- > "In the broader sense, a special situation is one in which a particular development' is counted upon to yield a satis- - factory profit in the security even though the" @line 27-30
- > "In the narrow sense, you do nat have a real "'speeial situation"? unless the particular development is already under way." @line 37-38
- > "This distinction ix readily apparent by reference to the wide fields of bankrupt corporations and preferred stueks with large back dividends." @line 40-41
- > "Many practitioners will say that a company in trusteeship does not constitute a special situation until a reorganization plan has actually heen submitted" @line 42-44
- > "By doing so we are able to conceive of these commitments in terms of an expected annual return on the investment." @line 52-53
- > "the final figure bears little resemblance to the bond yields taken out of a basis book." @line 53-55
- > "This experience illustrates one pleasing aspect of the _special situation operation, which is that if your deal w orks out you are sure to. make a profit, but if it doesn't, you may still make a profit." @line 128-130
- > "In the recent Ray- theon-Submarine Signal merger, one could buy Submarine Signal and sell Raytheon on announcement at an indicated spread of about 18%." @line 142-144
- > "That arbitrage was success- fully consummated within sixty days." @line 144-145
- > "There are, of course, various hazards involved in all these arbitrages. They include possible rejection by stockhoklers; possible legal action by minority holders; possible disapproval by the S.E.C., ete." @line 157-159
- > "The experienced analyst knows that the chanee of ultimate less diminishes to the extent that the preferred stock is cushioned hy the presence of a proportionately large common stock equity." @line 195-197
- > "We must recognize here an inherent weakness in this type of operation." @line 194-195
- > "In such cases the amount of cash to be realized for the assets, less the corporate liabilities and expenses, is subject to estimation and consequent error." @line 249-251
- > "In general, the market undervalues a litigated claim as an asset and overvalues it as a liability," @line 267-268
- > "Their unique feature is that the profit in them depends upon the principle that a holding company is worth more dead than alive" @line 277-279
- > "Thus the hazard in exploiting these breakup situations grows largely out of the uncer- tain time clement, with the attendant possibility of an unfavorable change in market conditions before the distributions are received." @line 306-308
- > "The essence of a special situation is an expected corporate market) development, within a time period estimable in the light of past experience." @line 327-328
- > "here, as almost_everywhere else i i rience is a major factor in lasting success; it must be supplemented by careful study of each situation and the possession of sound thou ewhat specialized judgment." @line 330-337
- > "Special situations, as we define them, appeal mightly to one class of temperament for the very reason that they leave other people cold." @line 333-334
- > "They lack industrial glamor, speculative dynamite, or more sober growth prospects." @line 335-336
- > "In this sense they occupy an interesting middle ground between security purchases for ordinary speculation or investment and security purchases for resale." @line 338-339

## Question patterns

- **pattern**: In a special situation, how should an investor calculate the expected annual return accounting for both the chance of success and the magnitude of potential loss? — askWhen: evaluating reorganization, recapitalization, or merger opportunities; anchor: business-model
  > "If we are willing to make the necessary assumptions, the attractiveness of any given | special situation can be expressed as an indicated annual return in per cent with allow- ance for the risk factor." @line 61-62

- **pattern**: What distinguishes a true special situation from merely an undervalued security? — askWhen: screening securities for investment; anchor: business-model
  > "In the narrow sense, you do nat have a real "'speeial situation"? unless the particular development is already under way." @line 37-38

- **pattern**: How do timing horizons differ across special situation categories, and what does this mean for risk management? — askWhen: comparing arbitrage opportunities across sectors; anchor: business-model
  > "lt will be noted that the industrial, utility and rail arbitrages fall respectively into three distinct classes with regard to the time clement." @line 160-161

- **pattern**: Between two preferred stocks each awaiting a cash pay-out plan, which offers better downside protection — the one with a higher percentage of common-stock equity cushion beneath it, or the one that currently pays a dividend and has an announced plan on file? — askWhen: comparing two similar special-situation preferred stocks with differing risk profiles, anchor: business-model
  > "Thus he should fect differently as reyurds Cities Service Ist Preferred selling at 132, with total claim of 181 (or 193 at call price), as compared with American Power and Light 80 Preferred selling at 147 with a total claim of 145 (or i60 at call price)" @line 200-202

- **pattern**: Does the market systematically misprice a security whose value hinges on pending litigation — undervaluing the claim when it is an asset to the holder, and overvaluing it when it is a liability? — askWhen: evaluating litigated securities (damage suits, disputed tax liabilities, appeals from reorganization plans), anchor: business-model
  > "In general, the market undervalues a litigated claim as an asset and overvalues it as a liability, Hence the students of these situa- tions often have an opportunity to buy into them at less than their true value" @line 267-270

## Search directives

- **directive**: Examine corporate reorganizations and recapitalizations for back-dividend securities and preferred stocks pending cash payment plans — queryShapes: ["<COMPANY> preferred stock back dividends recapitalization", "bankruptcy reorganization plan <COMPANY> when-issued", "utility holding company break-up distribution"], sourcePriority: SEC filings and reorganization announcements
  > "This distinction ix readily apparent by reference to the wide fields of bankrupt corporations and preferred stueks with large back dividends." @line 40-41

- **directive**: Identify litigated securities where market sentiment may be depressing value relative to potential legal outcome — queryShapes: ["<COMPANY> litigation damage suit appeal", "disputed tax liability <COMPANY> income", "minority shareholders suit <COMPANY>"], sourcePriority: Court filings and litigation records
  > "There are fairly numerous cases in which the value of a security depends largely on the outcome of litigation." @line 259-260

- **directive**: Compute the market-value ratio of common stock equity backing each dollar of a preferred stock's claim to compare downside cushioning across competing pay-out candidates — queryShapes: "<COMPANY> preferred stock total claim vs common equity market value", "common stock market value per dollar of preferred claim <COMPANY>", "cushion ratio preferred stock cash payout candidates"; sourcePriority: balance sheet claim data, market capitalization of junior common stock
  > "cach dollar paid for Cities Service Preferred is now (October 5th) backed by | $1.20 in market value of common stock: while each dollar paid American P. & L. Preferred is backed by oniy 20 cents of common stock." @line 208-212

- **directive**: When evaluating a merger/recapitalization arbitrage, check whether the ability to borrow the target stock (short-sale mechanics) is actually available under current margin-trading rules before assuming the spread is capturable — queryShapes: "<COMPANY> arbitrage spread stock borrow availability", "margin trading restrictions arbitrage feasibility", "short sale borrow constraint merger arbitrage"; sourcePriority: exchange margin rules, prime broker stock-loan availability
  > "Such operations have as a pre- requisite the ability to borrow the stock for the duration of the arbitrage. Under present conditions of no margin trading, such borrowing 18 so difficult as to prevent maby (though not all) of these deals." @line 149-151

## Concepts

- **title**: Margin of safety through corporate development certainty — question: Is the profit opportunity grounded in a specific, already-underway corporate action rather than mere market recovery? test: Verify that a particular development has been formally announced or a formal plan filed; evidence in Lens shape: The narrower definition requires reorganization to show an actual plan, not just organizational insolvency
  > "In the narrow sense, you do nat have a real "'speeial situation"? unless the particular development is already under way." @line 37-38

- **title**: Asymmetric return structure in failed deals — question: Can an investor profit even if the target corporate action fails? test: Examine whether the underlying security has appreciated independent of deal success; evidence: In bankruptcy reorganization arbitrage, failed plans still generated profits
  > "This experience illustrates one pleasing aspect of the _special situation operation, which is that if your deal w orks out you are sure to. make a profit, but if it doesn't, you may still make a profit." @line 128-130

- **title**: Security cushioning in cash pay-out situations — question: How much common stock equity backs each unit of preferred stock claimed in a cash-out? test: Calculate the ratio of total common stock market value to total preferred claims; evidence: Comparing preferred stocks with different levels of common stock backing shows how cushioning determines downside protection
  > "The experienced analyst knows that the chanee of ultimate less diminishes to the extent that the preferred stock is cushioned hy the presence of a proportionately large common stock equity." @line 195-197

- **title**: "Worth more dead than alive" as the driver of holding-company breakup value — question: does the sum of a holding company's separable component securities exceed the value of the parent company's own securities, creating a structural profit from dissolution?, test: compare the estimated aggregate distributable value of the components against the pre-breakup market price of the parent's securities, watching for the paradox that stocks of holding companies fighting dissolution are depressed by that fight and rise once they lose it., evidence: Graham's explicit description of the paradoxical price action in utility holding companies contesting Section 11 breakups.
  > "Their unique feature is that the profit in them depends upon the principle that a holding company is worth more dead than alive- "i.¢., that its separa will sel! for more than the parent company securitics." @line 277-279

- **title**: Systematic mispricing of litigated claims (asymmetric market bias) — question: does the market's discomfort with legal uncertainty produce a predictable bias — undervaluing a contingent asset claim and overvaluing a contingent liability claim — that a patient analyst can exploit?, test: identify securities whose value is dominated by pending litigation (damage suits, disputed tax liability, reorganization appeals) and compare the implied market discount against the analyst's own estimate of litigation-adjusted expected value., evidence: Graham names concrete named examples (International Hydro Electric, Inland Gas Co., Gold and Stock Telegraph, Pittsburgh Incline Plane, St. Louis Southwestern Ry., New Haven R.R.) across damage suits, tax disputes, and reorganization appeals.
  > "In general, the market undervalues a litigated claim as an asset and overvalues it as a liability, Hence the students of these situa- tions often have an opportunity to buy into them at less than their true value, and to realize attractive profits—-on the average—when the litigation is disposed of." @line 267-270

- **title**: Special situations as a distinct temperament, not a universally appealing category — question: why do special situations attract only "one class of temperament" rather than broad investor interest, given their favorable risk/return math?, test: contrast the special-situation operator's inventory-management mindset (average profit, average holding period, calculated in advance like a merchant) against the glamour-seeking or growth-seeking mindset of ordinary speculators/investors., evidence: Graham's explicit statement that these situations "leave other people cold" precisely because they lack glamour, speculative dynamite, or growth-story appeal.
  > "Special situations, as we define them, appeal mightly to one class of temperament for the very reason that they leave other people cold. They lack industrial glamor, speculative dynamite, or more sober growth prospects." @line 333-336

## Metrics

- **name**: Indicated annual return on special situations — formula: [G×C − L×(100%−C)] / Y / P, where G = expected gain in points on success, L = expected loss in points on failure, C = expected chance of success as percentage, Y = expected holding time in years, P = current price — reading: Graham applies this to Metropolitan West Side Elevated 5s selling at 23, with expected 12-point gain if successful (67% chance), 7-point loss if unsuccessful (33% chance), over one-year holding period, yielding 24.7% indicated return; bench notes: Formula incorporates both success probability and downside magnitude, distinguishing special-situations analysis from simple yield mathematics
  > "Note that the formula _allows_for the chance unc 1 the amount of possible loss." @line 93

- **name**: Merger-arbitrage spread percentage — formula: (short-side proceeds minus long-side cost) ÷ long-side cost, expressed as a percentage, measured at announcement and realized at consummation; reading: Raytheon-Submarine Signal merger arbitrage offered an indicated spread of about 18%, consummated within sixty days; the General Cable Recapitalization Plan offered a spread of about 13%, consummated in 46 days; bench notes: both examples show short holding periods (weeks) typical of industrial-class arbitrages versus the multi-year horizon of rail reorganizations.
  > "one could buy Submarine Signal and sell Raytheon on announcement at an indicated spread of about 18%. That arbitrage was success- fully consummated within sixty days." @line 143-145

- **name**: Cash pay-out expected profit percentage plus carry — formula: (redemption value minus market price) ÷ market price, plus an annualized interest carry for the duration of the operation; reading: Central and Southwestern Utilities 2nd Preferred redemption value was $220/share against a market price of $185, an expected profit of 19% plus about 3% per annum interest carry; bench notes: pairs the point-spread capture with an explicit carry component, since the payout timeline runs through multiple approval hurdles (SEC, court, underwriting).
  > "The current redemption value was $220 per share, against the market price of 185. Thus the expeeted profit would be 19%, plus interest at about 3% per annum for the duration of the operation." @line 186-188

- **name**: Common-stock cushion ratio for preferred cash pay-outs — formula: market value of common stock equity backing the issuer, divided by the preferred stock's total claim value (including accrued back dividends), stated as dollars of common backing per dollar of preferred claim; reading: Cities Service 1st Preferred was backed by $1.20 of common stock market value per dollar of preferred claim, versus only $0.20 for American Power and Light Preferred; bench notes: Graham uses this ratio directly to predict — correctly, per the sequel note — that Cities Service Preferred would "fare the better of the two" if market weakness delayed either payout plan.
  > "cach dollar paid for Cities Service Preferred is now (October 5th) backed by | $1.20 in market value of common stock: while each dollar paid American P. & L. Preferred is backed by oniy 20 cents of common stock." @line 208-212

## Other

- **The article's own "Sequel" annotations tracking real outcomes**: This Analysts Journal piece is unusual among Graham's writings in that it was later annotated with bracketed "[Sequel: ...]" notes reporting what actually happened to each named example — the Metropolitan West Side Elevated bonds recovered 33¼ in cash, the Central & Southwestern Utilities preferred holders received $228, the American Power & Light plan was withdrawn (proving the weaker cushioned position fared worse, exactly as predicted), and the Cities Service Preferred was exchanged for bonds worth $157/share — giving a rare documented after-the-fact scorecard of Graham's own special-situation calls.
  > "(Sequel: The purchase was effected, and the bondholders have since reeeived 3314 in cash, retaining also ‘stubs " currently worth about 3.]" @line 94-95

- **Named real companies as the article's evidentiary spine**: Rather than staying abstract, Graham grounds every category in specific, named 1940s securities — Metropolitan West Side Elevated bonds, Raytheon/Submarine Signal, General Cable, United Corporation, American Superpower, United Light & Power, Central and Southwestern Utilities, Cities Service, American Power and Light, Luther Mfg. Co., Ogden Corp., Brewster Corp., Philadelphia Co./Standard Gas and Electric, Delaware and Hudson — giving the piece a documentary, case-study texture distinctive among his more theoretical writings.
  > "Recent examples are United Corporation and American Superpower." @line 154-155

- **The merchant-inventory analogy for special-situation temperament**: Graham closes by comparing the special-situation operator's mindset explicitly to that of a merchant managing inventory — calculating average profit and average holding period in advance — a vivid trade-based metaphor for a discipline he otherwise describes in formula and probability terms.
  > "they do afford the analyst an opportunity to deal with security Values very much as the merchant deals with his inventory, calculating in advance his average profits and his average holding period." @line 341-344
