"use client";

import { useState } from "react";
import { useT } from "@/components/PrefsProvider";
import type { TKey } from "@/lib/i18n/dictionaries";
import type { Signal } from "@/lib/types";

const ORIGIN_KEY: Record<Signal["origin"], TKey> = {
  onboarding: "signals.originOnboarding",
  chat: "signals.originChat",
  research: "signals.originResearch",
};

const fmtDay = (iso: string, locale: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString(locale, { month: "short", day: "numeric" });
};

export function SuggestionCard({
  signal,
  busy,
  onAct,
  compact = false,
  replacesName,
  selected,
  onToggleSelect,
  previouslyDismissedAt = null,
}: {
  signal: Signal;
  busy: boolean;
  /** Dismissals may carry the investor's reason (teach-the-desk). */
  onAct: (id: string, action: "approve" | "dismiss", reason?: string) => void;
  compact?: boolean;
  /** Name of the active signal this proposal replaces on approval (if any). */
  replacesName?: string | null;
  /** Bulk-selection state; when provided a checkbox renders. */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** Gate memory: when you dismissed this (or a same-named) proposal before. */
  previouslyDismissedAt?: string | null;
}) {
  const { t, locale } = useT();
  // Ignoring opens a one-line "why?" — optional, but a stated reason becomes
  // gate memory and may be distilled into a standing order (teach-the-desk).
  const [ignoring, setIgnoring] = useState(false);
  const [reason, setReason] = useState("");
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
            {signal.type === "quantitative" ? t("signals.typeQuantitative") : t("signals.typeQualitative")} ·{" "}
            {signal.focusArea} · <span className="text-warn/90">{t(ORIGIN_KEY[signal.origin])}</span>
          </div>
        </div>
        {onToggleSelect && (
          <button
            onClick={() => onToggleSelect(signal.id)}
            aria-label={selected ? t("signals.deselectProposal") : t("signals.selectProposal")}
            className={`shrink-0 h-5 w-5 rounded-md border flex items-center justify-center text-[11px] font-bold transition-colors ${
              selected
                ? "bg-accent border-accent text-white"
                : "border-ink/25 text-transparent hover:border-ink/50"
            }`}
          >
            ✓
          </button>
        )}
      </div>
      {replacesName && (
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-warn/12 border border-warn/25 px-2 py-1 text-[11px] text-warn">
          {t("signals.replacesBanner", { name: replacesName })}
        </p>
      )}
      {previouslyDismissedAt && (
        <p
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-ink/6 border border-hairline px-2 py-1 text-[11px] text-muted"
          title={t("signals.dismissedMemoryTitle")}
        >
          {t("signals.dismissedBack", { date: fmtDay(previouslyDismissedAt, locale) })}
        </p>
      )}
      <p className="mt-2 text-xs text-emph leading-relaxed">{signal.thesis}</p>
      {!compact && (
        <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
          <span className="uppercase tracking-wider text-[10px]">{t("signals.planLabel")}</span>{" "}
          {signal.measurementPlan}
          {signal.scale ? ` (${signal.scale})` : ""}
        </p>
      )}
      {ignoring ? (
        <div className="mt-3 flex items-center gap-2 flex-wrap" title={t("memory.whyHint")}>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAct(signal.id, "dismiss", reason)}
            placeholder={t("memory.whyPlaceholder")}
            autoFocus
            className="flex-1 min-w-40 rounded-lg border border-hairline bg-ink/4 px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
          />
          <button
            onClick={() => onAct(signal.id, "dismiss", reason)}
            disabled={busy}
            className="rounded-lg bg-ink/6 text-muted text-xs font-medium px-3 py-1.5 hover:bg-ink/10 hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {t("signals.ignore")}
          </button>
          <button
            onClick={() => {
              setIgnoring(false);
              setReason("");
            }}
            className="text-muted hover:text-emph text-xs transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onAct(signal.id, "approve")}
            disabled={busy}
            className="rounded-lg bg-gain/15 text-gain text-xs font-semibold px-3 py-1.5 hover:bg-gain/25 disabled:opacity-50 transition-colors"
          >
            {replacesName ? t("signals.approveSwap") : t("signals.approve")}
          </button>
          <button
            onClick={() => setIgnoring(true)}
            disabled={busy}
            className="rounded-lg bg-ink/6 text-muted text-xs font-medium px-3 py-1.5 hover:bg-ink/10 hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {t("signals.ignore")}
          </button>
        </div>
      )}
    </div>
  );
}
