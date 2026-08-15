import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

/**
 * Public database health probe (no auth, no data): runs `select 1` and
 * reports ok or the driver's error message, so a database-layer outage is
 * diagnosable from outside without dashboard access. The message is
 * credential-scrubbed and truncated — it names the failure, never the DSN.
 */
export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL is not set" }, { status: 503 });
  }
  try {
    const sql = neon(url);
    await sql`select 1`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    const scrubbed = raw.replace(/postgres(ql)?:\/\/\S+/gi, "<dsn>").slice(0, 300);
    return NextResponse.json({ ok: false, error: scrubbed }, { status: 503 });
  }
}
