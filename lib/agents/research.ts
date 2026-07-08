import { claudeJSON } from "../ai/claude";
import { geminiGroundedSearch } from "../ai/gemini";
import {
  analystPersona,
  SIGNAL_GUIDANCE,
  SYNTHESIS_DOCTRINE,
  SYNTHESIS_SCHEMA,
} from "./framework";
import {
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
  runningRun,
  setRunStage,
  touchLastRun,
} from "../db";
import { getQuote, quoteLine } from "../market";
import type { Citation, Delta, ReadingLevel, Run, Signal, SignalProposal } from "../types";

interface SynthesisOutput {
  brief: string;
  readings: {
    signalKey: string;
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

interface Sweep {
  label: string;
  text: string;
  sources: Citation[];
}

/** Start a run unless one is already going. Returns the run to poll. */
export async function startRun(symbol: string): Promise<{ run: Run; started: boolean }> {
  await reapStuckRuns(symbol);
  const existing = await runningRun(symbol);
  if (existing) return { run: existing, started: false };
  const run = await createRun(symbol);
  return { run, started: true };
}

/** How fresh a window to research: since the last completed run, else 7 days. */
async function windowDays(symbol: string): Promise<number> {
  const last = await latestRun(symbol);
  if (!last?.finishedAt) return 7;
  const days = Math.ceil((Date.now() - Date.parse(last.finishedAt)) / 86_400_000);
  return Math.min(14, Math.max(2, days + 1));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sweepPrompt(
  symbol: string,
  name: string,
  days: number,
  signals: Signal[],
  broad: boolean
): string {
  const date = new Date().toDateString();
  const signalBlock = signals
    .map((s, i) => `${i + 1}. "${s.name}" — ${s.measurementPlan} (scale: ${s.scale})`)
    .join("\n");
  if (broad) {
    return `You are a research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${date}.

Search the web for company developments from roughly the last ${days} days that a long-term business owner must know: earnings and guidance substance, management changes and statements, capital allocation moves (buybacks, dividends, M&A, big capex), regulatory/legal developments, competitive shifts, customer/product traction, employee & culture signals, accounting or governance red flags.

Ground every finding in search results. For each finding output:
- HEADLINE (date, source)
- 2-3 sentence factual summary with concrete numbers where available
Skip stock-price commentary and analyst price-target chatter. If genuinely nothing notable happened, say so plainly. Do not pad with old background information unless you label it "(context)".`;
  }
  return `You are a research scout for a Buffett-style value-investing desk covering ${name} (${symbol}). Today is ${date}.

Search the web for developments from roughly the last ${days} days relevant to these tracked signals:

${signalBlock}

Ground every finding in search results. For each finding output:
- HEADLINE (date, source)
- 2-3 sentence factual summary with concrete numbers where available
- "Informs signal(s): #n" for the signal numbers it bears on
If you find nothing for a signal, write 'No news found: "<signal name>"'. Skip stock-price commentary. Do not speculate or fill gaps from background knowledge unless labeled "(context)".`;
}

/**
 * Execute the daily pipeline for a run created by startRun():
 *   1) Gemini grounded sweeps (per signal bundle + one broad sweep)
 *   2) Claude synthesis: signal readings, digest, brief, new-signal discovery
 */
export async function executeRun(runId: string, symbol: string): Promise<void> {
  try {
    const ticker = await getTicker(symbol);
    if (!ticker) throw new Error(`Unknown ticker ${symbol}`);
    const signals = await listSignals(symbol, "active");
    if (signals.length === 0) throw new Error("No active signals — approve some signals first.");

    const days = await windowDays(symbol);
    const bundles = chunk(signals, 5);
    await setRunStage(
      runId,
      "sweeping",
      `Gemini scouts sweeping the open web (${bundles.length + 1} parallel sweeps, ${days}-day window)…`
    );

    const sweepJobs: Promise<Sweep>[] = [
      ...bundles.map((b, i) =>
        geminiGroundedSearch(sweepPrompt(symbol, ticker.name, days, b, false)).then((r) => ({
          label: `Signal sweep ${i + 1}: ${b.map((s) => s.name).join(", ")}`,
          text: r.text,
          sources: r.sources,
        }))
      ),
      geminiGroundedSearch(sweepPrompt(symbol, ticker.name, days, [], true)).then((r) => ({
        label: "Broad company sweep",
        text: r.text,
        sources: r.sources,
      })),
    ];
    const settled = await Promise.allSettled(sweepJobs);
    const sweeps = settled
      .filter((s): s is PromiseFulfilledResult<Sweep> => s.status === "fulfilled")
      .map((s) => s.value);
    if (sweeps.length === 0) {
      const firstErr = settled.find((s) => s.status === "rejected") as PromiseRejectedResult;
      throw new Error(`All research sweeps failed: ${firstErr?.reason?.message ?? "unknown"}`);
    }

    // Number the de-duplicated sources across sweeps so Claude cites by index.
    const allSources: Citation[] = [];
    const indexOf = new Map<string, number>();
    for (const s of sweeps) {
      for (const src of s.sources) {
        if (!indexOf.has(src.url)) {
          indexOf.set(src.url, allSources.length);
          allSources.push(src);
        }
      }
    }

    await setRunStage(
      runId,
      "synthesizing",
      "Claude analyst reading the field research and updating the signal board…"
    );

    const quote = await getQuote(symbol).catch(() => null);
    const focusAreas = await listFocusAreas(symbol);
    const guidance = (await listMessages(symbol))
      .filter((m) => m.role === "user")
      .slice(-6)
      .map((m) => `- ${m.content.slice(0, 300)}`)
      .join("\n");

    // Stable short keys so synthesis readings can't miss on name drift.
    const keyed = signals.map((s, i) => ({ key: `S${i + 1}`, signal: s }));
    const byKey = new Map(keyed.map((k) => [k.key, k.signal]));

    const boardBlock = (
      await Promise.all(
        keyed.map(async ({ key, signal: s }) => {
          const prev = (await readingsForSignal(s.id, 1))[0];
          const prevLine = prev
            ? ` Previous reading (${prev.date.slice(0, 10)}): level=${prev.level}${prev.value != null ? `, value=${prev.value} ${prev.valueUnit ?? ""}` : ""}, confidence=${prev.confidence} — ${prev.rationale}`
            : " No previous reading.";
          return `- [${key}] "${s.name}" (${s.type}, focus: ${s.focusArea}). Plan: ${s.measurementPlan} Scale: ${s.scale}.${prevLine}`;
        })
      )
    ).join("\n");

    const researchBlock = sweeps
      .map(
        (s) =>
          `=== ${s.label} ===\n${s.text}\nSources used by this sweep: ${
            s.sources.map((src) => `[${indexOf.get(src.url)}] ${src.title}`).join(", ") || "(none)"
          }`
      )
      .join("\n\n");

    const sourceList = allSources.map((s, i) => `[${i}] ${s.title} — ${s.url}`).join("\n");
    // Full non-duplication context: pending + previously rejected/retired signals.
    const [pendingSignals, dismissedSignals, retiredSignals] = await Promise.all([
      listSignals(symbol, "suggested"),
      listSignals(symbol, "dismissed"),
      listSignals(symbol, "retired"),
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

FIELD RESEARCH (grounded web sweeps from the scout desk; numbered sources listed at the end):
${researchBlock}

NUMBERED SOURCES:
${sourceList || "(none)"}

TASK — produce today's desk output:
1. readings: exactly one per active signal above — ${keyed.length} readings total; "signalKey" must be the signal's bracketed key ("S1", "S2", …). Base readings only on the field research plus the previous-reading context. If there is no new evidence for a signal: keep the level close to the previous one (or "unclear" if none), delta "flat", confidence <= 0.4, and a rationale saying no new evidence emerged. For quantitative signals set "value" only when a number is directly evidenced in the research; otherwise value=null and rely on level. confidence is 0..1. citationIndexes point into the numbered sources.
2. digestItems: the 4-8 most decision-relevant developments for this desk (deduplicate; skip stock-price noise). sourceIndex points into the numbered sources (or null).
3. brief: a 120-250 word morning note in markdown addressed to the investor: what changed, what to watch next, and any disconfirming evidence a bull would rather ignore.
4. proposals: 0-3 NEW signals only if the research surfaced a trackable thread the current board misses (this is the desk's self-reinforcing discovery loop). Each proposal must anchor to the business model or corporate culture, and must NOT overlap significantly in what it measures with the active board above, the pending proposals (${pendingNames.join(", ") || "none"}), or previously rejected/retired signals (${rejectedNames.join(", ") || "none"} — do not re-propose these without materially new evidence, stated in the thesis). If an existing signal should be sharpened instead, mention it in the brief rather than proposing a near-twin. Return an empty array when nothing genuinely new emerged.`;

    const out = await claudeJSON<SynthesisOutput>({
      system: `${analystPersona(symbol, ticker.name)}\n\n${SIGNAL_GUIDANCE}\n\n${SYNTHESIS_DOCTRINE}`,
      messages: [{ role: "user", content: task }],
      schema: SYNTHESIS_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 16000,
    });

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
        citations,
      });
    }

    for (const d of out.digestItems ?? []) {
      const src =
        d.sourceIndex != null && d.sourceIndex >= 0 && d.sourceIndex < allSources.length
          ? allSources[d.sourceIndex]
          : null;
      await insertDigestItem({
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
      if (p.name?.trim()) await insertProposal(symbol, p, "research");
    }

    await finishRun(runId, out.brief ?? "");
    await touchLastRun(symbol);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[scalae] run ${runId} (${symbol}) failed:`, msg);
    await failRun(runId, msg).catch(() => {});
  }
}
