import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import { cookies, headers } from "next/headers";
import { authEnabled, googleEnabled } from "@/lib/auth";
import { isLang, LANG_COOKIE, langFromAcceptLanguage } from "@/lib/i18n/config";
import { translatorFor, type TKey } from "@/lib/i18n/dictionaries";

/**
 * The front door for the B2C app. Server component: reads the error from the
 * query and whether auth is even configured (local mode links straight in).
 * No session yet, so the language comes from the device cookie (or the
 * browser's Accept-Language on a first visit) — same sources as the layout.
 */

/** Known /api/auth/callback failure phrases → localized copy (unknown → raw). */
const AUTH_ERRORS: Record<string, TKey> = {
  "Invalid email or password.": "onboarding.signinErrBadCreds",
  "Google returned no code": "onboarding.signinErrNoCode",
  "Sign-in state mismatch — try again": "onboarding.signinErrState",
  "Could not verify your Google identity": "onboarding.signinErrVerify",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const enabled = authEnabled();
  const google = googleEnabled();
  const jar = await cookies();
  const cookieLang = jar.get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang)
    ? cookieLang
    : langFromAcceptLanguage((await headers()).get("accept-language"));
  const t = translatorFor(lang);
  const errorKey = error ? AUTH_ERRORS[error] : undefined;
  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <p className="text-4xl mb-3">⚖️</p>
        <h1 className="text-3xl font-bold tracking-tight">Scalae</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">{t("onboarding.signinTagline")}</p>

        {error && (
          <p className="mt-5 rounded-xl border border-loss/30 bg-loss/8 px-4 py-2.5 text-xs text-loss">
            {errorKey ? t(errorKey) : error}
          </p>
        )}

        {enabled ? (
          <>
            <form method="POST" action="/api/auth/password" className="mt-7 text-left space-y-2.5">
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder={t("onboarding.signinEmail")}
                className="w-full rounded-xl border border-hairline bg-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
              />
              <PasswordInput
                name="password"
                required
                autoComplete="current-password"
                placeholder={t("onboarding.signinPassword")}
                inputClassName="w-full rounded-xl border border-hairline bg-card px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
                showLabel={t("common.showPassword")}
                hideLabel={t("common.hidePassword")}
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-accent/90 hover:bg-accent text-white font-semibold text-sm px-4 py-2.5 transition-colors"
              >
                {t("onboarding.signinWithPassword")}
              </button>
            </form>
            {google && (
              <>
                <div className="mt-4 flex items-center gap-3 text-[0.6875rem] text-muted/70">
                  <span className="h-px flex-1 bg-hairline" />
                  {t("onboarding.signinOr")}
                  <span className="h-px flex-1 bg-hairline" />
                </div>
                <a
                  href="/api/auth/login"
                  className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-white text-black font-semibold text-sm px-4 py-3 hover:bg-white/90 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6C44.1 38 46.5 31.8 46.5 24.5z" />
                    <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z" />
                    <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
                  </svg>
                  {t("onboarding.signinGoogle")}
                </a>
              </>
            )}
          </>
        ) : (
          <div className="mt-7 rounded-xl border border-hairline bg-card px-4 py-3 text-xs text-muted text-left leading-relaxed">
            <p className="font-semibold text-emph">{t("onboarding.signinSingleUserTitle")}</p>
            <p className="mt-1">{t("onboarding.signinSingleUserDesc")}</p>
            <Link href="/" className="mt-2 inline-block text-accent font-medium">
              {t("onboarding.signinLocalContinue")}
            </Link>
          </div>
        )}

        <p className="mt-6 text-[0.625rem] text-muted/60">
          {t("common.notAdvice")} {t("onboarding.signinPrivacy")}
        </p>
      </div>
    </main>
  );
}
