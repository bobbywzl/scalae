---
slug: graham-lectures-1946-47-lecture-02
investor: graham-dodd
url: https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture2.pdf
wordCount: 2336
chunksRead: 1 of 1
coverage: 100%
---

## Verbatim quotes

- > "the balance sheet comparison is a relatively simple idea. You take the equity for the stock" @line 28

- > "at the end of the period, you subtract the equity at the beginning of the period, and the difference" @line 29

- > "is the gain. That gain should be adjusted for items that do not relate to earnings, and there should" @line 30

- > "be added back the dividends paid. Then you get the earnings for the period as shown by the" @line 31

- > "In the case of Transue Williams the final stock equity was $2,979,000, of which $60,000 had come from" @line 33

- > "The Transue & Williams Company reported earnings after allowances for reserves, chiefly for renegotiation, each year" @line 49

- > "and then almost every year they charged their actual payments on account of renegotiation to the reserves" @line 51

- > "It turned out that the amounts to be charged were greater than the amounts which they provided" @line 52

- > "In the case of Buda you have the opposite situation. The Buda Company made very ample provision" @line 66

- > "for renegotiation, which they charged to earnings currently, and in addition to that they set up reserves" @line 67

- > "These apparently did not constitute in any sense real liabilities, because in July 1946 the reserves of a" @line 68

- > "Those of you who are familiar with our textbook know that we recommend "the comparative balance sheet approach" for various reasons, one of which is to obtain a" @line 16

- > "it occurred to me because I observed that early this year Transue Williams and Buda Company both sold at the same high price, namely $33 1/2 a share" @line 23

- > "buyers could easily have been misled by the ordinary procedure of looking at the reported earnings per share as they appear" @line 26

- > "so that the company actually lost $2.41 somewhere along the line" @line 38

- > "So this company did $5.17 better than it showed, if you assume that the reserves as given in the balance sheet are part of the stockholder's equity and do not constitute a liability of the company" @line 45

- > "the reserves set up by Transue and Williams, consequently, were necessary reserves for charges that they were going to have to meet; not only were they real, but they actually proved insufficient on the whole" @line 54

- > "in the case of Curtiss-Wright, if you follow this procedure, you will find that on the balance sheet basis in ten years they apparently earned $18.53 per share but the reported earnings were only $12.28" @line 95

- > "All of those extra earnings of $6.25 in ten years are to be found in the reserves set up during the last five years by the Curtiss Wright Corporation" @line 98

- > "the reported earnings for ten years were $14.08 and the indicated earnings per balance sheet were $49.84, -- a difference of about 20 per cent, or $8.77" @line 114

- > "Restoration of this last amount, of course, would not serve to increase your reported earnings, because it was not deducted before arriving at the reported earnings" @line 121

- > "if these were eliminated, instead of having a loss of $7-million for the year's operations after interest taxes, they would have had a profit of $1,800,000" @line 175

## Question patterns

- **pattern**: What exactly should be included in stockholders equity for balance sheet analysis? — askWhen: calculating earnings from balance sheet changes, determining what comprises equity, anchor: business-model
  > "By equity we mean common stock plus surplus, plus whatever reserves are regarded as equivalent of surplus" @line 78

- **pattern**: How do hidden or deferred depreciation charges affect real equity and earning power? — askWhen: comparing balance sheet earnings to reported earnings in capital-intensive companies, anchor: business-model
  > "You can very well claim that certain charges for depreciation have created equities for stock which do not" @line 83

- **pattern**: Why do companies with the same stock price show opposite earnings differences when compared using balance sheet versus reported earnings methods? — askWhen: investigating divergences between balance-sheet-derived and reported earnings, anchor: business-model
  > "If you ask the reason for the difference in the results in these two companies, you would find it" @line 48

- **pattern**: Do year-over-year swings in reported income reflect genuine operating deterioration, or do they trace to non-operating items (prior-year tax deficiencies, one-time amortization charge-offs) unrelated to current performance? — askWhen: A company's reported result swings sharply worse or better despite operating revenue moving only modestly, anchor: business-model
  > "did they really do better in 1945 than in 1944? And if they did, how was it possible for them to appear to have done so very much worse?" @line 156

- **pattern**: When a large reserve or write-off is recorded, was the charge run through the income account (reducing reported earnings) or transferred internally from surplus to reserve on the balance sheet only — and does the analyst's adjustment respect that distinction? — askWhen: Reconciling balance-sheet-derived earnings against reported earnings where reserve activity is large, anchor: business-model
  > "I hope you are all familiar with the difference between making a charge to reserves which would appear in the income account before your reported earnings, and a charge on the balance sheet only where it is transferred from surplus to reserves." @line 123

