"use client";

import { CheckIcon } from "@/components/icons";
import { useT } from "@/components/PrefsProvider";
import type { TKey } from "@/lib/i18n/dictionaries";
import type { Run } from "@/lib/types";
import { localizeError, timeAgo } from "./util";

const STAGES: { key: string; labelKey: TKey }[] = [
  { key: "questions", labelKey: "desk.stageQuestions" },
  { key: "sweeping", labelKey: "desk.stageSweeping" },
  { key: "probing", labelKey: "desk.stageProbing" },
  { key: "synthesizing", labelKey: "desk.stageSynthesizing" },
  { key: "recording", labelKey: "desk.stageRecording" },
];

export function RunBanner({ run, onRetry }: { run: Run; onRetry: () => void }) {
  const { t } = useT();
  if (run.status === "error") {
    return (
      <div className="rounded-xl border border-loss/30 bg-loss/8 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-loss">{t("desk.runFailed")}</p>
          <p className="text-xs text-muted mt-0.5">{localizeError(run.error, t)}</p>
        </div>
        <button
          onClick={onRetry}
          className="shrink-0 rounded-lg bg-ink/8 hover:bg-ink/12 text-xs font-medium px-3 py-1.5 transition-colors"
        >
          {t("common.retry")}
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
        <p className="text-sm font-medium">{t("desk.runInProgress")}</p>
        <span className="text-[0.625rem] text-muted ml-auto">
          {t("desk.startedAgo", { when: timeAgo(run.startedAt, t) })}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[0.6875rem]">
        {STAGES.map((s, i) => (
          <span key={s.key} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted/50">→</span>}
            <span
              className={`inline-flex items-center gap-1 ${
                i < activeIdx
                  ? "text-gain"
                  : i === activeIdx
                    ? "text-accent pulse-soft"
                    : "text-muted/60"
              }`}
            >
              {i < activeIdx && <CheckIcon className="h-2.5 w-2.5" />}
              {t(s.labelKey)}
            </span>
          </span>
        ))}
      </div>
      {/* stageDetail is produced server-side in the user's language — render as-is. */}
      <p className="text-[0.6875rem] text-muted mt-1.5">{run.stageDetail}</p>
      {/* The question suggestor's framing — what this run exists to answer. */}
      {(run.questions ?? []).length > 0 && (
        <div className="mt-2 rounded-lg border border-hairline bg-ink/4 px-3 py-2">
          <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted">
            {t("desk.runQuestionsTitle")}
          </p>
          <ol className="mt-1 space-y-0.5 text-[0.6875rem] text-emph list-decimal list-inside">
            {(run.questions ?? []).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
