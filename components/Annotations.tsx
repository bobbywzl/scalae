"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useT } from "./PrefsProvider";
import { api, timeAgo } from "./util";
import type { Annotation } from "@/lib/types";

/**
 * Highlight-to-annotate over any rendered text surface: select text → floating
 * toolbar (color swatches + optional comment) → the highlight persists and
 * repaints as a <mark> via a DOM text-walker. Anchors are character offsets
 * within a stable surfaceId, with the selected text stored so stale offsets
 * recover by search. Highlights are permanent until explicitly deleted.
 *
 * Design contract (see the "Highlight annotations" block in globals.css):
 *  - A mark carries PAINT ONLY — no horizontal size, no borders, no injected
 *    children — so applying or hovering a highlight never moves the words
 *    underneath (the iOS-marker look: a tint laid over the text).
 *  - A commented highlight reads as a different SHAPE: a ringed capsule
 *    instead of the plain flat tint.
 *  - A fresh highlight sweeps in left→right; hovering any highlight raises a
 *    comment bar that fades up (comment, age, delete) and fades away on leave.
 *
 * Wrap any surface: <Annotatable surfaceId="brief">…rendered content…</Annotatable>
 * inside an <AnnotationsProvider symbol={…}>. Without a provider it renders
 * children untouched, so shared components stay usable anywhere.
 */

/** Per-color paint layers: tint (marker fill), deep (hover layer), line (comment ring). */
const COLOR_STYLES: Record<string, { tint: string; deep: string; line: string }> = {
  amber: { tint: "rgba(251,191,36,0.28)", deep: "rgba(251,191,36,0.15)", line: "rgba(251,191,36,0.78)" },
  blue: { tint: "rgba(96,165,250,0.28)", deep: "rgba(96,165,250,0.15)", line: "rgba(96,165,250,0.78)" },
  green: { tint: "rgba(52,211,153,0.28)", deep: "rgba(52,211,153,0.15)", line: "rgba(52,211,153,0.78)" },
  purple: { tint: "rgba(167,139,250,0.28)", deep: "rgba(167,139,250,0.15)", line: "rgba(167,139,250,0.78)" },
};
export const COLOR_SWATCHES: Record<string, string> = {
  amber: "#FBBF24",
  blue: "#60A5FA",
  green: "#34D399",
  purple: "#A78BFA",
};

interface AnnotationsCtx {
  annotations: Annotation[];
  add: (
    a: Pick<Annotation, "surfaceId" | "selectedText" | "startOffset" | "endOffset" | "color" | "comment">
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Ids created this session whose sweep-in hasn't painted yet (consumed by the painter). */
  freshIds: RefObject<Set<string>>;
}

const Ctx = createContext<AnnotationsCtx | null>(null);

/** The ticker's live annotations (null outside an AnnotationsProvider). */
export function useAnnotations(): AnnotationsCtx | null {
  return useContext(Ctx);
}

export function AnnotationsProvider({ symbol, children }: { symbol: string; children: ReactNode }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const freshIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    api<{ annotations: Annotation[] }>(`/api/tickers/${encodeURIComponent(symbol)}/annotations`)
      .then((r) => alive && setAnnotations(r.annotations))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [symbol]);

  const add = useCallback<AnnotationsCtx["add"]>(
    async (a) => {
      const { annotation } = await api<{ annotation: Annotation }>(
        `/api/tickers/${encodeURIComponent(symbol)}/annotations`,
        { method: "POST", body: JSON.stringify(a) }
      );
      freshIds.current.add(annotation.id);
      setAnnotations((prev) => [...prev, annotation]);
    },
    [symbol]
  );

