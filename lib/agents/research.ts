import { claudeJSON } from "../ai/claude";
import { geminiGroundedSearch } from "../ai/gemini";
import { resolveModel } from "../ai/models";
import { researchSignalBackstory } from "./history";
import { withDomain } from "../citations";
import { citationOverlap } from "../compare";
import {
  DESK_DOCTRINE,
  deskIdentity,
  GAP_SCHEMA,
  SIGNAL_GUIDANCE,
  SYNTHESIS_DOCTRINE,
  SYNTHESIS_SCHEMA,
} from "./framework";
import {
  bumpQuietRuns,
  createRun,
  failRun,
  finishRun,
  getTicker,
  insertDigestItem,
  insertProposal,
  insertReading,
  latestRun,
  listFocusAreas,
  listMessages,
  listSignals,
  readingsForSignal,
  reapStuckRuns,
  runStatus,
  runningRun,
  setRunStage,
  touchLastRun,
} from "../db";
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
  }[];
  proposals: SignalProposal[];
}

interface GapOutput {
  followUps: { query: string; reason: string; signalKeys: string[] }[];
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
 * (synthesis) or a graceful degrade (scouts, triage, backstory).
 */
async function withDeadline<T>(
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

/** How fresh a window to research: since the last completed run, else 7 days. */
async function windowDays(userId: string, symbol: string): Promise<number> {
  const last = await latestRun(userId, symbol);
  if (!last?.finishedAt) return 7;
  const days = Math.ceil((Date.now() - Date.parse(last.finishedAt)) / 86_400_000);
  return Math.min(14, Math.max(2, days + 1));
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
Do not pad with old background information unless you label it "(context)".`;
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

Distinguish documented fact from rumor — label anything unverified "(unverified)". ${SCOUT_RULES}`;
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

Research it thoroughly: search from multiple angles, prefer primary sources (filings, transcripts, company statements, regulator documents) over aggregators, and cross-check numbers between sources. Report every relevant fact with its date, source and concrete figures. Explicitly state what could NOT be verified — an honest "couldn't confirm" is valuable. ${SCOUT_RULES}`;
}

// ---------------------------------------------------------------------------
// The pipeline
// ---------------------------------------------------------------------------

/**
 * Execute the deep multi-agent pipeline for a run created by startRun():
 *   1) Wave-1 breadth sweeps (grounded scouts, parallel): per-signal bundles,
 *      broad company news, primary sources, culture scuttlebutt
 *   2) Gap analysis: the analyst triages evidence vs. the board and
 *      commissions targeted follow-up probes
 *   3) Wave-2 deep-dive sweeps (parallel, stronger scout model)
 *   4) Deep synthesis: signal readings with per-source citations, digest,
 *      brief, new-signal discovery
 */
export async function executeRun(userId: string, runId: string, symbol: string): Promise<void> {
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

    const days = await windowDays(userId, symbol);
    const bundles = chunk(signals, 5);
    const waveOneCount = bundles.length + 3;
    await throwIfStopped(runId);
    await setRunStage(
      runId,
      "sweeping",
      `Scouts (${breadthModel}) sweeping the open web — ${waveOneCount} parallel sweeps: signals, broad news, primary sources, scuttlebutt (${days}-day window)…`
    );

    const waveOneJobs: { label: string; prompt: string }[] = [
      ...bundles.map((b, i) => ({
        label: `Signal sweep ${i + 1}: ${b.map((s) => s.name).join(", ")}`,
        prompt: signalSweepPrompt(symbol, ticker.name, days, b),
      })),
      { label: "Broad company sweep", prompt: broadSweepPrompt(symbol, ticker.name, days) },
      { label: "Primary-source sweep", prompt: primarySourcePrompt(symbol, ticker.name, days) },
      { label: "Culture & scuttlebutt sweep", prompt: scuttlebuttPrompt(symbol, ticker.name, days) },
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
          const prev = (await readingsForSignal(s.id, 1))[0];
          const prevLine = prev
            ? ` Previous reading (${prev.date.slice(0, 10)}): level=${prev.level}${prev.value != null ? `, value=${prev.value} ${prev.valueUnit ?? ""}` : ""}, confidence=${prev.confidence} — ${prev.rationale}`
            : " No previous reading.";
          const measured = overlapMeasured.get(s.id) ?? 0;
          const overlapNote = overlapWith.has(s.id)
            ? measured >= 0.5
              ? ` NOTE: kept alongside "${overlapWith.get(s.id)}" — their recent readings HAVE cited the same evidence (${Math.round(measured * 100)}% source overlap). They are one signal wearing two names: propose the merged replacement NOW with "replaces" set, unless today's evidence clearly separates them.`
              : ` NOTE: the investor knowingly kept this alongside "${overlapWith.get(s.id)}" despite overlap — if both keep reading the same evidence, propose ONE merged replacement with "replaces" set.`
            : "";
          // The signal's deep-history base rate (when researched) keeps daily
          // readings judged against decades, not just yesterday.
          const historyLine = s.backstoryBrief ? ` History base rate: ${s.backstoryBrief}` : "";
          return `- [${key}] "${s.name}" (${s.type}, focus: ${s.focusArea}). Plan: ${s.measurementPlan} Scale: ${s.scale}.${prevLine}${historyLine}${overlapNote}`;
        })
      )
    ).join("\n");

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
            content: `ACTIVE SIGNAL BOARD:\n${boardBlock}\n\nFIELD RESEARCH — WAVE 1 (breadth sweeps):\n${waveOneBlock}\n\nTASK: Before final synthesis, decide which threads deserve a targeted deep-dive probe by a research scout. Commission at most ${MAX_FOLLOW_UPS} follow-ups, only where it changes today's readings: signals whose evidence is thin or missing, numbers that conflict between sources, red flags mentioned once that need verification against primary sources, or a major development whose business-model/culture implications the sweeps left shallow. Invert first (Munger): give priority to probes that could REFUTE the board's current levels or verify a kill-risk symptom — a probe that can only re-confirm what the desk already believes is usually not worth commissioning. Each query must be a concrete, searchable question. Return an empty list if wave 1 already covers the board — do not invent work.`,
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
    const focusAreas = await listFocusAreas(userId, symbol);
    const guidance = (await listMessages(userId, symbol))
      .filter((m) => m.role === "user")
      .slice(-6)
      .map((m) => `- ${m.content.slice(0, 300)}`)
      .join("\n");

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

    const task = `Today is ${new Date().toDateString()}. ${quoteLine(quote)}

INVESTOR FOCUS AREAS:
${focusAreas.map((f) => `- ${f.title}: ${f.description}`).join("\n") || "(none recorded)"}

ACTIVE SIGNAL BOARD:
${boardBlock}

RECENT INVESTOR GUIDANCE (newest last):
${guidance || "(none)"}

FIELD RESEARCH (grounded web sweeps from the scout desk — wave 1 is breadth, wave 2 is deep dives the desk commissioned after triage; numbered sources listed at the end):
${researchBlock}

NUMBERED SOURCES:
${sourceList || "(none)"}

TASK — produce today's desk output:
1. readings: exactly one per active signal above — ${keyed.length} readings total; "signalKey" must be the signal's bracketed key ("S1", "S2", …). Base readings only on the field research plus the previous-reading context. First decide "newEvidence": did today's research add ANYTHING for this signal that the previous reading didn't already say?
   - newEvidence=false (pure carry-forward): rationale must be ONE short sentence — "No new information this run." optionally plus a brief note of what was checked (max ~140 chars total). Do NOT re-narrate the prior story, figures, or history — the board already shows them. Keep the previous level and value, delta "flat", and confidence at or slightly below the previous reading's.
   - newEvidence=true: the rationale must LEAD with what is new versus the previous reading (the delta), then its implication — never restate the whole running story. Where the board shows a "History base rate" for the signal, judge today's evidence against it: is this move normal variation for this aspect, a rhyme with a named past episode, or a genuine break from decades of record? Say which when it changes the reading.
   For quantitative signals set "value" only when a number is directly evidenced in the research; otherwise value=null and rely on level. confidence is 0..1. citationIndexes must list EVERY numbered source the reading actually draws on — this is the desk's evidence map from signal to sources, so cite precisely: no supporting source omitted, no decorative citations added. Never write bracketed [n] references inside rationale text — cite only via citationIndexes (the app renders them as linked chips).
2. digestItems: the 4-8 most decision-relevant developments for this desk (deduplicate; skip stock-price noise). sourceIndex points into the numbered sources (or null).
3. brief: a 120-250 word morning note in markdown addressed to the investor: what changed, what to watch next, and any disconfirming evidence a bull would rather ignore. Cite evidence inline with bracketed source indexes like [12] or [3][17] pointing into the NUMBERED SOURCES — the app renders each as a clickable link, so only use indexes that exist. Refer to signals by their names in quotes, never by bracketed keys like [S3] (those keys are internal). Signals with no new evidence get at most one collective sentence ("No new information on X, Y, Z") — never per-signal re-narration.
3b. dossier: the STANDING view of the business, 150-300 words in markdown — not today's news. Paragraph 1: how this company makes money right now (segments, the earnings engine, moat trajectory) as evidenced by the board's current readings. Paragraph 2: the culture/trust verdict. Update only what today's evidence moved; keep the rest stable so the investor sees a consistent thesis evolving, not a rewrite. Cite [n] source indexes on every load-bearing claim, and when a claim reads off a board signal, add that signal's key in double braces right after it — e.g. "the toll booth is repricing {{S1}} [4]" — so the investor can jump from claim to signal. Refer to signals by name in the prose (the {{Sk}} markers render as links, never as raw keys).
4. proposals: 0-3 NEW signals only if the research surfaced a trackable thread the current board misses, OR an upgrade to an existing signal (this is the desk's self-reinforcing discovery loop — the goal is the best possible signal set). Each proposal must anchor to the business model or corporate culture, and must NOT overlap significantly in what it measures with the active board above, the pending proposals (${pendingNames.join(", ") || "none"}), or previously rejected/retired signals (${rejectedNames.join(", ") || "none"} — do not re-propose these without materially new evidence, stated in the thesis). When today's evidence shows an active signal is aimed wrong, too narrow, or a more comprehensive formulation would sit closer to the crux of the business, propose the sharper signal with "replaces" set to that active signal's exact bracketed name — approval swaps it in and retires the old one. Purely additive proposals set replaces to "". Return an empty array when nothing genuinely new emerged.

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
        { text: `${deskIdentity(symbol, ticker.name)}\n\n${SIGNAL_GUIDANCE}\n\n${SYNTHESIS_DOCTRINE}` },
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
      await insertReading({
        signalId: signal.id,
        runId,
        date,
        value: typeof r.value === "number" ? r.value : null,
        valueUnit: r.valueUnit ?? null,
        level: r.level ?? "unclear",
        delta: r.delta ?? "flat",
        confidence: Math.max(0, Math.min(1, r.confidence ?? 0.3)),
        rationale: r.rationale ?? "",
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

    // ---- Backfill deep-history backstories (bounded: 2 per run, best-effort) ----
    // Every signal should carry its decades-scale base rate; new boards fill in
    // over a few runs. This runs AFTER the run is finished, and each backstory
    // is under the strict per-stage deadline, so it can neither hang the run nor
    // eat the time budget. Failures/timeouts are logged, never fatal.
    const missingBackstory = signals.filter((s) => !s.backstory).slice(0, 2);
    for (const s of missingBackstory) {
      try {
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
