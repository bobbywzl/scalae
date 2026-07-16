"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AddTicker } from "@/components/AddTicker";
import { Sparkline } from "@/components/Sparkline";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { useT } from "@/components/PrefsProvider";
import { api, fmtPct, fmtPrice } from "@/components/util";
import type { WatchlistRow } from "@/lib/types";

export default function WatchlistPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const [rows, setRows] = useState<WatchlistRow[] | null>(null);
  const [today, setToday] = useState("");
  const [autoResearch, setAutoResearch] = useState<boolean | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);
  const [splash, setSplash] = useState(false);
  const [me, setMe] = useState<{
    authEnabled: boolean;
    needsOnboarding?: boolean;
    user: { name: string; email: string; picture: string; role: string } | null;
  } | null>(null);

  useEffect(() => {
    // The greeting moment — once per browser session, decided before data
    // lands. Only ever upgrades false→true, so StrictMode's double-run of
    // effects can't cancel it.
    try {
      if (sessionStorage.getItem("scalae_splash") === "1") return;
      sessionStorage.setItem("scalae_splash", "1");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSplash(true);
    } catch {
      /* storage blocked — skip the splash */
    }
  }, []);

  useEffect(() => {
    api<{
      authEnabled: boolean;
      needsOnboarding?: boolean;
      user: { name: string; email: string; picture: string; role: string } | null;
    }>("/api/auth/me")
      .then((m) => {
        setMe(m);
        // Brand-new account → the /welcome intake sets up their first desks.
        if (m.needsOnboarding) router.replace("/welcome");
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    // Formatted client-side only: server/browser locales differ and break hydration.
    setToday(
      new Date().toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })
    );
  }, [locale]);

  const load = useCallback(async () => {
    try {
      const { rows } = await api<{ rows: WatchlistRow[] }>("/api/tickers");
      setRows(rows);
    } catch {
      /* keep last state */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

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

  // The token-budget lever: gates the cron AND stale-desk auto-runs (server-
  // enforced for the cron). Manual runs and explicit chat asks still work.
  async function toggleAutoResearch() {
    if (autoResearch === null || savingAuto) return;
    const next = !autoResearch;
    setSavingAuto(true);
    setAutoResearch(next); // optimistic
    try {
      await api(`/api/settings`, { method: "POST", body: JSON.stringify({ autoResearch: next }) });
    } catch {
      setAutoResearch(!next); // revert on failure
    } finally {
      setSavingAuto(false);
    }
  }

  async function remove(symbol: string) {
    if (!confirm(t("watchlist.removeConfirm", { sym: symbol }))) return;
    await api(`/api/tickers/${symbol}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 flex-1">
      {splash && <WelcomeSplash name={me?.user?.name} onDone={() => setSplash(false)} />}
      <header className="mb-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-muted text-sm font-medium min-h-5">{today}</p>
            <h1 className="text-3xl font-bold tracking-tight">Scalae</h1>
            <p className="text-muted text-sm mt-1">{t("watchlist.tagline")}</p>
          </div>
          <div className="shrink-0 mt-5 flex items-center gap-2">
            {(rows?.length ?? 0) >= 2 && (
              <Link
                href="/compare"
                title={t("watchlist.compareTitle")}
                className="flex items-center gap-2 rounded-xl bg-card border border-hairline hover:border-ink/25 hover:bg-ink/4 px-3 py-2 transition-colors"
              >
                <span className="text-accent text-sm leading-none">⇄</span>
                <span className="text-xs font-semibold">{t("watchlist.compare")}</span>
              </Link>
            )}
            <Link
              href="/portfolio"
              title={t("watchlist.portfolioTitle")}
              className="flex items-center gap-2 rounded-xl bg-card border border-hairline hover:border-ink/25 hover:bg-ink/4 px-3 py-2 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" />
                <path d="M3 12h18" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span className="text-xs font-semibold">{t("watchlist.portfolio")}</span>
            </Link>
            {/* Who you are → /profile; how the app behaves → /settings. */}
            <Link
              href="/profile"
              title={
                me?.user
                  ? t("watchlist.profileLinkTitle", { name: me.user.name || me.user.email })
                  : t("watchlist.profileLinkTitleAnon")
              }
              className="flex items-center rounded-xl bg-card border border-hairline hover:border-ink/25 hover:bg-ink/4 p-2 transition-colors text-muted hover:text-foreground"
            >
              {me?.authEnabled && me.user?.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.user.picture} alt="" className="h-5 w-5 rounded-full" />
              ) : me?.authEnabled && me.user ? (
                <span className="h-5 w-5 rounded-full bg-ink/10 flex items-center justify-center text-[10px]">
                  {me.user.name[0]?.toUpperCase()}
                </span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-label={t("common.profile")}>
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M4 20c1.4-3.4 4.4-5 8-5s6.6 1.6 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </Link>
            <Link
              href="/settings"
              title={t("watchlist.settingsLinkTitle")}
              className="flex items-center rounded-xl bg-card border border-hairline hover:border-ink/25 hover:bg-ink/4 p-2 transition-colors text-muted hover:text-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-label={t("common.settings")}>
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.12-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.85a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10.05 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01c.26.62.86 1.03 1.53 1.03H21a2 2 0 1 1 0 4h-.09c-.67 0-1.27.4-1.51 1.03Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </Link>
            {me?.authEnabled && me.user && (
              <a
                href="/api/auth/logout"
                title={t("common.signOut")}
                className="flex items-center rounded-xl bg-card border border-hairline hover:border-loss/40 p-2 transition-colors text-muted hover:text-loss"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-label={t("common.signOut")}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Auto daily research switch — the token spend lever. */}
        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-card border border-hairline px-3.5 py-2.5">
          <button
            role="switch"
            aria-checked={autoResearch === true}
            disabled={autoResearch === null || savingAuto}
            onClick={toggleAutoResearch}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              autoResearch ? "bg-gain" : "bg-ink/15"
            }`}
            title={autoResearch ? t("watchlist.autoTurnOff") : t("watchlist.autoTurnOn")}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                autoResearch ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold">
              {t("watchlist.autoTitle")}{" "}
              <span className={autoResearch ? "text-gain" : "text-muted"}>
                {autoResearch === null ? "…" : autoResearch ? t("common.on") : t("common.off")}
              </span>
            </p>
            <p className="text-[11px] text-muted leading-snug">
              {autoResearch === false ? t("watchlist.autoOffDesc") : t("watchlist.autoOnDesc")}
            </p>
          </div>
        </div>
      </header>

      <AddTicker />

      <section className="mt-6">
        {rows === null ? (
          <div className="text-muted text-sm py-16 text-center">{t("watchlist.loadingList")}</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-medium">{t("watchlist.empty")}</p>
            <p className="text-muted text-sm mt-2 max-w-sm mx-auto">{t("watchlist.emptyHint")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-hairline rounded-2xl bg-card border border-hairline overflow-hidden">
            {rows.map(({ ticker, quote, activeCount, suggestedCount, running, stale, position }) => {
              const up = (quote?.changePercent ?? 0) >= 0;
              const held = position && (position.stock || position.options.length > 0);
              return (
                <li key={ticker.symbol} className="group relative">
                  <Link
                    href={`/t/${encodeURIComponent(ticker.symbol)}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink/4 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {ticker.symbol}
                        {held && (
                          <span
                            className={`ml-2 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide align-middle ${
                              (position!.unrealized ?? 0) >= 0
                                ? "bg-gain/15 text-gain"
                                : "bg-loss/15 text-loss"
                            }`}
                            title={
                              position!.stock
                                ? `${Math.abs(position!.stock.qty)} shares @ ${position!.stock.avgCost.toFixed(2)} avg${
                                    position!.options.length ? ` + ${position!.options.length} option leg(s)` : ""
                                  }`
                                : `${position!.options.length} option leg(s)`
                            }
                          >
                            {t("watchlist.held")}
                            {position!.stock?.unrealizedPct != null &&
                              ` ${position!.stock.unrealizedPct >= 0 ? "+" : ""}${position!.stock.unrealizedPct.toFixed(1)}%`}
                          </span>
                        )}
                      </div>
                      <div className="text-muted text-xs truncate">{ticker.name}</div>
                      <div className="text-[11px] mt-1 flex items-center gap-2">
                        {!ticker.onboarded ? (
                          <span className="text-accent">{t("watchlist.setUp")}</span>
                        ) : (
                          <>
                            <span className="text-muted">
                              {t("watchlist.nSignals", { n: activeCount })}
                            </span>
                            {suggestedCount > 0 && (
                              <span className="text-warn">
                                {suggestedCount > 1
                                  ? t("watchlist.proposalsToReviewMany", { n: suggestedCount })
                                  : t("watchlist.proposalsToReview", { n: suggestedCount })}
                              </span>
                            )}
                            {running && (
                              <span className="text-accent pulse-soft">{t("watchlist.researching")}</span>
                            )}
                            {stale && !running && (
                              <span className="text-muted/70">{t("watchlist.researchDue")}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <Sparkline data={quote?.spark ?? []} positive={up} />
                    <div className="text-right w-24 shrink-0">
                      <div className="font-medium tabular-nums">
                        {fmtPrice(quote?.price, quote?.currency)}
                      </div>
                      {quote?.price != null &&
                        quote.currency &&
                        quote.currency !== "USD" &&
                        quote.fxToUsd != null && (
                          <div className="text-[10px] text-muted tabular-nums">
                            ≈ {fmtPrice(quote.price * quote.fxToUsd, "USD")}
                          </div>
                        )}
                      <div
                        className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums text-chipfg ${
                          up ? "bg-gain" : "bg-loss"
                        }`}
                      >
                        {fmtPct(quote?.changePercent)}
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      remove(ticker.symbol);
                    }}
                    title={t("watchlist.removeTitle", { sym: ticker.symbol })}
                    className="absolute -left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted hover:text-loss px-1 text-xs transition-opacity"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="mt-10 text-center text-[11px] text-muted/60">
        {t("watchlist.footer")} {t("common.notAdvice")}{" "}
        <Link href="/support" className="text-muted hover:text-foreground underline underline-offset-2 transition-colors">
          {t("watchlist.sendFeedback")}
        </Link>
      </footer>
    </main>
  );
}
