"use client";

import { useState } from "react";
import type { SignalWithReadings } from "@/lib/types";
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
              {r.citations.length > 0 && <span>{r.citations.length} sources</span>}
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted italic">Awaiting first research run.</p>
        )}
      </button>

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
                            className="text-accent/90 hover:underline text-[11px]"
                          >
                            {c.title.length > 40 ? c.title.slice(0, 40) + "…" : c.title}
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
