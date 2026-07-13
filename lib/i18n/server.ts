import { cookies } from "next/headers";
import { getSetting } from "../db";
import { DEFAULT_LANG, isLang, LANG_COOKIE, type Lang } from "./config";

/**
 * The language a request should be served in: the device cookie when present
 * (kept in sync by /api/settings), else the account setting, else English.
 * Safe outside a request scope (cron/after callbacks) — falls back to the
 * account setting there.
 */
export async function requestLang(userId: string): Promise<Lang> {
  try {
    const jar = await cookies();
    const c = jar.get(LANG_COOKIE)?.value;
    if (isLang(c)) return c;
  } catch {
    /* no request scope (e.g. cron) — use the account setting */
  }
  const stored = await getSetting(userId, "language").catch(() => null);
  return isLang(stored) ? stored : DEFAULT_LANG;
}
