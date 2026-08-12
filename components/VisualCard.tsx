"use client";

import { useId } from "react";
import { useT } from "./PrefsProvider";
import type { VisualSeries, VisualSpec } from "@/lib/types";

/**
 * Renders a note-visual spec as theme-aware inline SVG/HTML. Specs are
 * server-normalized (lib/visual-spec.ts) so shapes and bounds are trusted
 * here. Design rules (the desk's data-viz doctrine): thin marks, one hue for
 * magnitude and fixed-order categorical hues for identity (--viz-1..4 in
 * globals.css, stepped per theme), recessive hairline grid, text always in
 * text tokens (never series colors), a legend whenever two or more series
 * share a plot, native <title> tooltips on every mark, and the provenance
 * footer (sourceNote / caveat) rendered unconditionally — the honesty layer
 * travels with the picture.
 */

const SERIES_VARS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)"];

/** Compact value label: 1.2B / 340M / 12.5 / 0.04 — unit appended outside. */
function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `${trim(v / 1e12)}T`;
  if (a >= 1e9) return `${trim(v / 1e9)}B`;
  if (a >= 1e6) return `${trim(v / 1e6)}M`;
  if (a >= 1e4) return `${trim(v / 1e3)}K`;
  return trim(v);
}
function trim(v: number): string {
  const r = Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  return r.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** 3-5 "nice" ticks spanning [min, max] (always includes the ends). */
function niceTicks(min: number, max: number): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / 3)));
  const err = span / 3 / step;
  const s = step * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const out: number[] = [];
  for (let t = Math.ceil(min / s) * s; t <= max + 1e-9; t += s) out.push(Math.round(t * 1e6) / 1e6);
  if (out[0] !== min) out.unshift(min);
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

function domain(series: VisualSeries[]): { lo: number; hi: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series)
    for (const p of s.points) {
      if (p.y < lo) lo = p.y;
      if (p.y > hi) hi = p.y;
    }
  // Anchor magnitude at zero unless the data lives far from it (indexes, ratios).
  if (lo > 0 && lo < hi * 0.55) lo = 0;
  if (hi < 0) hi = 0;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  return { lo, hi };
}

// ---------------------------------------------------------------------------
// Line — trend over time. 2px strokes, 8px markers, recessive grid, legend
// for ≥2 series (one series: the title names it).
// ---------------------------------------------------------------------------

