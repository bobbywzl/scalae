import { adjustmentLines, applyCleansing } from "../cleansing";
import {
  getDiligenceSynthesis,
  listDiligenceEvidence,
  listDiligenceResearch,
  listFinAdjustments,
  listFocusAreas,
  listNoteSections,
  listNotes,
  listSignals,
  readingsForSignal,
} from "../db";
import { financialsSummary, peekFinancials } from "../financials";
import { diligenceContext } from "../notes";
import type { FinAdjustment, TickerFinancials } from "../types";

/**
 * Cross-desk shared context. The ticker's three analyst surfaces — the
 * signals desk chat, the financial analyst desk, and the due-diligence
 * agents — are one connected desk: each reads the other two's boards through
 * the blocks below, so no analyst reasons about the ticker with a third of
 * the picture. Strictly READ-ONLY context — every surface's write scope
 * stays its own board, and every write stays behind its own human gate
 * (FOUNDATION: human sovereignty).
 */

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** The signal board as compact prompt lines, for the desks that don't own it. */
export async function signalBoardContext(userId: string, symbol: string): Promise<string> {
  const [focusAreas, active, suggested] = await Promise.all([
    listFocusAreas(userId, symbol).catch(() => []),
    listSignals(userId, symbol, "active").catch(() => []),
    listSignals(userId, symbol, "suggested").catch(() => []),
  ]);
  if (focusAreas.length === 0 && active.length === 0 && suggested.length === 0) {
    return "THE SIGNAL BOARD (the signals desk's instrument panel): (no signals yet)";
  }
  const lines = await Promise.all(
    active.map(async (s) => {
      const latest = (await readingsForSignal(s.id, 1).catch(() => []))[0];
      const reading = latest
        ? ` Latest (${latest.date.slice(0, 10)}): ${latest.level}${
            latest.value != null ? `, ${latest.value} ${latest.valueUnit ?? ""}` : ""
          } — ${clip(latest.rationale, 180)}`
        : " No readings yet.";
      return `- "${s.name}" (${s.type}, ${s.focusArea}): ${clip(s.thesis, 160)}${reading}`;
    })
  );
  return `THE SIGNAL BOARD (the signals desk's instrument panel — read-only here; board and signal changes belong to the signals desk):
Focus areas: ${focusAreas.map((f) => f.title).join("; ") || "none yet"}
Active signals:
${lines.join("\n") || "(none)"}
Pending signal proposals awaiting the investor's approval: ${
    suggested.map((s) => `"${s.name}"`).join(", ") || "none"
  }`;
}

/**
 * The finance-cleansing bench's state as compact prompt lines — pure string
 * builder for callers that already hold the financials and adjustments (the
 * signals chat). Applied overlays, what awaits review, board-shape edits in
 * effect, and the current raw → cleansed diff.
 */
export function benchLines(fin: TickerFinancials, adjustments: FinAdjustment[]): string {
  const applied = adjustments.filter((a) => a.status === "applied");
  const pending = adjustments.filter((a) => a.status === "suggested");
  const cleansed = applied.length > 0 ? applyCleansing(fin, applied) : null;
  const diff = cleansed
    ? cleansed.cells
        .slice(0, 14)
        .map(
          (c) =>
            `- ${c.metricKey} FY${c.year}: ${c.raw ?? "null"} → ${c.cleansed ?? "null"}${c.derived ? " (derived)" : ""}`
        )
        .join("\n")
    : "";
  const shape: string[] = [];
  if (cleansed?.addedYears.length) shape.push(`added year column(s): ${cleansed.addedYears.join(", ")}`);
  if (cleansed?.hiddenYears.length) shape.push(`hidden year column(s): ${cleansed.hiddenYears.join(", ")}`);
  if (cleansed?.hiddenRows.length) shape.push(`hidden row(s): ${cleansed.hiddenRows.join(", ")}`);
  return `THE FINANCE-CLEANSING BENCH (the financial analyst desk's board — the investor's human-gated cleansed view of the reported record; read-only here, adjustments belong to that desk):
Applied adjustments (${applied.length}):
${adjustmentLines(applied, fin.currency)}
Awaiting the investor's review (${pending.length}): ${pending.map((a) => `"${a.title}"`).join("; ") || "none"}
${shape.length ? `Board-shape edits in effect: ${shape.join("; ")}\n` : ""}Current raw → cleansed differences${
    cleansed && cleansed.cells.length > 14 ? ` (first 14 of ${cleansed.cells.length})` : ""
  }:
${diff || "(none — the cleansed view equals the reported record)"}`;
}

/**
 * Reported financials summary + bench state, fetched — for the due-diligence
 * agents, which hold neither. Cache-only financials read (never pays the
 * provider fetch); empty string when no financials exist for the ticker.
 */
export async function cleansingBenchContext(userId: string, symbol: string): Promise<string> {
  const fin = await peekFinancials(symbol).catch(() => null);
  if (!fin || fin.fiscalYears.length === 0) return "";
  const adjustments = await listFinAdjustments(userId, symbol).catch(() => [] as FinAdjustment[]);
  return `${financialsSummary(fin)}\n\n${benchLines(fin, adjustments)}`;
}

/** The investor's due-diligence record, fetched (wraps lib/notes.ts diligenceContext). */
export async function diligenceRecordContext(userId: string, symbol: string): Promise<string> {
  const [sections, notes, research, synthesis, evidence] = await Promise.all([
    listNoteSections(userId, symbol).catch(() => []),
    listNotes(userId, symbol).catch(() => []),
    listDiligenceResearch(userId, symbol).catch(() => []),
    getDiligenceSynthesis(userId, symbol).catch(() => null),
    listDiligenceEvidence(userId, symbol).catch(() => []),
  ]);
  return diligenceContext(sections, notes, research, synthesis, evidence);
}
