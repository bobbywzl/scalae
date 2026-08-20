/**
 * Scalae's icon set — stroke-based line icons on a 24×24 grid, replacing
 * every emoji/dingbat glyph the UI used to render as bare Unicode text
 * (inconsistent across platforms and fonts, and visually out of place next
 * to a designed product). One shared shell (IconBase) keeps every icon's
 * stroke weight, caps and joins identical; each icon composes simple SVG
 * primitives rather than hand-tuned bezier paths, so they stay easy to
 * read and adjust. Size and color are controlled by the caller via
 * `className` (Tailwind h-/w- for size, text-* for color — icons inherit
 * `currentColor`) exactly like the rest of the app's inline SVGs.
 */
import type { SVGProps } from "react";

export interface IconProps {
  className?: string;
}

function IconBase({
  className,
  children,
  viewBox = "0 0 24 24",
  ...rest
}: IconProps & { children: React.ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4"}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

// --- Brand mark ------------------------------------------------------------

/** The scales — Scalae's mark, after Graham's "weighing machine" (⚖️ replacement). */
export function ScaleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="12" y1="3" x2="12" y2="19" />
      <line x1="5" y1="7" x2="19" y2="7" />
      <path d="M4 7l-2.5 5.5a2.6 2.6 0 0 0 5 0L4 7Z" />
      <path d="M20 7l-2.5 5.5a2.6 2.6 0 0 0 5 0L20 7Z" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </IconBase>
  );
}

// --- File / attachment kinds -------------------------------------------------

/** Image attachment (🖼️ replacement). */
export function ImageIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.1 0L4 19" />
    </IconBase>
  );
}

/** PDF / generic document attachment (📄 replacement). */
export function FileIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
    </IconBase>
  );
}

/** Plain-text / note attachment (📝/📃 replacement) — a document with lines. */
export function NoteFileIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <line x1="8.5" y1="8" x2="15.5" y2="8" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
      <line x1="8.5" y1="16" x2="13" y2="16" />
    </IconBase>
  );
}

/** Generic attachment / drop target (📎 replacement). */
export function PaperclipIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M17 7.5 8.5 16a3 3 0 0 1-4.2-4.2l9-9a4.5 4.5 0 1 1 6.4 6.4L10.5 18.4a1.5 1.5 0 0 1-2.1-2.1L16 8.6" />
    </IconBase>
  );
}

/** Delete / remove (🗑 replacement). */
export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </IconBase>
  );
}

/**
 * File-kind icon for an attachment badge (image/pdf/text/generic) — the same
 * kind → icon mapping used to repeat as an inline ternary in every file that
 * lists attachments.
 */
export function AttachmentKindIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "pdf") return <FileIcon className={className} />;
  if (kind === "text") return <NoteFileIcon className={className} />;
  return <PaperclipIcon className={className} />;
}

// --- Theme -------------------------------------------------------------------

/** Dark theme (🌙 replacement). */
export function MoonIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </IconBase>
  );
}

/** Light theme (☀️ replacement). */
export function SunIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.6" y1="4.6" x2="6.3" y2="6.3" />
      <line x1="17.7" y1="17.7" x2="19.4" y2="19.4" />
      <line x1="4.6" y1="19.4" x2="6.3" y2="17.7" />
      <line x1="17.7" y1="6.3" x2="19.4" y2="4.6" />
    </IconBase>
  );
}

/** System theme (🖥 replacement). */
export function MonitorIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <line x1="8" y1="20" x2="16" y2="20" />
      <line x1="12" y1="16" x2="12" y2="20" />
    </IconBase>
  );
}

// --- Nav / identity ------------------------------------------------------------

/** Portfolio (💼 replacement). */
export function BriefcaseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="7.5" width="18" height="12" rx="1.5" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <line x1="3" y1="12.5" x2="21" y2="12.5" />
    </IconBase>
  );
}

/** Person / account (👤 replacement). */
export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </IconBase>
  );
}

