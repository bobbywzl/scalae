import { NextResponse } from "next/server";
import { deleteTrade } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await deleteTrade(id);
  return NextResponse.json({ ok: true });
}
