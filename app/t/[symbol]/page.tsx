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
import { linkCitations } from "@/lib/citations";
import type { Attachment, DeskPayload, Run, Signal } from "@/lib/types";

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
  const autoRan = useRef(false);

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

  async function act(id: string, action: "approve" | "dismiss" | "retire" | "reactivate") {
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

  const signalsById = useMemo(() => {
    const m = new Map<string, Signal>();
    if (desk) {
      for (const s of [...desk.active, ...desk.suggested, ...desk.retired, ...(desk.dismissed ?? [])])
        m.set(s.id, s);
    }
    return m;
  }, [desk]);

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

  // Diligence pulse for the board: how much of today's picture moved on fresh
  // evidence vs. carried forward, and how deep the evidence base runs.
  const boardStats = useMemo(() => {
    if (!desk) return null;
    const withReading = desk.active.filter((s) => s.latest);
    const fresh = withReading.filter((s) => s.latest!.newEvidence !== false).length;
    const carried = withReading.length - fresh;
    const sourceCount = desk.active.reduce((a, s) => a + (s.sources?.length ?? 0), 0);
    const avgConf = withReading.length
      ? withReading.reduce((a, s) => a + s.latest!.confidence, 0) / withReading.length
      : null;
    return { total: desk.active.length, read: withReading.length, fresh, carried, sourceCount, avgConf };
  }, [desk]);

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
  // Signal detail overlay: derived from the live payload so polls keep it fresh.
  const detailSignal = detailId ? (desk.active.find((s) => s.id === detailId) ?? null) : null;

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
                  <Markdown>{linkCitations(latestRun.dossier, latestRun.sources)}</Markdown>
                  <p className="mt-3 text-[10px] text-muted/70">
                    Standing view synthesized from the signal board — evolves only when evidence
                    moves it, unlike the daily brief below.
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

          <section>
            <SectionTitle>Signal board</SectionTitle>
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
                {boardStats.sourceCount > 0 && (
                  <>
                    {" · "}
                    <span className="text-[#c7c7cc]">{boardStats.sourceCount}</span> sources in catalog
                  </>
                )}
                {boardStats.avgConf != null && (
                  <> · avg confidence <span className="text-[#c7c7cc]">{(boardStats.avgConf * 100).toFixed(0)}%</span></>
                )}
              </p>
            )}
            {grouped.length === 0 && (
              <p className="text-muted text-xs italic mt-2">No active signals.</p>
            )}
            <div className="space-y-5 mt-2">
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
                      {signals.map((s) => (
                        <SignalCard key={s.id} signal={s} onOpen={(sig) => setDetailId(sig.id)} />
                      ))}
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
        />
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
  onSelectAll,
  onClear,
  onBulk,
}: {
  suggested: Signal[];
  selected: Set<string>;
  busy: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onBulk: (action: "approve" | "dismiss", ids: string[]) => void;
}) {
  const ids = suggested.filter((s) => selected.has(s.id)).map((s) => s.id);
  const allSelected = ids.length === suggested.length && suggested.length > 0;
  // Consequence disclosure: bulk-approving swaps retires the replaced signals.
  const swaps = suggested.filter((s) => selected.has(s.id) && s.replaces).length;
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
          {swaps > 0 && (
            <span className="text-warn">
              ⇄ {swaps} of these replace{swaps === 1 ? "s" : ""} an active signal — approving retires{" "}
              {swaps === 1 ? "it" : "them"}
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

/** One archived (retired or dismissed) signal — auditable and reversible. */
function ArchiveRow({
  signal,
  kind,
  replacedByName,
  busy,
  onReactivate,
}: {
  signal: Signal;
  kind: "retired" | "dismissed";
  replacedByName: string | null;
  busy: boolean;
  onReactivate: () => void;
}) {
  return (
    <div className="rounded-xl bg-card/60 border border-hairline px-4 py-2.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#c7c7cc] truncate">{signal.name}</span>
          <span
            className={`shrink-0 rounded px-1.5 py-px text-[9px] uppercase tracking-wider ${
              kind === "retired" ? "bg-white/8 text-muted" : "bg-warn/10 text-warn/80"
            }`}
          >
            {kind}
          </span>
        </div>
        <p className="text-[11px] text-muted truncate mt-0.5">
          {signal.focusArea}
          {replacedByName && (
            <span className="text-warn/80"> · superseded by “{replacedByName}”</span>
          )}
          {!replacedByName && ` · ${signal.thesis}`}
        </p>
      </div>
      <button
        onClick={onReactivate}
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
