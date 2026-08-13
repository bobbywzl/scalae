import { claudeJSON } from "../ai/claude";
import { geminiGroundedSearch } from "../ai/gemini";
import { resolveModel } from "../ai/models";
import { canonSearchText } from "./canon";
import { researchSignalBackstory } from "./history";
import { cleansingBenchContext } from "./context";
import { withDomain } from "../citations";
import { citationOverlap } from "../compare";
import {
  CONTEXT_BOARD_DOCTRINE,
  CONTEXT_BOARD_SCHEMA,
  DESK_DOCTRINE,
  deskIdentity,
  EXPERT_LOOP_GUIDANCE,
  GAP_SCHEMA,
  QUESTION_METHOD,
  RUN_QUESTIONS_DOCTRINE,
  RUN_QUESTIONS_SCHEMA,
  SIGNAL_CHECK_DOCTRINE,
  SIGNAL_CHECK_SCHEMA,
  SIGNAL_GUIDANCE,
  SYNTHESIS_DOCTRINE,
  SYNTHESIS_SCHEMA,
} from "./framework";
import {
  bumpQuietRuns,
  createRun,
  failRun,
  finishRun,
  getDeskContext,
  getDiligenceSynthesis,
  getSignal,
  getTicker,
  insertDigestItem,
  insertProposal,
  insertReading,
  latestDoneRun,
  listDiligenceEvidence,
  listDiligenceResearch,
  listFocusAreas,
  listMessages,
  listNoteSections,
  listNotes,
  listSignals,
  readingsForSignal,
  reapStuckRuns,
  resetQuietRuns,
  runStatus,
  runningRun,
  saveDeskContext,
  setRunQuestions,
  setRunStage,
  touchLastRun,
} from "../db";
import { diligenceContext } from "../notes";
import { getQuote, quoteLine } from "../market";
import type { Citation, Delta, ReadingLevel, Run, Signal, SignalProposal } from "../types";

interface SynthesisOutput {
  brief: string;
  dossier: string;
  readings: {
    signalKey: string;
    newEvidence: boolean;
    value: number | null;
    valueUnit: string | null;
    level: ReadingLevel;
    delta: Delta;
    confidence: number;
    rationale: string;
    citationIndexes: number[];
  }[];
  digestItems: {
    headline: string;
    summary: string;
    sourceIndex: number | null;
    impact: "positive" | "negative" | "mixed" | "neutral";
    signalNames: string[];
    sourceClass: "primary" | "trade" | "narrative";
    sourceNote: string;
  }[];
  proposals: SignalProposal[];
}

interface GapOutput {
  followUps: { query: string; reason: string; signalKeys: string[] }[];
}

interface QuestionsOutput {
  questions: { question: string; why: string; signalKeys: string[] }[];
}

interface Sweep {
  label: string;
  wave: 1 | 2;
  text: string;
  sources: Citation[];
}

const MAX_FOLLOW_UPS = 4;

/**
 * Strict per-stage wall-clock limit for the SCOUT/TRIAGE/backstory stages.
 * Every such stage must finish under two minutes; 110s leaves headroom under
 * that ceiling and stops any single stage from hanging and eating the budget.
 * Synthesis is the deliberate exception — see SYNTHESIS below.
 */
const STAGE_LIMIT_MS = 110_000;

/**
 * Synthesis is the pipeline's heaviest stage and runs LAST, so a flat 110s
 * starves it — a 10-signal board emits 10 readings + digest + brief + dossier
 * in one call and legitimately needs longer than a scout sweep. Instead we hand
 * it the time actually left in the route's 300s budget: its deadline lands a
 * fixed distance into the run no matter how long the scouts took (ROUTE_BUDGET −
 * elapsed − a reserve for the DB writes), so it gets ~150-200s in the common
 * case yet can never overrun maxDuration and be reaped. See the synthesis call.
 */
const ROUTE_BUDGET_MS = 285_000; // 300s maxDuration minus platform margin
const RECORDING_RESERVE_MS = 15_000; // reserved after synthesis for the writes

/**
 * Synthesis reasoning effort. Default "low" to minimize synthesis wall-clock so
 * the run reliably COMPLETES — this stage is structured judgment over evidence
 * that's already been gathered, not open-ended reasoning, so low effort emits
 * the readings/brief/dossier fast. Raise via CLAUDE_SYNTHESIS_EFFORT
 * (low|medium|high|xhigh|max) once runs have budget headroom to spare.
 */
function synthesisEffort(): "low" | "medium" | "high" | "xhigh" | "max" {
  const env = process.env.CLAUDE_SYNTHESIS_EFFORT?.trim().toLowerCase();
  if (env === "low" || env === "medium" || env === "high" || env === "xhigh" || env === "max") {
    return env;
  }
  return "low";
}

/**
 * Run `fn` under a hard deadline: it receives an AbortSignal that fires at `ms`
 * (so the underlying Claude/Gemini stream is actually cancelled, freeing time
 * and tokens), and the call is also raced against the timer so the stage can
 * NEVER exceed the limit even if a provider ignores the signal. On timeout it
 * rejects with a labeled error; each caller decides whether that's fatal
 * (synthesis) or a graceful degrade (scouts, triage, backstory). Exported for
 * the other user-triggered pipelines (due-diligence research) to share.
 */
