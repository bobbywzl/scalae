import { NextResponse } from "next/server";
import { getLesson, setLessonStatus, setLessonText } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * The human gate on one standing order. Body: { action } or { text }.
 *   approve    → suggested → active (the order starts binding the desk)
 *   dismiss    → suggested → dismissed
 *   retire     → active → retired (stops binding; stays auditable)
 *   reactivate → retired → active; dismissed → suggested (back through the gate)
 *   { text }   → the investor rewords the order (theirs to edit at any status)
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const lesson = await getLesson(id);
  if (!lesson || (lesson.userId && lesson.userId !== user.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string; text?: string };

  if (typeof body.text === "string") {
    if (!body.text.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
    await setLessonText(id, body.text.trim().slice(0, 500));
    return NextResponse.json({ lesson: await getLesson(id) });
  }

  const action = body.action;
  if (action === "approve" && lesson.status === "suggested") {
    await setLessonStatus(id, "active");
  } else if (action === "dismiss" && lesson.status === "suggested") {
    await setLessonStatus(id, "dismissed");
  } else if (action === "retire" && lesson.status === "active") {
    await setLessonStatus(id, "retired");
  } else if (action === "reactivate" && (lesson.status === "retired" || lesson.status === "dismissed")) {
    await setLessonStatus(id, lesson.status === "retired" ? "active" : "suggested");
  } else {
    return NextResponse.json(
      { error: "action must be approve | dismiss | retire | reactivate (valid for the current status)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ lesson: await getLesson(id) });
}
