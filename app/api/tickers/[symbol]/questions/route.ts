import { NextResponse } from "next/server";
import { getTicker, listDeskQuestions } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ symbol: string }> };

/** The analyst's questions to the investor (every status; UI groups them). */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ questions: await listDeskQuestions(user.id, symbol) });
}
