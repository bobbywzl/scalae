import { claudeJSON } from "../ai/claude";
import { geminiGroundedSearch } from "../ai/gemini";
import { resolveModel } from "../ai/models";
import { withDomain } from "../citations";
import { getSignal, getTicker, setSignalBackstory } from "../db";
import type { Citation, Signal, Ticker } from "../types";
import { DESK_DOCTRINE, deskIdentity, BACKSTORY_DOCTRINE, BACKSTORY_SCHEMA } from "./framework";

/**
 * Signal deep-history research: how the aspect a signal measures has evolved
 * over years/decades and fared through the events that actually tested it.
 * Three deep, company- and industry-specific sweeps (the strong scout model —
 * this runs once per signal, not daily) feed one framework-anchored synthesis.
 */

interface BackstoryOutput {
  backstory: string;
  brief: string;
}

const HISTORY_SCOUT_RULES = `Be exhaustively company- and industry-specific: name the company, its predecessors, its actual competitors, its regulators and its industry's real events — never generic "the market" narrative. Go as far back as the public record supports (founding/IPO era onward where possible) and date everything. Prefer primary and archival sources: old annual reports and filings, earnings-call archives, regulator documents, trade-press retrospectives, serious business histories. Skip stock-price commentary and analyst target chatter. Label anything unverifiable "(unverified)"; if a period's record is genuinely thin, say so plainly rather than filling the gap.`;

function companyHistoryPrompt(t: Ticker, s: Signal): string {
  return `You are a business-history researcher for a value-investing desk covering ${t.name} (${t.symbol}).

The desk tracks this signal: "${s.name}" — ${s.thesis} Measurement: ${s.measurementPlan}

Trace the COMPANY-SPECIFIC history of the aspect this signal measures, over years and decades: how it looked in each era of ${t.name}'s life, the key inflection points (management decisions, pricing actions, product/segment shifts, capital moves) that changed it, and rough levels or trajectories per era where numbers exist. ${HISTORY_SCOUT_RULES}`;
}

function industryHistoryPrompt(t: Ticker, s: Signal): string {
  return `You are a business-history researcher for a value-investing desk covering ${t.name} (${t.symbol}).

The desk tracks this signal: "${s.name}" — ${s.thesis} Measurement: ${s.measurementPlan}

Trace the INDUSTRY-STRUCTURAL history of the aspect this signal measures — how it has evolved across ${t.name}'s actual industry over the decades: structural shifts (consolidation, price wars, capacity cycles, technology substitution, regulation, channel changes) that moved this aspect industry-wide; which competitors' versions of it strengthened, weakened, or died (name them — the failures are the base rates); and where ${t.name} sat relative to its peers in each era. ${HISTORY_SCOUT_RULES}`;
}

function stressEpisodesPrompt(t: Ticker, s: Signal): string {
  return `You are a business-history researcher for a value-investing desk covering ${t.name} (${t.symbol}).

The desk tracks this signal: "${s.name}" — ${s.thesis} Measurement: ${s.measurementPlan}

Find how the aspect this signal measures FARED UNDER STRESS — the specific episodes that actually tested it for ${t.name} and its industry: recessions and credit crunches (2000-02, 2008-09, 2020, 2022 inflation/rates — whichever the company existed for), industry-specific shocks (price wars, disruptive entrants, supply crises), regulatory strikes, and ${t.name}'s own company-specific crises (scandals, recalls, leadership breaks, delisting scares). For each episode: what happened to this aspect, how management responded, and how long recovery took (or whether it never recovered). If the company is too young for an episode, report how its INDUSTRY fared then, clearly labeled as industry evidence. ${HISTORY_SCOUT_RULES}`;
}

/**
 * Research and store a signal's backstory. Returns the stored fields.
 * Throws on unknown signal/ticker or if synthesis fails.
 */
