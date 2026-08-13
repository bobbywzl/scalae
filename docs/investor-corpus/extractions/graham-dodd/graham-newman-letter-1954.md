---
slug: graham-newman-letter-1954
investor: graham-dodd
url: https://business.columbia.edu/sites/default/files-efs/imce-uploads/1954.PDF
wordCount: 3361
chunksRead: 1-2 of 2
coverage: 100%
---
## Verbatim quotes

> "The appended balance sheet indicates a net asset value of $1,286.69 per share on January 31st, 195), compared with $1,361.11 per share on January 31st, 1953." @lines 12–14
> "The overall gain for the fiscal year, including the net increase in unrealized appreciation, was $15.89 per share, or 1.2% on the asset value of the shares at the beginning of the fiscal year." @lines 19–22
> "Net realized profits for the fiscal year (without reflecting the decrease in unrealized appreciation) amounted to $139.12 per share." @lines 24–27
> "Of the total dividends of $15) per share applicable to the fiscal year, the entire amount represents long term capital gains." @lines 39–40
> "At the annual meeting resolutions, previously approved by the Board of Directors, will be presented, providing a more responsible position for Howard A. Newman in the Management of the Corporation." @lines 63–65
> "Investments have been evaluated at their quoted market values as at January 31, 1954 except as noted below. These valuations are not, however, intended as representations of the amounts which may be actually realizable upon sale of the securities." @lines 331–336
> "The investment in Atlantic Gulf and West Indies Steamship Lines (AGWI) common stock (the entire cost of which has already been realized through liquidating distributions) has been valued at its quoted market value on the New York Stock Exchange as at January 31, 1954, and upon this basis shows an unrealized appreciation at that date of $1,399,047.00." @lines 363–367
> "The President and Treasurer each receive a salary of $25,000 per annum, and additional compensation of 10% of the excess of the realized net income in each year as determined at the close thereof (less the net unrealized depreciation, if any, in the value of investments at the year end which had accrued subsequent to January 31, 1948) over an amount equivalent to $40.00 per share per annum ($10.00 per share per quarter) on the presently outstanding capital stock." @lines 381–386
> "The aggregate dollar amounts of purchases and sales of investment securities, other than United States Government obligations, made during the year were as follows: Cost of Securities purchased $808,974.09 Proceeds of sales of securities $2,684,985.37" @lines 446–451
> "There have recently been only occasional transactions in AGWI common stock on the New York Stock Exchange." @lines 369–370
> "(x) represents investment in a non-controlled affiliate as defined in Investment Company Act of 1940, under which an issuer is an affiliate of one who owns 5% or more of its outstanding voting securities." @lines 766–768

## Question patterns found

- **pattern**: What is the total return to shareholders, separated by realized gain versus market revaluation? — askWhen: year-end performance reporting; fund annual review, anchor: business-model
  > "The overall gain for the fiscal year, including the net increase in unrealized appreciation, was $15.89 per share, or 1.2% on the asset value of the shares at the beginning of the fiscal year." @lines 19–22

- **pattern**: Can we distribute excess capital and realized gains as long-term capital gains to minimize shareholder tax burden? — askWhen: tax planning and regulatory compliance; dividend policy determination, anchor: business-model
  > "Of the total dividends of $15) per share applicable to the fiscal year, the entire amount represents long term capital gains." @lines 39–40

- **pattern**: Are manager compensation incentives properly aligned with actual realized performance over multi-year periods and against a performance baseline? — askWhen: manager review and compensation adjustment; multi-year performance evaluation, anchor: culture
  > "The President and Treasurer each receive a salary of $25,000 per annum, and additional compensation of 10% of the excess of the realized net income in each year as determined at the close thereof (less the net unrealized depreciation, if any, in the value of investments at the year end which had accrued subsequent to January 31, 1948) over an amount equivalent to $40.00 per share per annum ($10.00 per share per quarter) on the presently outstanding capital stock." @lines 381–386

## Search directives found

- **directive**: Monitor illiquid or thinly-traded holdings for potential mispricing or technical trading opportunities — queryShapes: "average trading volume <COMPANY>", "recent transaction dates <COMPANY> stock exchange", "bid-ask spread <COMPANY>", sourcePriority: exchange transaction records; trading data
  > "There have recently been only occasional transactions in AGWI common stock on the New York Stock Exchange." @lines 369–370

- **directive**: Identify and track securities in corporate restructuring or liquidation status where management has recovered part of cost basis through capital distributions — queryShapes: "liquidating distributions <COMPANY>", "restructuring plan <COMPANY> status", "recovery rate <COMPANY> creditors", sourcePriority: corporate action announcements; liquidation tracking; balance sheet forensics
  > "The investment in Atlantic Gulf and West Indies Steamship Lines (AGWI) common stock (the entire cost of which has already been realized through liquidating distributions) has been valued at its quoted market value on the New York Stock Exchange as at January 31, 1954, and upon this basis shows an unrealized appreciation at that date of $1,399,047.00." @lines 363–367

