import type {
  VisualEdge,
  VisualEvent,
  VisualKind,
  VisualNode,
  VisualPoint,
  VisualSeries,
  VisualSpec,
} from "./types";

/**
 * Validation/normalization for note-visual specs. Every spec that reaches the
 * renderer passes through here exactly once server-side — whether it came from
 * the generator (model output) or back from the browser (the keep request) —
 * so the renderer can trust shapes and bounds unconditionally. Returns null
 * when nothing renderable survives; the caller turns that into an honest
 * "insufficient" instead of a broken card.
 */

const KINDS = new Set<VisualKind>(["line", "bar", "timeline", "flow"]);

/** Renderer bounds — mirrored in NOTE_VISUAL_SCHEMA's descriptions. */
export const VISUAL_LIMITS = {
  series: 4,
  pointsPerSeries: 24,
  barCategories: 12,
  events: 12,
  nodes: 10,
  edges: 14,
} as const;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function normPoints(raw: unknown, maxPoints: number): VisualPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: VisualPoint[] = [];
  for (const p of raw) {
    const x = str((p as VisualPoint)?.x, 40);
    const y = finite((p as VisualPoint)?.y);
    if (!x || y === null) continue;
    out.push({ x, y });
    if (out.length >= maxPoints) break;
  }
  return out;
}

function normSeries(raw: unknown, maxSeries: number, maxPoints: number): VisualSeries[] {
  if (!Array.isArray(raw)) return [];
  const out: VisualSeries[] = [];
  for (const s of raw) {
    const name = str((s as VisualSeries)?.name, 60);
    const points = normPoints((s as VisualSeries)?.points, maxPoints);
    if (points.length === 0) continue;
    out.push({ name: name || `Series ${out.length + 1}`, points });
    if (out.length >= maxSeries) break;
  }
  return out;
}

function normEvents(raw: unknown): VisualEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: VisualEvent[] = [];
  for (const e of raw) {
    const date = str((e as VisualEvent)?.date, 40);
    const label = str((e as VisualEvent)?.label, 120);
    if (!date || !label) continue;
    out.push({ date, label, detail: str((e as VisualEvent)?.detail, 220) });
    if (out.length >= VISUAL_LIMITS.events) break;
  }
  return out;
}

function normFlow(rawNodes: unknown, rawEdges: unknown): { nodes: VisualNode[]; edges: VisualEdge[] } {
  const nodes: VisualNode[] = [];
  const seen = new Set<string>();
  if (Array.isArray(rawNodes)) {
    for (const n of rawNodes) {
      const id = str((n as VisualNode)?.id, 40);
      const label = str((n as VisualNode)?.label, 80);
      if (!id || !label || seen.has(id)) continue;
      seen.add(id);
      nodes.push({ id, label });
      if (nodes.length >= VISUAL_LIMITS.nodes) break;
    }
  }
  const edges: VisualEdge[] = [];
  if (Array.isArray(rawEdges)) {
    for (const e of rawEdges) {
      const from = str((e as VisualEdge)?.from, 40);
      const to = str((e as VisualEdge)?.to, 40);
      // Edges must connect two DISTINCT known nodes — dangling arrows drop.
      if (!seen.has(from) || !seen.has(to) || from === to) continue;
      edges.push({ from, to, label: str((e as VisualEdge)?.label, 60) });
      if (edges.length >= VISUAL_LIMITS.edges) break;
    }
  }
  return { nodes, edges };
}

/**
 * Normalize an untrusted spec-shaped value into a renderable VisualSpec, or
 * null when its kind's required data doesn't survive the bounds.
 */
export function normalizeVisualSpec(input: unknown): VisualSpec | null {
  const raw = (input ?? {}) as Partial<VisualSpec>;
  const kind = raw.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as VisualKind)) return null;
  const title = str(raw.title, 140);
  const sourceNote = str(raw.sourceNote, 280);
  if (!title || !sourceNote) return null; // provenance is not optional

  const spec: VisualSpec = {
    kind: kind as VisualKind,
    title,
    subtitle: str(raw.subtitle, 160),
    unit: str(raw.unit, 24),
    series: [],
    events: [],
    nodes: [],
    edges: [],
    sourceNote,
    caveat: str(raw.caveat, 280),
  };

  if (spec.kind === "line") {
    spec.series = normSeries(raw.series, VISUAL_LIMITS.series, VISUAL_LIMITS.pointsPerSeries);
    // A one-point line is not a trend — it renders as a misleading dot.
    spec.series = spec.series.filter((s) => s.points.length >= 2);
    if (spec.series.length === 0) return null;
  } else if (spec.kind === "bar") {
    spec.series = normSeries(raw.series, 1, VISUAL_LIMITS.barCategories);
    if ((spec.series[0]?.points.length ?? 0) < 2) return null;
  } else if (spec.kind === "timeline") {
    spec.events = normEvents(raw.events);
    if (spec.events.length < 2) return null;
  } else {
    const { nodes, edges } = normFlow(raw.nodes, raw.edges);
    if (nodes.length < 2 || edges.length === 0) return null;
    spec.nodes = nodes;
    spec.edges = edges;
  }
  return spec;
}
