"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { generateHTML } from "@tiptap/core";
import { AnnotationRecords } from "@/components/AnnotationRecords";
import { Annotatable, AnnotationsProvider } from "@/components/Annotations";
import { DeskTabs } from "@/components/DeskTabs";
import { AttachmentKindIcon, PaperclipIcon, PencilIcon, SparkleIcon, TrashIcon, XIcon } from "@/components/icons";
import { NOTE_EXTENSIONS, NoteEditor, parseNoteDoc } from "@/components/NoteEditor";
import { useT } from "@/components/PrefsProvider";
import { fmtBytes, processEvidenceFile } from "@/components/attach";
import { api, localizeError, timeAgo } from "@/components/util";
import { docIsEmpty, docToPlainText } from "@/lib/notes";
import type {
  DiligenceEvidence,
  DiligencePayload,
  Note,
  SectionSuggestion,
} from "@/lib/types";

/**
 * The due-diligence workspace (FOUNDATION: "The due-diligence record is the
 * desk's centre"). Sections are large qualitative topics specific to this
 * company, each holding freely-editable notepads and a captioned evidence
 * locker — the investor's own record, in their own hands. Entering a ticker
 * lands on the signal board (/t/[symbol]/signals); the record lives here at
 * /t/[symbol]/dd, one pill away.
 */

type Section = DiligencePayload["sections"][number];

