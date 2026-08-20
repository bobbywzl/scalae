---
slug: graham-newman-letter-1953
investor: graham-dodd
url: https://business.columbia.edu/sites/default/files-efs/imce-uploads/1953.PDF
wordCount: 3447
chunksRead: 1-3 of 3
coverage: 100%
---

## Verbatim quotes

- > "net asset value of $1,361.11 per share on January 31st, 1953, compared with $1,257.85 per share on January 3lst, 1952" @chars 285

- > "The indicated net asset value on February 16th, 1953 was approximately $1,359.00 per share." @line 15-17

- > "Net realized profits for the fiscal year (without reflecting the tnerease in unrealized appreciation) amounted to $123.90 per share" @chars 538

- > "Total dividends of $127.81 applicable to the fiscal year exceed the net realized profit for the fiscal year by $3.91 per share" @chars 1043

- > "The overall gain for the fiscal year, including the net increase in unrealized appreciation, was $195.71 per share, or 15.6%" @chars 1643

- > "Of the total dividends of $127.81 applicable to the fiscal year, $112.31 per share represents long term capital gains, $15.50 is ordinary income" @chars 1497

- > "Investments have been evaluated at their quoted market values as at January 31, 1953 except as noted below" @chars 9615

- > "The President and Treasurer each receive a salary of $25,000 per annum, and additional compensation of 10% of the excess of the realized net income in each year" @chars 10136

- > "These valuations are not, however, intended as representations of the amounts which may be actually realizable upon sale of the securities" @chars 9723

- > "The Corporation has elected to be taxed as a "regulated investment company" under the Internal Revenue Code" @chars 13977

- > "The aggregate dollar amounts of purchases and sales of investment securities, other than United States Government obligations, made during the year were as follows" @chars 11600

- > "Such dividends consist of the quarterly dividends of $12.50 each paid in June and September 1952, the dividend of $50 paid in December 1952 and a dividend of $52.31, declared February 17th, 1953" @line 23-26

- > "During the calendar year 1952 the total dividends paid amounted to $92.1, consisting of a dividend of $17.) paid in March out of net realized profits of the fiscal year ended January 31st, 1952" @line 48-50

- > "The proxy statement for the annual meeting of stockholders which will be held on April 13th, 1953 will be mailed to the stockholders on or about April lst, 1953." @line 62-65

- > "Effective control of AGwI has been acquired by Jerome A. Newman, one of the officers of Graham-Newman Corporation." @line 395-397

- > "There have recently been only occasional transactions in AGwI common stock on the New York Stock Exchange." @line 397-398

- > "The management is of the opinion that these investments have been fairly valued." @line 403-404

- > "an amount equivalent to $40.00 per share per annum ($10.00 per share per quarter) on the presently outstanding capital stock." @line 412-414

- > "In the event of the death of either of these officers, or the termination of his tenure of office, such officer or his estate will be entitled to receive further additional com- pensation" @line 438-441

- > "No provision has therefore been made for such taxes either in respect of the realized net income for the current period or in respect of unrealized appreciation at the close thereof." @line 460-462

- > "Cost of Securities purchased $ 981,404.89 Proceeds of sales of securities 2,278,594.31" @line 470-471

## Question patterns

- **pattern**: How does realized net income relate to actual dividend distributions? — askWhen: evaluating capital allocation policy and dividend sustainability, anchor: business-model
  > "Total dividends of $127.81 applicable to the fiscal year exceed the net realized profit for the fiscal year by $3.91 per share" @chars 1043

- **pattern**: What components comprise total returns, and how are they taxed differently? — askWhen: assessing investor tax efficiency and return composition, anchor: business-model
  > "Of the total dividends of $127.81 applicable to the fiscal year, $112.31 per share represents long term capital gains, $15.50 is ordinary income" @chars 1497

- **pattern**: How should management compensation align incentives with shareholder value creation? — askWhen: evaluating governance structure and conflict of interest management, anchor: culture
  > "The President and Treasurer each receive a salary of $25,000 per annum, and additional compensation of 10% of the excess of the realized net income in each year" @chars 10136

- **pattern**: What is the relationship between unrealized appreciation and actual shareholder value? — askWhen: evaluating accounting practices and financial disclosure sufficiency, anchor: business-model
  > "These valuations are not, however, intended as representations of the amounts which may be actually realizable upon sale of the securities" @chars 9723

- **pattern**: When an officer of the fund personally controls a portfolio company (as Jerome Newman did with AGWI), and that stock trades only occasionally, how reliable is its "quoted market value" as a basis for the fund's own reported unrealized appreciation? — askWhen: assessing valuation integrity for thinly-traded, insider-controlled holdings, anchor: culture
  > "Effective control of AGwI has been acquired by Jerome A. Newman, one of the officers of Graham-Newman Corporation. There have recently been only occasional transactions in AGwI common stock on the New York Stock Exchange." @line 395-398

