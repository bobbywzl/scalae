import type { Note, NoteSection } from "./types";

/**
 * Server-side helpers for the notes feature. Note content is a TipTap document
 * (ProseMirror JSON) — plain data we can walk and extend without the editor:
 * the browser renders it only through the editor's schema (no raw HTML), so
 * appending well-formed nodes here is safe by construction.
 */

type PMNode = {
  type?: string;
  text?: string;
  content?: PMNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
};

export const emptyDoc = (): string =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

/** What a desk evidence item carries into a notepad. */
export interface Clip {
  headline: string;
  summary: string;
  url: string | null;
  source: string | null;
  date: string; // ISO
  signalNames: string[];
}

/** Build the quoted evidence block a clip appends (blockquote + comment room). */
function clipNodes(clip: Clip): PMNode[] {
  const meta: PMNode[] = [];
  const metaBits: string[] = [];
  if (clip.source) metaBits.push(clip.source);
  metaBits.push(clip.date.slice(0, 10));
  if (clip.signalNames.length) metaBits.push(clip.signalNames.map((s) => `“${s}”`).join(", "));
  if (clip.url) {
    meta.push(
      { type: "text", text: metaBits.join(" · ") + " — " },
      {
        type: "text",
        text: "source",
        marks: [{ type: "link", attrs: { href: clip.url, target: "_blank", rel: "noopener noreferrer nofollow" } }],
      }
    );
  } else {
    meta.push({ type: "text", text: metaBits.join(" · ") });
  }
  return [
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: clip.headline, marks: [{ type: "bold" }] }],
        },
        ...(clip.summary.trim()
          ? [{ type: "paragraph", content: [{ type: "text", text: clip.summary.trim() }] } as PMNode]
          : []),
        { type: "paragraph", content: meta },
      ],
    },
    // Room to comment right under the clipped evidence.
    { type: "paragraph" },
  ];
}

/** Append a clipped evidence block to a note's stored document. */
export function appendClip(contentJson: string, clip: Clip): string {
  let doc: PMNode;
  try {
    doc = JSON.parse(contentJson) as PMNode;
    if (!doc || doc.type !== "doc" || !Array.isArray(doc.content)) throw new Error("bad doc");
  } catch {
    doc = JSON.parse(emptyDoc()) as PMNode;
  }
  // Drop a single empty trailing paragraph so clips don't stack blank gaps.
  const last = doc.content![doc.content!.length - 1];
  if (
    doc.content!.length > 0 &&
    last?.type === "paragraph" &&
    (!last.content || last.content.length === 0)
  ) {
    doc.content!.pop();
  }
  doc.content!.push(...clipNodes(clip));
  return JSON.stringify(doc);
}

/** Flatten a stored document to plain text (for the analyst's context). */
export function docToPlainText(contentJson: string): string {
  let doc: PMNode;
  try {
    doc = JSON.parse(contentJson) as PMNode;
  } catch {
    return "";
  }
  const out: string[] = [];
  const walk = (n: PMNode): string => {
    if (n.text) return n.text;
    const kids = (n.content ?? []).map(walk);
    // Leaf blocks concatenate their inline children; containers (blockquote,
    // lists) separate their child blocks so text doesn't run together.
    return n.type === "paragraph" || n.type === "heading" ? kids.join("") : kids.join("\n");
  };
  for (const block of doc.content ?? []) out.push(walk(block));
  return out.filter(Boolean).join("\n").trim();
}

/**
 * Compact plain-text digest of the investor's notes for the analyst's desk
 * context — read-only, bounded so it can never crowd out the desk state.
 */
export function notesContext(sections: NoteSection[], notes: Note[], maxChars = 1500): string {
  if (notes.length === 0) return "";
  const bySection = new Map<string, Note[]>();
  for (const n of notes) {
    if (!bySection.has(n.sectionId)) bySection.set(n.sectionId, []);
    bySection.get(n.sectionId)!.push(n);
  }
  const lines: string[] = [];
  for (const s of sections) {
    const ns = bySection.get(s.id) ?? [];
    if (ns.length === 0) continue;
    lines.push(`## ${s.title}`);
    for (const n of ns) {
      const text = docToPlainText(n.content).replace(/\s+/g, " ").slice(0, 280);
      if (text) lines.push(`- ${n.title ? `${n.title}: ` : ""}${text}`);
    }
  }
  if (lines.length === 0) return "";
  let out = lines.join("\n");
  if (out.length > maxChars) out = out.slice(0, maxChars) + "…";
  return `INVESTOR'S OWN NOTES (their thinking, verbatim — reference it, never contradict silently; you cannot edit notes):\n${out}`;
}
