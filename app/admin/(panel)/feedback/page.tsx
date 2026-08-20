"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import { api, timeAgo } from "@/components/util";
import { fmtBytes } from "@/components/attach";
import {
  AttachmentKindIcon,
  BugIcon,
  HelpCircleIcon,
  LightbulbIcon,
  MessageIcon,
  UserIcon,
  type IconProps,
} from "@/components/icons";
import type { AdminFeedbackRow, Attachment, FeedbackStatus, FeedbackTicket } from "@/lib/types";

/**
 * Admin feedback inbox: every support request across the app. Respond (which
 * emails the requester when email is configured), close, reopen.
 */

const STATUS_BADGE: Record<FeedbackStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-warn/12 text-warn" },
  responded: { label: "Responded", cls: "bg-gain/12 text-gain" },
  closed: { label: "Closed", cls: "bg-white/8 text-muted" },
};

const CATEGORY_LABEL: Record<string, { label: string; Icon: ComponentType<IconProps> }> = {
  bug: { label: "Bug", Icon: BugIcon },
  idea: { label: "Idea", Icon: LightbulbIcon },
  question: { label: "Question", Icon: HelpCircleIcon },
  account: { label: "Account", Icon: UserIcon },
  other: { label: "Other", Icon: MessageIcon },
};

function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORY_LABEL[category];
  if (!cat) return <span className="text-[0.625rem] text-muted">{category}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[0.625rem] text-muted">
      <cat.Icon className="h-3 w-3" />
      {cat.label}
    </span>
  );
}

type Filter = "all" | FeedbackStatus;

