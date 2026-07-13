import { NextResponse } from "next/server";
import { authEnabled, requireUser } from "@/lib/auth";
import { listUsersWithStats } from "@/lib/db";

/** Admin console data: every account with its activity aggregates. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "admins only" }, { status: 403 });
  const rows = await listUsersWithStats();
  return NextResponse.json({ rows, authEnabled: authEnabled() });
}
