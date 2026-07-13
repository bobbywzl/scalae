"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/PrefsProvider";
import { api, localizeError, timeAgo } from "@/components/util";
import { MAX_FILES, fmtBytes, processFile } from "@/components/attach";
import type { TFunc, TKey } from "@/lib/i18n/dictionaries";
import type { Attachment, FeedbackCategory, FeedbackStatus, FeedbackTicket } from "@/lib/types";

/**
 * Help & feedback — the app's customer-service desk. File a request (bug /
 * idea / question) with evidence attached, get a request ID, and track the
 * thread; responses also go out by email when the deployment has it set up.
 */

const CATEGORIES: { key: FeedbackCategory; labelKey: TKey; hintKey: TKey }[] = [
  { key: "bug", labelKey: "support.catBug", hintKey: "support.catBugHint" },
  { key: "idea", labelKey: "support.catIdea", hintKey: "support.catIdeaHint" },
  { key: "question", labelKey: "support.catQuestion", hintKey: "support.catQuestionHint" },
  { key: "account", labelKey: "support.catAccount", hintKey: "support.catAccountHint" },
  { key: "other", labelKey: "support.catOther", hintKey: "support.catOtherHint" },
];

const STATUS_BADGE: Record<FeedbackStatus, { labelKey: TKey; cls: string }> = {
  open: { labelKey: "support.statusOpen", cls: "bg-warn/12 text-warn" },
  responded: { labelKey: "support.statusResponded", cls: "bg-gain/12 text-gain" },
  closed: { labelKey: "support.statusClosed", cls: "bg-ink/8 text-muted" },
};

/** File-size/type errors thrown by components/attach.ts (canonical English) → UI language. */
function localizeAttachError(msg: string, t: TFunc): string {
  let m = msg.match(/^(.+) is (.+) — PDFs up to (.+) only\.$/);
  if (m) return t("support.errPdfTooBig", { name: m[1], size: m[2], max: m[3] });
  m = msg.match(/^(.+) is (.+) — text files up to (.+) only\.$/);
  if (m) return t("support.errTextTooBig", { name: m[1], size: m[2], max: m[3] });
  m = msg.match(/^Could not read (.+)$/);
  if (m) return t("support.errCouldNotReadFile", { name: m[1] });
  if (msg === "Not a readable image") return t("support.errNotImage");
  return localizeError(msg, t);
}

