"use client";

import { useState } from "react";
import { chipLabel } from "@/lib/citations";
import type { Citation, SignalSource, SignalWithReadings } from "@/lib/types";
import { useT } from "@/components/PrefsProvider";
import { ReadingSparkline, sparkValues } from "./Sparkline";
import { DELTA_ARROW, LEVEL_STYLE, levelLabel, timeAgo } from "./util";

function ConfidenceDots({ value }: { value: number }) {
  const { t } = useT();
  const filled = Math.round(Math.max(0, Math.min(1, value)) * 5);
  return (
    <span
      className="inline-flex items-center gap-[3px]"
      title={t("signals.confidenceTitle", { pct: (value * 100).toFixed(0) })}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`h-[5px] w-[5px] rounded-full ${i < filled ? "bg-emph" : "bg-ink/12"}`}
        />
      ))}
    </span>
  );
}

/**
 * The signal's board key (S1, S2, …) — the exact key research runs and focus
 * questions use when they cite this signal, so prose like "S3 has sat at 0.55
 * confidence" resolves at a glance.
 */
export function SigKeyBadge({ sKey }: { sKey: string }) {
  const { t } = useT();
  return (
    <span
      title={t("signals.sKeyTitle", { key: sKey })}
      className="shrink-0 rounded border border-hairline bg-ink/6 px-1 py-px text-[0.5625rem] font-bold tabular-nums tracking-wide text-muted"
    >
      {sKey}
    </span>
  );
}

const fmtDay = (iso: string, locale: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString(locale, { month: "short", day: "numeric" });
};

/** Clickable source chip — domain plus a title fragment when siblings share it. */
function SourceChip({ citation, siblings }: { citation: Citation; siblings: Citation[] }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noreferrer"
      title={citation.title}
      onClick={(e) => e.stopPropagation()}
      className="rounded-full border border-hairline bg-ink/4 hover:bg-ink/10 hover:border-ink/25 px-2 py-0.5 text-[0.625rem] text-emph transition-colors max-w-[220px] truncate"
    >
      {chipLabel(citation, siblings)}
    </a>
  );
}

/**
 * The signal's full evidence catalog — every source it has accumulated across
 * daily runs, deduped and freshest-first. Opened from the "N sources" count.
 */
