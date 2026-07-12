"use client";

import { useCallback, useEffect, useState } from "react";
import { chipLabel } from "@/lib/citations";
import type { Attachment, ChatMessage, Signal, SignalWithReadings } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import { ReadingSparkline, sparkValues } from "./Sparkline";
import { api, DELTA_ARROW, LEVEL_STYLE, timeAgo } from "./util";

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  signalsById,
  onClose,
  onAct,
  actingId,
  onRetire,
}: {
  signal: SignalWithReadings;
  signalsById: Map<string, Signal>;
  onClose: () => void;
  onAct: (id: string, action: "approve" | "dismiss") => void;
  actingId: string | null;
  onRetire: (id: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);
  // Evidence traceability: pick a catalog source to see exactly which readings cited it.
  const [filterUrl, setFilterUrl] = useState<string | null>(null);

  const loadChat = useCallback(async () => {
    try {
      const { messages } = await api<{ messages: ChatMessage[] }>(
        `/api/signals/${signal.id}/chat`
      );
      setMessages(messages);
    } catch {
      /* keep last state */
    }
  }, [signal.id]);

  useEffect(() => {
    // Same initial-fetch-then-poll idiom as the watchlist/desk pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChat();
    const t = setInterval(loadChat, 30_000);
    return () => clearInterval(t);
  }, [loadChat]);

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
    try {
      await api(`/api/signals/${signal.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text, attachments }),
      });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
      loadChat();
    }
  }

  async function retryChat() {
    setSending(true);
    setChatError(null);
    try {
      await api(`/api/signals/${signal.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ retry: true }),
      });
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
      loadChat();
    }
  }

  const r = signal.latest;
  const level = r ? LEVEL_STYLE[r.level] : null;
  const delta = r ? DELTA_ARROW[r.delta] : null;
  const sources = signal.sources ?? [];
  const sectionTitle = "text-[10px] uppercase tracking-wider text-muted font-semibold";

  const spark = signal.type === "quantitative" ? sparkValues(signal.history) : [];
  // When today is a carry-forward, the date fresh evidence last moved this signal.
  const freshSince =
    r?.newEvidence === false
      ? (signal.history.find((h) => h.newEvidence !== false)?.date ?? null)
      : null;
  const filteredHistory = filterUrl
    ? signal.history.filter((h) => h.citations.some((c) => c.url === filterUrl))
    : signal.history;
  const filterDomain = filterUrl ? sources.find((s) => s.url === filterUrl)?.domain : null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-3 sm:p-6">
      {/* Header */}
      <div className="w-full max-w-6xl mx-auto pb-3 flex items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight truncate">{signal.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted mt-0.5">
            {signal.type === "quantitative" ? "# quantitative" : "◆ qualitative"} · {signal.focusArea} ·{" "}
            {signal.symbol}
          </p>
        </div>
        {level && delta && (
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${level.cls}`}>
            {level.label} <span className={delta.cls}>{delta.ch}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {confirmRetire ? (
            <span className="flex items-center gap-1.5 rounded-lg border border-loss/30 bg-loss/8 px-2 py-1">
              <span className="text-[11px] text-[#c7c7cc] hidden sm:inline">
                Stop tracking? It moves to the archive (reversible).
              </span>
              <button
                onClick={() => onRetire(signal.id)}
                className="rounded-md bg-loss/20 hover:bg-loss/30 text-loss text-[11px] font-semibold px-2 py-1 transition-colors"
              >
                Confirm retire
              </button>
              <button
                onClick={() => setConfirmRetire(false)}
                className="rounded-md bg-white/6 hover:bg-white/10 text-muted text-[11px] font-medium px-2 py-1 transition-colors"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmRetire(true)}
              className="rounded-lg bg-white/6 hover:bg-white/10 text-muted hover:text-loss text-[11px] font-medium px-2.5 py-1.5 transition-colors"
            >
              Retire signal
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-white/8 hover:bg-white/12 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            Back to board <span className="text-muted">(Esc)</span>
          </button>
        </div>
      </div>

      {/* Segmented layout: signal world left, scoped analyst desk right */}
      <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_400px] gap-4">
        <div className="overflow-y-auto rounded-2xl bg-card border border-hairline p-5 space-y-5">
          {/* Latest reading hero */}
          <section>
            <p className={sectionTitle}>Latest reading</p>
            {r ? (
              <div className="mt-2">
                <div className="flex items-end gap-3 flex-wrap">
                  {r.value != null && (
                    <span className="text-2xl font-bold tabular-nums">
                      {r.value.toLocaleString()}{" "}
                      <span className="text-sm text-muted font-normal">{r.valueUnit ?? signal.scale}</span>
                    </span>
                  )}
                  {spark.length >= 2 && (
                    <span className="flex items-end gap-2 pb-0.5">
                      <ReadingSparkline values={spark} width={120} height={30} />
                      <span className="text-[10px] text-muted tabular-nums">
                        {Math.min(...spark).toLocaleString()}–{Math.max(...spark).toLocaleString()} over{" "}
                        {spark.length} readings
                      </span>
                    </span>
                  )}
                  <span className="text-[11px] text-muted pb-0.5">
                    {timeAgo(r.date)} · confidence {(r.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {freshSince && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    Carried forward — no new evidence since{" "}
                    <span className="text-[#c7c7cc]">{fmtDay(freshSince)}</span>.
                  </p>
                )}
                <p
                  className={`mt-2 text-sm leading-relaxed ${
                    r.newEvidence === false ? "text-muted italic" : "text-[#e0e0e4]"
                  }`}
                >
                  {r.rationale}
                </p>
                {r.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        title={c.title}
                        className="rounded-full border border-hairline bg-white/4 hover:bg-white/10 px-2 py-0.5 text-[10px] text-[#c7c7cc] transition-colors max-w-[280px] truncate"
                      >
                        {chipLabel(c, r.citations)}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted italic mt-2">Awaiting first research run.</p>
            )}
          </section>

          <section>
            <p className={sectionTitle}>Why we track this</p>
            <p className="mt-1.5 text-xs text-[#c7c7cc] leading-relaxed">{signal.thesis}</p>
          </section>

          <section>
            <p className={sectionTitle}>Measurement plan</p>
            <p className="mt-1.5 text-xs text-[#c7c7cc] leading-relaxed">{signal.measurementPlan}</p>
            {signal.scale && <p className="text-[11px] text-muted mt-1">Scale: {signal.scale}</p>}
          </section>

          {sources.length > 0 && (
            <section>
              <p className={sectionTitle}>
                Evidence catalog · {sources.length} {sources.length === 1 ? "source" : "sources"}
                <span className="normal-case tracking-normal font-normal text-muted/70"> — click ⧉ to trace a source through the readings</span>
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
                      <button
                        onClick={() => setFilterUrl((u) => (u === src.url ? null : src.url))}
                        title={filterUrl === src.url ? "Stop tracing this source" : `Show the ${src.count} reading${src.count === 1 ? "" : "s"} citing this source`}
                        className={`rounded-full px-1.5 py-px text-[9px] transition-colors ${
                          filterUrl === src.url
                            ? "bg-accent/25 text-accent"
                            : "bg-white/8 text-muted hover:bg-white/15 hover:text-[#c7c7cc]"
                        }`}
                      >
                        ⧉ {src.count} {src.count === 1 ? "reading" : "readings"}
                      </button>
                      <span className="text-[10px] text-muted/70 ml-auto shrink-0">
                        {fmtDay(src.firstSeen)}
                        {src.lastSeen !== src.firstSeen && ` → ${fmtDay(src.lastSeen)}`}
                      </span>
                    </div>
                    <a href={src.url} target="_blank" rel="noreferrer" className="block text-[#b5b5ba] hover:text-white mt-0.5">
                      {src.title.length > 100 ? src.title.slice(0, 100) + "…" : src.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {signal.history.length > 0 && (
            <section>
              <p className={sectionTitle}>
                Reading history
                {filterUrl && (
                  <span className="normal-case tracking-normal font-normal">
                    {" "}
                    <span className="text-accent">
                      · {filteredHistory.length} of {signal.history.length} citing {filterDomain ?? "this source"}
                    </span>{" "}
                    <button onClick={() => setFilterUrl(null)} className="text-muted hover:text-[#c7c7cc] underline underline-offset-2">
                      clear
                    </button>
                  </span>
                )}
              </p>
              <ul className="mt-2 space-y-2.5">
                {filteredHistory.map((h) => (
                  <li key={h.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted tabular-nums">{h.date.slice(0, 10)}</span>
                      <span className={`rounded px-1.5 py-px text-[10px] font-medium ${LEVEL_STYLE[h.level].cls}`}>
                        {LEVEL_STYLE[h.level].label}
                      </span>
                      {h.value != null && (
                        <span className="tabular-nums">
                          {h.value.toLocaleString()} {h.valueUnit ?? ""}
                        </span>
                      )}
                      <span className="text-[10px] text-muted/70">conf {(h.confidence * 100).toFixed(0)}%</span>
                      {h.newEvidence === false && (
                        <span className="text-[9px] uppercase tracking-wider text-muted/60 border border-hairline rounded px-1 py-px">
                          carry-forward
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 leading-relaxed ${h.newEvidence === false ? "text-muted/70 italic" : "text-[#a8a8ad]"}`}>
                      {h.rationale}
                    </p>
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
        <div className="min-h-[320px] lg:min-h-0">
          <ChatPanel
            title="Signal desk"
            messages={messages}
            signalsById={signalsById}
            sending={sending}
            showLensChips={false}
            onSend={send}
            onAct={onAct}
            actingId={actingId}
            error={chatError}
            onRetry={retryChat}
            emptyHint={`This thread is scoped to “${signal.name}” — the analyst has its thesis, full reading history and evidence catalog in front of it. Ask why the reading moved, challenge the measurement plan, or ask for a sharper replacement signal. (The ticker-level desk keeps the global picture.)`}
          />
        </div>
      </div>
    </div>
  );
}
