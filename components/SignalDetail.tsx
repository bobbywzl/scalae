"use client";

import { useCallback, useEffect, useState } from "react";
import { domainOf } from "@/lib/citations";
import type { Attachment, ChatMessage, Signal, SignalWithReadings } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
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
          <button
            onClick={() => onRetire(signal.id)}
            className="rounded-lg bg-white/6 hover:bg-white/10 text-muted hover:text-loss text-[11px] font-medium px-2.5 py-1.5 transition-colors"
          >
            Retire signal
          </button>
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
                <div className="flex items-baseline gap-3 flex-wrap">
                  {r.value != null && (
                    <span className="text-2xl font-bold tabular-nums">
                      {r.value.toLocaleString()}{" "}
                      <span className="text-sm text-muted font-normal">{r.valueUnit ?? signal.scale}</span>
                    </span>
                  )}
                  <span className="text-[11px] text-muted">
                    {timeAgo(r.date)} · confidence {(r.confidence * 100).toFixed(0)}%
                  </span>
                </div>
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
                        className="rounded-full border border-hairline bg-white/4 hover:bg-white/10 px-2 py-0.5 text-[10px] text-[#c7c7cc] transition-colors"
                      >
                        {domainOf(c)}
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
              </p>
              <ul className="mt-2 space-y-2">
                {sources.map((src, i) => (
                  <li key={i} className="text-xs leading-snug">
                    <div className="flex items-baseline gap-2">
                      <a href={src.url} target="_blank" rel="noreferrer" className="font-semibold text-accent/90 hover:underline">
                        {src.domain}
                      </a>
                      {src.count > 1 && (
                        <span className="rounded-full bg-white/8 px-1.5 py-px text-[9px] text-muted" title={`Cited in ${src.count} readings`}>
                          ×{src.count}
                        </span>
                      )}
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
              <p className={sectionTitle}>Reading history</p>
              <ul className="mt-2 space-y-2.5">
                {signal.history.map((h) => (
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
                          <a key={i} href={c.url} target="_blank" rel="noreferrer" title={c.title} className="text-accent/90 hover:underline text-[11px]">
                            {domainOf(c)}
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
