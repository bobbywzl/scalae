import { claudeJSON, effortFromEnv } from "../ai/claude";
import { resolveModel } from "../ai/models";
import { cleansingBenchContext } from "./context";
import {
  BOARD_REVIEW_DOCTRINE,
  BOARD_REVIEW_SCHEMA,
  DESK_DOCTRINE,
  deskIdentity,
  EXPERT_LOOP_GUIDANCE,
  QUESTION_METHOD,
  SIGNAL_GUIDANCE,
} from "./framework";
import {
  getDeskContext,
  getDiligenceSynthesis,
  getTicker,
  insertMessage,
  insertProposal,
  latestDoneRun,
  listAccumulations,
  listDiligenceEvidence,
  listDiligenceResearch,
  listFocusAreas,
  listMessages,
  listNoteSections,
  listNotes,
  listSignals,
  readingsForSignal,
} from "../db";
import { diligenceContext } from "../notes";
import { getQuote, quoteLine } from "../market";
import type { Signal, SignalProposal } from "../types";
import { withDeadline } from "./research";

/**
 * The board review — a standing-back pass over the WHOLE signal board, run on
 * the investor's ask. Where the daily run reads evidence into the existing
 * instruments, the review questions the instruments themselves: per signal, is
 * this still the crux measurement (keep), does its plan need sharpening
 * (sharpen), should a better formulation replace it (replace), or has its
 * thread resolved (retire)? Verdicts are advisory prose; only the proposals it
 * parks are actionable, and those go through the same human approval gate as
 * every other proposal (FOUNDATION: proposed, never imposed).
 */

interface BoardReviewOutput {
  review: string;
  assessments: {
    signalName: string;
    verdict: "keep" | "sharpen" | "replace" | "retire";
    reasoning: string;
  }[];
  proposals: SignalProposal[];
}

/**
 * Review reasoning effort. The review is one judgment-heavy call over an
 * already-assembled desk state — medium by default (it weighs the whole board,
 * unlike the daily synthesis's low), env-overridable like the other stages.
 */
const reviewEffort = () => effortFromEnv("CLAUDE_BOARD_REVIEW_EFFORT", "medium");

/**
 * The review runs inside a 300s route; the single model call gets a generous
 * but hard deadline so a hung stream fails cleanly instead of the platform
 * reaping the function mid-write.
 */
const REVIEW_LIMIT_MS = 240_000;

/**
 * One signal's review line: the daily board line's shape (research.ts's
 * signalBoardLine is deliberately unexported — this stays a local equivalent)
 * DEEPENED with the last 3 readings, because reviewing an instrument needs its
 * recent trajectory, not just its latest point: a signal reading "unclear" for
 * three straight runs argues differently than one that just dipped.
 */
