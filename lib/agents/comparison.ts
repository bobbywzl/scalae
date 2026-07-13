import { claudeJSON } from "../ai/claude";
import { resolveModel } from "../ai/models";
import { comparisonPersona } from "./framework";
import { getTicker, latestRun, listFocusAreas, listSignals, readingsForSignal } from "../db";
import { getQuote, quoteLine } from "../market";
import { computeInvolvement, involvementLine } from "../portfolio";

/**
 * The compare view's analyst verdict: a pairwise, opportunity-cost weighing of
 * two desks — businesses compared as businesses on the desks' EXISTING
 * evidence (dossiers + current signal readings). No new web research happens
 * here; freshness comes from running each desk's research, not this call.
 */

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
async function deskSnapshot(symbol: string): Promise<string> {
  const ticker = await getTicker(symbol);
  if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
  const [active, run, quote, focusAreas, involvement] = await Promise.all([
    listSignals(symbol, "active"),
    latestRun(symbol),
    getQuote(symbol).catch(() => null),
    listFocusAreas(symbol),
    computeInvolvement(symbol).catch(() => null),
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
export async function runComparison(a: string, b: string): Promise<string> {
  const [snapA, snapB] = await Promise.all([deskSnapshot(a), deskSnapshot(b)]);
  const model = await resolveModel("chat");
  const out = await claudeJSON<{ verdict: string }>({
    model,
    system: comparisonPersona(),
    messages: [
      {
        role: "user",
        content: `Today is ${new Date().toDateString()}. Weigh these two desks against each other.

=== DESK A ===
${snapA}

=== DESK B ===
${snapB}

TASK: Produce the pairwise opportunity-cost verdict per your output structure. Remember: desks' evidence only; four filters in veto order with price last; invert (compare kill lists); "too close to call" / "too thin to call" are honest verdicts; no buy/sell/size instructions.`,
      },
    ],
    schema: VERDICT_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 8000,
    effort: "high",
  });
  const verdict = out.verdict?.trim();
  if (!verdict) throw new Error("Comparison came back empty — try again.");
  return verdict;
}
