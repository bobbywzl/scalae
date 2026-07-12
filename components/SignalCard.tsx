"use client";

import { useState } from "react";
import { chipLabel } from "@/lib/citations";
import type { Citation, SignalSource, SignalWithReadings } from "@/lib/types";
import { ReadingSparkline, sparkValues } from "./Sparkline";
import { DELTA_ARROW, LEVEL_STYLE, timeAgo } from "./util";

function ConfidenceDots({ value }: { value: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * 5);
  return (
    <span className="inline-flex items-center gap-[3px]" title={`Confidence ${(value * 100).toFixed(0)}%`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`h-[5px] w-[5px] rounded-full ${i < filled ? "bg-[#c7c7cc]" : "bg-white/12"}`}
        />
      ))}
    </span>
  );
}

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** Clickable source chip — domain plus a title fragment when siblings share it. */
function SourceChip({ citation, siblings }: { citation: Citation; siblings: Citation[] }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noreferrer"
      title={citation.title}
      onClick={(e) => e.stopPropagation()}
      className="rounded-full border border-hairline bg-white/4 hover:bg-white/10 hover:border-white/25 px-2 py-0.5 text-[10px] text-[#c7c7cc] transition-colors max-w-[220px] truncate"
    >
      {chipLabel(citation, siblings)}
    </a>
  );
}

/**
 * The signal's full evidence catalog — every source it has accumulated across
 * daily runs, deduped and freshest-first. Opened from the "N sources" count.
 */
function SourcesModal({
  name,
  sources,
  onClose,
}: {
  name: string;
  sources: SignalSource[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-card border border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-hairline flex items-center gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
              Evidence catalog · {sources.length} {sources.length === 1 ? "source" : "sources"} · grows with each run
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto shrink-0 rounded-md border border-hairline bg-white/4 hover:bg-white/10 px-2 py-1 text-[11px] text-[#c7c7cc] transition-colors"
          >
            Close
          </button>
        </div>
        <ul className="overflow-y-auto px-4 py-3 space-y-3">
          {sources.map((s, i) => (
            <li key={i} className="text-xs">
              <div className="flex items-baseline gap-2">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-accent/90 hover:underline truncate">
                  {s.domain}
                </a>
                {s.count > 1 && (
                  <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-px text-[9px] text-muted" title={`Cited in ${s.count} readings`}>
                    ×{s.count}
                  </span>
                )}
              </div>
              <a href={s.url} target="_blank" rel="noreferrer" className="block text-[#c7c7cc] hover:text-white leading-snug mt-0.5">
                {s.title.length > 110 ? s.title.slice(0, 110) + "…" : s.title}
              </a>
              <p className="text-[10px] text-muted mt-0.5">
                added {fmtDay(s.firstSeen)}
                {s.lastSeen !== s.firstSeen && ` · last cited ${fmtDay(s.lastSeen)}`}
                {s.foundBy.length > 0 && ` · via ${s.foundBy.join(" · ")}`}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Board card for one signal. Clicking it opens the signal's dedicated
 * segmented view (reading, evidence, history + a signal-scoped analyst desk).
 */
export function SignalCard({
  signal,
  onOpen,
  overlapsWith = null,
}: {
  signal: SignalWithReadings;
  onOpen: (signal: SignalWithReadings) => void;
  /** Keep-both pair: the other active signal this one overlaps with. */
  overlapsWith?: { name: string; onOpen: () => void } | null;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const r = signal.latest;
  const level = r ? LEVEL_STYLE[r.level] : null;
  const delta = r ? DELTA_ARROW[r.delta] : null;
  const sources = signal.sources ?? [];
  const carriedForward = r?.newEvidence === false;
  const spark = signal.type === "quantitative" ? sparkValues(signal.history) : [];

  return (
    <div className="rounded-xl bg-card border border-hairline hover:border-white/20 transition-colors">
      <button onClick={() => onOpen(signal)} className="w-full text-left px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">{signal.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
              {signal.type === "quantitative" ? "# quantitative" : "◆ qualitative"}
            </div>
          </div>
          {level && delta && (
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${level.cls}`}>
              {level.label} <span className={delta.cls}>{delta.ch}</span>
            </span>
          )}
        </div>

        {r ? (
          <>
            {r.value != null && (
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-lg font-semibold tabular-nums">
                  {r.value.toLocaleString()}{" "}
                  <span className="text-xs text-muted font-normal">{r.valueUnit ?? signal.scale}</span>
                </div>
                {spark.length >= 2 && (
                  <span title={`${spark.length} readings · ${Math.min(...spark).toLocaleString()} → ${Math.max(...spark).toLocaleString()} range`}>
                    <ReadingSparkline values={spark} />
                  </span>
                )}
              </div>
            )}
            {carriedForward ? (
              <p className="mt-1.5 text-xs text-muted italic leading-relaxed">
                No change — no new information this run.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-[#c7c7cc] leading-relaxed line-clamp-2">{r.rationale}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-[10px] text-muted">
              <ConfidenceDots value={r.confidence} />
              <span>{timeAgo(r.date)}</span>
              {sources.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSourcesOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      setSourcesOpen(true);
                    }
                  }}
                  className="text-accent/90 hover:text-accent hover:underline transition-colors cursor-pointer"
                  title="View all sources this signal has accumulated"
                >
                  🔗 {sources.length} {sources.length === 1 ? "source" : "sources"}
                </span>
              )}
              <span className="ml-auto text-muted/60">open ⤢</span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted italic">Awaiting first research run.</p>
        )}
      </button>

      {/* Keep-both overlap: the pair stays visibly linked after the one-time choice. */}
      {overlapsWith && (
        <div className="px-4 pb-2 -mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              overlapsWith.onOpen();
            }}
            title="You chose to keep both — open the overlapping signal"
            className="rounded-md bg-warn/10 hover:bg-warn/18 border border-warn/25 px-2 py-0.5 text-[10px] text-warn transition-colors max-w-full truncate"
          >
            ⇄ overlaps: {overlapsWith.name}
          </button>
        </div>
      )}

      {/* Freshest sources at a glance; the count opens the whole catalog. */}
      {sources.length > 0 && (
        <div className="px-4 pb-3 -mt-0.5 flex flex-wrap items-center gap-1.5">
          {sources.slice(0, 3).map((s, i) => (
            <SourceChip key={i} citation={s} siblings={sources.slice(0, 3)} />
          ))}
          {sources.length > 3 && (
            <button
              onClick={() => setSourcesOpen(true)}
              className="text-[10px] text-muted hover:text-[#c7c7cc] transition-colors"
            >
              +{sources.length - 3} more
            </button>
          )}
        </div>
      )}

      {sourcesOpen && (
        <SourcesModal name={signal.name} sources={sources} onClose={() => setSourcesOpen(false)} />
      )}
    </div>
  );
}
