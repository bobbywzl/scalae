"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Signal } from "@/lib/types";
import { Markdown } from "./Markdown";
import { SuggestionCard } from "./SuggestionCard";

const LENS_CHIPS = [
  "Moat durability",
  "Management candor",
  "Capital allocation",
  "Owner earnings",
  "Culture & trust",
  "Red flags",
  "Not sure — suggest questions",
];

export function ChatPanel({
  messages,
  signalsById,
  sending,
  showLensChips,
  onSend,
  onAct,
  actingId,
  error,
  onRetry,
  tall = false,
}: {
  messages: ChatMessage[];
  signalsById: Map<string, Signal>;
  sending: boolean;
  showLensChips: boolean;
  onSend: (text: string) => void;
  onAct: (id: string, action: "approve" | "dismiss") => void;
  actingId: string | null;
  error: string | null;
  onRetry: () => void;
  tall?: boolean;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  function submit() {
    const t = text.trim();
    if (!t || sending) return;
    setText("");
    onSend(t);
  }

  // A user message with no analyst reply (e.g. after a failed call + reload).
  const stranded =
    !sending && !error && messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <div className={`flex flex-col rounded-2xl bg-card border border-hairline overflow-hidden ${tall ? "h-[70vh]" : "h-full"}`}>
      <div className="px-4 py-3 border-b border-hairline flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-gain" />
        <p className="text-sm font-semibold">Analyst desk</p>
        <p className="text-[10px] text-muted ml-auto">your feedback steers tomorrow’s research</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-accent text-white px-3.5 py-2.5 text-sm whitespace-pre-wrap"
                  : "max-w-[92%] rounded-2xl rounded-bl-md bg-card2 px-3.5 py-2.5"
              }
            >
              {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content}
              {m.role === "assistant" && m.proposalIds.length > 0 && (
                <div className="mt-3 space-y-2">
                  {m.proposalIds.map((id) => {
                    const s = signalsById.get(id);
                    if (!s) return null;
                    if (s.status === "suggested") {
                      return (
                        <SuggestionCard
                          key={id}
                          signal={s}
                          busy={actingId === id}
                          onAct={onAct}
                          compact
                        />
                      );
                    }
                    return (
                      <div
                        key={id}
                        className="rounded-lg bg-white/4 border border-hairline px-3 py-2 text-xs flex items-center justify-between"
                      >
                        <span className="font-medium">{s.name}</span>
                        <span
                          className={
                            s.status === "active"
                              ? "text-gain text-[11px]"
                              : "text-muted text-[11px]"
                          }
                        >
                          {s.status === "active" ? "✓ active" : s.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-card2 px-3.5 py-2.5 text-sm text-muted pulse-soft">
              Analyst is thinking…
            </div>
          </div>
        )}
        {error && !sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-loss/30 bg-loss/8 px-3.5 py-2.5 text-xs max-w-[92%]">
              <p className="text-loss font-medium">{error}</p>
              <button
                onClick={onRetry}
                className="mt-2 rounded-lg bg-white/8 hover:bg-white/12 px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {stranded && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-card2 px-3.5 py-2.5 text-xs max-w-[92%]">
              <p className="text-muted">The analyst hasn’t replied to your last message.</p>
              <button
                onClick={onRetry}
                className="mt-2 rounded-lg bg-accent/90 hover:bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition-colors"
              >
                Ask the analyst to respond
              </button>
            </div>
          </div>
        )}
      </div>

      {showLensChips && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {LENS_CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setText((t) => (t ? t + " " + c : c))}
              className="rounded-full border border-hairline bg-white/4 hover:bg-white/8 px-2.5 py-1 text-[11px] text-[#c7c7cc] transition-colors"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-hairline">
        <div className="flex items-end gap-2 rounded-xl bg-card2 border border-hairline focus-within:border-accent/50 px-3 py-2 transition-colors">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={Math.min(4, Math.max(1, text.split("\n").length))}
            placeholder="Tell your analyst what to focus on…"
            className="flex-1 bg-transparent outline-none resize-none text-sm placeholder:text-muted/60 leading-relaxed"
          />
          <button
            onClick={submit}
            disabled={sending || !text.trim()}
            className="shrink-0 rounded-lg bg-accent disabled:bg-white/10 disabled:text-muted text-white text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