export default function DiligencePage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const { t } = useT();

  const [payload, setPayload] = useState<DiligencePayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [newSection, setNewSection] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<SectionSuggestion[] | null>(null);
  const [suggestState, setSuggestState] = useState<"idle" | "busy" | "empty" | "error">("idle");

  const load = useCallback(
    () =>
      api<DiligencePayload>(`/api/tickers/${encodeURIComponent(symbol)}/diligence`)
        .then(setPayload)
        .catch(() => setNotFound(true)),
    [symbol]
  );
  useEffect(() => {
    load();
  }, [load]);

  // A desk that hasn't been set up yet onboards on the signals page (the
  // analyst interview + first board live there); the record starts after.
  useEffect(() => {
    if (payload && !payload.ticker.onboarded) {
      router.replace(`/t/${encodeURIComponent(symbol)}/signals`);
    }
  }, [payload, router, symbol]);

  // A quiet page: the record only changes under the investor's own hands.
  useEffect(() => {
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  async function addSection(title: string) {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await api(`/api/notes/sections`, {
        method: "POST",
        body: JSON.stringify({ symbol, title }),
      });
      setNewSection("");
      setSuggestions((s) => (s ? s.filter((x) => x.title !== title) : s));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function suggestTopics() {
    if (suggestState === "busy") return;
    setSuggestState("busy");
    try {
      const { suggestions: got } = await api<{ suggestions: SectionSuggestion[] }>(
        `/api/tickers/${encodeURIComponent(symbol)}/diligence/suggest`,
        { method: "POST" }
      );
      setSuggestions(got);
      setSuggestState(got.length === 0 ? "empty" : "idle");
    } catch {
      setSuggestState("error");
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="text-lg font-medium">{t("desk.notFound")}</p>
        <Link href="/" className="text-accent text-sm mt-2 inline-block">
          {t("desk.notFoundBack")}
        </Link>
      </main>
    );
  }
  if (!payload || !payload.ticker.onboarded) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center text-muted text-sm">
        {payload ? t("desk.opening", { symbol }) : t("dd.loading")}
      </main>
    );
  }

  const { ticker, activeSignals } = payload;

  return (
    <AnnotationsProvider symbol={symbol}>
    <main className="w-full px-5 sm:px-6 lg:px-8 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap">
        <Link
          href="/"
          className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity"
        >
          {t("common.backToWatchlist")}
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{ticker.symbol}</h1>
          <p className="text-muted text-xs truncate">{ticker.name}</p>
        </div>
        <DeskTabs symbol={symbol} active="dd" />
      </header>

      {/* Add a section: free text, focus areas, and the board's suggestions. */}
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
          <button
            type="button"
            onClick={suggestTopics}
            disabled={suggestState === "busy"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/8 hover:bg-accent/15 disabled:opacity-50 text-accent text-xs font-medium px-3 py-1.5 transition-colors"
          >
            {suggestState !== "busy" && <SparkleIcon className="h-3 w-3 shrink-0" />}
            {suggestState === "busy" ? t("dd.suggesting") : t("dd.suggestTopics")}
          </button>
        </form>
        {payload.focusAreaTitles.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-muted">{t("notes.fromFocusAreas")}</span>
            {payload.focusAreaTitles.map((title) => (
              <button
                key={title}
                onClick={() => addSection(title)}
                className="rounded-full px-2.5 py-0.5 border border-accent/30 bg-accent/8 text-accent hover:bg-accent/15 transition-colors"
              >
                + {title}
              </button>
            ))}
          </div>
        )}
        {suggestState === "empty" && (
          <p className="mt-3 text-xs text-muted">{t("dd.suggestNone")}</p>
        )}
        {suggestState === "error" && (
          <p className="mt-3 text-xs text-loss">{t("notes.clipFailed")}</p>
        )}
        {suggestions && suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted">{t("dd.suggestExplainer")}</p>
            <div className="mt-2 grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.title}
                  onClick={() => addSection(s.title)}
                  disabled={busy}
                  className="text-left rounded-xl border border-hairline bg-ink/4 hover:bg-ink/8 disabled:opacity-50 px-3.5 py-2.5 transition-colors"
                >
                  <span className="text-[0.8125rem] font-semibold text-emph">+ {s.title}</span>
                  {s.rationale && (
                    <p className="text-xs text-muted mt-1 leading-relaxed">{s.rationale}</p>
                  )}
                  {s.signalNames.length > 0 && (
                    <p className="text-[0.6875rem] text-accent/80 mt-1">
                      {t("dd.suggestDeepens", { names: s.signalNames.map((n) => `“${n}”`).join(", ") })}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted/70">
          {activeSignals.length > 0
            ? t("dd.boardLine", { n: activeSignals.length })
            : t("dd.boardLineNone")}
        </p>
      </div>

      {payload.sections.length === 0 && (
        <p className="text-muted text-sm mt-8 text-center">{t("notes.noSections")}</p>
      )}

      <div className="mt-6 space-y-8">
        {payload.sections.map((s) => (
          <SectionBlock key={s.id} symbol={symbol} section={s} onChanged={load} />
        ))}
      </div>

      {/* Every highlight on this record, reviewable in one place. */}
      <div className="mt-8">
        <AnnotationRecords
          notes={payload.sections.flatMap((s) =>
            s.notes.map((n) => ({ id: n.id, title: n.title, sectionTitle: s.title }))
          )}
          memos={payload.sections.flatMap((s) =>
            s.research.map((r) => ({ id: r.id, sectionTitle: s.title }))
          )}
        />
      </div>
    </main>
    </AnnotationsProvider>
  );
}

function SectionBlock({
  symbol,
  section,
  onChanged,
}: {
  symbol: string;
  section: Section;
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
            className="rounded-md border border-hairline bg-ink/4 px-2 py-0.5 text-[0.8125rem] font-semibold focus:outline-none focus:border-accent/50"
          />
        ) : (
          <h2
            className="text-[0.8125rem] uppercase tracking-widest text-muted font-semibold cursor-pointer hover:text-emph transition-colors"
            title={t("notes.renameSection")}
            onClick={() => setRenaming(true)}
          >
            {section.title}
          </h2>
        )}
        <button
          onClick={addNotepad}
          disabled={busy}
          className="rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2 py-0.5 text-[0.625rem] text-muted hover:text-emph transition-colors disabled:opacity-40"
        >
          {t("notes.addNotepad")}
        </button>
        {/* Deleting a section must be findable at a glance — a real button,
            not a ghost link (still confirm-gated; a whole section goes). */}
        <button
          onClick={remove}
          disabled={busy}
          title={t("notes.deleteSection")}
          className="ml-auto flex items-center gap-1 rounded-md border border-loss/25 bg-loss/8 hover:bg-loss/18 px-2 py-0.5 text-[0.625rem] font-medium text-loss transition-colors disabled:opacity-40"
        >
          <TrashIcon className="h-3 w-3" />
          {t("notes.deleteSection")}
        </button>
      </div>

      <EvidenceStrip symbol={symbol} section={section} onChanged={onChanged} />

      {section.notes.length === 0 ? (
        <p className="text-muted/70 text-xs italic mt-2.5">{t("notes.emptySection")}</p>
      ) : (
        <div className="mt-3 space-y-4">
          {section.notes.map((n) => (
            <NotepadCard key={n.id} note={n} onDeleted={onChanged} />
          ))}
        </div>
      )}

      {/* Notes append chronologically, so the add affordance lives at the
          bottom of the block — a fresh note opens exactly where it lands. */}
      <button
        onClick={addNotepad}
        disabled={busy}
        className="mt-2 w-full rounded-xl border border-dashed border-hairline bg-ink/3 hover:bg-ink/6 px-3 py-2 text-left text-[0.6875rem] text-muted hover:text-emph transition-colors disabled:opacity-40"
      >
        {t("notes.addNote")}
      </button>
    </section>
  );
}

/**
 * The section's evidence locker: drop (or pick) files of ANY type — filings,
 * screenshots, spreadsheets, photos — and caption each one. Uploads run one
 * file at a time (request-size limits); captions autosave. Readable files are
 * read by the memo agent when researching the section; the rest are carried
 * by their captions.
 */
function EvidenceStrip({
  symbol,
  section,
  onChanged,
}: {
  symbol: string;
  section: Section;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Base64 chars per request — under the server's EVIDENCE_CHUNK_MAX and the
  // platform's request-body cap. Big files upload as create + sequential appends.
  const CHUNK = 3_000_000;

  async function uploadOne(f: File) {
    const processed = await processEvidenceFile(f);
    const total = processed.data.length;
    const { evidence, complete } = await api<{ evidence: { id: string }; complete: boolean }>(
      `/api/tickers/${encodeURIComponent(symbol)}/diligence/evidence`,
      {
        method: "POST",
        body: JSON.stringify({
          sectionId: section.id,
          caption: "",
          file: { ...processed, data: processed.data.slice(0, CHUNK), expectedLength: total },
        }),
      }
    );
    if (complete) return;
    for (let off = CHUNK; off < total; off += CHUNK) {
      const data = processed.data.slice(off, off + CHUNK);
      await api(`/api/diligence/evidence/${evidence.id}/chunk`, {
        method: "POST",
        body: JSON.stringify({ data, last: off + CHUNK >= total }),
      });
      setUploadPct(Math.min(100, Math.round(((off + data.length) / total) * 100)));
    }
  }

  async function fileMany(files: File[]) {
    if (files.length === 0 || uploadingName) return;
    setErrors([]);
    for (const f of files) {
      setUploadingName(f.name);
      setUploadPct(null);
      try {
        await uploadOne(f);
      } catch (e) {
        setErrors((errs) => [
          ...errs,
          t("dd.evidenceFailed", {
            name: f.name,
            error: e instanceof Error ? localizeError(e.message, t) : "—",
          }),
        ]);
      }
    }
    setUploadingName(null);
    setUploadPct(null);
    await onChanged();
  }

  return (
    <div className="mt-2">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          fileMany([...e.dataTransfer.files]);
        }}
        role="button"
        className={`rounded-xl border border-dashed px-3.5 py-2.5 text-xs cursor-pointer transition-colors ${
          dragOver
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-hairline bg-ink/3 text-muted hover:bg-ink/6 hover:text-emph"
        }`}
      >
        {uploadingName ? (
          `${t("dd.evidenceUploading", { name: uploadingName })}${uploadPct != null ? ` · ${uploadPct}%` : ""}`
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <PaperclipIcon className="h-3.5 w-3.5 shrink-0" />
            {t("dd.evidenceDrop")}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            fileMany([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
      {errors.map((err) => (
        <p key={err} className="mt-1 text-xs text-loss">
          {err}
        </p>
      ))}
      {section.evidence.length > 0 && (
        <>
          <div className="mt-2 grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {section.evidence.map((e) => (
              <EvidenceCard key={e.id} evidence={e} onChanged={onChanged} />
            ))}
          </div>
          <p className="mt-2 text-[0.6875rem] text-muted/60">{t("dd.evidenceReadNote")}</p>
        </>
      )}
    </div>
  );
}

function EvidenceCard({
  evidence,
  onChanged,
}: {
  evidence: DiligenceEvidence;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useT();
  const [caption, setCaption] = useState(evidence.caption);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileUrl = `/api/diligence/evidence/${evidence.id}/file`;

  // Debounced caption autosave, the notepad-title idiom — including its
  // flush-on-unmount (type a caption and navigate within a second: the words
  // must land, not evaporate with the debounce timer).
  const pendingCaption = useRef<string | null>(null);
  const saveCaption = useCallback(
    (v: string) =>
      api(`/api/diligence/evidence/${evidence.id}`, {
        method: "PATCH",
        body: JSON.stringify({ caption: v }),
      }).catch(() => {}),
    [evidence.id]
  );
  function queueCaption(v: string) {
    setCaption(v);
    pendingCaption.current = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pendingCaption.current = null;
      saveCaption(v);
    }, 1000);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pendingCaption.current !== null) saveCaption(pendingCaption.current);
    },
    [saveCaption]
  );

  async function remove() {
    if (!confirm(t("dd.evidenceDeleteConfirm", { name: evidence.name }))) return;
    setBusy(true);
    await api(`/api/diligence/evidence/${evidence.id}`, { method: "DELETE" }).catch(() => {});
    await onChanged();
    setBusy(false);
  }

  return (
    <div className="rounded-xl bg-card border border-hairline p-2.5 flex gap-2.5">
      {evidence.kind === "image" ? (
        <a href={fileUrl} target="_blank" rel="noreferrer" className="shrink-0">
          {/* Served by our own authenticated route — next/image gains nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt={evidence.caption || evidence.name}
            className="w-16 h-16 rounded-lg object-cover border border-hairline"
          />
        </a>
      ) : (
        <span className="shrink-0 w-16 h-16 rounded-lg bg-ink/5 border border-hairline flex items-center justify-center">
          <AttachmentKindIcon kind={evidence.kind} className="h-6 w-6 text-muted" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            title={t("dd.evidenceOpen")}
            className="text-xs font-medium text-emph hover:text-accent truncate transition-colors"
          >
            {evidence.name}
          </a>
          <span className="shrink-0 text-[0.625rem] text-muted/70 tabular-nums">
            {fmtBytes(evidence.size)}
          </span>
          <button
            onClick={remove}
            disabled={busy}
            title={t("dd.evidenceDelete")}
            className="ml-auto shrink-0 rounded-md px-1 py-0.5 text-muted/60 hover:text-loss transition-colors disabled:opacity-40"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
        <input
          value={caption}
          onChange={(e) => queueCaption(e.target.value)}
          placeholder={t("dd.evidenceCaptionPlaceholder")}
          className="mt-1.5 w-full rounded-md border border-hairline bg-ink/4 px-2 py-1 text-xs focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
        />
        <p className="mt-1 text-[0.625rem] text-muted/60">{evidence.createdAt.slice(0, 10)}</p>
      </div>
    </div>
  );
}

/**
 * One notepad, in two modes. READ (default): the document rendered statically
 * through the editor schema, so selecting text highlights/annotates it exactly
 * like the desk's other surfaces. EDIT: the TipTap editor (annotation marks
 * can't be painted into a live ProseMirror view). A brand-new empty notepad
 * opens straight into edit mode.
 */
function NotepadCard({ note, onDeleted }: { note: Note; onDeleted: () => Promise<unknown> }) {
  const { t } = useT();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [editing, setEditing] = useState(() => docIsEmpty(note.content));
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [savedAt, setSavedAt] = useState(note.updatedAt);
  const pending = useRef<{ title?: string; content?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves are serialized on this chain: at most one PATCH in flight, and the
  // newest snapshot always lands last (a Done-click racing the 1200ms timer
  // must never let an older body commit after a newer one).
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(() => {
    saveChain.current = saveChain.current.then(async () => {
      const patch = pending.current;
      pending.current = {};
      if (patch.title === undefined && patch.content === undefined) return;
      setSaveState("saving");
      try {
        await api(`/api/notes/${note.id}`, { method: "PATCH", body: JSON.stringify(patch) });
        setSavedAt(new Date().toISOString());
        setSaveState(
          pending.current.title !== undefined || pending.current.content !== undefined
            ? "dirty"
            : "saved"
        );
      } catch {
        // Keep the edits queued; the next change retriggers the save.
        pending.current = { ...patch, ...pending.current };
        setSaveState("dirty");
      }
    });
    return saveChain.current;
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

  // Another surface can move this note server-side while the card holds
  // mount-time state — the clip tool appends from the signals desk, and the
  // 30s poll delivers the new content to a card that would otherwise show
  // (and, on the next keystroke, SAVE OVER) the stale copy. Adopt the server
  // copy whenever this card is clean: read mode, nothing pending. An open
  // editor is left alone — see the concurrency note in the findings ledger.
  // (Render-time adoption, the React "adjust state when props change" idiom —
  // setSavedAt extinguishes the condition, so this settles in one re-render.)
  if (!editing && saveState === "saved" && note.updatedAt > savedAt) {
    setTitle(note.title);
    setContent(note.content);
    setSavedAt(note.updatedAt);
  }

  async function remove() {
    if (!confirm(t("notes.deleteNotepadConfirm", { title: title || t("notes.untitledNotepad") })))
      return;
    await api(`/api/notes/${note.id}`, { method: "DELETE" }).catch(() => {});
    onDeleted();
  }

  function finishEditing() {
    if (timer.current) clearTimeout(timer.current);
    flush();
    setEditing(false);
  }

  // Read-mode render: the stored document through the SAME schema as the
  // editor, as static HTML the annotation painter can safely mark up.
  // generateHTML needs a DOM, and the record only exists after the page's
  // own fetch — so this is browser-only by construction, and guarded to
  // stay that way if the loading gate above ever changes. A doc outside the
  // editor schema (older rows, direct API writes) must degrade to the
  // investor's words as plain text, never crash the whole record.
  const readHtml = useMemo(() => {
    if (editing || typeof window === "undefined") return "";
    try {
      return generateHTML(parseNoteDoc(content), NOTE_EXTENSIONS);
    } catch {
      const text = docToPlainText(content)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return text ? `<p>${text.replace(/\n/g, "<br>")}</p>` : "";
    }
  }, [content, editing]);
  const isEmpty = !editing && docIsEmpty(content);

  return (
    <div className="rounded-2xl bg-card border border-hairline p-5">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queue({ title: e.target.value });
          }}
          placeholder={t("notes.notepadTitlePlaceholder")}
          className="flex-1 min-w-0 bg-transparent text-[0.9375rem] font-semibold focus:outline-none placeholder:text-muted/50"
        />
        <span className="shrink-0 text-[0.625rem] text-muted/70 tabular-nums">
          {saveState === "saving"
            ? t("notes.saving")
            : saveState === "dirty"
              ? t("notes.unsaved")
              : t("notes.savedAgo", { when: timeAgo(savedAt, t) })}
        </span>
        <button
          onClick={editing ? finishEditing : () => setEditing(true)}
          className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.6875rem] font-medium transition-colors ${
            editing
              ? "bg-accent/12 text-accent hover:bg-accent/20"
              : "bg-ink/6 text-muted hover:bg-ink/10 hover:text-emph"
          }`}
        >
          {!editing && <PencilIcon className="h-2.5 w-2.5" />}
          {editing ? t("notes.doneEditing") : t("notes.editNote")}
        </button>
        <button
          onClick={remove}
          title={t("notes.deleteNotepad")}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-muted/60 hover:text-loss transition-colors"
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-2.5">
        {editing ? (
          <NoteEditor
            initialContent={content}
            onChange={(json) => {
              setContent(json);
              queue({ content: json });
            }}
          />
        ) : isEmpty ? (
          <p
            className="text-muted/70 text-[0.8125rem] italic cursor-text"
            onClick={() => setEditing(true)}
          >
            {t("notes.emptyNotepad")}
          </p>
        ) : (
          <Annotatable surfaceId={`note:${note.id}`}>
            <div
              onDoubleClick={() => setEditing(true)}
              className="note-prose text-[0.9375rem] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: readHtml }}
            />
          </Annotatable>
        )}
      </div>
    </div>
  );
}
