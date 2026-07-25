"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { DeskTabs } from "@/components/DeskTabs";
import { DigestFeed } from "@/components/DigestFeed";
import { Markdown } from "@/components/Markdown";
import { AnnotationRecords } from "@/components/AnnotationRecords";
import { Annotatable, AnnotationsProvider } from "@/components/Annotations";
import { ClipDialog } from "@/components/ClipDialog";
import { PositionCard } from "@/components/PositionCard";
import { useT } from "@/components/PrefsProvider";
import { RunBanner } from "@/components/RunBanner";
import { SignalCard } from "@/components/SignalCard";
import { SignalDetail } from "@/components/SignalDetail";
import { SuggestionCard } from "@/components/SuggestionCard";
import { api, fmtPct, fmtPrice, localizeError, timeAgo } from "@/components/util";
import {
  chipLabel,
  dossierToMarkdown,
  companyDomainsFor,
  linkCitations,
  sourceClass,
  type SourceClass,
} from "@/lib/citations";
import type { TKey } from "@/lib/i18n/dictionaries";
import type { Attachment, DeskPayload, DigestItem, Run, Signal } from "@/lib/types";

/** Localized sourceClassLabel (same keys SignalDetail uses). */
const SRC_CLASS_KEY: Record<SourceClass, TKey> = {
  company: "signals.srcCompany",
  regulator: "signals.srcRegulator",
  independent: "signals.srcIndependent",
};

const STALE_MS = 20 * 3600_000;

