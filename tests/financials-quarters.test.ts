/**
 * Quarterly-columns + current-FY-estimate tests, in two halves:
 *   1. lib/edgar.ts — mapping XBRL companyfacts onto provider-shaped rows:
 *      per-period tag-alias fallback, Q4 reconstruction from year-to-date
 *      entries, provider sign conventions (capex/dividends/buybacks are
 *      cash-flow-signed), split restatement by FILING date, and the
 *      statement-currency unit guard;
 *   2. lib/financials.ts buildQuartersAndEstimate — fiscal-year/slot
 *      placement, the five-year quarterly window, and the TTM-trend
 *      projection of the in-progress fiscal year (revenue at TTM YoY growth,
 *      flows at TTM revenue share, balance sheet held flat, estimates
 *      flagged and display-only).
 *
 * Run: npm test (tsx --test). Fixtures are generated relative to the current
 * date so the "don't project a stale record" guard never bit-rots the suite.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { extractStatements, type CompanyFacts, type SplitEvent } from "../lib/edgar";
import { buildQuartersAndEstimate } from "../lib/financials";

// ---------------------------------------------------------------------------
// Shared fixture clock: the latest closed fiscal year ends last Dec 31 (at
// least ~4 months ago so two "reported" quarters of the current year exist).
// ---------------------------------------------------------------------------

const now = new Date();
// May onward, last Dec 31 closed ≥4 months ago (Q1 of the current year is
// reportable); before May, anchor one year earlier so the fixture always has
// a fresh-enough record AND an in-progress year with unreported quarters.
const lastFY =
  now.getUTCMonth() >= 4 ? now.getUTCFullYear() - 1 : now.getUTCFullYear() - 2;
const fy = (offset: number) => lastFY + offset;
const D = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// ---------------------------------------------------------------------------
// 1. EDGAR extraction
// ---------------------------------------------------------------------------

type Fact = { start?: string; end?: string; val?: number; filed?: string };
const usd = (entries: Fact[]) => ({ units: { USD: entries } });

/** Four flow entries for one fiscal year: Q1..Q3 discrete+YTD, then the 10-K FY total. */
function flowYear(y: number, q: [number, number, number, number], filed = D(y + 1, 2, 1)): Fact[] {
  const [q1, q2, q3, q4] = q;
  return [
    { start: D(y, 1, 1), end: D(y, 3, 31), val: q1, filed: D(y, 4, 25) },
    { start: D(y, 4, 1), end: D(y, 6, 30), val: q2, filed: D(y, 7, 25) },
    { start: D(y, 1, 1), end: D(y, 6, 30), val: q1 + q2, filed: D(y, 7, 25) },
    { start: D(y, 7, 1), end: D(y, 9, 30), val: q3, filed: D(y, 10, 25) },
    { start: D(y, 1, 1), end: D(y, 9, 30), val: q1 + q2 + q3, filed: D(y, 10, 25) },
    // Q4 is NEVER filed discretely — the extractor must derive FY − 9M.
    { start: D(y, 1, 1), end: D(y, 12, 31), val: q1 + q2 + q3 + q4, filed },
  ];
}

function edgarFixture(): CompanyFacts {
  const gaap: Record<string, { units: Record<string, Fact[]> }> = {
    // Revenue lives in the legacy tag for FY-2 and the modern tag afterward —
    // the per-period alias fallback has to stitch the two.
    Revenues: usd(flowYear(fy(-2), [10, 11, 12, 17])),
    RevenueFromContractWithCustomerExcludingAssessedTax: usd([
      ...flowYear(fy(-1), [20, 21, 22, 27]),
      ...flowYear(fy(0), [30, 31, 32, 37]),
    ]),
    NetIncomeLoss: usd([
      ...flowYear(fy(-2), [1, 1, 1, 2]),
      ...flowYear(fy(-1), [2, 2, 2, 4]),
      ...flowYear(fy(0), [3, 3, 3, 6]),
    ]),
    // EDGAR files capex as positive payments; provider shape is negative.
    PaymentsToAcquirePropertyPlantAndEquipment: usd(flowYear(fy(0), [5, 5, 5, 5])),
    StockholdersEquity: {
      units: {
        USD: [fy(-2), fy(-1), fy(0)].map((y) => ({
          end: D(y, 12, 31),
          val: 100 + (y - lastFY) * 10,
          filed: D(y + 1, 2, 1),
        })),
      },
    },
    // Shares/EPS filed BEFORE the split are on the old basis; the entry filed
    // after is already restated. Split: 10-for-1 on Jul 1 of the latest FY.
    WeightedAverageNumberOfDilutedSharesOutstanding: {
      units: {
        shares: [
          { start: D(fy(-1), 1, 1), end: D(fy(-1), 12, 31), val: 10, filed: D(fy(0), 2, 1) },
          { start: D(fy(0), 1, 1), end: D(fy(0), 12, 31), val: 100, filed: D(fy(1), 2, 1) },
        ],
      },
    },
    EarningsPerShareDiluted: {
      units: {
        "USD/shares": [
          { start: D(fy(-1), 1, 1), end: D(fy(-1), 12, 31), val: 1.0, filed: D(fy(0), 2, 1) },
          { start: D(fy(0), 1, 1), end: D(fy(0), 12, 31), val: 0.15, filed: D(fy(1), 2, 1) },
        ],
      },
    },
    // A tag filed only in EUR must be ignored under a USD statement currency.
    OperatingIncomeLoss: { units: { EUR: flowYear(fy(0), [9, 9, 9, 9]) } },
  };
  return { facts: { "us-gaap": gaap } };
}

