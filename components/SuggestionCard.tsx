"use client";

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
  onAct: (id: string, action: "approve" | "dismiss") => void;
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
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onAct(signal.id, "approve")}
          disabled={busy}
          className="rounded-lg bg-gain/15 text-gain text-xs font-semibold px-3 py-1.5 hover:bg-gain/25 disabled:opacity-50 transition-colors"
        >
          {replacesName ? t("signals.approveSwap") : t("signals.approve")}
        </button>
        <button
          onClick={() => onAct(signal.id, "dismiss")}
          disabled={busy}
          className="rounded-lg bg-ink/6 text-muted text-xs font-medium px-3 py-1.5 hover:bg-ink/10 hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {t("signals.ignore")}
        </button>
      </div>
    </div>
  );
}