## Search directives

- **directive**: Compare balance sheet changes to reported earnings as a quality check. Compare stockholders equity changes period-to-period (adjusted for dividends and new stock sales) against reported net income. — queryShapes: ["compare <COMPANY> balance sheet equity changes", "verify <COMPANY> reported earnings by balance sheet"], sourcePriority: audited balance sheet and equity schedules
  > "First, the balance sheet comparison is a relatively simple idea. You take the equity for the stock at" @line 28

- **directive**: Carefully examine reserve accounts in war industries and reconversion companies. Track reserves year-over-year to distinguish necessary reserves (which get drawn down) from artificial contingency buffers. — queryShapes: ["list <COMPANY> reserve accounts and changes", "track <COMPANY> reserve drawdowns"], sourcePriority: balance sheet reserve detail and footnotes
  > "In the case of Transue, their reserves got up very high but the end of 1945 saw them down to" @line 71

- **directive**: For railroads and war-affected companies, focus on operating earnings (before taxes and depreciation). Extraordinary tax items, prior-year charges, and emergency depreciation distort reported earnings. — queryShapes: ["calculate <COMPANY> net before taxes and depreciation", "separate <COMPANY> operations from tax and depreciation"], sourcePriority: income statement detail and depreciation/tax footnotes
  > "For the net before taxes is a useful item, and the deprecation may well be treated separately since it is" @line 131

- **directive**: When a reserve-heavy year produces a large reported loss alongside a large tax bill, decompose the tax charge into current-year and prior-year components before drawing conclusions about current operating performance. — queryShapes: ["how much of <COMPANY>'s current tax charge relates to prior-year deficiencies?", "what portion of <COMPANY>'s depreciation charge is a one-time catch-up amortization?"], sourcePriority: tax footnotes; management's explanation of unusual charges in the annual report
  > "The first important item is that $7,406,000 of this 1945 tax represents possible tax deficiencies for previous years." @line 167

- **directive**: Distinguish reserves charged to the income account (true earnings reduction) from reserves transferred internally from surplus (no earnings effect) before restoring any reserve balance to computed "true earnings." — queryShapes: ["was <COMPANY>'s reserve increase charged to income or transferred from surplus?", "which portion of <COMPANY>'s reserve build-up reduced reported net income?"], sourcePriority: income statement and surplus reconciliation schedule in the annual report
  > "part of those reserves were charged to earnings, and therefore served to decrease the reported earnings, but somewhat less than half, $15-million, was taken out of surplus and transferred to reserve" @line 118

## Concepts

- **title**: Balance sheet reconstruction detects earnings quality issues — question: When reported net income diverges from balance sheet equity changes, which reveals truth?, test: Calculate earnings from equity changes (adjusted for dividends and new stock); compare to reported earnings; investigate discrepancies, evidence: Transue and Buda companies sold at identical prices but showed opposite earnings gaps; Curtiss-Wright showed 50 percent inflation
  > "These are the examples that I wanted to give you of comparative balance sheets for the purpose of determining what" @line 127

- **title**: Reserve classification determines whether earnings are real — question: Which reserves represent genuine liabilities versus artificial buffers to smooth reported earnings?, test: Monitor reserve accounts across years to see if drawn down for stated purposes; compare reserve adequacy to subsequent liabilities, evidence: Transue reserves fell to $13,000 showing necessity; Buda reserves stayed at $1 million showing artificial nature
  > "In the case of Transue, their reserves got up very high but the end of 1945 saw them down to" @line 71

- **title**: Non-operating charges mask current operating results — question: How much of reported earnings change comes from operations versus accounting charges and prior-year adjustments?, test: Separate operating from non-operating earnings; remove prior-year charges and extraordinary depreciation; compare cleaned earnings across periods, evidence: Denver Railroad showed reported loss but $27.7 million in operating earnings versus prior year $23.2 million
  > "These items are semi-manipulative, you might say. They have very little to do with the actual operating results of" @line 182

