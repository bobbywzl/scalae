"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { useT } from "@/components/PrefsProvider";
import { api, DELTA_ARROW, fmtPct, fmtPrice, LEVEL_STYLE, levelLabel, localizeError } from "@/components/util";
import { dossierToMarkdown, linkCitations } from "@/lib/citations";
import { pairSignals } from "@/lib/compare";
import type { DeskPayload, SignalWithReadings, WatchlistRow } from "@/lib/types";

/**
 * Side-by-side weighing of two businesses — the compare view cut down to what
 * a value investor actually reaches for: the two standing theses (business
 * model + culture), signals that read the same aspect of each business paired
 * up ("similar taste"), each desk's red flags, and what only one desk watches.
 * Deliberately NOT a stock-price comparison page.
 */

const fmtCap = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n >= 1e12
      ? `$${(n / 1e12).toFixed(2)}T`
      : n >= 1e9
        ? `$${(n / 1e9).toFixed(1)}B`
        : `$${(n / 1e6).toFixed(0)}M`;

function useDesk(symbol: string | null) {
  const [desk, setDesk] = useState<DeskPayload | null>(null);
  const load = useCallback(async () => {
    if (!symbol) {
      setDesk(null);
      return;
    }
    try {
      setDesk(await api<DeskPayload>(`/api/tickers/${encodeURIComponent(symbol)}`));
    } catch {
      setDesk(null);
    }
  }, [symbol]);
  useEffect(() => {
    // Same initial-fetch idiom as the other pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesk(null);
    load();
  }, [load]);
  return desk;
}

/** One side's board pulse: level counts + red flags — the health verdict. */
function pulse(desk: DeskPayload) {
  const withReading = desk.active.filter((s) => s.latest);
  const bad = withReading.filter(
    (s) => s.latest!.level === "weak" || s.latest!.level === "deteriorating"
  );
  const good = withReading.filter(
    (s) => s.latest!.level === "strong" || s.latest!.level === "improving"
  );
  const fresh = withReading.filter((s) => s.latest!.newEvidence !== false);
  const conf = fresh.length
    ? fresh.reduce((a, s) => a + s.latest!.confidence, 0) / fresh.length
    : null;
  return { total: desk.active.length, good: good.length, bad: bad.length, redFlags: bad, conf };
}

