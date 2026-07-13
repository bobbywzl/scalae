import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { PrefsProvider } from "@/components/PrefsProvider";
import {
  DEFAULT_THEME,
  htmlLangOf,
  isLang,
  isTheme,
  LANG_COOKIE,
  langFromAcceptLanguage,
  THEME_COOKIE,
  type Lang,
  type Theme,
} from "@/lib/i18n/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Language & theme resolve from readable preference cookies (kept in sync
 * with the per-account setting by /api/settings and PrefsProvider), so the
 * first paint is already localized and themed — no flash, no client fetch.
 * First-ever visit falls back to the browser's Accept-Language.
 * Reading cookies makes every route dynamic; the app is fully dynamic
 * (per-user, client-fetched) anyway.
 */
async function requestPrefs(): Promise<{ lang: Lang; theme: Theme }> {
  const jar = await cookies();
  const langCookie = jar.get(LANG_COOKIE)?.value;
  const themeCookie = jar.get(THEME_COOKIE)?.value;
  const lang = isLang(langCookie)
    ? langCookie
    : langFromAcceptLanguage((await headers()).get("accept-language"));
  const theme = isTheme(themeCookie) ? themeCookie : DEFAULT_THEME;
  return { lang, theme };
}

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await requestPrefs();
  if (lang === "zh") {
    return {
      title: "Scalae — 价值投资者情报台",
      description:
        "长期来看，市场是一台称重机。Scalae 是为价值投资者打造的每日 AI 研究台：实时信号、新闻摘要，以及以巴菲特/芒格框架对您持有的每一只股票进行的尽职调查。",
    };
  }
  return {
    title: "Scalae — value-investor intelligence desk",
    description:
      "In the long run, the market is a weighing machine. Scalae is a daily AI research desk for value investors: live signals, news digests, and Buffett/Munger-framework due diligence for every ticker you own.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { lang, theme } = await requestPrefs();
  return (
    <html
      lang={htmlLangOf(lang)}
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PrefsProvider initialLang={lang} initialTheme={theme}>
          {children}
        </PrefsProvider>
      </body>
    </html>
  );
}
