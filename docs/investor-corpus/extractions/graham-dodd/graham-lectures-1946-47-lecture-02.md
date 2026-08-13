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

## Question patterns

- **pattern**: What exactly should be included in stockholders equity for balance sheet analysis? — askWhen: calculating earnings from balance sheet changes, determining what comprises equity, anchor: business-model
  > "By equity we mean common stock plus surplus, plus whatever reserves are regarded as equivalent of surplus" @line 78

- **pattern**: How do hidden or deferred depreciation charges affect real equity and earning power? — askWhen: comparing balance sheet earnings to reported earnings in capital-intensive companies, anchor: business-model
  > "You can very well claim that certain charges for depreciation have created equities for stock which do not" @line 83

- **pattern**: Why do companies with the same stock price show opposite earnings differences when compared using balance sheet versus reported earnings methods? — askWhen: investigating divergences between balance-sheet-derived and reported earnings, anchor: business-model
  > "If you ask the reason for the difference in the results in these two companies, you would find it" @line 48

## Search directives

- **directive**: Compare balance sheet changes to reported earnings as a quality check. Compare stockholders equity changes period-to-period (adjusted for dividends and new stock sales) against reported net income. — queryShapes: ["compare <COMPANY> balance sheet equity changes", "verify <COMPANY> reported earnings by balance sheet"], sourcePriority: audited balance sheet and equity schedules
  > "First, the balance sheet comparison is a relatively simple idea. You take the equity for the stock at" @line 28

- **directive**: Carefully examine reserve accounts in war industries and reconversion companies. Track reserves year-over-year to distinguish necessary reserves (which get drawn down) from artificial contingency buffers. — queryShapes: ["list <COMPANY> reserve accounts and changes", "track <COMPANY> reserve drawdowns"], sourcePriority: balance sheet reserve detail and footnotes
  > "In the case of Transue, their reserves got up very high but the end of 1945 saw them down to" @line 71

- **directive**: For railroads and war-affected companies, focus on operating earnings (before taxes and depreciation). Extraordinary tax items, prior-year charges, and emergency depreciation distort reported earnings. — queryShapes: ["calculate <COMPANY> net before taxes and depreciation", "separate <COMPANY> operations from tax and depreciation"], sourcePriority: income statement detail and depreciation/tax footnotes
  > "For the net before taxes is a useful item, and the deprecation may well be treated separately since it is" @line 131

## Concepts

- **title**: Balance sheet reconstruction detects earnings quality issues — question: When reported net income diverges from balance sheet equity changes, which reveals truth?, test: Calculate earnings from equity changes (adjusted for dividends and new stock); compare to reported earnings; investigate discrepancies, evidence: Transue and Buda companies sold at identical prices but showed opposite earnings gaps; Curtiss-Wright showed 50 percent inflation
  > "These are the examples that I wanted to give you of comparative balance sheets for the purpose of determining what" @line 127

- **title**: Reserve classification determines whether earnings are real — question: Which reserves represent genuine liabilities versus artificial buffers to smooth reported earnings?, test: Monitor reserve accounts across years to see if drawn down for stated purposes; compare reserve adequacy to subsequent liabilities, evidence: Transue reserves fell to $13,000 showing necessity; Buda reserves stayed at $1 million showing artificial nature
  > "In the case of Transue, their reserves got up very high but the end of 1945 saw them down to" @line 71

- **title**: Non-operating charges mask current operating results — question: How much of reported earnings change comes from operations versus accounting charges and prior-year adjustments?, test: Separate operating from non-operating earnings; remove prior-year charges and extraordinary depreciation; compare cleaned earnings across periods, evidence: Denver Railroad showed reported loss but $27.7 million in operating earnings versus prior year $23.2 million
  > "These items are semi-manipulative, you might say. They have very little to do with the actual operating results of" @line 182

## Metrics

- **name**: Earnings per balance sheet (balance sheet basis earnings) — formula: (Ending stockholders equity minus Beginning stockholders equity, adjusted for new stock issued and dividends paid, divided by shares outstanding), reading: True economic earnings revealed by balance sheet changes; significant divergence from reported earnings indicates quality issues, benchNotes: Normalized for stock sales and non-earnings transfers; materiality of 10 percent warrants investigation; reveals over-reserving or under-reserving
  > "The transfer to a per share basis can be made at any convenient time that you wish. Dividends" @line 35

- **name**: Net earnings before taxes and depreciation (operating earning power) — formula: Operating revenue minus all operating expenses, excluding taxes and depreciation or amortization, reading: True operating earning power free of extraordinary items; especially useful for railroads and war-affected companies where reported earnings are distorted, benchNotes: Exclude extraordinary tax items; exclude emergency depreciation; use for period-to-period trend analysis and cross-company comparison when facing different tax or depreciation situations
  > "In 1944 this net was $23,220,000 and in 1945 it was $27,721,000. Hence the much poorer reported earnings" @line 138

## Nothing-found notes

No gaps—lecture contains substantive question patterns, search directives, concepts, and metrics.
