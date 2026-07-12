"use client";

import type { Signal } from "@/lib/types";

const ORIGIN_LABEL: Record<Signal["origin"], string> = {
  onboarding: "from onboarding",
  chat: "from your feedback",
  research: "discovered in today's research",
};

export function SuggestionCard({
  signal,
  busy,
  onAct,
  compact = false,
  replacesName,
  selected,
  onToggleSelect,
}: {
  signal: Signal;
  busy: boolean;
  onAct: (id: string, action: "approve" | "dismiss") => void;
  compact?: boolean;
  /** Name of the active signal this proposal replaces on approval (if any). */
  replacesName?: string | null;
  /** Bulk-selection state; when provided a checkbox renders. */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <div
      className={`rounded-xl bg-card border px-4 py-3 transition-colors ${
        selected ? "border-accent/60" : "border-warn/25"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">{signal.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
            {signal.type === "quantitative" ? "# quantitative" : "◆ qualitative"} · {signal.focusArea}{" "}
            · <span className="text-warn/90">{ORIGIN_LABEL[signal.origin]}</span>
          </div>
        </div>
        {onToggleSelect && (
          <button
            onClick={() => onToggleSelect(signal.id)}
            aria-label={selected ? "Deselect proposal" : "Select proposal"}
            className={`shrink-0 h-5 w-5 rounded-md border flex items-center justify-center text-[11px] font-bold transition-colors ${
              selected
                ? "bg-accent border-accent text-white"
                : "border-white/25 text-transparent hover:border-white/50"
            }`}
          >
            ✓
          </button>
        )}
      </div>
      {replacesName && (
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-warn/12 border border-warn/25 px-2 py-1 text-[11px] text-warn">
          ⇄ Replaces “{replacesName}” — approving swaps it in and retires the old signal
        </p>
      )}
      <p className="mt-2 text-xs text-[#c7c7cc] leading-relaxed">{signal.thesis}</p>
      {!compact && (
        <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
          <span className="uppercase tracking-wider text-[10px]">Plan:</span> {signal.measurementPlan}
          {signal.scale ? ` (${signal.scale})` : ""}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onAct(signal.id, "approve")}
          disabled={busy}
          className="rounded-lg bg-gain/15 text-gain text-xs font-semibold px-3 py-1.5 hover:bg-gain/25 disabled:opacity-50 transition-colors"
        >
          {replacesName ? "Approve & swap" : "Approve"}
        </button>
        <button
          onClick={() => onAct(signal.id, "dismiss")}
          disabled={busy}
          className="rounded-lg bg-white/6 text-muted text-xs font-medium px-3 py-1.5 hover:bg-white/10 hover:text-foreground disabled:opacity-50 transition-colors"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}
