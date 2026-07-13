import { NextResponse } from "next/server";
import {
  approveSignal,
  getSignal,
  getTicker,
  listSignals,
  markOnboarded,
  setSignalStatus,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * Human approval gate: nothing the agents propose runs until it's approved here.
 * actions: approve (suggested→active; retires the signal it replaces, if any),
 * dismiss (suggested→dismissed), retire (active→retired),
 * reactivate (retired→active; dismissed→suggested — back through the approval
 * gate, since a dismissed proposal was never approved).
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal || (signal.userId && signal.userId !== user.id))
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action;

  if (action === "approve") {
    const { retiredId } = await approveSignal(id);
    const ticker = await getTicker(user.id, signal.symbol);
    let onboardedNow = false;
    if (ticker && !ticker.onboarded) {
      await markOnboarded(user.id, signal.symbol);
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
  // Undo a ⇄ swap atomically: bring the retired signal back AND retire the
  // active signal that replaced it, so the board never silently holds both
  // (FOUNDATION's no-duplication rule). The UI offers this as an explicit
  // human choice next to plain "keep both" reactivation.
  if (action === "swap_back") {
    if (signal.status !== "retired") {
      return NextResponse.json({ error: "swap_back applies to retired signals" }, { status: 400 });
    }
    const active = await listSignals(user.id, signal.symbol, "active");
    const replacement = active.find((s) => s.replaces === id) ?? null;
    await setSignalStatus(id, "active");
    if (replacement) await setSignalStatus(replacement.id, "retired");
    return NextResponse.json({
      signal: await getSignal(id),
      retiredId: replacement?.id ?? null,
    });
  }
  return NextResponse.json(
    { error: "action must be approve | dismiss | retire | reactivate | swap_back" },
    { status: 400 }
  );
}
