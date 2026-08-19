import { NextResponse } from "next/server";
import { appOrigin, authEnabled, SESSION_COOKIE, signInWithPassword } from "@/lib/auth";

/**
 * Email + password sign-in. Accepts the /signin page's plain form post
 * (urlencoded — no client JS on that page) and JSON alike. One generic
 * failure message regardless of cause, so accounts can't be enumerated.
 */
export async function POST(req: Request) {
  const origin = appOrigin(req);
  if (!authEnabled()) return NextResponse.redirect(new URL("/", origin));

  const ct = req.headers.get("content-type") ?? "";
  let email = "";
  let password = "";
  let isForm = false;
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
  } else {
    isForm = true;
    const form = await req.formData().catch(() => null);
    email = String(form?.get("email") ?? "");
    password = String(form?.get("password") ?? "");
  }
  email = email.trim().slice(0, 320);
  password = password.slice(0, 200);

  const FAIL = "Invalid email or password.";
  const fail = () =>
    isForm
      ? NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(FAIL)}`, origin), 303)
      : NextResponse.json({ error: FAIL }, { status: 401 });

  if (!email || !password) return fail();

  const result = await signInWithPassword(email, password).catch(() => null);
  if (!result) {
    // Flat 300ms on the failure path: verification cost stays constant
    // whether the email exists, has no password, or the password is wrong.
    await new Promise((r) => setTimeout(r, 300));
    return fail();
  }

  const res = isForm
    ? NextResponse.redirect(new URL("/", origin), 303)
    : NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, result.session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(result.session.expiresAt),
  });
  return res;
}
