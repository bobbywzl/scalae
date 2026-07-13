import { NextResponse } from "next/server";
import { autoResearchEnabled, getSetting, setSetting } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  isLang,
  isTheme,
  LANG_COOKIE,
  PREF_COOKIE_MAX_AGE,
  THEME_COOKIE,
} from "@/lib/i18n/config";

/**
 * App-level settings: the auto daily-research switch, plus the language and
 * theme preferences. Language/theme persist twice on purpose — the account
 * row is the durable source, and a readable cookie lets the root layout
 * render <html lang data-theme> with no DB lookup (and lets a signed-out
 * layout render still look right).
 */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [autoResearch, language, theme] = await Promise.all([
    autoResearchEnabled(user.id),
    getSetting(user.id, "language"),
    getSetting(user.id, "theme"),
  ]);
  return NextResponse.json({
    autoResearch,
    language: isLang(language) ? language : null,
    theme: isTheme(theme) ? theme : null,
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    autoResearch?: unknown;
    language?: unknown;
    theme?: unknown;
  };

  const updates: Record<string, boolean | string> = {};
  if (body.autoResearch !== undefined) {
    if (typeof body.autoResearch !== "boolean") {
      return NextResponse.json({ error: "autoResearch must be a boolean" }, { status: 400 });
    }
    await setSetting(user.id, "autoResearch", body.autoResearch ? "on" : "off");
    updates.autoResearch = body.autoResearch;
  }
  if (body.language !== undefined) {
    if (!isLang(body.language)) {
      return NextResponse.json({ error: "language must be 'en' or 'zh'" }, { status: 400 });
    }
    await setSetting(user.id, "language", body.language);
    updates.language = body.language;
  }
  if (body.theme !== undefined) {
    if (!isTheme(body.theme)) {
      return NextResponse.json({ error: "theme must be 'dark', 'light' or 'system'" }, { status: 400 });
    }
    await setSetting(user.id, "theme", body.theme);
    updates.theme = body.theme;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "nothing to update — send autoResearch, language and/or theme" },
      { status: 400 }
    );
  }

  const res = NextResponse.json(updates);
  const cookieOpts = { path: "/", maxAge: PREF_COOKIE_MAX_AGE, sameSite: "lax" as const };
  if (typeof updates.language === "string") res.cookies.set(LANG_COOKIE, updates.language, cookieOpts);
  if (typeof updates.theme === "string") res.cookies.set(THEME_COOKIE, updates.theme, cookieOpts);
  return res;
}
