import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth gate (Next 16 proxy — the middleware convention, renamed). A fast
 * cookie-presence check: pages without a session redirect to /signin, APIs
 * get 401. Real session validation happens in the routes (requireUser) —
 * this only shapes the redirect UX. When Google credentials are not
 * configured, auth is off and everything passes through (single-user mode).
 */

const PUBLIC_PAGES = new Set(["/signin"]);
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/cron/"];

export function proxy(request: NextRequest) {
  const authOn = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.SESSION_SECRET
  );
  if (!authOn) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const hasSession = !!request.cookies.get("scalae_session")?.value;
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  const signin = new URL("/signin", request.url);
  return NextResponse.redirect(signin);
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
