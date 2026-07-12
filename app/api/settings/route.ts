import { NextResponse } from "next/server";
import { autoResearchEnabled, setSetting } from "@/lib/db";

/** App-level settings. Currently: the auto daily-research switch. */
export async function GET() {
  return NextResponse.json({ autoResearch: await autoResearchEnabled() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { autoResearch?: unknown };
  if (typeof body.autoResearch !== "boolean") {
    return NextResponse.json({ error: "autoResearch (boolean) required" }, { status: 400 });
  }
  await setSetting("autoResearch", body.autoResearch ? "on" : "off");
  return NextResponse.json({ autoResearch: body.autoResearch });
}
