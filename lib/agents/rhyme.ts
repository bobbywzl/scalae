import { claudeJSON } from "../ai/claude";
import { geminiGroundedSearch } from "../ai/gemini";
import { resolveModel } from "../ai/models";
import { withDomain } from "../citations";
import { withDeadline } from "./research";
import { DESK_DOCTRINE, deskIdentity, RHYME_DOCTRINE, RHYME_SCHEMA } from "./framework";
import { failRhyme, finishRhyme, getRhyme, getTicker, lastCompletedRun, listSignals } from "../db";
import type { Citation, RhymeVerdict, Ticker } from "../types";

/**
 * Episode-rhyme analysis (FOUNDATION: "history is the base rate") — the
 * investor asks how one of today's developments compares with the record, and
 * the desk answers with an explicit verdict: normal variation, a rhyme with a
 * named past episode, or a genuine break. The stored signal deep-histories
 * are the desk's own archival corpus and are reused before searching; two
 * fresh archival sweeps (company analogs, industry analogs) fill in what the
 * backstories don't carry. Runs only on the investor's ask, inside the
 * route's 300s budget.
 */

interface RhymeOutput {
  verdict: RhymeVerdict;
  episode: string;
  analysis: string;
  brief: string;
}

const RHYME_SWEEP_MS = 110_000;
const RHYME_SYNTH_MS = 120_000;

const RHYME_SCOUT_RULES = `Be exhaustively company- and industry-specific: name the companies, dates, regulators and industry events — never generic "the market" narrative. Go as far back as the public record supports and date everything. Prefer primary and archival sources: old annual reports and filings, earnings-call archives, regulator documents, trade-press retrospectives, serious business histories. Skip stock-price commentary and analyst target chatter. Label anything unverifiable "(unverified)"; where a period's record is genuinely thin, say so plainly rather than filling the gap.`;

function companyAnalogPrompt(t: Ticker, event: string): string {
  return `You are a business-history researcher for a Buffett-style value-investing desk covering ${t.name} (${t.symbol}). Today is ${new Date().toDateString()}.

TODAY'S DEVELOPMENT: ${event}

Hunt ${t.name}'s OWN HISTORY for comparable episodes — events of the same kind or mechanism, however many years back. For each analog found: when it happened (dates), what actually happened (with the concrete numbers where the record has them), how management responded, how long resolution took, and what lasting effect it had on the business's moat, economics or culture. Also report the honest negative: if ${t.name}'s record simply contains nothing comparable, say so plainly. ${RHYME_SCOUT_RULES}`;
}

function industryAnalogPrompt(t: Ticker, event: string): string {
  return `You are a business-history researcher for a Buffett-style value-investing desk covering ${t.name} (${t.symbol}). Today is ${new Date().toDateString()}.

TODAY'S DEVELOPMENT: ${event}

Hunt ${t.name}'s INDUSTRY'S history for comparable episodes — the same kind of event striking named competitors or the industry as a whole, in any era. For each analog: the company/industry it hit, dates, what happened, how it resolved, and who did NOT survive it (the casualties are the base rates — name them). Note where ${t.name}'s situation today structurally differs from the analog's victims and survivors. ${RHYME_SCOUT_RULES}`;
}

