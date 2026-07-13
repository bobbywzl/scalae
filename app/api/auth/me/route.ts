import { NextResponse } from "next/server";
import { authEnabled, currentUser } from "@/lib/auth";

/** Who am I — drives the header chip (avatar, admin link, sign-out). */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({
    authEnabled: authEnabled(),
    user: user
      ? { id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role }
      : null,
  });
}
