"use client";

import type { Run } from "@/lib/types";
import { timeAgo } from "./util";

const STAGES: { key: string; label: string }[] = [
  { key: "sweeping", label: "Scouts sweep the web" },
  { key: "probing", label: "Analyst commissions deep dives" },
  { key: "synthesizing", label: "Deep synthesis" },
  { key: "recording", label: "Board updated" },
];

export function RunBanner({ run, onRetry }: { run: Run; onRetry: () => void }) {
  if (run.status === "error") {
    return (
      <div className="rounded-xl border border-loss/30 bg-loss/8 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-loss">Research run failed</p>
          <p className="text-xs text-muted mt-0.5">{run.error}</p>
        </div>
        <button
          onClick={onRetry}
          className="shrink-0 rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium px-3 py-1.5 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  if (run.status !== "running") return null;

  const activeIdx = Math.max(
    0,
    STAGES.findIndex((s) => s.key === run.stage)
  );
  return (
    <div className="rounded-xl border border-accent/25 bg-accent/8 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent pulse-soft" />
        <p className="text-sm font-medium">Daily research in progress</p>
        <span className="text-[10px] text-muted ml-auto">started {timeAgo(run.startedAt)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        {STAGES.map((s, i) => (
          <span key={s.key} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted/50">→</span>}
            <span
              className={
                i < activeIdx
                  ? "text-gain"
                  : i === activeIdx
                    ? "text-accent pulse-soft"
                    : "text-muted/60"
              }
            >
              {i < activeIdx ? "✓ " : ""}
              {s.label}
            </span>
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted mt-1.5">{run.stageDetail}</p>
    </div>
  );
}
