import { NextResponse } from "next/server";
import { authEnabled, currentUser } from "@/lib/auth";

/** Who am I — drives the header icons (avatar, sign-out) and the settings profile card. */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({
    authEnabled: authEnabled(),
    user: user
      ? { id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role, createdAt: user.createdAt }
      : null,
  });
}
