import { NextResponse } from "next/server";
import { answerDeskQuestion, getDeskQuestion, setDeskQuestionStatus } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * The investor's response to one analyst question. Body: { answer } or { action }.
 *   { answer }  → status 'answered'; the text is kept verbatim as first-class
 *                 testimony and fed to later runs and chat (re-answering updates)
 *   dismiss     → the desk stops asking (and never re-asks — gate memory)
 *   reopen      → back to open (an answered question keeps its answer text)
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const question = await getDeskQuestion(id);
  if (!question || (question.userId && question.userId !== user.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { answer?: string; action?: string };

  if (typeof body.answer === "string") {
    if (!body.answer.trim()) return NextResponse.json({ error: "answer required" }, { status: 400 });
    await answerDeskQuestion(id, body.answer);
    return NextResponse.json({ question: await getDeskQuestion(id) });
  }
  if (body.action === "dismiss" && question.status !== "dismissed") {
    await setDeskQuestionStatus(id, "dismissed");
    return NextResponse.json({ question: await getDeskQuestion(id) });
  }
  if (body.action === "reopen" && question.status !== "open") {
    await setDeskQuestionStatus(id, "open");
    return NextResponse.json({ question: await getDeskQuestion(id) });
  }
  return NextResponse.json(
    { error: "provide { answer } or action dismiss | reopen (valid for the current status)" },
    { status: 400 }
  );
}
