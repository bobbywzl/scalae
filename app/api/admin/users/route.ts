import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/auth";
import { adminApiGuard } from "@/lib/admin-auth";
import { listUsersWithStats } from "@/lib/db";
import { resolveAllModels } from "@/lib/ai/models";

/** Admin console data: every account with its activity aggregates. */
export async function GET() {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const [rows, models] = await Promise.all([listUsersWithStats(), resolveAllModels()]);
  return NextResponse.json({ rows, models, authEnabled: authEnabled() });
}
