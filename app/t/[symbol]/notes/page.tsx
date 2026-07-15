"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NoteEditor } from "@/components/NoteEditor";
import { useT } from "@/components/PrefsProvider";
import { api, timeAgo } from "@/components/util";
import type { TKey } from "@/lib/i18n/dictionaries";
import type { Note, NotesPayload } from "@/lib/types";

/**
 * The investor's own thinking layer for one ticker: sections (custom titles,
 * focus areas, or classic value-investing lenses) holding rich-text notepads.
 * The analyst desk reads these notes as context but never edits them.
 */

const SUGGESTION_KEYS: TKey[] = [
  "notes.sugMoat",
  "notes.sugProspects",
  "notes.sugBuybacks",
  "notes.sugCulture",
  "notes.sugIndustry",
];

export default function NotesPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const { t } = useT();

  const [payload, setPayload] = useState<NotesPayload | null>(null);
  const [newSection, setNewSection] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api<NotesPayload>(`/api/tickers/${encodeURIComponent(symbol)}/notes`)
        .then(setPayload)
        .catch(() => {}),
    [symbol]
  );
  useEffect(() => {
    let alive = true;
    api<NotesPayload>(`/api/tickers/${encodeURIComponent(symbol)}/notes`)
      .then((p) => alive && setPayload(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [symbol]);

  async function addSection(title: string) {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await api(`/api/notes/sections`, {
        method: "POST",
        body: JSON.stringify({ symbol, title }),
      });
      setNewSection("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const existingTitles = new Set((payload?.sections ?? []).map((s) => s.title.toLowerCase()));
  const suggestions = SUGGESTION_KEYS.map((k) => t(k)).filter(
    (s) => !existingTitles.has(s.toLowerCase())
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap">
        <Link
          href={`/t/${encodeURIComponent(symbol)}`}
          className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity"
        >
          {t("notes.backToDesk")}
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">
            {symbol} <span className="text-muted font-normal">· {t("notes.title")}</span>
          </h1>
          <p className="text-muted text-xs">{t("notes.pageSubtitle", { name: symbol })}</p>
        </div>
      </header>

      {!payload ? (
        <p className="text-muted text-sm mt-10 text-center">{t("notes.loading")}</p>
      ) : (
        <>
          {/* Add a section: free text, plus one-click focus areas & classic lenses. */}
          <div className="mt-6 rounded-2xl bg-card border border-hairline p-4">
            <form
              className="flex items-center gap-2 flex-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                addSection(newSection);
              }}
            >
              <input
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                placeholder={t("notes.sectionNamePlaceholder")}
                className="flex-1 min-w-48 rounded-lg border border-hairline bg-ink/4 px-3 py-1.5 text-sm focus:outline-none focus:border-accent/50"
              />
              <button
                type="submit"
                disabled={!newSection.trim() || busy}
                className="rounded-lg bg-accent/90 hover:bg-accent disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
              >
                {t("notes.addSection")}
              </button>
            </form>
            {(payload.focusAreaTitles.length > 0 || suggestions.length > 0) && (
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px]">
                {payload.focusAreaTitles.length > 0 && (
                  <span className="text-muted">{t("notes.fromFocusAreas")}</span>
                )}
                {payload.focusAreaTitles.map((title) => (
                  <SectionChip key={title} title={title} accent onAdd={() => addSection(title)} />
                ))}
                {suggestions.length > 0 && (
                  <span className="text-muted ml-1">{t("notes.suggestedSections")}</span>
                )}
                {suggestions.map((title) => (
                  <SectionChip key={title} title={title} onAdd={() => addSection(title)} />
                ))}
              </div>
            )}
          </div>

          {payload.sections.length === 0 && (
            <p className="text-muted text-sm mt-8 text-center">{t("notes.noSections")}</p>
          )}

          <div className="mt-5 space-y-6">
            {payload.sections.map((s) => (
              <SectionBlock key={s.id} section={s} onChanged={load} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function SectionChip({
  title,
  accent,
  onAdd,
}: {
  title: string;
  accent?: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      onClick={onAdd}
      className={`rounded-full px-2.5 py-0.5 border transition-colors ${
        accent
          ? "border-accent/30 bg-accent/8 text-accent hover:bg-accent/15"
          : "border-hairline bg-ink/4 text-emph hover:bg-ink/10"
      }`}
    >
      + {title}
    </button>
  );
}

function SectionBlock({
  section,
  onChanged,
}: {
  section: NotesPayload["sections"][number];
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useT();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [busy, setBusy] = useState(false);

  async function rename() {
    setRenaming(false);
    if (!title.trim() || title.trim() === section.title) return setTitle(section.title);
    await api(`/api/notes/sections/${section.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }).catch(() => setTitle(section.title));
    onChanged();
  }

  async function remove() {
    if (!confirm(t("notes.deleteSectionConfirm", { title: section.title, n: section.notes.length })))
      return;
    setBusy(true);
    await api(`/api/notes/sections/${section.id}`, { method: "DELETE" }).catch(() => {});
    await onChanged();
    setBusy(false);
  }

  async function addNotepad() {
    setBusy(true);
    await api(`/api/notes`, {
      method: "POST",
      body: JSON.stringify({ sectionId: section.id }),
    }).catch(() => {});
    await onChanged();
    setBusy(false);
  }

  return (
    <section>
      <div className="flex items-center gap-2 flex-wrap">
        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === "Enter" && rename()}
            className="rounded-md border border-hairline bg-ink/4 px-2 py-0.5 text-[13px] font-semibold focus:outline-none focus:border-accent/50"
          />
        ) : (
          <h2
            className="text-[12px] uppercase tracking-widest text-muted font-semibold cursor-pointer hover:text-emph transition-colors"
            title={t("notes.renameSection")}
            onClick={() => setRenaming(true)}
          >
            {section.title}
          </h2>
        )}
        <button
          onClick={addNotepad}
          disabled={busy}
          className="rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2 py-0.5 text-[10px] text-muted hover:text-emph transition-colors disabled:opacity-40"
        >
          {t("notes.addNotepad")}
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="ml-auto rounded-md px-2 py-0.5 text-[10px] text-muted/60 hover:text-loss transition-colors disabled:opacity-40"
        >
          {t("notes.deleteSection")}
        </button>
      </div>

      {section.notes.length === 0 ? (
        <p className="text-muted/70 text-[11px] italic mt-2">{t("notes.emptySection")}</p>
      ) : (
        <div className="mt-2 space-y-3">
          {section.notes.map((n) => (
            <NotepadCard key={n.id} note={n} onDeleted={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}

function NotepadCard({ note, onDeleted }: { note: Note; onDeleted: () => Promise<unknown> }) {
  const { t } = useT();
  const [title, setTitle] = useState(note.title);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [savedAt, setSavedAt] = useState(note.updatedAt);
  const pending = useRef<{ title?: string; content?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (patch.title === undefined && patch.content === undefined) return;
    setSaveState("saving");
    try {
      await api(`/api/notes/${note.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setSavedAt(new Date().toISOString());
      setSaveState(pending.current.title !== undefined || pending.current.content !== undefined ? "dirty" : "saved");
    } catch {
      // Keep the edits queued; the next change retriggers the save.
      pending.current = { ...patch, ...pending.current };
      setSaveState("dirty");
    }
  }, [note.id]);

  const queue = useCallback(
    (patch: { title?: string; content?: string }) => {
      pending.current = { ...pending.current, ...patch };
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 1200);
    },
    [flush]
  );

  // Flush pending edits when the card unmounts (e.g. navigating away).
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      flush();
    },
    [flush]
  );

  async function remove() {
    if (!confirm(t("notes.deleteNotepadConfirm", { title: title || t("notes.untitledNotepad") })))
      return;
    await api(`/api/notes/${note.id}`, { method: "DELETE" }).catch(() => {});
    onDeleted();
  }

  return (
    <div className="rounded-2xl bg-card border border-hairline p-4">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queue({ title: e.target.value });
          }}
          placeholder={t("notes.notepadTitlePlaceholder")}
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold focus:outline-none placeholder:text-muted/50"
        />
        <span className="shrink-0 text-[10px] text-muted/70 tabular-nums">
          {saveState === "saving"
            ? t("notes.saving")
            : saveState === "dirty"
              ? t("notes.unsaved")
              : t("notes.savedAgo", { when: timeAgo(savedAt, t) })}
        </span>
        <button
          onClick={remove}
          title={t("notes.deleteNotepad")}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted/60 hover:text-loss transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="mt-2">
        <NoteEditor initialContent={note.content} onChange={(json) => queue({ content: json })} />
      </div>
    </div>
  );
}
