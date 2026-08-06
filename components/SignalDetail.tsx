"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chipLabel, linkCitations, sourceClass, type SourceClass } from "@/lib/citations";
import type { TKey } from "@/lib/i18n/dictionaries";
import type {
  Attachment,
  ChatMessage,
  Citation,
  DigestItem,
  ReadingLevel,
  Signal,
  SignalWithReadings,
} from "@/lib/types";
import { Annotatable } from "./Annotations";
import { ChatPanel } from "./ChatPanel";
import { ClipDialog, type ClipPayload } from "./ClipDialog";
import { Markdown } from "./Markdown";
import { useT } from "@/components/PrefsProvider";
import { SigKeyBadge } from "./SignalCard";
import { ReadingSparkline, sparkValues } from "./Sparkline";
import { api, DELTA_ARROW, IMPACT_DOT, LEVEL_STYLE, levelLabel, localizeError, timeAgo } from "./util";

const fmtDay = (iso: string, locale: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString(locale, { month: "short", day: "numeric" });
};

/** Source-class chip label / tooltip keys (translated sourceClassLabel). */
const SRC_CLASS_KEY: Record<SourceClass, TKey> = {
  company: "signals.srcCompany",
  regulator: "signals.srcRegulator",
  independent: "signals.srcIndependent",
};
const SRC_CLASS_TITLE_KEY: Record<SourceClass, TKey> = {
  company: "signals.srcCompanyTitle",
  regulator: "signals.srcRegulatorTitle",
  independent: "signals.srcIndependentTitle",
};

/**
 * Full-screen segmented view for one signal: reading hero, thesis, plan,
 * evidence catalog and history on the left — and a dedicated Analyst desk on
 * the right, scoped to this signal (its own thread; the analyst's context is
 * this signal's readings + evidence, while the ticker desk keeps the global
 * picture).
 */
