import { NextResponse } from "next/server";
import { autoResearchEnabled, initialCapitalUsd, setInitialCapital, setSetting } from "@/lib/db";

/** App-level settings: the auto daily-research switch + paper-book starting capital. */
export async function GET() {
  return NextResponse.json({
    autoResearch: await autoResearchEnabled(),
    initialCapital: await initialCapitalUsd(),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    autoResearch?: unknown;
    initialCapital?: unknown;
  };
  const updated: Record<string, unknown> = {};

  if ("autoResearch" in body) {
    if (typeof body.autoResearch !== "boolean") {
      return NextResponse.json({ error: "autoResearch must be a boolean" }, { status: 400 });
    }
    await setSetting("autoResearch", body.autoResearch ? "on" : "off");
    updated.autoResearch = body.autoResearch;
  }

  if ("initialCapital" in body) {
    const v = body.initialCapital;
    if (v === null) {
      await setInitialCapital(null);
      updated.initialCapital = null;
    } else if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e15) {
      await setInitialCapital(v);
      updated.initialCapital = v;
    } else {
      return NextResponse.json(
        { error: "initialCapital must be a non-negative number (or null to unset)" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(updated).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  return NextResponse.json(updated);
}
