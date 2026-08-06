"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/PrefsProvider";
import { api } from "@/components/util";

interface ProfilePayload {
  authEnabled: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    picture: string;
    role: string;
    createdAt: string;
  };
  profile: {
    name?: string;
    age?: number;
    country?: string;
    industries?: string[];
    onboardedAt?: string;
  } | null;
}

/**
 * Profile: who you are — the Google account identity and the editable
 * investor profile the analyst reads for context. Preferences (language,
 * theme, research) live in /settings; the dashboard's avatar lands here,
 * the gear there.
 */
export default function ProfilePage() {
  const { t, locale } = useT();
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [industries, setIndustries] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle");

  useEffect(() => {
    api<ProfilePayload>("/api/profile")
      .then((p) => {
        setData(p);
        setName(p.profile?.name ?? "");
        setAge(p.profile?.age != null ? String(p.profile.age) : "");
        setCountry(p.profile?.country ?? "");
        setIndustries((p.profile?.industries ?? []).join(", "));
      })
      .catch(() => {});
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveState("idle");
    try {
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name,
          age: age.trim() ? Number(age) : undefined,
          country,
          industries: industries
            .split(/[,，、]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    } finally {
      setSaving(false);
    }
  }

  const user = data?.user;
  const inputCls =
    "w-full rounded-xl bg-ink/4 border border-hairline focus:border-accent/60 outline-none px-3.5 py-2 text-sm transition-colors";

  return (
    <main className="w-full px-5 sm:px-6 lg:px-8 py-8 flex-1">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity">
          {t("common.backToWatchlist")}
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">{t("settings.profileTitle")}</h1>
          <p className="text-muted text-xs">{t("settings.profileSubtitle")}</p>
        </div>
        <Link
          href="/settings"
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-card border border-hairline hover:border-ink/25 hover:bg-ink/4 px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.12-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.85a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10.05 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01c.26.62.86 1.03 1.53 1.03H21a2 2 0 1 1 0 4h-.09c-.67 0-1.27.4-1.51 1.03Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          {t("settings.openSettings")}
        </Link>
      </header>

      <div className="space-y-5">
        {/* Account identity */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold mb-3">
            {t("settings.sectionAccount")}
          </p>
          {data === null ? (
            <p className="text-muted text-sm py-2">{t("common.loading")}</p>
          ) : user && data.authEnabled ? (
            <div className="flex items-center gap-4">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt="" className="h-14 w-14 rounded-full shrink-0" />
              ) : (
                <span className="h-14 w-14 rounded-full bg-ink/10 flex items-center justify-center text-xl font-semibold shrink-0">
                  {(user.name || user.email)[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {user.name || user.email}
                  {user.role === "admin" && (
                    <span className="ml-2 rounded bg-accent/15 text-accent px-1.5 py-px text-[0.5625rem] uppercase tracking-wider align-middle">
                      {t("settings.adminBadge")}
                    </span>
                  )}
                </p>
                <p className="text-muted text-xs truncate">{user.email}</p>
                {user.createdAt && (
                  <p className="text-muted/70 text-[0.6875rem] mt-0.5">
                    {t("settings.memberSince", {
                      date: new Date(user.createdAt).toLocaleDateString(locale, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }),
                    })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted leading-relaxed">
              <p className="font-semibold text-emph">{t("settings.singleUserTitle")}</p>
              <p className="mt-1">{t("settings.singleUserDesc")}</p>
            </div>
          )}
        </section>

        {/* Investor profile (editable) */}
        <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
          <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold mb-1">
            {t("settings.sectionInvestor")}
          </p>
          <p className="text-[0.6875rem] text-muted mb-3 leading-snug">{t("settings.investorDesc")}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[0.6875rem] text-muted font-medium">{t("settings.fieldName")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-1`} maxLength={60} />
            </label>
            <label className="block">
              <span className="text-[0.6875rem] text-muted font-medium">{t("settings.fieldAge")}</span>
              <input
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                className={`${inputCls} mt-1`}
                maxLength={3}
              />
            </label>
            <label className="block">
              <span className="text-[0.6875rem] text-muted font-medium">{t("settings.fieldCountry")}</span>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={`${inputCls} mt-1`} maxLength={60} />
            </label>
            <label className="block">
              <span className="text-[0.6875rem] text-muted font-medium">{t("settings.fieldIndustries")}</span>
              <input
                value={industries}
                onChange={(e) => setIndustries(e.target.value)}
                placeholder={t("settings.industriesHint")}
                className={`${inputCls} mt-1 placeholder:text-muted/60`}
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || data === null}
              className="rounded-xl bg-accent/90 hover:bg-accent text-white text-xs font-semibold px-4 py-2 disabled:opacity-50 transition-colors"
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
            {saveState === "saved" && <span className="text-gain text-xs">{t("settings.profileSaved")}</span>}
            {saveState === "failed" && <span className="text-loss text-xs">{t("settings.profileSaveFailed")}</span>}
          </div>
        </section>

        {/* Account actions */}
        {data?.authEnabled && user && (
          <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
            <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold mb-3">
              {t("settings.sectionAccount")}
            </p>
            <a
              href="/api/auth/logout"
              className="inline-flex items-center gap-2 rounded-xl border border-loss/30 bg-loss/8 px-3.5 py-2 text-xs font-semibold text-loss hover:bg-loss/15 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("common.signOut")}
            </a>
            <p className="text-[0.6875rem] text-muted mt-2 leading-snug">{t("settings.signOutDesc")}</p>
          </section>
        )}

        <p className="text-[0.625rem] text-muted/60">{t("common.notAdvice")}</p>
      </div>
    </main>
  );
}
