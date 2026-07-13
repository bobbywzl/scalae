"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/ChatPanel";
import { DigestFeed } from "@/components/DigestFeed";
import { Markdown } from "@/components/Markdown";
import { PositionCard } from "@/components/PositionCard";
import { RunBanner } from "@/components/RunBanner";
import { SignalCard } from "@/components/SignalCard";
import { SignalDetail } from "@/components/SignalDetail";
import { SuggestionCard } from "@/components/SuggestionCard";
import { api, fmtPct, fmtPrice, timeAgo } from "@/components/util";
import {
  chipLabel,
  dossierToMarkdown,
  companyDomainsFor,
  linkCitations,
  sourceClass,
  sourceClassLabel,
  type SourceClass,
} from "@/lib/citations";
import type { Attachment, DeskPayload, DigestItem, Run, Signal } from "@/lib/types";

const STALE_MS = 20 * 3600_000;

export default function DeskPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = decodeURIComponent(params.symbol).toUpperCase();

  const [desk, setDesk] = useState<DeskPayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);
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

  // Poll fast while the agents are working, slowly otherwise.
  useEffect(() => {
    const t = setInterval(load, running || sending ? 2500 : 30_000);
    return () => clearInterval(t);
  }, [load, running, sending]);

  const startRun = useCallback(async () => {
    try {
      await api<{ run: Run }>(`/api/tickers/${encodeURIComponent(symbol)}/run`, {
        method: "POST",
      });
      load();
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Failed to start run");
    }
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
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text, attachments }),
      });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
      load();
    }
  }

  // Re-run the analyst on the already-saved conversation (after a failure).
  async function retryChat() {
    setSending(true);
    setChatError(null);
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/chat`, {
        method: "POST",
        body: JSON.stringify({ retry: true }),
      });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
      load();
    }
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
          showUndo(`Retired “${signal.name}”`, () => act(id, "reactivate"));
        } else if (action === "dismiss") {
          showUndo(`Dismissed “${signal.name}” — it moved to the archive`, () =>
            act(id, "reactivate")
          );
        } else if (action === "approve" && signal.replaces) {
          const oldName = signalsById.get(signal.replaces)?.name ?? "the replaced signal";
          showUndo(`Swapped in “${signal.name}” — retired “${oldName}”`, () =>
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

  // Bulk proposal management: approve or ignore the whole selection at once.
  async function bulkAct(action: "approve" | "dismiss", ids: string[]) {
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await api<{ onboardedNow?: boolean }>(`/api/signals/bulk`, {
        method: "POST",
        body: JSON.stringify({ ids, action }),
      });
      setSelected(new Set());
      await load();
      if (res.onboardedNow) {
        autoRan.current = true;
        startRun();
      }
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Bulk action failed");
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
      const key = s.focusArea || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()].sort(
      (a, b) =>
        (order.indexOf(a[0]) === -1 ? 999 : order.indexOf(a[0])) -
        (order.indexOf(b[0]) === -1 ? 999 : order.indexOf(b[0]))
    );
  }, [desk]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="text-lg font-medium">Desk not found</p>
        <Link href="/" className="text-accent text-sm mt-2 inline-block">
          ← Back to watchlist
        </Link>
      </main>
    );
  }
  if (!desk) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center text-muted text-sm">
        Opening the {symbol} desk…
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
          name: signalsById.get(activeDetail.replaces)?.name ?? "its predecessor",
          onOpen: () => setDetailId(activeDetail.replaces),
        }
      : null;

  const header = (
    <header className="flex items-center gap-4 flex-wrap">
      <Link
        href="/"
        className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity"
      >
        ‹ Watchlist
      </Link>
      <div className="min-w-0">
        <h1 className="text-xl font-bold leading-tight">{ticker.symbol}</h1>
        <p className="text-muted text-xs truncate">{ticker.name}</p>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {quote?.price != null && (
          <>
            <span className="font-semibold tabular-nums">{fmtPrice(quote.price, quote.currency)}</span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums text-black ${up ? "bg-gain" : "bg-loss"}`}
            >
              {fmtPct(quote.changePercent)}
            </span>
          </>
        )}
        {!onboarding && (
          <button
            onClick={startRun}
            disabled={running}
            className="rounded-lg bg-white/8 hover:bg-white/12 disabled:opacity-50 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            {running ? "Researching…" : "Run research now"}
          </button>
        )}
      </div>
    </header>
  );

  if (onboarding) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-8 flex-1 flex flex-col gap-5">
        {header}
        <div className="rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 text-sm">
          <span className="font-semibold">Desk setup.</span>{" "}
          <span className="text-[#c7c7cc]">
            Tell the analyst what you want to understand about {ticker.name}. It will propose focus
            areas and trackable signals — approve the ones you want, and the first research run
            starts automatically.
          </span>
        </div>

        {suggested.length > 0 && (
          <section>
            <SectionTitle>
              Proposed signal board <Badge>{suggested.length} awaiting approval</Badge>
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
              showLensChips={desk.messages.filter((m) => m.role === "user").length === 0}
              onSend={sendChat}
              onAct={act}
              actingId={actingId}
              error={chatError}
              onRetry={retryChat}
              tall={!fullDesk}
              expanded={fullDesk}
              onToggleExpand={() => setFullDesk((v) => !v)}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
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
                <SectionTitle>The business, as the desk reads it</SectionTitle>
                <button
                  onClick={() => setDossierOpen((v) => !v)}
                  className="ml-auto rounded-md border border-hairline bg-white/4 hover:bg-white/10 px-2 py-0.5 text-[10px] text-muted hover:text-[#c7c7cc] transition-colors"
                >
                  {dossierOpen ? "Collapse" : "Expand"}
                </button>
              </div>
              {dossierOpen && (
                <div className="mt-2">
                  <Markdown onOpenSignal={(id) => signalsById.has(id) && setDetailId(id)}>
                    {dossierToMarkdown(
                      linkCitations(latestRun.dossier, latestRun.sources),
                      (id) => {
                        const s = signalsById.get(id);
                        if (!s) return null;
                        return s.status === "retired" ? `${s.name} (retired)` : s.name;
                      }
                    )}
                  </Markdown>
                  <p className="mt-3 text-[10px] text-muted/70">
                    Standing view synthesized from the signal board — evolves only when evidence
                    moves it, unlike the daily brief below.
                    {desk.dossierRevisedAt && (
                      <span className="text-muted">
                        {" "}
                        Last revised {timeAgo(desk.dossierRevisedAt)}
                        {desk.dossierHeldRuns > 1 && ` · held for ${desk.dossierHeldRuns} runs`}.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl bg-card border border-hairline p-5">
            <SectionTitle>
              Today’s brief
              {latestRun?.finishedAt && (
                <span className="text-[10px] text-muted font-normal normal-case tracking-normal ml-auto">
                  updated {timeAgo(latestRun.finishedAt)}
                </span>
              )}
            </SectionTitle>
            {latestRun?.brief ? (
              <div className="mt-2">
                <Markdown>{linkCitations(latestRun.brief, latestRun.sources)}</Markdown>
              </div>
            ) : (
              <p className="text-muted text-xs italic mt-2">
                {running
                  ? "The desk is preparing its first brief…"
                  : "No brief yet — run today’s research."}
              </p>
            )}
            {desk.digest.length > 0 && (
              <>
                <div className="border-t border-hairline my-4" />
                <SectionTitle>Evidence feed</SectionTitle>
                <div className="mt-3">
                  <DigestFeed
                    items={desk.digest.slice(0, 10)}
                    signals={[...desk.active, ...desk.retired, ...(desk.dismissed ?? [])]}
                    onOpenSignal={(id) => setDetailId(id)}
                    onTrackStory={(d: DigestItem) =>
                      sendChat(
                        `No signal on the board watches this thread — draft a trackable signal from it (I'll approve or ignore): "${d.headline}" — ${d.summary}${d.url ? ` (${d.url})` : ""}. Anchor it to the business model or culture, give it a measurement plan, and set "replaces" if it subsumes an active signal.`
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
                Analyst proposals <Badge>{suggested.length} awaiting your approval</Badge>
              </SectionTitle>
              <p className="text-[11px] text-muted mt-1">
                The desk rediscovers candidate signals as the story evolves — nothing is tracked
                without your sign-off. Proposals marked ⇄ replace an active signal on approval.
              </p>
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
              <SectionTitle>Signal board</SectionTitle>
              {desk.active.length >= 4 && (
                <div className="ml-auto flex items-center gap-1 text-[10px]">
                  <span className="text-muted mr-0.5">view:</span>
                  {(
                    [
                      { v: "focus", label: "Focus areas" },
                      { v: "stale", label: "Stalest first" },
                      { v: "confidence", label: "Thinnest confidence" },
                      { v: "health", label: "Weakest first" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setBoardSort(o.v)}
                      className={`rounded-md px-2 py-0.5 transition-colors ${
                        boardSort === o.v
                          ? "bg-white/12 text-foreground font-semibold"
                          : "text-muted hover:text-[#c7c7cc] bg-white/4"
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
                {boardStats.total} active signal{boardStats.total === 1 ? "" : "s"}
                {boardStats.read > 0 && (
                  <>
                    {" · "}
                    <span className="text-[#c7c7cc]">{boardStats.fresh}</span> moved on new evidence
                    {" · "}
                    <span className="text-[#c7c7cc]">{boardStats.carried}</span> carried forward
                  </>
                )}
                {boardStats.unread > 0 && (
                  <>
                    {" · "}
                    <span className="text-warn/90">{boardStats.unread}</span> awaiting first reading
                  </>
                )}
                {boardStats.distinctSources > 0 && (
                  <>
                    {" · "}
                    <button
                      onClick={() => setRosterOpen((v) => !v)}
                      className="text-[#c7c7cc] hover:text-accent underline decoration-dotted underline-offset-2 transition-colors"
                      title="Show the board's full source roster"
                    >
                      {boardStats.distinctSources} distinct sources {rosterOpen ? "▾" : "▸"}
                    </button>
                    {boardStats.links !== boardStats.distinctSources && (
                      <span className="text-muted/70"> ({boardStats.links} signal links)</span>
                    )}
                    {boardStats.classLinks.company > 0 && (
                      <span className="text-muted/80">
                        {" "}
                        — <span className="text-warn/90">{boardStats.classLinks.company} company</span> ·{" "}
                        {boardStats.classLinks.regulator > 0 && (
                          <>{boardStats.classLinks.regulator} regulator · </>
                        )}
                        {boardStats.classLinks.independent} independent
                      </span>
                    )}
                  </>
                )}
                {boardStats.avgConf != null && (
                  <>
                    {" · "}avg confidence (fresh){" "}
                    <span className="text-[#c7c7cc]">{(boardStats.avgConf * 100).toFixed(0)}%</span>
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
                          r.cls === "company" ? "bg-warn/12 text-warn/90" : "bg-white/6 text-muted"
                        }`}
                      >
                        {sourceClassLabel(r.cls)}
                      </span>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        title={r.title}
                        className="text-[#c7c7cc] hover:text-accent hover:underline truncate transition-colors"
                      >
                        {chipLabel(r, boardStats.roster)}
                      </a>
                      <span className="ml-auto shrink-0 text-muted tabular-nums">
                        {r.signals.size} signal{r.signals.size === 1 ? "" : "s"} · {r.links} link
                        {r.links === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
                {boardStats.classLinks.company * 2 >= boardStats.links && (
                  <p className="mt-2 text-[11px] text-warn/80">
                    {boardStats.classLinks.company} of {boardStats.links} evidence links come from
                    company-controlled sources — corroborate independently.
                  </p>
                )}
              </div>
            )}
            {grouped.length === 0 && (
              <p className="text-muted text-xs italic mt-2">No active signals.</p>
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

          {/* Nothing on this desk is deleted — retired and dismissed signals
              stay auditable and reversible. */}
          {(desk.retired.length > 0 || (desk.dismissed ?? []).length > 0) && (
            <section>
              <button
                onClick={() => setArchiveOpen((v) => !v)}
                className="flex items-center gap-2 text-left w-full group"
              >
                <SectionTitle>
                  Archive{" "}
                  <span className="rounded-full bg-white/6 text-muted px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
                    {desk.retired.length} retired · {(desk.dismissed ?? []).length} dismissed
                  </span>
                </SectionTitle>
                <span className="text-muted text-[10px] group-hover:text-[#c7c7cc] transition-colors">
                  {archiveOpen ? "▾ hide" : "▸ show"}
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
              showLensChips={false}
              onSend={sendChat}
              onAct={act}
              actingId={actingId}
              error={chatError}
              onRetry={retryChat}
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

      {/* Undo window for retire / dismiss / swap */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 rounded-xl bg-card2 border border-white/15 shadow-2xl shadow-black/60 px-4 py-2.5">
          <span className="text-xs text-[#e0e0e4]">{toast.msg}</span>
          <button
            onClick={() => {
              setToast(null);
              toast.undo();
            }}
            className="rounded-lg bg-accent/90 hover:bg-accent text-white text-xs font-semibold px-3 py-1 transition-colors"
          >
            Undo
          </button>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="text-muted hover:text-[#c7c7cc] text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      )}
    </main>
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
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums text-black ${up ? "bg-gain" : "bg-loss"}`}
          >
            {fmtPct(quote.changePercent)}
          </span>
        </>
      )}
      {running && <span className="text-[11px] text-accent pulse-soft">Researching…</span>}
      <button
        onClick={onClose}
        className="ml-auto rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium px-3 py-1.5 transition-colors"
      >
        Back to board <span className="text-muted">(Esc)</span>
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
  const ids = suggested.filter((s) => selected.has(s.id)).map((s) => s.id);
  const allSelected = ids.length === suggested.length && suggested.length > 0;
  // Consequence disclosure: name the signals a bulk approval would retire.
  const casualties = suggested
    .filter((s) => selected.has(s.id) && s.replaces)
    .map((s) => signalsById.get(s.replaces!)?.name ?? "an active signal");
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
      <button
        onClick={allSelected ? onClear : onSelectAll}
        className="rounded-lg border border-hairline bg-white/4 hover:bg-white/8 px-2.5 py-1 font-medium text-[#c7c7cc] transition-colors"
      >
        {allSelected ? "Clear selection" : "Select all"}
      </button>
      {ids.length > 0 && (
        <>
          <span className="text-muted">{ids.length} selected</span>
          <button
            onClick={() => onBulk("approve", ids)}
            disabled={busy}
            className="rounded-lg bg-gain/15 text-gain font-semibold px-2.5 py-1 hover:bg-gain/25 disabled:opacity-50 transition-colors"
          >
            {busy ? "Working…" : `Approve ${ids.length}`}
          </button>
          {casualties.length > 0 && (
            <span className="text-warn">
              ⇄ approving retires{" "}
              {casualties
                .slice(0, 2)
                .map((n) => `“${n}”`)
                .join(", ")}
              {casualties.length > 2 && ` +${casualties.length - 2} more`}
            </span>
          )}
          <button
            onClick={() => onBulk("dismiss", ids)}
            disabled={busy}
            className="rounded-lg bg-white/6 text-muted font-medium px-2.5 py-1 hover:bg-white/10 hover:text-foreground disabled:opacity-50 transition-colors"
          >
            Ignore {ids.length}
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
  const [confirming, setConfirming] = useState(false);
  const needsGuard = kind === "retired" && activeReplacement != null && onSwapBack != null;
  return (
    <div className="rounded-xl bg-card/60 border border-hairline px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <div
        className={`min-w-0 flex-1 ${onOpen ? "cursor-pointer" : ""}`}
        onClick={onOpen ?? undefined}
        role={onOpen ? "button" : undefined}
        title={onOpen ? "View this signal's full evidence trail (read-only)" : undefined}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${onOpen ? "text-[#c7c7cc] hover:text-accent transition-colors" : "text-[#c7c7cc]"}`}
          >
            {signal.name}
          </span>
          <span
            className={`shrink-0 rounded px-1.5 py-px text-[9px] uppercase tracking-wider ${
              kind === "retired" ? "bg-white/8 text-muted" : "bg-warn/10 text-warn/80"
            }`}
          >
            {kind}
          </span>
          {onOpen && <span className="text-[10px] text-muted/60 shrink-0">history ⤢</span>}
        </div>
        <p className="text-[11px] text-muted truncate mt-0.5">
          {signal.focusArea}
          {replacedByName && (
            <span className="text-warn/80"> · superseded by “{replacedByName}”</span>
          )}
          {!replacedByName && ` · ${signal.thesis}`}
        </p>
      </div>
      {confirming && needsGuard ? (
        <span className="flex items-center gap-1.5 rounded-lg border border-warn/30 bg-warn/8 px-2 py-1 flex-wrap">
          <span className="text-[11px] text-[#c7c7cc]">
            “{activeReplacement}” replaced this signal and is still active:
          </span>
          <button
            onClick={() => {
              setConfirming(false);
              onSwapBack();
            }}
            disabled={busy}
            className="rounded-md bg-warn/20 hover:bg-warn/30 text-warn text-[11px] font-semibold px-2 py-1 disabled:opacity-50 transition-colors"
          >
            Swap back — retires “{activeReplacement}”
          </button>
          <button
            onClick={() => {
              setConfirming(false);
              onReactivate();
            }}
            disabled={busy}
            className="rounded-md bg-white/6 hover:bg-white/10 text-[11px] font-medium text-[#c7c7cc] px-2 py-1 disabled:opacity-50 transition-colors"
            title="Both signals will be active — watch for overlap"
          >
            Keep both anyway
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-md text-muted hover:text-[#c7c7cc] text-[11px] px-1.5 py-1 transition-colors"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => (needsGuard ? setConfirming(true) : onReactivate())}
          disabled={busy}
          title={
            kind === "retired"
              ? "Return this signal to the active board"
              : "Return this proposal to the approval queue"
          }
          className="shrink-0 rounded-lg bg-white/6 hover:bg-white/10 text-[11px] font-medium text-[#c7c7cc] px-2.5 py-1.5 disabled:opacity-50 transition-colors"
        >
          {busy ? "…" : kind === "retired" ? "Reactivate" : "Restore proposal"}
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
