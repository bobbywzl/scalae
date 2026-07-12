import { NextResponse } from "next/server";
import { approveSignal, getSignal, getTicker, markOnboarded, setSignalStatus } from "@/lib/db";

/**
 * Bulk human approval gate: approve or dismiss ("ignore") many pending
 * proposals at once — same semantics as PATCH /api/signals/[id], applied to a
 * selection. Only `suggested` signals are affected; anything else is skipped.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; action?: string };
  const action = body.action;
  if (action !== "approve" && action !== "dismiss") {
    return NextResponse.json({ error: "action must be approve | dismiss" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0 || ids.length > 100) {
    return NextResponse.json({ error: "ids must be a non-empty array (max 100)" }, { status: 400 });
  }

  let updated = 0;
  let onboardedNow = false;
  const approvedSymbols = new Set<string>();
  for (const id of ids) {
    const signal = await getSignal(id);
    if (!signal || signal.status !== "suggested") continue;
    if (action === "approve") {
      await approveSignal(id); // retires the replaced signal too, if any
      approvedSymbols.add(signal.symbol);
    } else {
      await setSignalStatus(id, "dismissed");
    }
    updated++;
  }
  // First approval activates a desk that was still onboarding.
  for (const symbol of approvedSymbols) {
    const ticker = await getTicker(symbol);
    if (ticker && !ticker.onboarded) {
      await markOnboarded(symbol);
      onboardedNow = true;
    }
  }
  return NextResponse.json({ updated, onboardedNow });
}