const SPLIT: SplitEvent[] = [{ dateMs: Date.parse(D(fy(0), 7, 1)), ratio: 10 }];

test("edgar: alias fallback + YTD-derived Q4 + sign conventions", () => {
  const out = extractStatements(edgarFixture(), "USD", SPLIT);
  assert.ok(out, "extraction yields statements");
  const annual = out!.annual;
  assert.equal(annual.length, 3, "three fiscal years");
  // Alias stitching: legacy Revenues for FY-2, modern tag afterward.
  assert.equal(annual[0].totalRevenue, 50);
  assert.equal(annual[2].totalRevenue, 130);
  // The EUR-only tag must not leak into a USD extraction.
  assert.equal(annual[2].operatingIncome, undefined);
  // Provider sign convention: capex negative.
  assert.equal(annual[2].capitalExpenditure, -20);

  const q = out!.quarterly;
  const q4 = q.find((r) => String(r.date).startsWith(D(fy(0), 12, 31)));
  assert.ok(q4, "derived Q4 row exists");
  assert.equal(q4!.totalRevenue, 37, "Q4 revenue = FY − 9M YTD");
  assert.equal(q4!.netIncome, 6);
  assert.equal(q4!.capitalExpenditure, -5);
  assert.equal(q4!.stockholdersEquity, 100, "instant value at the FY end");
});

test("edgar: per-share history restates by FILING date, not period", () => {
  const out = extractStatements(edgarFixture(), "USD", SPLIT)!;
  const [, prev, last] = out.annual;
  // Filed before the 10:1 split → ×10 shares, ÷10 EPS; filed after → as-is.
  assert.equal(prev.dilutedAverageShares, 100);
  assert.equal(prev.dilutedEPS, 0.1);
  assert.equal(last.dilutedAverageShares, 100);
  assert.equal(last.dilutedEPS, 0.15);
});

test("edgar: unknown split history omits per-share facts entirely", () => {
  const out = extractStatements(edgarFixture(), "USD", null)!;
  for (const row of out.annual) {
    assert.equal(row.dilutedAverageShares, undefined);
    assert.equal(row.dilutedEPS, undefined);
  }
  // Money facts are unaffected by the missing split history.
  assert.equal(out.annual[2].totalRevenue, 130);
});

// ---------------------------------------------------------------------------
// 2. Quarter placement + the TTM-trend estimate
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;

/** Provider-shaped annual rows: revenue grows 21% into the latest FY. */
function annualRecs(): Rec[] {
  const years = [fy(-6), fy(-5), fy(-4), fy(-3), fy(-2), fy(-1), fy(0)];
  return years.map((y, i) => ({
    date: D(y, 12, 31),
    totalRevenue: 1000 * Math.pow(1.1, i),
    netIncome: 100 * Math.pow(1.1, i),
    stockholdersEquity: 2000 + i * 100,
    operatingCashFlow: 200 * Math.pow(1.1, i),
    capitalExpenditure: -50,
    dilutedAverageShares: 10,
  }));
}

/**
 * Quarterly rows: full four quarters for the last three closed years, plus
 * Q1–Q2 of the current (unfinished) year. Revenue splits 22/24/26/28% across
 * quarters; the current year runs 20% above the same quarters last year.
 */
function quarterRecs(): Rec[] {
  const rows: Rec[] = [];
  const weights = [0.22, 0.24, 0.26, 0.28];
  const ends: [number, number][] = [[3, 31], [6, 30], [9, 30], [12, 31]];
  for (const y of [fy(-2), fy(-1), fy(0)]) {
    const yearRev = 1000 * Math.pow(1.1, y - fy(-6));
    ends.forEach(([m, d], qi) => {
      rows.push({
        date: D(y, m, d),
        totalRevenue: yearRev * weights[qi],
        netIncome: yearRev * weights[qi] * 0.1,
        stockholdersEquity: 2000 + (y - fy(-6)) * 100,
        operatingCashFlow: yearRev * weights[qi] * 0.2,
        capitalExpenditure: -12.5,
        dilutedAverageShares: 10,
      });
    });
  }
  const currentRev = (q: number) =>
    1000 * Math.pow(1.1, fy(0) - fy(-6)) * [0.22, 0.24][q] * 1.2;
  [0, 1].forEach((q) => {
    rows.push({
      date: D(fy(1), q === 0 ? 3 : 6, q === 0 ? 31 : 30),
      totalRevenue: currentRev(q),
      netIncome: currentRev(q) * 0.12,
      stockholdersEquity: 3000,
      operatingCashFlow: currentRev(q) * 0.2,
      capitalExpenditure: -15,
      dilutedAverageShares: 9,
    });
  });
  return rows;
}

