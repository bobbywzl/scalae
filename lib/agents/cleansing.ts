import { claudeJSON, effortFromEnv } from "../ai/claude";
import { CLAUDE_OVERLOAD_FALLBACK } from "../ai/fallback";
import { geminiGroundedSearch } from "../ai/gemini";
import { resolveModel } from "../ai/models";
import {
  ADJUSTABLE_METRIC_KEYS,
  adjustmentLines,
  applyCleansing,
  deltaAnomalies,
  deltaAnomalyLines,
  describeAdjustment,
  reportedTableText,
  type DeltaAnomaly,
} from "../cleansing";
import { withDomain } from "../citations";
import { withDeadline } from "./research";
import {
  CLEANSING_DOCTRINE,
  CLEANSING_SUGGEST_SCHEMA,
  DESK_DOCTRINE,
  deskIdentity,
  FIN_ANALYST_DOCTRINE,
  FIN_ANALYST_SCHEMA,
} from "./framework";
import {
  failFinSuggestRun,
  finishFinSuggestRun,
  finSuggestRunStatus,
  getSetting,
  getTicker,
  insertFinAdjustment,
  insertFinCleansingEvent,
  insertFinMessage,
  listFinAdjustments,
  listFinCleansingEvents,
  listFinMessages,
  setSetting,
  transitionFinAdjustment,
} from "../db";
import { getFinancials } from "../financials";
import type { Lang } from "../i18n/config";
import type {
  Citation,
  FinAdjustment,
  FinAdjustmentOp,
  FinAdjustmentProposal,
  FinMessage,
  MetricFormat,
  MetricGroup,
  TickerFinancials,
} from "../types";
import { diligenceRecordContext, signalBoardContext } from "./context";

/**
 * The finance-cleansing bench's agents (FOUNDATION: human sovereignty;
 * framework.ts: THE FINANCE-CLEANSING BENCH). Two surfaces:
 *  - the suggestion pass ("Suggest moderations"): grounded sweeps over the
 *    company's actual disclosures for one-offs and windfall gains, distilled
 *    into adjustment proposals that PARK at status 'suggested' for review;
 *  - the analyst desk (chat): implements the investor's customization
 *    requests as precise adjustments — parked for review unless the message
 *    is an explicit command (the ask is the approval, chat.ts's idiom).
 * Neither surface ever touches the raw provider data; the engine
 * (lib/cleansing.ts) overlays applied adjustments deterministically.
 */

const ADJUSTABLE = new Set<string>(ADJUSTABLE_METRIC_KEYS);

// Same stage budgeting idiom as the diligence pass: sweeps capped well under
// the route's 300s maxDuration, the synthesis gets the larger remainder.
const SWEEP_LIMIT_MS = 120_000;
const SUGGEST_SYNTHESIS_LIMIT_MS = 150_000;
// The analyst turn may run TWO analyst calls with a research round between
// them (phase 1 → grounded sweeps → post-research plan), all inside the
// route's 300s: phase 1 capped, sweeps parallel and capped, the plan pass
// gets whatever remains of the total budget (floored to a real window).
const ANALYST_PHASE1_LIMIT_MS = 150_000;
const ANALYST_SWEEP_LIMIT_MS = 80_000;
const ANALYST_TOTAL_BUDGET_MS = 285_000;

/**
 * The wire shape a cleansing agent emits for one proposal. addRow cells
 * arrive as {fiscalYear, value} pairs (JSON-schema-friendly); validProposals
 * normalizes them into the FinAdjustmentProposal record shape.
 */
type AgentProposal = Omit<FinAdjustmentProposal, "cells"> & {
  cells?: { fiscalYear: string; value: number }[] | Record<string, number | null> | null;
  citationIndexes?: number[];
  applyNow?: boolean;
};

/** A normalized, table-checked proposal ready for insertFinAdjustment. */
type ValidProposal = FinAdjustmentProposal & { citationIndexes: number[]; applyNow?: boolean };

interface SuggestOutput {
  note: string;
  proposals: AgentProposal[];
}

interface AnalystOutput {
  reply: string;
  /** Non-empty = the analyst needs the desk to research disclosed figures first. */
  researchQueries: string[];
  proposals: AgentProposal[];
  applyAdjustmentIds: string[];
  revertAdjustmentIds: string[];
  dismissAdjustmentIds: string[];
}

