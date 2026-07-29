"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/PrefsProvider";
import { api } from "@/components/util";
import type { RunSweep } from "@/lib/types";

/**
 * The field file: the run's persisted scout reports, verbatim — the evidence
 * chain behind the brief (claim → reading → sweep → source), open for the
 * investor to audit (PAT-style diagnosability). Lazy: nothing is fetched
 * until the investor opens it.
 */
export function FieldFile({ symbol, runId }: { symbol: string; runId: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // Data is keyed by the run it was fetched for — when the desk moves to a
  // fresh run, the old file simply stops matching (no reset effect needed;
  // stale expanded ids never match the new sweeps either).
  const [data, setData] = useState<{ runId: string; sweeps: RunSweep[] | null } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sweeps = data?.runId === runId ? data.sweeps : undefined;
  const failed = sweeps === null;

  useEffect(() => {
    if (!open || sweeps !== undefined) return;
    let stale = false;
    api<{ sweeps: RunSweep[] }>(
      `/api/tickers/${encodeURIComponent(symbol)}/fieldfile?runId=${encodeURIComponent(runId)}`
    )
      .then((r) => !stale && setData({ runId, sweeps: r.sweeps }))
      .catch(() => !stale && setData({ runId, sweeps: null }));
    return () => {
      stale = true;
    };
  }, [open, sweeps, symbol, runId]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mt-3 border-t border-hairline pt-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        title={t("memory.fieldFileTitle")}
        className="text-[10px] text-muted hover:text-emph transition-colors"
      >
        {open ? "▾" : "▸"} {t("memory.fieldFileButton")}
        {sweeps && sweeps.length > 0 && (
          <span className="text-muted/70"> · {t("memory.fieldFileReports", { n: sweeps.length })}</span>
        )}
      </button>
      {open && (
        <div className="mt-2">
          {sweeps === undefined && (
            <p className="text-[11px] text-muted italic">{t("memory.fieldFileLoading")}</p>
          )}
          {(failed || sweeps?.length === 0) && (
            <p className="text-[11px] text-muted italic">{t("memory.fieldFileEmpty")}</p>
          )}
          {sweeps && sweeps.length > 0 && (
            <ul className="space-y-1.5">
              {sweeps.map((s) => (
                <li key={s.id} className="rounded-xl bg-ink/4 border border-hairline px-3 py-2">
                  <button onClick={() => toggle(s.id)} className="w-full text-left flex items-center gap-2">
                    <span className="text-[11px] font-medium text-emph truncate">{s.label}</span>
                    {s.wave === 2 && (
                      <span className="shrink-0 rounded-full bg-accent/12 text-accent px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide">
                        {t("memory.fieldFileDeepDive")}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] text-muted tabular-nums">
                      {t("memory.fieldFileSources", { n: s.sources.length })} {expanded.has(s.id) ? "▾" : "▸"}
                    </span>
                  </button>
                  {expanded.has(s.id) && (
                    <div className="mt-1.5 border-t border-hairline pt-1.5">
                      <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-[#b5b5ba] font-sans max-h-80 overflow-y-auto">
                        {s.text}
                      </pre>
                      {s.sources.length > 0 && (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {s.sources.slice(0, 12).map((src) => (
                            <li key={src.url}>
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                title={src.title}
                                className="inline-block rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-1.5 py-px text-[10px] text-muted hover:text-accent transition-colors"
                              >
                                {src.domain ?? src.title.slice(0, 30)}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
