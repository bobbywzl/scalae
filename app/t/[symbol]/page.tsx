"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DeskTabs } from "@/components/DeskTabs";
import { Markdown } from "@/components/Markdown";
import { NoteEditor } from "@/components/NoteEditor";
import { useT } from "@/components/PrefsProvider";
import { fmtBytes, processEvidenceFile } from "@/components/attach";
import { api, localizeError, timeAgo } from "@/components/util";
import { linkCitations } from "@/lib/citations";
import type {
  DiligenceEvidence,
  DiligencePayload,
  DiligenceResearch,
  Note,
  SectionSuggestion,
} from "@/lib/types";

/**
 * The ticker's MAIN page: the due-diligence workspace (FOUNDATION: "The
 * due-diligence record is the desk's centre"). Sections are large qualitative
 * topics specific to this company, each holding freely-editable notepads. The
 * desk contributes on-demand deep research that parks for review and enters
 * the record only on the investor's accept, plus an on-demand standing
 * synthesis of core insights. The signal board lives at /t/[symbol]/signals.
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
  const [synthBusy, setSynthBusy] = useState(false);
  const [synthError, setSynthError] = useState<string | null>(null);
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

  // Poll fast while a research pass is running, slowly otherwise.
  const researching = useMemo(
    () => (payload?.sections ?? []).some((s) => s.research[0]?.status === "running"),
    [payload]
  );
  useEffect(() => {
    const timer = setInterval(load, researching ? 2500 : 30_000);
    return () => clearInterval(timer);
  }, [load, researching]);

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

  async function refreshSynthesis() {
    if (synthBusy) return;
    setSynthBusy(true);
    setSynthError(null);
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/diligence/synthesis`, {
        method: "POST",
      });
      await load();
    } catch (e) {
      setSynthError(e instanceof Error ? localizeError(e.message, t) : t("common.errRequestFailed", { code: "?" }));
    } finally {
      setSynthBusy(false);
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

  const { ticker, synthesis, synthesisStale, activeSignals } = payload;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap">
        <Link
          href="/"
          className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity"
        >
          {t("common.backToWatchlist")}
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{ticker.symbol}</h1>
          <p className="text-muted text-xs">{t("dd.pageSubtitle", { name: ticker.name })}</p>
        </div>
        <DeskTabs symbol={symbol} active="dd" />
        <div className="flex items-center gap-2 ml-auto">
          {researching && (
            <span className="text-[11px] text-accent pulse-soft">{t("desk.researching")}</span>
          )}
        </div>
      </header>

      {/* The standing synthesis of core insights across the whole record. */}
      <section className="mt-6 rounded-2xl bg-card border border-accent/20 p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <SectionTitle>{t("dd.synthesisTitle")}</SectionTitle>
          {synthesis && (
            <span className="text-[10px] text-muted normal-case tracking-normal">
              {t("dd.synthesisRefreshedAgo", { when: timeAgo(synthesis.updatedAt, t) })}
            </span>
          )}
          {synthesisStale && (
            <span className="rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[10px] font-semibold">
              {t("dd.synthesisStale")}
            </span>
          )}
          <button
            onClick={refreshSynthesis}
            disabled={synthBusy}
            className="ml-auto rounded-lg bg-ink/8 hover:bg-ink/12 disabled:opacity-50 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            {synthBusy ? t("dd.synthesisRefreshing") : t("dd.synthesisRefresh")}
          </button>
        </div>
        {synthError && <p className="mt-2 text-[11px] text-loss">{synthError}</p>}
        {synthesis ? (
          <div className="mt-2">
            <Markdown>{synthesis.content}</Markdown>
          </div>
        ) : (
          <p className="text-muted text-xs italic mt-2">{t("dd.synthesisNone")}</p>
        )}
        <p className="mt-3 text-[10px] text-muted/70">{t("dd.synthesisExplainer")}</p>
      </section>

      {/* Add a section: free text, focus areas, and the board's suggestions. */}
      <div className="mt-5 rounded-2xl bg-card border border-hairline p-4">
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
            className="rounded-lg border border-accent/30 bg-accent/8 hover:bg-accent/15 disabled:opacity-50 text-accent text-xs font-medium px-3 py-1.5 transition-colors"
          >
            {suggestState === "busy" ? t("dd.suggesting") : t("dd.suggestTopics")}
          </button>
        </form>
        {payload.focusAreaTitles.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px]">
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
          <p className="mt-2.5 text-[11px] text-muted">{t("dd.suggestNone")}</p>
        )}
        {suggestState === "error" && (
          <p className="mt-2.5 text-[11px] text-loss">{t("notes.clipFailed")}</p>
        )}
        {suggestions && suggestions.length > 0 && (
          <div className="mt-2.5">
            <p className="text-[11px] text-muted">{t("dd.suggestExplainer")}</p>
            <div className="mt-1.5 grid sm:grid-cols-2 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.title}
                  onClick={() => addSection(s.title)}
                  disabled={busy}
                  className="text-left rounded-xl border border-hairline bg-ink/4 hover:bg-ink/8 disabled:opacity-50 px-3 py-2 transition-colors"
                >
                  <span className="text-[12px] font-semibold text-emph">+ {s.title}</span>
                  {s.rationale && <p className="text-[11px] text-muted mt-0.5">{s.rationale}</p>}
                  {s.signalNames.length > 0 && (
                    <p className="text-[10px] text-accent/80 mt-0.5">
                      {t("dd.suggestDeepens", { names: s.signalNames.map((n) => `“${n}”`).join(", ") })}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-2.5 text-[10px] text-muted/70">
          {activeSignals.length > 0
            ? t("dd.boardLine", { n: activeSignals.length })
            : t("dd.boardLineNone")}
        </p>
      </div>

      {payload.sections.length === 0 && (
        <p className="text-muted text-sm mt-8 text-center">{t("notes.noSections")}</p>
      )}

      <div className="mt-5 space-y-6">
        {payload.sections.map((s) => (
          <SectionBlock key={s.id} symbol={symbol} section={s} onChanged={load} />
        ))}
      </div>
    </main>
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
        {/* Deleting a section must be findable at a glance — a real button,
            not a ghost link (still confirm-gated; a whole section goes). */}
        <button
          onClick={remove}
          disabled={busy}
          title={t("notes.deleteSection")}
          className="ml-auto flex items-center gap-1 rounded-md border border-loss/25 bg-loss/8 hover:bg-loss/18 px-2 py-0.5 text-[10px] font-medium text-loss transition-colors disabled:opacity-40"
        >
          🗑 {t("notes.deleteSection")}
        </button>
      </div>

      <ResearchPanel symbol={symbol} section={section} onChanged={onChanged} />

      <EvidenceStrip symbol={symbol} section={section} onChanged={onChanged} />

      {section.notes.length === 0 ? (
        <p className="text-muted/70 text-[11px] italic mt-2">{t("notes.emptySection")}</p>
      ) : (
        <div className="mt-2 space-y-3">
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
        className="mt-2 w-full rounded-xl border border-dashed border-hairline bg-ink/3 hover:bg-ink/6 px-3 py-2 text-left text-[11px] text-muted hover:text-emph transition-colors disabled:opacity-40"
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
        className={`rounded-xl border border-dashed px-3 py-2 text-[11px] cursor-pointer transition-colors ${
          dragOver
            ? "border-accent/60 bg-accent/10 text-accent"
            : "border-hairline bg-ink/3 text-muted hover:bg-ink/6 hover:text-emph"
        }`}
      >
        {uploadingName
          ? `${t("dd.evidenceUploading", { name: uploadingName })}${uploadPct != null ? ` · ${uploadPct}%` : ""}`
          : `📎 ${t("dd.evidenceDrop")}`}
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
        <p key={err} className="mt-1 text-[11px] text-loss">
          {err}
        </p>
      ))}
      {section.evidence.length > 0 && (
        <>
          <div className="mt-2 grid sm:grid-cols-2 gap-2">
            {section.evidence.map((e) => (
              <EvidenceCard key={e.id} evidence={e} onChanged={onChanged} />
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-muted/60">{t("dd.evidenceReadNote")}</p>
        </>
      )}
    </div>
  );
}

const KIND_ICON: Record<DiligenceEvidence["kind"], string> = {
  image: "🖼",
  pdf: "📄",
  text: "📃",
  file: "📎",
};

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

  // Debounced caption autosave, the notepad-title idiom.
  function queueCaption(v: string) {
    setCaption(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api(`/api/diligence/evidence/${evidence.id}`, {
        method: "PATCH",
        body: JSON.stringify({ caption: v }),
      }).catch(() => {});
    }, 1000);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
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
        <span className="shrink-0 w-16 h-16 rounded-lg bg-ink/5 border border-hairline flex items-center justify-center text-2xl">
          {KIND_ICON[evidence.kind]}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            title={t("dd.evidenceOpen")}
            className="text-[11px] font-medium text-emph hover:text-accent truncate transition-colors"
          >
            {evidence.name}
          </a>
          <span className="shrink-0 text-[9px] text-muted/70 tabular-nums">
            {fmtBytes(evidence.size)}
          </span>
          <button
            onClick={remove}
            disabled={busy}
            title={t("dd.evidenceDelete")}
            className="ml-auto shrink-0 rounded-md px-1 py-0.5 text-[11px] text-muted/60 hover:text-loss transition-colors disabled:opacity-40"
          >
            ✕
          </button>
        </div>
        <input
          value={caption}
          onChange={(e) => queueCaption(e.target.value)}
          placeholder={t("dd.evidenceCaptionPlaceholder")}
          className="mt-1 w-full rounded-md border border-hairline bg-ink/4 px-2 py-1 text-[11px] focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
        />
        <p className="mt-0.5 text-[9px] text-muted/60">{evidence.createdAt.slice(0, 10)}</p>
      </div>
    </div>
  );
}

/**
 * One section's deep-research surface: kick off a pass (with an optional
 * steer), watch it run, and review the resulting memo — accept appends it to
 * the section as a dated editable notepad; dismiss leaves the record untouched.
 */
function ResearchPanel({
  symbol,
  section,
  onChanged,
}: {
  symbol: string;
  section: Section;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useT();
  const [steer, setSteer] = useState("");
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest: DiligenceResearch | undefined = section.research[0];
  const running = latest?.status === "running" ? latest : null;
  const pending = latest?.status === "pending" ? latest : null;
  const failed = latest?.status === "error" ? latest : null;
  const [stopping, setStopping] = useState(false);

  async function stop() {
    if (!running || stopping) return;
    setStopping(true);
    // Best-effort — the next poll reconciles the state either way.
    await api(`/api/diligence/research/${running.id}`, { method: "DELETE" }).catch(() => {});
    await onChanged();
    setStopping(false);
  }

  async function run() {
    if (busy || running) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/diligence/research`, {
        method: "POST",
        body: JSON.stringify({ sectionId: section.id, question: steer }),
      });
      setSteer("");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? localizeError(e.message, t) : t("common.errRunFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: "accept" | "dismiss") {
    if (!pending || deciding) return;
    setDeciding(true);
    setError(null);
    try {
      await api(`/api/diligence/research/${pending.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? localizeError(e.message, t) : t("common.errRequestFailed", { code: "?" }));
    } finally {
      setDeciding(false);
    }
  }

  if (running) {
    return (
      <div className="mt-2 rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 flex items-center gap-3 flex-wrap">
        <p className="text-xs text-accent pulse-soft flex-1 min-w-48">{t("dd.researchRunning")}</p>
        <button
          onClick={stop}
          disabled={stopping}
          title={t("desk.stopHint")}
          className="shrink-0 rounded-lg bg-loss/15 hover:bg-loss/25 disabled:opacity-50 text-loss text-xs font-medium px-3 py-1.5 transition-colors"
        >
          {stopping ? t("dd.deciding") : t("desk.stopResearch")}
        </button>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="mt-2 rounded-2xl border border-warn/30 bg-card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {t("dd.reviewTitle")}
          </span>
          <span className="text-[10px] text-muted">{pending.createdAt.slice(0, 10)}</span>
        </div>
        {pending.insights && (
          <p className="mt-2 text-[12px] text-emph">
            <span className="font-semibold">{t("dd.briefLabel")}:</span> {pending.insights}
          </p>
        )}
        <div className="mt-2 border-t border-hairline pt-2">
          <Markdown>{linkCitations(pending.memo ?? "", pending.sources)}</Markdown>
        </div>
        {error && <p className="mt-2 text-[11px] text-loss">{error}</p>}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => decide("accept")}
            disabled={deciding}
            className="rounded-lg bg-gain/15 text-gain font-semibold text-xs px-3 py-1.5 hover:bg-gain/25 disabled:opacity-50 transition-colors"
          >
            {deciding ? t("dd.deciding") : t("dd.accept")}
          </button>
          <button
            onClick={() => decide("dismiss")}
            disabled={deciding}
            className="rounded-lg bg-ink/6 text-muted font-medium text-xs px-3 py-1.5 hover:bg-ink/10 hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {t("dd.dismiss")}
          </button>
          <span className="text-[10px] text-muted/70">{t("dd.reviewExplainer")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <input
        value={steer}
        onChange={(e) => setSteer(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && run()}
        placeholder={t("dd.researchSteerPlaceholder")}
        className="flex-1 min-w-56 rounded-lg border border-hairline bg-ink/4 px-3 py-1.5 text-xs focus:outline-none focus:border-accent/50"
      />
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg bg-accent/12 hover:bg-accent/20 disabled:opacity-50 text-accent text-xs font-semibold px-3 py-1.5 transition-colors"
      >
        {busy ? t("dd.suggesting") : `✦ ${t("dd.runResearch")}`}
      </button>
      {failed && (
        <span className="text-[11px] text-loss">
          {t("dd.researchFailed", { error: localizeError(failed.error, t) || "—" })}{" "}
          <button onClick={run} className="underline decoration-dotted hover:text-emph transition-colors">
            {t("dd.tryAgain")}
          </button>
        </span>
      )}
      {error && <span className="text-[11px] text-loss">{error}</span>}
    </div>
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-widest text-muted font-semibold flex items-center gap-2">
      {children}
    </h2>
  );
}
