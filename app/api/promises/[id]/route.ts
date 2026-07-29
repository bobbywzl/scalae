import { NextResponse } from "next/server";
import {
  clearPromiseProposal,
  getPromise,
  reopenPromise,
  resolvePromise,
  setPromiseStatus,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { PromiseOutcome } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const OUTCOMES: PromiseOutcome[] = ["kept", "missed", "dropped"];

/**
 * The human gate on one promise-ledger entry. Body: { action, outcome?, resolution? }.
 *   approve → suggested → open (the desk starts tracking it)
 *   dismiss → suggested → dismissed
 *   restore → dismissed → suggested (back through the gate)
 *   confirm → apply the desk's parked resolution proposal (open → its outcome)
 *   reject  → clear the parked proposal; the promise stays open
 *   resolve → the investor's own verdict: outcome ∈ kept|missed|dropped
 *   reopen  → undo a resolution (kept/missed/dropped → open)
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const promise = await getPromise(id);
  if (!promise || (promise.userId && promise.userId !== user.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    outcome?: string;
    resolution?: string;
  };
  const action = body.action;

  if (action === "approve" && promise.status === "suggested") {
    await setPromiseStatus(id, "open");
  } else if (action === "dismiss" && promise.status === "suggested") {
    await setPromiseStatus(id, "dismissed");
  } else if (action === "restore" && promise.status === "dismissed") {
    await setPromiseStatus(id, "suggested");
  } else if (action === "confirm" && promise.status === "open" && promise.proposedStatus) {
    await resolvePromise(id, promise.proposedStatus, promise.proposedResolution);
  } else if (action === "reject" && promise.status === "open" && promise.proposedStatus) {
    await clearPromiseProposal(id);
  } else if (action === "resolve" && promise.status === "open") {
    const outcome = OUTCOMES.includes(body.outcome as PromiseOutcome)
      ? (body.outcome as PromiseOutcome)
      : null;
    if (!outcome) {
      return NextResponse.json({ error: "outcome must be kept | missed | dropped" }, { status: 400 });
    }
    await resolvePromise(id, outcome, (body.resolution ?? "").slice(0, 500));
  } else if (action === "reopen" && OUTCOMES.includes(promise.status as PromiseOutcome)) {
    await reopenPromise(id);
  } else {
    return NextResponse.json(
      { error: "action must be approve | dismiss | restore | confirm | reject | resolve | reopen (valid for the current status)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ promise: await getPromise(id) });
}
