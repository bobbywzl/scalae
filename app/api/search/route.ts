import { NextResponse } from "next/server";
import { searchTickers } from "@/lib/market";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ hits: [] });
  const hits = await searchTickers(q);
  return NextResponse.json({ hits });
}
