import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserByEmail } from "./db";

/**
 * The admin gate — a standalone email+password sign-in for the /admin console,
 * completely separate from the consumer Google flow (a user of the app and an
 * admin of the app are different roles; an admin need not be a Google user).
 *
 * Modeled on release-edu's admin system: a shared ADMIN_PASSWORD is the secret,
 * and access is scoped to an authorized-email allow-list. Two things must hold
 * to be in:
 *   1. the entered password equals ADMIN_PASSWORD, and
 *   2. the entered email is authorized — in the ADMIN_EMAILS env list, or the
 *      email of a User whose role is "admin" (a LIVE db check, so promoting a
 *      user to admin takes effect immediately, no re-login).
 *
 * On success we set an httpOnly cookie holding the admin's email, signed (HMAC)
 * with ADMIN_PASSWORD so it can't be forged and so rotating the password
 * invalidates every outstanding admin session. With ADMIN_PASSWORD unset the
 * gate refuses all logins (no publicly-guessable default) — /admin is sealed.
 */

export const ADMIN_COOKIE = "scalae_admin";

export function adminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

export function envAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Constant-time check of a submitted password against ADMIN_PASSWORD. */
export function verifyAdminPassword(password: string): boolean {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  return safeEqual(password, secret);
}

/** Is this email allowed to be an admin? Env allow-list OR an admin-role user. */
export async function isAuthorizedAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = email.toLowerCase();
  if (envAdminEmails().includes(e)) return true;
  try {
    const user = await getUserByEmail(e);
    if (user?.role === "admin") return true;
  } catch {
    /* DB unreachable — fall back to the env allow-list result (false here). */
  }
  return false;
}

const sign = (payload: string) =>
  createHmac("sha256", process.env.ADMIN_PASSWORD ?? "").update(payload).digest("hex");

/** Signed cookie value binding the admin's email to the current password. */
export function mintAdminToken(email: string): string {
  const p = Buffer.from(email.toLowerCase(), "utf8").toString("base64url");
  return `${p}.${sign(p)}`;
}

/** Verify a cookie value and return the email it carries, or null. */
export function readAdminToken(value: string | undefined | null): string | null {
  if (!value) return null;
  const [p, sig] = value.split(".");
  if (!p || !sig) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(sign(p)))) return null;
    return Buffer.from(p, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** The email in the admin cookie (signature-valid), or null. */
export async function currentAdminEmail(): Promise<string | null> {
  if (!adminConfigured()) return null;
  const jar = await cookies();
  return readAdminToken(jar.get(ADMIN_COOKIE)?.value);
}

/**
 * Page guard: the signed-in admin's email if the cookie is valid AND that email
 * is still authorized right now, else null. Server components redirect on null.
 */
export async function requireAdmin(): Promise<string | null> {
  const email = await currentAdminEmail();
  if (!email) return null;
  return (await isAuthorizedAdminEmail(email)) ? email : null;
}

/**
 * API-route guard: enforces the admin cookie AND a live authorized-email check.
 * Returns an error Response when not allowed, or null when authorized:
 *   const denied = await adminApiGuard(); if (denied) return denied;
 */
export async function adminApiGuard(): Promise<NextResponse | null> {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Admin login is not configured (ADMIN_PASSWORD unset)." },
      { status: 503 }
    );
  }
  const email = await currentAdminEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAuthorizedAdminEmail(email))) {
    return NextResponse.json({ error: "Forbidden — not an authorized admin email" }, { status: 403 });
  }
  return null;
}
