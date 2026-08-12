"use client";

import { useState } from "react";
import { useT } from "./PrefsProvider";
import { VisualCard } from "./VisualCard";
import { api, localizeError } from "./util";
import type { VisualKind, VisualSpec } from "@/lib/types";
import type { TKey } from "@/lib/i18n/dictionaries";

/**
 * The visualizer's dialog — the highlight toolkit's chart tool. The flow is
 * deliberately two-step: the desk ALWAYS asks what to see first (a general
 * lens, a specific ask, or both) before spending the generation call; the
 * result then parks in the dialog for an explicit keep/discard — the same
 * review gate every desk contribution to the record passes through.
 */

const FORMS: { kind: VisualKind; label: TKey }[] = [
  { kind: "line", label: "notes.vizFormTrend" },
  { kind: "bar", label: "notes.vizFormCompare" },
  { kind: "timeline", label: "notes.vizFormSequence" },
  { kind: "flow", label: "notes.vizFormMechanism" },
];

type Stage = "ask" | "busy" | "view" | "insufficient" | "error" | "keeping" | "kept";

export function VisualizeDialog({
  note,
  selectedText,
  onClose,
  onKept,
}: {
  note: { id: string; title: string };
  selectedText: string;
  onClose: () => void;
  /** Fires after a successful keep so the page reloads the record. */
  onKept: () => void;
}) {
  const { t } = useT();
  const [stage, setStage] = useState<Stage>("ask");
  const [form, setForm] = useState<VisualKind | null>(null);
  const [ask, setAsk] = useState("");
  const [spec, setSpec] = useState<VisualSpec | null>(null);
  const [notice, setNotice] = useState("");

  const canGenerate = form !== null || ask.trim() !== "";

  async function generate() {
    if (!canGenerate || stage === "busy") return;
    setStage("busy");
    try {
      const result = await api<{ spec?: VisualSpec; insufficient?: string }>(
        `/api/notes/${note.id}/visualize`,
        {
          method: "POST",
          body: JSON.stringify({ selectedText, ask: ask.trim(), form }),
        }
      );
      if (result.spec) {
        setSpec(result.spec);
        setStage("view");
      } else {
        setNotice(result.insufficient ?? "");
        setStage("insufficient");
      }
    } catch (e) {
      setNotice(e instanceof Error ? localizeError(e.message, t) : "");
      setStage("error");
    }
  }

  async function keep() {
    if (!spec || stage === "keeping") return;
    setStage("keeping");
    try {
      const formLabel = form ? t(FORMS.find((f) => f.kind === form)!.label) : "";
      const askLine = [formLabel, ask.trim()].filter(Boolean).join(" — ");
      await api(`/api/notes/${note.id}/visuals`, {
        method: "POST",
        body: JSON.stringify({ selectedText, ask: askLine, spec }),
      });
      setStage("kept");
      onKept();
      setTimeout(onClose, 900);
    } catch {
      setNotice("");
      setStage("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-card2 border border-ink/15 shadow-2xl shadow-black/60 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">{t("notes.vizTitle")}</p>
        <blockquote className="mt-2 border-l-2 border-accent/50 pl-2.5 text-[0.6875rem] text-emph leading-snug line-clamp-3">
          {selectedText}
        </blockquote>

        {(stage === "ask" || stage === "busy") && (
          <>
            <p className="mt-3 text-xs text-muted">{t("notes.vizAskLead")}</p>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {FORMS.map((f) => (
                <button
                  key={f.kind}
                  disabled={stage === "busy"}
                  onClick={() => setForm(form === f.kind ? null : f.kind)}
                  className={`rounded-full px-2.5 py-1 text-[0.6875rem] border transition-colors disabled:opacity-50 ${
                    form === f.kind
                      ? "border-accent/60 bg-accent/15 text-accent font-medium"
                      : "border-hairline bg-ink/4 text-emph hover:bg-ink/8"
                  }`}
                >
                  {t(f.label)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canGenerate) {
                  e.preventDefault();
                  generate();
                }
              }}
              disabled={stage === "busy"}
              placeholder={t("notes.vizAskPlaceholder")}
              className="mt-2 w-full rounded-lg border border-hairline bg-ink/4 px-2.5 py-1.5 text-xs focus:outline-none focus:border-accent/50 placeholder:text-muted/50 disabled:opacity-50"
            />
            <p className="mt-2 text-[0.625rem] text-muted/70 leading-snug">{t("notes.vizContextNote")}</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={generate}
                disabled={!canGenerate || stage === "busy"}
                className="rounded-lg bg-accent/90 hover:bg-accent disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
              >
                {stage === "busy" ? t("notes.vizBusy") : t("notes.vizGenerate")}
              </button>
              <button
                onClick={onClose}
                disabled={stage === "busy"}
                className="rounded-lg border border-hairline bg-ink/4 hover:bg-ink/8 text-muted text-xs px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {t("common.dismiss")}
              </button>
            </div>
          </>
        )}

        {stage === "insufficient" && (
          <div className="mt-3">
            <p className="text-xs font-medium text-emph">{t("notes.vizInsufficientTitle")}</p>
            {notice && <p className="mt-1 text-xs text-muted leading-relaxed">{notice}</p>}
            <button
              onClick={() => setStage("ask")}
              className="mt-3 rounded-lg border border-hairline bg-ink/4 hover:bg-ink/8 text-emph text-xs px-3 py-1.5 transition-colors"
            >
              {t("notes.vizBack")}
            </button>
          </div>
        )}

        {stage === "error" && (
          <div className="mt-3">
            <p className="text-loss text-xs">{notice || t("notes.vizFailed")}</p>
            <button
              onClick={() => setStage("ask")}
              className="mt-3 rounded-lg border border-hairline bg-ink/4 hover:bg-ink/8 text-emph text-xs px-3 py-1.5 transition-colors"
            >
              {t("notes.vizBack")}
            </button>
          </div>
        )}

        {(stage === "view" || stage === "keeping" || stage === "kept") && spec && (
          <div className="mt-3">
            <div className="rounded-xl bg-card border border-hairline p-3.5">
              <VisualCard spec={spec} />
            </div>
            {stage === "kept" ? (
              <p className="text-gain text-sm font-medium mt-3">{t("notes.vizKept")}</p>
            ) : (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={keep}
                  disabled={stage === "keeping"}
                  className="rounded-lg bg-accent/90 hover:bg-accent disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
                >
                  {t("notes.vizKeep")}
                </button>
                <button
                  onClick={() => setStage("ask")}
                  disabled={stage === "keeping"}
                  className="rounded-lg border border-hairline bg-ink/4 hover:bg-ink/8 text-emph text-xs px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {t("notes.vizBack")}
                </button>
                <button
                  onClick={onClose}
                  disabled={stage === "keeping"}
                  className="rounded-lg border border-hairline bg-ink/4 hover:bg-ink/8 text-muted text-xs px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {t("notes.vizDiscard")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
