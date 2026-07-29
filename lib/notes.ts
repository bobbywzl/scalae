import type {
  Citation,
  DiligenceEvidence,
  DiligenceResearch,
  DiligenceSynthesis,
  Note,
  NoteSection,
} from "./types";

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

/**
 * Structural emptiness: true only when the document holds nothing at all —
 * no text AND no non-paragraph nodes. A doc that is just a horizontal rule or
 * empty list still COUNTS as content (its read-mode render must show it).
 */
export function docIsEmpty(contentJson: string): boolean {
  let doc: PMNode;
  try {
    doc = JSON.parse(contentJson) as PMNode;
  } catch {
    return true;
  }
  const blocks = doc?.content ?? [];
  return blocks.every(
    (b) => b.type === "paragraph" && (!b.content || b.content.length === 0)
  );
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

// ---------------------------------------------------------------------------
// Markdown → ProseMirror. Accepted deep-research memos become ordinary
// notepad documents — dated, fully editable, owned by the investor from the
// moment they enter the record. The converter covers exactly the constructs
// the memo doctrine allows (### headings, lists, quotes, bold/italic, links,
// [n] citations); anything else degrades to plain text, never to raw HTML.
// ---------------------------------------------------------------------------

type PMMark = { type: string; attrs?: Record<string, unknown> };

const linkMark = (href: string): PMMark => ({
  type: "link",
  attrs: { href, target: "_blank", rel: "noopener noreferrer nofollow" },
});

/** Inline markdown (links, bold, italic, [n] citations) → PM text nodes. */
function inlineNodes(text: string, sources: Citation[], marks: PMMark[] = []): PMNode[] {
  const out: PMNode[] = [];
  const push = (t: string, extra: PMMark[] = []) => {
    if (!t) return;
    const all = [...marks, ...extra];
    out.push({ type: "text", text: t, ...(all.length ? { marks: all } : {}) });
  };
  // One pass, earliest-match-wins: [text](url) · **bold** · *italic* · [n]
  const rx = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[(\d{1,3})\](?!\()/g;
  let last = 0;
  for (let m = rx.exec(text); m; m = rx.exec(text)) {
    push(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[2]) {
      push(m[1], [linkMark(m[2])]);
    } else if (m[3] !== undefined) {
      out.push(...inlineNodes(m[3], sources, [...marks, { type: "bold" }]));
    } else if (m[4] !== undefined) {
      out.push(...inlineNodes(m[4], sources, [...marks, { type: "italic" }]));
    } else if (m[5] !== undefined) {
      const src = sources[Number(m[5])];
      if (src?.url) push(`[${m[5]}]`, [linkMark(src.url)]);
      else push(m[0]);
    }
  }
  push(text.slice(last));
  return out;
}

const para = (nodes: PMNode[]): PMNode =>
  nodes.length ? { type: "paragraph", content: nodes } : { type: "paragraph" };

/** Block-level markdown → PM nodes. Small by design; see module comment. */
export function markdownToNodes(md: string, sources: Citation[] = []): PMNode[] {
  const out: PMNode[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const listItem = (t: string): PMNode => ({
    type: "listItem",
    content: [para(inlineNodes(t, sources))],
  });
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      out.push({
        type: "heading",
        attrs: { level: Math.min(3, heading[1].length) },
        content: inlineNodes(heading[2].trim(), sources),
      });
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: PMNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(listItem(lines[i].replace(/^\s*[-*]\s+/, "")));
        i++;
      }
      out.push({ type: "bulletList", content: items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: PMNode[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(listItem(lines[i].replace(/^\s*\d+[.)]\s+/, "")));
        i++;
      }
      out.push({ type: "orderedList", attrs: { start: 1 }, content: items });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quoted: PMNode[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        const t = lines[i].replace(/^\s*>\s?/, "").trim();
        if (t) quoted.push(para(inlineNodes(t, sources)));
        i++;
      }
      if (quoted.length) out.push({ type: "blockquote", content: quoted });
      continue;
    }
    // Paragraph: join consecutive plain lines (markdown soft-wraps).
    const buf: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s|^\s*[-*]\s|^\s*\d+[.)]\s|^\s*>/.test(lines[i])
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    out.push(para(inlineNodes(buf.join(" "), sources)));
  }
  return out.length ? out : [{ type: "paragraph" }];
}

/**
 * The notepad document an ACCEPTED research memo becomes: provenance line,
 * the memo itself, and its numbered sources — all ordinary editable content.
 */