/** Chat / feedback bubble (💬 replacement). */
export function MessageIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 4v-4H5.5A1.5 1.5 0 0 1 4 14.5v-9Z" />
    </IconBase>
  );
}

/** Bug report (🐛 replacement). */
export function BugIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="8" y="9" width="8" height="10" rx="4" />
      <line x1="12" y1="6" x2="12" y2="9" />
      <path d="M9.5 5.5 12 6l2.5-.5" />
      <line x1="8" y1="12" x2="4.5" y2="11" />
      <line x1="8" y1="16" x2="4.5" y2="17" />
      <line x1="16" y1="12" x2="19.5" y2="11" />
      <line x1="16" y1="16" x2="19.5" y2="17" />
    </IconBase>
  );
}

/** Feature idea (💡 replacement). */
export function LightbulbIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M7 10.5a5 5 0 1 1 10 0c0 2-1.2 3-2 4-.6.7-1 1.3-1 2.5H10c0-1.2-.4-1.8-1-2.5-.8-1-2-2-2-4Z" />
    </IconBase>
  );
}

/** Question (❓ replacement). */
export function HelpCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2.9-1.2 2" />
      <line x1="12" y1="16.5" x2="12" y2="16.6" />
    </IconBase>
  );
}

// --- Voice ---------------------------------------------------------------------

/** Read aloud (🔊 replacement). */
export function VolumeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 10v4h3.5L12 17.5v-11L7.5 10H4Z" />
      <path d="M16 9.5a4 4 0 0 1 0 5" />
      <path d="M18.5 7a7.5 7.5 0 0 1 0 10" />
    </IconBase>
  );
}

/** Stop reading aloud (◼ replacement). */
export function StopIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </IconBase>
  );
}

/** Start research (▶ replacement). */
export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props} strokeLinejoin="round">
      <path d="M6.5 4.5v15l12-7.5-12-7.5Z" />
    </IconBase>
  );
}

/** Voice dictation (🎤 replacement). */
export function MicIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="9" y1="21" x2="15" y2="21" />
    </IconBase>
  );
}

// --- Evidence / sourcing ---------------------------------------------------------

/** Evidence link count (🔗 replacement). */
export function LinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 14a4 4 0 0 1 0-5.7l2.5-2.5a4 4 0 1 1 5.7 5.7L17 12.7" />
      <path d="M14 10a4 4 0 0 1 0 5.7l-2.5 2.5a4 4 0 1 1-5.7-5.7L7 11.3" />
    </IconBase>
  );
}

/** Small inline "note points at" marker (☞ replacement). */
export function NoteArrowIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 6v6a4 4 0 0 0 4 4h9" />
      <path d="M14.5 12.5 18 16l-3.5 3.5" />
    </IconBase>
  );
}

// --- Actions -------------------------------------------------------------------

/** Confirm / success (✓ replacement). */
export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <polyline points="4.5 12.5 9.5 17.5 19.5 6.5" />
    </IconBase>
  );
}

/** Dismiss / close (✕ replacement). */
export function XIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </IconBase>
  );
}

/** AI-suggested / summon accent (✦ replacement). */
export function SparkleIcon(props: IconProps) {
  return (
    <IconBase {...props} strokeLinejoin="round">
      <path d="M12 3.5c.5 3 2 5.3 5 6.2-3 .9-4.5 3.2-5 6.3-.5-3.1-2-5.4-5-6.3 3-.9 4.5-3.2 5-6.2Z" />
      <path d="M19 15.5c.3 1.4.9 2.4 2.2 2.9-1.3.5-1.9 1.5-2.2 2.9-.3-1.4-.9-2.4-2.2-2.9 1.3-.5 1.9-1.5 2.2-2.9Z" />
    </IconBase>
  );
}

/** Edit (✎ replacement). */
export function PencilIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15 5l4 4L8 20H4v-4L15 5Z" />
      <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
    </IconBase>
  );
}

