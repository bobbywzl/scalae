"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, timeAgo } from "@/components/util";
import { MAX_FILES, fmtBytes, processFile } from "@/components/attach";
import type { Attachment, FeedbackCategory, FeedbackStatus, FeedbackTicket } from "@/lib/types";

/**
 * Help & feedback — the app's customer-service desk. File a request (bug /
 * idea / question) with evidence attached, get a request ID, and track the
 * thread; responses also go out by email when the deployment has it set up.
 */

const CATEGORIES: { key: FeedbackCategory; label: string; hint: string }[] = [
  { key: "bug", label: "🐛 Bug report", hint: "Something is broken or wrong" },
  { key: "idea", label: "💡 Feature idea", hint: "Something Scalae should do" },
  { key: "question", label: "❓ Question", hint: "How does something work?" },
  { key: "account", label: "👤 Account", hint: "Sign-in, data or billing" },
  { key: "other", label: "💬 Other", hint: "Anything else" },
];

const STATUS_BADGE: Record<FeedbackStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-warn/12 text-warn" },
  responded: { label: "Response ready", cls: "bg-gain/12 text-gain" },
  closed: { label: "Closed", cls: "bg-white/8 text-muted" },
};

function AttachmentChips({
  files,
  onRemove,
}: {
  files: Attachment[];
  onRemove?: (i: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <span
          key={`${f.name}-${i}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/6 border border-hairline px-2 py-1 text-[11px]"
        >
          <span aria-hidden>{f.kind === "image" ? "🖼️" : f.kind === "pdf" ? "📄" : "📝"}</span>
          <span className="max-w-[160px] truncate">{f.name}</span>
          <span className="text-muted">{fmtBytes(f.size)}</span>
          {onRemove && (
            <button
              onClick={() => onRemove(i)}
              className="text-muted hover:text-loss ml-0.5"
              title={`Remove ${f.name}`}
            >
              ✕
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/** Rendered evidence inside a thread: images inline, pdf/text as download links. */
function EvidenceGallery({ files }: { files: Attachment[] }) {
  if (files.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((f, i) =>
        f.kind === "image" && f.data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={`data:${f.mediaType || "image/jpeg"};base64,${f.data}`}
            alt={f.name}
            title={f.name}
            className="max-h-40 rounded-lg border border-hairline"
          />
        ) : f.data ? (
          <a
            key={i}
            href={
              f.kind === "pdf"
                ? `data:application/pdf;base64,${f.data}`
                : `data:text/plain;charset=utf-8,${encodeURIComponent(f.data)}`
            }
            download={f.name}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/6 border border-hairline px-2 py-1 text-[11px] hover:border-white/25"
          >
            {f.kind === "pdf" ? "📄" : "📝"} {f.name}
            <span className="text-muted">{fmtBytes(f.size)}</span>
          </a>
        ) : (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/6 border border-hairline px-2 py-1 text-[11px] text-muted"
          >
            {f.kind === "image" ? "🖼️" : f.kind === "pdf" ? "📄" : "📝"} {f.name} · {fmtBytes(f.size)}
          </span>
        )
      )}
    </div>
  );
}

function AttachButton({
  files,
  setFiles,
  onError,
}: {
  files: Attachment[];
  setFiles: (f: Attachment[]) => void;
  onError: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md,.csv,.json,.log"
        className="hidden"
        onChange={async (e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length + picked.length > MAX_FILES) {
            onError(`At most ${MAX_FILES} files per message.`);
            return;
          }
          try {
            const processed = await Promise.all(picked.map(processFile));
            setFiles([...files, ...processed]);
          } catch (err) {
            onError(err instanceof Error ? err.message : "Could not read that file.");
          }
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/4 hover:bg-white/8 px-2.5 py-1.5 text-[11px] font-medium transition-colors"
        title="Attach screenshots, PDFs or text files as evidence"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 12.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8L13 5a3.7 3.7 0 0 1 5.2 5.2L10 18.4a1.8 1.8 0 0 1-2.6-2.6L15 8.3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Attach evidence
      </button>
    </>
  );
}

export default function SupportPage() {
  const [me, setMe] = useState<{ authEnabled: boolean; user: { email: string } | null } | null>(null);
  const [rows, setRows] = useState<FeedbackTicket[] | null>(null);

  // --- new request form ---
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filedId, setFiledId] = useState<string | null>(null);

  // --- thread view ---
  const [openId, setOpenId] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<FeedbackTicket | null>(null);
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<Attachment[]>([]);
  const [replyError, setReplyError] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    api<{ authEnabled: boolean; user: { email: string } | null }>("/api/auth/me")
      .then(setMe)
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const { rows } = await api<{ rows: FeedbackTicket[] }>("/api/feedback");
      setRows(rows);
    } catch {
      /* keep last state */
    }
  }, []);

  useEffect(() => {
    // Same initial-fetch idiom as the watchlist/desk pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function openThread(id: string) {
    setOpenId(id);
    setOpenTicket(null);
    setReply("");
    setReplyFiles([]);
    setReplyError("");
    try {
      const { ticket } = await api<{ ticket: FeedbackTicket }>(`/api/feedback/${id}`);
      setOpenTicket(ticket);
    } catch {
      setReplyError("Could not load the thread — try again.");
    }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!category) {
      setFormError("Pick a category.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const { ticket } = await api<{ ticket: FeedbackTicket }>("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ category, subject, message: messageBody, attachments: files }),
      });
      setFiledId(ticket.id);
      setCategory(null);
      setSubject("");
      setMessageBody("");
      setFiles([]);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not file the request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply() {
    if (!openTicket || sendingReply) return;
    if (!reply.trim() && replyFiles.length === 0) return;
    setSendingReply(true);
    setReplyError("");
    try {
      await api(`/api/feedback/${openTicket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: reply, attachments: replyFiles }),
      });
      setReply("");
      setReplyFiles([]);
      await openThread(openTicket.id);
      load();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Could not send the reply.");
    } finally {
      setSendingReply(false);
    }
  }

  async function setStatus(status: "closed" | "open") {
    if (!openTicket) return;
    try {
      await api(`/api/feedback/${openTicket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await openThread(openTicket.id);
      load();
    } catch {
      /* leave thread as-is */
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity">
          ‹ Watchlist
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">Help &amp; feedback</h1>
          <p className="text-muted text-xs">
            Report a bug, request a feature, or ask a question — attach screenshots as evidence.
          </p>
        </div>
      </header>

      <div className="space-y-5">
        {/* New request */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
            New request
          </p>

          {filedId ? (
            <div className="rounded-xl border border-gain/25 bg-gain/8 px-4 py-3.5">
              <p className="text-sm font-semibold text-gain">Request filed ✓</p>
              <p className="mt-1.5 text-xs text-[#c7c7cc]">
                Your request ID is{" "}
                <span className="font-mono font-bold text-foreground bg-white/8 rounded px-1.5 py-0.5">
                  {filedId}
                </span>{" "}
                — keep it for reference.
              </p>
              <p className="mt-1 text-[11px] text-muted leading-snug">
                {me?.authEnabled && me.user
                  ? `We'll email ${me.user.email} when there's a response; the full thread lives on this page.`
                  : "Responses appear on this page, under Your requests."}
              </p>
              <button
                onClick={() => setFiledId(null)}
                className="mt-2.5 text-[11px] font-medium text-accent hover:opacity-80"
              >
                File another request
              </button>
            </div>
          ) : (
            <form onSubmit={submitRequest} className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    title={c.hint}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      category === c.key
                        ? "border-accent/60 bg-accent/12 text-foreground"
                        : "border-hairline bg-white/4 text-muted hover:text-foreground hover:bg-white/8"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                placeholder="Subject — one line, e.g. “Order ticket rejects limit price”"
                className="w-full bg-background border border-hairline rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="What happened, what you expected, and any steps to reproduce…"
                className="w-full bg-background border border-hairline rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
              />
              <AttachmentChips files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
              {formError && (
                <p className="text-xs text-loss bg-loss/10 border border-loss/20 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <AttachButton files={files} setFiles={setFiles} onError={setFormError} />
                <button
                  type="submit"
                  disabled={submitting || !category || !subject.trim() || !messageBody.trim()}
                  className="rounded-lg bg-accent text-black px-4 py-2 text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Filing…" : "Submit request"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* My requests */}
        <section className="rounded-2xl bg-card border border-hairline overflow-hidden">
          <p className="text-[10px] uppercase tracking-wider text-muted font-semibold px-5 pt-4 pb-1">
            Your requests
          </p>
          {rows === null ? (
            <p className="text-muted text-sm px-5 py-8 text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted text-xs px-5 py-8 text-center">
              Nothing filed yet — your requests and our responses will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {rows.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => (openId === t.id ? setOpenId(null) : openThread(t.id))}
                    className="w-full text-left px-5 py-3 hover:bg-white/3 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 flex-wrap">
                      <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${STATUS_BADGE[t.status].cls}`}>
                        {STATUS_BADGE[t.status].label}
                      </span>
                      <span className="font-mono text-[10px] text-muted">{t.id}</span>
                      <span className="text-xs font-semibold flex-1 min-w-0 truncate">{t.subject}</span>
                      <span className="text-[10px] text-muted shrink-0">{timeAgo(t.updatedAt)}</span>
                    </span>
                  </button>

                  {openId === t.id && (
                    <div className="px-5 pb-4">
                      {!openTicket ? (
                        <p className="text-muted text-xs py-4">{replyError || "Loading thread…"}</p>
                      ) : (
                        <div className="space-y-2.5">
                          {openTicket.messages.map((m) => (
                            <div
                              key={m.id}
                              className={`rounded-xl border px-3.5 py-2.5 ${
                                m.role === "admin"
                                  ? "border-accent/25 bg-accent/6"
                                  : "border-hairline bg-white/3"
                              }`}
                            >
                              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-muted">
                                {m.role === "admin" ? "Scalae team" : "You"}
                                <span className="ml-2 normal-case tracking-normal font-normal">
                                  {timeAgo(m.createdAt)}
                                </span>
                              </p>
                              {m.body && <p className="text-xs whitespace-pre-wrap leading-relaxed">{m.body}</p>}
                              <EvidenceGallery files={m.attachments} />
                            </div>
                          ))}

                          {/* Reply box */}
                          {openTicket.status !== "closed" ? (
                            <div className="rounded-xl border border-hairline bg-background px-3.5 py-3 space-y-2">
                              <textarea
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                rows={2}
                                maxLength={5000}
                                placeholder="Reply to this thread…"
                                className="w-full bg-transparent text-xs placeholder:text-muted focus:outline-none resize-y"
                              />
                              <AttachmentChips
                                files={replyFiles}
                                onRemove={(i) => setReplyFiles(replyFiles.filter((_, j) => j !== i))}
                              />
                              {replyError && <p className="text-[11px] text-loss">{replyError}</p>}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <AttachButton files={replyFiles} setFiles={setReplyFiles} onError={setReplyError} />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setStatus("closed")}
                                    className="rounded-lg border border-hairline px-3 py-1.5 text-[11px] text-muted hover:text-foreground transition-colors"
                                    title="Mark this request resolved"
                                  >
                                    Close request
                                  </button>
                                  <button
                                    onClick={sendReply}
                                    disabled={sendingReply || (!reply.trim() && replyFiles.length === 0)}
                                    className="rounded-lg bg-accent text-black px-3.5 py-1.5 text-[11px] font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
                                  >
                                    {sendingReply ? "Sending…" : "Send reply"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-white/3 px-3.5 py-2.5">
                              <p className="text-[11px] text-muted">
                                This request is closed. Replying isn&rsquo;t possible — reopen it first.
                              </p>
                              <button
                                onClick={() => setStatus("open")}
                                className="rounded-lg border border-hairline px-3 py-1.5 text-[11px] text-accent hover:opacity-80 transition-opacity shrink-0"
                              >
                                Reopen
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[10px] text-muted/60">
          Keep your request ID handy when following up. Evidence stays private to your account and
          the app administrators.
        </p>
      </div>
    </main>
  );
}
