"use client";

import { useEffect, useRef, useState } from "react";
import type { Attachment, ChatMessage, Signal } from "@/lib/types";
import type { TFunc } from "@/lib/i18n/dictionaries";
import { Annotatable } from "./Annotations";
import { useT } from "./PrefsProvider";
import { localizeError } from "./util";
import { Markdown } from "./Markdown";
import { SuggestionCard } from "./SuggestionCard";
// Attachment processing lives in components/attach.ts (shared with /support).
import { MAX_FILES, fmtBytes, processFile } from "./attach";
// Read-aloud: the natural-voice reader (network/neural voice picker) — the
// browser-default voice sounds robotic. See lib/voice.ts.
import { speak, speechSynthesisSupported, stopSpeaking, voiceLangTag } from "@/lib/voice";

const LENS_CHIP_KEYS = [
  "chat.lensMoat",
  "chat.lensCandor",
  "chat.lensCapital",
  "chat.lensOwnerEarnings",
  "chat.lensCulture",
  "chat.lensRedFlags",
  "chat.lensSuggest",
] as const;

/**
 * attach.ts throws canonical English messages (it is a plain module shared
 * with /support, no hook access) — map the known shapes to the UI language,
 * then fall through to the shared server-error localizer.
 */
function localizeAttachError(msg: string, t: TFunc): string {
  let m = msg.match(/^(.+) is (.+) — PDFs up to (.+) only\.$/);
  if (m) return t("chat.pdfTooLarge", { name: m[1], size: m[2], max: m[3] });
  m = msg.match(/^(.+) is (.+) — text files up to (.+) only\.$/);
  if (m) return t("chat.textTooLarge", { name: m[1], size: m[2], max: m[3] });
  m = msg.match(/^Could not read (.+)$/);
  if (m) return t("chat.fileUnreadable", { name: m[1] });
  if (msg === "Not a readable image") return t("chat.notReadableImage");
  return localizeError(msg, t);
}

// ---------------------------------------------------------------------------
// Voice dictation (Web Speech API) — minimal structural types, since the DOM
// lib doesn't ship SpeechRecognition everywhere.
// ---------------------------------------------------------------------------

type SRResultList = {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
};
interface SREvent {
  resultIndex: number;
  results: SRResultList;
}
interface SRLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
}