export function SignalDetail({
  signal,
  sKey = null,
  signalsById,
  digest = [],
  onClose,
  onAct,
  actingId,
  onRetire,
  readOnly = false,
  supersededBy = null,
  lineage = null,
  overlapsWith = null,
  companyDomains = [],
  check = null,
}: {
  signal: SignalWithReadings;
  /** Board key (S1, S2, …) — the key research prose cites this signal by. */
  sKey?: string | null;
  signalsById: Map<string, Signal>;
  /** The desk's evidence feed — catalog entries import their descriptions from it. */
  digest?: DigestItem[];
  onClose: () => void;
  onAct: (id: string, action: "approve" | "dismiss") => void;
  actingId: string | null;
  onRetire: (id: string) => void;
  /** Archive mode for retired signals: full evidence trail, no chat/retire. */
  readOnly?: boolean;
  /** Name of the active signal that replaced this one (read-only mode). */
  supersededBy?: string | null;
  /** For an active replacement: its retired predecessor, openable. */
  lineage?: { name: string; onOpen: () => void } | null;
  /** Keep-both pair: the other active signal this one overlaps with. */
  overlapsWith?: { name: string; onOpen: () => void } | null;
  /** The ticker's learned company-controlled domains (exact source classing). */
  companyDomains?: string[];
  /** Single-signal check: run/stop this signal's own research, with live state. */
  check?: {
    checking: boolean;
    stage: string | null;
    error: string | null;
    note: { text: string; at: string } | null;
    disabled: boolean;
    run: () => void;
    stop: () => void;
  } | null;
}) {
  const { t, locale } = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  // Server-side turn state for THIS signal's thread: the analyst keeps
  // thinking in the background across close/reopen; failures store a reason.
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const chatAbort = useRef<AbortController | null>(null);
  const [clipItem, setClipItem] = useState<ClipPayload | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);
  // Evidence traceability: pick a catalog source to see exactly which readings cited it.
  const [filterUrl, setFilterUrl] = useState<string | null>(null);
  // Deep-history backstory: freshly researched result overrides the (polled) prop.
  const [histLocal, setHistLocal] = useState<{
    backstory: string;
    sources: Citation[];
    backstoryAt: string;
  } | null>(null);
  const [histBusy, setHistBusy] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  useEffect(() => {
    // Switching signals drops the previous signal's freshly-researched override.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistLocal(null);
    setHistError(null);
  }, [signal.id]);

  async function researchHistory() {
    if (histBusy) return;
    setHistBusy(true);
    setHistError(null);
    try {
      const result = await api<{ backstory: string; sources: Citation[]; backstoryAt: string }>(
        `/api/signals/${signal.id}/history`,
        { method: "POST" }
      );
      setHistLocal(result);
    } catch (e) {
      setHistError(e instanceof Error ? e.message : "History research failed — try again.");
    } finally {
      setHistBusy(false);
    }
  }

  const loadChat = useCallback(async () => {
    try {
      const { messages, analystBusy, analystError } = await api<{
        messages: ChatMessage[];
        analystBusy?: boolean;
        analystError?: string | null;
      }>(`/api/signals/${signal.id}/chat`);
      setMessages(messages);
      const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";
      setRemoteBusy(analystBusy === true && lastIsUser);
      setBgError(!analystBusy && lastIsUser && analystError?.trim() ? analystError : null);
    } catch {
      /* keep last state */
    }
  }, [signal.id]);

  useEffect(() => {
    if (readOnly) return; // archive view: no chat thread to load
    // Same initial-fetch-then-poll idiom as the watchlist/desk pages —
    // fast while a background turn is running, slow otherwise.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChat();
    const timer = setInterval(loadChat, remoteBusy ? 2500 : 30_000);
    return () => clearInterval(timer);
  }, [loadChat, readOnly, remoteBusy]);

  // Esc closes; page scroll locks underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function send(text: string, attachments: Attachment[]) {
    setSending(true);
    setChatError(null);
    setMessages((m) => [
      ...m,
      {
        id: "optimistic",
        symbol: signal.symbol,
        role: "user",
        content: text,
        proposalIds: [],
        attachments,
        signalId: signal.id,
        createdAt: new Date().toISOString(),
      },
    ]);
    const controller = new AbortController();
    chatAbort.current = controller;
    try {
      await api(`/api/signals/${signal.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text, attachments }),
        signal: controller.signal,
      });
    } catch (e) {
      if (!controller.signal.aborted) setChatError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      chatAbort.current = null;
      setSending(false);
      loadChat();
    }
  }

  async function retryChat() {
    setSending(true);
    setChatError(null);
    const controller = new AbortController();
    chatAbort.current = controller;
    try {
      await api(`/api/signals/${signal.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ retry: true }),
        signal: controller.signal,
      });
    } catch (e) {
      if (!controller.signal.aborted) setChatError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      chatAbort.current = null;
      setSending(false);
      loadChat();
    }
  }

  // Pause the in-flight turn: abort locally, discard server-side.
  async function pauseChat() {
    chatAbort.current?.abort();
    try {
      await api(`/api/signals/${signal.id}/chat`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
    setSending(false);
    setRemoteBusy(false);
    loadChat();
  }

  const r = signal.latest;
  const level = r ? LEVEL_STYLE[r.level] : null;
  const delta = r ? DELTA_ARROW[r.delta] : null;
  const sources = signal.sources ?? [];

  // Evidence catalog enrichment: each source imports its DESCRIPTION from the
  // evidence feed (headline, summary, impact, the desk's source note) and its
  // IMPLICATION for this signal from the most recent reading that cited it —
  // the analyst's doctrine-anchored judgment, not a bare link list.
  const digestByUrl = useMemo(() => {
    const m = new Map<string, DigestItem>();
    for (const d of digest) {
      if (d.url && !m.has(d.url)) m.set(d.url, d); // newest first in the feed
    }
    return m;
  }, [digest]);
  const implicationByUrl = useMemo(() => {
    const m = new Map<string, { date: string; level: ReadingLevel; rationale: string }>();
    for (const h of signal.history) {
      // history is newest-first: the first hit per source is the latest word.
      for (const c of h.citations) {
        if (c.url && !m.has(c.url) && h.rationale) {
          m.set(c.url, { date: h.date, level: h.level, rationale: h.rationale });
        }
      }
    }
    return m;
  }, [signal.history]);
  const clipText = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const sectionTitle = "text-[10px] uppercase tracking-wider text-muted font-semibold";

  const spark = signal.type === "quantitative" ? sparkValues(signal.history) : [];
  // When today is a carry-forward, the date fresh evidence last moved this signal —
  // and the honest third state: it has NEVER moved on evidence.
  const neverFresh =
    r?.newEvidence === false && !signal.history.some((h) => h.newEvidence !== false);
  const freshSince =
    r?.newEvidence === false && !neverFresh
      ? (signal.history.find((h) => h.newEvidence !== false)?.date ?? null)
      : null;
  const filteredHistory = filterUrl
    ? signal.history.filter((h) => h.citations.some((c) => c.url === filterUrl))
    : signal.history;
  const tracedSource = filterUrl ? (sources.find((s) => s.url === filterUrl) ?? null) : null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-3 sm:p-6">
      {/* Header */}
      <div className="w-full max-w-6xl mx-auto pb-3 flex items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {sKey && <SigKeyBadge sKey={sKey} />}
            <p className="text-base font-bold leading-tight truncate">{signal.name}</p>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
            {signal.type === "quantitative" ? t("signals.typeQuantitative") : t("signals.typeQualitative")} ·{" "}
            {signal.focusArea} · {signal.symbol}
          </p>
        </div>
        {r && level && delta && (
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${level.cls}`}>
            {levelLabel(r.level, t)} <span className={delta.cls}>{delta.ch}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Run research on just this signal — the board pipeline, scoped. */}
          {check &&
            (check.checking ? (
              <span className="flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/8 px-2.5 py-1.5 min-w-0">
                <span className="text-[11px] text-accent pulse-soft truncate max-w-[280px]">
                  {check.stage || t("desk.signalCheckingShort")}
                </span>
                <button
                  onClick={check.stop}
                  title={t("desk.stopHint")}
                  className="shrink-0 rounded-md bg-loss/15 hover:bg-loss/25 text-loss text-[10px] font-medium px-2 py-0.5 transition-colors"
                >
                  {t("desk.stopResearch")}
                </button>
              </span>
            ) : (
              <button
                onClick={check.run}
                disabled={check.disabled}
                title={check.disabled ? t("desk.signalCheckBusy") : undefined}
                className="rounded-lg border border-accent/25 bg-accent/8 hover:bg-accent/15 disabled:opacity-40 text-accent text-[11px] font-semibold px-2.5 py-1.5 transition-colors"
              >
                {t("desk.runSignal")}
              </button>
            ))}
          {readOnly ? (
            <span className="rounded-lg border border-hairline bg-ink/4 px-2.5 py-1.5 text-[11px] text-muted">
              {t("signals.retiredBadge")}
              {supersededBy && (
                <span className="text-warn/80"> · {t("signals.supersededBy", { name: supersededBy })}</span>
              )}
            </span>
          ) : confirmRetire ? (
            <span className="flex items-center gap-1.5 rounded-lg border border-loss/30 bg-loss/8 px-2 py-1">
              <span className="text-[11px] text-emph hidden sm:inline">
                {t("signals.retireConfirmText")}
              </span>
              <button
                onClick={() => onRetire(signal.id)}
                className="rounded-md bg-loss/20 hover:bg-loss/30 text-loss text-[11px] font-semibold px-2 py-1 transition-colors"
              >
                {t("signals.confirmRetire")}
              </button>
              <button
                onClick={() => setConfirmRetire(false)}
                className="rounded-md bg-ink/6 hover:bg-ink/10 text-muted text-[11px] font-medium px-2 py-1 transition-colors"
              >
                {t("common.cancel")}
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmRetire(true)}
              className="rounded-lg bg-ink/6 hover:bg-ink/10 text-muted hover:text-loss text-[11px] font-medium px-2.5 py-1.5 transition-colors"
            >
              {t("signals.retireSignal")}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-ink/8 hover:bg-ink/12 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            {t("signals.backToBoard")} <span className="text-muted">(Esc)</span>
          </button>
        </div>
      </div>

      {/* Segmented layout: signal world left, scoped analyst desk right
          (archive mode drops the desk — the record speaks for itself) */}
      <div
        className={`flex-1 min-h-0 w-full mx-auto grid gap-4 ${
          readOnly ? "max-w-4xl" : "max-w-6xl lg:grid-cols-[minmax(0,1fr)_400px]"
        }`}
      >
        <div className="overflow-y-auto rounded-2xl bg-card border border-hairline p-5 space-y-5">
          {/* Single-signal check: last failure (with retry) and the last check's note. */}
          {check?.error && (
            <p className="text-xs text-loss">
              {t("desk.signalCheckFailed", { error: localizeError(check.error, t) || "—" })}{" "}
              <button
                onClick={check.run}
                disabled={check.disabled}
                className="underline decoration-dotted hover:text-emph disabled:opacity-50 transition-colors"
              >
                {t("dd.tryAgain")}
              </button>
            </p>
          )}
          {check?.note && (
            <div className="rounded-xl border border-accent/20 bg-accent/6 px-3.5 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                {t("desk.signalCheckNote")}
                <span className="normal-case tracking-normal font-normal text-muted/70">
                  {" "}
                  · {timeAgo(check.note.at, t)}
                </span>
              </p>
              <div className="mt-1">
                <Markdown>{check.note.text}</Markdown>
              </div>
            </div>
          )}

          {/* Latest reading hero */}
          <section>
            <p className={sectionTitle}>{t("signals.latestReading")}</p>
            {r ? (
              <div className="mt-2">
                <div className="flex items-end gap-3 flex-wrap">
                  {r.value != null && (
                    <span className="text-2xl font-bold tabular-nums">
                      {r.value.toLocaleString(locale)}{" "}
                      <span className="text-sm text-muted font-normal">{r.valueUnit ?? signal.scale}</span>
                    </span>
                  )}
                  {spark.length >= 2 && (
                    <span className="flex items-end gap-2 pb-0.5">
                      <ReadingSparkline values={spark} width={120} height={30} />
                      <span className="text-[10px] text-muted tabular-nums">
                        {t("signals.rangeOverReadings", {
                          min: Math.min(...spark).toLocaleString(locale),
                          max: Math.max(...spark).toLocaleString(locale),
                          n: spark.length,
                        })}
                      </span>
                    </span>
                  )}
                  <span className="text-[11px] text-muted pb-0.5">
                    {timeAgo(r.date, t)} · {t("signals.confidencePct", { pct: (r.confidence * 100).toFixed(0) })}
                    {neverFresh && ` ${t("signals.priorNoEvidence")}`}
                  </span>
                </div>
                {neverFresh && (
                  <p className="mt-1.5 text-[11px] text-warn/90">
                    {t(signal.history.length === 1 ? "signals.neverFreshOne" : "signals.neverFreshMany", {
                      n: signal.history.length,
                    })}
                  </p>
                )}
                {freshSince && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    {t("signals.carriedSincePre")}
                    <span className="text-emph">{fmtDay(freshSince, locale)}</span>
                    {t("signals.carriedSincePost")}
                  </p>
                )}
                <Annotatable surfaceId={`reading:${r.id}`}>
                  <p
                    className={`mt-2 text-sm leading-relaxed ${
                      r.newEvidence === false ? "text-muted italic" : "text-emph"
                    }`}
                  >
                    {r.rationale}
                  </p>
                </Annotatable>
                {r.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        title={c.title}
                        className="rounded-full border border-hairline bg-ink/4 hover:bg-ink/10 px-2 py-0.5 text-[10px] text-emph transition-colors max-w-[280px] truncate"
                      >
                        {chipLabel(c, r.citations)}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted italic mt-2">{t("signals.awaitingFirstRun")}</p>
            )}
          </section>

          {lineage && (
            <button
              onClick={lineage.onOpen}
              className="w-full text-left rounded-lg border border-hairline bg-ink/4 hover:bg-ink/8 px-3 py-2 text-[11px] text-emph transition-colors"
            >
              {t("signals.replacedPrefix")}
              <span className="font-semibold">“{lineage.name}”</span>
              <span className="text-accent">{t("signals.viewItsHistory")}</span>
            </button>
          )}

          {overlapsWith && (
            <button
              onClick={overlapsWith.onOpen}
              title={t("signals.overlapKeptDetailTitle")}
              className="w-full text-left rounded-lg border border-warn/25 bg-warn/8 hover:bg-warn/12 px-3 py-2 text-[11px] text-warn transition-colors"
            >
              {t("signals.keptAlongsidePre")}
              <span className="font-semibold">“{overlapsWith.name}”</span>
              <span className="opacity-80">{t("signals.keptAlongsidePost")}</span>
            </button>
          )}

          <section>
            <p className={sectionTitle}>{t("signals.whyWeTrack")}</p>
            <Annotatable surfaceId={`signal:${signal.id}:thesis`}>
              <p className="mt-1.5 text-xs text-emph leading-relaxed">{signal.thesis}</p>
            </Annotatable>
          </section>

          <section>
            <p className={sectionTitle}>{t("signals.measurementPlan")}</p>
            <p className="mt-1.5 text-xs text-emph leading-relaxed">{signal.measurementPlan}</p>
            {signal.scale && (
              <p className="text-[11px] text-muted mt-1">{t("signals.scaleLabel", { scale: signal.scale })}</p>
            )}
          </section>

          {/* Deep history: the base rate — decades of record + stress episodes */}
          {(() => {
            const backstory = histLocal?.backstory ?? signal.backstory ?? null;
            const bSources = histLocal?.sources ?? signal.backstorySources ?? [];
            const bAt = histLocal?.backstoryAt ?? signal.backstoryAt ?? null;
            return (
              <section>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={sectionTitle}>
                    {t("signals.deepHistory")}
                    <span className="normal-case tracking-normal font-normal text-muted/70">
                      {t("signals.deepHistorySub")}
                    </span>
                  </p>
                  {!readOnly && (
                    <button
                      onClick={researchHistory}
                      disabled={histBusy}
                      title={t("signals.historyBtnTitle")}
                      className="ml-auto rounded-md bg-ink/6 hover:bg-ink/10 text-[10px] font-medium text-muted hover:text-emph px-2 py-1 disabled:opacity-50 transition-colors"
                    >
                      {histBusy
                        ? t("signals.researchingBusy")
                        : backstory
                          ? t("signals.refreshHistory")
                          : t("signals.researchHistory")}
                    </button>
                  )}
                </div>
                {histError && <p className="mt-1.5 text-[11px] text-loss">{localizeError(histError, t)}</p>}
                {histBusy && !backstory && (
                  <p className="mt-1.5 text-[11px] text-muted pulse-soft">
                    {t("signals.historyTracing")}
                  </p>
                )}
                {backstory ? (
                  <div className="mt-2 text-xs">
                    <Annotatable surfaceId={`signal:${signal.id}:backstory`}>
                      <Markdown>{linkCitations(backstory, bSources)}</Markdown>
                    </Annotatable>
                    {bAt && (
                      <p className="mt-1.5 text-[10px] text-muted/60">
                        {t("signals.researchedAgo", { when: timeAgo(bAt, t) })} ·{" "}
                        {t(bSources.length === 1 ? "signals.sourcesOne" : "signals.sourcesMany", {
                          n: bSources.length,
                        })}{" "}
                        · {t("signals.informsBaseRate")}
                      </p>
                    )}
                  </div>
                ) : (
                  !histBusy && (
                    <p className="mt-1.5 text-[11px] text-muted italic">
                      {readOnly ? t("signals.notResearchedRO") : t("signals.notResearched")}
                    </p>
                  )
                )}
              </section>
            );
          })()}

          {sources.length > 0 && (
            <section>
              <p className={sectionTitle}>
                {t("signals.evidenceCatalog")} ·{" "}
                {t(sources.length === 1 ? "signals.sourcesOne" : "signals.sourcesMany", { n: sources.length })}
                <span className="normal-case tracking-normal font-normal text-muted/70">
                  {t("signals.traceHint")}
                </span>
              </p>
              <ul className="mt-2 space-y-2">
                {sources.map((src, i) => (
                  <li
                    key={i}
                    className={`text-xs leading-snug rounded-lg -mx-1.5 px-1.5 py-1 transition-colors ${
                      filterUrl === src.url ? "bg-accent/10 border border-accent/30" : "border border-transparent"
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <a href={src.url} target="_blank" rel="noreferrer" className="font-semibold text-accent/90 hover:underline">
                        {src.domain}
                      </a>
                      <span
                        className={`shrink-0 rounded px-1 py-px text-[8px] uppercase tracking-wider ${
                          sourceClass(src, companyDomains) === "company"
                            ? "bg-warn/12 text-warn/90"
                            : "bg-ink/6 text-muted"
                        }`}
                        title={t(SRC_CLASS_TITLE_KEY[sourceClass(src, companyDomains)])}
                      >
                        {t(SRC_CLASS_KEY[sourceClass(src, companyDomains)])}
                      </span>
                      <button
                        onClick={() => setFilterUrl((u) => (u === src.url ? null : src.url))}
                        title={
                          filterUrl === src.url
                            ? t("signals.stopTracing")
                            : t(src.count === 1 ? "signals.showCitingOne" : "signals.showCitingMany", {
                                n: src.count,
                              })
                        }
                        className={`rounded-full px-1.5 py-px text-[9px] transition-colors ${
                          filterUrl === src.url
                            ? "bg-accent/25 text-accent"
                            : "bg-ink/8 text-muted hover:bg-ink/15 hover:text-emph"
                        }`}
                      >
                        ⧉ {t(src.count === 1 ? "signals.readingsOne" : "signals.readingsMany", { n: src.count })}
                      </button>
                      <span className="text-[10px] text-muted/70 ml-auto shrink-0">
                        {fmtDay(src.firstSeen, locale)}
                        {src.lastSeen !== src.firstSeen && ` → ${fmtDay(src.lastSeen, locale)}`}
                      </span>
                    </div>
                    {src.title && src.title !== src.domain && (
                      <a href={src.url} target="_blank" rel="noreferrer" className="block text-[#b5b5ba] hover:text-white mt-0.5">
                        {src.title.length > 100 ? src.title.slice(0, 100) + "…" : src.title}
                      </a>
                    )}
                    {(() => {
                      const d = digestByUrl.get(src.url);
                      const imp = implicationByUrl.get(src.url);
                      if (!d && !imp) return null;
                      return (
                        <div className="mt-1 space-y-1">
                          {d && (
                            <p className="text-[11px] leading-snug">
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle ${IMPACT_DOT[d.impact]}`}
                              />
                              <span className="font-medium text-emph">{d.headline}</span>
                              {d.summary && (
                                <span className="text-muted"> — {clipText(d.summary, 200)}</span>
                              )}
                            </p>
                          )}
                          {d?.sourceNote && (
                            <p className="text-[10px] text-muted/90 leading-snug">☞ {d.sourceNote}</p>
                          )}
                          {imp && (
                            <p className="text-[11px] text-[#b5b5ba] leading-snug">
                              <span className="text-accent/85 font-medium">
                                {t("signals.srcImplication", {
                                  date: fmtDay(imp.date, locale),
                                  level: levelLabel(imp.level, t),
                                })}
                                :
                              </span>{" "}
                              {clipText(imp.rationale, 220)}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {signal.history.length > 0 && (
            <section>
              <p className={sectionTitle}>
                {t("signals.readingHistory")}
                {filterUrl && (
                  <span className="normal-case tracking-normal font-normal">
                    {" "}
                    <span className="text-accent">
                      {t("signals.citingCount", {
                        shown: filteredHistory.length,
                        total: signal.history.length,
                        src: tracedSource ? chipLabel(tracedSource, sources) : t("signals.thisSource"),
                      })}
                      {tracedSource && (
                        <span className="text-muted">
                          {t("signals.srcClassParen", {
                            label: t(SRC_CLASS_KEY[sourceClass(tracedSource, companyDomains)]),
                          })}
                        </span>
                      )}
                    </span>{" "}
                    <button onClick={() => setFilterUrl(null)} className="text-muted hover:text-emph underline underline-offset-2">
                      {t("signals.clearFilter")}
                    </button>
                  </span>
                )}
              </p>
              {tracedSource && filteredHistory.length < tracedSource.count && (
                <p className="mt-1 text-[11px] text-muted">
                  {filteredHistory.length === 0
                    ? t(tracedSource.count === 1 ? "signals.tracedNoneOne" : "signals.tracedNoneMany", {
                        total: signal.history.length,
                        count: tracedSource.count,
                      })
                    : t("signals.tracedSome", {
                        shown: filteredHistory.length,
                        count: tracedSource.count,
                        total: signal.history.length,
                      })}
                </p>
              )}
              <ul className="mt-2 space-y-2.5">
                {filteredHistory.map((h) => (
                  <li key={h.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted tabular-nums">{h.date.slice(0, 10)}</span>
                      <span className={`rounded px-1.5 py-px text-[10px] font-medium ${LEVEL_STYLE[h.level].cls}`}>
                        {levelLabel(h.level, t)}
                      </span>
                      {h.value != null && (
                        <span className="tabular-nums">
                          {h.value.toLocaleString(locale)} {h.valueUnit ?? ""}
                        </span>
                      )}
                      <span className="text-[10px] text-muted/70">
                        {t("signals.confShort", { pct: (h.confidence * 100).toFixed(0) })}
                      </span>
                      {h.newEvidence === false && (
                        <span className="text-[9px] uppercase tracking-wider text-muted/60 border border-hairline rounded px-1 py-px">
                          {t("signals.carryForward")}
                        </span>
                      )}
                      <button
                        onClick={() =>
                          setClipItem({
                            headline: `“${signal.name}” — ${levelLabel(h.level, t)}${
                              h.value != null ? `, ${h.value.toLocaleString(locale)} ${h.valueUnit ?? ""}` : ""
                            } (${h.date.slice(0, 10)})`,
                            summary: h.rationale,
                            url: h.citations[0]?.url ?? null,
                            source: h.citations[0]?.title ?? null,
                            date: h.date,
                            signalNames: [signal.name],
                          })
                        }
                        title={t("notes.clipTitle")}
                        className="ml-auto shrink-0 rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-1.5 py-px text-[10px] text-emph hover:text-accent transition-colors"
                      >
                        {t("notes.clipAction")}
                      </button>
                    </div>
                    <Annotatable surfaceId={`reading:${h.id}`}>
                      <p className={`mt-0.5 leading-relaxed ${h.newEvidence === false ? "text-muted/70 italic" : "text-[#a8a8ad]"}`}>
                        {h.rationale}
                      </p>
                    </Annotatable>
                    {h.citations.length > 0 && (
                      <p className="mt-0.5 space-x-2">
                        {h.citations.map((c, i) => (
                          <a
                            key={i}
                            href={c.url}
                            target="_blank"
                            rel="noreferrer"
                            title={c.title}
                            className={`hover:underline text-[11px] ${
                              filterUrl === c.url ? "text-accent font-semibold" : "text-accent/90"
                            }`}
                          >
                            {chipLabel(c, h.citations)}
                          </a>
                        ))}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Signal-scoped analyst desk */}
        {!readOnly && (
        <div className="min-h-[320px] lg:min-h-0">
          <ChatPanel
            title={t("signals.signalDesk")}
            messages={messages}
            signalsById={signalsById}
            sending={sending}
            remoteBusy={remoteBusy}
            showLensChips={false}
            onSend={send}
            onAct={onAct}
            actingId={actingId}
            error={chatError ?? bgError ? localizeError((chatError ?? bgError)!, t) : null}
            onRetry={retryChat}
            onPause={pauseChat}
            emptyHint={t("signals.signalDeskHint", { name: signal.name })}
          />
        </div>
        )}
      </div>

      {/* Clip a reading into a notepad on the Notes page */}
      {clipItem && (
        <ClipDialog symbol={signal.symbol} item={clipItem} onClose={() => setClipItem(null)} />
      )}
    </div>
  );
}
