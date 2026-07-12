import type { SignalWithReadings } from "./types";

/**
 * Cross-ticker signal pairing for the compare view: match signals that read
 * the same aspect of a business ("similar taste" — take rate vs take rate,
 * culture vs culture) by token overlap on name + thesis + focus area. Pure
 * and deliberately conservative: a weak match is worse than no match, so
 * pairs below the threshold stay unmatched.
 */

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "at", "by", "from",
  "with", "into", "over", "vs", "is", "are", "as", "its", "their", "this", "that",
  "than", "will", "would", "per", "not", "our", "his", "her",
]);

/** Crude English stem so "margins/margin", "pricing/price" overlap. */
const stem = (w: string) => w.replace(/(ings?|ers?|ions?|s)$/i, "");

export function signalTokens(s: {
  name: string;
  thesis: string;
  focusArea: string;
  type: string;
}): Set<string> {
  const text = `${s.name} ${s.thesis} ${s.focusArea}`.toLowerCase();
  const words = text.match(/[a-z][a-z-]{2,}/g) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    if (STOP.has(w)) continue;
    const t = stem(w);
    if (t.length >= 3) out.add(t);
  }
  out.add(`type:${s.type}`);
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface SignalPair {
  a: SignalWithReadings;
  b: SignalWithReadings;
  score: number;
}

export const PAIR_THRESHOLD = 0.12;

/**
 * Greedy best-first matching: highest-scoring cross pairs first, each signal
 * used once, nothing below the threshold. Unpaired signals are returned per
 * side so the view can show what one desk watches that the other doesn't —
 * itself a diligence insight.
 */
export function pairSignals(
  aList: SignalWithReadings[],
  bList: SignalWithReadings[]
): { pairs: SignalPair[]; onlyA: SignalWithReadings[]; onlyB: SignalWithReadings[] } {
  const aTok = aList.map(signalTokens);
  const bTok = bList.map(signalTokens);
  const candidates: { i: number; j: number; score: number }[] = [];
  for (let i = 0; i < aList.length; i++) {
    for (let j = 0; j < bList.length; j++) {
      const score = jaccard(aTok[i], bTok[j]);
      if (score >= PAIR_THRESHOLD) candidates.push({ i, j, score });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const pairs: SignalPair[] = [];
  for (const c of candidates) {
    if (usedA.has(c.i) || usedB.has(c.j)) continue;
    usedA.add(c.i);
    usedB.add(c.j);
    pairs.push({ a: aList[c.i], b: bList[c.j], score: Math.round(c.score * 100) / 100 });
  }
  return {
    pairs,
    onlyA: aList.filter((_, i) => !usedA.has(i)),
    onlyB: bList.filter((_, j) => !usedB.has(j)),
  };
}

/**
 * Citation-overlap between two signals' recent readings (Jaccard on distinct
 * source URLs). Drives the keep-both re-merge escalation: when two signals
 * keep citing the same evidence, they are one signal wearing two names.
 */
export function citationOverlap(
  a: { citations: { url: string }[] }[],
  b: { citations: { url: string }[] }[]
): number {
  const urlsOf = (rs: { citations: { url: string }[] }[]) =>
    new Set(rs.flatMap((r) => r.citations.map((c) => c.url)));
  const ua = urlsOf(a);
  const ub = urlsOf(b);
  if (ua.size === 0 || ub.size === 0) return 0;
  let inter = 0;
  for (const u of ua) if (ub.has(u)) inter++;
  return inter / Math.min(ua.size, ub.size);
}