export async function executeRhyme(userId: string, rhymeId: string): Promise<void> {
  try {
    const rhyme = await getRhyme(userId, rhymeId);
    if (!rhyme || rhyme.status !== "running") return;
    const ticker = await getTicker(userId, rhyme.symbol);
    if (!ticker) throw new Error(`Unknown ticker ${rhyme.symbol}`);
    const [signals, run, deepModel, synthModel] = await Promise.all([
      listSignals(userId, rhyme.symbol, "active"),
      lastCompletedRun(userId, rhyme.symbol).catch(() => undefined),
      resolveModel("scoutDeep"),
      resolveModel("synthesis"),
    ]);

    // The desk's own archival corpus first: the signals' stored deep histories
    // already carry named, dated episodes researched era by era.
    const backstories = signals
      .filter((s) => s.backstory)
      .slice(0, 8)
      .map((s) => `### Deep history of "${s.name}"\n${s.backstory!.slice(0, 3500)}`)
      .join("\n\n");

    const jobs = [
      { label: "Company analogs", prompt: companyAnalogPrompt(ticker, rhyme.eventText) },
      { label: "Industry analogs", prompt: industryAnalogPrompt(ticker, rhyme.eventText) },
    ];
    const settled = await Promise.allSettled(
      jobs.map((j) =>
        withDeadline(
          `rhyme:${j.label}`,
          (signal) =>
            geminiGroundedSearch(j.prompt, {
              model: deepModel,
              meta: { userId, feature: "rhyme" },
              signal,
            }),
          RHYME_SWEEP_MS
        ).then((r) => ({ label: j.label, text: r.text, sources: r.sources }))
      )
    );
    const sweeps = settled
      .filter(
        (s): s is PromiseFulfilledResult<{ label: string; text: string; sources: Citation[] }> =>
          s.status === "fulfilled"
      )
      .map((s) => s.value);
    if (sweeps.length === 0) throw new Error("The archival sweeps failed — try again.");

    // Bail before the synthesis if the row went terminal while the sweeps ran.
    if ((await getRhyme(userId, rhymeId))?.status !== "running") return;

    const allSources: Citation[] = [];
    const indexOf = new Map<string, number>();
    for (const s of sweeps) {
      for (const src of s.sources) {
        if (!indexOf.has(src.url)) {
          indexOf.set(src.url, allSources.length);
          allSources.push(withDomain({ ...src, foundBy: [`Rhyme: ${s.label}`] }));
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

THE DEVELOPMENT TO JUDGE AGAINST THE RECORD:
${rhyme.eventText}

${backstories ? `THE DESK'S STORED DEEP HISTORIES (the signals' researched base rates — first-class archival evidence, already era-anchored):\n${backstories}\n\n` : ""}${run?.dossier ? `THE STANDING DOSSIER (how the desk currently reads the business):\n${run.dossier}\n\n` : ""}THE ACTIVE SIGNAL BOARD (name signals in quotes when the verdict bears on them):
${signals.map((s) => `- "${s.name}" (${s.focusArea})`).join("\n") || "(none)"}

ARCHIVAL FIELD RESEARCH (two grounded sweeps: the company's own analogs, the industry's analogs; numbered sources listed at the end):
${researchBlock}

NUMBERED SOURCES:
${sourceList || "(none)"}

TASK: Deliver the episode-rhyme verdict per the rhyme doctrine — one verdict, the analysis with its [n] citations, and the 1-2 sentence brief.

LANGUAGE: Write every output field in English — the desk's stored record is canonical English; the app translates for display.`;

    const out = await withDeadline(
      "rhyme-synthesis",
      (signal) =>
        claudeJSON<RhymeOutput>({
          model: synthModel,
          signal,
          system: [
            { text: DESK_DOCTRINE, cache: true },
            { text: `${deskIdentity(rhyme.symbol, ticker.name)}\n\n${RHYME_DOCTRINE}` },
          ],
          messages: [{ role: "user", content: task }],
          schema: RHYME_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 6000,
          effort: "medium",
          meta: { userId, feature: "rhyme" },
        }),
      RHYME_SYNTH_MS
    );

    const analysis = out.analysis?.trim();
    if (!analysis) throw new Error("Rhyme synthesis came back empty — try again.");
    const verdict: RhymeVerdict =
      out.verdict === "rhyme" || out.verdict === "break" ? out.verdict : "normal";
    await finishRhyme(
      rhymeId,
      verdict,
      verdict === "rhyme" ? (out.episode ?? "").trim().slice(0, 200) : "",
      analysis,
      (out.brief ?? "").trim().slice(0, 300),
      allSources
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[scalae] rhyme analysis ${rhymeId} failed:`, msg);
    await failRhyme(rhymeId, msg).catch(() => {});
  }
}