function speechRecognitionCtor(): (new () => SRLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SRLike;
    webkitSpeechRecognition?: new () => SRLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function AttachmentChip({
  a,
  onRemove,
}: {
  a: Attachment;
  onRemove?: () => void;
}) {
  const { t } = useT();
  const icon = a.kind === "image" ? "🖼" : a.kind === "pdf" ? "📄" : "📝";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-ink/5 px-2 py-1 text-[11px] text-emph max-w-[220px]">
      {a.kind === "image" && a.data ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:${a.mediaType};base64,${a.data}`}
          alt={a.name}
          className="h-5 w-5 rounded object-cover shrink-0"
        />
      ) : (
        <span aria-hidden>{icon}</span>
      )}
      <span className="truncate">{a.name}</span>
      {a.size > 0 && <span className="text-muted shrink-0">{fmtBytes(a.size)}</span>}
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-muted hover:text-loss transition-colors shrink-0"
          aria-label={t("chat.removeAttachment", { name: a.name })}
        >
          ✕
        </button>
      )}
    </span>
  );
}

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
  onPause,
  remoteBusy = false,
  tall = false,
  expanded = false,
  onToggleExpand,
  title,
  emptyHint,
  onOpenSignal,
}: {
  messages: ChatMessage[];
  signalsById: Map<string, Signal>;
  sending: boolean;
  showLensChips: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onAct: (id: string, action: "approve" | "dismiss") => void;
  actingId: string | null;
  error: string | null;
  onRetry: () => void;
  /** Stop the in-flight analyst turn (aborts locally + cancels server-side). */
  onPause?: () => void;
  /**
   * The analyst is working on this thread in the BACKGROUND (a turn started
   * earlier — possibly from another tab or before a reload — is still
   * running server-side). Shows the thinking bubble and suppresses the
   * "hasn't replied" prompt until the turn resolves.
   */
  remoteBusy?: boolean;
  tall?: boolean;
  /** Fullscreen desk mode — the page controls positioning, this styles the frame. */
  expanded?: boolean;
  onToggleExpand?: () => void;
  title?: string;
  /** Muted intro bubble shown while the thread is empty. */
  emptyHint?: string;
  /** Makes resolved (now-active) proposal chips open that signal's detail. */
  onOpenSignal?: (id: string) => void;
}) {
  const { t, lang } = useT();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachBusy, setAttachBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SRLike | null>(null);
  const dictationBase = useRef("");
  const speechOK = speechRecognitionCtor() !== null;
  // A turn is in flight — locally sent this session, or running server-side.
  const busy = sending || remoteBusy;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  // SOTA-chat input: the box grows to fit the full text (wrapped lines
  // included), capped so long drafts scroll inside the box, never a slit.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, expanded ? 320 : 200)}px`;
  }, [text, expanded]);

  // Stop mic + speech when the panel unmounts.
  useEffect(
    () => () => {
      recRef.current?.stop();
      stopSpeaking();
    },
    []
  );

  function submit() {
    const msg = text.trim();
    if ((!msg && attachments.length === 0) || busy || attachBusy) return;
    stopListening();
    setText("");
    setAttachments([]);
    setLocalError(null);
    onSend(msg, attachments);
  }

  async function addFiles(list: FileList | File[]) {
    setLocalError(null);
    const files = Array.from(list);
    if (attachments.length + files.length > MAX_FILES) {
      setLocalError(t("chat.maxFiles", { n: MAX_FILES }));
      return;
    }
    setAttachBusy(true);
    try {
      const processed: Attachment[] = [];
      for (const f of files) processed.push(await processFile(f));
      setAttachments((prev) => [...prev, ...processed]);
    } catch (e) {
      setLocalError(e instanceof Error ? localizeAttachError(e.message, t) : t("chat.fileReadFailed"));
    } finally {
      setAttachBusy(false);
    }
  }

  function startListening() {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang === "zh" ? "zh-CN" : "en-US";
    dictationBase.current = text ? text.replace(/\s+$/, "") + " " : "";
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setText(dictationBase.current + transcript);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setLocalError(t("chat.micBlocked"));
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  function toggleSpeak(m: ChatMessage) {
    if (!speechSynthesisSupported()) return;
    if (speakingId === m.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    speak(m.content, voiceLangTag(lang), () => setSpeakingId(null));
    setSpeakingId(m.id);
  }

  // A user message with no analyst reply AND no turn running anywhere — only
  // then is the thread genuinely stranded (e.g. after a failed call + reload).
  // While a background turn is in flight this shows the thinking bubble instead.
  const stranded =
    !busy && !error && messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <div
      className={`flex flex-col rounded-2xl bg-card border border-hairline overflow-hidden ${
        expanded ? "h-full" : tall ? "h-[70vh]" : "h-full"
      }`}
    >
      <div className="px-4 py-3 border-b border-hairline flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-gain" />
        <p className="text-sm font-semibold">{title ?? t("chat.title")}</p>
        <p className="text-[10px] text-muted ml-auto hidden sm:block">{t("chat.headerHint")}</p>
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            title={expanded ? t("chat.exitFullTitle") : t("chat.enterFull")}
            aria-label={expanded ? t("chat.exitFull") : t("chat.enterFull")}
            className="rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2 py-1 text-[11px] text-emph transition-colors"
          >
            {expanded ? `⤡ ${t("chat.exit")}` : "⤢"}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !sending && emptyHint && (
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-card2 px-3.5 py-2.5 text-xs text-muted leading-relaxed">
              {emptyHint}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-accent text-white px-3.5 py-2.5 text-sm whitespace-pre-wrap"
                  : `${expanded ? "max-w-[95%]" : "max-w-[92%]"} rounded-2xl rounded-bl-md bg-card2 px-3.5 py-2.5 group`
              }
            >
              {m.attachments?.length > 0 && (
                <div className={`flex flex-wrap gap-1.5 ${m.content ? "mb-2" : ""}`}>
                  {m.attachments.map((a, i) => (
                    <AttachmentChip key={i} a={a} />
                  ))}
                </div>
              )}
              {m.role === "assistant" ? (
                m.id.length > 12 ? (
                  // Real (persisted) replies are annotatable; optimistic/temp
                  // bubbles are not — their ids don't survive the next poll.
                  <Annotatable surfaceId={`msg:${m.id}`}>
                    <Markdown>{m.content}</Markdown>
                  </Annotatable>
                ) : (
                  <Markdown>{m.content}</Markdown>
                )
              ) : (
                m.content
              )}
              {m.role === "assistant" && (
                <div className="mt-1.5 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleSpeak(m)}
                    title={speakingId === m.id ? t("chat.stopReading") : t("chat.readAloud")}
                    className="text-[11px] text-muted hover:text-emph transition-colors"
                  >
                    {speakingId === m.id ? `◼ ${t("chat.stop")}` : `🔊 ${t("chat.read")}`}
                  </button>
                </div>
              )}
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
                          replacesName={
                            s.replaces ? (signalsById.get(s.replaces)?.name ?? null) : null
                          }
                        />
                      );
                    }
                    const openable = s.status === "active" && onOpenSignal;
                    return (
                      <div
                        key={id}
                        role={openable ? "button" : undefined}
                        onClick={openable ? () => onOpenSignal(id) : undefined}
                        title={openable ? t("chat.openSignal") : undefined}
                        className={`rounded-lg bg-ink/4 border border-hairline px-3 py-2 text-xs flex items-center justify-between ${
                          openable ? "cursor-pointer hover:bg-ink/8 hover:border-ink/25 transition-colors" : ""
                        }`}
                      >
                        <span className="font-medium">{s.name}</span>
                        <span
                          className={
                            s.status === "active"
                              ? "text-gain text-[11px]"
                              : "text-muted text-[11px]"
                          }
                        >
                          {s.status === "active"
                            ? t("chat.activeOpen")
                            : t(`common.status_${s.status}`)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-card2 px-3.5 py-2.5 text-sm text-muted pulse-soft">
              {t("chat.thinking")}
            </div>
          </div>
        )}
        {error && !busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-loss/30 bg-loss/8 px-3.5 py-2.5 text-xs max-w-[92%]">
              <p className="text-loss font-medium">{localizeError(error, t)}</p>
              <button
                onClick={onRetry}
                className="mt-2 rounded-lg bg-ink/8 hover:bg-ink/12 px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors"
              >
                {t("common.retry")}
              </button>
            </div>
          </div>
        )}
        {stranded && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-card2 px-3.5 py-2.5 text-xs max-w-[92%]">
              <p className="text-muted">{t("chat.strandedNote")}</p>
              <button
                onClick={onRetry}
                className="mt-2 rounded-lg bg-accent/90 hover:bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition-colors"
              >
                {t("chat.askToRespond")}
              </button>
            </div>
          </div>
        )}
      </div>

      {showLensChips && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {LENS_CHIP_KEYS.map((k) => {
            const c = t(k);
            return (
              <button
                key={k}
                onClick={() => setText((prev) => (prev ? prev + " " + c : c))}
                className="rounded-full border border-hairline bg-ink/4 hover:bg-ink/8 px-2.5 py-1 text-[11px] text-emph transition-colors"
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {(attachments.length > 0 || attachBusy || localError) && (
        <div className="px-4 pb-2 space-y-1.5">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((a, i) => (
                <AttachmentChip
                  key={i}
                  a={a}
                  onRemove={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}
          {attachBusy && <p className="text-[11px] text-muted pulse-soft">{t("chat.preparingFiles")}</p>}
          {localError && <p className="text-[11px] text-loss">{localError}</p>}
        </div>
      )}

      <div className="p-3 border-t border-hairline">
        <div className="flex items-end gap-2 rounded-xl bg-card2 border border-hairline focus-within:border-accent/50 px-3 py-2 transition-colors">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.pdf,.txt,.md,.csv,.tsv,.json,.xml,.yml,.yaml,.log,.py,.ts,.js,.html"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {/* Attach and dictate stay usable while the analyst thinks — the
              investor can stage the next message; only Send waits its turn. */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={attachBusy}
            title={t("chat.attachTitle")}
            aria-label={t("chat.attachTitle")}
            className="shrink-0 rounded-lg hover:bg-ink/8 disabled:opacity-40 px-1.5 py-1.5 text-base leading-none transition-colors"
          >
            📎
          </button>
          {speechOK && (
            <button
              onClick={() => (listening ? stopListening() : startListening())}
              title={listening ? t("chat.dictateStop") : t("chat.dictate")}
              aria-label={listening ? t("chat.dictateStop") : t("chat.dictate")}
              className={`shrink-0 rounded-lg px-1.5 py-1.5 text-base leading-none transition-colors ${
                listening ? "bg-loss/20 text-loss pulse-soft" : "hover:bg-ink/8"
              }`}
            >
              🎤
            </button>
          )}
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files ?? []);
              if (files.length > 0) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            rows={1}
            placeholder={listening ? t("chat.placeholderListening") : t("chat.placeholder")}
            className="flex-1 bg-transparent outline-none resize-none text-sm placeholder:text-muted/60 leading-relaxed overflow-y-auto"
          />
          {busy && onPause ? (
            <button
              onClick={onPause}
              title={t("chat.pauseTitle")}
              className="shrink-0 rounded-lg bg-loss/15 hover:bg-loss/25 text-loss text-xs font-semibold px-3 py-1.5 transition-colors"
            >
              ◼ {t("chat.pause")}
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={busy || attachBusy || (!text.trim() && attachments.length === 0)}
              className="shrink-0 rounded-lg bg-accent disabled:bg-ink/10 disabled:text-muted text-white text-xs font-semibold px-3 py-1.5 transition-colors"
            >
              {t("chat.send")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