export async function withDeadline<T>(
  label: string,
  fn: (signal: AbortSignal) => Promise<T>,
  ms = STAGE_LIMIT_MS
): Promise<T> {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ac.abort();
      reject(new Error(`${label} exceeded its ${Math.round(ms / 1000)}s time limit`));
    }, ms);
  });
  try {
    return await Promise.race([fn(ac.signal), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Sentinel thrown by the pipeline's cooperative-cancellation checkpoints when
 * the investor has stopped the run mid-flight. Caught quietly — a stopped run
 * is already terminal in the db, so there is nothing to fail or record.
 */
const RUN_STOPPED = "RUN_STOPPED";

/** Bail out of the pipeline if the investor stopped this run (see cancelRunningRun). */
async function throwIfStopped(runId: string): Promise<void> {
  if ((await runStatus(runId)) !== "running") throw new Error(RUN_STOPPED);
}

/** Start a run unless one is already going. Returns the run to poll. */
export async function startRun(userId: string, symbol: string): Promise<{ run: Run; started: boolean }> {
  await reapStuckRuns(userId, symbol);
  const existing = await runningRun(userId, symbol);
  if (existing) return { run: existing, started: false };
  const run = await createRun(userId, symbol);
  return { run, started: true };
}

/**
 * Start a single-signal check unless any run (board or scoped) is already
 * going — one research process per desk at a time, same stop button.
 */
export async function startSignalRun(
  userId: string,
  symbol: string,
  signalId: string
): Promise<{ run: Run; started: boolean }> {
  await reapStuckRuns(userId, symbol);
  const existing = await runningRun(userId, symbol);
  if (existing) return { run: existing, started: false };
  const run = await createRun(userId, symbol, signalId);
  return { run, started: true };
}

/**
 * How fresh a window to research: since the last COMPLETED run, else 7 days.
 * Must read latestDoneRun — startRun has already inserted THIS run's row, so
 * an unfiltered latest-run read returns it (finishedAt null) and the adaptive
 * window silently degenerates to a constant 7. `gapDays` carries the true
 * span since the last completed run so the synthesis can disclose an unswept
 * stretch (a desk paused for six weeks must say the six weeks weren't read).
 */
async function researchWindow(
  userId: string,
  symbol: string
): Promise<{ days: number; gapDays: number | null }> {
  const last = await latestDoneRun(userId, symbol);
  if (!last?.finishedAt) return { days: 7, gapDays: null };
  const gapDays = Math.ceil((Date.now() - Date.parse(last.finishedAt)) / 86_400_000);
  return { days: Math.min(14, Math.max(2, gapDays + 1)), gapDays };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Scout prompts — wave 1 (breadth: signals, broad news, primary sources,
// scuttlebutt) and wave 2 (targeted deep dives the analyst commissioned).
// ---------------------------------------------------------------------------

const SCOUT_RULES = `Ground every finding in search results. For each finding output:
- HEADLINE (date, source)
- 2-3 sentence factual summary with concrete numbers where available
Skip stock-price commentary, analyst price-target chatter, and peer-momentum/FOMO framing. Prefer revealed behavior and primary mechanism evidence (filings, transcripts, regulator documents, observed pricing/hiring/insider actions) over narrative retellings, and note when a finding's only source is an interested party (the company itself, its bankers, or paid promotion). Never speculate or fill gaps from background knowledge unless labeled "(context)". If genuinely nothing notable was found, say so plainly — an honest "nothing" beats manufactured news.`;

/**
 * The canon's search directives for a sweep (§3 wire-in, point 2) — "" until
 * canon entries land, so pre-canon prompts are byte-identical. Anchored:
 * the culture sweep gets culture directives, the company sweep business-model
 * ones; the deep-dive probe gets all and applies whichever matches.
 */
function canonDirectiveBlock(anchor?: "business-model" | "culture"): string {
  const text = canonSearchText(anchor);
  return text
    ? `\n\nTHE CANON'S SEARCH DIRECTIVES (${anchor ?? "all anchors"} — cited search behaviors from the investor canon): they steer WHERE to look, offer query shapes to adapt to this company, and say which sources each canon investor treated as primary. They add angles and never override the grounding rules above${anchor ? "" : "; apply only the directive(s) whose subject matches this probe, and skip the rest"}:\n${text}`
    : "";
}

function signalSweepPrompt(symbol: string, name: string, days: number, signals: Signal[]): string {
  const signalBlock = signals
    .map((s, i) => `${i + 1}. "${s.name}" — ${s.measurementPlan} (scale: ${s.scale})`)
    .join("\n");
  return `You are a research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

Search the web for developments from roughly the last ${days} days relevant to these tracked signals:

${signalBlock}

${SCOUT_RULES}
Additionally, end each finding with: 'Informs signal(s): #n' for the signal numbers it bears on. If you find nothing for a signal, write 'No news found: "<signal name>"'.`;
}

function broadSweepPrompt(symbol: string, name: string, days: number): string {
  return `You are a research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

Search the web for company developments from roughly the last ${days} days that a long-term business owner must know: earnings and guidance substance, management changes and statements, capital allocation moves (buybacks, dividends, M&A, big capex), regulatory/legal developments, competitive shifts, customer/product traction, accounting or governance red flags.

${SCOUT_RULES}
Do not pad with old background information unless you label it "(context)".${canonDirectiveBlock("business-model")}`;
}

function primarySourcePrompt(symbol: string, name: string, days: number): string {
  return `You are a primary-source research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

Hunt specifically for PRIMARY SOURCES from roughly the last ${days} days — the company's own words and regulators' documents, not press retellings: securities filings and exchange disclosures, earnings releases and call transcripts, investor-relations materials and presentations, regulator filings/orders, court documents. If the freshest primary source predates the window slightly but the desk likely hasn't seen it, include it labeled "(recent primary source)".

For each document found: HEADLINE (date, source), what the company/regulator actually said or reported (2-4 sentences with the concrete numbers), and any gap between the primary source and how the press has characterized it. ${SCOUT_RULES}`;
}

function scuttlebuttPrompt(symbol: string, name: string, days: number): string {
  return `You are a scuttlebutt scout (Phil Fisher's method, run at machine scale) for a value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

Search the web for corporate-culture and conduct evidence from roughly the last ${days} days — how the organization actually behaves: employee sentiment and senior-talent moves (reviews, hiring/layoffs, notable departures), customer experience shifts (product/service quality complaints or praise with substance), treatment of suppliers and partners, management interviews and candor in their own words, trade-press and industry chatter, litigation or regulatory conduct.

Hunt the incentive layer specifically (Munger: behavior follows the comp plan, not the mission statement): executive compensation changes and their metrics/horizons (proxy filings), insider buying and selling, buyback timing vs. option vesting, guidance promises made vs. kept, treatment of bad-news messengers and whistleblowers, and any gap between management's adjusted metrics and GAAP.

Distinguish documented fact from rumor — label anything unverified "(unverified)". ${SCOUT_RULES}${canonDirectiveBlock("culture")}`;
}

function questionSweepPrompt(
  symbol: string,
  name: string,
  days: number,
  qs: { question: string; why: string }[]
): string {
  return `You are a research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

Before any searching, the desk's analyst framed TODAY'S FOCUS QUESTIONS — the open questions this run exists to move. Research each one directly:

${qs.map((q, i) => `Q${i + 1}. ${q.question} (why the desk asks: ${q.why})`).join("\n")}

Search each question from multiple angles and prefer primary sources (filings, transcripts, company statements, regulator documents) over aggregators. Favor evidence from roughly the last ${days} days — but for these questions an older primary source the desk likely hasn't seen is fair game when it actually answers the question (label it with its date). Open every finding with 'Q<n>:' naming the question it informs, and state plainly which questions found NO evidence — an honest "nothing found" is valuable. ${SCOUT_RULES}`;
}

function followUpPrompt(
  symbol: string,
  name: string,
  q: { query: string; reason: string }
): string {
  return `You are a deep-dive research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${new Date().toDateString()}.

The desk's analyst reviewed today's field research and commissioned this targeted probe:

QUESTION: ${q.query}
WHY THE DESK ASKS: ${q.reason}

Research it thoroughly: search from multiple angles, prefer primary sources (filings, transcripts, company statements, regulator documents) over aggregators, and cross-check numbers between sources. Report every relevant fact with its date, source and concrete figures. Explicitly state what could NOT be verified — an honest "couldn't confirm" is valuable. ${SCOUT_RULES}${canonDirectiveBlock()}`;
}

// ---------------------------------------------------------------------------
// Shared desk context: the pieces the question suggestor, the run synthesis
// and the context-board refresher all read.
// ---------------------------------------------------------------------------

/** One signal's board line (key, plan, previous reading, history base rate). */
async function signalBoardLine(key: string, s: Signal, extraNote = ""): Promise<string> {
  const prev = (await readingsForSignal(s.id, 1))[0];
  const prevLine = prev
    ? ` Previous reading (${prev.date.slice(0, 10)}): level=${prev.level}${prev.value != null ? `, value=${prev.value} ${prev.valueUnit ?? ""}` : ""}, confidence=${prev.confidence} — ${prev.rationale}`
    : " No previous reading.";
  const historyLine = s.backstoryBrief ? ` History base rate: ${s.backstoryBrief}` : "";
  return `- [${key}] "${s.name}" (${s.type}, focus: ${s.focusArea}). Plan: ${s.measurementPlan} Scale: ${s.scale}.${prevLine}${historyLine}${extraNote}`;
}

/** The investor's recent chat guidance (newest last) as prompt lines. */
async function investorGuidance(userId: string, symbol: string): Promise<string> {
  return (await listMessages(userId, symbol))
    .filter((m) => m.role === "user")
    .slice(-6)
    .map((m) => `- ${m.content.slice(0, 300)}`)
    .join("\n");
}

/** The due-diligence record block (best-effort; empty when the record is empty). */
async function diligenceRecordBlock(userId: string, symbol: string): Promise<string> {
  return Promise.all([
    listNoteSections(userId, symbol).catch(() => []),
    listNotes(userId, symbol).catch(() => []),
    listDiligenceResearch(userId, symbol).catch(() => []),
    getDiligenceSynthesis(userId, symbol).catch(() => null),
    listDiligenceEvidence(userId, symbol).catch(() => []),
  ]).then(([s, n, r, syn, ev]) => diligenceContext(s, n, r, syn ?? null, ev));
}

/**
 * The stored context board as a prompt block — what past runs answered and
 * established, read BEFORE every new run. Empty string when none exists yet.
 */
async function contextBoardBlock(userId: string, symbol: string): Promise<string> {
  const ctx = await getDeskContext(userId, symbol).catch(() => undefined);
  return ctx?.content?.trim()
    ? `THE DESK'S CONTEXT BOARD (distilled after the previous run — recently ANSWERED questions, established context and open threads; do NOT re-ask what it already answers unless new evidence reopens it):\n${ctx.content.trim()}\n`
    : "";
}

// ---------------------------------------------------------------------------
// The question suggestor, callable on its own — the steerable first stage.
// ---------------------------------------------------------------------------

export interface FramedQuestion {
  question: string;
  why: string;
}

/**
 * Frame today's focus questions WITHOUT starting a run — the review step
 * behind the steerable "Run research now" flow. Same doctrine, same context
 * as the run's own stage 0 (board, record, guidance, context board); the
 * investor edits the output and the run starts with what they submit.
 */
export async function frameRunQuestions(userId: string, symbol: string): Promise<FramedQuestion[]> {
  const ticker = await getTicker(userId, symbol);
  if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
  const signals = await listSignals(userId, symbol, "active");
  if (signals.length === 0) throw new Error("Approve at least one signal before running research.");
  const triageModel = await resolveModel("triage");

  const [boardLines, focusAreas, guidance, ddBlock, ctxBlock] = await Promise.all([
    Promise.all(signals.map((s, i) => signalBoardLine(`S${i + 1}`, s))),
    listFocusAreas(userId, symbol),
    investorGuidance(userId, symbol),
    diligenceRecordBlock(userId, symbol),
    contextBoardBlock(userId, symbol),
  ]);

  const framed = await withDeadline("questions", (signal) =>
    claudeJSON<QuestionsOutput>({
      model: triageModel,
      signal,
      system: [
        { text: DESK_DOCTRINE, cache: true },
        { text: `${deskIdentity(symbol, ticker.name)}\n\n${QUESTION_METHOD}\n\n${RUN_QUESTIONS_DOCTRINE}` },
      ],
      messages: [
        {
          role: "user",
          content: `DESK STATE (today: ${new Date().toDateString()}):

ACTIVE SIGNAL BOARD (with previous readings):
${boardLines.join("\n")}

INVESTOR FOCUS AREAS:
${focusAreas.map((f) => `- ${f.title}: ${f.description}`).join("\n") || "(none recorded)"}

RECENT INVESTOR GUIDANCE (newest last):
${guidance || "(none)"}

${ctxBlock ? `${ctxBlock}\n` : ""}${ddBlock ? `${ddBlock}\n\n` : ""}TASK: Frame today's focus questions per the question-framing doctrine — the 3-6 open questions this run must try to answer, decided BEFORE any searching happens. The investor will review and may edit them before the run starts.`,
        },
      ],
      schema: RUN_QUESTIONS_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 2500,
      effort: "low",
      meta: { userId, feature: "questions" },
    })
  );
  return (framed.questions ?? [])
    .filter((q) => q.question?.trim())
    .slice(0, 6)
    .map((q) => ({ question: q.question.trim(), why: (q.why ?? "").trim() }));
}

// ---------------------------------------------------------------------------
// The context board refresher — the background pass after every run.
// ---------------------------------------------------------------------------

/**
 * Distill the desk's standing context board after a run finishes: what the
 * run's focus questions actually ANSWERED, what is now established about the
 * business across the whole ticker (record, board, guidance), and which
 * threads stay open. Kept behind the scenes and read by the next run's
 * framing and synthesis. Best-effort trailing enrichment — never fatal.
 */
export async function refreshDeskContext(
  userId: string,
  symbol: string,
  runId: string,
  runOutput: { questions: string[]; brief: string }
): Promise<void> {
  const ticker = await getTicker(userId, symbol);
  if (!ticker) return;
  const triageModel = await resolveModel("triage");
  const [prev, guidance, ddBlock] = await Promise.all([
    getDeskContext(userId, symbol).catch(() => undefined),
    investorGuidance(userId, symbol),
    diligenceRecordBlock(userId, symbol),
  ]);

  const out = await withDeadline("contextBoard", (signal) =>
    claudeJSON<{ board: string }>({
      model: triageModel,
      signal,
      system: [
        { text: DESK_DOCTRINE, cache: true },
        { text: `${deskIdentity(symbol, ticker.name)}\n\n${CONTEXT_BOARD_DOCTRINE}` },
      ],
      messages: [
        {
          role: "user",
          content: `Today is ${new Date().toDateString()}. A research run just finished.

THE PREVIOUS CONTEXT BOARD (evolve this — never restart):
${prev?.content?.trim() || "(none yet — this is the desk's first board)"}

THE RUN'S FOCUS QUESTIONS:
${runOutput.questions.map((q, i) => `Q${i + 1}. ${q}`).join("\n") || "(the run had no framed questions)"}

WHAT THE RUN REPORTED (its note to the investor):
${runOutput.brief || "(none)"}

RECENT INVESTOR GUIDANCE (newest last):
${guidance || "(none)"}

${ddBlock ? `${ddBlock}\n\n` : ""}TASK: Refresh the context board per its doctrine — which focus questions this run ANSWERED (with the one-line answer, dated today), what is now established, what stays open.`,
        },
      ],
      schema: CONTEXT_BOARD_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 2500,
      effort: "low",
      meta: { userId, feature: "contextBoard" },
    })
  );
  const board = (out.board ?? "").trim().slice(0, 8000);
  if (board) await saveDeskContext(userId, symbol, board, runId);
}

// ---------------------------------------------------------------------------
// The pipeline
// ---------------------------------------------------------------------------

/**
 * Execute the deep multi-agent pipeline for a run created by startRun():
 *   0) Question framing: the question suggestor decides what today's run must
 *      ANSWER — worked from the certainty gap and the question method over the
 *      board, the due-diligence record and the investor's guidance — and the
 *      framed questions steer every later stage (circle of competence first)
 *   1) Wave-1 breadth sweeps (grounded scouts, parallel): focus questions,
 *      per-signal bundles, broad company news, primary sources, scuttlebutt
 *   2) Gap analysis: the analyst triages evidence vs. the board and
 *      commissions targeted follow-up probes
 *   3) Wave-2 deep-dive sweeps (parallel, stronger scout model)
 *   4) Deep synthesis: signal readings with per-source citations, digest,
 *      brief, new-signal discovery
 */
export async function executeRun(
  userId: string,
  runId: string,
  symbol: string,
  opts: {
    /**
     * Investor-steered focus questions (the reviewed/edited output of
     * frameRunQuestions). When present — even empty — stage 0's framing call
     * is skipped and the run steers by exactly these.
     */
    questions?: string[];
  } = {}
): Promise<void> {
  // Reference for the synthesis budget below: how much of the route's 300s is
  // left when we reach synthesis (the run runs inside a single invocation).
  const runStart = Date.now();
  try {
    const ticker = await getTicker(userId, symbol);
    if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
    const signals = await listSignals(userId, symbol, "active");
    if (signals.length === 0) throw new Error("No active signals — approve some signals first.");

    // Resolve the best currently-available model for each role (self-healing;
    // auto-adopts newer models; env-overridable). See lib/ai/models.ts.
    const [breadthModel, deepModel, triageModel, synthModel] = await Promise.all([
      resolveModel("scoutBreadth"),
      resolveModel("scoutDeep"),
      resolveModel("triage"),
      resolveModel("synthesis"),
    ]);

    const { days, gapDays } = await researchWindow(userId, symbol);
    const bundles = chunk(signals, 5);

    // Board context, the due-diligence record and the investor's guidance are
    // needed BEFORE any searching now — the question suggestor reads them —
    // and are reused by triage and synthesis below.
    // Stable short keys so synthesis readings can't miss on name drift.
    const keyed = signals.map((s, i) => ({ key: `S${i + 1}`, signal: s }));
    const byKey = new Map(keyed.map((k) => [k.key, k.signal]));

    // Keep-both pairs: an active replacement whose replaced signal was
    // knowingly reactivated. The no-duplication discipline must survive that
    // choice — the desk should keep watching for a single merged crux signal,
    // and when the pair's readings demonstrably cite the same evidence, the
    // nudge escalates from "watch for overlap" to "merge now".
    const overlapWith = new Map<string, string>();
    const overlapMeasured = new Map<string, number>();
    const byId = new Map(signals.map((s) => [s.id, s]));
    for (const s of signals) {
      const other = s.replaces ? byId.get(s.replaces) : undefined;
      if (other) {
        overlapWith.set(s.id, other.name);
        overlapWith.set(other.id, s.name);
        const [ra, rb] = await Promise.all([
          readingsForSignal(s.id, 3),
          readingsForSignal(other.id, 3),
        ]);
        const ov = citationOverlap(ra, rb);
        overlapMeasured.set(s.id, ov);
        overlapMeasured.set(other.id, ov);
      }
    }

    const boardBlock = (
      await Promise.all(
        keyed.map(async ({ key, signal: s }) => {
          const measured = overlapMeasured.get(s.id) ?? 0;
          const overlapNote = overlapWith.has(s.id)
            ? measured >= 0.5
              ? ` NOTE: kept alongside "${overlapWith.get(s.id)}" — their recent readings HAVE cited the same evidence (${Math.round(measured * 100)}% source overlap). They are one signal wearing two names: propose the merged replacement NOW with "replaces" set, unless today's evidence clearly separates them.`
              : ` NOTE: the investor knowingly kept this alongside "${overlapWith.get(s.id)}" despite overlap — if both keep reading the same evidence, propose ONE merged replacement with "replaces" set.`
            : "";
          return signalBoardLine(key, s, overlapNote);
        })
      )
    ).join("\n");

    const focusAreas = await listFocusAreas(userId, symbol);
    const guidance = await investorGuidance(userId, symbol);
    // The due-diligence record: the map of what the investor currently
    // understands, which the circle-of-competence loop steers proposals by
    // (EXPERT_LOOP_GUIDANCE). Best-effort — a desk without a record runs as before.
    const ddBlock = await diligenceRecordBlock(userId, symbol);
    // What past runs answered and established — read BEFORE this run works.
    const ctxBlock = await contextBoardBlock(userId, symbol);
    // The reported numbers and the investor's cleansed view (FOUNDATION: "one
    // desk, fully connected" — the chat, compare and diligence surfaces already
    // carry this; the run that writes the readings must see the same numbers).
    // Cache-only and position-free: readings stay unbiased by the ledger.
    const benchBlock = await cleansingBenchContext(userId, symbol).catch(() => "");

    // ---- Stage 0: today's focus questions ----
    // The circle-of-competence discipline made operational (FOUNDATION.md):
    // research starts from the investor's open questions, never from the news.
    // Two paths: STEERED — the investor reviewed/edited the framed questions
    // (frameRunQuestions) and the run uses exactly what they submitted; or
    // UNATTENDED (cron, chat, stale-desk auto-run) — the question suggestor
    // frames them here. Graceful degrade — a failed framing runs unfocused.
    await throwIfStopped(runId);
    let questions: { question: string; why: string; signalKeys: string[] }[] = [];
    if (opts.questions) {
      questions = opts.questions
        .map((q) => ({ question: q.trim(), why: "", signalKeys: [] as string[] }))
        .filter((q) => q.question);
      if (questions.length > 0) {
        await setRunStage(
          runId,
          "questions",
          `Focus questions set by you — ${questions.length} steering this run.`
        );
        await setRunQuestions(runId, questions.map((q) => q.question));
      }
    } else {
      await setRunStage(
        runId,
        "questions",
        `Question suggestor (${triageModel}) framing what today's run must answer — reading the board, the due-diligence record and your guidance…`
      );
      try {
        const framed = await withDeadline("questions", (signal) =>
          claudeJSON<QuestionsOutput>({
            model: triageModel,
            signal,
            // Same cached doctrine prefix as triage/synthesis — the daily cron
            // re-reads it at ~0.1× input cost for every desk it sweeps.
            system: [
              { text: DESK_DOCTRINE, cache: true },
              { text: `${deskIdentity(symbol, ticker.name)}\n\n${QUESTION_METHOD}\n\n${RUN_QUESTIONS_DOCTRINE}` },
            ],
            messages: [
              {
                role: "user",
                content: `DESK STATE (today: ${new Date().toDateString()}):

ACTIVE SIGNAL BOARD (with previous readings):
${boardBlock}

INVESTOR FOCUS AREAS:
${focusAreas.map((f) => `- ${f.title}: ${f.description}`).join("\n") || "(none recorded)"}

RECENT INVESTOR GUIDANCE (newest last):
${guidance || "(none)"}

${ctxBlock ? `${ctxBlock}\n` : ""}${ddBlock ? `${ddBlock}\n\n` : ""}TASK: Frame today's focus questions per the question-framing doctrine — the 3-6 open questions this run must try to answer, decided BEFORE any searching happens.`,
              },
            ],
            schema: RUN_QUESTIONS_SCHEMA as unknown as Record<string, unknown>,
            maxTokens: 2500,
            effort: "low",
            meta: { userId, feature: "questions" },
          })
        );
        questions = (framed.questions ?? [])
          .filter((q) => q.question?.trim())
          .slice(0, 6)
          .map((q) => ({ question: q.question.trim(), why: q.why ?? "", signalKeys: q.signalKeys ?? [] }));
        if (questions.length > 0) await setRunQuestions(runId, questions.map((q) => q.question));
      } catch (e) {
        console.error(
          `[scalae] question framing timed out or failed (running without focus questions):`,
          e instanceof Error ? e.message : e
        );
      }
    }
    const questionsBlock = questions.length
      ? `\nTODAY'S FOCUS QUESTIONS (set before the sweeps — the run exists to move these):\n${questions
          .map(
            (q, i) =>
              `Q${i + 1}. ${q.question}${q.why ? ` — ${q.why}` : ""}${q.signalKeys.length ? ` [serves ${q.signalKeys.join(", ")}]` : ""}`
          )
          .join("\n")}\n`
      : "";
    // Every breadth scout gets the questions as steering; the dedicated
    // focus-question sweep researches them head-on.
    const questionSteer = questions.length
      ? `\n\nTHE DESK'S FOCUS QUESTIONS TODAY (steer searching toward evidence that answers these; tag findings 'Informs Q<n>' where one applies):\n${questions.map((q, i) => `Q${i + 1}. ${q.question}`).join("\n")}`
      : "";

    const waveOneCount = bundles.length + 3 + (questions.length > 0 ? 1 : 0);
    await throwIfStopped(runId);
    await setRunStage(
      runId,
      "sweeping",
      `Scouts (${breadthModel}) sweeping the open web — ${waveOneCount} parallel sweeps: ${questions.length > 0 ? `${questions.length} focus questions, ` : ""}signals, broad news, primary sources, scuttlebutt (${days}-day window)…`
    );

    const waveOneJobs: { label: string; prompt: string }[] = [
      ...(questions.length > 0
        ? [
            {
              label: "Focus-question sweep",
              prompt: questionSweepPrompt(symbol, ticker.name, days, questions),
            },
          ]
        : []),
      ...bundles.map((b, i) => ({
        label: `Signal sweep ${i + 1}: ${b.map((s) => s.name).join(", ")}`,
        prompt: signalSweepPrompt(symbol, ticker.name, days, b) + questionSteer,
      })),
      { label: "Broad company sweep", prompt: broadSweepPrompt(symbol, ticker.name, days) + questionSteer },
      { label: "Primary-source sweep", prompt: primarySourcePrompt(symbol, ticker.name, days) + questionSteer },
      { label: "Culture & scuttlebutt sweep", prompt: scuttlebuttPrompt(symbol, ticker.name, days) + questionSteer },
    ];
    const waveOneSettled = await Promise.allSettled(
      waveOneJobs.map((j) =>
        withDeadline(`sweep:${j.label}`, (signal) =>
          geminiGroundedSearch(j.prompt, { model: breadthModel, meta: { userId, feature: "scoutBreadth" }, signal })
        ).then((r): Sweep => ({ label: j.label, wave: 1, text: r.text, sources: r.sources }))
      )
    );
    const sweeps: Sweep[] = waveOneSettled
      .filter((s): s is PromiseFulfilledResult<Sweep> => s.status === "fulfilled")
      .map((s) => s.value);
    if (sweeps.length === 0) {
      const firstErr = waveOneSettled.find(
        (s) => s.status === "rejected"
      ) as PromiseRejectedResult;
      throw new Error(`All research sweeps failed: ${firstErr?.reason?.message ?? "unknown"}`);
    }

    // ---- Stage 2: the analyst triages wave 1 and commissions deep dives ----
    await throwIfStopped(runId);
    await setRunStage(
      runId,
      "probing",
      `Analyst (${triageModel}) triaging the field research for gaps worth a deep dive…`
    );

    let followUps: GapOutput["followUps"] = [];
    try {
      const waveOneBlock = sweeps
        .map((s) => `=== ${s.label} ===\n${s.text}`)
        .join("\n\n");
      const gap = await withDeadline("triage", (signal) => claudeJSON<GapOutput>({
        model: triageModel,
        signal,
        // Cached doctrine prefix (shared with synthesis and every other desk);
        // only the ticker identity + triage doctrine vary.
        system: [
          { text: DESK_DOCTRINE, cache: true },
          { text: `${deskIdentity(symbol, ticker.name)}\n\n${SYNTHESIS_DOCTRINE}` },
        ],
        messages: [
          {
            role: "user",
            content: `ACTIVE SIGNAL BOARD:\n${boardBlock}\n${questionsBlock}\nFIELD RESEARCH — WAVE 1 (breadth sweeps):\n${waveOneBlock}\n\nTASK: Before final synthesis, decide which threads deserve a targeted deep-dive probe by a research scout. Commission at most ${MAX_FOLLOW_UPS} follow-ups, only where it changes today's readings: focus questions the sweeps left open or half-answered, signals whose evidence is thin or missing, numbers that conflict between sources, red flags mentioned once that need verification against primary sources, or a major development whose business-model/culture implications the sweeps left shallow. Invert first (Munger): give priority to probes that could REFUTE the board's current levels or verify a kill-risk symptom — a probe that can only re-confirm what the desk already believes is usually not worth commissioning. Each query must be a concrete, searchable question. Return an empty list if wave 1 already covers the board — do not invent work.`,
          },
        ],
        schema: GAP_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 4000,
        effort: "medium",
        meta: { userId, feature: "triage" },
      }));
      followUps = (gap.followUps ?? []).filter((f) => f.query?.trim()).slice(0, MAX_FOLLOW_UPS);
    } catch (e) {
      console.error(`[scalae] gap analysis timed out or failed (continuing without wave 2):`, e);
    }

    // ---- Stage 3: wave-2 deep dives on the stronger scout model ----
    if (followUps.length > 0) {
      await setRunStage(
        runId,
        "probing",
        `Deep-dive scouts (${deepModel}) probing ${followUps.length} commissioned ${followUps.length === 1 ? "question" : "questions"}: ${followUps.map((f) => `“${f.query.slice(0, 80)}${f.query.length > 80 ? "…" : ""}”`).join(" · ")}`
      );
      const waveTwoSettled = await Promise.allSettled(
        followUps.map((f) =>
          withDeadline(`deepdive:${f.query.slice(0, 40)}`, (signal) =>
            geminiGroundedSearch(followUpPrompt(symbol, ticker.name, f), {
              model: deepModel,
              meta: { userId, feature: "scoutDeep" },
              signal,
            })
          ).then(
            (r): Sweep => ({
              label: `Deep dive: ${f.query}`,
              wave: 2,
              text: r.text,
              sources: r.sources,
            })
          )
        )
      );
      for (const s of waveTwoSettled) {
        if (s.status === "fulfilled") sweeps.push(s.value);
      }
    }

    // Number the de-duplicated sources across all sweeps so the analyst cites
    // by index — and record which sweep(s) surfaced each source (provenance).
    const allSources: Citation[] = [];
    const indexOf = new Map<string, number>();
    for (const s of sweeps) {
      for (const src of s.sources) {
        const existing = indexOf.get(src.url);
        if (existing == null) {
          indexOf.set(src.url, allSources.length);
          allSources.push(withDomain({ ...src, foundBy: [s.label] }));
        } else {
          const foundBy = allSources[existing].foundBy;
          if (foundBy && !foundBy.includes(s.label)) foundBy.push(s.label);
        }
      }
    }

    await throwIfStopped(runId);
    await setRunStage(
      runId,
      "synthesizing",
      `Analyst (${synthModel}) weighing ${sweeps.length} sweeps and ${allSources.length} sources into the signal board…`
    );

    const quote = await getQuote(symbol).catch(() => null);
    // focusAreas, guidance and the due-diligence block were gathered before
    // the question stage (stage 0) and are reused here unchanged.
    const researchBlock = sweeps
      .map(
        (s) =>
          `=== [Wave ${s.wave}${s.wave === 2 ? " deep dive" : ""}] ${s.label} ===\n${s.text}\nSources used by this sweep: ${
            s.sources.map((src) => `[${indexOf.get(src.url)}] ${src.title}`).join(", ") || "(none)"
          }`
      )
      .join("\n\n");

    const sourceList = allSources
      .map((s, i) => `[${i}] ${s.title} — ${s.url}`)
      .join("\n");
    // Full non-duplication context: pending + previously rejected/retired signals.
    const [pendingSignals, dismissedSignals, retiredSignals] = await Promise.all([
      listSignals(userId, symbol, "suggested"),
      listSignals(userId, symbol, "dismissed"),
      listSignals(userId, symbol, "retired"),
    ]);
    const pendingNames = pendingSignals.map((s) => `"${s.name}"`);
    const rejectedNames = [...dismissedSignals, ...retiredSignals].map((s) => `"${s.name}"`);

    // Coverage honesty (FOUNDATION: missing evidence is said plainly): the
    // sweep window is capped at 14 days, so a desk idle longer than that has
    // an unswept stretch the brief must own instead of papering over.
    const unsweptDays = gapDays !== null && gapDays > days ? gapDays - days : 0;
    const task = `Today is ${new Date().toDateString()}. ${quoteLine(quote)}
${
  unsweptDays > 0
    ? `\nCOVERAGE HONESTY: the desk's last completed run was ~${gapDays} days ago, but today's sweeps read only the last ${days} days — roughly ${unsweptDays} days in between went UNRESEARCHED. The brief MUST state this plainly in one line (name the unswept span); never present today's picture as continuous coverage.\n`
    : ""
}
INVESTOR FOCUS AREAS:
${focusAreas.map((f) => `- ${f.title}: ${f.description}`).join("\n") || "(none recorded)"}

ACTIVE SIGNAL BOARD:
${boardBlock}
${questionsBlock}
RECENT INVESTOR GUIDANCE (newest last):
${guidance || "(none)"}

${ctxBlock ? `${ctxBlock}\n` : ""}${ddBlock ? `${ddBlock}\n\n` : ""}${benchBlock ? `THE REPORTED NUMBERS AND THE INVESTOR'S CLEANSED VIEW (how the investor reads this record — readings that touch the financial record must speak to the same numbers):\n${benchBlock}\n\n` : ""}FIELD RESEARCH (grounded web sweeps from the scout desk — wave 1 is breadth, wave 2 is deep dives the desk commissioned after triage; numbered sources listed at the end):
${researchBlock}

NUMBERED SOURCES:
${sourceList || "(none)"}

TASK — produce today's desk output:
1. readings: exactly one per active signal above — ${keyed.length} readings total; "signalKey" must be the signal's bracketed key ("S1", "S2", …). Base readings only on the field research plus the previous-reading context. First decide "newEvidence": did today's research add ANYTHING for this signal that the previous reading didn't already say?
   - newEvidence=false (pure carry-forward): rationale must be ONE short sentence — "No new information this run." optionally plus a brief note of what was checked (max ~140 chars total). Do NOT re-narrate the prior story, figures, or history — the board already shows them. Keep the previous level and value, delta "flat", and confidence at or slightly below the previous reading's.
   - newEvidence=true: the rationale must LEAD with what is new versus the previous reading (the delta), then its implication — never restate the whole running story. Where the board shows a "History base rate" for the signal, judge today's evidence against it: is this move normal variation for this aspect, a rhyme with a named past episode, or a genuine break from decades of record? Say which when it changes the reading.
   For quantitative signals set "value" only when a number is directly evidenced in the research; otherwise value=null and rely on level. confidence is 0..1. citationIndexes must list EVERY numbered source the reading actually draws on — this is the desk's evidence map from signal to sources, so cite precisely: no supporting source omitted, no decorative citations added. Never write bracketed [n] references inside rationale text — cite only via citationIndexes (the app renders them as linked chips).
2. digestItems: the 4-8 most decision-relevant developments for this desk (deduplicate; skip stock-price noise). sourceIndex points into the numbered sources (or null). Weigh each item's source per the evidence doctrine: sourceClass classes the cited source (primary = the company's or a regulator's own document/statement; trade = specialist/industry press or data provider with original reporting; narrative = general-media or aggregator retelling), and sourceNote is the desk's one-line source recommendation — why this source is, or is not, the one worth opening for this item, naming the better primary source when the citation is only a retelling. When sourceIndex is null: sourceClass "narrative", sourceNote "".
3. brief: a 120-250 word morning note in markdown addressed to the investor: what changed, what to watch next, and any disconfirming evidence a bull would rather ignore. Where today's evidence moved a focus question, say so; focus questions that found no evidence get one honest collective line, never manufactured movement. Cite evidence inline with bracketed source indexes like [12] or [3][17] pointing into the NUMBERED SOURCES — the app renders each as a clickable link, so only use indexes that exist. Refer to signals by their names in quotes, never by bracketed keys like [S3] (those keys are internal). Signals with no new evidence get at most one collective sentence ("No new information on X, Y, Z") — never per-signal re-narration.
3b. dossier: the STANDING view of the business, 150-300 words in markdown — not today's news. Paragraph 1: how this company makes money right now (segments, the earnings engine, moat trajectory) as evidenced by the board's current readings. Paragraph 2: the culture/trust verdict. Update only what today's evidence moved; keep the rest stable so the investor sees a consistent thesis evolving, not a rewrite. Cite [n] source indexes on every load-bearing claim, and when a claim reads off a board signal, add that signal's key in double braces right after it — e.g. "the toll booth is repricing {{S1}} [4]" — so the investor can jump from claim to signal. Refer to signals by name in the prose (the {{Sk}} markers render as links, never as raw keys).
4. proposals: 0-3 NEW signals only if the research surfaced a trackable thread the current board misses, OR an upgrade to an existing signal (this is the desk's self-reinforcing discovery loop — the goal is the best possible signal set). Propose as the industry expert of the circle-of-competence loop: where the investor's due-diligence record (above, when present) leaves a load-bearing business-model or culture thread unexamined and unwatched, or where a signal's long-run trend would strengthen or test a section's written analysis, prefer THAT proposal and name the gap or section in its thesis. Each proposal must anchor to the business model or corporate culture, and must NOT overlap significantly in what it measures with the active board above, the pending proposals (${pendingNames.join(", ") || "none"}), or previously rejected/retired signals (${rejectedNames.join(", ") || "none"} — do not re-propose these without materially new evidence, stated in the thesis). When today's evidence shows an active signal is aimed wrong, too narrow, or a more comprehensive formulation would sit closer to the crux of the business, propose the sharper signal with "replaces" set to that active signal's exact bracketed name — approval swaps it in and retires the old one. Purely additive proposals set replaces to "". Return an empty array when nothing genuinely new emerged.

LANGUAGE: Write EVERY output field in English, even if investor guidance or evidence quotes appear in another language — the desk's stored record is canonical English, and the app translates it into the investor's display language automatically.`;

    // Synthesis is the pipeline's heaviest call and the one that used to hang.
    // Low effort (see synthesisEffort) keeps it fast, and instead of the flat
    // per-stage limit it gets the time actually left in the route budget — so
    // it lands comfortably inside the run rather than being cut off at 110s.
    // The deadline is still a strict backstop: on timeout the run fails cleanly
    // (and the cron retries it) rather than the platform killing the function.
    const synthMs = Math.max(0, ROUTE_BUDGET_MS - (Date.now() - runStart) - RECORDING_RESERVE_MS);
    const out = await withDeadline("synthesis", (signal) => claudeJSON<SynthesisOutput>({
      model: synthModel,
      signal,
      // Same cached doctrine prefix as triage → the daily cron re-reads it at
      // ~0.1× input cost for every desk it sweeps, not once per call.
      system: [
        { text: DESK_DOCTRINE, cache: true },
        {
          text: `${deskIdentity(symbol, ticker.name)}\n\n${SIGNAL_GUIDANCE}\n\n${EXPERT_LOOP_GUIDANCE}\n\n${SYNTHESIS_DOCTRINE}`,
        },
      ],
      messages: [{ role: "user", content: task }],
      schema: SYNTHESIS_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 20000,
      effort: synthesisEffort(),
      meta: { userId, feature: "synthesis" },
    }), synthMs);

    // Last checkpoint before we write: a run stopped during synthesis must not
    // record stale readings over whatever fresh run the investor started.
    await throwIfStopped(runId);
    await setRunStage(runId, "recording", "Recording readings, digest and new signal proposals…");

    const date = new Date().toISOString();
    for (const r of out.readings ?? []) {
      const signal = byKey.get((r.signalKey ?? "").toUpperCase().trim());
      if (!signal) continue;
      const citations = (r.citationIndexes ?? [])
        .filter((i) => i >= 0 && i < allSources.length)
        .map((i) => allSources[i]);
      // Evidence discipline (FOUNDATION): movement must carry its evidence
      // map. A "new evidence" reading whose cited indexes all failed
      // validation may not present itself as evidenced — halve confidence
      // and say so plainly in the stored (canonical-English) rationale.
      const unevidenced = r.newEvidence === true && citations.length === 0;
      await insertReading({
        signalId: signal.id,
        runId,
        date,
        value: typeof r.value === "number" ? r.value : null,
        valueUnit: r.valueUnit ?? null,
        level: r.level ?? "unclear",
        delta: r.delta ?? "flat",
        confidence: Math.max(0, Math.min(1, r.confidence ?? 0.3)) * (unevidenced ? 0.5 : 1),
        rationale: unevidenced
          ? `${(r.rationale ?? "").trim()} (The sources behind this run's new evidence could not be verified; confidence reduced.)`.trim()
          : (r.rationale ?? ""),
        newEvidence: typeof r.newEvidence === "boolean" ? r.newEvidence : null,
        citations,
      });
    }

    for (const d of out.digestItems ?? []) {
      const src =
        d.sourceIndex != null && d.sourceIndex >= 0 && d.sourceIndex < allSources.length
          ? allSources[d.sourceIndex]
          : null;
      await insertDigestItem(userId, {
        symbol,
        runId,
        date,
        headline: d.headline,
        summary: d.summary,
        url: src?.url ?? null,
        source: src?.title ?? null,
        impact: d.impact ?? "neutral",
        signalNames: d.signalNames ?? [],
        sourceClass:
          src && (d.sourceClass === "primary" || d.sourceClass === "trade" || d.sourceClass === "narrative")
            ? d.sourceClass
            : null,
        sourceNote: src && d.sourceNote?.trim() ? d.sourceNote.trim().slice(0, 200) : null,
      });
    }

    for (const p of (out.proposals ?? []).slice(0, 3)) {
      if (p.name?.trim()) await insertProposal(userId, symbol, p, "research");
    }

    // Resolve the dossier's {{Sk}} signal markers to durable signal ids
    // ([[sig:<id>]]) so the UI can link claims to signals even after the
    // board's key numbering changes; unresolvable keys drop silently.
    const dossier = (out.dossier?.trim() || null)?.replace(
      /\{\{\s*(S\d+)\s*\}\}/gi,
      (_m, key: string) => {
        const sig = byKey.get(key.toUpperCase());
        return sig ? `[[sig:${sig.id}]]` : "";
      }
    );
    // Mark the run complete NOW — its core output (readings, digest, brief,
    // dossier) is done. Deep-history backfill below is trailing enrichment; it
    // must never delay the run's completion or, if it hangs, block finishRun.
    await finishRun(runId, out.brief ?? "", allSources, dossier ?? null);
    await touchLastRun(userId, symbol);
    // Adaptive cadence: a run that surfaced no new evidence for any signal means
    // this desk is dormant — let the cron sweep it less often (lib/cadence.ts).
    // Any new evidence resets the counter and snaps cadence back to daily.
    const hadNewEvidence = (out.readings ?? []).some((r) => r.newEvidence === true);
    await bumpQuietRuns(userId, symbol, hadNewEvidence).catch(() => {});

    // ---- Refresh the context board (background, best-effort) ----
    // What did this run answer, and what does the whole ticker's record now
    // establish? Distilled AFTER the run is finished, read by the NEXT one —
    // answered questions stay answered instead of being re-asked.
    await refreshDeskContext(userId, symbol, runId, {
      questions: questions.map((q) => q.question),
      brief: out.brief ?? "",
    }).catch((e) =>
      console.error(
        `[scalae] context board refresh (${symbol}) failed:`,
        e instanceof Error ? e.message : e
      )
    );

    // ---- Backfill deep-history backstories (bounded: 2 per run, best-effort) ----
    // Every signal should carry its decades-scale base rate; new boards fill in
    // over a few runs. This runs AFTER the run is finished, and each backstory
    // is under the strict per-stage deadline, so it can neither hang the run nor
    // eat the time budget. Failures/timeouts are logged, never fatal.
    const missingBackstory = signals.filter((s) => !s.backstory).slice(0, 2);
    for (const s of missingBackstory) {
      try {
        // The snapshot is minutes old — don't spend a research call enriching
        // a signal the investor retired while this run was in flight.
        if ((await getSignal(s.id))?.status !== "active") continue;
        await withDeadline(`backstory:${s.name}`, (signal) =>
          researchSignalBackstory(userId, s.id, signal)
        );
      } catch (e) {
        console.error(
          `[scalae] backstory for "${s.name}" (${symbol}) timed out or failed:`,
          e instanceof Error ? e.message : e
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Investor-initiated stop: the run is already terminal ('stopped') — nothing
    // to fail, and failRun is guarded to a running row anyway. Exit quietly.
    if (msg === RUN_STOPPED) {
      console.log(`[scalae] run ${runId} (${symbol}) stopped by the investor.`);
      return;
    }
    console.error(`[scalae] run ${runId} (${symbol}) failed:`, msg);
    await failRun(runId, msg).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// The single-signal check — the board run's structure, scoped to one signal
// ---------------------------------------------------------------------------

interface SignalCheckOutput {
  note: string;
  readings: SynthesisOutput["readings"];
  digestItems: SynthesisOutput["digestItems"];
}

const MAX_SCOPED_FOLLOW_UPS = 2;

/** Research window for one signal: since its last reading, else 7 days. */
async function signalWindowDays(signalId: string): Promise<number> {
  const prev = (await readingsForSignal(signalId, 1))[0];
  if (!prev) return 7;
  const days = Math.ceil((Date.now() - Date.parse(prev.date)) / 86_400_000);
  return Math.min(14, Math.max(2, days + 1));
}

/**
 * Execute a single-signal check created by startSignalRun() — the same
 * stage structure as executeRun, narrowed to one signal's named gap:
 *   0) Question framing scoped to the signal (2-4 questions)
 *   1) Wave-1 sweeps (parallel): focus questions, the signal's own sweep,
 *      and a primary-source hunt steered to its measurement plan
 *   2) Gap triage commissioning at most 2 deep dives
 *   3) Wave-2 deep dives
 *   4) Scoped synthesis: ONE reading + 0-3 digest items + a short note —
 *      no brief, no dossier, and NO new-signal proposals (a check never
 *      expands the board; FOUNDATION's no-sprawl discipline).
 */
export async function executeSignalRun(
  userId: string,
  runId: string,
  symbol: string,
  signalId: string
): Promise<void> {
  const runStart = Date.now();
  try {
    const ticker = await getTicker(userId, symbol);
    if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
    const signal = await getSignal(signalId);
    if (!signal || signal.symbol !== symbol || (signal.userId && signal.userId !== userId)) {
      throw new Error("Unknown signal for this desk.");
    }
    if (signal.status !== "active") throw new Error("Only active signals can be checked.");

    const [breadthModel, deepModel, triageModel, synthModel] = await Promise.all([
      resolveModel("scoutBreadth"),
      resolveModel("scoutDeep"),
      resolveModel("triage"),
      resolveModel("synthesis"),
    ]);

    const days = await signalWindowDays(signalId);

    // The one-signal board block — same shape the full run feeds the analyst.
    const prev = (await readingsForSignal(signalId, 1))[0];
    const prevLine = prev
      ? ` Previous reading (${prev.date.slice(0, 10)}): level=${prev.level}${prev.value != null ? `, value=${prev.value} ${prev.valueUnit ?? ""}` : ""}, confidence=${prev.confidence} — ${prev.rationale}`
      : " No previous reading.";
    const historyLine = signal.backstoryBrief ? ` History base rate: ${signal.backstoryBrief}` : "";
    const boardBlock = `- [S1] "${signal.name}" (${signal.type}, focus: ${signal.focusArea}). Plan: ${signal.measurementPlan} Scale: ${signal.scale}.${prevLine}${historyLine}`;

    const guidance = await investorGuidance(userId, symbol);
    const ctxBlock = await contextBoardBlock(userId, symbol);

    // ---- Stage 0: frame what THIS check must answer (scoped questions) ----
    await throwIfStopped(runId);
    await setRunStage(
      runId,
      "questions",
      `Question suggestor (${triageModel}) framing what this check of “${signal.name}” must answer…`
    );
    let questions: { question: string; why: string }[] = [];
    try {
      const framed = await withDeadline("questions", (signal_) =>
        claudeJSON<QuestionsOutput>({
          model: triageModel,
          signal: signal_,
          system: [
            { text: DESK_DOCTRINE, cache: true },
            { text: `${deskIdentity(symbol, ticker.name)}\n\n${QUESTION_METHOD}\n\n${RUN_QUESTIONS_DOCTRINE}` },
          ],
          messages: [
            {
              role: "user",
              content: `DESK STATE (today: ${new Date().toDateString()}):

THE ONE SIGNAL THIS CHECK COVERS (with its previous reading):
${boardBlock}

RECENT INVESTOR GUIDANCE (newest last):
${guidance || "(none)"}

${ctxBlock ? `${ctxBlock}\n` : ""}TASK: This is a SINGLE-SIGNAL check, not a board run. Frame 2-4 focus questions strictly about this signal's measurement plan and its kill-path — what must be answered TODAY to move or honestly re-confirm its reading. Every question's signalKeys is ["S1"].`,
            },
          ],
          schema: RUN_QUESTIONS_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 1500,
          effort: "low",
          meta: { userId, feature: "questions" },
        })
      );
      questions = (framed.questions ?? [])
        .filter((q) => q.question?.trim())
        .slice(0, 4)
        .map((q) => ({ question: q.question.trim(), why: q.why ?? "" }));
      if (questions.length > 0) await setRunQuestions(runId, questions.map((q) => q.question));
    } catch (e) {
      console.error(
        `[scalae] signal-check question framing failed (continuing without):`,
        e instanceof Error ? e.message : e
      );
    }
    const questionsBlock = questions.length
      ? `\nTHIS CHECK'S FOCUS QUESTIONS (framed before the sweeps):\n${questions
          .map((q, i) => `Q${i + 1}. ${q.question} — ${q.why}`)
          .join("\n")}\n`
      : "";

    // ---- Stage 1: wave-1 sweeps, scoped to the signal ----
    await throwIfStopped(runId);
    const signalSteer = `\n\nSCOPE: This check serves ONE tracked signal: "${signal.name}" — ${signal.measurementPlan} Prioritize evidence bearing on it; ignore unrelated company news.`;
    await setRunStage(
      runId,
      "sweeping",
      `Scouts (${breadthModel}) sweeping the open web for “${signal.name}” — ${questions.length > 0 ? "focus questions, " : ""}the signal's sweep and a primary-source hunt (${days}-day window)…`
    );
    const waveOneJobs: { label: string; prompt: string }[] = [
      ...(questions.length > 0
        ? [
            {
              label: "Focus-question sweep",
              prompt: questionSweepPrompt(symbol, ticker.name, days, questions),
            },
          ]
        : []),
      {
        label: `Signal sweep: ${signal.name}`,
        prompt: signalSweepPrompt(symbol, ticker.name, days, [signal]),
      },
      {
        label: "Primary-source sweep",
        prompt: primarySourcePrompt(symbol, ticker.name, days) + signalSteer,
      },
    ];
    const waveOneSettled = await Promise.allSettled(
      waveOneJobs.map((j) =>
        withDeadline(`sweep:${j.label}`, (signal_) =>
          geminiGroundedSearch(j.prompt, { model: breadthModel, meta: { userId, feature: "scoutBreadth" }, signal: signal_ })
        ).then((r): Sweep => ({ label: j.label, wave: 1, text: r.text, sources: r.sources }))
      )
    );
    const sweeps: Sweep[] = waveOneSettled
      .filter((s): s is PromiseFulfilledResult<Sweep> => s.status === "fulfilled")
      .map((s) => s.value);
    if (sweeps.length === 0) {
      const firstErr = waveOneSettled.find((s) => s.status === "rejected") as PromiseRejectedResult;
      throw new Error(`All research sweeps failed: ${firstErr?.reason?.message ?? "unknown"}`);
    }

    // ---- Stage 2: triage for gaps worth a deep dive (at most 2) ----
    await throwIfStopped(runId);
    await setRunStage(
      runId,
      "probing",
      `Analyst (${triageModel}) triaging the field research on “${signal.name}” for gaps worth a deep dive…`
    );
    let followUps: GapOutput["followUps"] = [];
    try {
      const waveOneBlock = sweeps.map((s) => `=== ${s.label} ===\n${s.text}`).join("\n\n");
      const gap = await withDeadline("triage", (signal_) =>
        claudeJSON<GapOutput>({
          model: triageModel,
          signal: signal_,
          system: [
            { text: DESK_DOCTRINE, cache: true },
            { text: `${deskIdentity(symbol, ticker.name)}\n\n${SYNTHESIS_DOCTRINE}` },
          ],
          messages: [
            {
              role: "user",
              content: `THE ONE SIGNAL THIS CHECK COVERS:\n${boardBlock}\n${questionsBlock}\nFIELD RESEARCH — WAVE 1 (breadth sweeps):\n${waveOneBlock}\n\nTASK: This is a SINGLE-SIGNAL check. Commission at most ${MAX_SCOPED_FOLLOW_UPS} targeted deep-dive probes, only where it changes THIS signal's reading today: a focus question left open, numbers that conflict between sources, or a red flag needing primary-source verification. Invert first — prefer a probe that could REFUTE the current level or catch a kill-path symptom. Return an empty list if wave 1 already answers the check; do not invent work.`,
            },
          ],
          schema: GAP_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 2000,
          effort: "medium",
          meta: { userId, feature: "triage" },
        })
      );
      followUps = (gap.followUps ?? []).filter((f) => f.query?.trim()).slice(0, MAX_SCOPED_FOLLOW_UPS);
    } catch (e) {
      console.error(`[scalae] signal-check triage failed (continuing without wave 2):`, e);
    }

    // ---- Stage 3: wave-2 deep dives ----
    if (followUps.length > 0) {
      await setRunStage(
        runId,
        "probing",
        `Deep-dive scouts (${deepModel}) probing ${followUps.length} commissioned ${followUps.length === 1 ? "question" : "questions"} on “${signal.name}”…`
      );
      const waveTwoSettled = await Promise.allSettled(
        followUps.map((f) =>
          withDeadline(`deepdive:${f.query.slice(0, 40)}`, (signal_) =>
            geminiGroundedSearch(followUpPrompt(symbol, ticker.name, f), {
              model: deepModel,
              meta: { userId, feature: "scoutDeep" },
              signal: signal_,
            })
          ).then(
            (r): Sweep => ({ label: `Deep dive: ${f.query}`, wave: 2, text: r.text, sources: r.sources })
          )
        )
      );
      for (const s of waveTwoSettled) {
        if (s.status === "fulfilled") sweeps.push(s.value);
      }
    }

    // Number the de-duplicated sources across sweeps (same as the board run).
    const allSources: Citation[] = [];
    const indexOf = new Map<string, number>();
    for (const s of sweeps) {
      for (const src of s.sources) {
        const existing = indexOf.get(src.url);
        if (existing == null) {
          indexOf.set(src.url, allSources.length);
          allSources.push(withDomain({ ...src, foundBy: [s.label] }));
        } else {
          const foundBy = allSources[existing].foundBy;
          if (foundBy && !foundBy.includes(s.label)) foundBy.push(s.label);
        }
      }
    }

    // ---- Stage 4: scoped synthesis — one reading, a few digest items, a note ----
    await throwIfStopped(runId);
    await setRunStage(
      runId,
      "synthesizing",
      `Analyst (${synthModel}) weighing ${sweeps.length} sweeps and ${allSources.length} sources into a fresh reading of “${signal.name}”…`
    );
    const researchBlock = sweeps
      .map(
        (s) =>
          `=== [Wave ${s.wave}${s.wave === 2 ? " deep dive" : ""}] ${s.label} ===\n${s.text}\nSources used by this sweep: ${
            s.sources.map((src) => `[${indexOf.get(src.url)}] ${src.title}`).join(", ") || "(none)"
          }`
      )
      .join("\n\n");
    const sourceList = allSources.map((s, i) => `[${i}] ${s.title} — ${s.url}`).join("\n");

    const task = `Today is ${new Date().toDateString()}.

THE ONE SIGNAL THIS CHECK COVERS (with its previous reading):
${boardBlock}
${questionsBlock}
RECENT INVESTOR GUIDANCE (newest last):
${guidance || "(none)"}

${ctxBlock ? `${ctxBlock}\n` : ""}FIELD RESEARCH (grounded web sweeps scoped to this signal; numbered sources listed at the end):
${researchBlock}

NUMBERED SOURCES:
${sourceList || "(none)"}

TASK — produce this check's output per the single-signal-check doctrine: exactly one reading for [S1] (signalKey "S1"; same newEvidence/citation discipline as a full run, judged against the previous reading and the history base rate), 0-3 digestItems bearing on this signal only (signalNames ["${signal.name}"]; skip anything the previous reading already cited), and the 40-120 word note. No proposals exist in this schema — a scoped check never expands the board.

LANGUAGE: Write EVERY output field in English — the desk's stored record is canonical English, and the app translates it into the investor's display language automatically.`;

    const synthMs = Math.max(0, ROUTE_BUDGET_MS - (Date.now() - runStart) - RECORDING_RESERVE_MS);
    const out = await withDeadline(
      "synthesis",
      (signal_) =>
        claudeJSON<SignalCheckOutput>({
          model: synthModel,
          signal: signal_,
          system: [
            { text: DESK_DOCTRINE, cache: true },
            {
              text: `${deskIdentity(symbol, ticker.name)}\n\n${SIGNAL_GUIDANCE}\n\n${SYNTHESIS_DOCTRINE}\n\n${SIGNAL_CHECK_DOCTRINE}`,
            },
          ],
          messages: [{ role: "user", content: task }],
          schema: SIGNAL_CHECK_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 6000,
          effort: synthesisEffort(),
          meta: { userId, feature: "synthesis" },
        }),
      synthMs
    );

    await throwIfStopped(runId);
    await setRunStage(runId, "recording", "Recording the reading and evidence…");

    const date = new Date().toISOString();
    // Exactly one reading, for the checked signal — stray extras are dropped.
    const r = (out.readings ?? [])[0];
    if (r) {
      const citations = (r.citationIndexes ?? [])
        .filter((i) => i >= 0 && i < allSources.length)
        .map((i) => allSources[i]);
      // Same unevidenced-movement guard as the board run: new evidence with no
      // surviving citations halves confidence and says so.
      const unevidenced = r.newEvidence === true && citations.length === 0;
      await insertReading({
        signalId,
        runId,
        date,
        value: typeof r.value === "number" ? r.value : null,
        valueUnit: r.valueUnit ?? null,
        level: r.level ?? "unclear",
        delta: r.delta ?? "flat",
        confidence: Math.max(0, Math.min(1, r.confidence ?? 0.3)) * (unevidenced ? 0.5 : 1),
        rationale: unevidenced
          ? `${(r.rationale ?? "").trim()} (The sources behind this run's new evidence could not be verified; confidence reduced.)`.trim()
          : (r.rationale ?? ""),
        newEvidence: typeof r.newEvidence === "boolean" ? r.newEvidence : null,
        citations,
      });
    }

    for (const d of (out.digestItems ?? []).slice(0, 3)) {
      const src =
        d.sourceIndex != null && d.sourceIndex >= 0 && d.sourceIndex < allSources.length
          ? allSources[d.sourceIndex]
          : null;
      await insertDigestItem(userId, {
        symbol,
        runId,
        date,
        headline: d.headline,
        summary: d.summary,
        url: src?.url ?? null,
        source: src?.title ?? null,
        impact: d.impact ?? "neutral",
        signalNames: d.signalNames?.length ? d.signalNames : [signal.name],
        sourceClass:
          src && (d.sourceClass === "primary" || d.sourceClass === "trade" || d.sourceClass === "narrative")
            ? d.sourceClass
            : null,
        sourceNote: src && d.sourceNote?.trim() ? d.sourceNote.trim().slice(0, 200) : null,
      });
    }

    // The note rides the run's brief column; board surfaces never read
    // signal-scoped runs (latestRun/recentRuns filter them out), so it shows
    // only where the check is surfaced. No dossier, no proposals, no
    // lastRunAt stamp — a check is not a desk sweep.
    await finishRun(runId, out.note ?? "", allSources, null);
    // Fresh evidence on a named gap snaps the desk out of dormancy backoff;
    // a quiet check never deepens it (it looked at one signal, not the desk).
    if (r?.newEvidence === true) await resetQuietRuns(userId, symbol).catch(() => {});

    // A check answers questions too — fold them into the context board.
    await refreshDeskContext(userId, symbol, runId, {
      questions: questions.map((q) => q.question),
      brief: out.note ?? "",
    }).catch((e) =>
      console.error(
        `[scalae] context board refresh (${symbol}) failed:`,
        e instanceof Error ? e.message : e
      )
    );

    // Backfill this signal's deep-history base rate if it's missing.
    if (!signal.backstory) {
      try {
        await withDeadline(`backstory:${signal.name}`, (signal_) =>
          researchSignalBackstory(userId, signalId, signal_)
        );
      } catch (e) {
        console.error(
          `[scalae] backstory for "${signal.name}" (${symbol}) timed out or failed:`,
          e instanceof Error ? e.message : e
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === RUN_STOPPED) {
      console.log(`[scalae] signal check ${runId} (${symbol}) stopped by the investor.`);
      return;
    }
    console.error(`[scalae] signal check ${runId} (${symbol}) failed:`, msg);
    await failRun(runId, msg).catch(() => {});
  }
}
