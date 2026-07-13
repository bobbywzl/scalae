import { NextResponse } from "next/server";
import { researchSignalBackstory } from "@/lib/agents/history";
import { requireUser } from "@/lib/auth";
import { getSignal } from "@/lib/db";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * Research (or refresh) a signal's deep-history backstory on demand — an
 * explicit human ask, so it runs regardless of the auto-research switch.
 */
export async function POST(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal || (signal.userId && signal.userId !== user.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const result = await researchSignalBackstory(user.id, id);
    return NextResponse.json(result);
  } catch (e) {
    console.error(
      `[scalae] backstory research for "${signal.name}" failed:`,
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ error: "History research failed — try again." }, { status: 500 });
  }
}
