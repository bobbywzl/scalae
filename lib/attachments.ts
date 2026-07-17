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
// generic "file" kind covers spreadsheets, decks, archives, audio. The
// platform caps a single request body at ~4.5 MB, so large files arrive in
// SEQUENTIAL CHUNKS (create with the first chunk, append the rest); the
// per-kind caps below bound the ASSEMBLED base64 payload, not one request.
// ---------------------------------------------------------------------------

export const EVIDENCE_CAPS: Record<EvidenceKind, number> = {
  image: 3_000_000, // client-downscaled; always a single request
  pdf: 34_000_000, // ~25 MB binary
  text: 400_000,
  file: 34_000_000, // ~25 MB binary
};

/** Max base64 chars accepted in one request (create's first chunk or an append). */
export const EVIDENCE_CHUNK_MAX = 3_200_000;

export interface EvidenceUpload {
  kind: EvidenceKind;
  name: string;
  mediaType: string;
  size: number;
  /** First chunk of the base64/text payload (the whole payload when small). */
  data: string;
  /** Assembled payload length the client will upload in total (chunked uploads). */
  expectedLength: number;
}

/** Validate an evidence upload's metadata + first chunk (any type; caps per kind). */
export function sanitizeEvidence(raw: unknown): EvidenceUpload | { error: string } {
  const a = raw as (Partial<EvidenceUpload> & { expectedLength?: unknown }) | null;
  const kind = a?.kind as EvidenceKind;
  if (kind !== "image" && kind !== "pdf" && kind !== "text" && kind !== "file") {
    return { error: "Unsupported evidence kind." };
  }
  if (typeof a?.data !== "string" || a.data.length === 0) {
    return { error: "Evidence file is missing its data." };
  }
  if (a.data.length > EVIDENCE_CHUNK_MAX) {
    return { error: "Upload chunk too large — split the file into smaller chunks." };
  }
  const expected =
    typeof a.expectedLength === "number" && Number.isFinite(a.expectedLength)
      ? Math.floor(a.expectedLength)
      : a.data.length;
  if (expected < a.data.length) return { error: "Malformed upload (expected length too small)." };
  if (expected > EVIDENCE_CAPS[kind]) {
    return { error: `"${a.name ?? "file"}" is too large for the evidence locker.` };
  }
  return {
    kind,
    name: String(a.name ?? "file").slice(0, 200),
    mediaType: String(a.mediaType ?? "application/octet-stream").slice(0, 100),
    size: typeof a.size === "number" ? a.size : 0,
    data: a.data,
    expectedLength: expected,
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
