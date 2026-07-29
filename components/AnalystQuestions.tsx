"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/PrefsProvider";
import { api } from "@/components/util";
import type { DeskQuestion, Signal } from "@/lib/types";

/**
 * The analyst-questions channel: the research desk coming back to the
 * investor with the questions the open web cannot answer — their firsthand
 * experience, their judgment, their documents, their steer (the intake's
 * question craft, run continuously). Answers are kept verbatim and fed to
 * every later run and chat turn as first-class testimony.
 *
 * Renders as a card (signals page) or a compact block scoped to one signal
 * (signal detail). Self-fetching; refetches when `refreshKey` changes.
 */
export function AnalystQuestions({
  symbol,
  refreshKey,
  signalId,
  signalsById,
  onOpenSignal,
}: {
  symbol: string;
  refreshKey: string;
  /** When set, only this signal's questions show (compact, no card shell). */
  signalId?: string;
  signalsById?: Map<string, Signal>;
  onOpenSignal?: (id: string) => void;
}) {
  const { t } = useT();
  const [questions, setQuestions] = useState<DeskQuestion[] | null>(null);
  const [answeredOpen, setAnsweredOpen] = useState(false);
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<{ questions: DeskQuestion[] }>(`/api/tickers/${encodeURIComponent(symbol)}/questions`)
        .then((r) => setQuestions(r.questions))
        .catch(() => {}),
    [symbol]
  );
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const setDraft = (id: string, text: string) =>
    setDrafts((m) => {
      const next = new Map(m);
      next.set(id, text);
      return next;
    });

  async function answer(q: DeskQuestion) {
    const text = (drafts.get(q.id) ?? "").trim();
    if (!text || busyId) return;
    setBusyId(q.id);
    try {
      await api(`/api/questions/${q.id}`, { method: "PATCH", body: JSON.stringify({ answer: text }) });
      setDrafts((m) => {
        const next = new Map(m);
        next.delete(q.id);
        return next;
      });
      await load();
    } catch {
      /* the row stays open; the draft is preserved for retry */
    } finally {
      setBusyId(null);
    }
  }

  async function act(q: DeskQuestion, action: "dismiss" | "reopen") {
    if (busyId) return;
    setBusyId(q.id);
    try {
      await api(`/api/questions/${q.id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      await load();
    } catch {
      /* best-effort */
    } finally {
      setBusyId(null);
    }
  }

  const scoped = (questions ?? []).filter((q) => (signalId ? q.signalId === signalId : true));
  const open = scoped.filter((q) => q.status === "open");
  const answered = scoped.filter((q) => q.status === "answered");
  if (scoped.length === 0 || questions === null) return null;

  const signalTag = (q: DeskQuestion) => {
    if (signalId || !q.signalId) return null;
    const s = signalsById?.get(q.signalId);
    if (!s) return null;
    return (
      <button
        onClick={onOpenSignal ? () => onOpenSignal(s.id) : undefined}
        className={`shrink-0 rounded-full bg-ink/6 border border-hairline px-2 py-px text-[10px] text-muted ${
          onOpenSignal ? "hover:text-accent transition-colors" : ""
        }`}
      >
        {s.name}
      </button>
    );
  };

  const openRow = (q: DeskQuestion) => (
    <li key={q.id} className="rounded-xl bg-ink/4 border border-hairline px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-accent text-xs" aria-hidden>
          ?
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-emph leading-relaxed">{q.question}</p>
          {q.why && (
            <p className="mt-0.5 text-[10px] text-muted/80 leading-relaxed">
              {t("memory.qWhyPrefix")}: {q.why}
            </p>
          )}
        </div>
        {signalTag(q)}
        <button
          onClick={() => act(q, "dismiss")}
          disabled={busyId === q.id}
          title={t("memory.qDismissTitle")}
          className="shrink-0 text-muted hover:text-loss text-[11px] px-1 transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={drafts.get(q.id) ?? ""}
          onChange={(e) => setDraft(q.id, e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && answer(q)}
          placeholder={t("memory.qAnswerPlaceholder")}
          className="flex-1 min-w-0 rounded-lg border border-hairline bg-ink/4 px-3 py-1.5 text-xs focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
        />
        <button
          onClick={() => answer(q)}
          disabled={busyId === q.id || !(drafts.get(q.id) ?? "").trim()}
          className="rounded-lg bg-gain/15 text-gain text-[11px] font-semibold px-2.5 py-1.5 hover:bg-gain/25 disabled:opacity-50 transition-colors"
        >
          {t("memory.qAnswer")}
        </button>
      </div>
    </li>
  );

  const body = (
    <>
      {open.length > 0 && <ul className="space-y-2">{open.map(openRow)}</ul>}
      {answered.length > 0 && (
        <div className={open.length > 0 ? "mt-2.5" : ""}>
          <button
            onClick={() => setAnsweredOpen((v) => !v)}
            className="text-[10px] text-muted hover:text-emph transition-colors"
          >
            {answeredOpen ? "▾" : "▸"} {t("memory.qAnswered", { n: answered.length })}
          </button>
          {answeredOpen && (
            <ul className="mt-1.5 space-y-2">
              {answered.map((q) => (
                <li key={q.id} className="rounded-xl bg-ink/4 border border-hairline px-3 py-2 opacity-85">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted leading-relaxed">{q.question}</p>
                      <p className="mt-1 text-xs text-emph leading-relaxed">
                        <span className="text-[10px] uppercase tracking-wider text-gain/90 mr-1.5">
                          {t("memory.qYourAnswer")}
                        </span>
                        {q.answer}
                      </p>
                      {q.answeredAt && (
                        <p className="mt-0.5 text-[10px] text-muted/60">
                          {t("memory.qAnsweredOn", { date: q.answeredAt.slice(0, 10) })}
                        </p>
                      )}
                    </div>
                    {signalTag(q)}
                    <button
                      onClick={() => act(q, "reopen")}
                      disabled={busyId === q.id}
                      title={t("memory.qReopenTitle")}
                      className="shrink-0 rounded-lg bg-ink/6 text-muted text-[11px] px-2 py-1 hover:bg-ink/10 hover:text-foreground transition-colors"
                    >
                      {t("memory.reopen")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );

  // Compact, shell-less variant inside a signal's detail view.
  if (signalId) {
    return (
      <section className="mt-4">
        <h3 className="text-[10px] uppercase tracking-widest text-muted font-semibold">
          {t("memory.qTitle")}
        </h3>
        <div className="mt-1.5">{body}</div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-card border border-accent/25 px-5 py-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[11px] uppercase tracking-widest text-muted font-semibold">
          {t("memory.qTitle")}
        </h2>
        {open.length > 0 && (
          <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold">
            {t("memory.qOpenBadge", { n: open.length })}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted/80 leading-relaxed">{t("memory.qExplainer")}</p>
      <div className="mt-3">{body}</div>
    </section>
  );
}