export async function researchSignalBackstory(
  userId: string,
  signalId: string,
  abortSignal?: AbortSignal
): Promise<{ backstory: string; brief: string; sources: Citation[]; backstoryAt: string }> {
  const signal = await getSignal(signalId);
  if (!signal || (signal.userId && signal.userId !== userId)) {
    throw new Error("Unknown signal.");
  }
  const ticker = await getTicker(userId, signal.symbol);
  if (!ticker) throw new Error(`Unknown ticker ${signal.symbol}`);

  // Backstory is background enrichment (once per signal, cached forever), not
  // the daily crown-jewel reading — the value tier is plenty. See lib/ai/models.
  const [deepModel, backstoryModel] = await Promise.all([
    resolveModel("scoutDeep"),
    resolveModel("backstory"),
  ]);

  const sweeps = await Promise.allSettled(
    [
      { label: "Company history", prompt: companyHistoryPrompt(ticker, signal) },
      { label: "Industry history", prompt: industryHistoryPrompt(ticker, signal) },
      { label: "Stress episodes", prompt: stressEpisodesPrompt(ticker, signal) },
    ].map((j) =>
      geminiGroundedSearch(j.prompt, { model: deepModel, meta: { userId, feature: "backstory" }, signal: abortSignal }).then((r) => ({
        label: j.label,
        text: r.text,
        sources: r.sources,
      }))
    )
  );
  const ok = sweeps
    .filter((s): s is PromiseFulfilledResult<{ label: string; text: string; sources: Citation[] }> =>
      s.status === "fulfilled"
    )
    .map((s) => s.value);
  if (ok.length === 0) throw new Error("All history sweeps failed — try again.");

  // Number the deduped sources so the synthesis cites [n] (same idiom as runs).
  const allSources: Citation[] = [];
  const indexOf = new Map<string, number>();
  for (const s of ok) {
    for (const src of s.sources) {
      if (!indexOf.has(src.url)) {
        indexOf.set(src.url, allSources.length);
        allSources.push(withDomain({ ...src, foundBy: [`History: ${s.label}`] }));
      }
    }
  }

  const researchBlock = ok
    .map(
      (s) =>
        `=== ${s.label} ===\n${s.text}\nSources used by this sweep: ${
          s.sources.map((src) => `[${indexOf.get(src.url)}] ${src.title}`).join(", ") || "(none)"
        }`
    )
    .join("\n\n");
  const sourceList = allSources.map((s, i) => `[${i}] ${s.title} — ${s.url}`).join("\n");

  const task = `Today is ${new Date().toDateString()}.

THE SIGNAL WHOSE DEEP HISTORY YOU ARE WRITING:
"${signal.name}" (${signal.type}, focus area: ${signal.focusArea})
Thesis: ${signal.thesis}
Measurement plan: ${signal.measurementPlan}
Scale: ${signal.scale}

FIELD RESEARCH (three history sweeps; numbered sources listed at the end):
${researchBlock}

NUMBERED SOURCES:
${sourceList || "(none)"}

TASK: Write the signal's deep-history backstory per the backstory doctrine — era-by-era evolution of the measured aspect, the stress-test episodes and how the aspect fared through each, framework anchoring (which lens and anchor each era's evidence loads on), [n] citations on load-bearing claims, era-honesty about what the record does and doesn't show, and the closing base-rate paragraph. Also produce the 1-2 sentence "brief" the daily synthesis will read as this signal's base rate.`;

  const out = await claudeJSON<BackstoryOutput>({
    model: backstoryModel,
    signal: abortSignal,
    system: [
      { text: DESK_DOCTRINE, cache: true },
      { text: `${deskIdentity(signal.symbol, ticker.name)}\n\n${BACKSTORY_DOCTRINE}` },
    ],
    messages: [{ role: "user", content: task }],
    schema: BACKSTORY_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 8000,
    effort: "medium",
    meta: { userId, feature: "backstory" },
  });
  const backstory = out.backstory?.trim();
  if (!backstory) throw new Error("History synthesis came back empty — try again.");
  const brief = (out.brief ?? "").trim().slice(0, 300);

  await setSignalBackstory(signalId, backstory, brief, allSources);
  return { backstory, brief, sources: allSources, backstoryAt: new Date().toISOString() };
}