function Evidence({ files }: { files: Attachment[] }) {
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
            className="max-h-48 rounded-lg border border-hairline"
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/6 border border-hairline px-2 py-1 text-[0.6875rem] hover:border-white/25"
          >
            <AttachmentKindIcon kind={f.kind} className="h-3.5 w-3.5 shrink-0" />
            {f.name} <span className="text-muted">{fmtBytes(f.size)}</span>
          </a>
        ) : (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-white/6 border border-hairline px-2 py-1 text-[0.6875rem] text-muted">
            <AttachmentKindIcon kind={f.kind} className="h-3.5 w-3.5 shrink-0" />
            {f.name} · {fmtBytes(f.size)}
          </span>
        )
      )}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<AdminFeedbackRow[] | null>(null);
  const [mailOn, setMailOn] = useState<boolean>(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<FeedbackTicket | null>(null);
  const [response, setResponse] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ rows: AdminFeedbackRow[]; emailEnabled: boolean }>("/api/admin/feedback");
      setRows(data.rows);
      setMailOn(data.emailEnabled);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feedback");
    }
  }, []);

  useEffect(() => {
    // Same initial-fetch-then-poll idiom as the accounts page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function openThread(id: string) {
    setOpenId(id);
    setThread(null);
    setResponse("");
    setNote(null);
    try {
      const { ticket } = await api<{ ticket: FeedbackTicket }>(`/api/admin/feedback/${id}`);
      setThread(ticket);
    } catch {
      setNote("Could not load the thread.");
    }
  }

  async function act(body: { message?: string; status?: FeedbackStatus }) {
    if (!openId || sending) return;
    setSending(true);
    setNote(null);
    try {
      const res = await api<{ ok: true; emailed: boolean; ticket: FeedbackTicket }>(
        `/api/admin/feedback/${openId}`,
        { method: "POST", body: JSON.stringify(body) }
      );
      setThread(res.ticket);
      setResponse("");
      if (body.message) {
        setNote(res.emailed ? "Response sent — requester notified by email." : "Response posted to the thread.");
      }
      load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setSending(false);
    }
  }

  const visible = (rows ?? []).filter((r) => filter === "all" || r.ticket.status === filter);
  const counts = (rows ?? []).reduce(
    (a, r) => ({ ...a, [r.ticket.status]: (a[r.ticket.status] ?? 0) + 1 }),
    {} as Record<string, number>
  );

  return (
    <main className="w-full px-5 sm:px-6 lg:px-8 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-xl font-bold leading-tight">Feedback</h1>
          <p className="text-muted text-xs">
            Support requests from every account. Responding emails the requester
            {mailOn ? "" : " (email not configured — set RESEND_API_KEY)"}.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {(["all", "open", "responded", "closed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${
                filter === f
                  ? "border-accent/60 bg-accent/12"
                  : "border-hairline bg-white/4 text-muted hover:text-foreground"
              }`}
            >
              {f === "all" ? `All ${rows?.length ?? 0}` : `${STATUS_BADGE[f].label} ${counts[f] ?? 0}`}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="text-loss text-sm mb-4">{error}</p>}
      {!rows ? (
        <p className="text-muted text-sm py-16 text-center">Loading feedback…</p>
      ) : visible.length === 0 ? (
        <p className="text-muted text-xs py-16 text-center rounded-2xl bg-card border border-hairline">
          {filter === "all" ? "No support requests yet." : `No ${filter} requests.`}
        </p>
      ) : (
        <ul className="divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
          {visible.map(({ ticket: t, user }) => (
            <li key={t.id}>
              <button
                onClick={() => (openId === t.id ? setOpenId(null) : openThread(t.id))}
                className="w-full text-left px-4 py-3 hover:bg-white/3 transition-colors"
              >
                <span className="flex items-center gap-2.5 flex-wrap">
                  <span className={`rounded px-1.5 py-px text-[0.5625rem] font-bold uppercase tracking-wide ${STATUS_BADGE[t.status].cls}`}>
                    {STATUS_BADGE[t.status].label}
                  </span>
                  <span className="font-mono text-[0.625rem] text-muted">{t.id}</span>
                  <CategoryBadge category={t.category} />
                  <span className="text-xs font-semibold flex-1 min-w-0 truncate">{t.subject}</span>
                  <span className="text-[0.625rem] text-muted truncate max-w-[180px]">{user.email}</span>
                  <span className="text-[0.625rem] text-muted shrink-0">{timeAgo(t.updatedAt)}</span>
                </span>
              </button>

              {openId === t.id && (
                <div className="px-4 pb-4">
                  {!thread ? (
                    <p className="text-muted text-xs py-4">{note ?? "Loading thread…"}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {thread.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-xl border px-3.5 py-2.5 ${
                            m.role === "admin" ? "border-accent/25 bg-accent/6" : "border-hairline bg-white/3"
                          }`}
                        >
                          <p className="text-[0.625rem] uppercase tracking-wider font-semibold mb-1 text-muted">
                            {m.role === "admin" ? "Team" : user.name || user.email}
                            <span className="ml-2 normal-case tracking-normal font-normal">{timeAgo(m.createdAt)}</span>
                          </p>
                          {m.body && <p className="text-xs whitespace-pre-wrap leading-relaxed">{m.body}</p>}
                          <Evidence files={m.attachments} />
                        </div>
                      ))}

                      <div className="rounded-xl border border-hairline bg-background px-3.5 py-3 space-y-2">
                        <textarea
                          value={response}
                          onChange={(e) => setResponse(e.target.value)}
                          rows={3}
                          maxLength={5000}
                          placeholder={`Respond to ${user.name || user.email}…`}
                          className="w-full bg-transparent text-xs placeholder:text-muted focus:outline-none resize-y"
                        />
                        {note && <p className="text-[0.6875rem] text-accent">{note}</p>}
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {thread.status !== "closed" ? (
                            <button
                              onClick={() => act({ status: "closed" })}
                              disabled={sending}
                              className="rounded-lg border border-hairline px-3 py-1.5 text-[0.6875rem] text-muted hover:text-foreground transition-colors disabled:opacity-50"
                            >
                              Close
                            </button>
                          ) : (
                            <button
                              onClick={() => act({ status: "open" })}
                              disabled={sending}
                              className="rounded-lg border border-hairline px-3 py-1.5 text-[0.6875rem] text-accent hover:opacity-80 disabled:opacity-50"
                            >
                              Reopen
                            </button>
                          )}
                          <button
                            onClick={() => act({ message: response.trim(), status: "closed" })}
                            disabled={sending || !response.trim()}
                            className="rounded-lg border border-hairline px-3 py-1.5 text-[0.6875rem] text-muted hover:text-foreground transition-colors disabled:opacity-50"
                            title="Post the response and close the request"
                          >
                            Respond &amp; close
                          </button>
                          <button
                            onClick={() => act({ message: response.trim() })}
                            disabled={sending || !response.trim()}
                            className="rounded-lg bg-accent text-black px-3.5 py-1.5 text-[0.6875rem] font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
                          >
                            {sending ? "Sending…" : "Send response"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
