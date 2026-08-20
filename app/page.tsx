"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AddTicker } from "@/components/AddTicker";
import { BriefcaseIcon, SwapIcon, XIcon } from "@/components/icons";
import { Sparkline } from "@/components/Sparkline";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { useT } from "@/components/PrefsProvider";
import { api, fmtPct, fmtPrice } from "@/components/util";
import type { WatchlistRow } from "@/lib/types";

export default function WatchlistPage() {
  const router = useRouter();
  const { t, lang, locale } = useT();
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
  const [profile, setProfile] = useState<{
    name?: string;
    age?: number;
    country?: string;
    industries?: string[];
  } | null>(null);

  useEffect(() => {
    api<{ profile: { name?: string; age?: number; country?: string; industries?: string[] } | null }>(
      "/api/profile"
    )
      .then((p) => setProfile(p.profile ?? null))
      .catch(() => {});
  }, []);

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
    // Egress-aware polling: a hidden tab polls nothing (long-lived open tabs
    // were quietly draining the database's transfer quota), and an idle
    // watchlist needs freshness in minutes, not seconds. Returning to the
    // tab refreshes immediately.
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 120_000);
    const onVisibility = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
    <main className="w-full px-5 sm:px-6 lg:px-8 py-10 flex-1">
      {splash && <WelcomeSplash name={me?.user?.name} onDone={() => setSplash(false)} />}
      <header className="mb-6">
        <p className="text-muted text-sm font-medium min-h-5">{today}</p>
        <h1 className="text-3xl font-bold tracking-tight">Scalae</h1>
        <p className="text-muted text-sm mt-1">{t("watchlist.tagline")}</p>
      </header>

      {/* The dashboard: watchlist on the left, who-you-are & how-the-app-
          behaves on the right — side by side, everything in view. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem] items-start">
        <div className="min-w-0">
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
                            className={`ml-2 rounded px-1.5 py-px text-[0.5625rem] font-bold uppercase tracking-wide align-middle ${
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
                      <div className="text-[0.6875rem] mt-1 flex items-center gap-2">
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
                          <div className="text-[0.625rem] text-muted tabular-nums">
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
                    className="absolute -left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted hover:text-loss px-1 transition-opacity"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
          </section>
        </div>

        {/* Right rail: account, investor profile, preferences, tools. */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          {/* Account */}
          <div className="rounded-2xl bg-card border border-hairline p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold">
                {t("watchlist.dashAccount")}
              </p>
              {me?.authEnabled && me.user && (
                <a
                  href="/api/auth/logout"
                  className="text-[0.6875rem] text-muted hover:text-loss transition-colors"
                >
                  {t("common.signOut")}
                </a>
              )}
              {me?.authEnabled && !me.user && (
                <a href="/signin" className="text-[0.6875rem] font-semibold text-accent hover:underline">
                  {t("common.signIn")}
                </a>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              {me?.authEnabled && me.user?.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.user.picture} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <span className="h-10 w-10 rounded-full bg-ink/10 flex items-center justify-center text-sm font-semibold">
                  {(me?.user?.name || profile?.name || "S")[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {me?.user?.name || profile?.name || "Scalae"}
                </p>
                <p className="text-[0.6875rem] text-muted truncate">
                  {me?.user?.email ||
                    (me?.authEnabled ? t("watchlist.dashSignedOut") : t("watchlist.dashSingleUser"))}
                </p>
              </div>
            </div>
            <Link
              href="/profile"
              className="mt-3 block rounded-lg bg-ink/6 hover:bg-ink/10 text-center text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {t("watchlist.dashEditProfile")}
            </Link>
          </div>

          {/* Investor profile */}
          <div className="rounded-2xl bg-card border border-hairline p-4">
            <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold">
              {t("watchlist.dashProfile")}
            </p>
            {profile && (profile.name || profile.country || profile.age || (profile.industries?.length ?? 0) > 0) ? (
              <div className="mt-2 space-y-1.5">
                {(profile.name || profile.age != null || profile.country) && (
                  <p className="text-xs">
                    {profile.name && <span className="font-medium">{profile.name}</span>}
                    {(profile.age != null || profile.country) && (
                      <span className="text-muted">
                        {profile.name ? " · " : ""}
                        {[profile.age, profile.country].filter((v) => v != null && v !== "").join(" · ")}
                      </span>
                    )}
                  </p>
                )}
                {(profile.industries?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {profile.industries!.map((ind) => (
                      <span
                        key={ind}
                        className="rounded-full bg-ink/6 border border-hairline px-2 py-0.5 text-[0.625rem] text-emph"
                      >
                        {ind}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-[0.6875rem] text-muted leading-snug">{t("watchlist.dashNoProfile")}</p>
            )}
          </div>

          {/* Preferences — the auto-research lever + language, with settings a tap away. */}
          <div className="rounded-2xl bg-card border border-hairline p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold">
                {t("watchlist.dashPreferences")}
              </p>
              <Link href="/settings" className="text-[0.6875rem] text-accent hover:opacity-80 transition-opacity">
                {t("common.settings")} →
              </Link>
            </div>
            <div className="flex items-center gap-2.5">
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
                <p className="text-[0.6875rem] text-muted leading-snug">
                  {autoResearch === false ? t("watchlist.autoOffDesc") : t("watchlist.autoOnDesc")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-hairline pt-2.5 text-xs">
              <span className="text-muted">{t("watchlist.dashLanguage")}</span>
              <span className="font-medium">{lang === "zh" ? "简体中文" : "English"}</span>
            </div>
          </div>

          {/* Tools */}
          <div className="rounded-2xl bg-card border border-hairline p-4">
            <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold">
              {t("watchlist.dashTools")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link
                href="/portfolio"
                title={t("watchlist.portfolioTitle")}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-ink/6 hover:bg-ink/10 px-3 py-2 text-xs font-medium transition-colors"
              >
                <BriefcaseIcon className="h-3.5 w-3.5 text-accent" /> {t("watchlist.portfolio")}
              </Link>
              {(rows?.length ?? 0) >= 2 ? (
                <Link
                  href="/compare"
                  title={t("watchlist.compareTitle")}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-ink/6 hover:bg-ink/10 px-3 py-2 text-xs font-medium transition-colors"
                >
                  <SwapIcon className="h-3.5 w-3.5 text-accent" /> {t("watchlist.compare")}
                </Link>
              ) : (
                <Link
                  href="/support"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-ink/6 hover:bg-ink/10 px-3 py-2 text-xs font-medium transition-colors"
                >
                  {t("watchlist.sendFeedback")}
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>

      <footer className="mt-10 text-center text-[0.6875rem] text-muted/60">
        {t("watchlist.footer")} {t("common.notAdvice")}{" "}
        <Link href="/support" className="text-muted hover:text-foreground underline underline-offset-2 transition-colors">
          {t("watchlist.sendFeedback")}
        </Link>
      </footer>
    </main>
  );
}
