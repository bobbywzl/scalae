import { NextResponse } from "next/server";
import { createAnnotation, getTicker, listAnnotations } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { Annotation } from "@/lib/types";

type Params = { params: Promise<{ symbol: string }> };

const COLORS = new Set(["amber", "blue", "green", "purple"]);

/** All of this user's annotations for one ticker's pages. */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ annotations: await listAnnotations(user.id, symbol) });
}

/** Create a highlight annotation on one of the ticker's text surfaces. */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Partial<Annotation>;
  if (
    !body.surfaceId?.trim() ||
    !body.selectedText?.trim() ||
    typeof body.startOffset !== "number" ||
    typeof body.endOffset !== "number" ||
    body.endOffset <= body.startOffset
  ) {
    return NextResponse.json({ error: "invalid annotation" }, { status: 400 });
  }
  const annotation = await createAnnotation(user.id, symbol, {
    surfaceId: body.surfaceId,
    selectedText: body.selectedText,
    startOffset: body.startOffset,
    endOffset: body.endOffset,
    color: COLORS.has(body.color ?? "") ? body.color! : "amber",
    comment: body.comment ?? null,
  });
  return NextResponse.json({ annotation });
}