function SourcesModal({
  name,
  sources,
  onClose,
}: {
  name: string;
  sources: SignalSource[];
  onClose: () => void;
}) {
  const { t, locale } = useT();
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-card border border-ink/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-hairline flex items-center gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{name}</p>
            <p className="text-[0.625rem] uppercase tracking-wider text-muted mt-0.5">
              {t("signals.evidenceCatalog")} ·{" "}
              {t(sources.length === 1 ? "signals.sourcesOne" : "signals.sourcesMany", { n: sources.length })} ·{" "}
              {t("signals.catalogGrows")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto shrink-0 rounded-md border border-hairline bg-ink/4 hover:bg-ink/10 px-2 py-1 text-[0.6875rem] text-emph transition-colors"
          >
            {t("common.close")}
          </button>
        </div>
        <ul className="overflow-y-auto px-4 py-3 space-y-3">
          {sources.map((s, i) => (
            <li key={i} className="text-xs">
              <div className="flex items-baseline gap-2">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-accent/90 hover:underline truncate">
                  {s.domain}
                </a>
                {s.count > 1 && (
                  <span
                    className="shrink-0 rounded-full bg-ink/8 px-1.5 py-px text-[0.5625rem] text-muted"
                    title={t("signals.citedInReadings", { n: s.count })}
                  >
                    ×{s.count}
                  </span>
                )}
              </div>
              <a href={s.url} target="_blank" rel="noreferrer" className="block text-emph hover:text-white leading-snug mt-0.5">
                {s.title.length > 110 ? s.title.slice(0, 110) + "…" : s.title}
              </a>
              <p className="text-[0.625rem] text-muted mt-0.5">
                {t("signals.addedOn", { date: fmtDay(s.firstSeen, locale) })}
                {s.lastSeen !== s.firstSeen && ` · ${t("signals.lastCited", { date: fmtDay(s.lastSeen, locale) })}`}
                {s.foundBy.length > 0 && ` · ${t("signals.viaSources", { src: s.foundBy.join(" · ") })}`}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Board card for one signal. Clicking it opens the signal's dedicated
 * segmented view (reading, evidence, history + a signal-scoped analyst desk).
 */
export function SignalCard({
  signal,
  sKey = null,
  onOpen,
  overlapsWith = null,
  check = null,
}: {
  signal: SignalWithReadings;
  /** Board key (S1, S2, …) — the key research prose cites this signal by. */
  sKey?: string | null;
  onOpen: (signal: SignalWithReadings) => void;
  /** Keep-both pair: the other active signal this one overlaps with. */
  overlapsWith?: { name: string; onOpen: () => void } | null;
  /** Single-signal check control: run this one signal's research now. */
  check?: { checking: boolean; disabled: boolean; run: () => void } | null;
}) {
  const { t, locale } = useT();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const r = signal.latest;
  const level = r ? LEVEL_STYLE[r.level] : null;
  const delta = r ? DELTA_ARROW[r.delta] : null;
  const sources = signal.sources ?? [];
  const carriedForward = r?.newEvidence === false;
  const spark = signal.type === "quantitative" ? sparkValues(signal.history) : [];

  return (
    <div className="rounded-xl bg-card border border-hairline hover:border-ink/20 transition-colors">
      <button onClick={() => onOpen(signal)} className="w-full text-left px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              {sKey && <SigKeyBadge sKey={sKey} />}
              <span className="text-sm font-semibold leading-tight">{signal.name}</span>
            </div>
            <div className="text-[0.625rem] uppercase tracking-wider text-muted mt-0.5">
              {signal.type === "quantitative" ? t("signals.typeQuantitative") : t("signals.typeQualitative")}
            </div>
          </div>
          {r && level && delta && (
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold ${level.cls}`}>
              {levelLabel(r.level, t)} <span className={delta.cls}>{delta.ch}</span>
            </span>
          )}
        </div>

        {r ? (
          <>
            {r.value != null && (
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-lg font-semibold tabular-nums">
                  {r.value.toLocaleString(locale)}{" "}
                  <span className="text-xs text-muted font-normal">{r.valueUnit ?? signal.scale}</span>
                </div>
                {spark.length >= 2 && (
                  <span
                    title={t("signals.sparkTitle", {
                      n: spark.length,
                      min: Math.min(...spark).toLocaleString(locale),
                      max: Math.max(...spark).toLocaleString(locale),
                    })}
                  >
                    <ReadingSparkline values={spark} />
                  </span>
                )}
              </div>
            )}
            {carriedForward ? (
              <p className="mt-1.5 text-xs text-muted italic leading-relaxed">
                {t("signals.noChangeThisRun")}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-emph leading-relaxed line-clamp-2">{r.rationale}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-[0.625rem] text-muted">
              <ConfidenceDots value={r.confidence} />
              <span>{timeAgo(r.date, t)}</span>
              {sources.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSourcesOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      setSourcesOpen(true);
                    }
                  }}
                  className="text-accent/90 hover:text-accent hover:underline transition-colors cursor-pointer"
                  title={t("signals.viewAllSources")}
                >
                  🔗 {t(sources.length === 1 ? "signals.sourcesOne" : "signals.sourcesMany", { n: sources.length })}
                </span>
              )}
              <span className="ml-auto text-muted/60">{t("signals.openHint")}</span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted italic">{t("signals.awaitingFirstRun")}</p>
        )}
      </button>

      {/* Per-signal research: check just this named gap, now. */}
      {check && (
        <div className="px-4 pb-2.5 -mt-1">
          {check.checking ? (
            <span className="text-[0.6875rem] text-accent pulse-soft">{t("desk.signalCheckingShort")}</span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                check.run();
              }}
              disabled={check.disabled}
              title={check.disabled ? t("desk.signalCheckBusy") : undefined}
              className="rounded-md border border-accent/25 bg-accent/8 hover:bg-accent/15 disabled:opacity-40 px-2 py-0.5 text-[0.6875rem] font-medium text-accent transition-colors"
            >
              {t("desk.runSignal")}
            </button>
          )}
        </div>
      )}

      {/* Keep-both overlap: the pair stays visibly linked after the one-time choice. */}
      {overlapsWith && (
        <div className="px-4 pb-2 -mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              overlapsWith.onOpen();
            }}
            title={t("signals.overlapKeptTitle")}
            className="rounded-md bg-warn/10 hover:bg-warn/18 border border-warn/25 px-2 py-0.5 text-[0.625rem] text-warn transition-colors max-w-full truncate"
          >
            {t("signals.overlapsChip", { name: overlapsWith.name })}
          </button>
        </div>
      )}

      {/* Freshest sources at a glance; the count opens the whole catalog. */}
      {sources.length > 0 && (
        <div className="px-4 pb-3 -mt-0.5 flex flex-wrap items-center gap-1.5">
          {sources.slice(0, 3).map((s, i) => (
            <SourceChip key={i} citation={s} siblings={sources.slice(0, 3)} />
          ))}
          {sources.length > 3 && (
            <button
              onClick={() => setSourcesOpen(true)}
              className="text-[0.625rem] text-muted hover:text-emph transition-colors"
            >
              {t("signals.moreSources", { n: sources.length - 3 })}
            </button>
          )}
        </div>
      )}

      {sourcesOpen && (
        <SourcesModal name={signal.name} sources={sources} onClose={() => setSourcesOpen(false)} />
      )}
    </div>
  );
}

/**
 * Compact one-line board row — the list form of SignalCard. Same data, scan
 * density instead of narrative: key, name, level, value, confidence, age.
 * Clicking the row opens the same detail view as the card.
 */
export function SignalListRow({
  signal,
  sKey = null,
  onOpen,
  overlapsWith = null,
  check = null,
}: {
  signal: SignalWithReadings;
  /** Board key (S1, S2, …) — the key research prose cites this signal by. */
  sKey?: string | null;
  onOpen: (signal: SignalWithReadings) => void;
  /** Keep-both pair: the other active signal this one overlaps with. */
  overlapsWith?: { name: string; onOpen: () => void } | null;
  /** Single-signal check control: run this one signal's research now. */
  check?: { checking: boolean; disabled: boolean; run: () => void } | null;
}) {
  const { t, locale } = useT();
  const r = signal.latest;
  const level = r ? LEVEL_STYLE[r.level] : null;
  const delta = r ? DELTA_ARROW[r.delta] : null;
  const sources = signal.sources ?? [];
  const carriedForward = r?.newEvidence === false;

  return (
    <div className="flex items-center gap-2 px-3.5 py-2 hover:bg-ink/4 transition-colors">
      <button
        onClick={() => onOpen(signal)}
        title={t("signals.openHint")}
        className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
      >
        {sKey && <SigKeyBadge sKey={sKey} />}
        <span className="text-[0.8125rem] font-medium truncate">{signal.name}</span>
      </button>
      {overlapsWith && (
        <button
          onClick={overlapsWith.onOpen}
          title={t("signals.overlapsChip", { name: overlapsWith.name })}
          className="shrink-0 rounded bg-warn/10 hover:bg-warn/18 border border-warn/25 px-1 text-[0.625rem] text-warn transition-colors"
        >
          ⇄
        </button>
      )}
      {r && level && delta ? (
        <>
          {r.value != null && (
            <span className="hidden md:inline shrink-0 text-xs font-semibold tabular-nums">
              {r.value.toLocaleString(locale)}{" "}
              <span className="text-[0.625rem] text-muted font-normal">
                {r.valueUnit ?? signal.scale}
              </span>
            </span>
          )}
          <span
            className={`shrink-0 rounded-md px-1.5 py-px text-[0.625rem] font-semibold ${level.cls}`}
          >
            {levelLabel(r.level, t)} <span className={delta.cls}>{delta.ch}</span>
          </span>
          <span className="hidden sm:flex shrink-0">
            <ConfidenceDots value={r.confidence} />
          </span>
          <span
            className="hidden sm:inline shrink-0 text-[0.625rem] text-muted tabular-nums"
            title={carriedForward ? t("signals.noChangeThisRun") : undefined}
          >
            {timeAgo(r.date, t)}
            {carriedForward && <span className="text-muted/60"> =</span>}
          </span>
          {sources.length > 0 && (
            <span
              className="hidden lg:inline shrink-0 text-[0.625rem] text-muted"
              title={t(sources.length === 1 ? "signals.sourcesOne" : "signals.sourcesMany", {
                n: sources.length,
              })}
            >
              🔗 {sources.length}
            </span>
          )}
        </>
      ) : (
        <span className="shrink-0 text-[0.625rem] text-muted italic">
          {t("signals.awaitingFirstRun")}
        </span>
      )}
      {check &&
        (check.checking ? (
          <span className="shrink-0 text-[0.625rem] text-accent pulse-soft">
            {t("desk.signalCheckingShort")}
          </span>
        ) : (
          <button
            onClick={check.run}
            disabled={check.disabled}
            title={check.disabled ? t("desk.signalCheckBusy") : t("desk.runSignal")}
            className="shrink-0 rounded-md border border-accent/25 bg-accent/8 hover:bg-accent/15 disabled:opacity-40 px-1.5 py-px text-[0.6875rem] font-medium text-accent transition-colors"
          >
            ✦
          </button>
        ))}
    </div>
  );
}
