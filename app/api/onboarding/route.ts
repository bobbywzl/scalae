import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { addTicker, getSetting, getTicker, insertMessage, setSetting } from "@/lib/db";
import { resolveSymbol } from "@/lib/market";
import { welcomeMessage } from "@/lib/agents/chat";
import { requestLang } from "@/lib/i18n/server";

/**
 * First-run onboarding: saves the investor profile (name, age, country,
 * industries of interest) and opens the desks they picked — so the watchlist
 * is already alive on first landing. Also handles "skip" (profile marked
 * onboarded with no desks). Idempotent per symbol; capped to keep the first
 * research sweep's token spend sane.
 */

const MAX_SYMBOLS = 6;

export interface InvestorProfile {
  name?: string;
  age?: number;
  country?: string;
  industries?: string[];
  onboardedAt: string;
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    skip?: boolean;
    name?: unknown;
    age?: unknown;
    country?: unknown;
    industries?: unknown;
    symbols?: unknown;
  };

  const profile: InvestorProfile = { onboardedAt: new Date().toISOString() };
  if (!body.skip) {
    const name = String(body.name ?? "").trim().slice(0, 60);
    const country = String(body.country ?? "").trim().slice(0, 60);
    const age = Number(body.age);
    if (name) profile.name = name;
    if (country) profile.country = country;
    if (Number.isFinite(age) && age > 0 && age < 120) profile.age = Math.round(age);
    if (Array.isArray(body.industries)) {
      profile.industries = (body.industries as unknown[])
        .map((s) => String(s).trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 10);
    }
  }
  await setSetting(user.id, "profile", JSON.stringify(profile));

  const created: string[] = [];
  const failed: string[] = [];
  if (!body.skip && Array.isArray(body.symbols)) {
    const lang = await requestLang(user.id);
    const symbols = [...new Set((body.symbols as unknown[]).map((s) => String(s).trim().toUpperCase()).filter(Boolean))].slice(0, MAX_SYMBOLS);
    for (const symbol of symbols) {
      try {
        if (await getTicker(user.id, symbol)) {
          created.push(symbol); // already open — counts as ready
          continue;
        }
        const name = await resolveSymbol(symbol);
        if (!name) {
          failed.push(symbol);
          continue;
        }
        await addTicker(user.id, symbol, name);
        await insertMessage(user.id, symbol, "assistant", welcomeMessage(symbol, name, lang));
        created.push(symbol);
      } catch {
        failed.push(symbol);
      }
    }
  }

  return NextResponse.json({ ok: true, created, failed });
}

/** Whether the caller still needs first-run onboarding (used by /welcome). */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getSetting(user.id, "profile");
  return NextResponse.json({ onboarded: !!profile });
}
