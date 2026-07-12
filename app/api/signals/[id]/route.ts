import { NextResponse } from "next/server";
import { approveSignal, getSignal, getTicker, markOnboarded, setSignalStatus } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * Human approval gate: nothing the agents propose runs until it's approved here.
 * actions: approve (suggested→active; retires the signal it replaces, if any),
 * dismiss (suggested→dismissed), retire (active→retired),
 * reactivate (retired→active; dismissed→suggested — back through the approval
 * gate, since a dismissed proposal was never approved).
 */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action;

  if (action === "approve") {
    const { retiredId } = await approveSignal(id);
    const ticker = await getTicker(signal.symbol);
    let onboardedNow = false;
    if (ticker && !ticker.onboarded) {
      await markOnboarded(signal.symbol);
      onboardedNow = true;
    }
    return NextResponse.json({ signal: await getSignal(id), onboardedNow, retiredId });
  }
  if (action === "dismiss") {
    await setSignalStatus(id, "dismissed");
    return NextResponse.json({ signal: await getSignal(id) });
  }
  if (action === "retire") {
    await setSignalStatus(id, "retired");
    return NextResponse.json({ signal: await getSignal(id) });
  }
  if (action === "reactivate") {
    if (signal.status !== "retired" && signal.status !== "dismissed") {
      return NextResponse.json({ error: "only retired or dismissed signals can be reactivated" }, { status: 400 });
    }
    await setSignalStatus(id, signal.status === "retired" ? "active" : "suggested");
    return NextResponse.json({ signal: await getSignal(id) });
  }
  return NextResponse.json({ error: "action must be approve | dismiss | retire | reactivate" }, { status: 400 });
}
