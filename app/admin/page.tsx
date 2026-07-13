"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, timeAgo } from "@/components/util";
import type { AdminUserRow } from "@/lib/types";

/**
 * Admin console: every account across the app with activity aggregates —
 * who's using the desks, how deep, and when they were last active.
 * Server-gated to admins (the API 403s everyone else).
 */
export default function AdminPage() {
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [models, setModels] = useState<Record<string, string> | null>(null);
  const [authOn, setAuthOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ rows: AdminUserRow[]; models: Record<string, string>; authEnabled: boolean }>(
        "/api/admin/users"
      );
      setRows(data.rows);
      setModels(data.models);
      setAuthOn(data.authEnabled);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
  }, []);

  useEffect(() => {
    // Same initial-fetch-then-poll idiom as the watchlist/desk pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const totals = rows?.reduce(
    (a, r) => ({
      tickers: a.tickers + r.tickers,
      signals: a.signals + r.activeSignals,
      runs: a.runs + r.runs,
      messages: a.messages + r.messages,
      trades: a.trades + r.trades,
    }),
    { tickers: 0, signals: 0, runs: 0, messages: 0, trades: 0 }
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap mb-5">
        <Link href="/" className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity">
          ‹ Watchlist
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">Admin</h1>
          <p className="text-muted text-xs">
            Every account across the app — desks, research activity, ledgers.
          </p>
        </div>
        {authOn === false && (
          <span className="ml-auto rounded-lg border border-warn/25 bg-warn/8 px-3 py-1.5 text-[11px] text-warn">
            Single-user mode — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SESSION_SECRET to open
            sign-ups
          </span>
        )}
      </header>

      {error && <p className="text-loss text-sm mb-4">{error}</p>}
      {!rows ? (
        <p className="text-muted text-sm py-16 text-center">Loading accounts…</p>
      ) : (
        <div className="space-y-5">
          {totals && (
            <section className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {(
                [
                  ["Users", rows.length],
                  ["Desks", totals.tickers],
                  ["Active signals", totals.signals],
                  ["Research runs", totals.runs],
                  ["User messages", totals.messages],
                  ["Trades", totals.trades],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="rounded-xl bg-card border border-hairline px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5">{v.toLocaleString()}</p>
                </div>
              ))}
            </section>
          )}

          <section className="rounded-2xl bg-card border border-hairline overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted border-b border-hairline">
                    <th className="text-left px-4 py-2.5 font-semibold">Account</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Desks</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Signals</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Runs</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Last run</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Msgs</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Trades</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Joined</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map((r) => (
                    <tr key={r.user.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 min-w-0">
                          {r.user.picture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.user.picture} alt="" className="h-6 w-6 rounded-full shrink-0" />
                          ) : (
                            <span className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] shrink-0">
                              {(r.user.name || r.user.email)[0]?.toUpperCase()}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="font-semibold block truncate">
                              {r.user.name || r.user.email}
                              {r.user.role === "admin" && (
                                <span className="ml-1.5 rounded bg-accent/15 text-accent px-1.5 py-px text-[9px] uppercase tracking-wider">
                                  admin
                                </span>
                              )}
                            </span>
                            <span className="text-muted block truncate">{r.user.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{r.tickers}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{r.activeSignals}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{r.runs}</td>
                      <td className="px-3 py-2.5 text-muted">{r.lastRunAt ? timeAgo(r.lastRunAt) : "never"}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{r.messages}</td>
                      <td className="text-right px-3 py-2.5 tabular-nums">{r.trades}</td>
                      <td className="px-3 py-2.5 text-muted">{r.user.createdAt.slice(0, 10)}</td>
                      <td className="px-3 py-2.5 text-muted">{timeAgo(r.user.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {models && (
            <section className="rounded-2xl bg-card border border-hairline px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                Models in use right now{" "}
                <span className="normal-case tracking-normal font-normal">
                  — auto-selected from each provider's live list; pin per role with
                  CLAUDE_SYNTHESIS_MODEL / GEMINI_BREADTH_MODEL / GEMINI_DEEP_MODEL etc. (legacy
                  GEMINI_MODEL / CLAUDE_MODEL globals are ignored)
                </span>
              </p>
              <p className="mt-1.5 text-xs text-[#c7c7cc] tabular-nums flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(models).map(([role, id]) => (
                  <span key={role}>
                    <span className="text-muted">{role}:</span> {id}
                  </span>
                ))}
              </p>
            </section>
          )}
          <p className="text-[10px] text-muted/60">
            Research runs consume model tokens per user — watch the Runs column when opening the
            app up. The auto-research switch is per account.
          </p>
        </div>
      )}
    </main>
  );
}