- **pattern**: When a company's securities have no market quotation at all, on what basis and by whom should "fair value" be determined, and how should that self-assessment be disclosed to stockholders? — askWhen: evaluating unmarketable/illiquid holdings valued by management judgment rather than market price, anchor: business-model
  > "for which no market quotations were available, have been evaluated by the management and in the statements herein at $452,500.00 which amount represents unrealized appreciation of $400,200" @line 400-402

## Search directives

- **directive**: Track net asset value per share progression and underlying asset appreciation/depreciation by year — queryShapes: trend analysis, time-series comparison
  > "net asset value of $1,361.11 per share on January 31st, 1953, compared with $1,257.85 per share on January 3lst, 1952" @chars 285

- **directive**: Monitor composition of returns (realized gains vs unrealized appreciation) to understand risk exposure and realization rates — queryShapes: component decomposition, realization analysis
  > "The overall gain for the fiscal year, including the net increase in unrealized appreciation, was $195.71 per share, or 15.6%" @chars 1643

- **directive**: Examine dividend policy sustainability by comparing payout levels to realized income generation — queryShapes: ratio analysis, sustainability assessment
  > "The aggregate dollar amounts of purchases and sales of investment securities, other than United States Government obligations, made during the year were as follows" @chars 11600

- **directive**: Check whether a fund's controlling officer holds a personal stake in one of the fund's own portfolio companies, and if so how thinly that stock trades — a conflict-of-interest and mark-integrity flag — queryShapes: "<FUND> officer personal stake in portfolio company", "<HOLDING> trading volume thinness", "<FUND> related-party holding disclosure"; sourcePriority: notes to financial statements, insider-control disclosures
  > "Effective control of AGwI has been acquired by Jerome A. Newman, one of the officers of Graham-Newman Corporation." @line 395-397

- **directive**: When a holding has no market quotation, trace exactly who performed the valuation (internal management vs. independent party) and cross-check the stated basis for "fair value" against any subsequent transaction evidence — queryShapes: "<COMPANY> no market quotation fair value basis", "<HOLDING> management valuation methodology disclosure"; sourcePriority: notes to financial statements, valuation committee minutes if available
  > "have been evaluated by the management and in the statements herein at $452,500.00 which amount represents unrealized appreciation of $400,200, of which $241,000 represents appreciation during the current year." @line 400-403

## Concepts

- **title**: Net Asset Value as Operational Measure — The firm reports NAV per share as primary performance metric, adjusted for unrealized gains and officer compensation provisions. Evidence question: How reliably does NAV track future returns?
  > "net asset value of $1,361.11 per share on January 31st, 1953, compared with $1,257.85 per share on January 3lst, 1952" @chars 285

- **title**: Realized vs Unrealized Gains Distinction — The fund separately reports realized profits from unrealized appreciation, with different tax and compensation treatment. Evidence question: What drives the split between realized and unrealized returns?
  > "The overall gain for the fiscal year, including the net increase in unrealized appreciation, was $195.71 per share, or 15.6%" @chars 1643

- **title**: Performance-Based Compensation Structure — Officers receive base salary plus 10% of excess realized net income above a threshold, with specific caps. Evidence question: Does this align management interests with long-term shareholder wealth?
  > "The President and Treasurer each receive a salary of $25,000 per annum, and additional compensation of 10% of the excess of the realized net income in each year" @chars 10136

- **title**: Market Value Accounting with Valuation Uncertainty — Investments valued at quoted market prices, yet management notes these may not reflect realizable proceeds. Evidence question: What is the materiality of valuation uncertainty to reported performance?
  > "These valuations are not, however, intended as representations of the amounts which may be actually realizable upon sale of the securities" @chars 9723

- **title**: Related-party valuation risk in thinly-traded, insider-controlled holdings — question: When the fund's own officer personally controls a company whose shares the fund also holds, does a "quoted market value" derived from occasional trades still represent an arm's-length price?, test: cross-reference disclosed officer control of the issuer against the stated trading frequency of that issuer's stock., evidence: Graham-Newman's own notes disclosing Jerome Newman's control of AGWI alongside the admission that AGWI trades only occasionally.
  > "Effective control of AGwI has been acquired by Jerome A. Newman, one of the officers of Graham-Newman Corporation. There have recently been only occasional transactions in AGwI common stock on the New York Stock Exchange." @line 395-398

- **title**: Management-marked valuations for unquoted securities — question: absent a market quotation, is management's own fair-value estimate for a holding disclosed with enough specificity (dollar appreciation, portion attributable to the current year) for a reader to judge its reasonableness?, test: check whether the disclosure states the total valuation, the appreciation embedded in it, and an explicit representation of management's confidence., evidence: the Monterey Oil / Perkin-Elmer debenture valuation note, including the explicit sentence asserting fair value.
  > "The management is of the opinion that these investments have been fairly valued." @line 403-404

## Metrics

