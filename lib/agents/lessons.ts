import { claudeJSON } from "../ai/claude";
import { resolveModel } from "../ai/models";
import { withDeadline } from "./research";
import {
  DESK_DOCTRINE,
  deskIdentity,
  LESSON_DISTILL_DOCTRINE,
  LESSON_DISTILL_SCHEMA,
} from "./framework";
import { getSignal, getTicker, insertLesson, listLessons } from "../db";

/**
 * The teach-the-desk pass (FOUNDATION: human sovereignty; the desk learns
 * from every interaction). When the investor dismisses a proposed signal WITH
 * a stated reason, a small model decides whether that reason expresses a
 * durable conduct preference and, if so, distills ONE standing-order proposal
 * — parked as 'suggested' for the investor's approval like everything else
 * the desk devises. Best-effort by design: failures log and vanish; the
 * dismissal itself already stands.
 */

interface DistillOutput {
  lessons: { text: string; basis: string }[];
}

export async function distillLessonFromDismissal(
  userId: string,
  signalId: string,
  reason: string
): Promise<void> {
  try {
    const trimmed = reason.trim();
    if (!trimmed) return;
    const signal = await getSignal(signalId);
    if (!signal || (signal.userId && signal.userId !== userId)) return;
    const ticker = await getTicker(userId, signal.symbol);
    if (!ticker) return;
    const [active, pending, model] = await Promise.all([
      listLessons(userId, signal.symbol, "active").catch(() => []),
      listLessons(userId, signal.symbol, "suggested").catch(() => []),
      resolveModel("triage"),
    ]);

    const task = `THE DISMISSED PROPOSAL:
- name: "${signal.name}"
- focus area: ${signal.focusArea}
- thesis: ${signal.thesis}
- measurement plan: ${signal.measurementPlan}

THE INVESTOR'S STATED REASON FOR DISMISSING IT:
"${trimmed.slice(0, 500)}"

EXISTING STANDING ORDERS (active and pending — never duplicate or near-twin these):
${[...active, ...pending].map((l) => `- ${l.text}`).join("\n") || "(none yet)"}

TASK: Apply the distillation doctrine — emit ONE standing-order proposal only if the reason teaches something durable about this desk's conduct; otherwise an empty list.`;

    const out = await withDeadline(
      "lesson-distill",
      (signal_) =>
        claudeJSON<DistillOutput>({
          model,
          signal: signal_,
          system: [
            { text: DESK_DOCTRINE, cache: true },
            { text: `${deskIdentity(signal.symbol, ticker.name)}\n\n${LESSON_DISTILL_DOCTRINE}` },
          ],
          messages: [{ role: "user", content: task }],
          schema: LESSON_DISTILL_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 1000,
          effort: "low",
          meta: { userId, feature: "lessons" },
        }),
      45_000
    );

    const lesson = (out.lessons ?? []).find((l) => l.text?.trim());
    if (lesson) {
      await insertLesson(userId, signal.symbol, {
        text: lesson.text,
        basis: lesson.basis?.trim() || `Distilled from dismissing "${signal.name}": ${trimmed.slice(0, 160)}`,
        origin: "dismissal",
      });
    }
  } catch (e) {
    console.error(
      `[scalae] lesson distillation failed (the dismissal stands regardless):`,
      e instanceof Error ? e.message : e
    );
  }
}
