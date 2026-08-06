"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { useT } from "./PrefsProvider";

/**
 * The notepad's rich-text editor (TipTap/ProseMirror). Content is stored as
 * ProseMirror JSON and rendered only through this schema — never raw HTML.
 * Google-doc-style basics: bold/italic/underline/strike, headings, lists,
 * quotes, font family and size, undo/redo.
 */

const FONT_SERIF = "Georgia, 'Times New Roman', serif";
const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const SIZES = ["12px", "14px", "16px", "18px", "24px"];

/** Translucent highlighter inks — legible over both themes. */
const HIGHLIGHTS: { name: string; swatch: string; value: string }[] = [
  { name: "amber", swatch: "#FBBF24", value: "rgba(251,191,36,0.35)" },
  { name: "blue", swatch: "#60A5FA", value: "rgba(96,165,250,0.35)" },
  { name: "green", swatch: "#34D399", value: "rgba(52,211,153,0.35)" },
  { name: "purple", swatch: "#A78BFA", value: "rgba(167,139,250,0.35)" },
];

/** CSSOM round-trips colors with spaces ("rgba(1, 2, 3, 0.35)") — compare space-free. */
const normColor = (v: string | undefined) => (v ?? "").replace(/\s+/g, "");

/**
 * The notepad schema — shared by the live editor and the read-mode renderer
 * (generateHTML), so a document always renders identically in both.
 */
export const NOTE_EXTENSIONS = [
  StarterKit.configure({ link: { openOnClick: false } }),
  TextStyleKit,
];

export function NoteEditor({
  initialContent,
  onChange,
}: {
  /** TipTap JSON (serialized) to start from. */
  initialContent: string;
  /** Fires with the serialized document on every edit (parent debounces saves). */
  onChange: (json: string) => void;
}) {
  const { t } = useT();
  const editor = useEditor({
    extensions: NOTE_EXTENSIONS,
    content: parseNoteDoc(initialContent),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "note-prose focus:outline-none min-h-[140px] text-[0.9375rem] leading-relaxed",
      },
    },
    onUpdate: ({ editor: e }) => onChange(JSON.stringify(e.getJSON())),
  });

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            quote: e.isActive("blockquote"),
            bullets: e.isActive("bulletList"),
            numbered: e.isActive("orderedList"),
            block: e.isActive("heading", { level: 1 })
              ? "h1"
              : e.isActive("heading", { level: 2 })
                ? "h2"
                : e.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p",
            font: (e.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
            size: (e.getAttributes("textStyle").fontSize as string | undefined) ?? "",
            highlight:
              (e.getAttributes("textStyle").backgroundColor as string | undefined) ?? "",
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  if (!editor) return <div className="min-h-[120px]" />;

  const chain = () => editor.chain().focus();

  return (
    <div>
      <div className="flex items-center gap-0.5 flex-wrap border-b border-hairline pb-1.5 mb-2">
        <select
          value={s?.block ?? "p"}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") chain().setParagraph().run();
            else chain().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
          }}
          className="rounded bg-ink/6 border border-hairline text-[0.625rem] text-emph px-1 py-0.5 mr-1"
        >
          <option value="p">{t("notes.tbParagraph")}</option>
          <option value="h1">{t("notes.tbH1")}</option>
          <option value="h2">{t("notes.tbH2")}</option>
          <option value="h3">{t("notes.tbH3")}</option>
        </select>
        <select
          value={s?.font ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) chain().setFontFamily(v).run();
            else chain().unsetFontFamily().run();
          }}
          title={t("notes.tbFont")}
          className="rounded bg-ink/6 border border-hairline text-[0.625rem] text-emph px-1 py-0.5"
        >
          <option value="">{t("notes.tbFontDefault")}</option>
          <option value={FONT_SERIF}>{t("notes.tbFontSerif")}</option>
          <option value={FONT_MONO}>{t("notes.tbFontMono")}</option>
        </select>
        <select
          value={s?.size ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) chain().setFontSize(v).run();
            else chain().unsetFontSize().run();
          }}
          title={t("notes.tbSize")}
          className="rounded bg-ink/6 border border-hairline text-[0.625rem] text-emph px-1 py-0.5 mr-1"
        >
          <option value="">{t("notes.tbSize")}</option>
          {SIZES.map((v) => (
            <option key={v} value={v}>
              {v.replace("px", "")}
            </option>
          ))}
        </select>
        <Btn active={s?.bold} title={t("notes.tbBold")} onClick={() => chain().toggleBold().run()}>
          <b>B</b>
        </Btn>
        <Btn active={s?.italic} title={t("notes.tbItalic")} onClick={() => chain().toggleItalic().run()}>
          <i>I</i>
        </Btn>
        <Btn
          active={s?.underline}
          title={t("notes.tbUnderline")}
          onClick={() => chain().toggleUnderline().run()}
        >
          <u>U</u>
        </Btn>
        <Btn active={s?.strike} title={t("notes.tbStrike")} onClick={() => chain().toggleStrike().run()}>
          <s>S</s>
        </Btn>
        <span className="w-px h-4 bg-hairline mx-1" />
        {HIGHLIGHTS.map((h) => (
          <button
            key={h.name}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              normColor(s?.highlight) === normColor(h.value)
                ? chain().unsetBackgroundColor().run()
                : chain().setBackgroundColor(h.value).run()
            }
            title={t("notes.tbHighlight")}
            style={{ backgroundColor: h.swatch }}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              normColor(s?.highlight) === normColor(h.value)
                ? "border-foreground"
                : "border-transparent hover:border-muted"
            }`}
          />
        ))}
        <Btn title={t("notes.tbHighlightOff")} onClick={() => chain().unsetBackgroundColor().run()}>
          ⃠
        </Btn>
        <span className="w-px h-4 bg-hairline mx-1" />
        <Btn
          active={s?.bullets}
          title={t("notes.tbBullets")}
          onClick={() => chain().toggleBulletList().run()}
        >
          ••
        </Btn>
        <Btn
          active={s?.numbered}
          title={t("notes.tbNumbered")}
          onClick={() => chain().toggleOrderedList().run()}
        >
          1.
        </Btn>
        <Btn active={s?.quote} title={t("notes.tbQuote")} onClick={() => chain().toggleBlockquote().run()}>
          ❝
        </Btn>
        <span className="w-px h-4 bg-hairline mx-1" />
        <Btn
          title={t("notes.tbClear")}
          onClick={() => chain().unsetAllMarks().clearNodes().run()}
        >
          ⌫
        </Btn>
        <span className="ml-auto" />
        <Btn title={t("notes.tbUndo")} disabled={!s?.canUndo} onClick={() => chain().undo().run()}>
          ↺
        </Btn>
        <Btn title={t("notes.tbRedo")} disabled={!s?.canRedo} onClick={() => chain().redo().run()}>
          ↻
        </Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/** One toolbar button; mousedown is swallowed so the editor keeps its selection. */
function Btn({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-1.5 py-0.5 text-[0.6875rem] leading-4 transition-colors disabled:opacity-30 ${
        active ? "bg-ink/15 text-foreground" : "text-muted hover:text-emph hover:bg-ink/8"
      }`}
    >
      {children}
    </button>
  );
}

/** Parse a stored notepad document, falling back to an empty doc (shared with read mode). */
export function parseNoteDoc(json: string): object {
  try {
    const doc = JSON.parse(json) as { type?: string };
    if (doc?.type === "doc") return doc;
  } catch {
    /* fall through */
  }
  return { type: "doc", content: [{ type: "paragraph" }] };
}
