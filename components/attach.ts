import type { Attachment } from "@/lib/types";

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
