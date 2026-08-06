"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePrefs } from "@/components/PrefsProvider";
import { api } from "@/components/util";
import { langLabel, type Lang, type Theme } from "@/lib/i18n/config";

/**
 * Settings: how the app behaves — language, appearance, research spend,
 * support. Personal information lives at /profile (the dashboard's avatar);
 * the gear lands here. Sign-in stays at /signin and the admin console at
 * /admin (server-gated, deliberately unadvertised).
 */
export default function SettingsPage() {
  const { t, lang, theme, setLang, setTheme } = usePrefs();
  const [autoResearch, setAutoResearch] = useState<boolean | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);

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

  const THEME_OPTIONS: { value: Theme; label: string }[] = [
    { value: "dark", label: t("settings.themeDark") },
    { value: "light", label: t("settings.themeLight") },
    { value: "system", label: t("settings.themeSystem") },
  ];

  const segBtn = (active: boolean) =>
    `rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors border ${
      active
        ? "bg-accent/15 border-accent/40 text-accent"
        : "bg-ink/4 border-hairline text-muted hover:text-foreground hover:bg-ink/8"
    }`;

  return (
    <main className="w-full px-5 sm:px-6 lg:px-8 py-8 flex-1">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity">
          {t("common.backToWatchlist")}
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">{t("settings.title")}</h1>
          <p className="text-muted text-xs">{t("settings.subtitle")}</p>
        </div>
      </header>

      <div className="space-y-5">
        {/* Language */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold mb-3">
            {t("settings.sectionLanguage")}
          </p>
          <div className="flex items-center gap-2">
            {(["en", "zh"] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={segBtn(lang === l)} aria-pressed={lang === l}>
                {langLabel(l)}
              </button>
            ))}
          </div>
          <p className="text-[0.6875rem] text-muted mt-2.5 leading-snug">{t("settings.languageDesc")}</p>
        </section>

        {/* Appearance */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold mb-3">
            {t("settings.sectionAppearance")}
          </p>
          <div className="flex items-center gap-2">
            {THEME_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setTheme(o.value)}
                className={segBtn(theme === o.value)}
                aria-pressed={theme === o.value}
              >
                {o.value === "dark" && "🌙 "}
                {o.value === "light" && "☀️ "}
                {o.value === "system" && "🖥 "}
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[0.6875rem] text-muted mt-2.5 leading-snug">{t("settings.appearanceDesc")}</p>
        </section>

        {/* Research preferences */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold mb-3">
            {t("settings.sectionResearch")}
          </p>
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
        </section>

        {/* Profile & account moved to /profile */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold mb-3">
            {t("settings.profileCardTitle")}
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-ink/4 hover:bg-ink/8 px-3.5 py-2 text-xs font-semibold transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M4 20c1.4-3.4 4.4-5 8-5s6.6 1.6 8 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t("settings.openProfile")}
          </Link>
          <p className="text-[0.6875rem] text-muted mt-2 leading-snug">{t("settings.profileCardDesc")}</p>
        </section>

        {/* Help & feedback */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold mb-3">
            {t("settings.sectionSupport")}
          </p>
          <Link
            href="/support"
            className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-ink/4 hover:bg-ink/8 px-3.5 py-2 text-xs font-semibold transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.4-.7L3 21l1.8-4.3a8.4 8.4 0 1 1 16.2-5.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            {t("settings.helpFeedback")}
          </Link>
          <p className="text-[0.6875rem] text-muted mt-2 leading-snug">{t("settings.supportDesc")}</p>
        </section>

        <p className="text-[0.625rem] text-muted/60">{t("common.notAdvice")}</p>
      </div>
    </main>
  );
}
