"use client";

import { useState } from "react";
import { domainOf } from "@/lib/citations";
import type { Citation, SignalWithReadings } from "@/lib/types";
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

/** Clickable source chip showing the domain (e.g. "fastretailing.com"). */
function SourceChip({ citation }: { citation: Citation }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noreferrer"
      title={citation.title}
      onClick={(e) => e.stopPropagation()}
      className="rounded-full border border-hairline bg-white/4 hover:bg-white/10 hover:border-white/25 px-2 py-0.5 text-[10px] text-[#c7c7cc] transition-colors max-w-[160px] truncate"
    >
      {domainOf(citation)}
    </a>
  );
}

/** Full source list with titles and which research sweep surfaced each one. */
function SourceList({ citations }: { citations: Citation[] }) {
  return (
    <ul className="space-y-1.5">
      {citations.map((c, i) => (
        <li key={i} className="text-[11px] leading-snug">
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className="text-accent/90 hover:underline"
          >
            {c.title.length > 70 ? c.title.slice(0, 70) + "…" : c.title}
          </a>
          <span className="text-muted"> — {domainOf(c)}</span>
          {c.foundBy && c.foundBy.length > 0 && (
            <span className="block text-[10px] text-muted/70">
              via {c.foundBy.join(" · ")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SignalCard({
  signal,
  onRetire,
}: {
  signal: SignalWithReadings;
  onRetire: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const r = signal.latest;
  const level = r ? LEVEL_STYLE[r.level] : null;
  const delta = r ? DELTA_ARROW[r.delta] : null;

  return (
    <div
      className={`rounded-xl bg-card border border-hairline transition-colors ${
        open ? "border-white/20" : "hover:border-white/15"
      }`}
    >
      <button onClick={() => setOpen(!open)} className="w-full text-left px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">{signal.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
              {signal.type === "quantitative" ? "# quantitative" : "◆ qualitative"}
            </div>
          </div>
          {level && delta && (
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${level.cls}`}
            >
              {level.label} <span className={delta.cls}>{delta.ch}</span>
            </span>
          )}
        </div>

        {r ? (
          <>
            {r.value != null && (
              <div className="mt-2 text-lg font-semibold tabular-nums">
                {r.value.toLocaleString()}{" "}
                <span className="text-xs text-muted font-normal">{r.valueUnit ?? signal.scale}</span>
              </div>
            )}
            <p className="mt-1.5 text-xs text-[#c7c7cc] leading-relaxed line-clamp-2">{r.rationale}</p>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-muted">
              <ConfidenceDots value={r.confidence} />
              <span>{timeAgo(r.date)}</span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted italic">Awaiting first research run.</p>
        )}
      </button>

      {/* Evidence map: the exact sources behind the latest reading. */}
      {r && r.citations.length > 0 && !open && (
        <div className="px-4 pb-3 -mt-0.5 flex flex-wrap items-center gap-1.5">
          {r.citations.slice(0, 3).map((c, i) => (
            <SourceChip key={i} citation={c} />
          ))}
          {r.citations.length > 3 && (
            <button
              onClick={() => setOpen(true)}
              className="text-[10px] text-muted hover:text-[#c7c7cc] transition-colors"
            >
              +{r.citations.length - 3} more
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="border-t border-hairline px-4 py-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Why we track this</p>
            <p className="text-xs text-[#c7c7cc]">{signal.thesis}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Measurement plan</p>
            <p className="text-xs text-[#c7c7cc]">{signal.measurementPlan}</p>
            {signal.scale && <p className="text-[11px] text-muted mt-1">Scale: {signal.scale}</p>}
          </div>
          {r && r.citations.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5">
                Sources behind the latest reading
              </p>
              <SourceList citations={r.citations} />
            </div>
          )}
          {signal.history.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5">History</p>
              <ul className="space-y-2">
                {signal.history.map((h) => (
                  <li key={h.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted tabular-nums">{h.date.slice(0, 10)}</span>
                      <span className={`rounded px-1.5 py-px text-[10px] font-medium ${LEVEL_STYLE[h.level].cls}`}>
                        {LEVEL_STYLE[h.level].label}
                      </span>
                      {h.value != null && (
                        <span className="tabular-nums">
                          {h.value.toLocaleString()} {h.valueUnit ?? ""}
                        </span>
                      )}
                    </div>
                    <p className="text-[#a8a8ad] mt-0.5 leading-relaxed">{h.rationale}</p>
                    {h.citations.length > 0 && (
                      <p className="mt-0.5 space-x-2">
                        {h.citations.map((c, i) => (
                          <a
                            key={i}
                            href={c.url}
                            target="_blank"
                            rel="noreferrer"
                            title={c.foundBy?.length ? `via ${c.foundBy.join(" · ")}` : c.title}
                            className="text-accent/90 hover:underline text-[11px]"
                          >
                            {domainOf(c)}
                          </a>
                        ))}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={() => onRetire(signal.id)}
            className="text-[11px] text-muted hover:text-loss transition-colors"
          >
            Retire this signal
          </button>
        </div>
      )}
    </div>
  );
}
