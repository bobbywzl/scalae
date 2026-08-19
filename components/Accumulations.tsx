"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "@/components/PrefsProvider";
import { chipLabel } from "@/lib/citations";
import type { Citation, ResearchAccumulation, Signal } from "@/lib/types";
import { timeAgo } from "./util";

/** Clickable source chip — same treatment as the signal cards' evidence chips. */
function SourceChip({ citation, siblings }: { citation: Citation; siblings: Citation[] }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noreferrer"
      title={citation.title}
      className="rounded-full border border-hairline bg-ink/4 hover:bg-ink/10 hover:border-ink/25 px-2 py-0.5 text-[0.625rem] text-emph transition-colors max-w-[220px] truncate"
    >
      {chipLabel(citation, siblings)}
    </a>
  );
}

/**
 * Analyst research accumulations — what the analyst has learned about this
 * business, run over run. Entries group by topic (topics ordered by their
 * newest entry, entries newest-first inside each; the payload arrives newest
 * first, so insertion order does both). Renders nothing while the desk has
 * no accumulated notes — the surface earns its place only once it has content.
 */
export function Accumulations({
  items,
  signals = [],
  onOpenSignal,
  onDelete,
}: {
  /** Accumulated research notes, newest first (as served in the desk payload). */
  items: ResearchAccumulation[];
  /** Board signals of any status, used to resolve tagged names. */
  signals?: Pick<Signal, "id" | "name" | "status">[];
  onOpenSignal?: (id: string) => void;
  /** Drop one note (confirm-free — these are the desk's own low-stakes notes). */
  onDelete?: (item: ResearchAccumulation) => void;
}) {
  const { t } = useT();

  // Open/closed persists like the other viewing preferences (boardLayout);
  // restored after mount — the server render has no localStorage, and a
  // mismatch would break hydration.
  const [open, setOpenState] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("scalae.accumulationsOpen") === "closed") setOpenState(false);
    } catch {
      /* private mode / storage blocked — default stands */
    }
  }, []);
  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    try {
      localStorage.setItem("scalae.accumulationsOpen", v ? "open" : "closed");
    } catch {
      /* preference just won't persist */
    }
  }, []);

  const byName = useMemo(() => new Map(signals.map((s) => [s.name, s])), [signals]);

  // Group by topic. Items arrive newest-first, so first-seen insertion order
  // ranks topics by their newest entry and keeps entries newest-first within.
  const topics = useMemo(() => {
    const m = new Map<string, ResearchAccumulation[]>();
    for (const a of items) {
      const key = a.topic;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    }
    return [...m.entries()];
  }, [items]);

  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card border border-hairline p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-[0.6875rem] uppercase tracking-widest text-muted font-semibold flex items-center gap-2">
          {t("desk.accumulationsTitle")}
        </h2>
        <button
          onClick={() => setOpen(!open)}
          className="ml-auto rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2 py-0.5 text-[0.625rem] text-muted hover:text-emph transition-colors"
        >
          {open ? t("common.collapse") : t("common.expand")}
        </button>
      </div>
      <p className="text-xs text-muted mt-1.5 leading-relaxed">{t("desk.accumulationsExplainer")}</p>
      {open && (
        <div className="mt-3 space-y-4">
          {topics.map(([topic, entries]) => (
            <div key={topic}>
              <h3 className="text-[0.6875rem] uppercase tracking-widest text-muted font-semibold flex items-center gap-1.5">
                <span className="min-w-0 truncate">{topic}</span>
                {entries.length > 1 && (
                  <span className="shrink-0 rounded-full bg-ink/6 text-muted px-1.5 py-px text-[0.5625rem] font-semibold normal-case tracking-normal">
                    {t("desk.accumulationEntries", { n: entries.length })}
                  </span>
                )}
              </h3>
              <ul className="mt-1.5 space-y-3">
                {entries.map((a) => (
                  <li key={a.id}>
                    <p className="text-xs text-[#b5b5ba] leading-relaxed whitespace-pre-wrap">
                      {a.insight}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.625rem] text-muted">
                      <span className="shrink-0">{timeAgo(a.createdAt, t)}</span>
                      {a.citations.map((c, i) => (
                        <SourceChip key={i} citation={c} siblings={a.citations} />
                      ))}
                      {a.signalNames.map((name) => {
                        const s = byName.get(name);
                        // Active/retired signals open their detail view;
                        // anything unresolvable stays a plain muted chip.
                        if (s && (s.status === "active" || s.status === "retired") && onOpenSignal) {
                          return (
                            <button
                              key={name}
                              onClick={() => onOpenSignal(s.id)}
                              title={t("signals.openSignalTitle")}
                              className="rounded-full border border-accent/25 bg-accent/8 hover:bg-accent/15 px-2 py-0.5 text-[0.625rem] text-accent transition-colors max-w-[220px] truncate"
                            >
                              {name}
                            </button>
                          );
                        }
                        return (
                          <span
                            key={name}
                            className="rounded-full border border-hairline bg-ink/4 px-2 py-0.5 text-[0.625rem] text-muted max-w-[220px] truncate"
                          >
                            {name}
                          </span>
                        );
                      })}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(a)}
                          title={t("desk.accumulationRemoveTitle")}
                          aria-label={t("desk.accumulationRemoveTitle")}
                          className="ml-auto shrink-0 rounded-md border border-hairline bg-ink/4 hover:bg-loss/10 hover:border-loss/30 px-1.5 py-px text-[0.625rem] text-muted hover:text-loss transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