## Concepts found

- **title**: Unrealized appreciation tracking and management — question: How much of the fund's value comes from market revaluation of securities versus operational performance or realized gains?, test: Maintain separate accounting for cost basis, market value, and realized gains; track the delta between them, evidence: Balance sheet isolates unrealized appreciation and ties it to contingent manager compensation; P&L shows decrease in unrealized appreciation impacts overall fund performance, anchor: business-model
  > "The unrealized appreciation of investments at January 31, 1954 is represented as follows:" @lines 338–339

- **title**: Liquidation value recognition and recovery potential — question: Are we holding securities of companies in financial distress whose cost basis can be recovered through partial distributions or restructuring proceeds?, test: Identify holdings where liquidating distributions have already returned capital; monitor progress of reorganizations and court filings, evidence: AGWI entire cost already returned through distributions yet still holds $1.4M unrealized gain; holdings include numerous railroad reconstruction securities, bank stocks, and preferred shares from troubled companies, anchor: business-model
  > "The investment in Atlantic Gulf and West Indies Steamship Lines (AGWI) common stock (the entire cost of which has already been realized through liquidating distributions) has been valued at its quoted market value on the New York Stock Exchange as at January 31, 1954, and upon this basis shows an unrealized appreciation at that date of $1,399,047.00." @lines 363–367

## Metrics found

- **name**: Net Asset Value Per Share (NAV) — formula: Total net assets applicable to capital stock / outstanding shares, reading: Jan 31, 1954: $1,286.69 per share; prior year Jan 31, 1953: $1,361.11 per share (decline of $74.42 or 5.5% year-over-year), anchor: business-model
  > "The appended balance sheet indicates a net asset value of $1,286.69 per share on January 31st, 195), compared with $1,361.11 per share on January 31st, 1953." @lines 12–14

- **name**: Overall Gain Per Share (including market valuation changes) — formula: (Net realized gain + change in unrealized appreciation adjusted for manager compensation provisions) / shares outstanding, reading: $15.89 per share = 1.2% return on opening asset value; encompasses both security selection gains and market revaluation losses, anchor: business-model
  > "The overall gain for the fiscal year, including the net increase in unrealized appreciation, was $15.89 per share, or 1.2% on the asset value of the shares at the beginning of the fiscal year." @lines 19–22

- **name**: Net Realized Profit Per Share — formula: (Realized gains on sales - realized losses) / shares outstanding, reading: $139.12 per share in fiscal year 1954; substantially outperformed NAV change because $70.2M unrealized depreciation offset strong realized trading gains, anchor: business-model
  > "Net realized profits for the fiscal year (without reflecting the decrease in unrealized appreciation) amounted to $139.12 per share." @lines 24–27

- **name**: Capital Gains Distribution Rate — formula: Total dividends per share / net realized profit per share, reading: $15) per share dividends / $139.12 realized profit = over 107% of realized income; fund distributes more than earned by drawing on capital reserves to deliver consistent distributions while maintaining regulated investment company tax status, anchor: business-model
  > "Total dividends of $15) per share applicable to the fiscal year exceed the net realized profit for the fiscal year by $1).88 per share." @lines 33–34

- **name**: Manager Performance Compensation (base-adjusted) — formula: 10% of [realized net income for year - $40 per share baseline] for each of President and Treasurer; limited to 123% of [total dividends paid since Feb 1948 - cumulative $40 per share baseline] over multi-year average, reading: Aligns managers with realized earnings above a $40 per share per annum hurdle rate; contingent compensation also accrues for unrealized appreciation gains above Jan 31, 1948 baseline; payable in 5 equal annual installments, anchor: culture
  > "The President and Treasurer each receive a salary of $25,000 per annum, and additional compensation of 10% of the excess of the realized net income in each year as determined at the close thereof (less the net unrealized depreciation, if any, in the value of investments at the year end which had accrued subsequent to January 31, 1948) over an amount equivalent to $40.00 per share per annum ($10.00 per share per quarter) on the presently outstanding capital stock." @lines 381–386

- **name**: Unrealized Appreciation as Percentage of Fund Value — formula: Total unrealized appreciation (net of manager contingent compensation) / total net assets, reading: $1,434,495.72 / $6,433,463.44 = 22.3% of fund value attributable to unrealized gains; cost basis $3,495,507.20 on long positions vs market value $5,326,213.00 shows positive market environment, anchor: business-model
  > "Unrealized Appreciation at January 31, 1954 $1, 787,305.00" @line 346

## Nothing-found notes

- none — all categories populated
