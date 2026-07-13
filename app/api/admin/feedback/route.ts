import { NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/admin-auth";
import { listAllFeedback } from "@/lib/db";
import { emailEnabled } from "@/lib/email";

/** Admin inbox: every support request across the app, newest activity first. */
export async function GET() {
  const denied = await adminApiGuard();
  if (denied) return denied;
  return NextResponse.json({ rows: await listAllFeedback(), emailEnabled: emailEnabled() });
}
