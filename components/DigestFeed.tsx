"use client";

import type { DigestItem } from "@/lib/types";
import { IMPACT_DOT, timeAgo } from "./util";

export function DigestFeed({ items }: { items: DigestItem[] }) {
  if (items.length === 0) {
    return <p className="text-muted text-xs italic">No digest yet — run today’s research.</p>;
  }
  return (
    <ul className="space-y-3.5">
      {items.map((d) => (
        <li key={d.id} className="flex gap-2.5">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${IMPACT_DOT[d.impact]}`} />
          <div className="min-w-0">
            {d.url ? (
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium leading-snug hover:text-accent transition-colors"
              >
                {d.headline}
              </a>
            ) : (
              <span className="text-sm font-medium leading-snug">{d.headline}</span>
            )}
            <p className="text-xs text-[#b5b5ba] mt-0.5 leading-relaxed">{d.summary}</p>
            <p className="text-[10px] text-muted mt-1">
              {d.source ? `${d.source} · ` : ""}
              {timeAgo(d.date)}
              {d.signalNames.length > 0 && (
                <span className="ml-2 text-muted/80">→ {d.signalNames.join(" · ")}</span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