// ---------------------------------------------------------------------------
// Chat turn status markers (settings kv) — the analyst desk's thread mirrors
// the main desk chat: BUSY survives navigation, CANCEL discards the in-flight
// reply, ERROR stores the honest failure reason for the next poll.
// ---------------------------------------------------------------------------

export const finChatBusyKey = (symbol: string) => `finChatBusy:${symbol}`;
export const finChatErrorKey = (symbol: string) => `finChatError:${symbol}`;
export const finChatCancelKey = (symbol: string) => `finChatCancel:${symbol}`;
const FIN_CHAT_BUSY_STALE_MS = 6 * 60_000;

export async function finChatBusy(userId: string, symbol: string): Promise<boolean> {
  const at = await getSetting(userId, finChatBusyKey(symbol)).catch(() => null);
  return !!at && Date.now() - Date.parse(at) < FIN_CHAT_BUSY_STALE_MS;
}

export async function finChatError(userId: string, symbol: string): Promise<string | null> {
  const err = await getSetting(userId, finChatErrorKey(symbol)).catch(() => null);
  return err?.trim() ? err : null;
}

// ---------------------------------------------------------------------------
// Proposal validation — shared by both surfaces. Belt-and-braces: the schema
// already constrains shape, but every number that lands in the record is
// re-checked against the actual table here.
// ---------------------------------------------------------------------------

const ROW_FORMATS = new Set<string>(["money", "pct", "ratio", "x", "perShare", "shares"]);
const ROW_GROUPS = new Set<string>(["income", "returns", "balance", "cashflow", "dcf", "perShare", "custom"]);

/** Op-aware identity of an adjustment/proposal, for the no-duplication ledger. */
function identityKey(a: {
  op?: FinAdjustmentOp | null;
  metricKey: string;
  fiscalYear: string;
  title: string;
  value?: number | null;
  rowLabel?: string | null;
}): string {
  const title = a.title.toLowerCase().trim();
  switch (a.op ?? "delta") {
    case "set":
      return `set|${a.metricKey}|${a.fiscalYear}|${a.value ?? ""}`;
    case "addRow":
      return `addRow|${(a.rowLabel ?? a.metricKey).toLowerCase().trim()}`;
    case "removeRow":
      return `removeRow|${a.metricKey}`;
    case "addYear":
      return `addYear|${a.fiscalYear}`;
    case "removeYear":
      return `removeYear|${a.fiscalYear}`;
    default:
      return `delta|${a.metricKey}|${a.fiscalYear}|${title}`;
  }
}

/** addRow cells in either wire shape → [year, value] entries. */
function cellEntries(cells: AgentProposal["cells"]): [string, number | null][] {
  if (!cells) return [];
  if (Array.isArray(cells)) {
    return cells.map((c) => [String(c?.fiscalYear ?? "").trim(), c?.value ?? null]);
  }
  return Object.entries(cells);
}

/**
 * Validate + normalize what an agent proposed against the actual table and
 * the bench's history. Belt-and-braces: the schema already constrains shape,
 * but every number and target that lands in the record is re-checked here.
 * Board edits (op ≠ "delta") pass only when `allowBoardEdits` — the analyst
 * desk implementing an explicit investor request; the suggestion pass never
 * emits them. Proposals are processed in emission order so a set may target
 * a row/year added earlier in the same batch.
 */
