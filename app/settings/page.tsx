"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/components/util";

type Me = {
  authEnabled: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    picture: string;
    role: string;
    createdAt: string;
  } | null;
};

/**
 * Settings: profile, preferences and account actions. The dashboard header's
 * avatar and gear icons land here; sign-in stays at /signin and the admin
 * console at /admin (server-gated, deliberately unadvertised).
 */
export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [autoResearch, setAutoResearch] = useState<boolean | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);

  useEffect(() => {
    api<Me>("/api/auth/me")
      .then(setMe)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ autoResearch: boolean }>("/api/settings")
      .then((s) => {
        if (!cancelled) setAutoResearch(s.autoResearch);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Same lever as the dashboard switch — one setting, two doors.
  async function toggleAutoResearch() {
    if (autoResearch === null || savingAuto) return;
    const next = !autoResearch;
    setSavingAuto(true);
    setAutoResearch(next);
    try {
      await api(`/api/settings`, { method: "POST", body: JSON.stringify({ autoResearch: next }) });
    } catch {
      setAutoResearch(!next);
    } finally {
      setSavingAuto(false);
    }
  }

  const user = me?.user;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity">
          ‹ Watchlist
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">Settings</h1>
          <p className="text-muted text-xs">Profile, research preferences and account.</p>
        </div>
      </header>

      <div className="space-y-5">
        {/* Profile */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">Profile</p>
          {me === null ? (
            <p className="text-muted text-sm py-2">Loading…</p>
          ) : user && me.authEnabled ? (
            <div className="flex items-center gap-4">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt="Profile" className="h-14 w-14 rounded-full shrink-0" />
              ) : (
                <span className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center text-xl font-semibold shrink-0">
                  {(user.name || user.email)[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {user.name || user.email}
                  {user.role === "admin" && (
                    <span className="ml-2 rounded bg-accent/15 text-accent px-1.5 py-px text-[9px] uppercase tracking-wider align-middle">
                      admin
                    </span>
                  )}
                </p>
                <p className="text-muted text-xs truncate">{user.email}</p>
                {user.createdAt && (
                  <p className="text-muted/70 text-[11px] mt-0.5">
                    Member since {user.createdAt.slice(0, 10)} · signed in with Google
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted leading-relaxed">
              <p className="font-semibold text-[#c7c7cc]">Running in single-user mode.</p>
              <p className="mt-1">
                Everything on this deployment belongs to one local account. To turn Scalae into a
                multi-user app with Google sign-in, set <code>GOOGLE_CLIENT_ID</code>,{" "}
                <code>GOOGLE_CLIENT_SECRET</code> and <code>SESSION_SECRET</code> — the README walks
                through it.
              </p>
            </div>
          )}
        </section>

        {/* Research preferences */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">Research</p>
          <div className="flex items-center gap-2.5">
            <button
              role="switch"
              aria-checked={autoResearch === true}
              disabled={autoResearch === null || savingAuto}
              onClick={toggleAutoResearch}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                autoResearch ? "bg-gain" : "bg-white/15"
              }`}
              title={autoResearch ? "Turn off automatic daily research" : "Turn on automatic daily research"}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  autoResearch ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold">
                Auto daily research{" "}
                <span className={autoResearch ? "text-gain" : "text-muted"}>
                  {autoResearch === null ? "…" : autoResearch ? "on" : "off"}
                </span>
              </p>
              <p className="text-[11px] text-muted leading-snug">
                {autoResearch === false
                  ? "Desks only research when you ask — the Run button or telling the analyst. The daily cron is paused (no background token spend)."
                  : "Every desk researches once a day (cron + on stale open). Turn off to spend tokens only on demand."}
              </p>
            </div>
          </div>
        </section>

        {/* Help & feedback */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">Support</p>
          <Link
            href="/support"
            className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-white/4 hover:bg-white/8 px-3.5 py-2 text-xs font-semibold transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.4-.7L3 21l1.8-4.3a8.4 8.4 0 1 1 16.2-5.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            Help &amp; feedback
          </Link>
          <p className="text-[11px] text-muted mt-2 leading-snug">
            Report a bug, request a feature or ask a question — with screenshots attached. You get a
            request ID, and responses land in your email.
          </p>
        </section>

        {/* Account */}
        {me?.authEnabled && user && (
          <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
            <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-3">Account</p>
            <a
              href="/api/auth/logout"
              className="inline-flex items-center gap-2 rounded-xl border border-loss/30 bg-loss/8 px-3.5 py-2 text-xs font-semibold text-loss hover:bg-loss/15 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </a>
            <p className="text-[11px] text-muted mt-2 leading-snug">
              Your desks, signals, chat history and paper trades stay in your account — signing back
              in with the same Google address picks up where you left off.
            </p>
          </section>
        )}

        <p className="text-[10px] text-muted/60">
          Educational research tool — not investment advice.
        </p>
      </div>
    </main>
  );
}