- **title**: Balance-sheet-only reserve transfers carry no earnings signal — question: When a company moves funds from surplus to a reserve account without routing the charge through the income statement, does that transfer tell the analyst anything about true earning power?, test: For any reserve increase, check whether it appears as an income-statement charge or purely as an internal balance-sheet reclassification; only the former should enter a "true earnings" reconstruction, evidence: United Aircraft's $35 million total reserves only partly reduced reported earnings — $15 million of it was moved from surplus to reserve without touching the income account, so restoring the full $14/share to earnings would double count.
  > "The latter is purely internal, and a matter of no special significance." @line 126

- **title**: Same headline price, opposite earnings truth — the limits of screening on reported EPS alone — question: Can two companies trading at an identical market price be radically mispriced relative to each other because their reported earnings diverge from their true balance-sheet earnings in opposite directions?, test: For any pair of similarly-priced companies, compute the balance-sheet-derived earnings gap for each and compare direction/magnitude before treating the shared price as evidence of comparable value, evidence: Transue Williams and Buda both sold at $33.50/share, yet Transue's true earnings ran $2.41/share below reported while Buda's ran $5.17/share above reported — the same market price concealed opposite earnings realities.
  > "buyers could easily have been misled by the ordinary procedure of looking at the reported earnings per share as they appear" @line 26

## Metrics

- **name**: Earnings per balance sheet (balance sheet basis earnings) — formula: (Ending stockholders equity minus Beginning stockholders equity, adjusted for new stock issued and dividends paid, divided by shares outstanding), reading: True economic earnings revealed by balance sheet changes; significant divergence from reported earnings indicates quality issues, benchNotes: Normalized for stock sales and non-earnings transfers; materiality of 10 percent warrants investigation; reveals over-reserving or under-reserving
  > "The transfer to a per share basis can be made at any convenient time that you wish. Dividends" @line 35

- **name**: Net earnings before taxes and depreciation (operating earning power) — formula: Operating revenue minus all operating expenses, excluding taxes and depreciation or amortization, reading: True operating earning power free of extraordinary items; especially useful for railroads and war-affected companies where reported earnings are distorted, benchNotes: Exclude extraordinary tax items; exclude emergency depreciation; use for period-to-period trend analysis and cross-company comparison when facing different tax or depreciation situations
  > "In 1944 this net was $23,220,000 and in 1945 it was $27,721,000. Hence the much poorer reported earnings" @line 138

- **name**: Curtiss-Wright ten-year reported-vs-balance-sheet earnings gap — formula: Balance-sheet-basis EPS over N years minus reported EPS over the same N years, reading: A ~50% gap ($18.53 balance-sheet EPS vs. $12.28 reported EPS over ten years) signals a large hidden reserve cushion rather than genuine unprofitability; the analyst should trace the gap to specific reserve accounts before crediting it as "true" earnings, benchNotes: Graham explicitly ties the entire $6.25/share gap to reserves built in the last five years, none of which were needed for stated war purposes — a reserve-quality check, not merely an arithmetic exercise.
  > "That's a very considerable difference, -- an increase of 50 per cent." @line 98

- **name**: United Aircraft prior-year tax/depreciation carve-out — formula: Reported net income + prior-year tax deficiency charge + prior-year-applicable depreciation catch-up = normalized current-year earnings, reading: When $9 million of a reported $7 million loss traces to items "applicable to previous years' operations," the true current-year result flips from a loss to roughly a $1.8 million profit — a stark illustration of how prior-year catch-up charges can invert the apparent trend, benchNotes: Only strip items management explicitly attributes to prior periods; Graham flags that even after this adjustment a further ~$5.6 million of the tax charge remains unexplained, so the adjustment is a floor, not a complete reconciliation.
  > "instead of having a loss of $7-million for the year's operations after interest taxes, they would have had a profit of $1,800,000" @line 175

## Other

- **Graham's classroom Q&A method**: The transcript preserves live audience questions and Graham's direct replies mid-lecture — evidence of his pedagogical style of pausing to field clarifying questions before proceeding, and of treating "the equity include reserves?" as "a good question" worth a precise, textbook-grade answer on the spot.
  > "QUESTION: Does the equity include reserves? MR. GRAHAM: Yes. That's a good question." @line 77

- **Self-correction in real time**: Graham interrupts his own narrative to correct an error he had just made about how Transue & Williams labeled its reserve account — a small but telling instance of his intellectual honesty and precision even in an informal lecture setting, correcting himself rather than letting an imprecise label stand.
  > "It may be that Transue and Williams called their reserve a reserve for contingencies, but actually it was a reserve for renegotiation which, as I said, proved insufficient." @line 63

## Nothing-found notes

No gaps—lecture contains substantive question patterns, search directives, concepts, and metrics.
