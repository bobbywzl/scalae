import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/auth";
import { adminApiGuard } from "@/lib/admin-auth";
import { listUsersWithStats, loginsPerDay, usageSummary } from "@/lib/db";
import { resolveAllModels } from "@/lib/ai/models";

/**
 * Admin console data: every account with activity aggregates, AI cost/usage
 * telemetry (trailing 90 days), and sign-in cadence (trailing 30 days).
 */
export async function GET() {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const [rows, models, usage, logins] = await Promise.all([
    listUsersWithStats(),
    resolveAllModels(),
    usageSummary(90).catch(() => null),
    loginsPerDay(30).catch(() => []),
  ]);
  return NextResponse.json({ rows, models, usage, logins, authEnabled: authEnabled() });
}
