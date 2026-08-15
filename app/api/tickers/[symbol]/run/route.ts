import { NextResponse, after } from "next/server";
import { cancelRunningRun, getTicker, listSignals, runningRun } from "@/lib/db";
import { executeRun, frameRunQuestions, reframeRunQuestions, startRun } from "@/lib/agents/research";
import { friendlyAIError } from "@/lib/ai/claude";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";
import { localizeRun } from "@/lib/i18n/translate";

// The deep pipeline (breadth sweeps → gap triage → deep-dive sweeps →
// synthesis) runs inside this budget via after(). 300s is the Vercel Hobby
// ceiling (Fluid Compute); Pro/Enterprise allow up to 800. A run that outlasts
// it is reaped and retried (see reapStuckRuns). Setting it above the plan cap
// makes Vercel reject the deployment, so keep this at the plan maximum.
export const maxDuration = 300;

type Params = { params: Promise<{ symbol: string }> };

/**
 * The run entry point, three modes by body:
 *  - {}                      → unattended run (cron/auto/chat idiom): the
 *                              question suggestor frames stage 0 itself.
 *  - { frame: true }         → STEERING, step 1: run ONLY the question
 *                              suggestor and return its questions for the
 *                              investor to review/edit. No run starts.
 *                              With existing: string[] (even empty), the
 *                              suggestor instead frames ADDITIONS to that
 *                              kept sheet — or, with replacing: string, a
 *                              replacement for one discarded question —
 *                              never duplicating what's kept.
 *  - { questions: string[] } → STEERING, step 2: start the run with exactly
 *                              the submitted questions (possibly none) —
 *                              stage 0's framing call is skipped.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!(await getTicker(user.id, symbol))) return NextResponse.json({ error: "not found" }, { status: 404 });
  if ((await listSignals(user.id, symbol, "active")).length === 0) {
    return NextResponse.json(
      { error: "Approve at least one signal before running research." },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    frame?: boolean;
    questions?: unknown;
    existing?: unknown;
    replacing?: unknown;
    count?: unknown;
  };

  if (body.frame === true) {
    if (await runningRun(user.id, symbol)) {
      return NextResponse.json(
        { error: "Research is already running on this ticker." },
        { status: 409 }
      );
    }
    try {
      const questions = Array.isArray(body.existing)
        ? await reframeRunQuestions(user.id, symbol, {
            keep: body.existing
              .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
              .map((q) => q.trim().slice(0, 300))
              .slice(0, 8),
            replacing:
              typeof body.replacing === "string" && body.replacing.trim()
                ? body.replacing.trim().slice(0, 300)
                : undefined,
            count: typeof body.count === "number" ? body.count : 1,
          })
        : await frameRunQuestions(user.id, symbol);
      return NextResponse.json({ questions });
    } catch (e) {
      console.error(`[scalae] question framing (${symbol}) failed:`, e instanceof Error ? e.message : e);
      return NextResponse.json({ error: friendlyAIError(e) }, { status: 502 });
    }
  }

  let steered: string[] | undefined;
  if (Array.isArray(body.questions)) {
    steered = body.questions
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim().slice(0, 300))
      .slice(0, 6);
  }

  const { run, started } = await startRun(user.id, symbol);
  if (started) {
    after(() => executeRun(user.id, run.id, symbol, steered ? { questions: steered } : {}));
  }
  const lang = await requestLang(user.id);
  return NextResponse.json({ run: await localizeRun(run, lang, { userId: user.id }), started });
}

/** Stop research: cancel the desk's in-flight run so a fresh one can be started. */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!(await getTicker(user.id, symbol))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const stopped = await cancelRunningRun(user.id, symbol);
  return NextResponse.json({ stopped });
}
