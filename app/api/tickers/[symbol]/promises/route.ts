import { NextResponse } from "next/server";
import { getTicker, insertPromise, listPromises } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ symbol: string }> };

/** The promise ledger: management commitments tracked to their outcomes. */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ promises: await listPromises(user.id, symbol) });
}

/**
 * The investor records a promise directly (their add is the approval — the
 * entry opens tracked). Body: { text, madeBy?, madeAt?, due?, sourceTitle?, sourceUrl? }.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    madeBy?: string;
    madeAt?: string;
    due?: string;
    sourceTitle?: string;
    sourceUrl?: string;
  };
  if (!body.text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
  const id = await insertPromise(user.id, symbol, {
    text: body.text.trim().slice(0, 500),
    madeBy: (body.madeBy ?? "").slice(0, 120),
    madeAt: (body.madeAt ?? "").slice(0, 60),
    due: (body.due ?? "").slice(0, 60),
    sourceTitle: (body.sourceTitle ?? "").slice(0, 200),
    sourceUrl: (body.sourceUrl ?? "").slice(0, 600),
    status: "open",
  });
  if (!id) {
    return NextResponse.json({ error: "An identical promise is already on the ledger." }, { status: 409 });
  }
  return NextResponse.json({ promises: await listPromises(user.id, symbol) });
}