function AttachmentChips({
  files,
  onRemove,
}: {
  files: Attachment[];
  onRemove?: (i: number) => void;
}) {
  const { t } = useT();
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f, i) => (
        <span
          key={`${f.name}-${i}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink/6 border border-hairline px-2 py-1 text-[11px]"
        >
          <span aria-hidden>{f.kind === "image" ? "🖼️" : f.kind === "pdf" ? "📄" : "📝"}</span>
          <span className="max-w-[160px] truncate">{f.name}</span>
          <span className="text-muted">{fmtBytes(f.size)}</span>
          {onRemove && (
            <button
              onClick={() => onRemove(i)}
              className="text-muted hover:text-loss ml-0.5"
              title={t("support.removeFile", { name: f.name })}
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink/6 border border-hairline px-2 py-1 text-[11px] hover:border-ink/25"
          >
            {f.kind === "pdf" ? "📄" : "📝"} {f.name}
            <span className="text-muted">{fmtBytes(f.size)}</span>
          </a>
        ) : (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink/6 border border-hairline px-2 py-1 text-[11px] text-muted"
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
  const { t } = useT();
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
            onError(t("support.maxFilesErr", { n: MAX_FILES }));
            return;
          }
          try {
            const processed = await Promise.all(picked.map(processFile));
            setFiles([...files, ...processed]);
          } catch (err) {
            onError(err instanceof Error ? localizeAttachError(err.message, t) : t("support.readFileFailed"));
          }
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-ink/4 hover:bg-ink/8 px-2.5 py-1.5 text-[11px] font-medium transition-colors"
        title={t("support.attachTitle")}
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
        {t("support.attachEvidence")}
      </button>
    </>
  );
}

export default function SupportPage() {
  const { t } = useT();
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
      setReplyError(t("support.threadLoadFailed"));
    }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!category) {
      setFormError(t("support.pickCategory"));
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
      setFormError(err instanceof Error ? localizeError(err.message, t) : t("support.fileFailed"));
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
      setReplyError(err instanceof Error ? localizeError(err.message, t) : t("support.replyFailed"));
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
          {t("common.backToWatchlist")}
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">{t("support.title")}</h1>
          <p className="text-muted text-xs">{t("support.subtitle")}</p>
        </div>
      </header>

      <div className="space-y-5">
        {/* New request */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">
            {t("support.newRequest")}
          </p>

          {filedId ? (
            <div className="rounded-xl border border-gain/25 bg-gain/8 px-4 py-3.5">
              <p className="text-sm font-semibold text-gain">{t("support.filedOk")}</p>
              <p className="mt-1.5 text-xs text-emph">
                {t("support.reqIdIs")}{" "}
                <span className="font-mono font-bold text-foreground bg-ink/8 rounded px-1.5 py-0.5">
                  {filedId}
                </span>{" "}
                {t("support.reqIdKeep")}
              </p>
              <p className="mt-1 text-[11px] text-muted leading-snug">
                {me?.authEnabled && me.user
                  ? t("support.emailNotice", { email: me.user.email })
                  : t("support.responsesHere")}
              </p>
              <button
                onClick={() => setFiledId(null)}
                className="mt-2.5 text-[11px] font-medium text-accent hover:opacity-80"
              >
                {t("support.fileAnother")}
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
                    title={t(c.hintKey)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      category === c.key
                        ? "border-accent/60 bg-accent/12 text-foreground"
                        : "border-hairline bg-ink/4 text-muted hover:text-foreground hover:bg-ink/8"
                    }`}
                  >
                    {t(c.labelKey)}
                  </button>
                ))}
              </div>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                placeholder={t("support.subjectPh")}
                className="w-full bg-background border border-hairline rounded-lg px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={4}
                maxLength={5000}
                placeholder={t("support.bodyPh")}
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
                  {submitting ? t("support.filing") : t("support.submitRequest")}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* My requests */}
        <section className="rounded-2xl bg-card border border-hairline overflow-hidden">
          <p className="text-[10px] uppercase tracking-wider text-muted font-semibold px-5 pt-4 pb-1">
            {t("support.yourRequests")}
          </p>
          {rows === null ? (
            <p className="text-muted text-sm px-5 py-8 text-center">{t("common.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted text-xs px-5 py-8 text-center">{t("support.nothingFiled")}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {rows.map((tk) => (
                <li key={tk.id}>
                  <button
                    onClick={() => (openId === tk.id ? setOpenId(null) : openThread(tk.id))}
                    className="w-full text-left px-5 py-3 hover:bg-ink/3 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 flex-wrap">
                      <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${STATUS_BADGE[tk.status].cls}`}>
                        {t(STATUS_BADGE[tk.status].labelKey)}
                      </span>
                      <span className="font-mono text-[10px] text-muted">{tk.id}</span>
                      <span className="text-xs font-semibold flex-1 min-w-0 truncate">{tk.subject}</span>
                      <span className="text-[10px] text-muted shrink-0">{timeAgo(tk.updatedAt, t)}</span>
                    </span>
                  </button>

                  {openId === tk.id && (
                    <div className="px-5 pb-4">
                      {!openTicket ? (
                        <p className="text-muted text-xs py-4">{replyError || t("support.loadingThread")}</p>
                      ) : (
                        <div className="space-y-2.5">
                          {openTicket.messages.map((m) => (
                            <div
                              key={m.id}
                              className={`rounded-xl border px-3.5 py-2.5 ${
                                m.role === "admin"
                                  ? "border-accent/25 bg-accent/6"
                                  : "border-hairline bg-ink/3"
                              }`}
                            >
                              <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-muted">
                                {m.role === "admin" ? t("support.supportTeam") : t("support.you")}
                                <span className="ml-2 normal-case tracking-normal font-normal">
                                  {timeAgo(m.createdAt, t)}
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
                                placeholder={t("support.replyPh")}
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
                                    title={t("support.closeTitle")}
                                  >
                                    {t("support.closeRequest")}
                                  </button>
                                  <button
                                    onClick={sendReply}
                                    disabled={sendingReply || (!reply.trim() && replyFiles.length === 0)}
                                    className="rounded-lg bg-accent text-black px-3.5 py-1.5 text-[11px] font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
                                  >
                                    {sendingReply ? t("support.sending") : t("support.sendReply")}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-ink/3 px-3.5 py-2.5">
                              <p className="text-[11px] text-muted">{t("support.closedNote")}</p>
                              <button
                                onClick={() => setStatus("open")}
                                className="rounded-lg border border-hairline px-3 py-1.5 text-[11px] text-accent hover:opacity-80 transition-opacity shrink-0"
                              >
                                {t("support.reopen")}
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

        <p className="text-[10px] text-muted/60">{t("support.footerNote")}</p>
      </div>
    </main>
  );
}
