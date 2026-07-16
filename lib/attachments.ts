import type { Attachment, AttachmentKind, EvidenceKind } from "./types";

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

// ---------------------------------------------------------------------------
// Due-diligence evidence: unlike chat attachments (which must be
// model-readable), a section's evidence locker takes ANY file type — the
// generic "file" kind covers spreadsheets, decks, archives, audio. Uploads
// are one file per request, so each cap also keeps the request body inside
// the platform's ~4.5 MB function-payload limit.
// ---------------------------------------------------------------------------

export const EVIDENCE_CAPS: Record<EvidenceKind, number> = {
  image: 3_000_000,
  pdf: 4_200_000,
  text: 400_000,
  file: 4_200_000,
};

export interface EvidenceUpload {
  kind: EvidenceKind;
  name: string;
  mediaType: string;
  size: number;
  data: string;
}

/** Validate one uploaded evidence file (any type; caps per kind). */
export function sanitizeEvidence(raw: unknown): EvidenceUpload | { error: string } {
  const a = raw as Partial<EvidenceUpload> | null;
  const kind = a?.kind as EvidenceKind;
  if (kind !== "image" && kind !== "pdf" && kind !== "text" && kind !== "file") {
    return { error: "Unsupported evidence kind." };
  }
  if (typeof a?.data !== "string" || a.data.length === 0) {
    return { error: "Evidence file is missing its data." };
  }
  if (a.data.length > EVIDENCE_CAPS[kind]) {
    return { error: `"${a.name ?? "file"}" is too large for the evidence locker.` };
  }
  return {
    kind,
    name: String(a.name ?? "file").slice(0, 200),
    mediaType: String(a.mediaType ?? "application/octet-stream").slice(0, 100),
    size: typeof a.size === "number" ? a.size : 0,
    data: a.data,
  };
}

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
