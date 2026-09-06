import { NextResponse, after } from "next/server";
import { claimRunPhase } from "@/lib/db";
import { runPhase } from "@/lib/agents/research";
import { continuationToken, isRunPhase, tokenMatches } from "@/lib/agents/phases";

// One research-run PHASE executes here, inside this budget via after(). 300s
// is the Vercel Hobby ceiling (Fluid Compute); the phases are sized for it —
// see lib/agents/phases.ts. Setting it above the plan cap makes Vercel
// reject the deployment, so keep this at the plan maximum.
export const maxDuration = 300;

/**
 * The research pipeline's continuation route — the deployment calling
 * itself. The previous phase's invocation POSTs {runId, phase} with the
 * bearer token derived in lib/agents/phases.ts; this handler claims the phase
 * (atomic — a phase runs exactly once), schedules it after the response, and
 * answers immediately so the caller can end its own invocation. Never
 * reachable through the session cookie: the proxy lets /api/internal/ through
 * and this token is the only gate.
 *   202 → claimed; running in this invocation.
 *   409 → not claimable (already claimed/advanced, or the run is not live).
 *   401/503 → the caller falls back to running the phase in-process.
 */
export async function POST(req: Request) {
  const expected = continuationToken();
  if (!expected) {
    return NextResponse.json({ error: "run continuation is not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!tokenMatches(presented, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { runId?: unknown; phase?: unknown };
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const phase = body.phase;
  if (!runId || !isRunPhase(phase)) {
    return NextResponse.json({ error: "runId and a valid phase are required" }, { status: 400 });
  }

  const state = await claimRunPhase(runId, phase);
  if (!state) {
    return NextResponse.json({ error: "phase not claimable" }, { status: 409 });
  }
  after(() => runPhase(runId, phase, state));
  return NextResponse.json({ accepted: true, runId, phase }, { status: 202 });
}
