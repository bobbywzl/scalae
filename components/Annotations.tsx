"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useT } from "./PrefsProvider";
import { api } from "./util";
import type { Annotation } from "@/lib/types";

/**
 * Highlight-to-annotate over any rendered text surface, adapted from the
 * Release Edu app's highlighter: select text → floating toolbar (color
 * swatches + optional comment) → the highlight persists and repaints as a
 * <mark> via a DOM text-walker. Anchors are character offsets within a stable
 * surfaceId, with the selected text stored so stale offsets recover by search.
 *
 * Wrap any surface: <Annotatable surfaceId="brief">…rendered content…</Annotatable>
 * inside an <AnnotationsProvider symbol={…}>. Without a provider it renders
 * children untouched, so shared components stay usable anywhere.
 */

const COLOR_STYLES: Record<string, { background: string; borderBottom: string }> = {
  amber: { background: "rgba(251,191,36,0.28)", borderBottom: "2px solid rgba(251,191,36,0.65)" },
  blue: { background: "rgba(96,165,250,0.28)", borderBottom: "2px solid rgba(96,165,250,0.65)" },
  green: { background: "rgba(52,211,153,0.28)", borderBottom: "2px solid rgba(52,211,153,0.65)" },
  purple: { background: "rgba(167,139,250,0.28)", borderBottom: "2px solid rgba(167,139,250,0.65)" },
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
}

const Ctx = createContext<AnnotationsCtx | null>(null);

/** The ticker's live annotations (null outside an AnnotationsProvider). */
export function useAnnotations(): AnnotationsCtx | null {
  return useContext(Ctx);
}

export function AnnotationsProvider({ symbol, children }: { symbol: string; children: ReactNode }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

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
      setAnnotations((prev) => [...prev, annotation]);
    },
    [symbol]
  );

  const remove = useCallback<AnnotationsCtx["remove"]>(async (id) => {
    setAnnotations((prev) => prev.filter((x) => x.id !== id));
    await api(`/api/annotations/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  return <Ctx.Provider value={{ annotations, add, remove }}>{children}</Ctx.Provider>;
}

// ---------------------------------------------------------------------------
// DOM painting (Release Edu's text-walker approach)
// ---------------------------------------------------------------------------

function paintMarks(
  container: HTMLElement,
  anns: Annotation[],
  onDelete: (id: string) => void,
  deleteTitle: string
) {
  // Purge decorations FIRST — unwrapping a mark preserves children, so anything
  // not removed here accumulates once per repaint (Release Edu's 💬💬💬 bug).
  container.querySelectorAll("[data-ann-decoration]").forEach((el) => el.remove());
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
    const style = COLOR_STYLES[a.color] ?? COLOR_STYLES.amber;
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
      mark.style.background = style.background;
      mark.style.borderBottom = style.borderBottom;
      mark.style.borderRadius = "2px";
      mark.style.padding = "0 1px";
      mark.style.color = "inherit";
      mark.style.display = "inline";
      if (a.comment) mark.title = `💬 ${a.comment}`;

      target.parentNode!.insertBefore(mark, target);
      mark.appendChild(target);

      if (a.comment) {
        const icon = document.createElement("span");
        icon.dataset.annDecoration = "1";
        icon.textContent = " 💬";
        icon.style.fontSize = "9px";
        icon.style.opacity = "0.65";
        mark.appendChild(icon);
      }

      // Hover × delete
      let btn: HTMLButtonElement | null = null;
      mark.addEventListener("mouseenter", () => {
        if (btn) return;
        btn = document.createElement("button");
        btn.dataset.annDecoration = "1";
        btn.textContent = "×";
        btn.title = deleteTitle;
        btn.style.cssText =
          "display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-left:2px;border-radius:50%;background:rgba(0,0,0,0.25);font-size:10px;line-height:1;cursor:pointer;vertical-align:middle;border:none;color:inherit;";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          onDelete(a.id);
        });
        mark.appendChild(btn);
      });
      mark.addEventListener("mouseleave", () => {
        btn?.remove();
        btn = null;
      });
    }
  }
}

// ---------------------------------------------------------------------------
// The wrapper
// ---------------------------------------------------------------------------

export function Annotatable({ surfaceId, children }: { surfaceId: string; children: ReactNode }) {
  const ctx = useContext(Ctx);
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<{
    x: number;
    y: number;
    start: number;
    end: number;
    selectedText: string;
  } | null>(null);
  const [comment, setComment] = useState("");

  const surfaceAnns = ctx?.annotations.filter((a) => a.surfaceId === surfaceId) ?? [];
  const annsKey = surfaceAnns.map((a) => a.id).join(",");
  const remove = ctx?.remove;

  // Repaint whenever this surface's annotations change OR the children
  // re-render (the desk polls, and React reconciliation can rebuild the DOM
  // under us — `children` in the deps catches that).
  useEffect(() => {
    if (!ctx || !containerRef.current) return;
    paintMarks(
      containerRef.current,
      surfaceAnns,
      (id) => remove?.(id),
      t("notes.annotDelete")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annsKey, children, remove, t]);

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
      {toolbar && (
        <div
          ref={toolbarRef}
          className="absolute z-[60] rounded-xl bg-card2 border border-ink/15 shadow-2xl shadow-black/50 p-2 flex flex-col gap-1.5 w-56"
          style={{ left: Math.max(0, Math.min(toolbar.x - 112, (containerRef.current?.clientWidth ?? 300) - 224)), top: toolbar.y - 86 }}
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
                className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white/70 transition-colors cursor-pointer"
              />
            ))}
            <button
              onClick={dismiss}
              className="ml-auto text-muted hover:text-emph text-xs px-1 transition-colors"
            >
              ✕
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
        </div>
      )}
    </div>
  );
}