test("quarters: five-year window, slots, YoY growth, current FY included", () => {
  const { quarters } = buildQuartersAndEstimate(annualRecs(), quarterRecs());
  const reported = quarters.filter((q) => !q.estimated);
  // 3 closed years × 4 + current-year Q1–Q2 (window allows 5, record has 3).
  assert.equal(reported.length, 14);
  assert.deepEqual(
    [...new Set(reported.map((q) => q.fiscalYear))].sort(),
    [fy(-2), fy(-1), fy(0), fy(1)].map(String)
  );
  const q3 = reported.find((q) => q.fiscalYear === String(fy(0)) && q.quarter === 3)!;
  assert.ok(Math.abs((q3.values.revenueGrowth ?? 0) - 0.1) < 1e-9, "YoY vs same quarter last year");
  // Annualized-rate rows never appear in a quarter column.
  assert.ok(!("roe" in q3.values));
  assert.ok(!("roic" in q3.values));
});

test("estimate: remaining quarters projected from TTM trends, balance held flat", () => {
  const { quarters, estimate } = buildQuartersAndEstimate(annualRecs(), quarterRecs());
  assert.ok(estimate, "estimate exists");
  assert.equal(estimate!.fiscalYear, String(fy(1)));
  assert.equal(estimate!.label, `${fy(1)}E`);
  assert.equal(estimate!.method, "ttm-trend");

  const est = quarters.filter((q) => q.estimated);
  assert.deepEqual(est.map((q) => q.quarter), [3, 4], "only the unreported slots are estimated");
  assert.ok(est.every((q) => q.fiscalYear === String(fy(1))));

  // TTM YoY growth, exactly as the layer computes it: the trailing window is
  // [Q3,Q4 of the last closed FY] + [Q1,Q2 current ×1.2]; the window a year
  // earlier is [Q3,Q4 of the FY before (a 1.1× smaller year)] + [Q1,Q2 of the
  // last closed FY].
  const lastRev = 1000 * Math.pow(1.1, 6);
  const prevRev = 1000 * Math.pow(1.1, 5);
  const ttm = lastRev * (0.26 + 0.28) + lastRev * (0.22 + 0.24) * 1.2;
  const prevTtm = prevRev * (0.26 + 0.28) + lastRev * (0.22 + 0.24);
  const g = ttm / prevTtm - 1;
  const q3e = est.find((q) => q.quarter === 3)!;
  const expected = lastRev * 0.26 * (1 + g);
  assert.ok(
    Math.abs((q3e.values.revenue ?? 0) - expected) / expected < 1e-9,
    `Q3E revenue = same quarter last year × (1+TTM growth): ${q3e.values.revenue} vs ${expected}`
  );
  // Balance sheet holds at the last reported quarter.
  assert.equal(q3e.values.equity, 3000);
  assert.equal(estimate!.values.equity, 3000);

  // The annual estimate is the four slots summed (reported Q1–Q2 + projected Q3–Q4).
  const reportedCurrent = quarters.filter((q) => q.fiscalYear === String(fy(1)) && !q.estimated);
  const sum =
    reportedCurrent.reduce((a, q) => a + (q.values.revenue ?? 0), 0) +
    est.reduce((a, q) => a + (q.values.revenue ?? 0), 0);
  assert.ok(Math.abs((estimate!.values.revenue ?? 0) - sum) < 1e-6);

  // Full-year estimates DO carry rate rows (they are year-scale numbers).
  assert.ok(estimate!.values.roe != null);
  // And the reported record itself is untouched: the estimate never joins fiscalYears.
  assert.ok(!estimate!.values.revenue || estimate!.fiscalYear === String(fy(1)));
});

test("estimate: absent when the record is stale or quarters are missing", () => {
  const oldAnnual = annualRecs().map((r) => ({
    ...r,
    date: String(r.date).replace(/^\d{4}/, (y) => String(Number(y) - 5)),
  }));
  const { estimate } = buildQuartersAndEstimate(oldAnnual, []);
  assert.equal(estimate, null);
  const none = buildQuartersAndEstimate(annualRecs(), []);
  assert.equal(none.estimate, null);
  assert.equal(none.quarters.length, 0);
});