- **name**: Net Asset Value Per Share — formula as stated: total assets less liabilities divided by 5,000 outstanding shares; reading: $1,361.11 per share at January 31, 1953; bench notes: prior year $1,257.85
  > "net asset value of $1,361.11 per share on January 31st, 1953, compared with $1,257.85 per share on January 3lst, 1952" @chars 285

- **name**: Total Annual Return — formula as stated: (realized net income + increase in unrealized appreciation) / beginning asset value; reading: 15.6% for fiscal year ended January 31, 1953; bench notes: equivalent to $195.71 per share gain
  > "The overall gain for the fiscal year, including the net increase in unrealized appreciation, was $195.71 per share, or 15.6%" @chars 1643

- **name**: Realized Profit Per Share — formula as stated: net realized gains on investment securities sales; reading: $123.90 per share for fiscal year 1953; bench notes: separate line item from unrealized appreciation
  > "Net realized profits for the fiscal year (without reflecting the tnerease in unrealized appreciation) amounted to $123.90 per share" @chars 538

- **name**: Dividend Payout Ratio to Realized Income — formula as stated: total dividends declared / realized net profit; reading: 103.1% ($127.81/$123.90) for fiscal year 1953; bench notes: exceeds realized income by $3.91
  > "Total dividends of $127.81 applicable to the fiscal year exceed the net realized profit for the fiscal year by $3.91 per share" @chars 1043

- **name**: Long-Term Capital Gains Share of Dividends — formula as stated: long-term capital gain dividends / total dividends; reading: 87.9% ($112.31/$127.81) for fiscal year 1953; bench notes: reflects tax-efficient distribution strategy
  > "Of the total dividends of $127.81 applicable to the fiscal year, $112.31 per share represents long term capital gains, $15.50 is ordinary income" @chars 1497

- **name**: Officer compensation hurdle and hard cap — formula as stated: 10% of excess realized net income over $40.00/share/annum ($10.00/share/quarter) on outstanding stock, with additional compensation payable to each officer capped at 12.5% of the excess of total dividends paid over the same $40.00/share/annum threshold; reading: for fiscal 1953, provision for additional compensation of officers was $52,440.57 each for Graham and Newman ($104,881.14 total); bench notes: pairs a profit-based hurdle with a hard dividends-paid ceiling, and defers most of the payout into five equal annual installments.
  > "tional compensation payable to each of these officers from and after February 1, 1948 is, however, limited to 123% of the excess of total dividends paid during this period over an amount equivalent to $40.00 per share per annum" @line 426-429

- **name**: Portfolio turnover through purchases and sales — formula: aggregate cost of securities purchased versus proceeds of sales, excluding U.S. Government obligations; reading: purchases $981,404.89 versus sales proceeds $2,278,594.31 for fiscal 1953, indicating net portfolio liquidation exceeding new buying; bench notes: contrasts with the far larger 1948 turnover figures, suggesting a more selective/harvesting posture in this fiscal year.
  > "Cost of Securities purchased $ 981,404.89 Proceeds of sales of securities 2,278,594.31" @line 470-471

## Other

- **David L. Dodd named as a sitting director**: The officers-and-directors block lists David L. Dodd — Graham's Security Analysis co-author — as a Graham-Newman Corporation director alongside Graham, Jerome A. Newman, Wm. K. Jacobs Jr., Robert J. Marony, and Howard A. Newman, documenting the direct institutional link between the academic partnership (Graham & Dodd) and the operating investment company.
  > "DIRECTORS Benjamin Graham Jerome A. Newman Wm. K. Jacobs, Jr. Robert J. Marony David L. Dodd Howard A. Newman" @line 89-91

- **Walter J. Schloss listed as Assistant Secretary**: The same officer roster names Walter J. Schloss — who would go on to run his own celebrated value-investing partnership after training under Graham — in a formal corporate role at Graham-Newman, a documentary trace of Schloss's apprenticeship years within the firm.
  > "Edward E, Laufer, Howard A. Newman, Secretary Vice President Walter J. Schloss, Assistant Secretary" @line 84-88

- **Jerome Newman's personal control of a fund holding (AGWI)**: The notes disclose, without euphemism, that officer Jerome A. Newman personally acquired effective control of Atlantic Gulf and West Indies Steamship Lines — a stock the fund itself held and marked at a large unrealized gain — an unusually candid disclosure of an insider's personal stake sitting inside the portfolio he helped manage.
  > "Effective control of AGwI has been acquired by Jerome A. Newman, one of the officers of Graham-Newman Corporation." @line 395-397

- **The 122 East 42nd Street address change**: This letter's masthead shows Graham-Newman Corporation at "122 EAST 42ND STREET" rather than the "52 WALL STREET" address seen on the 1946/1948 letters — a small physical trace of the firm's relocation within New York across these years, useful for dating undated fragments of the correspondence.
  > "GRAHAM-NEWMAN CORPORATION 122 EAST 42ND STREET NEW YORK 17, N. Y." @line 1-3
