/**
 * Locale & theme primitives shared by server (layout, API routes) and client
 * (PrefsProvider). Keep this file dependency-free — it is imported from both
 * worlds.
 *
 * The user's choices live in two places, deliberately:
 *   - per-account settings rows ("language", "theme") — the durable source;
 *   - readable cookies (scalae_lang / scalae_theme) — the per-device fast path
 *     the root layout reads to render <html lang data-theme> without a DB hit
 *     (and before any fetch, so there is no flash of the wrong language/theme).
 * POST /api/settings writes both; the client provider re-syncs from the
 * account on load, so a new device converges after the first paint.
 */

export type Lang = "en" | "zh";
export type Theme = "dark" | "light" | "system";

export const LANGS: readonly Lang[] = ["en", "zh"] as const;
export const THEMES: readonly Theme[] = ["dark", "light", "system"] as const;

export const DEFAULT_LANG: Lang = "en";
export const DEFAULT_THEME: Theme = "dark";

export const LANG_COOKIE = "scalae_lang";
export const THEME_COOKIE = "scalae_theme";
/** One year — preference cookies, not sessions. */
export const PREF_COOKIE_MAX_AGE = 365 * 24 * 3600;

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "zh";
}

export function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light" || v === "system";
}

/** Value for the <html lang> attribute. */
export function htmlLangOf(lang: Lang): string {
  return lang === "zh" ? "zh-CN" : "en";
}

/** BCP-47 locale for Date/number formatting. */
export function localeOf(lang: Lang): string {
  return lang === "zh" ? "zh-CN" : "en-US";
}

/** Human-readable name of a language, in that language (for pickers). */
export function langLabel(lang: Lang): string {
  return lang === "zh" ? "中文（简体）" : "English";
}

/**
 * Pick a default language from an Accept-Language header — first-visit
 * default only; any explicit choice (cookie / account setting) wins over this.
 */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    if (tag === "zh" || tag.startsWith("zh-")) return "zh";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return DEFAULT_LANG;
}
