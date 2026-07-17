import { claudeJSON, effortFromEnv } from "../ai/claude";
import { CLAUDE_OVERLOAD_FALLBACK } from "../ai/fallback";
import { resolveModel } from "../ai/models";
import { comparisonPersona } from "./framework";
import { withDeadline } from "./research";
import { getTicker, latestRun, listFocusAreas, listSignals, readingsForSignal } from "../db";
import type { Lang } from "../i18n/config";
import { getQuote, quoteLine } from "../market";
import { computeInvolvement, involvementLine } from "../portfolio";

/**
 * The compare view's analyst verdict: a pairwise, opportunity-cost weighing of
 * two desks — businesses compared as businesses on the desks' EXISTING
 * evidence (dossiers + current signal readings). No new web research happens
 * here; freshness comes from running each desk's research, not this call.
 */

/** Hard wall-clock cap for the verdict call (primary + overload fallback). */
const COMPARE_DEADLINE_MS = 240_000;

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict"],
  properties: {
    verdict: {
      type: "string",
      description:
        "The full comparison in markdown, per the output structure in the system prompt.",
    },
  },
} as const;

/** One desk's evidence snapshot, compact enough to weigh two side by side. */
async function deskSnapshot(userId: string, symbol: string): Promise<string> {
  const ticker = await getTicker(userId, symbol);
  if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
  const [active, run, quote, focusAreas, involvement] = await Promise.all([
    listSignals(userId, symbol, "active"),
    latestRun(userId, symbol),
    getQuote(symbol).catch(() => null),
    listFocusAreas(userId, symbol),
    computeInvolvement(userId, symbol).catch(() => null),
  ]);

  const signalLines = (
    await Promise.all(
      active.map(async (s) => {
        const r = (await readingsForSignal(s.id, 1))[0];
        const reading = r
          ? `${r.level}, delta ${r.delta}, confidence ${r.confidence}${
              r.value != null ? `, value ${r.value} ${r.valueUnit ?? ""}` : ""
            }${r.newEvidence === false ? " (carry-forward)" : ""} — ${r.rationale.slice(0, 240)}`
          : "no readings yet";
        return `- "${s.name}" (${s.type}, focus: ${s.focusArea}). Thesis: ${s.thesis.slice(0, 200)} Latest: ${reading}`;
      })
    )
  ).join("\n");

  const position = involvementLine(involvement);
  return `TICKER: ${ticker.name} (${symbol})
Market: ${quoteLine(quote)}
Investor's position: ${position || "none recorded"}
Focus areas: ${focusAreas.map((f) => f.title).join("; ") || "(none)"}
Last research run: ${run ? `${run.startedAt.slice(0, 10)} (${run.status})` : "never"}

STANDING DOSSIER (business model + culture, as the desk currently reads it):
${run?.dossier?.trim() || "(no dossier yet — this desk's research has not produced a standing thesis)"}

ACTIVE SIGNAL BOARD (${active.length} signals):
${signalLines || "(no active signals)"}`;
}

/** Run the pairwise opportunity-cost comparison; returns the verdict markdown. */
export async function runComparison(
  userId: string,
  a: string,
  b: string,
  lang: Lang = "en"
): Promise<string> {
  const [snapA, snapB] = await Promise.all([deskSnapshot(userId, a), deskSnapshot(userId, b)]);
  const model = await resolveModel("chat");
  // The verdict is stateless (never persisted) — write it directly in the
  // investor's language instead of round-tripping through the display layer.
  const languageNote =
    lang === "zh"
      ? "\nLANGUAGE: Write the verdict in natural, professional Simplified Chinese (keep ticker symbols, company names and numbers as-is; quote signal names in their original English)."
      : "";
  // Interactive verdict: medium effort by default (effortFromEnv — a "high"
  // think over two full desk snapshots ran past the route budget and surfaced
  // to the investor as a timeout), under a hard deadline so a hung call fails
  // into the retry path rather than the platform's function kill.
  const out = await withDeadline(
    "Comparison verdict",
    (signal) =>
      claudeJSON<{ verdict: string }>({
        model,
        signal,
        // The comparison persona is fully static (the two desks go in the user
        // message) — cache it so back-to-back comparisons re-read it cheaply.
        system: [{ text: comparisonPersona(), cache: true }],
        messages: [
          {
            role: "user",
            content: `Today is ${new Date().toDateString()}. Weigh these two desks against each other.

=== DESK A ===
${snapA}

=== DESK B ===
${snapB}

TASK: Produce the pairwise opportunity-cost verdict per your output structure. Remember: desks' evidence only; four filters in veto order with price last; invert (compare kill lists); "too close to call" / "too thin to call" are honest verdicts; no buy/sell/size instructions.${languageNote}`,
          },
        ],
        schema: VERDICT_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 8000,
        effort: effortFromEnv("CLAUDE_COMPARE_EFFORT", "medium"),
        meta: { userId, feature: "compare" },
        // Interactive: fall back rather than fail the verdict on an Opus overload.
        fallbackModel: CLAUDE_OVERLOAD_FALLBACK,
      }),
    COMPARE_DEADLINE_MS
  );
  const verdict = out.verdict?.trim();
  if (!verdict) throw new Error("Comparison came back empty — try again.");
  return verdict;
}
