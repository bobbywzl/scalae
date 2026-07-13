import { NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/admin-auth";
import { clearUsage } from "@/lib/db";

/**
 * DELETE — wipe all cost/usage telemetry. For when the recorded history
 * belongs to a different era (pre-launch testing, a pricing change) and the
 * admin wants the cost panel to reflect a clean slate.
 */
export async function DELETE() {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const deleted = await clearUsage();
  return NextResponse.json({ ok: true, deleted });
}
