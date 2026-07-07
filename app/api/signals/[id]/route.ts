import { NextResponse } from "next/server";
import { getSignal, getTicker, markOnboarded, setSignalStatus } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * Human approval gate: nothing the agents propose runs until it's approved here.
 * actions: approve (suggested→active), dismiss (suggested→dismissed), retire (active→retired).
 */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action;

  if (action === "approve") {
    await setSignalStatus(id, "active");
    const ticker = await getTicker(signal.symbol);
    let onboardedNow = false;
    if (ticker && !ticker.onboarded) {
      await markOnboarded(signal.symbol);
      onboardedNow = true;
    }
    return NextResponse.json({ signal: await getSignal(id), onboardedNow });
  }
  if (action === "dismiss") {
    await setSignalStatus(id, "dismissed");
    return NextResponse.json({ signal: await getSignal(id) });
  }
  if (action === "retire") {
    await setSignalStatus(id, "retired");
    return NextResponse.json({ signal: await getSignal(id) });
  }
  return NextResponse.json({ error: "action must be approve | dismiss | retire" }, { status: 400 });
}
