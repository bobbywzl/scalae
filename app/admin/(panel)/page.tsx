"use client";

import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "@/components/util";
import type { AdminUserRow } from "@/lib/types";

/**
 * Admin console: accounts, AI cost & usage telemetry (estimated from list
 * prices at call time), and sign-in cadence. Server-gated to admins.
 */

interface Usage {
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    costUsd: number;
    cost30d: number;
  };
  byModel: { model: string; calls: number; tokens: number; costUsd: number }[];
  byFeature: { feature: string; calls: number; tokens: number; costUsd: number }[];
  byUser: {
    userId: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    researchCostUsd: number;
    runs: number;
    avgCostPerRun: number;
  }[];
  byDay: { day: string; costUsd: number }[];
}

const fmtUsd = (v: number) =>
  v >= 100 ? `$${Math.round(v).toLocaleString()}` : v >= 0.01 ? `$${v.toFixed(2)}` : v > 0 ? "<$0.01" : "$0.00";
const fmtTok = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(v);

/** Fill the trailing `days` calendar so quiet days render as gaps, not skips. */
function filledDays(byDay: { day: string; costUsd: number }[], days: number) {
  const map = new Map(byDay.map((d) => [d.day, d.costUsd]));
  const out: { day: string; costUsd: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, costUsd: map.get(day) ?? 0 });
  }
  return out;
}

