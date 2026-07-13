import { NextResponse } from "next/server";
import { authEnabled, currentUser } from "@/lib/auth";
import { getSetting, listTickers } from "@/lib/db";

/**
 * Who am I — drives the header icons (avatar, sign-out), the settings profile
 * card, and first-run routing (needsOnboarding sends brand-new accounts to the
 * /welcome intake before their first look at the dashboard).
 */
export async function GET() {
  const user = await currentUser();

  // New account = no saved profile AND no desks yet. Existing users (including
  // adopted single-user data) are never nagged. Best-effort: any DB hiccup
  // resolves to false so the dashboard still loads.
  let needsOnboarding = false;
  if (user) {
    try {
      const [profile, tickers] = await Promise.all([
        getSetting(user.id, "profile"),
        listTickers(user.id),
      ]);
      needsOnboarding = !profile && tickers.length === 0;
    } catch {
      needsOnboarding = false;
    }
  }

  return NextResponse.json({
    authEnabled: authEnabled(),
    needsOnboarding,
    user: user
      ? { id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role, createdAt: user.createdAt }
      : null,
  });
}
