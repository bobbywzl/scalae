import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { appOrigin, authEnabled, SESSION_COOKIE } from "@/lib/auth";
import { createSession, upsertUser } from "@/lib/db";

/**
 * Token-gated test login for autonomous simulation runs (AUTOLOOP-SCALAE).
 *
 * Sealed unless the TEST_LOGIN_TOKEN env var is set — unset (the default and
 * the steady state) this route is a 404 and the app has no test door. When a
 * simulation run is authorized, the operator sets TEST_LOGIN_TOKEN in Vercel
 * for the run's duration and REMOVES it afterwards; rotating/removing the
 * token invalidates the door immediately (sessions minted earlier still
 * expire on their own schedule).
 *
 *   GET /api/auth/test-login?token=<TEST_LOGIN_TOKEN>&persona=<1-4>
 *
 * Signs into an ISOLATED, clearly-labeled test account
 * (scalae-test-persona-<n>@test.scalae.app) — never an operator's real
 * account. Test accounts are ordinary non-admin users: admin requires
 * ADMIN_EMAILS membership or first-account adoption, neither of which a
 * test address meets on an established deployment.
 */
export async function GET(req: Request) {
  const expected = process.env.TEST_LOGIN_TOKEN;
  // Sealed: no token configured, or auth itself is off (single-user mode has
  // no accounts to isolate a test persona from).
  if (!expected || !authEnabled()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const persona = Math.min(4, Math.max(1, Number(url.searchParams.get("persona")) || 1));
  const user = await upsertUser({
    email: `scalae-test-persona-${persona}@test.scalae.app`,
    name: `Test persona ${persona}`,
    picture: "",
  });
  // A test account must never hold admin: on a brand-new deployment the very
  // first account is auto-admin and adopts legacy data — refuse that seat.
  if (user.role === "admin") {
    return NextResponse.json(
      { error: "Test login refused: this account would be the deployment's admin." },
      { status: 409 }
    );
  }
  const session = await createSession(user.id);

  const res = NextResponse.redirect(new URL("/", appOrigin(req)));
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  return res;
}
