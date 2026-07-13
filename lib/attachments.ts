import type { Attachment, AttachmentKind } from "./types";

/**
 * Server-side attachment validation, shared by desk chat and feedback routes.
 * Caps are on base64/text payload LENGTH (not decoded bytes) per kind, plus a
 * per-request total.
 */

export const MAX_ATTACHMENTS = 6;
export const KIND_CAPS: Record<AttachmentKind, number> = {
  image: 3_000_000,
  pdf: 6_000_000,
  text: 400_000,
};
export const TOTAL_CAP = 9_000_000;

/** Keep only well-formed attachments with expected fields (drop everything else). */
export function sanitizeAttachments(raw: unknown): Attachment[] | { error: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: "attachments must be an array" };
  if (raw.length > MAX_ATTACHMENTS) return { error: `At most ${MAX_ATTACHMENTS} files per message.` };
  const out: Attachment[] = [];
  let total = 0;
  for (const a of raw as Partial<Attachment>[]) {
    const kind = a?.kind as AttachmentKind;
    if (kind !== "image" && kind !== "pdf" && kind !== "text") {
      return { error: "Unsupported attachment kind." };
    }
    if (typeof a.data !== "string" || a.data.length === 0) {
      return { error: "Attachment is missing its data." };
    }
    if (a.data.length > KIND_CAPS[kind]) {
      return { error: `"${a.name ?? "file"}" is too large — attach a smaller ${kind}.` };
    }
    total += a.data.length;
    if (total > TOTAL_CAP) return { error: "Attachments exceed the per-message size limit." };
    out.push({
      kind,
      name: String(a.name ?? "file").slice(0, 200),
      mediaType: String(a.mediaType ?? "").slice(0, 100),
      size: typeof a.size === "number" ? a.size : 0,
      data: a.data,
    });
  }
  return out;
}
