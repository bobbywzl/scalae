import { NextResponse } from "next/server";
import { authEnabled, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { getUserAuthByEmail, setUserPassword } from "@/lib/db";

/**
 * Set or change the signed-in user's password. First set needs only the new
 * password (the live session is the proof of identity — e.g. a fresh Google
 * sign-in); once one exists, changing it requires the current one too.
 */
export async function POST(req: Request) {
  if (!authEnabled()) {
    return NextResponse.json({ error: "Auth is not enabled on this deployment." }, { status: 400 });
  }
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    password?: unknown;
    currentPassword?: unknown;
  };
  const password = typeof body.password === "string" ? body.password : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";

  if (password.length < 8 || password.length > 200) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const auth = await getUserAuthByEmail(user.email);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (auth.passwordHash && !verifyPassword(currentPassword, auth.passwordHash)) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }

  await setUserPassword(user.id, hashPassword(password));
  return NextResponse.json({ ok: true });
}
