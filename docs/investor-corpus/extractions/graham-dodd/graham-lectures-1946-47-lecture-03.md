---
slug: graham-lectures-1946-47-lecture-03
investor: graham-dodd
url: https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture3.pdf
wordCount: 3714
chunksRead: 1 of 1
coverage: 100%
---
## Verbatim quotes

- > "Lifo is an accounting method, permitted by new income-tax regulations beginning about 1942, under which instead of considering that the first purchased merchandise is sold or used up in manufacture, the corporation is permitted to assume that the last purchased merchandise is sold or used up." @p.1

- > "What you have, then, in the balance sheets is either an understatement of the true value of the inventory, if you want to consider it that; or a cushion to absorb declines in inventory values without effecting a cash loss if you wish more conservatively to consider Lifo that way." @p.1

- > "the main factor affecting this company, that does not affect other companies, is its large interest in an affiliated railroad which is not shown in its income account, except in the form of dividends." @p.2

- > "In the period 1936-1940 there would be no substantial change, because the Burlington paid out practically all that it earned in that period." @p.2

- > "But when you take the war period 1941-1945, you find that to the $6.20 average shown by Northern Pacific there is to be added $3.80 per share in undistributed profits of Burlington; about 86 cents per share representing the earnings of S.P. & S.; and about 60 cents per share representing the land department -- giving you a total of $11.46" @p.2

- > "Thus you find that there is what used to be called a "hidden equity" of about $26 a share additional in those five years, making a total of about $53 that has gone back into the stockholders' account for Northern Pacific as compared with the pre-war period." @p.2

- > "If you look at the Burlington you will see that its own undistributed profits show up in a considerable reduction in funded debt, a reduction of 36 per cent in fixed charges, and a considerable increase in working capital." @p.2

- > "Those of you who have studied our text on Security Analysis will recall our reference to the "net deductions method" in which you replace fixed charges by a figure representing the difference between the net after taxes and the balance for stock." @p.5

- > "These are factors which I am calling to your attention because they do not enter generally into the analytical presentation of a railroad's showing." @p.5

- > "That it actually has a great effect on market price cannot be denied -- certainly in the field of securities that are bought by investors." @p.5

- > "Yet I must say that I have found in my own work that you can count very much more dependably upon differences of value which can be established from the earnings and expense picture than you can on those which seem to be inherent in the possibilities of the different territories." @p.7

## Question patterns

- **pattern**: When comparing peer companies, does the accounting treatment of tax benefits alter the picture of relative performance? — askWhen: two similar companies showing different reported earnings; one has tax credits or loss carrybacks, anchor: business-model
  > "Does Northern Pacific use its carry-back in the first eight months the way Southern Pacific did?" @p.3

- **pattern**: Does geographic territory growth rate materially change the investment merit versus peer comparison based on current financials? — askWhen: analyst prefers one company based on territory growth; earnings comparison shows opposite ranking, anchor: business-model
  > "since Southern Pacific is so largely in the Southwest, Texas, in a territory that is growing much more rapidly that the Northwest territory, that some rail analysts are strong in their preference for Southern Pacific on that basis over Northern Pacific." @p.6

- **pattern**: How much weight should an analyst place on future territorial growth versus measurable current earnings and expense control? — askWhen: evaluating peer railroads with different geographic exposures and current operating performance, anchor: business-model
  > "The question that was asked about the general future prospects of one territory as compared with another is certainly very relevant to analysis of railroad securities. Yet I must say that I have found in my own work that you can count very much more dependably upon differences of value which can be established from the earnings and expense picture than you can on those which seem to be inherent in the possibilities of the different territories." @p.7

## Search directives

- **directive**: Reconstruct consolidated earnings by adding undistributed profits of majority-owned affiliates not consolidated in reported statements — queryShapes: Find [COMPANY] holdings in [SUBSIDIARY]; calculate per-share equity in [SUBSIDIARY] undistributed profits; add to reported earnings, sourcePriority: financial statements showing subsidiary earnings and dividend payout; parent company equity ownership
  > "When you take the war period 1941-1945, you find that to the $6.20 average shown by Northern Pacific there is to be added $3.80 per share in undistributed profits of Burlington" @p.2

- **directive**: Analyze fixed charge coverage on a net deductions basis, including rental and equipment hire as part of total fixed obligations — queryShapes: Calculate net deductions = net after taxes minus stock balance; use inclusive of [COMPANY] rentals and hire payments; compare to gross revenues, sourcePriority: detailed equipment rental and hire line items in statements; fixed charges including all recurring obligations
  > "If you restate your fixed charge coverage by allowing for the equipment and joint facility rental payments and also put in Northern Pacific figures its share of the Burlington, you will find this situation is also true for the eight months of 1946. Southern Pacific's net deductions were $24,300,000 in eight months, which was about seven and a half per cent of gross" @p.5

