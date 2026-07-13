import { NextResponse } from "next/server";
import { authEnabled, requireUser } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db";
import type { InvestorProfile } from "@/app/api/onboarding/route";

/**
 * The investor profile behind /profile: the Google account identity (read-
 * only, when auth is on) plus the editable investor profile captured at
 * onboarding (name, age, country, industries — settings key "profile").
 */

function parseProfile(raw: string | null): InvestorProfile | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InvestorProfile;
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = parseProfile(await getSetting(user.id, "profile"));
  return NextResponse.json({
    authEnabled: authEnabled(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      createdAt: user.createdAt,
    },
    profile,
  });
}

export async function PUT(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    age?: unknown;
    country?: unknown;
    industries?: unknown;
  };

  const existing = parseProfile(await getSetting(user.id, "profile"));
  // Same sanitation rules as the onboarding intake; blank clears a field.
  const next: InvestorProfile = {
    onboardedAt: existing?.onboardedAt ?? new Date().toISOString(),
  };
  const name = String(body.name ?? "").trim().slice(0, 60);
  const country = String(body.country ?? "").trim().slice(0, 60);
  const age = Number(body.age);
  if (name) next.name = name;
  if (country) next.country = country;
  if (Number.isFinite(age) && age > 0 && age < 120) next.age = Math.round(age);
  if (Array.isArray(body.industries)) {
    const industries = (body.industries as unknown[])
      .map((s) => String(s).trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 10);
    if (industries.length > 0) next.industries = industries;
  }

  await setSetting(user.id, "profile", JSON.stringify(next));
  return NextResponse.json({ profile: next });
}
