"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  htmlLangOf,
  isLang,
  isTheme,
  LANG_COOKIE,
  localeOf,
  PREF_COOKIE_MAX_AGE,
  THEME_COOKIE,
  type Lang,
  type Theme,
} from "@/lib/i18n/config";
import { translate, type TFunc } from "@/lib/i18n/dictionaries";
import { api } from "./util";

/**
 * App-wide preferences (language + theme), hydrated from the cookies the root
 * layout already rendered <html lang data-theme> with — so first paint is in
 * the right language and theme with no flash. Switching is instant (context
 * re-render + <html> attributes + cookie) and persisted to the account via
 * POST /api/settings; on mount we re-sync from the account so a second device
 * converges on the same preferences after its first load.
 */

interface Prefs {
  lang: Lang;
  theme: Theme;
  /** BCP-47 locale for toLocale*String calls ("en-US" | "zh-CN"). */
  locale: string;
  t: TFunc;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
}

const PrefsContext = createContext<Prefs | null>(null);

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${PREF_COOKIE_MAX_AGE}; samesite=lax`;
}

function applyLangAttr(lang: Lang) {
  document.documentElement.lang = htmlLangOf(lang);
}

function applyThemeAttr(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function PrefsProvider({
  initialLang,
  initialTheme,
  children,
}: {
  initialLang: Lang;
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  // Once the user picks in this session, the account-sync effect must not
  // clobber their choice with a stale fetch result.
  const touched = useRef(false);

  const setLang = useCallback((l: Lang) => {
    touched.current = true;
    setLangState(l);
    applyLangAttr(l);
    writeCookie(LANG_COOKIE, l);
    api("/api/settings", { method: "POST", body: JSON.stringify({ language: l }) }).catch(() => {});
  }, []);

  const setTheme = useCallback((t: Theme) => {
    touched.current = true;
    setThemeState(t);
    applyThemeAttr(t);
    writeCookie(THEME_COOKIE, t);
    api("/api/settings", { method: "POST", body: JSON.stringify({ theme: t }) }).catch(() => {});
  }, []);

  // Converge on the account's stored preferences (new device / cleared
  // cookies). Explicit in-session choices win; missing account values keep
  // the cookie/header-derived defaults the layout rendered with.
  useEffect(() => {
    let cancelled = false;
    api<{ language?: string | null; theme?: string | null }>("/api/settings")
      .then((s) => {
        if (cancelled || touched.current) return;
        if (isLang(s.language) && s.language !== initialLang) {
          setLangState(s.language);
          applyLangAttr(s.language);
          writeCookie(LANG_COOKIE, s.language);
        }
        if (isTheme(s.theme) && s.theme !== initialTheme) {
          setThemeState(s.theme);
          applyThemeAttr(s.theme);
          writeCookie(THEME_COOKIE, s.theme);
        }
      })
      .catch(() => {
        /* signed out or offline — cookie defaults stand */
      });
    return () => {
      cancelled = true;
    };
  }, [initialLang, initialTheme]);

  const t = useCallback<TFunc>((key, params) => translate(lang, key, params), [lang]);

  const value = useMemo<Prefs>(
    () => ({ lang, theme, locale: localeOf(lang), t, setLang, setTheme }),
    [lang, theme, t, setLang, setTheme]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider (app/layout.tsx)");
  return ctx;
}

/** The common case: just the translator (+ locale for date/number formats). */
export function useT(): { t: TFunc; lang: Lang; locale: string } {
  const { t, lang, locale } = usePrefs();
  return { t, lang, locale };
}
