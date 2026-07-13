import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getFeedback, setFeedbackStatus } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** Full thread for one of the caller's requests (attachment payloads included). */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ticket = await getFeedback(id.toUpperCase());
  if (!ticket || ticket.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ticket });
}

/** Close (or reopen) your own request. Body: { status: "closed" | "open" }. */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ticket = await getFeedback(id.toUpperCase());
  if (!ticket || ticket.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (body.status !== "closed" && body.status !== "open") {
    return NextResponse.json({ error: "status must be 'closed' or 'open'" }, { status: 400 });
  }
  await setFeedbackStatus(ticket.id, body.status);
  return NextResponse.json({ ok: true, status: body.status });
}