function validProposals(
  raw: AgentProposal[] | undefined,
  fin: TickerFinancials,
  existing: FinAdjustment[],
  cap: number,
  allowBoardEdits = false
): ValidProposal[] {
  const out: ValidProposal[] = [];
  const live = existing.filter((a) => a.status !== "reverted"); // a reverted item may honestly be re-proposed
  const seen = new Set(live.map((a) => identityKey(a)));

  // Legal targets: the reported grid plus rows/years already added on the
  // bench (pending or applied — a set against a pending addRow simply stays
  // inert until both are applied) plus ones added earlier in this batch.
  const knownYears = new Set(fin.fiscalYears);
  const knownRowKeys = new Set(fin.metrics.map((m) => m.key));
  for (const a of existing) {
    if (a.status === "dismissed" || a.status === "reverted") continue;
    if (a.op === "addYear" && a.fiscalYear) knownYears.add(a.fiscalYear);
    if (a.op === "addRow" && a.metricKey) knownRowKeys.add(a.metricKey);
  }

  const push = (p: ValidProposal) => {
    const key = identityKey(p);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };
  const base = (p: AgentProposal, op: FinAdjustmentOp): ValidProposal => ({
    ...p,
    op,
    delta: op === "delta" ? p.delta : 0,
    value: null,
    rowLabel: null,
    rowFormat: null,
    rowGroup: null,
    cells: null,
    citationIndexes: Array.isArray(p.citationIndexes)
      ? p.citationIndexes.filter((n) => Number.isInteger(n))
      : [],
  });

  for (const p of raw ?? []) {
    if (out.length >= cap) break;
    if (!p || !p.title?.trim()) continue;
    const op: FinAdjustmentOp = p.op && allowBoardEdits ? p.op : "delta";
    if (p.op && p.op !== "delta" && !allowBoardEdits) continue; // never launder a board edit into a delta

    switch (op) {
      case "delta": {
        if (!ADJUSTABLE.has(p.metricKey)) continue;
        // Deltas trace disclosed amounts against REPORTED cells — original years only.
        if (!fin.fiscalYears.includes(p.fiscalYear)) continue;
        if (!Number.isFinite(p.delta) || p.delta === 0) continue;
        // Same line, same year, same amount = the same item under another name.
        if (
          live.some(
            (a) =>
              (a.op ?? "delta") === "delta" &&
              a.metricKey === p.metricKey &&
              a.fiscalYear === p.fiscalYear &&
              Math.abs(a.delta - p.delta) <= Math.abs(p.delta) * 1e-6
          )
        ) {
          continue;
        }
        push(base(p, "delta"));
        break;
      }
      case "set": {
        if (!knownRowKeys.has(p.metricKey)) continue;
        if (!knownYears.has(p.fiscalYear)) continue;
        if (p.value == null || !Number.isFinite(p.value)) continue;
        push({ ...base(p, "set"), value: p.value });
        break;
      }
      case "addRow": {
        const label = (p.rowLabel ?? "").trim().slice(0, 80);
        if (!label) continue;
        if (seen.has(identityKey({ op: "addRow", metricKey: "", fiscalYear: "", title: p.title, rowLabel: label }))) continue;
        const cells: Record<string, number | null> = {};
        for (const [year, v] of cellEntries(p.cells)) {
          if (!knownYears.has(year) || v == null || !Number.isFinite(v)) continue;
          cells[year] = v;
        }
        // The row's stable key, from its label; unique against every known row.
        const slug =
          label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "row";
        let key = `custom:${slug}`;
        for (let n = 2; knownRowKeys.has(key); n++) key = `custom:${slug}-${n}`;
        knownRowKeys.add(key);
        push({
          ...base(p, "addRow"),
          metricKey: key,
          fiscalYear: "",
          rowLabel: label,
          rowFormat: ROW_FORMATS.has(p.rowFormat ?? "") ? (p.rowFormat as MetricFormat) : "money",
          rowGroup: ROW_GROUPS.has(p.rowGroup ?? "") ? (p.rowGroup as MetricGroup) : "custom",
          cells,
        });
        break;
      }
      case "removeRow": {
        if (!knownRowKeys.has(p.metricKey)) continue;
        push({ ...base(p, "removeRow"), fiscalYear: "" });
        break;
      }
      case "addYear": {
        const year = (p.fiscalYear ?? "").trim();
        if (!/^\d{4}$/.test(year)) continue;
        if (knownYears.has(year)) continue;
        knownYears.add(year);
        push({ ...base(p, "addYear"), metricKey: "", fiscalYear: year });
        break;
      }
      case "removeYear": {
        if (!knownYears.has(p.fiscalYear)) continue;
        push({ ...base(p, "removeYear"), metricKey: "" });
        break;
      }
    }
  }
  return out.slice(0, cap);
}