  const remove = useCallback<AnnotationsCtx["remove"]>(async (id) => {
    setAnnotations((prev) => prev.filter((x) => x.id !== id));
    await api(`/api/annotations/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ annotations, add, remove, freshIds }}>{children}</Ctx.Provider>;
}

// ---------------------------------------------------------------------------
// DOM painting (text-walker approach)
// ---------------------------------------------------------------------------

interface HoverHooks {
  enter: (a: Annotation, segments: HTMLElement[]) => void;
  leave: () => void;
}

function paintMarks(
  container: HTMLElement,
  anns: Annotation[],
  fresh: Set<string>,
  hover: HoverHooks
) {
  // Unwrapping a mark preserves its children, so nothing accumulates across
  // repaints; normalize() re-merges the split text nodes afterwards.
  container.querySelectorAll("mark[data-annotation-id]").forEach((mark) => {
    const parent = mark.parentNode!;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  container.normalize();
  if (anns.length === 0) return;

  const fullText = () => {
    let text = "";
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) text += node.textContent ?? "";
    return text;
  };
  const textNodes = () => {
    const result: { node: Text; globalStart: number; globalEnd: number }[] = [];
    let offset = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const len = node.textContent?.length ?? 0;
      result.push({ node, globalStart: offset, globalEnd: offset + len });
      offset += len;
    }
    return result;
  };

  for (const a of [...anns].sort((x, y) => x.startOffset - y.startOffset)) {
    const palette = COLOR_STYLES[a.color] ?? COLOR_STYLES.amber;
    // Stale-offset recovery: if the text at the stored offsets no longer
    // matches (content re-rendered differently), search for the quote instead.
    let start = a.startOffset;
    let end = a.endOffset;
    const text = fullText();
    if (text.slice(start, end) !== a.selectedText && a.selectedText) {
      const idx = text.indexOf(a.selectedText);
      if (idx < 0) continue; // quote gone from this surface — skip silently
      start = idx;
      end = idx + a.selectedText.length;
    }

    // A highlight can span several text nodes (bold runs, links, line
    // fragments) — every segment gets the same paint and the same hover.
    const segments: HTMLElement[] = [];
    for (const { node, globalStart, globalEnd } of textNodes()) {
      if (globalStart >= end || globalEnd <= start) continue;
      const localStart = Math.max(0, start - globalStart);
      const localEnd = Math.min(node.length, end - globalStart);
      if (localStart >= localEnd) continue;

      let target = node;
      if (localStart > 0) target = node.splitText(localStart);
      if (localEnd - localStart < target.length) target.splitText(localEnd - localStart);

      const mark = document.createElement("mark");
      mark.dataset.annotationId = a.id;
      mark.className = `ann-mark${a.comment ? " ann-mark--commented" : ""}${
        fresh.has(a.id) ? " ann-fresh" : ""
      }`;
      mark.style.setProperty("--ann-tint", palette.tint);
      mark.style.setProperty("--ann-deep", palette.deep);
      mark.style.setProperty("--ann-line", palette.line);

      target.parentNode!.insertBefore(mark, target);
      mark.appendChild(target);
      segments.push(mark);
    }

    for (const seg of segments) {
      seg.addEventListener("mouseenter", () => {
        for (const m of segments) m.classList.add("ann-hot");
        hover.enter(a, segments);
      });
      seg.addEventListener("mouseleave", () => {
        for (const m of segments) m.classList.remove("ann-hot");
        hover.leave();
      });
      // Tap affordance (no hover on touch) — but never on a drag-select
      // ending over the highlight, which must keep opening the toolbar.
      seg.addEventListener("click", () => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) return;
        hover.enter(a, segments);
      });
    }

    // The sweep-in plays exactly once: on the paint that first shows it.
    fresh.delete(a.id);
  }
}

// ---------------------------------------------------------------------------
// The wrapper
// ---------------------------------------------------------------------------

function CrossIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden>
      <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden>
      <rect x="1" y="6.5" width="2.4" height="4.5" rx="0.7" />
      <rect x="4.8" y="3.5" width="2.4" height="7.5" rx="0.7" />
      <rect x="8.6" y="1" width="2.4" height="10" rx="0.7" />
    </svg>
  );
}

export function Annotatable({
  surfaceId,
  children,
  onVisualize,
}: {
  surfaceId: string;
  children: ReactNode;
  /**
   * When set, the selection toolbar grows a Visualize tool: the callback gets
   * the highlighted text and the surface owns what happens next (the dd page
   * opens the visualizer dialog). Highlighting stays untouched — visualizing
   * a passage never creates an annotation.
   */
  onVisualize?: (sel: { selectedText: string }) => void;
}) {
  const ctx = useContext(Ctx);
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<{
    x: number;
    y: number;
    start: number;
    end: number;
    selectedText: string;
  } | null>(null);
  const [comment, setComment] = useState("");

  // The hover comment bar: anchored above (or below) the hovered highlight.
  // Position is state; the annotation itself is read live from the context so
  // a highlight deleted elsewhere drops its bar in the same render.
  const [bar, setBar] = useState<{ id: string; x: number; y: number; below: boolean } | null>(null);
  const [barClosing, setBarClosing] = useState(false);
  const barTimers = useRef<{ close?: ReturnType<typeof setTimeout>; gone?: ReturnType<typeof setTimeout> }>({});

  const surfaceAnns = ctx?.annotations.filter((a) => a.surfaceId === surfaceId) ?? [];
  const annsKey = surfaceAnns.map((a) => a.id).join(",");
  const remove = ctx?.remove;
  const barAnn = bar ? surfaceAnns.find((a) => a.id === bar.id) : undefined;

  const cancelBarTimers = useCallback(() => {
    if (barTimers.current.close) clearTimeout(barTimers.current.close);
    if (barTimers.current.gone) clearTimeout(barTimers.current.gone);
    barTimers.current = {};
  }, []);

  const openBar = useCallback(
    (a: Annotation, segments: HTMLElement[]) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return;
      cancelBarTimers();
      setBarClosing(false);
      // Anchor on the highlight's topmost fragment; flip below when the
      // surface has no room above (first lines of a card).
      let topRect: DOMRect | null = null;
      for (const seg of segments) {
        const r = seg.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (!topRect || r.top < topRect.top) topRect = r;
      }
      if (!topRect) return;
      const below = topRect.top - box.top < 52;
      setBar({
        id: a.id,
        x: Math.max(16, Math.min(topRect.left - box.left + topRect.width / 2, box.width - 16)),
        y: below ? topRect.bottom - box.top + 7 : topRect.top - box.top - 7,
        below,
      });
    },
    [cancelBarTimers]
  );

  // Leaving a highlight (or the bar) fades the bar away — after a grace
  // window long enough to travel from the text into the bar itself.
  const scheduleBarClose = useCallback(() => {
    cancelBarTimers();
    barTimers.current.close = setTimeout(() => {
      setBarClosing(true);
      barTimers.current.gone = setTimeout(() => {
        setBar(null);
        setBarClosing(false);
      }, 190);
    }, 260);
  }, [cancelBarTimers]);

  const holdBar = useCallback(() => {
    cancelBarTimers();
    setBarClosing(false);
  }, [cancelBarTimers]);

  const closeBarNow = useCallback(() => {
    cancelBarTimers();
    setBar(null);
    setBarClosing(false);
  }, [cancelBarTimers]);

  useEffect(() => cancelBarTimers, [cancelBarTimers]);

  // Repaint whenever this surface's annotations change OR the children
  // re-render (the desk polls, and React reconciliation can rebuild the DOM
  // under us — `children` in the deps catches that).
  useEffect(() => {
    if (!ctx || !containerRef.current) return;
    paintMarks(containerRef.current, surfaceAnns, ctx.freshIds.current ?? new Set(), {
      enter: openBar,
      leave: scheduleBarClose,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annsKey, children, openBar, scheduleBarClose]);

  // Dismiss the toolbar on outside interaction (but not the toolbar itself).
  useEffect(() => {
    if (!toolbar) return;
    const inToolbar = (target: EventTarget | null) => toolbarRef.current?.contains(target as Node);
    const onSelectionChange = () => {
      if (inToolbar(document.activeElement)) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim() === "") dismiss();
    };
    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (inToolbar(e.target)) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) dismiss();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside as EventListener, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside as EventListener);
    };
  }, [toolbar]);

  // Tap-away closes the hover bar (touch has no mouseleave to fade it).
  useEffect(() => {
    if (!bar) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const tgt = e.target as Node;
      if (barRef.current?.contains(tgt)) return;
      if (
        tgt instanceof Element &&
        tgt.closest(`mark[data-annotation-id="${CSS.escape(bar.id)}"]`)
      )
        return;
      closeBarNow();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown as EventListener, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown as EventListener);
    };
  }, [bar, closeBarNow]);

  if (!ctx) return <>{children}</>;

  function dismiss() {
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  }

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) return;
    if (
      !containerRef.current.contains(sel.anchorNode) ||
      !containerRef.current.contains(sel.focusNode)
    )
      return;
    const range = sel.getRangeAt(0);
    // Global character offsets: length of everything before the selection start.
    const pre = document.createRange();
    pre.selectNodeContents(containerRef.current);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const end = start + range.toString().length;
    if (end <= start) return;

    const rect = range.getBoundingClientRect();
    const box = containerRef.current.getBoundingClientRect();
    setToolbar({
      x: rect.left - box.left + rect.width / 2,
      y: rect.top - box.top,
      start,
      end,
      selectedText: sel.toString().trim(),
    });
    setComment("");
  }

  async function save(color: string) {
    if (!toolbar || !ctx) return;
    const payload = {
      surfaceId,
      selectedText: toolbar.selectedText,
      startOffset: toolbar.start,
      endOffset: toolbar.end,
      color,
      comment: comment.trim() || null,
    };
    dismiss();
    await ctx.add(payload).catch(() => {});
  }

  return (
    <div ref={containerRef} className="relative select-text" onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp}>
      {children}

      {/* Hover comment bar: fades up over the highlight, fades away on leave. */}
      {bar && barAnn && (
        <div
          ref={barRef}
          className="ann-bar"
          style={{
            left: bar.x,
            top: bar.y,
            transform: bar.below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
          }}
          onMouseEnter={holdBar}
          onMouseLeave={scheduleBarClose}
        >
          <div
            className={`ann-bar-inner flex items-center gap-2 rounded-xl bg-card2 border border-ink/15 shadow-xl shadow-black/30 px-3 py-1.5 ${
              barClosing ? "ann-bar-out" : ""
            }`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLOR_SWATCHES[barAnn.color] ?? COLOR_SWATCHES.amber }}
              aria-hidden
            />
            {barAnn.comment && (
              <p className="max-w-[15rem] text-xs leading-snug text-emph line-clamp-4 [overflow-wrap:anywhere]">
                {barAnn.comment}
              </p>
            )}
            <span className="shrink-0 text-[0.625rem] text-muted/80 tabular-nums whitespace-nowrap">
              {timeAgo(barAnn.createdAt, t)}
            </span>
            <span className="h-3.5 w-px shrink-0 bg-ink/15" aria-hidden />
            <button
              onClick={() => {
                closeBarNow();
                remove?.(barAnn.id);
              }}
              title={t("notes.annotDelete")}
              aria-label={t("notes.annotDelete")}
              className="shrink-0 rounded-md p-1 -m-1 text-muted hover:text-loss hover:bg-loss/10 transition-colors"
            >
              <CrossIcon />
            </button>
          </div>
        </div>
      )}

      {toolbar && (
        <div
          ref={toolbarRef}
          className="ann-pop absolute z-[60] rounded-xl bg-card2 border border-ink/15 shadow-2xl shadow-black/50 p-2 flex flex-col gap-1.5 w-56"
          style={{ left: Math.max(0, Math.min(toolbar.x - 112, (containerRef.current?.clientWidth ?? 300) - 224)), top: toolbar.y - (onVisualize ? 116 : 86) }}
          onMouseDown={(e) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "BUTTON") return;
            e.preventDefault(); // keep the selection alive
          }}
        >
          <div className="flex items-center gap-1.5">
            {Object.entries(COLOR_SWATCHES).map(([color, hex]) => (
              <button
                key={color}
                title={color}
                onClick={() => save(color)}
                style={{ backgroundColor: hex }}
                className="w-5 h-5 rounded-full border-2 border-transparent hover:border-ink/60 transition-colors cursor-pointer"
              />
            ))}
            <button
              onClick={dismiss}
              aria-label={t("common.dismiss")}
              className="ml-auto rounded-md p-1 text-muted hover:text-emph transition-colors"
            >
              <CrossIcon />
            </button>
          </div>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save("amber");
              }
            }}
            placeholder={t("notes.annotPlaceholder")}
            className="w-full rounded-md border border-hairline bg-ink/6 px-2 py-1 text-[0.6875rem] focus:outline-none focus:border-accent/50 placeholder:text-muted/60"
          />
          {onVisualize && (
            <button
              onClick={() => {
                const selectedText = toolbar.selectedText;
                dismiss();
                onVisualize({ selectedText });
              }}
              className="w-full flex items-center gap-1.5 rounded-md bg-accent/10 hover:bg-accent/20 text-accent px-2 py-1 text-[0.6875rem] font-medium transition-colors"
            >
              <ChartIcon />
              {t("notes.vizAction")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