export function researchNoteDoc(research: {
  memo: string;
  sources: Citation[];
  createdAt: string;
  question?: string;
}): string {
  const content: PMNode[] = [
    para([
      {
        type: "text",
        text: `Deep research by the desk · ${research.createdAt.slice(0, 10)}${
          research.question?.trim() ? ` · steer: “${research.question.trim()}”` : ""
        }`,
        marks: [{ type: "italic" }],
      },
    ]),
    ...markdownToNodes(research.memo, research.sources),
  ];
  if (research.sources.length > 0) {
    content.push(
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Sources" }] },
      {
        type: "orderedList",
        attrs: { start: 0 },
        content: research.sources.map((s) => ({
          type: "listItem",
          content: [
            para([{ type: "text", text: s.title || s.url, marks: [linkMark(s.url)] }]),
          ],
        })),
      }
    );
  }
  return JSON.stringify({ type: "doc", content });
}

/**
 * Compact plain-text digest of the investor's due-diligence record for the
 * analyst's context: the standing synthesis, every section with its notes and
 * accepted research insights, and which sections are still empty. Read-only,
 * bounded so it can never crowd out the desk state. This is the record the
 * circle-of-competence loop steers by (see EXPERT_LOOP_GUIDANCE).
 */
export function diligenceContext(
  sections: NoteSection[],
  notes: Note[],
  research: DiligenceResearch[] = [],
  synthesis: DiligenceSynthesis | null = null,
  evidence: DiligenceEvidence[] = [],
  maxChars = 2600
): string {
  if (sections.length === 0 && !synthesis) return "";
  const bySection = new Map<string, Note[]>();
  for (const n of notes) {
    if (!bySection.has(n.sectionId)) bySection.set(n.sectionId, []);
    bySection.get(n.sectionId)!.push(n);
  }
  const acceptedBySection = new Map<string, DiligenceResearch[]>();
  for (const r of research) {
    if (r.status !== "accepted" || !r.insights) continue;
    if (!acceptedBySection.has(r.sectionId)) acceptedBySection.set(r.sectionId, []);
    acceptedBySection.get(r.sectionId)!.push(r);
  }
  const evidenceBySection = new Map<string, DiligenceEvidence[]>();
  for (const e of evidence) {
    if (!evidenceBySection.has(e.sectionId)) evidenceBySection.set(e.sectionId, []);
    evidenceBySection.get(e.sectionId)!.push(e);
  }
  const lines: string[] = [];
  if (synthesis?.content) {
    lines.push(
      `Standing synthesis (refreshed ${synthesis.updatedAt.slice(0, 10)}): ${synthesis.content
        .replace(/\s+/g, " ")
        .slice(0, 600)}`
    );
  }
  for (const s of sections) {
    const ns = bySection.get(s.id) ?? [];
    const accepted = acceptedBySection.get(s.id) ?? [];
    const filed = evidenceBySection.get(s.id) ?? [];
    lines.push(`## ${s.title}`);
    if (ns.length === 0 && accepted.length === 0 && filed.length === 0) {
      lines.push(`- (section opened, nothing written yet)`);
      continue;
    }
    for (const r of accepted.slice(0, 2)) {
      lines.push(`- desk research (${r.createdAt.slice(0, 10)}, accepted): ${r.insights!.replace(/\s+/g, " ").slice(0, 300)}`);
    }
    for (const n of ns) {
      const text = docToPlainText(n.content).replace(/\s+/g, " ").slice(0, 280);
      if (text) lines.push(`- ${n.title ? `${n.title}: ` : ""}${text}`);
    }
    // Filed evidence appears by caption — the investor's own words about what
    // each file shows (payloads are read only by the section's memo agent).
    for (const e of filed.slice(0, 6)) {
      lines.push(
        `- filed evidence: ${e.caption ? `"${e.caption.replace(/\s+/g, " ").slice(0, 160)}"` : "(no caption)"} [${e.name}]`
      );
    }
  }
  if (lines.length === 0) return "";
  let out = lines.join("\n");
  if (out.length > maxChars) out = out.slice(0, maxChars) + "…";
  return `INVESTOR'S DUE-DILIGENCE RECORD (their thinking + accepted desk research, verbatim — the map of their current understanding. Reference it, steer signal proposals by it per the circle-of-competence loop, never contradict it silently; you cannot edit it):\n${out}`;
}