function SignalCell({ s, onNavigate }: { s: SignalWithReadings | null; onNavigate?: string }) {
  const { t, locale } = useT();
  if (!s) return <div className="text-[11px] text-muted italic px-3 py-2">{t("compare.notTracked")}</div>;
  const r = s.latest;
  const level = r ? LEVEL_STYLE[r.level] : null;
  const delta = r ? DELTA_ARROW[r.delta] : null;
  const inner = (
    <>
      <p className="text-xs font-semibold leading-tight">{s.name}</p>
      <p className="mt-1 flex items-center gap-2 flex-wrap">
        {level && delta ? (
          <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${level.cls}`}>
            {levelLabel(r!.level, t)} <span className={delta.cls}>{delta.ch}</span>
          </span>
        ) : (
          <span className="text-[10px] text-muted italic">{t("compare.awaitingFirstReading")}</span>
        )}
        {r?.value != null && (
          <span className="text-[11px] tabular-nums text-emph">
            {r.value.toLocaleString(locale)} {r.valueUnit ?? ""}
          </span>
        )}
        {r?.newEvidence === false && (
          <span className="text-[9px] uppercase tracking-wider text-muted/60">{t("compare.carryFwd")}</span>
        )}
      </p>
    </>
  );
  return onNavigate ? (
    <Link href={onNavigate} className="block px-3 py-2 hover:bg-ink/4 transition-colors">
      {inner}
    </Link>
  ) : (
    <div className="px-3 py-2">{inner}</div>
  );
}

export default function ComparePage() {
  const { t } = useT();
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [symA, setSymA] = useState<string | null>(null);
  const [symB, setSymB] = useState<string | null>(null);
  // Analyst verdict (opportunity-cost weighing) — keyed to the pair it was run for.
  const [verdict, setVerdict] = useState<string | null>(null);
  const [verdictFor, setVerdictFor] = useState<string | null>(null);
  const [verdictBusy, setVerdictBusy] = useState(false);
  const [verdictError, setVerdictError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { rows } = await api<{ rows: WatchlistRow[] }>("/api/tickers");
        setRows(rows);
        const set = rows.filter((r) => r.ticker.onboarded);
        if (set.length >= 2) {
          setSymA((a) => a ?? set[0].ticker.symbol);
          setSymB((b) => b ?? set[1].ticker.symbol);
        }
      } catch {
        /* leave empty */
      }
    })();
  }, []);

  const deskA = useDesk(symA);
  const deskB = useDesk(symB);

  const matched = useMemo(() => {
    if (!deskA || !deskB) return null;
    return pairSignals(deskA.active, deskB.active);
  }, [deskA, deskB]);

  const pairKey = symA && symB ? `${symA}|${symB}` : null;
  // Weighing needs something to weigh: a standing dossier or at least one read signal per side.
  const deskReady = (d: DeskPayload | null) =>
    !!d && (!!d.latestRun?.dossier || d.active.some((s) => s.latest));
  const canWeigh = deskReady(deskA) && deskReady(deskB);

  async function runVerdict() {
    if (!symA || !symB || verdictBusy) return;
    setVerdictBusy(true);
    setVerdictError(null);
    try {
      const { verdict } = await api<{ verdict: string }>(`/api/compare`, {
        method: "POST",
        body: JSON.stringify({ a: symA, b: symB }),
      });
      setVerdict(verdict);
      setVerdictFor(`${symA}|${symB}`);
    } catch (e) {
      setVerdictError(
        e instanceof Error ? localizeError(e.message, t) : t("common.errComparisonFailed")
      );
    } finally {
      setVerdictBusy(false);
    }
  }

  const picker = (value: string | null, onChange: (v: string) => void, exclude: string | null) => (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-card2 border border-hairline px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-accent/50 transition-colors"
    >
      <option value="" disabled>
        {t("compare.pickDesk")}
      </option>
      {rows
        .filter((r) => r.ticker.symbol !== exclude)
        .map((r) => (
          <option key={r.ticker.symbol} value={r.ticker.symbol}>
            {r.ticker.symbol} — {r.ticker.name}
          </option>
        ))}
    </select>
  );

  const sides = [
    { sym: symA, desk: deskA },
    { sym: symB, desk: deskB },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap">
        <Link href="/" className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity">
          {t("common.backToWatchlist")}
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight">{t("compare.title")}</h1>
          <p className="text-muted text-xs">{t("compare.subtitle")}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {picker(symA, setSymA, symB)}
          <span className="text-muted text-sm">{t("compare.vs")}</span>
          {picker(symB, setSymB, symA)}
        </div>
      </header>

      {!deskA || !deskB ? (
        <p className="text-muted text-sm py-16 text-center">
          {rows.length < 2 ? t("compare.needTwo") : t("compare.loadingBoth")}
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Verdict strip: valuation basics + board pulse, per side */}
          <section className="grid md:grid-cols-2 gap-4">
            {sides.map(({ sym, desk }) => {
              if (!desk || !sym) return null;
              const p = pulse(desk);
              const q = desk.quote;
              const up = (q?.changePercent ?? 0) >= 0;
              return (
                <div key={sym} className="rounded-2xl bg-card border border-hairline p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/t/${encodeURIComponent(sym)}`} className="font-bold hover:text-accent transition-colors">
                      {sym}
                    </Link>
                    <span className="text-muted text-xs truncate">{desk.ticker.name}</span>
                    {q?.price != null && (
                      <span className="ml-auto flex items-center gap-1.5">
                        <span className="font-semibold tabular-nums text-sm">
                          {fmtPrice(q.price, q.currency)}
                        </span>
                        <span
                          className={`rounded px-1.5 py-px text-[10px] font-semibold tabular-nums text-chipfg ${up ? "bg-gain" : "bg-loss"}`}
                        >
                          {fmtPct(q.changePercent)}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-muted tabular-nums">
                    {t("compare.mktCap")} <span className="text-emph">{fmtCap(q?.marketCap)}</span>
                    {q?.trailingPE != null && (
                      <>
                        {" "}
                        · {t("compare.peRatio")} <span className="text-emph">{q.trailingPE.toFixed(1)}</span>
                      </>
                    )}
                    {" · "}
                    <span className="text-gain">{t("compare.goodCount", { n: p.good })}</span>
                    {" · "}
                    <span className={p.bad > 0 ? "text-loss" : "text-muted"}>
                      {t("compare.badCount", { n: p.bad })}
                    </span>
                    {p.conf != null && (
                      <>
                        {" "}
                        · {t("compare.confFresh")}{" "}
                        <span className="text-emph">{(p.conf * 100).toFixed(0)}%</span>
                      </>
                    )}
                  </p>
                  {p.redFlags.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-loss/90">
                      ⚑ {p.redFlags.map((s) => s.name).join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
          </section>

          {/* The two standing theses — the whole point of the comparison */}
          <section className="grid md:grid-cols-2 gap-4">
            {sides.map(({ sym, desk }) => (
              <div key={sym} className="rounded-2xl bg-card border border-accent/20 p-4">
                <p className="text-[10px] uppercase tracking-widest text-muted font-semibold">
                  {t("compare.thesisTitle", { sym: sym ?? "" })}
                </p>
                {desk?.latestRun?.dossier ? (
                  <div className="mt-2 text-sm">
                    <Markdown>
                      {dossierToMarkdown(
                        linkCitations(desk.latestRun.dossier, desk.latestRun.sources),
                        (id) =>
                          [...desk.active, ...desk.retired].find((s) => s.id === id)?.name ?? null
                      )}
                    </Markdown>
                  </div>
                ) : (
                  <p className="text-xs text-muted italic mt-2">{t("compare.noDossier")}</p>
                )}
              </div>
            ))}
          </section>

          {/* The analyst weighs the pair — Munger's opportunity-cost filter made concrete */}
          <section className="rounded-2xl bg-card border border-hairline p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted font-semibold">
                  {t("compare.verdictTitle")}
                </p>
                <p className="text-[11px] text-muted mt-0.5">{t("compare.verdictDesc")}</p>
              </div>
              <button
                onClick={runVerdict}
                disabled={!canWeigh || verdictBusy}
                title={
                  canWeigh
                    ? t("compare.weighTitle", { a: symA ?? "", b: symB ?? "" })
                    : t("compare.weighDisabledTitle")
                }
                className="ml-auto rounded-lg bg-accent hover:bg-accent/90 disabled:bg-ink/10 disabled:text-muted text-white text-xs font-semibold px-3 py-1.5 transition-colors"
              >
                {verdictBusy
                  ? t("compare.weighing")
                  : verdict && verdictFor === pairKey
                    ? t("compare.weighAgain")
                    : t("compare.weighPair", { a: symA ?? "", b: symB ?? "" })}
              </button>
            </div>
            {verdictError && <p className="mt-2 text-xs text-loss">{verdictError}</p>}
            {verdictBusy && (
              <p className="mt-3 text-xs text-muted pulse-soft">{t("compare.weighingNote")}</p>
            )}
            {verdict && verdictFor === pairKey && !verdictBusy && (
              <div className="mt-3 text-sm border-t border-hairline pt-3">
                <Markdown>{verdict}</Markdown>
                <p className="mt-2 text-[10px] text-muted/60">{t("compare.verdictDisclaimer")}</p>
              </div>
            )}
          </section>

          {/* Signals that read the same aspect of each business */}
          <section className="rounded-2xl bg-card border border-hairline overflow-hidden">
            <p className="px-4 pt-3 text-[10px] uppercase tracking-widest text-muted font-semibold">
              {t("compare.matchedTitle")}
            </p>
            {matched && matched.pairs.length > 0 ? (
              <div className="mt-2 divide-y divide-hairline">
                {matched.pairs.map((p) => (
                  <div key={p.a.id} className="grid grid-cols-2 divide-x divide-hairline">
                    <SignalCell s={p.a} onNavigate={`/t/${encodeURIComponent(symA!)}`} />
                    <SignalCell s={p.b} onNavigate={`/t/${encodeURIComponent(symB!)}`} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-3 text-xs text-muted italic">{t("compare.noOverlap")}</p>
            )}
          </section>

          {/* What only one desk watches — coverage asymmetry is a finding */}
          {matched && (matched.onlyA.length > 0 || matched.onlyB.length > 0) && (
            <section className="grid md:grid-cols-2 gap-4">
              {[
                { sym: symA, list: matched.onlyA },
                { sym: symB, list: matched.onlyB },
              ].map(({ sym, list }) => (
                <div key={sym} className="rounded-2xl bg-card border border-hairline p-1 pb-2">
                  <p className="px-3 pt-2 text-[10px] uppercase tracking-widest text-muted font-semibold">
                    {t("compare.onlyDeskWatches", { sym: sym ?? "" })}
                  </p>
                  {list.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-muted italic">{t("compare.nothingUnique")}</p>
                  ) : (
                    list.map((s) => <SignalCell key={s.id} s={s} onNavigate={`/t/${encodeURIComponent(sym!)}`} />)
                  )}
                </div>
              ))}
            </section>
          )}

          <p className="text-[10px] text-muted/60 text-center">{t("compare.matchNote")}</p>
        </div>
      )}
    </main>
  );
}
