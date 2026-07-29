import { NextResponse, after } from "next/server";
import { executeRhyme } from "@/lib/agents/rhyme";
import { createRhyme, getTicker, listRhymes, recentDigest } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// Two archival sweeps + one synthesis run inside this budget via after().
// 300s is the Vercel Hobby ceiling.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/** The ticker's episode-rhyme analyses (the evidence feed matches by digestId). */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ rhymes: await listRhymes(user.id, symbol) });
}

/**
 * Launch an episode-rhyme analysis for one evidence-feed item — strictly on
 * the investor's ask ("history is the base rate" made explicit). Body:
 * { digestId }. Idempotent per item: a rhyme already running or done for the
 * same digestId is returned instead of duplicated (run it fresh by asking on
 * a new item).
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { digestId } = (await req.json().catch(() => ({}))) as { digestId?: string };
  if (!digestId) return NextResponse.json({ error: "digestId required" }, { status: 400 });

  const item = (await recentDigest(user.id, symbol, 100)).find((d) => d.id === digestId);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existing = (await listRhymes(user.id, symbol)).find(
    (r) => r.digestId === digestId && r.status !== "error"
  );
  if (existing) return NextResponse.json({ rhyme: existing, started: false });

  const eventText = `${item.headline} — ${item.summary}${item.source ? ` (reported by ${item.source}, ${item.date.slice(0, 10)})` : ` (${item.date.slice(0, 10)})`}`;
  const rhyme = await createRhyme(user.id, symbol, digestId, eventText);
  after(() => executeRhyme(user.id, rhyme.id));
  return NextResponse.json({ rhyme, started: true });
}
