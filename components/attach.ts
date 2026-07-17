import type { Attachment, EvidenceKind } from "@/lib/types";

/**
 * Client-side attachment processing, shared by the desk chat and the support
 * form. Images are downscaled + re-encoded so a phone photo doesn't blow the
 * request cap; PDFs/text ride through as-is (size-checked).
 */

export const IMAGE_MAX_EDGE = 1568; // Claude's optimal max long edge
export const PDF_MAX_BYTES = 4_000_000;
export const TEXT_MAX_BYTES = 300_000;
export const MAX_FILES = 6;

export const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error(`Could not read ${file.name}`));
    r.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error(`Could not read ${file.name}`));
    r.readAsText(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Not a readable image"));
    img.src = dataUrl;
  });
}

const CLAUDE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** What an evidence upload sends: an attachment shape whose kind may be "file". */
export interface EvidenceFile {
  kind: EvidenceKind;
  name: string;
  mediaType: string;
  size: number;
  data: string;
}

/**
 * Binary evidence cap (original bytes). Files bigger than one request body
 * allows are uploaded in sequential chunks (see the evidence upload flow), so
 * this is a true per-file ceiling, not a per-request one.
 */
export const EVIDENCE_BINARY_MAX = 25_000_000;
/** Text-like types/extensions that should be read as text, not raw binary. */
const TEXTUAL_TYPES = new Set(["application/json", "application/xml", "application/x-yaml"]);
const TEXTUAL_EXT = /\.(txt|md|csv|tsv|json|xml|ya?ml|log|htm|html)$/i;

/** processFile's Attachment (data optional in the type) → EvidenceFile (data required). */
async function asEvidence(p: Promise<Attachment>): Promise<EvidenceFile> {
  const a = await p;
  if (!a.data) throw new Error(`Could not read ${a.name}`);
  return { kind: a.kind, name: a.name, mediaType: a.mediaType, size: a.size, data: a.data };
}

/** Read any file as base64 (no size gate — the caller enforces the cap). */
async function asBinaryEvidence(file: File, kind: "pdf" | "file"): Promise<EvidenceFile> {
  const dataUrl = await readAsDataURL(file);
  return {
    kind,
    name: file.name,
    mediaType: file.type || (kind === "pdf" ? "application/pdf" : "application/octet-stream"),
    size: file.size,
    data: dataUrl.split(",")[1],
  };
}

/**
 * Evidence-locker version of processFile: images downscale (chat pipeline),
 * small text reads as text — but PDFs and ANY other type are accepted as
 * binary up to EVIDENCE_BINARY_MAX (deliberately NOT the chat pipeline's
 * small single-request PDF cap; big files upload in chunks). Text files past
 * the chat text cap ride as generic binary instead of failing.
 */
export async function processEvidenceFile(file: File): Promise<EvidenceFile> {
  if (file.type.startsWith("image/")) return asEvidence(processFile(file));
  if (file.size > EVIDENCE_BINARY_MAX) {
    throw new Error(`${file.name} is ${fmtBytes(file.size)} — evidence files up to ${fmtBytes(EVIDENCE_BINARY_MAX)} only.`);
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return asBinaryEvidence(file, "pdf");
  }
  if (
    file.size <= TEXT_MAX_BYTES &&
    (file.type.startsWith("text/") || TEXTUAL_TYPES.has(file.type) || TEXTUAL_EXT.test(file.name))
  ) {
    return asEvidence(processFile(file));
  }
  return asBinaryEvidence(file, "file");
}

export async function processFile(file: File): Promise<Attachment> {
  if (file.type.startsWith("image/")) {
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.width, img.height));
    if (scale === 1 && CLAUDE_IMAGE_TYPES.has(file.type) && file.size < 1_500_000) {
      return {
        kind: "image",
        name: file.name,
        mediaType: file.type,
        size: file.size,
        data: dataUrl.split(",")[1],
      };
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.85);
    const data = jpeg.split(",")[1];
    return {
      kind: "image",
      name: file.name,
      mediaType: "image/jpeg",
      size: Math.round(data.length * 0.75),
      data,
    };
  }
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    if (file.size > PDF_MAX_BYTES) {
      throw new Error(`${file.name} is ${fmtBytes(file.size)} — PDFs up to ${fmtBytes(PDF_MAX_BYTES)} only.`);
    }
    const dataUrl = await readAsDataURL(file);
    return {
      kind: "pdf",
      name: file.name,
      mediaType: "application/pdf",
      size: file.size,
      data: dataUrl.split(",")[1],
    };
  }
  if (file.size > TEXT_MAX_BYTES) {
    throw new Error(`${file.name} is ${fmtBytes(file.size)} — text files up to ${fmtBytes(TEXT_MAX_BYTES)} only.`);
  }
  const text = await readAsText(file);
  return {
    kind: "text",
    name: file.name,
    mediaType: file.type || "text/plain",
    size: file.size,
    data: text,
  };
}