async function reviewBoardLine(key: string, s: Signal): Promise<string> {
  const readings = await readingsForSignal(s.id, 3);
  const historyLines = readings.length
    ? readings
        .map(
          (r) =>
            `    · ${r.date.slice(0, 10)}: level=${r.level}, delta=${r.delta}, confidence=${r.confidence}${r.newEvidence === false ? " (carry-forward)" : ""}${r.value != null ? `, value=${r.value} ${r.valueUnit ?? ""}` : ""} — ${r.rationale.length > 200 ? `${r.rationale.slice(0, 199)}…` : r.rationale}`
        )
        .join("\n")
    : "    · No readings yet.";
  const baseRate = s.backstoryBrief ? `\n    History base rate: ${s.backstoryBrief}` : "";
  return `- [${key}] "${s.name}" (${s.type}, focus: ${s.focusArea}). Thesis: ${s.thesis} Plan: ${s.measurementPlan} Scale: ${s.scale}${baseRate}\n  Last ${readings.length || "0"} reading(s), newest first:\n${historyLines}`;
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
 * Execute a board review synchronously (the route awaits it): assemble the
 * full desk state, make ONE review call, park its proposals for approval, and
 * land the memo in the desk chat thread where board conversations live.
 * Returns the review markdown and how many proposals were parked.
 */
export async function executeBoardReview(
  userId: string,
  symbol: string
): Promise<{ review: string; proposalCount: number }> {
  const ticker = await getTicker(userId, symbol);
  if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
  const signals = await listSignals(userId, symbol, "active");
  if (signals.length === 0) throw new Error("Approve at least one signal before reviewing the board.");
  const model = await resolveModel("synthesis");

  // Assemble the desk state in parallel — the review must stand on the same
  // connected picture every other analyst surface reads (FOUNDATION: one
  // desk), plus the deeper per-signal reading history only a review needs.
  const [
    boardLines,
    focusAreas,
    pendingSignals,
    dismissedSignals,
    retiredSignals,
    lastDone,
    ddBlock,
    ctx,
    benchBlock,
    guidance,
    accumulations,
    quote,
  ] = await Promise.all([
    Promise.all(signals.map((s, i) => reviewBoardLine(`S${i + 1}`, s))),
    listFocusAreas(userId, symbol),
    listSignals(userId, symbol, "suggested"),
    listSignals(userId, symbol, "dismissed"),
    listSignals(userId, symbol, "retired"),
    latestDoneRun(userId, symbol).catch(() => undefined),
    diligenceRecordBlock(userId, symbol),
    getDeskContext(userId, symbol).catch(() => undefined),
    cleansingBenchContext(userId, symbol).catch(() => ""),
    investorGuidance(userId, symbol),
    listAccumulations(userId, symbol, 12).catch(() => []),
    getQuote(symbol).catch(() => null),
  ]);

  const pendingNames = pendingSignals.map((s) => `"${s.name}"`).join(", ") || "none";
  const rejectedNames =
    [...dismissedSignals, ...retiredSignals].map((s) => `"${s.name}"`).join(", ") || "none";
  const dossier = lastDone?.dossier?.trim() ?? "";
  const ctxContent = ctx?.content?.trim() ?? "";
  const accumBlock = accumulations.length
    ? accumulations
        .map(
          (a) =>
            `- [${a.createdAt.slice(0, 10)}] "${a.topic}": ${a.insight.length > 300 ? `${a.insight.slice(0, 299)}…` : a.insight}${a.signalNames.length ? ` (bears on: ${a.signalNames.join(", ")})` : ""}`
        )
        .join("\n")
    : "(none yet)";

  const deskState = `DESK STATE (today: ${new Date().toDateString()}). ${quoteLine(quote)}

ACTIVE SIGNAL BOARD (each signal with its last 3 readings, newest first — the trajectory the review judges):
${boardLines.join("\n")}

INVESTOR FOCUS AREAS:
${focusAreas.map((f) => `- ${f.title}: ${f.description}`).join("\n") || "(none recorded)"}

PENDING PROPOSALS AWAITING THE INVESTOR'S REVIEW: ${pendingNames}
PREVIOUSLY DISMISSED OR RETIRED SIGNALS (do not re-propose without materially new evidence, stated in the thesis): ${rejectedNames}

${dossier ? `THE DESK'S STANDING DOSSIER (the business as the desk currently reads it):\n${dossier}\n\n` : ""}${ctxContent ? `THE DESK'S CONTEXT BOARD (recently answered questions, established context, open threads):\n${ctxContent}\n\n` : ""}${ddBlock ? `${ddBlock}\n\n` : ""}${benchBlock ? `THE REPORTED NUMBERS AND THE INVESTOR'S CLEANSED VIEW (how the investor reads this record):\n${benchBlock}\n\n` : ""}ANALYST RESEARCH ACCUMULATIONS (the durable insight record, newest first — what the runs have actually established for the 10-year owner question):
${accumBlock}

RECENT INVESTOR GUIDANCE (newest last):
${guidance || "(none)"}

TASK: Conduct the board review per the board-review doctrine — the review memo, one assessment per active signal above (signalName must be the signal's exact quoted name; verdict keep/sharpen/replace/retire with the reasoning), and 0-4 proposals for the replacements or additions the review argues for (a "replace" verdict should normally come with the sharper proposal, "replaces" set to the exact active signal name; the same no-overlap discipline as always applies against the active board, the pending proposals and the rejected list above).

LANGUAGE: Write EVERY output field in English, even if investor guidance or evidence quotes appear in another language — the desk's stored record is canonical English, and the app translates it into the investor's display language automatically.`;

  const out = await withDeadline(
    "boardReview",
    (signal) =>
      claudeJSON<BoardReviewOutput>({
        model,
        signal,
        // Same cached doctrine prefix as every desk call — the review only
        // adds its own doctrine to the dynamic tail.
        system: [
          { text: DESK_DOCTRINE, cache: true },
          {
            text: `${deskIdentity(symbol, ticker.name)}\n\n${QUESTION_METHOD}\n\n${SIGNAL_GUIDANCE}\n\n${EXPERT_LOOP_GUIDANCE}\n\n${BOARD_REVIEW_DOCTRINE}`,
          },
        ],
        messages: [{ role: "user", content: deskState }],
        schema: BOARD_REVIEW_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 8000,
        effort: reviewEffort(),
        meta: { userId, feature: "boardReview" },
      }),
    REVIEW_LIMIT_MS
  );

  // Park the review's proposals behind the standard approval gate. Same cap
  // and empty-name guard as the daily run; insertProposal itself dedupes
  // against live names and resolves "replaces".
  let proposalCount = 0;
  for (const p of (out.proposals ?? []).slice(0, 4)) {
    if (!p.name?.trim()) continue;
    const id = await insertProposal(userId, symbol, p, "research").catch(() => null);
    if (id) proposalCount++;
  }

  const review = (out.review ?? "").trim();
  const assessments = (out.assessments ?? []).filter((a) => a.signalName?.trim());
  const verdictTag: Record<string, string> = {
    keep: "KEEP",
    sharpen: "SHARPEN",
    replace: "REPLACE",
    retire: "RETIRE",
  };
  // The chat-visible memo: the review plus a compact per-signal verdict list.
  // It lands in the desk thread (signalId null) via the same insertMessage
  // chat.ts uses, so the review lives where the board conversation happens.
  const chatBody = [
    review,
    assessments.length
      ? `**Signal assessments**\n${assessments
          .map(
            (a) =>
              `- **${a.signalName.trim()}** — ${verdictTag[a.verdict] ?? a.verdict}: ${(a.reasoning ?? "").trim()}`
          )
          .join("\n")}`
      : "",
    proposalCount > 0
      ? `_${proposalCount} proposal${proposalCount === 1 ? "" : "s"} from this review await${proposalCount === 1 ? "s" : ""} your approval on the board._`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  if (chatBody) {
    await insertMessage(userId, symbol, "assistant", chatBody, [], [], null).catch((e) =>
      console.error(
        `[scalae] board review chat insert (${symbol}) failed:`,
        e instanceof Error ? e.message : e
      )
    );
  }

  return { review, proposalCount };
}
