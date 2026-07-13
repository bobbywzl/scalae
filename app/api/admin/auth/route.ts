import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminConfigured,
  isAuthorizedAdminEmail,
  mintAdminToken,
  verifyAdminPassword,
} from "@/lib/admin-auth";

/**
 * Admin sign-in: takes { email, password }, and sets the signed admin cookie
 * only when the password matches ADMIN_PASSWORD AND the email is authorized.
 * DELETE clears the cookie (admin sign-out).
 */
export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Admin login is not configured (ADMIN_PASSWORD unset)." },
      { status: 503 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (!email || !(await isAuthorizedAdminEmail(email))) {
    // Same generic message as a bad password — don't reveal which emails are admins.
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true, email: email.toLowerCase() });
  res.cookies.set(ADMIN_COOKIE, mintAdminToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
