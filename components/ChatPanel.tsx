"use client";

import { useEffect, useRef, useState } from "react";
import type { Attachment, ChatMessage, Signal } from "@/lib/types";
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

// ---------------------------------------------------------------------------
// Attachments: client-side processing (images are downscaled + re-encoded so
// a phone photo doesn't blow the request cap; PDFs/text ride through as-is).
// ---------------------------------------------------------------------------

const IMAGE_MAX_EDGE = 1568; // Claude's optimal max long edge
const PDF_MAX_BYTES = 4_000_000;
const TEXT_MAX_BYTES = 300_000;
const MAX_FILES = 6;

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error(`Could not read ${file.name}`));
    r.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error(`Could not read ${file.name}`));
    r.readAsText(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Not a readable image"));
    img.src = dataUrl;
  });
}

const CLAUDE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

async function processFile(file: File): Promise<Attachment> {
  if (file.type.startsWith("image/")) {
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.width, img.height));
    if (scale === 1 && CLAUDE_IMAGE_TYPES.has(file.type) && file.size < 1_500_000) {
      return {
        kind: "image",
        name: file.name,
        mediaType: file.type,
        size: file.size,
        data: dataUrl.split(",")[1],
      };
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.85);
    const data = jpeg.split(",")[1];
    return {
      kind: "image",
      name: file.name,
      mediaType: "image/jpeg",
      size: Math.round(data.length * 0.75),
      data,
    };
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    if (file.size > PDF_MAX_BYTES) {
      throw new Error(`${file.name} is ${fmtBytes(file.size)} — PDFs up to ${fmtBytes(PDF_MAX_BYTES)} only.`);
    }
    const dataUrl = await readAsDataURL(file);
    return {
      kind: "pdf",
      name: file.name,
      mediaType: "application/pdf",
      size: file.size,
      data: dataUrl.split(",")[1],
    };
  }
  if (file.size > TEXT_MAX_BYTES) {
    throw new Error(`${file.name} is ${fmtBytes(file.size)} — text files up to ${fmtBytes(TEXT_MAX_BYTES)} only.`);
  }
  const text = await readAsText(file);
  return {
    kind: "text",
    name: file.name,
    mediaType: file.type || "text/plain",
    size: file.size,
    data: text,
  };
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

/** Rough markdown → speech text (read-aloud shouldn't say "asterisk"). */
function speakable(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " code block omitted. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>|~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function AttachmentChip({
  a,
  onRemove,
}: {
  a: Attachment;
  onRemove?: () => void;
}) {
  const icon = a.kind === "image" ? "🖼" : a.kind === "pdf" ? "📄" : "📝";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/5 px-2 py-1 text-[11px] text-[#c7c7cc] max-w-[220px]">
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
          aria-label={`Remove ${a.name}`}
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
  tall = false,
  expanded = false,
  onToggleExpand,
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
  tall?: boolean;
  /** Fullscreen desk mode — the page controls positioning, this styles the frame. */
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachBusy, setAttachBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SRLike | null>(null);
  const dictationBase = useRef("");
  const speechOK = speechRecognitionCtor() !== null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  // Stop mic + speech when the panel unmounts.
  useEffect(
    () => () => {
      recRef.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    []
  );

  function submit() {
    const t = text.trim();
    if ((!t && attachments.length === 0) || sending || attachBusy) return;
    stopListening();
    setText("");
    setAttachments([]);
    setLocalError(null);
    onSend(t, attachments);
  }

  async function addFiles(list: FileList | File[]) {
    setLocalError(null);
    const files = Array.from(list);
    if (attachments.length + files.length > MAX_FILES) {
      setLocalError(`At most ${MAX_FILES} files per message.`);
      return;
    }
    setAttachBusy(true);
    try {
      const processed: Attachment[] = [];
      for (const f of files) processed.push(await processFile(f));
      setAttachments((prev) => [...prev, ...processed]);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Couldn't read that file.");
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
    rec.lang = navigator.language || "en-US";
    dictationBase.current = text ? text.replace(/\s+$/, "") + " " : "";
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setText(dictationBase.current + transcript);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setLocalError("Microphone access was blocked.");
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
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speakingId === m.id) {
      synth.cancel();
      setSpeakingId(null);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(speakable(m.content));
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    synth.speak(u);
    setSpeakingId(m.id);
  }

  // A user message with no analyst reply (e.g. after a failed call + reload).
  const stranded =
    !sending && !error && messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <div
      className={`flex flex-col rounded-2xl bg-card border border-hairline overflow-hidden ${
        expanded ? "h-full" : tall ? "h-[70vh]" : "h-full"
      }`}
    >
      <div className="px-4 py-3 border-b border-hairline flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-gain" />
        <p className="text-sm font-semibold">Analyst desk</p>
        <p className="text-[10px] text-muted ml-auto hidden sm:block">
          your feedback steers tomorrow’s research
        </p>
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            title={expanded ? "Exit full screen (Esc)" : "Full-screen desk"}
            aria-label={expanded ? "Exit full screen" : "Full-screen desk"}
            className="rounded-md border border-hairline bg-white/4 hover:bg-white/10 px-2 py-1 text-[11px] text-[#c7c7cc] transition-colors"
          >
            {expanded ? "⤡ Exit" : "⤢"}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
              {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content}
              {m.role === "assistant" && (
                <div className="mt-1.5 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleSpeak(m)}
                    title={speakingId === m.id ? "Stop reading" : "Read aloud"}
                    className="text-[11px] text-muted hover:text-[#c7c7cc] transition-colors"
                  >
                    {speakingId === m.id ? "◼ stop" : "🔊 read"}
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
          {attachBusy && <p className="text-[11px] text-muted pulse-soft">Preparing files…</p>}
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
          <button
            onClick={() => fileRef.current?.click()}
            disabled={sending || attachBusy}
            title="Attach files or images"
            aria-label="Attach files or images"
            className="shrink-0 rounded-lg hover:bg-white/8 disabled:opacity-40 px-1.5 py-1.5 text-base leading-none transition-colors"
          >
            📎
          </button>
          {speechOK && (
            <button
              onClick={() => (listening ? stopListening() : startListening())}
              disabled={sending}
              title={listening ? "Stop dictation" : "Dictate with your voice"}
              aria-label={listening ? "Stop dictation" : "Dictate with your voice"}
              className={`shrink-0 rounded-lg px-1.5 py-1.5 text-base leading-none transition-colors ${
                listening ? "bg-loss/20 text-loss pulse-soft" : "hover:bg-white/8"
              }`}
            >
              🎤
            </button>
          )}
          <textarea
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
            rows={Math.min(expanded ? 8 : 4, Math.max(1, text.split("\n").length))}
            placeholder={
              listening ? "Listening — speak now…" : "Tell your analyst what to focus on…"
            }
            className="flex-1 bg-transparent outline-none resize-none text-sm placeholder:text-muted/60 leading-relaxed"
          />
          <button
            onClick={submit}
            disabled={sending || attachBusy || (!text.trim() && attachments.length === 0)}
            className="shrink-0 rounded-lg bg-accent disabled:bg-white/10 disabled:text-muted text-white text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