/** Daily column chart: rounded caps, 2px gaps, hover tooltip, baseline only. */
function DailyChart({
  data,
  format,
  title,
}: {
  data: { day: string; value: number }[];
  format: (v: number) => string;
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 96;
  const max = Math.max(...data.map((d) => d.value), 1e-9);
  const slot = W / data.length;
  const barW = Math.min(24, Math.max(3, slot - 2)); // 2px surface gap, ≤24px thick
  return (
    <div className="relative">
      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">{title}</p>
      <svg
        viewBox={`0 0 ${W} ${H + 14}`}
        className="w-full"
        role="img"
        aria-label={title}
        onMouseLeave={() => setHover(null)}
      >
        {data.map((d, i) => {
          const h = d.value <= 0 ? 0 : Math.max(2, (d.value / max) * H);
          const x = i * slot + (slot - barW) / 2;
          return (
            <g key={d.day}>
              {/* full-slot hit target so thin bars stay hoverable */}
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              {h > 0 && (
                <path
                  d={`M ${x} ${H} v ${-(h - Math.min(4, h))} q 0 ${-Math.min(4, h)} 4 ${-Math.min(4, h)} h ${barW - 8} q 4 0 4 ${Math.min(4, h)} v ${h - Math.min(4, h)} z`}
                  className={hover === i ? "fill-accent" : "fill-accent/70"}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
        <line x1="0" y1={H} x2={W} y2={H} className="stroke-white/15" strokeWidth="1" />
        <text x="0" y={H + 11} className="fill-[#8e8e93]" fontSize="9">
          {data[0]?.day.slice(5)}
        </text>
        <text x={W} y={H + 11} textAnchor="end" className="fill-[#8e8e93]" fontSize="9">
          {data.at(-1)?.day.slice(5)}
        </text>
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="absolute -top-1 rounded-lg bg-black border border-hairline px-2.5 py-1.5 text-[11px] pointer-events-none shadow-xl z-10"
          style={{ left: `${(hover / data.length) * 100}%`, transform: "translateX(-50%)" }}
        >
          <span className="text-muted">{data[hover].day.slice(5)}</span>{" "}
          <span className="font-semibold tabular-nums">{format(data[hover].value)}</span>
        </div>
      )}
    </div>
  );
}

/** Horizontal magnitude bars: label left (text tokens), value at the tip. */
function BarList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; detail: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1e-9);
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">{title}</p>
      <div className="space-y-2">
        {rows.slice(0, 6).map((r) => (
          <div key={r.label} title={`${r.label} — ${fmtUsd(r.value)} · ${r.detail}`}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-xs font-mono truncate">{r.label}</span>
              <span className="text-xs tabular-nums font-semibold shrink-0">{fmtUsd(r.value)}</span>
            </div>
            <div className="h-2 rounded-r bg-white/6 overflow-hidden">
              <div
                className="h-full rounded-r bg-accent/80"
                style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted mt-0.5">{r.detail}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-muted">No spend recorded yet.</p>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [models, setModels] = useState<Record<string, string> | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [logins, setLogins] = useState<{ day: string; logins: number }[]>([]);
  const [authOn, setAuthOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{
        rows: AdminUserRow[];
        models: Record<string, string>;
        usage: Usage | null;
        logins: { day: string; logins: number }[];
        authEnabled: boolean;
      }>("/api/admin/users");
      setRows(data.rows);
      setModels(data.models);
      setUsage(data.usage);
      setLogins(data.logins ?? []);
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

  async function clearCostData() {
    if (clearing || !confirm("Wipe ALL recorded cost/usage telemetry? This cannot be undone.")) return;
    setClearing(true);
    try {
      await api("/api/admin/usage", { method: "DELETE" });
      load();
    } finally {
      setClearing(false);
    }
  }

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

  const emailOf = (userId: string) =>
    rows?.find((r) => r.user.id === userId)?.user.email ?? (userId === "local" ? "local@scalae" : userId);
  const userCostShareMax = Math.max(...(usage?.byUser.map((u) => u.costUsd) ?? []), 1e-9);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-xl font-bold leading-tight">Accounts &amp; usage</h1>
          <p className="text-muted text-xs">
            Every account — activity, sign-in cadence, and what their research actually costs.
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
          {/* App activity tiles */}
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

          {/* AI cost & usage */}
          <section className="rounded-2xl bg-card border border-hairline px-5 py-4 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                AI cost &amp; usage{" "}
                <span className="normal-case tracking-normal font-normal">
                  — last 90 days · estimated from list prices at call time
                </span>
              </p>
              {usage && usage.totals.calls > 0 && (
                <button
                  onClick={clearCostData}
                  disabled={clearing}
                  className="rounded-lg border border-loss/30 px-2.5 py-1 text-[11px] text-loss/90 hover:text-loss hover:border-loss/50 transition-colors disabled:opacity-50"
                >
                  {clearing ? "Clearing…" : "Clear cost data"}
                </button>
              )}
            </div>

            {!usage || usage.totals.calls === 0 ? (
              <p className="text-xs text-muted py-4">
                No usage recorded yet — telemetry starts with the next research run, chat turn or
                comparison.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  {(
                    [
                      ["Total cost (90d)", fmtUsd(usage.totals.costUsd)],
                      ["Last 30 days", fmtUsd(usage.totals.cost30d)],
                      ["Model calls", usage.totals.calls.toLocaleString()],
                      ["Total tokens", fmtTok(usage.totals.inputTokens + usage.totals.outputTokens)],
                      ["Input tokens", fmtTok(usage.totals.inputTokens)],
                      ["Output tokens", fmtTok(usage.totals.outputTokens)],
                    ] as const
                  ).map(([label, v]) => (
                    <div key={label} className="rounded-xl bg-white/3 border border-hairline px-3.5 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
                      <p className="text-base font-bold tabular-nums mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>

                <DailyChart
                  title="Daily cost — last 30 days"
                  data={filledDays(usage.byDay, 30).map((d) => ({ day: d.day, value: d.costUsd }))}
                  format={fmtUsd}
                />

                <div className="grid sm:grid-cols-2 gap-6">
                  <BarList
                    title="Cost by model"
                    rows={usage.byModel.map((m) => ({
                      label: m.model,
                      value: m.costUsd,
                      detail: `${fmtTok(m.tokens)} tokens · ${m.calls} calls`,
                    }))}
                  />
                  <BarList
                    title="Cost by feature"
                    rows={usage.byFeature.map((f) => ({
                      label: f.feature,
                      value: f.costUsd,
                      detail: `${fmtTok(f.tokens)} tokens · ${f.calls} calls`,
                    }))}
                  />
                </div>

                {/* Cost by user */}
                <div className="overflow-x-auto">
                  <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
                    Cost by user
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted border-b border-hairline">
                        <th className="text-left py-2 font-semibold">User</th>
                        <th className="text-right px-3 py-2 font-semibold">Calls</th>
                        <th className="text-right px-3 py-2 font-semibold">Input</th>
                        <th className="text-right px-3 py-2 font-semibold">Output</th>
                        <th className="text-right px-3 py-2 font-semibold">Cost</th>
                        <th className="text-left pl-3 py-2 font-semibold w-32">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {usage.byUser.map((u) => (
                        <tr key={u.userId}>
                          <td className="py-2 truncate max-w-[220px]">{emailOf(u.userId)}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{u.calls.toLocaleString()}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{fmtTok(u.inputTokens)}</td>
                          <td className="text-right px-3 py-2 tabular-nums">{fmtTok(u.outputTokens)}</td>
                          <td className="text-right px-3 py-2 tabular-nums font-semibold">{fmtUsd(u.costUsd)}</td>
                          <td className="pl-3 py-2">
                            <div className="h-2 rounded-r bg-white/6 overflow-hidden">
                              <div
                                className="h-full rounded-r bg-accent/80"
                                style={{ width: `${Math.max(1.5, (u.costUsd / userCostShareMax) * 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {/* Sign-in cadence */}
          <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
            {logins.length > 0 ? (
              <DailyChart
                title="Sign-ins per day — last 30 days"
                data={filledDays(
                  logins.map((l) => ({ day: l.day, costUsd: l.logins })),
                  30
                ).map((d) => ({ day: d.day, value: d.costUsd }))}
                format={(v) => `${Math.round(v)} sign-in${Math.round(v) === 1 ? "" : "s"}`}
              />
            ) : (
              <p className="text-xs text-muted">
                <span className="text-[10px] uppercase tracking-wider font-semibold">
                  Sign-ins per day
                </span>{" "}
                — no Google sessions yet{authOn === false ? " (single-user mode)" : ""}.
              </p>
            )}
          </section>

          {/* Accounts table */}
          <section className="rounded-2xl bg-card border border-hairline overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted border-b border-hairline">
                    <th className="text-left px-4 py-2.5 font-semibold">Account</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Profile</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Desks</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Signals</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Runs</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Last run</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Msgs</th>
                    <th className="text-right px-3 py-2.5 font-semibold">Trades</th>
                    <th className="text-right px-3 py-2.5 font-semibold" title="Sign-ins, trailing 7 days">
                      Logins 7d
                    </th>
                    <th className="text-right px-3 py-2.5 font-semibold">Feedback</th>
                    <th className="text-right px-3 py-2.5 font-semibold" title="AI cost, trailing 90 days (est.)">
                      Cost 90d
                    </th>
                    <th
                      className="text-right px-3 py-2.5 font-semibold"
                      title="Average AI cost per research run (research-feature spend ÷ runs, trailing 90 days)"
                    >
                      Avg $/run
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map((r) => {
                    const u = usage?.byUser.find((u) => u.userId === r.user.id);
                    const cost = u?.costUsd ?? 0;
                    const avgRun = u?.avgCostPerRun ?? 0;
                    return (
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
                        <td className="px-3 py-2.5 text-muted">
                          {r.profile ? (
                            <span title={(r.profile.industries ?? []).join(", ") || undefined}>
                              {[r.profile.country, r.profile.age ? `${r.profile.age}y` : null]
                                .filter(Boolean)
                                .join(" · ") || "onboarded"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{r.tickers}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{r.activeSignals}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{r.runs}</td>
                        <td className="px-3 py-2.5 text-muted">{r.lastRunAt ? timeAgo(r.lastRunAt) : "never"}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{r.messages}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{r.trades}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{r.logins7d}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{r.feedback}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{cost > 0 ? fmtUsd(cost) : "—"}</td>
                        <td className="text-right px-3 py-2.5 tabular-nums">{avgRun > 0 ? fmtUsd(avgRun) : "—"}</td>
                        <td className="px-3 py-2.5 text-muted">{timeAgo(r.user.lastSeenAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {models && (
            <section className="rounded-2xl bg-card border border-hairline px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                Models in use right now{" "}
                <span className="normal-case tracking-normal font-normal">
                  — auto-selected from each provider&rsquo;s live list; pin per role with
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
            Costs are estimates from provider list prices at call time (cache tiers included).
            Research runs consume tokens per user — watch Cost by user when opening the app up.
          </p>
        </div>
      )}
    </main>
  );
}
