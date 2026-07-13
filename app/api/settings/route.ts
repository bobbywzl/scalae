import { NextResponse } from "next/server";
import { autoResearchEnabled, setSetting } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** App-level settings. Currently: the auto daily-research switch. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ autoResearch: await autoResearchEnabled(user.id) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { autoResearch?: unknown };
  if (typeof body.autoResearch !== "boolean") {
    return NextResponse.json({ error: "autoResearch (boolean) required" }, { status: 400 });
  }
  await setSetting(user.id, "autoResearch", body.autoResearch ? "on" : "off");
  return NextResponse.json({ autoResearch: body.autoResearch });
}