- **directive**: Perform comparative peer analysis on consistent basis, matching financial structure and accounting treatments to isolate operational performance differences — queryShapes: Select peer [COMPANY] with similar capital structure; standardize both for [ACCOUNTING METHOD]; calculate operating ratios on comparable gross base, sourcePriority: standardized financial statements; industry-specific adjustments (railroads: operating vs. total income; equipment hire treatment)
  > "If we go back to the superficial earnings, you would see that before the war Southern Pacific averaged $1.27 per share for five years, 1936 to 1940, while Northern Pacific had a very small deficit. In the five years 1941 to 1945 Southern Pacific showed $12.90, against $6.20 for Northern Pacific" @p.3

## Concepts

- **title**: Hidden equity (undistributed profits of majority-owned affiliates) — question: What earnings and capital gains are retained in majority-owned subsidiaries and not reflected in parent's reported income?, test: Identify ownership percentage in affiliated companies; extract their reported earnings; calculate parent's pro-rata share; subtract actual dividends received, evidence: Subsidiary financial statements and dividend payment history; parent company's equity interest documentation, anchor: business-model
  > "Thus you find that there is what used to be called a "hidden equity" of about $26 a share additional in those five years, making a total of about $53 that has gone back into the stockholders' account for Northern Pacific as compared with the pre-war period." @p.2

- **title**: Operating ratio (net earnings as percentage of gross revenues) — question: How efficiently is management converting gross revenues into net operating earnings across different cost pressures?, test: Calculate net earnings before taxes and depreciation as percentage of gross revenues; compare year-over-year and against peers, evidence: Income statement showing gross operating revenues and net earnings before taxes; stability or deterioration trend across periods, anchor: business-model
  > "In the first eight months of 1946 the net earnings of Northern Pacific before income taxes and depreciation, were $27,700,000, or pretty nearly 20 per cent of its gross; and those of Southern Pacific were only $29,500,000, which was just about nine per cent of its gross." @p.7

- **title**: Fixed charges including equipment rental obligations — question: What is the true fixed-charge burden including all recurring lease and equipment hire commitments beyond stated interest and funded debt?, test: Enumerate fixed charges plus net equipment rental and hire payments; calculate coverage ratio using operating income before these charges, evidence: Detailed equipment rental line item; comparison of coverage calculated both ways; impact on perceived safety margin, anchor: business-model
  > "Another factor that should get attention from the security analyst in studying these railroads is the question of rentals and hire of equipment. In the ordinary way in which fixed charges are stated in the manuals, and elsewhere, you would get the impression that the coverage of fixed charges for Southern Pacific is quite a good deal better than that of Northern Pacific -- or was, let us say, up to this year." @p.5

- **title**: Dividend policy as market price determinant — question: To what extent does dividend payout rate drive market valuation independent of underlying earning power and financial strength?, test: Identify two peers with similar earnings, assets, and financial position but different dividend payout rates; compare market prices, evidence: Earnings per share comparison; dividend per share comparison; market price ratio; stability of earnings (not dividend-driven), anchor: business-model
  > "That it actually has a great effect on market price cannot be denied -- certainly in the field of securities that are bought by investors." @p.5

## Metrics

- **name**: Undistributed profits per share (affiliate adjustment) — formula: (Majority-owned affiliate's net earnings × ownership %) minus dividends received, per parent share, reading: Represents deferred capital gains and reinvested earnings accruing to parent shareholders; during war period, often exceeded reported earnings per share, anchor: business-model
  > "But when you take the war period 1941-1945, you find that to the $6.20 average shown by Northern Pacific there is to be added $3.80 per share in undistributed profits of Burlington" @p.2

- **name**: Net deductions (inclusive fixed charges as percentage of gross) — formula: (Gross revenues minus transportation and maintenance expenses minus interest and taxes) as percentage of gross revenues, reading: More conservative measure of operating margin when company has significant equipment rental obligations; allows comparison between companies with different capital structures, anchor: business-model
  > "If you restate your fixed charge coverage by allowing for the equipment and joint facility rental payments and also put in Northern Pacific figures its share of the Burlington, you will find this situation is also true for the eight months of 1946. Southern Pacific's net deductions were $24,300,000 in eight months, which was about seven and a half per cent of gross, the latter being around $320-million." @p.5

## Nothing-found notes

Culture: nothing found — lecture focuses on financial structure, accounting techniques, and competitive metrics, not organizational culture, management temperament, or corporate principles.
