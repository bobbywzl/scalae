import { claudeJSON, effortFromEnv } from "../ai/claude";
import { CLAUDE_OVERLOAD_FALLBACK } from "../ai/fallback";
import { geminiGroundedSearch } from "../ai/gemini";
import { resolveModel } from "../ai/models";
import {
  ADJUSTABLE_METRIC_KEYS,
  adjustmentLines,
  applyCleansing,
  describeAdjustment,
  reportedTableText,
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
  FinAdjustmentProposal,
  FinMessage,
  TickerFinancials,
} from "../types";

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
const ANALYST_DEADLINE_MS = 210_000;

interface SuggestOutput {
  note: string;
  proposals: (FinAdjustmentProposal & { citationIndexes: number[] })[];
}

interface AnalystOutput {
  reply: string;
  proposals: (FinAdjustmentProposal & { citationIndexes: number[]; applyNow: boolean })[];
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

function validProposals<T extends FinAdjustmentProposal>(
  raw: T[] | undefined,
  fin: TickerFinancials,
  existing: FinAdjustment[],
  cap: number
): T[] {
  const out: T[] = [];
  const seen = new Set(
    existing
      .filter((a) => a.status !== "reverted") // a reverted item may honestly be re-proposed
      .map((a) => `${a.metricKey}|${a.fiscalYear}|${a.title.toLowerCase().trim()}`)
  );
  for (const p of raw ?? []) {
    if (!p || !ADJUSTABLE.has(p.metricKey)) continue;
    if (!fin.fiscalYears.includes(p.fiscalYear)) continue;
    if (!Number.isFinite(p.delta) || p.delta === 0) continue;
    if (!p.title?.trim()) continue;
    const key = `${p.metricKey}|${p.fiscalYear}|${p.title.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    // Same line, same year, same amount = the same item under another name.
    if (
      existing.some(
        (a) =>
          a.status !== "reverted" &&
          a.metricKey === p.metricKey &&
          a.fiscalYear === p.fiscalYear &&
          Math.abs(a.delta - p.delta) <= Math.abs(p.delta) * 1e-6
      )
    ) {
      continue;
    }
    seen.add(key);
    out.push(p);
    if (out.length >= cap) break;
  }
  return out;
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

    const [deepModel, synthModel] = await Promise.all([
      resolveModel("scoutDeep"),
      resolveModel("diligence"),
    ]);

    const yearsSpan = `${fin.fiscalYears[0]}–${fin.fiscalYears[fin.fiscalYears.length - 1]}`;
    const jobs = [
      { label: "One-time & non-operating items", prompt: noiseSweepPrompt(ticker.name, symbol, yearsSpan) },
      { label: "Windfall & mark-to-market gains", prompt: windfallSweepPrompt(ticker.name, symbol, yearsSpan) },
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

FIELD RESEARCH (two grounded sweeps over ${ticker.name}'s disclosures; numbered sources at the end):
${researchBlock}

NUMBERED SOURCES:
${sourceList || "(none)"}

TASK: Propose the company-specific moderations this record supports, per the bench laws — genuine one-offs and windfalls only, both directions, every delta traced to a disclosed amount, placed on the exact reported line and fiscal year it sits in (one proposal per affected line-year). RECONCILE each delta against the reported table above: a removal must not exceed the reported cell, the fiscal year must exist in the table, and the cell must not be null. Skip anything the sweeps could not pin to a disclosed amount. Then write the pass note (what you examined, what you found in each direction, what you deliberately did not propose and why).

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

  const [adjustments, events] = await Promise.all([
    listFinAdjustments(userId, symbol),
    listFinCleansingEvents(userId, symbol, 30),
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
${sourceList || "(none)"}`;

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

  const out = await withDeadline(
    "Financial analyst reply",
    (signal) =>
      claudeJSON<AnalystOutput>({
        model: chatModel,
        signal,
        system,
        messages,
        schema: FIN_ANALYST_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 8000,
        effort: effortFromEnv("CLAUDE_FIN_ANALYST_EFFORT", "medium"),
        meta: { userId, feature: "cleansing" },
        fallbackModel: CLAUDE_OVERLOAD_FALLBACK,
      }),
    ANALYST_DEADLINE_MS
  );

  if (await pausedByInvestor()) {
    await clearBusy();
    return { message: null, paused: true };
  }

  // --- new adjustments from this turn (parked, or applied on explicit command) ---
  const created: string[] = [];
  const proposals = validProposals(out.proposals, fin, adjustments, 8);
  for (const p of proposals) {
    const adj = await insertFinAdjustment(
      userId,
      symbol,
      p,
      "analyst",
      citationsFor(p.citationIndexes, sources),
      p.applyNow === true ? "applied" : "suggested"
    );
    created.push(adj.id);
    await insertFinCleansingEvent(
      userId,
      symbol,
      adj.id,
      "suggested",
      describeAdjustment(adj, fin.currency)
    ).catch(() => {});
    if (p.applyNow === true) {
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
