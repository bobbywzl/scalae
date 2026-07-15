import { NextResponse } from "next/server";
import { getNote, updateNote } from "@/lib/db";
import { appendClip, type Clip } from "@/lib/notes";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/** Append a clipped evidence item (from the desk's evidence feed) to a notepad. */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const note = await getNote(user.id, id);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Partial<Clip>;
  if (!body.headline?.trim()) {
    return NextResponse.json({ error: "headline required" }, { status: 400 });
  }
  const clip: Clip = {
    headline: body.headline.trim().slice(0, 400),
    summary: (body.summary ?? "").trim().slice(0, 2000),
    url: typeof body.url === "string" && /^https?:\/\//i.test(body.url) ? body.url : null,
    source: (body.source ?? "").trim().slice(0, 120) || null,
    date: body.date && !Number.isNaN(Date.parse(body.date)) ? body.date : new Date().toISOString(),
    signalNames: Array.isArray(body.signalNames)
      ? body.signalNames.filter((s): s is string => typeof s === "string").slice(0, 8)
      : [],
  };
  await updateNote(user.id, id, { content: appendClip(note.content, clip) });
  return NextResponse.json({ ok: true });
}
