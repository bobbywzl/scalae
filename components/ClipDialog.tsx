"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "./PrefsProvider";
import { api } from "./util";
import type { NotesPayload } from "@/lib/types";

/**
 * Anything clippable into a notepad — evidence-feed items satisfy this shape
 * directly, and signal readings are mapped into it (see SignalDetail).
 */
export interface ClipPayload {
  headline: string;
  summary: string;
  url: string | null;
  source: string | null;
  date: string;
  signalNames: string[];
}

/**
 * "Clip to notes": pick (or create) a notepad and the evidence item is appended
 * there as a quoted block, ready to comment around on the Notes page.
 */
export function ClipDialog({
  symbol,
  item,
  onClose,
}: {
  symbol: string;
  item: ClipPayload;
  onClose: () => void;
}) {
  const { t } = useT();
  const [payload, setPayload] = useState<NotesPayload | null>(null);
  const [state, setState] = useState<"pick" | "busy" | "done" | "error">("pick");

  useEffect(() => {
    let alive = true;
    api<NotesPayload>(`/api/tickers/${encodeURIComponent(symbol)}/notes`)
      .then((p) => alive && setPayload(p))
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [symbol]);

  async function clipTo(noteId: string) {
    setState("busy");
    try {
      await api(`/api/notes/${noteId}/clip`, {
        method: "POST",
        body: JSON.stringify({
          headline: item.headline,
          summary: item.summary,
          url: item.url,
          source: item.source,
          date: item.date,
          signalNames: item.signalNames,
        }),
      });
      setState("done");
      setTimeout(onClose, 900);
    } catch {
      setState("error");
    }
  }

  async function clipToNewNote(sectionId: string) {
    setState("busy");
    try {
      const { note } = await api<{ note: { id: string } }>(`/api/notes`, {
        method: "POST",
        body: JSON.stringify({ sectionId, title: item.headline.slice(0, 80) }),
      });
      await clipTo(note.id);
    } catch {
      setState("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card2 border border-ink/15 shadow-2xl shadow-black/60 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">{t("notes.clipTitle")}</p>
        <p className="text-[11px] text-muted mt-1 line-clamp-2">{item.headline}</p>

        {state === "done" ? (
          <p className="text-gain text-sm font-medium mt-4">{t("notes.clipped")}</p>
        ) : state === "error" ? (
          <p className="text-loss text-xs mt-4">{t("notes.clipFailed")}</p>
        ) : !payload ? (
          <p className="text-muted text-xs italic mt-4">{t("notes.loading")}</p>
        ) : payload.sections.length === 0 ? (
          <div className="mt-4">
            <p className="text-muted text-xs">{t("notes.clipNoSections")}</p>
            <Link
              href={`/t/${encodeURIComponent(symbol)}/notes`}
              className="inline-block mt-2 text-accent text-xs font-medium hover:underline"
            >
              {t("notes.clipGoToNotes")}
            </Link>
          </div>
        ) : (
          <div className="mt-3 max-h-80 overflow-y-auto space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">{t("notes.clipPick")}</p>
            {payload.sections.map((s) => (
              <div key={s.id}>
                <p className="text-[10px] uppercase tracking-widest text-muted/80 font-semibold">
                  {s.title}
                </p>
                <div className="mt-1 space-y-1">
                  {s.notes.map((n) => (
                    <button
                      key={n.id}
                      disabled={state === "busy"}
                      onClick={() => clipTo(n.id)}
                      className="block w-full text-left rounded-lg border border-hairline bg-ink/4 hover:bg-ink/10 px-3 py-1.5 text-xs text-emph hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      {n.title || t("notes.untitledNotepad")}
                    </button>
                  ))}
                  <button
                    disabled={state === "busy"}
                    onClick={() => clipToNewNote(s.id)}
                    className="block w-full text-left rounded-lg border border-dashed border-hairline hover:border-accent/40 px-3 py-1.5 text-xs text-muted hover:text-accent transition-colors disabled:opacity-40"
                  >
                    {t("notes.clipNewNotepad", { section: s.title })}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
