import { NextResponse, after } from "next/server";
import { cancelRunningRun, getSignal, getTicker } from "@/lib/db";
import { executeSignalRun, startSignalRun } from "@/lib/agents/research";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";
import { localizeRun } from "@/lib/i18n/translate";

// The single-signal check runs the board pipeline's structure scoped to one
// signal, inside this budget via after(). Same ceiling as the board run.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/** Kick off a check of this one signal; the pipeline continues after the response. */
export async function POST(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal || (signal.userId && signal.userId !== user.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!(await getTicker(user.id, signal.symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (signal.status !== "active") {
    return NextResponse.json({ error: "Only active signals can be checked." }, { status: 400 });
  }

  const { run, started } = await startSignalRun(user.id, signal.symbol, id);
  if (started) {
    after(() => executeSignalRun(user.id, run.id, signal.symbol, id));
  }
  const lang = await requestLang(user.id);
  return NextResponse.json({ run: await localizeRun(run, lang, { userId: user.id }), started });
}

/** Stop research on this desk (board or signal check) so a fresh one can start. */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const signal = await getSignal(id);
  if (!signal || (signal.userId && signal.userId !== user.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const stopped = await cancelRunningRun(user.id, signal.symbol);
  return NextResponse.json({ stopped });
}
