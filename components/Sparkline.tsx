/**
 * Neutral trend line for a quantitative signal's reading history. Deliberately
 * NOT polarity-colored: direction on a diligence metric isn't inherently good
 * or bad (falling inventory days ≠ falling revenue), so the level badge
 * carries the verdict and this only shows the shape.
 */
export function ReadingSparkline({
  values,
  width = 88,
  height = 24,
  className = "text-[#8e8e93]",
}: {
  /** Chronological (oldest → newest). Needs ≥2 points to render. */
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [
    pad + (i * (width - 2 * pad)) / (values.length - 1),
    height - pad - ((v - min) / span) * (height - 2 * pad),
  ]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r="2" fill="currentColor" />
    </svg>
  );
}

/** Chronological numeric values from a freshest-first reading history. */
export function sparkValues(history: { value: number | null }[]): number[] {
  return history
    .map((h) => h.value)
    .filter((v): v is number => v != null)
    .reverse();
}

export function Sparkline({
  data,
  positive,
  width = 96,
  height = 34,
}: {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const color = positive ? "var(--green)" : "var(--red)";
  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}
