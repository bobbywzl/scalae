"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "./PrefsProvider";
import { daysAgoISO } from "./util";
import type { PnlPoint } from "@/lib/types";

/**
 * Portfolio P&L over time. Single series (no legend — the title names it),
 * polarity-colored by the final P&L sign (gain/loss status tokens, redundantly
 * encoded by the signed label and position vs the zero baseline). Crosshair +
 * tooltip on hover; range filter chips above; recessive grid; 2px line.
 */

const RANGES = [
  { key: "1M", days: 31 },
  { key: "3M", days: 93 },
  { key: "6M", days: 186 },
  { key: "1Y", days: 366 },
  { key: "ALL", days: Infinity },
] as const;

export function fmtUsd(v: number, opts: { sign?: boolean } = {}): string {
  const sign = v < 0 ? "−" : opts.sign ? "+" : "";
  const a = Math.abs(v);
  const num =
    a >= 1e9
      ? `${(a / 1e9).toFixed(2)}B`
      : a >= 1e6
        ? `${(a / 1e6).toFixed(2)}M`
        : a >= 10_000
          ? `${(a / 1e3).toFixed(1)}k`
          : a.toLocaleString(undefined, { maximumFractionDigits: a < 100 ? 2 : 0 });
  return `${sign}$${num}`;
}

function niceTicks(min: number, max: number, n = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const fmtDay = (iso: string, locale: string, withYear = false) => {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(locale, {
    month: "short",
    day: withYear ? undefined : "numeric",
    year: withYear ? "2-digit" : undefined,
    timeZone: "UTC",
  });
};

export function PnlChart({ series }: { series: PnlPoint[] }) {
  const { t, locale } = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("ALL");
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(280, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    if (!Number.isFinite(days)) return series;
    const cutoff = daysAgoISO(days);
    const sliced = series.filter((p) => p.date >= cutoff);
    return sliced.length >= 2 ? sliced : series;
  }, [series, range]);

  const H = 240;
  const PAD = { l: 54, r: 12, t: 12, b: 26 };
  const plotW = width - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const geom = useMemo(() => {
    if (data.length < 2) return null;
    const ys = data.map((p) => p.pnl);
    let yMin = Math.min(...ys, 0);
    let yMax = Math.max(...ys, 0);
    const padY = (yMax - yMin || 1) * 0.08;
    yMin -= padY;
    yMax += padY;
    const x = (i: number) => PAD.l + (i / (data.length - 1)) * plotW;
    const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * plotH;
    const line = data.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.pnl).toFixed(1)}`).join("");
    const y0 = y(Math.max(yMin, Math.min(yMax, 0)));
    const area = `${line}L${x(data.length - 1).toFixed(1)},${y0.toFixed(1)}L${x(0).toFixed(1)},${y0.toFixed(1)}Z`;
    return { x, y, line, area, y0, yMin, yMax, ticks: niceTicks(yMin, yMax) };
  }, [data, plotW, plotH, PAD.l, PAD.t]);

  if (series.length < 2) {
    return (
      <div className="h-[160px] flex items-center justify-center text-muted text-xs">
        {t("portfolio.chartEmpty")}
      </div>
    );
  }
  if (!geom) return null;

  const positive = data[data.length - 1].pnl >= 0;
  const color = positive ? "var(--green)" : "var(--red)";
  const hoverPt = hover != null ? data[hover] : null;
  const withYear = data.length > 0 && data[data.length - 1].date.slice(0, 4) !== data[0].date.slice(0, 4);
  const xLabelIdx = [0, 0.33, 0.66, 1].map((f) => Math.round(f * (data.length - 1)));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const f = (px - PAD.l) / plotW;
    const i = Math.round(f * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-1.5 mb-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              range === r.key
                ? "bg-ink/12 text-foreground"
                : "text-muted hover:bg-ink/6 hover:text-emph"
            }`}
          >
            {t(`portfolio.range${r.key}`)}
          </button>
        ))}
        {hoverPt && (
          <span className="ml-auto text-[11px] tabular-nums text-muted">
            {fmtDay(hoverPt.date, locale, true)} ·{" "}
            <span className="text-foreground font-semibold">{fmtUsd(hoverPt.pnl, { sign: true })}</span>
            <span className="hidden sm:inline">
              {" "}
              · {t("portfolio.chartValue", { amt: fmtUsd(hoverPt.value) })}
            </span>
          </span>
        )}
      </div>

      <svg
        width={width}
        height={H}
        role="img"
        aria-label={t("portfolio.chartAria", { pnl: fmtUsd(data[data.length - 1].pnl, { sign: true }) })}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="touch-none select-none"
      >
        {/* recessive grid + y labels */}
        {geom.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.l}
              x2={width - PAD.r}
              y1={geom.y(tick)}
              y2={geom.y(tick)}
              stroke="var(--border)"
              strokeOpacity="0.7"
            />
            <text x={PAD.l - 8} y={geom.y(tick) + 3} textAnchor="end" fontSize="10" fill="var(--muted)" className="tabular-nums">
              {fmtUsd(tick)}
            </text>
          </g>
        ))}
        {/* zero baseline (emphasized when in-domain and not already a tick) */}
        {geom.yMin < 0 && geom.yMax > 0 && (
          <line
            x1={PAD.l}
            x2={width - PAD.r}
            y1={geom.y0}
            y2={geom.y0}
            stroke="var(--muted)"
            strokeOpacity="0.45"
            strokeDasharray="3 3"
          />
        )}
        {/* x labels */}
        {xLabelIdx.map((i, k) => (
          <text
            key={k}
            x={geom.x(i)}
            y={H - 8}
            textAnchor={k === 0 ? "start" : k === xLabelIdx.length - 1 ? "end" : "middle"}
            fontSize="10"
            fill="var(--muted)"
          >
            {fmtDay(data[i].date, locale, withYear)}
          </text>
        ))}
        {/* area + line */}
        <path d={geom.area} fill={color} opacity="0.10" />
        <path d={geom.line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* crosshair */}
        {hoverPt && hover != null && (
          <g>
            <line
              x1={geom.x(hover)}
              x2={geom.x(hover)}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="var(--muted)"
              strokeOpacity="0.55"
            />
            <circle cx={geom.x(hover)} cy={geom.y(hoverPt.pnl)} r="4.5" fill={color} stroke="var(--card)" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
}