/** Warning (⚠ replacement). */
export function AlertTriangleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4 21 19.5H3L12 4Z" />
      <line x1="12" y1="10" x2="12" y2="14.5" />
      <line x1="12" y1="17" x2="12" y2="17.1" />
    </IconBase>
  );
}

/** Marketable / instant fill (⚡ replacement). */
export function ZapIcon(props: IconProps) {
  return (
    <IconBase {...props} strokeLinejoin="round">
      <path d="M13 3 5 13.5h5.5L11 21l8-11h-5.5L13 3Z" />
    </IconBase>
  );
}

/** Red flag (⚑ replacement). */
export function FlagIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="6" y1="3" x2="6" y2="21" />
      <path d="M6 4.5h11l-3 4 3 4H6" />
    </IconBase>
  );
}

/** Track / add (✚ replacement). */
export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </IconBase>
  );
}

/** List view (☰ replacement). */
export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </IconBase>
  );
}

/** Cards view (▦ replacement). */
export function GridIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </IconBase>
  );
}

/** Blockquote (❝ replacement). */
export function QuoteIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 15.5V11a3 3 0 0 1 3-3" />
      <path d="M5 15.5h3v-4.5H5" />
      <path d="M13 15.5V11a3 3 0 0 1 3-3" />
      <path d="M13 15.5h3v-4.5h-3" />
    </IconBase>
  );
}

/** Clear formatting (⌫ replacement). */
export function EraserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 13.5 10.5 21H6l-3-3 9-9 6 6-3.5 3.5Z" />
      <line x1="9" y1="12" x2="15" y2="18" />
    </IconBase>
  );
}

/** Undo (↺ replacement). */
export function UndoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 8H4V6" />
      <path d="M4.5 8A8 8 0 1 1 4 13" />
    </IconBase>
  );
}

/** Redo (↻ replacement). */
export function RedoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 8h2V6" />
      <path d="M19.5 8A8 8 0 1 0 20 13" />
    </IconBase>
  );
}

/** Restore a dismissed item (↩ replacement) — distinct arc from Undo. */
export function RestoreIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 8 4.5 12 9 16" />
      <path d="M4.5 12H14a5.5 5.5 0 0 1 0 11h-1.5" />
    </IconBase>
  );
}

/** Bidirectional replace / overlap (⇄ replacement). */
export function SwapIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 8h13.5" />
      <path d="M14.5 4.5 18 8l-3.5 3.5" />
      <path d="M20 16H6.5" />
      <path d="M9.5 12.5 6 16l3.5 3.5" />
    </IconBase>
  );
}

/** Qualitative-signal type marker (◆ replacement) — small inline diamond. */
export function DiamondIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4 19 12 12 20 5 12 12 4Z" />
    </IconBase>
  );
}

/** Order working / pending (◷ replacement). */
export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.5 2" />
    </IconBase>
  );
}

/** Trace a source / jump to reference (⧉ replacement) — two joined squares. */
export function TraceIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="9" width="11" height="11" rx="1.5" />
      <path d="M9 9V6.5A1.5 1.5 0 0 1 10.5 5H18a1.5 1.5 0 0 1 1.5 1.5V14a1.5 1.5 0 0 1-1.5 1.5h-2.5" />
    </IconBase>
  );
}

/** Open in full / expand (⤢ replacement). */
export function ExpandIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 15 4.5 19.5" />
      <path d="M4.5 15v4.5H9" />
      <path d="M15 9 19.5 4.5" />
      <path d="M19.5 9V4.5H15" />
    </IconBase>
  );
}

/** Exit full / collapse (⤡ replacement) — mirror of Expand, bracket at center. */
export function CollapseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 19.5 9 15" />
      <path d="M9 18.5V15H5.5" />
      <path d="M19.5 4.5 15 9" />
      <path d="M15 5.5V9H18.5" />
    </IconBase>
  );
}
