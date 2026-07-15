"use client";

import { Annotatable } from "@/components/Annotations";
import { useT } from "@/components/PrefsProvider";
import type { DigestItem, Signal } from "@/lib/types";
import { IMPACT_DOT, impactLabel, timeAgo } from "./util";

/**
 * Evidence feed. Signal tags resolve against the live board: active signals
 * open their detail view on click; retired/dismissed ones render muted so the
 * investor can see which threads of the story are no longer tracked.
 */
export function DigestFeed({
  items,
  signals = [],
  onOpenSignal,
  onTrackStory,
  onClip,
}: {
  items: DigestItem[];
  /** Board signals of any status, used to resolve tag names. */
  signals?: Pick<Signal, "id" | "name" | "status">[];
  onOpenSignal?: (id: string) => void;
  /** Untagged stories get a "track this" affordance — asks the analyst to draft a signal (approval-gated). */
  onTrackStory?: (item: DigestItem) => void;
  /** Clip this evidence into one of the investor's notepads (Notes page). */
  onClip?: (item: DigestItem) => void;
}) {
  const { t } = useT();
  if (items.length === 0) {
    return <p className="text-muted text-xs italic">{t("signals.noDigest")}</p>;
  }
  const byName = new Map(signals.map((s) => [s.name, s]));
  return (
    <ul className="space-y-3.5">
      {items.map((d) => (
        <li key={d.id} className="flex gap-2.5">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${IMPACT_DOT[d.impact]}`}
            title={impactLabel(d.impact, t)}
          />
          <div className="min-w-0">
            <Annotatable surfaceId={`digest:${d.id}`}>
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
            </Annotatable>
            <p className="text-[10px] text-muted mt-1">
              {d.source ? `${d.source} · ` : ""}
              {timeAgo(d.date, t)}
              {onClip && (
                <button
                  onClick={() => onClip(d)}
                  title={t("notes.clipTitle")}
                  className="ml-2 rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-1.5 py-px text-[10px] text-emph hover:text-accent transition-colors"
                >
                  {t("notes.clipAction")}
                </button>
              )}
              {d.signalNames.length === 0 && onTrackStory && (
                <button
                  onClick={() => onTrackStory(d)}
                  title={t("signals.trackThisTitle")}
                  className="ml-2 rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-1.5 py-px text-[10px] text-emph hover:text-accent transition-colors"
                >
                  {t("signals.trackThis")}
                </button>
              )}
              {d.signalNames.length > 0 && (
                <span className="ml-2 text-muted/80">
                  →{" "}
                  {d.signalNames.map((name, i) => {
                    const s = byName.get(name);
                    const sep = i < d.signalNames.length - 1 ? " · " : "";
                    if (s && s.status === "active" && onOpenSignal) {
                      return (
                        <span key={name}>
                          <button
                            onClick={() => onOpenSignal(s.id)}
                            className="hover:text-accent hover:underline underline-offset-2 transition-colors"
                            title={t("signals.openSignalTitle")}
                          >
                            {name}
                          </button>
                          {sep}
                        </span>
                      );
                    }
                    if (s && s.status !== "active") {
                      return (
                        <span key={name}>
                          <span
                            className="opacity-60 line-through decoration-muted/50"
                            title={t("signals.statusSignal", { status: t(`common.status_${s.status}`) })}
                          >
                            {name}
                          </span>
                          {sep}
                        </span>
                      );
                    }
                    return (
                      <span key={name}>
                        {name}
                        {sep}
                      </span>
                    );
                  })}
                </span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
