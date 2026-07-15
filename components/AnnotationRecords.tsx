"use client";

import { useMemo, useState } from "react";
import { COLOR_SWATCHES, useAnnotations } from "./Annotations";
import { useT } from "./PrefsProvider";
import { timeAgo } from "./util";
import type { DigestItem, Signal, SignalWithReadings } from "@/lib/types";

/**
 * Annotation records: every highlight the investor has made on this ticker —
 * the quoted text, its color, the comment, which surface it lives on, and when
 * — in one reviewable section, live-synced with the highlighter (same context)
 * and deletable from here. Hidden entirely until the first highlight exists.
 */
export function AnnotationRecords({
  digest,
  signals,
  signalsById,
}: {
  digest: DigestItem[];
  /** Active + retired signals with reading history (for reading anchors). */
  signals: SignalWithReadings[];
  signalsById: Map<string, Signal>;
}) {
  const ctx = useAnnotations();
  const { t } = useT();
  const [open, setOpen] = useState(false);

  // Resolve a surfaceId to a human label using the desk's own data.
  const readingIndex = useMemo(() => {
    const m = new Map<string, { name: string; date: string }>();
    for (const s of signals) {
      for (const r of s.history) m.set(r.id, { name: s.name, date: r.date.slice(0, 10) });
      if (s.latest) m.set(s.latest.id, { name: s.name, date: s.latest.date.slice(0, 10) });
    }
    return m;
  }, [signals]);
  const digestIndex = useMemo(() => new Map(digest.map((d) => [d.id, d.headline])), [digest]);

  if (!ctx || ctx.annotations.length === 0) return null;

  function surfaceLabel(surfaceId: string): string {
    if (surfaceId === "brief") return t("notes.annSurfBrief");
    if (surfaceId === "dossier") return t("notes.annSurfDossier");
    if (surfaceId.startsWith("digest:")) {
      const headline = digestIndex.get(surfaceId.slice(7));
      return headline
        ? t("notes.annSurfEvidence", { headline: headline.slice(0, 60) })
        : t("notes.annSurfEvidenceGeneric");
    }
    if (surfaceId.startsWith("reading:")) {
      const r = readingIndex.get(surfaceId.slice(8));
      return r
        ? t("notes.annSurfReading", { name: r.name, date: r.date })
        : t("notes.annSurfReadingGeneric");
    }
    if (surfaceId.startsWith("signal:")) {
      const [, id, part] = surfaceId.split(":");
      const name = signalsById.get(id)?.name ?? "?";
      return part === "backstory"
        ? t("notes.annSurfBackstory", { name })
        : t("notes.annSurfThesis", { name });
    }
    if (surfaceId.startsWith("msg:")) return t("notes.annSurfChat");
    return surfaceId;
  }

  const rows = [...ctx.annotations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-left w-full group"
      >
        <h2 className="text-[11px] uppercase tracking-widest text-muted font-semibold flex items-center gap-2">
          {t("notes.annRecTitle")}{" "}
          <span className="rounded-full bg-ink/6 text-muted px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
            {rows.length}
          </span>
        </h2>
        <span className="text-muted text-[10px] group-hover:text-emph transition-colors">
          {open ? `▾ ${t("common.hide")}` : `▸ ${t("common.show")}`}
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-card border border-hairline px-4 py-3">
          <ul className="space-y-2.5">
            {rows.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 text-xs group/row">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLOR_SWATCHES[a.color] ?? COLOR_SWATCHES.amber }}
                  title={a.color}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-emph leading-snug">
                    “{a.selectedText.length > 180 ? a.selectedText.slice(0, 180) + "…" : a.selectedText}”
                  </p>
                  {a.comment && <p className="mt-0.5 text-[11px] text-[#b5b5ba]">💬 {a.comment}</p>}
                  <p className="mt-0.5 text-[10px] text-muted">
                    {surfaceLabel(a.surfaceId)} · {timeAgo(a.createdAt, t)}
                  </p>
                </div>
                <button
                  onClick={() => ctx.remove(a.id)}
                  title={t("notes.annotDelete")}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted/50 hover:text-loss opacity-0 group-hover/row:opacity-100 transition-all"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