function LineChart({ spec }: { spec: VisualSpec }) {
  const W = 560;
  const H = 236;
  const PAD = { l: 46, r: 18, t: 12, b: 26 };
  const series = spec.series;
  const { lo, hi } = domain(series);
  const ticks = niceTicks(lo, hi);
  const maxN = Math.max(...series.map((s) => s.points.length));
  const x = (i: number, n: number) =>
    PAD.l + ((W - PAD.l - PAD.r) * (n <= 1 ? 0.5 : i / (n - 1)));
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - lo) / (hi - lo));

  // X labels from the longest series: first, last, and up to 3 between.
  const labelIdx = new Set<number>([0, maxN - 1]);
  for (let k = 1; k <= 3; k++) labelIdx.add(Math.round((maxN - 1) * (k / 4)));
  const xLabels = series.find((s) => s.points.length === maxN)?.points ?? [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--border)"
            strokeWidth={t === 0 && lo < 0 ? 1.4 : 1}
          />
          <text
            x={PAD.l - 7}
            y={y(t) + 3}
            textAnchor="end"
            fontSize={9.5}
            fill="var(--muted)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmt(t)}
          </text>
        </g>
      ))}
      {spec.unit && (
        <text x={PAD.l - 40} y={PAD.t - 2} fontSize={9.5} fill="var(--muted)">
          {spec.unit}
        </text>
      )}
      {xLabels.map((p, i) =>
        labelIdx.has(i) ? (
          <text
            key={i}
            x={x(i, maxN)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === maxN - 1 ? "end" : "middle"}
            fontSize={9.5}
            fill="var(--muted)"
          >
            {p.x}
          </text>
        ) : null
      )}
      {series.map((s, si) => {
        const n = s.points.length;
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i, n)},${y(p.y)}`).join("");
        return (
          <g key={si}>
            <path d={d} fill="none" stroke={SERIES_VARS[si]} strokeWidth={2} strokeLinejoin="round" />
            {s.points.map((p, i) => (
              <circle key={i} cx={x(i, n)} cy={y(p.y)} r={4} fill={SERIES_VARS[si]} stroke="var(--card)" strokeWidth={1.5}>
                <title>{`${s.name} · ${p.x}: ${fmt(p.y)}${spec.unit ? ` ${spec.unit}` : ""}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Bar — magnitude comparison. Horizontal (labels get room), ONE hue (identity
// lives in the labels), 3px rounded data-end anchored to the zero line, value
// direct-labeled at each bar's end.
// ---------------------------------------------------------------------------

function BarChart({ spec }: { spec: VisualSpec }) {
  const points = spec.series[0]?.points ?? [];
  const W = 560;
  const ROW = 30;
  const PAD = { l: 132, r: 62, t: 6, b: 6 };
  const H = PAD.t + PAD.b + ROW * points.length;
  const lo = Math.min(0, ...points.map((p) => p.y));
  const hi = Math.max(0, ...points.map((p) => p.y));
  const span = hi - lo || 1;
  const px = (v: number) => PAD.l + ((W - PAD.l - PAD.r) * (v - lo)) / span;
  const zero = px(0);

  // Rounded on the DATA end only, square at the zero baseline.
  const barPath = (v: number, yTop: number, h: number) => {
    const r = Math.min(3, Math.abs(px(v) - zero));
    if (v >= 0) {
      const w = px(v) - zero;
      return `M${zero},${yTop} h${Math.max(0, w - r)} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${Math.max(0, w - r)} z`;
    }
    const w = zero - px(v);
    return `M${zero},${yTop} h-${Math.max(0, w - r)} a${r},${r} 0 0 0 -${r},${r} v${h - 2 * r} a${r},${r} 0 0 0 ${r},${r} h${Math.max(0, w - r)} z`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      <line x1={zero} x2={zero} y1={PAD.t} y2={H - PAD.b} stroke="var(--border)" strokeWidth={1.2} />
      {points.map((p, i) => {
        const yTop = PAD.t + i * ROW + 5;
        const h = ROW - 10;
        const end = px(p.y);
        return (
          <g key={i}>
            <text
              x={PAD.l - 8}
              y={yTop + h / 2 + 3.5}
              textAnchor="end"
              fontSize={10.5}
              fill="var(--emph)"
            >
              {p.x.length > 20 ? `${p.x.slice(0, 19)}…` : p.x}
            </text>
            <path d={barPath(p.y, yTop, h)} fill="var(--viz-1)">
              <title>{`${p.x}: ${fmt(p.y)}${spec.unit ? ` ${spec.unit}` : ""}`}</title>
            </path>
            <text
              x={p.y >= 0 ? end + 5 : end - 5}
              y={yTop + h / 2 + 3.5}
              textAnchor={p.y >= 0 ? "start" : "end"}
              fontSize={10}
              fill="var(--foreground)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmt(p.y)}
              {spec.unit ? ` ${spec.unit}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Timeline — dated sequence. HTML (text wraps), spine + dots.
// ---------------------------------------------------------------------------

function Timeline({ spec }: { spec: VisualSpec }) {
  return (
    <ol className="relative ml-1.5 border-l border-hairline">
      {spec.events.map((e, i) => (
        <li key={i} className={`relative pl-4 ${i === spec.events.length - 1 ? "" : "pb-3"}`}>
          <span
            className="absolute -left-[4.5px] top-[5px] h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--viz-1)" }}
            aria-hidden
          />
          <p className="text-[0.625rem] text-muted tabular-nums leading-4">{e.date}</p>
          <p className="text-[0.8125rem] text-foreground font-medium leading-snug">{e.label}</p>
          {e.detail && <p className="text-xs text-muted leading-snug mt-0.5">{e.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Flow — mechanism map. Layered left→right by longest path from the roots;
// curved edges with arrowheads; labels wrap inside foreignObject nodes.
// ---------------------------------------------------------------------------

function FlowChart({ spec }: { spec: VisualSpec }) {
  const markerId = useId();
  const nodes = spec.nodes;
  const edges = spec.edges;

  // Longest-path layering with a visited cap so cycles can't spin forever.
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let moved = false;
    for (const e of edges) {
      const want = (depth.get(e.from) ?? 0) + 1;
      if (want > (depth.get(e.to) ?? 0) && want < nodes.length) {
        depth.set(e.to, want);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const layers = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(n.id);
  }
  const NW = 128;
  const NH = 44;
  const COL = 178;
  const ROW = 60;
  const maxRows = Math.max(...[...layers.values()].map((l) => l.length));
  const cols = Math.max(...layers.keys()) + 1;
  const W = Math.max(340, 16 + cols * COL - (COL - NW) + 16);
  const H = 16 + maxRows * ROW - (ROW - NH) + 16;

  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of layers) {
    // Center shorter columns vertically.
    const top = 16 + ((maxRows - ids.length) * ROW) / 2;
    ids.forEach((id, i) => pos.set(id, { x: 16 + d * COL, y: top + i * ROW }));
  }
  const labelOf = new Map(nodes.map((n) => [n.id, n.label]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={spec.title}>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0.5 L7.5,4 L0,7.5" fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeLinejoin="round" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = pos.get(e.from)!;
        const b = pos.get(e.to)!;
        const forward = b.x > a.x;
        const x1 = forward ? a.x + NW : a.x + (b.x < a.x ? 0 : NW / 2);
        const y1 = a.y + NH / 2;
        const x2 = forward ? b.x - 3 : b.x + (b.x < a.x ? NW + 3 : NW / 2);
        const y2 = b.y + NH / 2;
        const bend = forward ? (x2 - x1) / 2 : 44;
        const d = forward
          ? `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
          : `M${x1},${y1} C${x1 - bend},${y1} ${x2 + bend},${y2} ${x2},${y2}`;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 + (y1 === y2 ? -5 : 0);
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="var(--muted)" strokeWidth={1.4} markerEnd={`url(#${markerId})`}>
              <title>{`${labelOf.get(e.from)} → ${labelOf.get(e.to)}${e.label ? ` — ${e.label}` : ""}`}</title>
            </path>
            {e.label && (
              <text x={mx} y={my} textAnchor="middle" fontSize={8.5} fill="var(--muted)">
                {e.label.length > 24 ? `${e.label.slice(0, 23)}…` : e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((n) => {
        const p = pos.get(n.id)!;
        return (
          <g key={n.id}>
            <rect
              x={p.x}
              y={p.y}
              width={NW}
              height={NH}
              rx={9}
              fill="var(--card-2)"
              stroke="var(--border)"
            />
            <foreignObject x={p.x + 5} y={p.y + 3} width={NW - 10} height={NH - 6}>
              <div className="h-full flex items-center justify-center text-center text-[0.625rem] leading-[0.8rem] text-foreground [overflow-wrap:anywhere]">
                {n.label}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

export function VisualCard({
  spec,
  meta,
  onDelete,
}: {
  spec: VisualSpec;
  /** Kept-visual chrome: what was asked and when (shown muted under the visual). */
  meta?: { ask: string; createdAt: string };
  onDelete?: () => void;
}) {
  const { t } = useT();
  const legend = spec.kind === "line" && spec.series.length >= 2;
  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-semibold leading-snug">{spec.title}</p>
          {spec.subtitle && <p className="text-xs text-muted mt-0.5 leading-snug">{spec.subtitle}</p>}
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            title={t("notes.vizDelete")}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] text-muted/60 hover:text-loss transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {legend && (
        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
          {spec.series.map((s, i) => (
            <span key={i} className="flex items-center gap-1.5 text-[0.6875rem] text-emph">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: SERIES_VARS[i] }}
                aria-hidden
              />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2">
        {spec.kind === "line" ? (
          <LineChart spec={spec} />
        ) : spec.kind === "bar" ? (
          <BarChart spec={spec} />
        ) : spec.kind === "timeline" ? (
          <Timeline spec={spec} />
        ) : (
          <div className="overflow-x-auto">
            <FlowChart spec={spec} />
          </div>
        )}
      </div>

      {/* The honesty layer travels with the picture — never optional. */}
      <p className="mt-2 text-[0.6875rem] text-muted leading-snug">
        {t("notes.vizSourcePrefix")} {spec.sourceNote}
      </p>
      {spec.caveat && (
        <p className="mt-0.5 text-[0.6875rem] text-warn/90 leading-snug">
          {t("notes.vizCaveatPrefix")} {spec.caveat}
        </p>
      )}
      {meta && (
        <p className="mt-1 text-[0.625rem] text-muted/60">
          {meta.ask ? `“${meta.ask}” · ` : ""}
          {meta.createdAt.slice(0, 10)}
        </p>
      )}
    </div>
  );
}