export default function DeskPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const { t } = useT();

  const [desk, setDesk] = useState<DeskPayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);
  const chatAbort = useRef<AbortController | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [fullDesk, setFullDesk] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [boardSort, setBoardSort] = useState<"focus" | "stale" | "confidence" | "health">("focus");
  // Undo window: retire/dismiss/swap get one low-friction second chance.
  const [toast, setToast] = useState<{ msg: string; undo: () => void } | null>(null);
  const [clipItem, setClipItem] = useState<DigestItem | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRan = useRef(false);

  const showUndo = useCallback((msg: string, undo: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, undo });
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  }, []);

  // Full-screen analyst desk: Esc exits, page scroll locks underneath.
  useEffect(() => {
    if (!fullDesk) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullDesk(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullDesk]);

  const load = useCallback(async () => {
    try {
      const data = await api<DeskPayload>(`/api/tickers/${encodeURIComponent(symbol)}`);
      setDesk(data);
    } catch {
      setNotFound(true);
    }
  }, [symbol]);

  useEffect(() => {
    load();
  }, [load]);

  const running = desk?.latestRun?.status === "running";

  // Background chat state: a turn started earlier (another tab, or before a
  // reload) may still be running server-side — the analyst keeps thinking in
  // the background. Show the thinking bubble, poll fast until it resolves,
  // and surface the stored failure reason when a background turn died.
  const lastMsg = desk ? desk.messages[desk.messages.length - 1] : undefined;
  const remoteBusy = !sending && !!desk?.analystBusy && lastMsg?.role === "user";
  const bgChatError =
    !sending && !remoteBusy && lastMsg?.role === "user" ? (desk?.analystError ?? null) : null;

  // Poll fast while the agents are working, slowly otherwise.
  useEffect(() => {
    const timer = setInterval(load, running || sending || remoteBusy ? 2500 : 30_000);
    return () => clearInterval(timer);
  }, [load, running, sending, remoteBusy]);

  const startRun = useCallback(async () => {
    try {
      await api<{ run: Run }>(`/api/tickers/${encodeURIComponent(symbol)}/run`, {
        method: "POST",
      });
      load();
    } catch (e) {
      setChatError(e instanceof Error ? localizeError(e.message, t) : t("common.errRunFailed"));
    }
  }, [symbol, load, t]);

  // Stop research: cancel the in-flight run so a fresh one can be started.
  const stopRun = useCallback(async () => {
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/run`, { method: "DELETE" });
    } catch {
      /* best-effort — the next poll reconciles the run state either way */
    }
    load();
  }, [symbol, load]);

  // Daily regeneration: when a set-up desk is opened and its research is stale,
  // run it — unless the global auto-research switch is off (the token lever).
  useEffect(() => {
    if (!desk || autoRan.current) return;
    if (!desk.autoResearch) return;
    const { ticker, active, latestRun } = desk;
    const stale = !ticker.lastRunAt || Date.now() - Date.parse(ticker.lastRunAt) > STALE_MS;
    if (ticker.onboarded && active.length > 0 && latestRun?.status !== "running" && stale) {
      autoRan.current = true;
      startRun();
    }
  }, [desk, startRun]);

  async function sendChat(text: string, attachments: Attachment[] = []) {
    setSending(true);
    setChatError(null);
    // optimistic user bubble (attachment data included so thumbnails render)
    setDesk((d) =>
      d
        ? {
            ...d,
            messages: [
              ...d.messages,
              {
                id: "optimistic",
                symbol,
                role: "user",
                content: text,
                proposalIds: [],
                attachments,
                signalId: null,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : d
    );
    const controller = new AbortController();
    chatAbort.current = controller;
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text, attachments }),
        signal: controller.signal,
      });
    } catch (e) {
      // A pause aborts the fetch — that's the investor's choice, not an error.
      if (!controller.signal.aborted) {
        setChatError(e instanceof Error ? localizeError(e.message, t) : t("common.errChatFailed"));
      }
    } finally {
      chatAbort.current = null;
      setSending(false);
      load();
    }
  }

  // Re-run the analyst on the already-saved conversation (after a failure).
  async function retryChat() {
    setSending(true);
    setChatError(null);
    const controller = new AbortController();
    chatAbort.current = controller;
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/chat`, {
        method: "POST",
        body: JSON.stringify({ retry: true }),
        signal: controller.signal,
      });
    } catch (e) {
      if (!controller.signal.aborted) {
        setChatError(e instanceof Error ? localizeError(e.message, t) : t("common.errChatFailed"));
      }
    } finally {
      chatAbort.current = null;
      setSending(false);
      load();
    }
  }

  // Curate the evidence feed: remove one item (readings keep their citations).
  async function deleteDigest(d: DigestItem) {
    if (!confirm(t("signals.feedRemoveConfirm", { headline: d.headline }))) return;
    // Optimistic: drop it immediately; the next poll reconciles either way.
    setDesk((prev) =>
      prev ? { ...prev, digest: prev.digest.filter((x) => x.id !== d.id) } : prev
    );
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/digest`, {
        method: "DELETE",
        body: JSON.stringify({ id: d.id }),
      });
    } catch {
      load(); // restore on failure
    }
  }

  // Pause: stop waiting locally AND cancel server-side — the in-flight turn's
  // reply is discarded and no desk action is taken.
  async function pauseChat() {
    chatAbort.current?.abort();
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/chat`, { method: "DELETE" });
    } catch {
      /* best-effort — the busy marker goes stale on its own */
    }
    setSending(false);
    load();
  }

  const signalsById = useMemo(() => {
    const m = new Map<string, Signal>();
    if (desk) {
      for (const s of [...desk.active, ...desk.suggested, ...desk.retired, ...(desk.dismissed ?? [])])
        m.set(s.id, s);
    }
    return m;
  }, [desk]);

  async function act(
    id: string,
    action: "approve" | "dismiss" | "retire" | "reactivate" | "swap_back"
  ) {
    const signal = signalsById.get(id);
    setActingId(id);
    try {
      const res = await api<{ onboardedNow?: boolean }>(`/api/signals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setSelected((s) => {
        if (!s.has(id)) return s;
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      await load();
      // One-click second chance on the consequential actions.
      if (signal) {
        if (action === "retire") {
          showUndo(t("desk.toastRetired", { name: signal.name }), () => act(id, "reactivate"));
        } else if (action === "dismiss") {
          showUndo(t("desk.toastDismissed", { name: signal.name }), () => act(id, "reactivate"));
        } else if (action === "approve" && signal.replaces) {
          const oldName =
            signalsById.get(signal.replaces)?.name ?? t("desk.replacedSignalFallback");
          showUndo(t("desk.toastSwapped", { name: signal.name, old: oldName }), () =>
            act(signal.replaces!, "swap_back")
          );
        }
      }
      // First approval activates the desk — kick off the first research run.
      if (res.onboardedNow) {
        autoRan.current = true;
        startRun();
      }
    } finally {
      setActingId(null);
    }
  }

  // Bulk proposal management. Approving a selection is one decisive gesture:
  // the selected proposals activate and every unselected proposal is ignored —
  // the queue resolves in a single click (ignored ones land in the archive,
  // recoverable there or via the Undo toast).
  async function bulkAct(action: "approve" | "dismiss", ids: string[]) {
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await api<{ onboardedNow?: boolean }>(`/api/signals/bulk`, {
        method: "POST",
        body: JSON.stringify({ ids, action }),
      });
      let ignored: string[] = [];
      if (action === "approve") {
        ignored = (desk?.suggested ?? []).map((s) => s.id).filter((id) => !ids.includes(id));
        if (ignored.length > 0) {
          await api(`/api/signals/bulk`, {
            method: "POST",
            body: JSON.stringify({ ids: ignored, action: "dismiss" }),
          });
        }
      }
      setSelected(new Set());
      await load();
      if (ignored.length > 0) {
        showUndo(
          t("desk.toastBulkApproved", { n: ids.length, m: ignored.length }),
          async () => {
            // Undo restores the ignored proposals to the queue; approvals stand.
            for (const id of ignored) {
              await api(`/api/signals/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ action: "reactivate" }),
              }).catch(() => {});
            }
            load();
          }
        );
      }
      if (res.onboardedNow) {
        autoRan.current = true;
        startRun();
      }
    } catch (e) {
      setChatError(e instanceof Error ? localizeError(e.message, t) : t("desk.errBulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  }

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Which retired signals were superseded by a replacement (archive context).
  const replacedBy = useMemo(() => {
    const m = new Map<string, string>();
    if (desk) {
      for (const s of [...desk.active, ...desk.suggested]) {
        if (s.replaces) m.set(s.replaces, s.name);
      }
    }
    return m;
  }, [desk]);

  // Retired signal → its still-ACTIVE replacement (reactivation duplicate guard).
  const activeReplacementOf = useMemo(() => {
    const m = new Map<string, Signal>();
    if (desk) {
      for (const s of desk.active) if (s.replaces) m.set(s.replaces, s);
    }
    return m;
  }, [desk]);

  // Keep-both pairs: two ACTIVE signals linked by `replaces` (the investor
  // reactivated a superseded signal and chose to keep both). The overlap
  // stays visible on both members — the one-time modal choice never fades
  // into silent duplication.
  const overlapPairs = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    if (desk) {
      const byId = new Map(desk.active.map((s) => [s.id, s]));
      for (const s of desk.active) {
        const other = s.replaces ? byId.get(s.replaces) : undefined;
        if (other) {
          m.set(s.id, { id: other.id, name: other.name });
          m.set(other.id, { id: s.id, name: s.name });
        }
      }
    }
    return m;
  }, [desk]);

  // Exact company-source matching: IR-style hosts teach their base domain AND
  // the ticker's own name matches bare corporate domains (fastretailing.com
  // is company-controlled for Fast Retailing, with or without an ir. host).
  const companyDomains = useMemo(() => {
    if (!desk) return [];
    return companyDomainsFor(
      desk.ticker.name,
      [...desk.active, ...desk.retired].flatMap((s) => s.sources ?? [])
    );
  }, [desk]);

  // Flat sorted view of the board (default stays grouped by focus area).
  // Worst-first everywhere: staleness, thin confidence and weak health are
  // what a diligence pass wants surfaced, not buried.
  const sortedActive = useMemo(() => {
    if (!desk || boardSort === "focus") return [];
    const lastFresh = (s: DeskPayload["active"][number]) =>
      s.history.find((h) => h.newEvidence !== false)?.date ?? "";
    const LEVEL_RANK: Record<string, number> = {
      weak: 0,
      deteriorating: 1,
      unclear: 2,
      neutral: 3,
      improving: 4,
      strong: 5,
    };
    const rows = [...desk.active];
    if (boardSort === "stale") rows.sort((a, b) => lastFresh(a).localeCompare(lastFresh(b)));
    if (boardSort === "confidence")
      rows.sort((a, b) => (a.latest?.confidence ?? -1) - (b.latest?.confidence ?? -1));
    if (boardSort === "health")
      rows.sort(
        (a, b) =>
          (a.latest ? LEVEL_RANK[a.latest.level] : -1) - (b.latest ? LEVEL_RANK[b.latest.level] : -1)
      );
    return rows;
  }, [desk, boardSort]);

  // Diligence pulse for the board. Honest numbers only: distinct sources (not
  // per-signal double counts), signals still awaiting their first reading, and
  // confidence averaged over evidence-backed readings — never over priors.
  const boardStats = useMemo(() => {
    if (!desk) return null;
    const withReading = desk.active.filter((s) => s.latest);
    const freshOnes = withReading.filter((s) => s.latest!.newEvidence !== false);
    const carried = withReading.length - freshOnes.length;
    const unread = desk.active.length - withReading.length;
    // Source roster: every distinct URL across the board, who cites it, and
    // whether the company controls it (FOUNDATION evidence discipline —
    // dependence on management's own account must be visible).
    const byUrl = new Map<
      string,
      { url: string; title: string; domain: string; cls: SourceClass; signals: Set<string>; links: number }
    >();
    for (const s of desk.active) {
      for (const src of s.sources ?? []) {
        let row = byUrl.get(src.url);
        if (!row) {
          row = { url: src.url, title: src.title, domain: src.domain, cls: sourceClass(src, companyDomains), signals: new Set(), links: 0 };
          byUrl.set(src.url, row);
        }
        row.signals.add(s.id);
        row.links++;
      }
    }
    const roster = [...byUrl.values()].sort((a, b) => b.links - a.links);
    const links = roster.reduce((a, r) => a + r.links, 0);
    const classLinks: Record<SourceClass, number> = { company: 0, regulator: 0, independent: 0 };
    for (const r of roster) classLinks[r.cls] += r.links;
    const avgConf = freshOnes.length
      ? freshOnes.reduce((a, s) => a + s.latest!.confidence, 0) / freshOnes.length
      : null;
    return {
      total: desk.active.length,
      read: withReading.length,
      fresh: freshOnes.length,
      carried,
      unread,
      distinctSources: roster.length,
      links,
      roster,
      classLinks,
      avgConf,
    };
  }, [desk, companyDomains]);

  const grouped = useMemo(() => {
    if (!desk) return [];
    const order = desk.focusAreas.map((f) => f.title);
    const groups = new Map<string, typeof desk.active>();
    for (const s of desk.active) {
      const key = s.focusArea || t("desk.otherFocusArea");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()].sort(
      (a, b) =>
        (order.indexOf(a[0]) === -1 ? 999 : order.indexOf(a[0])) -
        (order.indexOf(b[0]) === -1 ? 999 : order.indexOf(b[0]))
    );
  }, [desk, t]);

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
  if (!desk) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center text-muted text-sm">
        {t("desk.opening", { symbol })}
      </main>
    );
  }

  const { ticker, quote, latestRun, suggested } = desk;
  const up = (quote?.changePercent ?? 0) >= 0;
  const onboarding = !ticker.onboarded;
  // Signal detail overlay: derived from the live payload so polls keep it
  // fresh. Retired signals open too — read-only, full evidence trail.
  const activeDetail = detailId ? (desk.active.find((s) => s.id === detailId) ?? null) : null;
  const retiredDetail =
    !activeDetail && detailId ? (desk.retired.find((s) => s.id === detailId) ?? null) : null;
  const detailSignal = activeDetail ?? retiredDetail;
  const detailLineage =
    activeDetail?.replaces && desk.retired.some((r) => r.id === activeDetail.replaces)
      ? {
          name: signalsById.get(activeDetail.replaces)?.name ?? t("desk.predecessorFallback"),
          onOpen: () => setDetailId(activeDetail.replaces),
        }
      : null;

  const header = (
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
      {!onboarding && <DeskTabs symbol={symbol} active="signals" />}
      <div className="flex items-center gap-2 ml-auto">
        {quote?.price != null && (
          <>
            <span className="font-semibold tabular-nums">{fmtPrice(quote.price, quote.currency)}</span>
            {quote.currency && quote.currency !== "USD" && quote.fxToUsd != null && (
              <span className="text-[11px] text-muted tabular-nums">
                ≈ {fmtPrice(quote.price * quote.fxToUsd, "USD")}
              </span>
            )}
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums text-chipfg ${up ? "bg-gain" : "bg-loss"}`}
            >
              {fmtPct(quote.changePercent)}
            </span>
          </>
        )}
        {!onboarding && (
          <>
            {running && (
              <button
                onClick={stopRun}
                title={t("desk.stopHint")}
                className="rounded-lg bg-loss/15 hover:bg-loss/25 text-loss text-xs font-medium px-3 py-1.5 transition-colors"
              >
                {t("desk.stopResearch")}
              </button>
            )}
            <button
              onClick={startRun}
              disabled={running}
              className="rounded-lg bg-ink/8 hover:bg-ink/12 disabled:opacity-50 text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {running ? t("desk.researching") : t("desk.runNow")}
            </button>
          </>
        )}
      </div>
    </header>
  );

  if (onboarding) {
    return (
      <AnnotationsProvider symbol={symbol}>
      <main className="mx-auto w-full max-w-3xl px-5 py-8 flex-1 flex flex-col gap-5">
        {header}
        <div className="rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 text-sm">
          <span className="font-semibold">{t("desk.setupTitle")}</span>{" "}
          <span className="text-emph">{t("desk.setupBody", { name: ticker.name })}</span>
        </div>

        {suggested.length > 0 && (
          <section>
            <SectionTitle>
              {t("desk.proposedBoard")}{" "}
              <Badge>{t("desk.awaitingApproval", { n: suggested.length })}</Badge>
            </SectionTitle>
            <BulkBar
              suggested={suggested}
              selected={selected}
              busy={bulkBusy}
              signalsById={signalsById}
              onSelectAll={() => setSelected(new Set(suggested.map((s) => s.id)))}
              onClear={() => setSelected(new Set())}
              onBulk={bulkAct}
            />
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              {suggested.map((s) => (
                <SuggestionCard
                  key={s.id}
                  signal={s}
                  busy={actingId === s.id || bulkBusy}
                  onAct={act}
                  selected={selected.has(s.id)}
                  onToggleSelect={toggleSelect}
                  replacesName={
                    s.replaces ? desk.active.find((a) => a.id === s.replaces)?.name ?? null : null
                  }
                />
              ))}
            </div>
          </section>
        )}

        <div
          className={
            fullDesk
              ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-4 sm:p-6"
              : ""
          }
        >
          {fullDesk && (
            <FullDeskBar
              symbol={ticker.symbol}
              name={ticker.name}
              quote={quote}
              running={running}
              onClose={() => setFullDesk(false)}
            />
          )}
          <div className={fullDesk ? "flex-1 min-h-0 w-full max-w-3xl mx-auto" : ""}>
            <ChatPanel
              messages={desk.messages}
              signalsById={signalsById}
              sending={sending}
              remoteBusy={remoteBusy}
              showLensChips={desk.messages.filter((m) => m.role === "user").length === 0}
              onSend={sendChat}
              onAct={act}
              actingId={actingId}
              error={chatError ?? bgChatError}
              onRetry={retryChat}
              onPause={pauseChat}
              tall={!fullDesk}
              expanded={fullDesk}
              onToggleExpand={() => setFullDesk((v) => !v)}
            />
          </div>
        </div>
      </main>
      </AnnotationsProvider>
    );
  }

  return (
    <AnnotationsProvider symbol={symbol}>
    <main className="mx-auto w-full max-w-6xl px-5 py-8 flex-1">
      {header}

      <div className="mt-5 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        {/* left column */}
        <div className="space-y-5 min-w-0">
          {latestRun && (latestRun.status === "running" || latestRun.status === "error") && (
            <RunBanner run={latestRun} onRetry={startRun} />
          )}

          {desk.position &&
            (desk.position.stock || desk.position.options.length > 0 || desk.position.realized !== 0) && (
              <PositionCard position={desk.position} />
            )}

          {/* The standing thesis — live synthesis of the whole board into a
              business-model + culture statement, updated by each run. */}
          {latestRun?.dossier && (
            <section className="rounded-2xl bg-card border border-accent/20 p-5">
              <div className="flex items-center gap-2">
                <SectionTitle>{t("desk.dossierTitle")}</SectionTitle>
                <button
                  onClick={() => setDossierOpen((v) => !v)}
                  className="ml-auto rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2 py-0.5 text-[10px] text-muted hover:text-emph transition-colors"
                >
                  {dossierOpen ? t("common.collapse") : t("common.expand")}
                </button>
              </div>
              {dossierOpen && (
                <div className="mt-2">
                  <Annotatable surfaceId="dossier">
                    <Markdown onOpenSignal={(id) => signalsById.has(id) && setDetailId(id)}>
                      {dossierToMarkdown(
                        linkCitations(latestRun.dossier, latestRun.sources),
                        (id) => {
                          const s = signalsById.get(id);
                          if (!s) return null;
                          return s.status === "retired"
                            ? t("desk.retiredSuffix", { name: s.name })
                            : s.name;
                        }
                      )}
                    </Markdown>
                  </Annotatable>
                  <p className="mt-3 text-[10px] text-muted/70">
                    {t("desk.dossierProvenance")}
                    {desk.dossierRevisedAt && (
                      <span className="text-muted">
                        {" "}
                        {desk.dossierHeldRuns > 1
                          ? t("desk.dossierRevisedHeld", {
                              when: timeAgo(desk.dossierRevisedAt, t),
                              n: desk.dossierHeldRuns,
                            })
                          : t("desk.dossierRevised", {
                              when: timeAgo(desk.dossierRevisedAt, t),
                            })}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl bg-card border border-hairline p-5">
            <SectionTitle>
              {t("desk.todaysBrief")}
              {latestRun?.finishedAt && (
                <span className="text-[10px] text-muted font-normal normal-case tracking-normal ml-auto">
                  {t("common.updatedAgo", { when: timeAgo(latestRun.finishedAt, t) })}
                </span>
              )}
            </SectionTitle>
            {latestRun?.brief ? (
              <div className="mt-2">
                <Annotatable surfaceId="brief">
                  <Markdown>{linkCitations(latestRun.brief, latestRun.sources)}</Markdown>
                </Annotatable>
              </div>
            ) : (
              <p className="text-muted text-xs italic mt-2">
                {running ? t("desk.briefPreparing") : t("desk.briefNone")}
              </p>
            )}
            {desk.digest.length > 0 && (
              <>
                <div className="border-t border-hairline my-4" />
                <SectionTitle>{t("desk.evidenceFeed")}</SectionTitle>
                <div className="mt-3">
                  <DigestFeed
                    items={desk.digest.slice(0, 10)}
                    signals={[...desk.active, ...desk.retired, ...(desk.dismissed ?? [])]}
                    onOpenSignal={(id) => setDetailId(id)}
                    onDelete={deleteDigest}
                    onClip={(d: DigestItem) => setClipItem(d)}
                    onTrackStory={(d: DigestItem) =>
                      sendChat(
                        t("desk.trackStoryMsg", {
                          headline: d.headline,
                          summary: d.summary,
                          url: d.url ? t("desk.trackStoryUrl", { url: d.url }) : "",
                        })
                      )
                    }
                  />
                </div>
              </>
            )}
          </section>

          {suggested.length > 0 && (
            <section>
              <SectionTitle>
                {t("desk.analystProposals")}{" "}
                <Badge>{t("desk.awaitingYourApproval", { n: suggested.length })}</Badge>
              </SectionTitle>
              <p className="text-[11px] text-muted mt-1">{t("desk.proposalsExplainer")}</p>
              <BulkBar
                suggested={suggested}
                selected={selected}
                busy={bulkBusy}
                signalsById={signalsById}
                onSelectAll={() => setSelected(new Set(suggested.map((s) => s.id)))}
                onClear={() => setSelected(new Set())}
                onBulk={bulkAct}
              />
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                {suggested.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    signal={s}
                    busy={actingId === s.id || bulkBusy}
                    onAct={act}
                    selected={selected.has(s.id)}
                    onToggleSelect={toggleSelect}
                    replacesName={
                      s.replaces ? desk.active.find((a) => a.id === s.replaces)?.name ?? null : null
                    }
                    previouslyDismissedAt={
                      s.dismissedAt ??
                      (desk.dismissed ?? []).find(
                        (x) => x.name.toLowerCase() === s.name.toLowerCase()
                      )?.dismissedAt ??
                      null
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center gap-2 flex-wrap">
              <SectionTitle>{t("desk.signalBoard")}</SectionTitle>
              {desk.active.length >= 4 && (
                <div className="ml-auto flex items-center gap-1 text-[10px]">
                  <span className="text-muted mr-0.5">{t("desk.viewLabel")}</span>
                  {(
                    [
                      { v: "focus", label: t("desk.sortFocus") },
                      { v: "stale", label: t("desk.sortStale") },
                      { v: "confidence", label: t("desk.sortConfidence") },
                      { v: "health", label: t("desk.sortHealth") },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setBoardSort(o.v)}
                      className={`rounded-md px-2 py-0.5 transition-colors ${
                        boardSort === o.v
                          ? "bg-ink/12 text-foreground font-semibold"
                          : "text-muted hover:text-emph bg-ink/4"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {boardStats && boardStats.total > 0 && (
              <p className="mt-1.5 text-[11px] text-muted tabular-nums">
                {t(boardStats.total === 1 ? "desk.statActiveOne" : "desk.statActiveMany", {
                  n: boardStats.total,
                })}
                {boardStats.read > 0 && (
                  <>
                    {" · "}
                    <span className="text-emph">{boardStats.fresh}</span> {t("desk.statMoved")}
                    {" · "}
                    <span className="text-emph">{boardStats.carried}</span> {t("desk.statCarried")}
                  </>
                )}
                {boardStats.unread > 0 && (
                  <>
                    {" · "}
                    <span className="text-warn/90">{boardStats.unread}</span> {t("desk.statUnread")}
                  </>
                )}
                {boardStats.distinctSources > 0 && (
                  <>
                    {" · "}
                    <button
                      onClick={() => setRosterOpen((v) => !v)}
                      className="text-emph hover:text-accent underline decoration-dotted underline-offset-2 transition-colors"
                      title={t("desk.rosterTitle")}
                    >
                      {t("desk.statDistinctSources", { n: boardStats.distinctSources })}{" "}
                      {rosterOpen ? "▾" : "▸"}
                    </button>
                    {boardStats.links !== boardStats.distinctSources && (
                      <span className="text-muted/70">
                        {" "}
                        {t("desk.statSignalLinks", { n: boardStats.links })}
                      </span>
                    )}
                    {boardStats.classLinks.company > 0 && (
                      <span className="text-muted/80">
                        {" "}
                        —{" "}
                        <span className="text-warn/90">
                          {t("desk.statCompanyN", { n: boardStats.classLinks.company })}
                        </span>{" "}
                        ·{" "}
                        {boardStats.classLinks.regulator > 0 && (
                          <>{t("desk.statRegulatorN", { n: boardStats.classLinks.regulator })} · </>
                        )}
                        {t("desk.statIndependentN", { n: boardStats.classLinks.independent })}
                      </span>
                    )}
                  </>
                )}
                {boardStats.avgConf != null && (
                  <>
                    {" · "}
                    {t("desk.statAvgConf")}{" "}
                    <span className="text-emph">{(boardStats.avgConf * 100).toFixed(0)}%</span>
                  </>
                )}
              </p>
            )}
            {rosterOpen && boardStats && boardStats.roster.length > 0 && (
              <div className="mt-2 rounded-xl bg-card border border-hairline px-4 py-3">
                <ul className="space-y-1.5">
                  {boardStats.roster.map((r) => (
                    <li key={r.url} className="flex items-baseline gap-2 text-[11px]">
                      <span
                        className={`shrink-0 rounded px-1 py-px text-[8px] uppercase tracking-wider ${
                          r.cls === "company" ? "bg-warn/12 text-warn/90" : "bg-ink/6 text-muted"
                        }`}
                      >
                        {t(SRC_CLASS_KEY[r.cls])}
                      </span>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        title={r.title}
                        className="text-emph hover:text-accent hover:underline truncate transition-colors"
                      >
                        {chipLabel(r, boardStats.roster)}
                      </a>
                      <span className="ml-auto shrink-0 text-muted tabular-nums">
                        {t(r.signals.size === 1 ? "desk.rosterSignalOne" : "desk.rosterSignalMany", {
                          n: r.signals.size,
                        })}
                        {" · "}
                        {t(r.links === 1 ? "desk.rosterLinkOne" : "desk.rosterLinkMany", {
                          n: r.links,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                {boardStats.classLinks.company * 2 >= boardStats.links && (
                  <p className="mt-2 text-[11px] text-warn/80">
                    {t("desk.companyConcentration", {
                      c: boardStats.classLinks.company,
                      total: boardStats.links,
                    })}
                  </p>
                )}
              </div>
            )}
            {grouped.length === 0 && (
              <p className="text-muted text-xs italic mt-2">{t("desk.noActiveSignals")}</p>
            )}
            {boardSort !== "focus" && sortedActive.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                {sortedActive.map((s) => {
                  const pair = overlapPairs.get(s.id);
                  return (
                    <SignalCard
                      key={s.id}
                      signal={s}
                      onOpen={(sig) => setDetailId(sig.id)}
                      overlapsWith={
                        pair ? { name: pair.name, onOpen: () => setDetailId(pair.id) } : null
                      }
                    />
                  );
                })}
              </div>
            )}
            <div className={`space-y-5 mt-2 ${boardSort !== "focus" ? "hidden" : ""}`}>
              {grouped.map(([area, signals]) => {
                const fa = desk.focusAreas.find((f) => f.title === area);
                return (
                  <div key={area}>
                    <h3 className="text-[11px] uppercase tracking-widest text-muted font-semibold">
                      {area}
                    </h3>
                    {fa?.description && (
                      <p className="text-[11px] text-muted/80 mt-0.5">{fa.description}</p>
                    )}
                    <div className="grid sm:grid-cols-2 gap-3 mt-2">
                      {signals.map((s) => {
                        const pair = overlapPairs.get(s.id);
                        return (
                          <SignalCard
                            key={s.id}
                            signal={s}
                            onOpen={(sig) => setDetailId(sig.id)}
                            overlapsWith={
                              pair ? { name: pair.name, onOpen: () => setDetailId(pair.id) } : null
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Every highlight made anywhere on this ticker, in one reviewable log. */}
          <AnnotationRecords
            digest={desk.digest}
            signals={[...desk.active, ...desk.retired]}
            signalsById={signalsById}
          />

          {/* Nothing on this desk is deleted — retired and dismissed signals
              stay auditable and reversible. */}
          {(desk.retired.length > 0 || (desk.dismissed ?? []).length > 0) && (
            <section>
              <button
                onClick={() => setArchiveOpen((v) => !v)}
                className="flex items-center gap-2 text-left w-full group"
              >
                <SectionTitle>
                  {t("desk.archive")}{" "}
                  <span className="rounded-full bg-ink/6 text-muted px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
                    {t("desk.archiveCounts", {
                      r: desk.retired.length,
                      d: (desk.dismissed ?? []).length,
                    })}
                  </span>
                </SectionTitle>
                <span className="text-muted text-[10px] group-hover:text-emph transition-colors">
                  {archiveOpen ? `▾ ${t("common.hide")}` : `▸ ${t("common.show")}`}
                </span>
              </button>
              {archiveOpen && (
                <div className="mt-2 space-y-2">
                  {desk.retired.map((s) => (
                    <ArchiveRow
                      key={s.id}
                      signal={s}
                      kind="retired"
                      replacedByName={replacedBy.get(s.id) ?? null}
                      busy={actingId === s.id}
                      onReactivate={() => act(s.id, "reactivate")}
                      onOpen={() => setDetailId(s.id)}
                      activeReplacement={activeReplacementOf.get(s.id)?.name ?? null}
                      onSwapBack={() => act(s.id, "swap_back")}
                    />
                  ))}
                  {(desk.dismissed ?? []).map((s) => (
                    <ArchiveRow
                      key={s.id}
                      signal={s}
                      kind="dismissed"
                      replacedByName={null}
                      busy={actingId === s.id}
                      onReactivate={() => act(s.id, "reactivate")}
                      onOpen={null}
                      activeReplacement={null}
                      onSwapBack={null}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* right column: the human-feedback loop. In full-screen mode the same
            wrapper becomes a page-covering overlay — one ChatPanel instance,
            so drafts, board actions and live polling carry over untouched. */}
        <div
          className={
            fullDesk
              ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-4 sm:p-6"
              : "lg:sticky lg:top-6 h-[82vh] min-h-[480px]"
          }
        >
          {fullDesk && (
            <FullDeskBar
              symbol={ticker.symbol}
              name={ticker.name}
              quote={quote}
              running={running}
              onClose={() => setFullDesk(false)}
            />
          )}
          <div className={fullDesk ? "flex-1 min-h-0 w-full max-w-4xl mx-auto" : "h-full"}>
            <ChatPanel
              messages={desk.messages}
              signalsById={signalsById}
              sending={sending}
              remoteBusy={remoteBusy}
              showLensChips={false}
              onSend={sendChat}
              onAct={act}
              actingId={actingId}
              error={chatError ?? bgChatError}
              onRetry={retryChat}
              onPause={pauseChat}
              expanded={fullDesk}
              onToggleExpand={() => setFullDesk((v) => !v)}
              onOpenSignal={(id) => {
                setFullDesk(false);
                setDetailId(id);
              }}
            />
          </div>
        </div>
      </div>

      {detailSignal && (
        <SignalDetail
          signal={detailSignal}
          signalsById={signalsById}
          digest={desk.digest}
          onClose={() => setDetailId(null)}
          onAct={act}
          actingId={actingId}
          onRetire={(id) => {
            setDetailId(null);
            act(id, "retire");
          }}
          readOnly={!!retiredDetail}
          supersededBy={retiredDetail ? (replacedBy.get(retiredDetail.id) ?? null) : null}
          lineage={detailLineage}
          overlapsWith={
            activeDetail && overlapPairs.has(activeDetail.id)
              ? {
                  name: overlapPairs.get(activeDetail.id)!.name,
                  onOpen: () => setDetailId(overlapPairs.get(activeDetail.id)!.id),
                }
              : null
          }
          companyDomains={companyDomains}
        />
      )}

      {/* Clip an evidence item into a notepad on the Notes page */}
      {clipItem && (
        <ClipDialog symbol={symbol} item={clipItem} onClose={() => setClipItem(null)} />
      )}

      {/* Undo window for retire / dismiss / swap */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 rounded-xl bg-card2 border border-ink/15 shadow-2xl shadow-black/60 px-4 py-2.5">
          <span className="text-xs text-emph">{toast.msg}</span>
          <button
            onClick={() => {
              setToast(null);
              toast.undo();
            }}
            className="rounded-lg bg-accent/90 hover:bg-accent text-white text-xs font-semibold px-3 py-1 transition-colors"
          >
            {t("common.undo")}
          </button>
          <button
            onClick={() => setToast(null)}
            aria-label={t("common.dismiss")}
            className="text-muted hover:text-emph text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </main>
    </AnnotationsProvider>
  );
}

/** Ticker context bar shown above the full-screen analyst desk. */
function FullDeskBar({
  symbol,
  name,
  quote,
  running,
  onClose,
}: {
  symbol: string;
  name: string;
  quote: DeskPayload["quote"];
  running: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const up = (quote?.changePercent ?? 0) >= 0;
  return (
    <div className="w-full max-w-4xl mx-auto pb-3 flex items-center gap-3 flex-wrap">
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight">
          {symbol} <span className="text-muted font-normal truncate">{name}</span>
        </p>
      </div>
      {quote?.price != null && (
        <>
          <span className="font-semibold tabular-nums text-sm">
            {fmtPrice(quote.price, quote.currency)}
          </span>
          {quote.currency && quote.currency !== "USD" && quote.fxToUsd != null && (
            <span className="text-[10px] text-muted tabular-nums">
              ≈ {fmtPrice(quote.price * quote.fxToUsd, "USD")}
            </span>
          )}
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums text-chipfg ${up ? "bg-gain" : "bg-loss"}`}
          >
            {fmtPct(quote.changePercent)}
          </span>
        </>
      )}
      {running && (
        <span className="text-[11px] text-accent pulse-soft">{t("desk.researching")}</span>
      )}
      <button
        onClick={onClose}
        className="ml-auto rounded-lg bg-ink/8 hover:bg-ink/12 text-xs font-medium px-3 py-1.5 transition-colors"
      >
        {t("desk.backToBoard")} <span className="text-muted">(Esc)</span>
      </button>
    </div>
  );
}

/** Bulk proposal management: select, select all, approve/ignore the selection. */
function BulkBar({
  suggested,
  selected,
  busy,
  signalsById,
  onSelectAll,
  onClear,
  onBulk,
}: {
  suggested: Signal[];
  selected: Set<string>;
  busy: boolean;
  signalsById: Map<string, Signal>;
  onSelectAll: () => void;
  onClear: () => void;
  onBulk: (action: "approve" | "dismiss", ids: string[]) => void;
}) {
  const { t } = useT();
  const ids = suggested.filter((s) => selected.has(s.id)).map((s) => s.id);
  const allSelected = ids.length === suggested.length && suggested.length > 0;
  const rest = suggested.length - ids.length;
  // Consequence disclosure: name the signals a bulk approval would retire.
  const casualties = suggested
    .filter((s) => selected.has(s.id) && s.replaces)
    .map((s) => signalsById.get(s.replaces!)?.name ?? t("desk.anActiveSignal"));
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
      <button
        onClick={allSelected ? onClear : onSelectAll}
        className="rounded-lg border border-hairline bg-ink/4 hover:bg-ink/8 px-2.5 py-1 font-medium text-emph transition-colors"
      >
        {allSelected ? t("desk.clearSelection") : t("desk.selectAll")}
      </button>
      {ids.length > 0 && (
        <>
          <span className="text-muted">{t("desk.nSelected", { n: ids.length })}</span>
          <button
            onClick={() => onBulk("approve", ids)}
            disabled={busy}
            title={
              rest > 0
                ? t(ids.length === 1 ? "desk.bulkApproveTitleOne" : "desk.bulkApproveTitleMany", {
                    n: ids.length,
                    rest,
                  })
                : t("desk.bulkApproveTitleAll")
            }
            className="rounded-lg bg-gain/15 text-gain font-semibold px-2.5 py-1 hover:bg-gain/25 disabled:opacity-50 transition-colors"
          >
            {busy
              ? t("common.working")
              : rest > 0
                ? t("desk.approveNIgnoreRest", { n: ids.length, rest })
                : t("desk.approveN", { n: ids.length })}
          </button>
          {casualties.length > 0 && (
            <span className="text-warn">
              {t("desk.bulkRetires", {
                names: casualties
                  .slice(0, 2)
                  .map((n) => `“${n}”`)
                  .join(t("desk.listJoiner")),
              })}
              {casualties.length > 2 && t("desk.bulkRetiresMore", { n: casualties.length - 2 })}
            </span>
          )}
          <button
            onClick={() => onBulk("dismiss", ids)}
            disabled={busy}
            className="rounded-lg bg-ink/6 text-muted font-medium px-2.5 py-1 hover:bg-ink/10 hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {t("desk.ignoreN", { n: ids.length })}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * One archived (retired or dismissed) signal — auditable and reversible.
 * Reactivating a superseded signal while its replacement is still active asks
 * whether to swap back (retiring the replacement) or knowingly keep both —
 * the no-duplication rule stays a human choice, never an automatic side effect.
 */
function ArchiveRow({
  signal,
  kind,
  replacedByName,
  busy,
  onReactivate,
  onOpen,
  activeReplacement,
  onSwapBack,
}: {
  signal: Signal;
  kind: "retired" | "dismissed";
  replacedByName: string | null;
  busy: boolean;
  onReactivate: () => void;
  /** Opens the read-only evidence trail (retired signals only). */
  onOpen: (() => void) | null;
  /** Name of the still-active replacement, when one exists. */
  activeReplacement: string | null;
  onSwapBack: (() => void) | null;
}) {
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const needsGuard = kind === "retired" && activeReplacement != null && onSwapBack != null;
  return (
    <div className="rounded-xl bg-card/60 border border-hairline px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <div
        className={`min-w-0 flex-1 ${onOpen ? "cursor-pointer" : ""}`}
        onClick={onOpen ?? undefined}
        role={onOpen ? "button" : undefined}
        title={onOpen ? t("desk.archiveOpenTitle") : undefined}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${onOpen ? "text-emph hover:text-accent transition-colors" : "text-emph"}`}
          >
            {signal.name}
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-px text-[9px] uppercase tracking-wider ${
              kind === "retired" ? "bg-ink/8 text-muted" : "bg-warn/10 text-warn/80"
            }`}
          >
            {t(`common.status_${kind}`)}
          </span>
          {onOpen && (
            <span className="text-[10px] text-muted/60 shrink-0">{t("desk.historyLink")}</span>
          )}
        </div>
        <p className="text-[11px] text-muted truncate mt-0.5">
          {signal.focusArea}
          {replacedByName && (
            <span className="text-warn/80">
              {" · "}
              {t("desk.supersededBy", { name: replacedByName })}
            </span>
          )}
          {!replacedByName && ` · ${signal.thesis}`}
        </p>
      </div>
      {confirming && needsGuard ? (
        <span className="flex items-center gap-1.5 rounded-lg border border-warn/30 bg-warn/8 px-2 py-1 flex-wrap">
          <span className="text-[11px] text-emph">
            {t("desk.guardReplacedActive", { name: activeReplacement })}
          </span>
          <button
            onClick={() => {
              setConfirming(false);
              onSwapBack();
            }}
            disabled={busy}
            className="rounded-md bg-warn/20 hover:bg-warn/30 text-warn text-[11px] font-semibold px-2 py-1 disabled:opacity-50 transition-colors"
          >
            {t("desk.swapBack", { name: activeReplacement })}
          </button>
          <button
            onClick={() => {
              setConfirming(false);
              onReactivate();
            }}
            disabled={busy}
            className="rounded-md bg-ink/6 hover:bg-ink/10 text-[11px] font-medium text-emph px-2 py-1 disabled:opacity-50 transition-colors"
            title={t("desk.keepBothTitle")}
          >
            {t("desk.keepBoth")}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-md text-muted hover:text-emph text-[11px] px-1.5 py-1 transition-colors"
          >
            {t("common.cancel")}
          </button>
        </span>
      ) : (
        <button
          onClick={() => (needsGuard ? setConfirming(true) : onReactivate())}
          disabled={busy}
          title={kind === "retired" ? t("desk.reactivateTitle") : t("desk.restoreTitle")}
          className="shrink-0 rounded-lg bg-ink/6 hover:bg-ink/10 text-[11px] font-medium text-emph px-2.5 py-1.5 disabled:opacity-50 transition-colors"
        >
          {busy ? "…" : kind === "retired" ? t("desk.reactivate") : t("desk.restoreProposal")}
        </button>
      )}
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
      {children}
    </span>
  );
}