/** Resolve citationIndexes into Citation[] against a numbered source list. */
function citationsFor(indexes: number[] | undefined, sources: Citation[]): Citation[] {
  const out: Citation[] = [];
  for (const n of indexes ?? []) {
    const src = sources[n];
    if (src?.url && !out.some((c) => c.url === src.url)) out.push(src);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The suggestion pass ("Suggest moderations") — kicked off by the route via
// after(), mirroring the diligence research pipeline.
// ---------------------------------------------------------------------------

const SWEEP_RULES = `Be exhaustively company-specific: name the exact item, the disclosure it appears in (which filing/statement/note, which fiscal year), the DISCLOSED amount with its currency, pre-tax vs after-tax where stated, and which reported line it sits in (revenue, operating income, net income, operating cash flow). Date everything. Prefer the company's own filings and statement notes over press retellings. Skip stock-price commentary. Label anything unverifiable "(unverified)"; where the record is thin, say so plainly rather than estimating.`;

function noiseSweepPrompt(name: string, symbol: string, years: string): string {
  return `You are a forensic-accounting research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

Find the ONE-TIME AND NON-OPERATING ITEMS distorting ${name}'s reported results for fiscal years ${years}: impairments and write-downs (goodwill, assets), legal settlements and fines, restructuring charges, gains or losses on disposals/divestitures, discontinued operations, insurance recoveries, one-off tax benefits or charges, and any income stream the company itself flags as non-recurring or that has no forward claim. For each: the disclosed amount, the fiscal year, the reported line it sits in, and whether the company disclosed a tax effect. Also note explicitly if supposedly "one-time" charges (e.g. restructuring) recur across multiple years — that pattern matters as much as the amounts. ${SWEEP_RULES}`;
}

function windfallSweepPrompt(name: string, symbol: string, years: string): string {
  return `You are a forensic-accounting research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

Find the WINDFALL AND MARK-TO-MARKET GAINS flattering ${name}'s reported results for fiscal years ${years}: unrealized/mark-to-market gains or losses on investment stakes and securities, revaluation gains when a held company's valuation jumped (an IPO of a portfolio company, a private stake marked up after a funding round), equity-method one-offs, bargain-purchase gains, gains on sale of investments, one-off government subsidies or credits. For each: the disclosed amount, the fiscal year, the reported line it sits in (many sit in net income but not operating income or operating cash flow), whether it is realized or unrealized, and any disclosed tax effect. ${SWEEP_RULES}`;
}

/**
 * The delta-anomaly sweep: the deterministic scan flagged reported line-years
 * that moved far outside their own history — hunt the disclosure behind each.
 */
function anomalySweepPrompt(
  name: string,
  symbol: string,
  anomalies: DeltaAnomaly[],
  currency: string | null
): string {
  return `You are a forensic-accounting research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

The desk ran a deterministic scan of ${name}'s reported table and flagged these ABNORMAL PERIOD-OVER-PERIOD MOVES — each far outside that line's own typical variation across the reported fiscal years:

${deltaAnomalyLines(anomalies, currency)}

For EACH flagged move, hunt the disclosures that explain it. Was a one-time or abnormal item added to (or charged against) that line — an impairment or write-down, a settlement or fine, a disposal or divestiture gain, an unrealized mark-to-market swing, a revaluation when a held stake's paper value jumped, a one-off tax or subsidy item, an accounting-policy change, an acquisition folding a business in? Name the specific item, the DISCLOSED amount with its currency, the exact filing/statement/note it appears in, and which reported line and fiscal year it affects. Where the move is genuine operating performance — real price/volume, a true step-change in the business, an honest collapse in earnings — SAY SO plainly: genuine performance must never be cleansed away, and an honest "this move is real" is a first-class finding. ${SWEEP_RULES}`;
}

/** One focused sweep for a query the FINANCIAL ANALYST raised mid-conversation. */
function chatResearchPrompt(
  name: string,
  symbol: string,
  fin: TickerFinancials,
  query: string
): string {
  const cur = fin.currency ?? "USD";
  const currencyNote =
    fin.currencyMismatch && fin.tradingCurrency
      ? ` Note: ${symbol}'s statements are reported in ${cur} while the listing trades in ${fin.tradingCurrency} — report each amount in the currency the disclosure itself uses and SAY which it is; never convert.`
      : "";
  return `You are a forensic-accounting research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

RESEARCH QUERY FROM THE DESK'S FINANCIAL ANALYST:
${query}

Find the DISCLOSED figures that answer it, from primary sources first — securities filings (10-K/10-Q/20-F and their statement notes), earnings releases, call transcripts, regulator documents — then serious trade press. For each figure: the exact amount with its currency, the fiscal period it belongs to, which reported line it sits in (revenue, operating income, net income, operating cash flow), pre-tax vs after-tax where stated, and the exact disclosure it appears in.${currencyNote} ${SWEEP_RULES}`;
}

/**
 * Execute a suggestion pass created by the route: two grounded sweeps over
 * the company's disclosures, then one synthesis mapping findings onto the
 * ACTUAL reported table as adjustment proposals. Everything parks at
 * 'suggested' — the review gate; failures land at 'error'.
 */
export async function executeCleansingSuggest(
  userId: string,
  runId: string,
  symbol: string
): Promise<void> {
  try {
    const ticker = await getTicker(userId, symbol);
    if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
    const fin = await getFinancials(symbol);
    if (!fin || fin.fiscalYears.length === 0) {
      throw new Error("Financials are unavailable for this ticker.");
    }
    const existing = await listFinAdjustments(userId, symbol);

    const [deepModel, synthModel, boardBlock] = await Promise.all([
      resolveModel("scoutDeep"),
      resolveModel("diligence"),
      signalBoardContext(userId, symbol).catch(() => ""),
    ]);

    const yearsSpan = `${fin.fiscalYears[0]}–${fin.fiscalYears[fin.fiscalYears.length - 1]}`;
    // Deterministic first: which reported line-years moved far outside their
    // own typical period-over-period variation? Those outliers get their own
    // dedicated sweep — the likeliest hiding places of one-time items.
    const anomalies = deltaAnomalies(fin);
    const jobs = [
      { label: "One-time & non-operating items", prompt: noiseSweepPrompt(ticker.name, symbol, yearsSpan) },
      { label: "Windfall & mark-to-market gains", prompt: windfallSweepPrompt(ticker.name, symbol, yearsSpan) },
      ...(anomalies.length > 0
        ? [
            {
              label: "Delta-anomaly investigation",
              prompt: anomalySweepPrompt(ticker.name, symbol, anomalies, fin.currency),
            },
          ]
        : []),
    ];
    const settled = await Promise.allSettled(
      jobs.map((j) =>
        withDeadline(
          `fin-sweep:${j.label}`,
          (signal) =>
            geminiGroundedSearch(j.prompt, {
              model: deepModel,
              meta: { userId, feature: "cleansing" },
              signal,
            }),
          SWEEP_LIMIT_MS
        ).then((r) => ({ label: j.label, text: r.text, sources: r.sources }))
      )
    );
    const sweeps = settled
      .filter(
        (s): s is PromiseFulfilledResult<{ label: string; text: string; sources: Citation[] }> =>
          s.status === "fulfilled"
      )
      .map((s) => s.value);
    if (sweeps.length === 0) throw new Error("All research sweeps failed — try again.");

    // Cooperative cancellation before the flagship synthesis call.
    if ((await finSuggestRunStatus(runId)) !== "running") {
      console.log(`[scalae] cleansing suggest ${runId} stopped by the investor.`);
      return;
    }

    // Number the deduped sources so proposals cite [n] (the runs' idiom).
    const allSources: Citation[] = [];
    const indexOf = new Map<string, number>();
    for (const s of sweeps) {
      for (const src of s.sources) {
        if (!indexOf.has(src.url)) {
          indexOf.set(src.url, allSources.length);
          allSources.push(withDomain({ ...src, foundBy: [`Cleansing: ${s.label}`] }));
        }
      }
    }
    const researchBlock = sweeps
      .map(
        (s) =>
          `=== ${s.label} ===\n${s.text}\nSources used by this sweep: ${
            s.sources.map((src) => `[${indexOf.get(src.url)}] ${src.title}`).join(", ") || "(none)"
          }`
      )
      .join("\n\n");
    const sourceList = allSources.map((s, i) => `[${i}] ${s.title} — ${s.url}`).join("\n");

    const task = `Today is ${new Date().toDateString()}.

THE REPORTED FINANCIALS (${fin.source}; the table the investor's cleansed view overlays):
${reportedTableText(fin)}

EXISTING ADJUSTMENTS ON THIS BENCH (never duplicate; dismissed items stay dismissed absent materially new evidence):
${adjustmentLines(existing, fin.currency)}

DELTA ANOMALIES (deterministic scan of the reported table — line-years whose period-over-period move is far outside that line's own typical variation; the dedicated sweep investigated each):
${deltaAnomalyLines(anomalies, fin.currency)}

FIELD RESEARCH (grounded sweeps over ${ticker.name}'s disclosures; numbered sources at the end):
${researchBlock}

NUMBERED SOURCES:
${sourceList || "(none)"}

${boardBlock}

TASK: Propose the company-specific moderations this record supports, per the bench laws — genuine one-offs and windfalls only, both directions, every delta traced to a disclosed amount, placed on the exact reported line and fiscal year it sits in (one proposal per affected line-year). RECONCILE each delta against the reported table above: a removal must not exceed the reported cell, the fiscal year must exist in the table, and the cell must not be null. Skip anything the sweeps could not pin to a disclosed amount. Work the DELTA ANOMALIES explicitly: for each flagged line-year, either propose the disclosed one-time or abnormal item(s) behind the move, or account for it in the pass note as genuine business performance that must stand — no flagged anomaly goes unaddressed, and a real move is never cleansed away. Then write the pass note (what you examined, each anomaly's verdict, what you found in each direction, what you deliberately did not propose and why).

LANGUAGE: Write every output field in English — the bench's stored form is canonical English; the app translates for display.`;

    const out = await withDeadline(
      "fin-suggest",
      (signal) =>
        claudeJSON<SuggestOutput>({
          model: synthModel,
          signal,
          system: [
            { text: DESK_DOCTRINE, cache: true },
            { text: `${deskIdentity(symbol, ticker.name)}\n\n${CLEANSING_DOCTRINE}` },
          ],
          messages: [{ role: "user", content: task }],
          schema: CLEANSING_SUGGEST_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 8000,
          effort: "medium",
          meta: { userId, feature: "cleansing" },
        }),
      SUGGEST_SYNTHESIS_LIMIT_MS
    );

    // The run may have been stopped while the synthesis ran — park nothing.
    if ((await finSuggestRunStatus(runId)) !== "running") {
      console.log(`[scalae] cleansing suggest ${runId} stopped during synthesis.`);
      return;
    }

    const proposals = validProposals(out.proposals, fin, existing, 12);
    for (const p of proposals) {
      const adj = await insertFinAdjustment(
        userId,
        symbol,
        p,
        "suggest",
        citationsFor(p.citationIndexes, allSources)
      );
      await insertFinCleansingEvent(
        userId,
        symbol,
        adj.id,
        "suggested",
        describeAdjustment(adj, fin.currency)
      ).catch(() => {});
    }
    const note = (out.note ?? "").trim().slice(0, 1000);
    await finishFinSuggestRun(runId, note, proposals.length);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[scalae] cleansing suggest ${runId} failed:`, msg);
    await failFinSuggestRun(runId, msg).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// The financial analyst desk (the cleansing chat).
// ---------------------------------------------------------------------------

export interface FinAnalystTurnResult {
  message: FinMessage | null;
  paused?: boolean;
}

/**
 * Handle one analyst-desk turn. The analyst implements the investor's
 * customization requests as precise adjustments: parked for review by
 * default, applied in the same gesture only when the message is an explicit
 * command (the ask is the approval). Explicit apply/revert/dismiss requests
 * on existing adjustments execute directly, mirroring the main desk chat.
 */
export async function handleFinAnalystTurn(
  userId: string,
  symbol: string,
  userText: string,
  opts: { retry?: boolean; lang?: Lang } = {}
): Promise<FinAnalystTurnResult> {
  const ticker = await getTicker(userId, symbol);
  if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
  const fin = await getFinancials(symbol);
  if (!fin || fin.fiscalYears.length === 0) {
    throw new Error("Financials are unavailable for this ticker.");
  }

  if (!opts.retry) {
    await insertFinMessage(userId, symbol, "user", userText);
  }

  const turnStartedAt = new Date().toISOString();
  await setSetting(userId, finChatBusyKey(symbol), turnStartedAt).catch(() => {});
  await setSetting(userId, finChatErrorKey(symbol), "").catch(() => {});
  const clearBusy = () => setSetting(userId, finChatBusyKey(symbol), "").catch(() => {});
  const pausedByInvestor = async () =>
    ((await getSetting(userId, finChatCancelKey(symbol)).catch(() => null)) ?? "") >= turnStartedAt;

  // The whole ticker in view (FOUNDATION: one connected desk): the bench
  // pieces plus the signal board and the due-diligence record, read-only.
  const [adjustments, events, boardBlock, ddBlock] = await Promise.all([
    listFinAdjustments(userId, symbol),
    listFinCleansingEvents(userId, symbol, 30),
    signalBoardContext(userId, symbol).catch(() => ""),
    diligenceRecordContext(userId, symbol).catch(() => ""),
  ]);
  const applied = adjustments.filter((a) => a.status === "applied");
  const cleansed = applied.length > 0 ? applyCleansing(fin, applied) : null;

  // Numbered source list: the union of every existing adjustment's sources,
  // so the analyst can cite [n] when reusing an already-traced disclosure.
  const sources: Citation[] = [];
  for (const a of adjustments) {
    for (const c of a.sources) {
      if (c?.url && !sources.some((s) => s.url === c.url)) sources.push(c);
    }
  }
  const sourceList = sources.map((s, i) => `[${i}] ${s.title} — ${s.url}`).join("\n");

  const cleansedBlock = cleansed
    ? `THE CURRENT RAW → CLEANSED DIFF (every cell the applied adjustments move; "derived" = recomputed from adjusted inputs):
${cleansed.cells
        .map(
          (c) =>
            `- ${c.metricKey} FY${c.year}: ${c.raw ?? "null"} → ${c.cleansed ?? "null"}${c.derived ? " (derived)" : ""}`
        )
        .join("\n") || "(none)"}`
    : "THE CURRENT RAW → CLEANSED DIFF: (no applied adjustments yet — the cleansed view equals the reported view)";

  const benchContext = `BENCH STATE (today: ${new Date().toISOString().slice(0, 10)}):

THE REPORTED FINANCIALS (${fin.source}):
${reportedTableText(fin)}

ADJUSTMENTS ON THIS BENCH (address them by id):
${adjustmentLines(adjustments, fin.currency)}

${cleansedBlock}

RECENT BENCH HISTORY (audit log, newest first):
${events.map((e) => `- ${e.at.slice(0, 10)} ${e.action}: ${e.detail}`).join("\n") || "(none)"}

NUMBERED SOURCES (from existing adjustments; cite [n] when you reuse one):
${sourceList || "(none)"}

${[boardBlock, ddBlock].filter(Boolean).join("\n\n")}`;

  const languageDirective =
    opts.lang === "zh"
      ? `

LANGUAGE: The investor uses Simplified Chinese. Write "reply" in natural, professional Simplified Chinese (keep ticker symbols, company names, metric keys and numbers as-is). EVERYTHING ELSE stays in ENGLISH: proposal titles, rationales, and the ids you place in the action arrays (copy them verbatim).`
      : "";

  const system = [
    { text: DESK_DOCTRINE, cache: true },
    {
      text: `${deskIdentity(symbol, ticker.name)}

${CLEANSING_DOCTRINE}

${FIN_ANALYST_DOCTRINE}

${benchContext}${languageDirective}`,
    },
  ];

  const history = (await listFinMessages(userId, symbol, 60)).slice(-16);
  const messages = history.map((m) => ({
    role: m.role,
    content: m.content || "…",
  }));
  const chatModel = await resolveModel("chat");
  const analystCall = (
    msgs: { role: "user" | "assistant"; content: string }[],
    label: string,
    limitMs: number
  ) =>
    withDeadline(
      label,
      (signal) =>
        claudeJSON<AnalystOutput>({
          model: chatModel,
          signal,
          system,
          messages: msgs,
          schema: FIN_ANALYST_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 8000,
          effort: effortFromEnv("CLAUDE_FIN_ANALYST_EFFORT", "medium"),
          meta: { userId, feature: "cleansing" },
          fallbackModel: CLAUDE_OVERLOAD_FALLBACK,
        }),
      limitMs
    );

  const turnStart = Date.now();
  let out = await analystCall(messages, "Financial analyst reply", ANALYST_PHASE1_LIMIT_MS);

  // --- the research round: the analyst asked the desk to pull the record ---
  // Phase 1 may request grounded web research when the bench lacks disclosed
  // amounts. The desk runs the queries and re-asks the analyst IN THE SAME
  // TURN for the specific plan; every plan proposal parks for review (the
  // signal-proposal gate) — researched numbers are approved, never assumed.
  const queries = (out.researchQueries ?? [])
    .map((q) => (typeof q === "string" ? q.trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
  const researched = queries.length > 0;
  let citationPool = sources;
  if (researched) {
    if (await pausedByInvestor()) {
      await clearBusy();
      return { message: null, paused: true };
    }
    const deepModel = await resolveModel("scoutDeep");
    const settled = await Promise.allSettled(
      queries.map((q) =>
        withDeadline(
          "fin-chat-research",
          (signal) =>
            geminiGroundedSearch(chatResearchPrompt(ticker.name, symbol, fin, q), {
              model: deepModel,
              meta: { userId, feature: "cleansing" },
              signal,
            }),
          ANALYST_SWEEP_LIMIT_MS
        ).then((r) => ({ query: q, text: r.text, sources: r.sources }))
      )
    );
    const sweeps = settled
      .filter(
        (s): s is PromiseFulfilledResult<{ query: string; text: string; sources: Citation[] }> =>
          s.status === "fulfilled"
      )
      .map((s) => s.value);

    // New sources continue the numbering the system context already uses.
    const researchSources: Citation[] = [];
    for (const s of sweeps) {
      for (const src of s.sources) {
        if (
          src?.url &&
          !sources.some((x) => x.url === src.url) &&
          !researchSources.some((x) => x.url === src.url)
        ) {
          researchSources.push(withDomain({ ...src, foundBy: ["Analyst desk research"] }));
        }
      }
    }
    citationPool = [...sources, ...researchSources];

    const findings = sweeps.length
      ? sweeps.map((s) => `=== Query: ${s.query} ===\n${s.text}`).join("\n\n")
      : "(every research sweep failed — say so plainly, name the figure still missing, and propose nothing)";
    const researchBlock = `[DESK RESEARCH RESULTS — a system payload, not the investor speaking. You asked the desk to research; the findings are below. Now deliver the SPECIFIC PLAN: state each intended adjustment in your reply (line, fiscal year, signed delta in raw ${fin.currency ?? "statement-currency"} units, the disclosure it traces to, cited [n]) and emit the matching proposals with applyNow=false — research-derived amounts always park for the investor's review. Where no usable disclosed figure came back, say so instead of estimating. researchQueries must be empty on this pass.]

${findings}

ADDITIONAL NUMBERED SOURCES (continuing your context's numbering):
${researchSources.map((s, i) => `[${sources.length + i}] ${s.title} — ${s.url}`).join("\n") || "(none)"}`;

    if (await pausedByInvestor()) {
      await clearBusy();
      return { message: null, paused: true };
    }
    out = await analystCall(
      [
        ...messages,
        { role: "assistant", content: out.reply?.trim() || "(pulling the filings…)" },
        { role: "user", content: researchBlock },
      ],
      "Financial analyst reply (post-research)",
      Math.max(55_000, ANALYST_TOTAL_BUDGET_MS - (Date.now() - turnStart))
    );
  }

  if (await pausedByInvestor()) {
    await clearBusy();
    return { message: null, paused: true };
  }

  // --- new adjustments from this turn ---
  // Parked by default; applied in the same gesture ONLY for an explicit
  // delta command whose amounts were already on the bench. A turn that needed
  // research always parks — the investor approves the specific numbers the
  // desk found, exactly like a proposed signal. BOARD EDITS always park, no
  // matter how explicit the ask: request-only, never automatic.
  const created: string[] = [];
  const proposals = validProposals(out.proposals, fin, adjustments, 16, true);
  for (const p of proposals) {
    const parked = researched || p.applyNow !== true || (p.op ?? "delta") !== "delta";
    const adj = await insertFinAdjustment(
      userId,
      symbol,
      p,
      "analyst",
      citationsFor(p.citationIndexes, citationPool),
      parked ? "suggested" : "applied"
    );
    created.push(adj.id);
    await insertFinCleansingEvent(
      userId,
      symbol,
      adj.id,
      "suggested",
      describeAdjustment(adj, fin.currency)
    ).catch(() => {});
    if (!parked) {
      await insertFinCleansingEvent(
        userId,
        symbol,
        adj.id,
        "applied",
        describeAdjustment(adj, fin.currency)
      ).catch(() => {});
    }
  }

  // --- investor-directed actions on existing adjustments (the ask IS the approval) ---
  const act = async (ids: string[] | undefined, action: "apply" | "dismiss" | "revert") => {
    for (const id of ids ?? []) {
      const hit = adjustments.find((a) => a.id === id);
      if (!hit) continue;
      const updated = await transitionFinAdjustment(userId, id, action);
      if (updated) {
        await insertFinCleansingEvent(
          userId,
          symbol,
          id,
          action === "apply" ? "applied" : action === "dismiss" ? "dismissed" : "reverted",
          describeAdjustment(updated, fin.currency)
        ).catch(() => {});
      }
    }
  };
  await act(out.applyAdjustmentIds, "apply");
  await act(out.revertAdjustmentIds, "revert");
  await act(out.dismissAdjustmentIds, "dismiss");

  // Defence in depth against a budget-starved stub reply (the chat idiom).
  const meaningful = /[\p{L}\p{N}]/u.test(out.reply ?? "");
  const replyText = meaningful
    ? out.reply
    : opts.lang === "zh"
      ? "我已处理您的请求，但书面回复生成异常——请再问一次，我会完整作答。"
      : "I processed that, but my written reply came back malformed — please ask again and I'll respond in full.";

  const message = await insertFinMessage(userId, symbol, "assistant", replyText, created);
  await clearBusy();
  return { message };
}
