"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DeskTabs } from "@/components/DeskTabs";
import { FinancialsSection, fmtMetric } from "@/components/FinancialsCard";
import { Markdown } from "@/components/Markdown";
import { useT } from "@/components/PrefsProvider";
import { api, localizeError, timeAgo } from "@/components/util";
import type { TKey } from "@/lib/i18n/dictionaries";
import type {
  CleansedCell,
  CleansingPayload,
  FinAdjustment,
  FinCleansingEvent,
  FinInspectionFinding,
  FinMessage,
  MetricFormat,
} from "@/lib/types";

// The inspection's finding kinds, rendered as chips on the pass summary.
const INSPECT_KIND_CHIP: Record<FinInspectionFinding["kind"], { key: TKey; cls: string }> = {
  anomaly: { key: "memory.finKindAnomaly", cls: "bg-warn/15 text-warn" },
  data_quality: { key: "memory.finKindDataQuality", cls: "bg-loss/12 text-loss" },
  trend: { key: "memory.finKindTrend", cls: "bg-accent/12 text-accent" },
  pattern: { key: "memory.finKindPattern", cls: "bg-ink/8 text-muted" },
};

/**
 * The ticker's FINANCE CLEANSING screen — the third segment of the desk pill.
 * The finance breakdown (financials & valuation) lives here now, plus the
 * investor's customization bench: human-gated adjustments that strip noise
 * (one-time impairments, settlements, unstable income) and windfall growth
 * (mark-to-market/IPO revaluation gains) from the reported record; a
 * "suggest moderations" pass; the financial analyst desk that implements
 * customization requests precisely; and the full raw → cleansed history.
 */

const cur$ = (c: string | null) => (!c || c === "USD" ? "$" : c + " ");

/** Signed compact money for adjustment deltas ("−$1.2B"). */
function fmtDelta(v: number, c: string | null): string {
  const a = Math.abs(v);
  const s =
    a >= 1e12 ? (a / 1e12).toFixed(2) + "T"
    : a >= 1e9 ? (a / 1e9).toFixed(2) + "B"
    : a >= 1e6 ? (a / 1e6).toFixed(1) + "M"
    : a >= 1e3 ? (a / 1e3).toFixed(0) + "k"
    : a.toFixed(0);
  return `${v < 0 ? "−" : "+"}${cur$(c)}${s}`;
}

export default function FinanceCleansingPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const { t } = useT();

  const [payload, setPayload] = useState<CleansingPayload | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatAbort = useRef<AbortController | null>(null);

  const load = useCallback(
    () =>
      api<CleansingPayload>(`/api/tickers/${encodeURIComponent(symbol)}/cleansing`)
        .then(setPayload)
        .catch(() => setNotFound(true)),
    [symbol]
  );
  useEffect(() => {
    load();
  }, [load]);

  // A desk that hasn't been set up yet onboards on the signals page.
  useEffect(() => {
    if (payload && !payload.ticker.onboarded) {
      router.replace(`/t/${encodeURIComponent(symbol)}/signals`);
    }
  }, [payload, router, symbol]);

  const suggesting = payload?.suggestRun?.status === "running";
  const lastMsg = payload ? payload.messages[payload.messages.length - 1] : undefined;
  const remoteBusy = !sending && !!payload?.analystBusy && lastMsg?.role === "user";
  const bgChatError =
    !sending && !remoteBusy && lastMsg?.role === "user" ? (payload?.analystError ?? null) : null;

  // Poll fast while the agents are working, slowly otherwise.
  useEffect(() => {
    const timer = setInterval(load, suggesting || sending || remoteBusy ? 2500 : 30_000);
    return () => clearInterval(timer);
  }, [load, suggesting, sending, remoteBusy]);

  async function startSuggest() {
    if (suggestBusy || suggesting) return;
    setSuggestBusy(true);
    setSuggestError(null);
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/cleansing/suggest`, { method: "POST" });
      await load();
    } catch (e) {
      setSuggestError(e instanceof Error ? localizeError(e.message, t) : t("common.errRunFailed"));
    } finally {
      setSuggestBusy(false);
    }
  }

  async function stopSuggest() {
    await api(`/api/tickers/${encodeURIComponent(symbol)}/cleansing/suggest`, {
      method: "DELETE",
    }).catch(() => {});
    load();
  }

  async function act(id: string, action: "apply" | "dismiss" | "revert") {
    if (actingId) return;
    setActingId(id);
    try {
      await api(`/api/cleansing/adjustments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (e) {
      setSuggestError(
        e instanceof Error ? localizeError(e.message, t) : t("common.errRequestFailed", { code: "?" })
      );
    } finally {
      setActingId(null);
    }
  }

  async function sendChat(text: string) {
    setSending(true);
    setChatError(null);
    // Optimistic user bubble, the desk chat idiom.
    setPayload((p) =>
      p
        ? {
            ...p,
            messages: [
              ...p.messages,
              {
                id: "optimistic",
                symbol,
                role: "user",
                content: text,
                adjustmentIds: [],
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : p
    );
    const controller = new AbortController();
    chatAbort.current = controller;
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/cleansing/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });
    } catch (e) {
      if (!controller.signal.aborted) {
        setChatError(e instanceof Error ? localizeError(e.message, t) : t("common.errChatFailed"));
      }
    } finally {
      chatAbort.current = null;
      setSending(false);
      load();
    }
  }

  async function retryChat() {
    setSending(true);
    setChatError(null);
    const controller = new AbortController();
    chatAbort.current = controller;
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/cleansing/chat`, {
        method: "POST",
        body: JSON.stringify({ retry: true }),
        signal: controller.signal,
      });
    } catch (e) {
      if (!controller.signal.aborted) {
        setChatError(e instanceof Error ? localizeError(e.message, t) : t("common.errChatFailed"));
      }
    } finally {
      chatAbort.current = null;
      setSending(false);
      load();
    }
  }

  async function pauseChat() {
    chatAbort.current?.abort();
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/cleansing/chat`, { method: "DELETE" });
    } catch {
      /* best-effort — the busy marker goes stale on its own */
    }
    setSending(false);
    load();
  }

  const adjById = useMemo(
    () => new Map((payload?.adjustments ?? []).map((a) => [a.id, a])),
    [payload]
  );
  const formatByKey = useMemo(() => {
    const m = new Map<string, MetricFormat>();
    for (const metric of payload?.financials?.metrics ?? []) m.set(metric.key, metric.format);
    return m;
  }, [payload]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="text-lg font-medium">{t("desk.notFound")}</p>
        <Link href="/" className="text-accent text-sm mt-2 inline-block">
          {t("desk.notFoundBack")}
        </Link>
      </main>
    );
  }
  if (!payload || !payload.ticker.onboarded) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center text-muted text-sm">
        {payload ? t("desk.opening", { symbol }) : t("financials.cleanseLoading")}
      </main>
    );
  }

  const { ticker, financials, cleansed, adjustments, events, suggestRun } = payload;
  const currency = financials?.currency ?? null;
  const pending = adjustments.filter((a) => a.status === "suggested");
  const applied = adjustments.filter((a) => a.status === "applied");
  const archived = adjustments.filter((a) => a.status === "dismissed" || a.status === "reverted");

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 flex-1">
      <header className="flex items-center gap-4 flex-wrap">
        <Link
          href="/"
          className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity"
        >
          {t("common.backToWatchlist")}
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{ticker.symbol}</h1>
          <p className="text-muted text-xs">
            {t("financials.cleansePageSubtitle", { name: ticker.name })}
          </p>
        </div>
        <DeskTabs symbol={symbol} active="fin" />
        <div className="flex items-center gap-2 ml-auto">
          {suggesting && (
            <button
              onClick={stopSuggest}
              title={t("desk.stopHint")}
              className="rounded-lg bg-loss/15 hover:bg-loss/25 text-loss text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {t("financials.suggestStop")}
            </button>
          )}
          <button
            onClick={startSuggest}
            disabled={suggestBusy || suggesting || !financials}
            className="rounded-lg bg-accent/12 hover:bg-accent/20 disabled:opacity-50 text-accent text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            {suggesting ? t("financials.suggestRunning") : t("financials.suggestBtn")}
          </button>
        </div>
      </header>

      {/* Currency discipline — the ADR trap stated loudly, above everything:
          statements in one currency, the listing in another. Every table
          figure and every adjustment delta is the STATEMENT currency. */}
      {financials?.currencyMismatch && financials.tradingCurrency && (
        <div className="mt-4 rounded-xl border border-warn/35 bg-warn/10 px-4 py-3">
          <p className="text-xs text-warn">
            ⚠{" "}
            {t("financials.currencyMismatchWarn", {
              name: ticker.name,
              fin: financials.currency ?? "?",
              trade: financials.tradingCurrency,
            })}
          </p>
        </div>
      )}

      {/* The bench's brief — why cleansing exists and what this page gives,
          in a few sentences (FOUNDATION: the finance-cleansing bench). */}
      <section className="mt-5 rounded-2xl border border-hairline bg-card px-5 py-4">
        <h2 className="text-[11px] uppercase tracking-widest text-muted font-semibold">
          {t("financials.benchAboutTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t("financials.benchAboutBody", { name: ticker.name })}
        </p>
      </section>

      {/* Side-by-side, the signals-page idiom: the numbers and the gate on
          the left, the financial analyst desk sticky on the right. */}
      <div className="mt-5 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        {/* left column */}
        <div className="space-y-5 min-w-0">
          {/* Suggestion-pass state: running note / failure / the last pass's summary. */}
          {suggesting && (
            <div className="rounded-xl border border-accent/25 bg-accent/8 px-4 py-3">
              <p className="text-xs text-accent pulse-soft">{t("financials.suggestRunningNote")}</p>
            </div>
          )}
          {!suggesting && suggestRun?.status === "error" && (
            <div className="rounded-xl border border-loss/25 bg-loss/8 px-4 py-3 flex items-center gap-3 flex-wrap">
              <p className="text-xs text-loss flex-1 min-w-48">
                {t("financials.suggestFailed", { error: localizeError(suggestRun.error, t) || "—" })}
              </p>
              <button
                onClick={startSuggest}
                className="shrink-0 rounded-lg bg-ink/8 hover:bg-ink/12 text-xs font-medium px-3 py-1.5 transition-colors"
              >
                {t("dd.tryAgain")}
              </button>
            </div>
          )}
          {!suggesting && suggestRun?.status === "done" && suggestRun.note && (
            <div className="rounded-xl border border-hairline bg-card px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                {t("financials.suggestNoteTitle")}
                <span className="normal-case tracking-normal font-normal text-muted/70">
                  {" "}
                  · {timeAgo(suggestRun.finishedAt ?? suggestRun.createdAt, t)} ·{" "}
                  {suggestRun.proposalCount > 0
                    ? t("financials.suggestFoundN", { n: suggestRun.proposalCount })
                    : t("financials.suggestFoundNone")}
                </span>
              </p>
              <p className="text-[13px] text-emph mt-1.5 leading-relaxed">{suggestRun.note}</p>
              {/* The self-inspection report: the pass double-checked the
                  extracted table (deterministic diagnostics + judgment)
                  before hunting disclosures. */}
              {suggestRun.inspection && (
                <div className="mt-2.5 border-t border-hairline pt-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                    ⚖ {t("memory.finInspectTitle")}
                  </p>
                  {suggestRun.inspection.note && (
                    <p className="text-xs text-emph mt-1 leading-relaxed">{suggestRun.inspection.note}</p>
                  )}
                  {suggestRun.inspection.findings.length > 0 ? (
                    <ul className="mt-1.5 space-y-1.5">
                      {suggestRun.inspection.findings.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px]">
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${INSPECT_KIND_CHIP[f.kind]?.cls ?? "bg-ink/8 text-muted"}`}
                          >
                            {t(INSPECT_KIND_CHIP[f.kind]?.key ?? "memory.finKindAnomaly")}
                          </span>
                          <span className="min-w-0 leading-relaxed">
                            {(f.metricKey || f.fiscalYear) && (
                              <span className="text-emph font-medium">
                                {f.metricKey ? t(`financials.${f.metricKey}` as TKey) : ""}
                                {f.fiscalYear ? ` ${f.fiscalYear}` : ""}
                                {" — "}
                              </span>
                            )}
                            <span className="text-muted">{f.note}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted italic">{t("memory.finInspectClean")}</p>
                  )}
                </div>
              )}
            </div>
          )}
          {suggestError && <p className="text-[11px] text-loss">{suggestError}</p>}

          {/* The finance breakdown, moved to this screen — raw or cleansed view. */}
          {financials ? (
            <FinancialsSection
              symbol={symbol}
              data={financials}
              cleansed={cleansed}
              adjustments={adjustments}
            />
          ) : (
            <section className="rounded-2xl bg-card border border-hairline p-5">
              <p className="text-muted text-sm">{t("financials.cleanseUnavailable")}</p>
            </section>
          )}

          {/* Pending proposals — the human gate. */}
          {pending.length > 0 && (
            <section>
              <SectionTitle>
                {t("financials.adjPendingTitle")}{" "}
                <span className="rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
                  {t("financials.adjPendingBadge", { n: pending.length })}
                </span>
              </SectionTitle>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">{t("financials.adjPendingExplainer")}</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                {pending.map((a) => (
                  <AdjustmentCard
                    key={a.id}
                    adj={a}
                    currency={currency}
                    busy={actingId === a.id}
                    onAct={act}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Applied adjustments — reversible, never silently permanent. */}
          {applied.length > 0 && (
            <section>
              <SectionTitle>{t("financials.adjAppliedTitle")}</SectionTitle>
              <div className="mt-2 space-y-2">
                {applied.map((a) => (
                  <AppliedRow
                    key={a.id}
                    adj={a}
                    currency={currency}
                    busy={actingId === a.id}
                    onRevert={() => act(a.id, "revert")}
                  />
                ))}
              </div>
            </section>
          )}

          {adjustments.length === 0 && (
            <p className="text-muted text-xs italic">{t("financials.adjNone")}</p>
          )}

          {/* The raw → cleansed history: current differences + the audit log. */}
          <HistoryPanel
            cells={cleansed?.cells ?? []}
            adjById={adjById}
            formatByKey={formatByKey}
            currency={currency}
            events={events}
          />

          {/* Nothing on this bench is deleted — dismissed and reverted stay auditable. */}
          {archived.length > 0 && <ArchivePanel archived={archived} currency={currency} />}
        </div>

        {/* right column: the financial analyst desk, sticky beside the
            numbers — the signals page's chat-column idiom. */}
        <div className="lg:sticky lg:top-6 h-[82vh] min-h-[480px]">
          <AnalystDesk
            messages={payload.messages}
            adjById={adjById}
            currency={currency}
            sending={sending}
            remoteBusy={remoteBusy}
            error={chatError ?? bgChatError}
            disabled={!financials}
            actingId={actingId}
            onSend={sendChat}
            onRetry={retryChat}
            onPause={pauseChat}
            onAct={act}
          />
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Adjustment cards & rows
// ---------------------------------------------------------------------------

function KindChip({ kind }: { kind: FinAdjustment["kind"] }) {
  const { t } = useT();
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-px text-[9px] uppercase tracking-wider ${
        kind === "growth" ? "bg-warn/12 text-warn/90" : "bg-ink/8 text-muted"
      }`}
    >
      {kind === "growth" ? t("financials.adjKindGrowth") : t("financials.adjKindNoise")}
    </span>
  );
}

function AdjLine({ adj, currency }: { adj: FinAdjustment; currency: string | null }) {
  const { t } = useT();
  const metricLabel = t(`financials.${adj.metricKey}` as TKey);
  const amount =
    adj.metricKey === "shares"
      ? `${adj.delta < 0 ? "−" : "+"}${Math.abs(adj.delta).toLocaleString()}`
      : fmtDelta(adj.delta, currency);
  return (
    <p className="text-[11px] text-emph tabular-nums">
      {t("financials.adjLine", { key: metricLabel, year: adj.fiscalYear })}{" "}
      <span className={`font-semibold ${adj.delta < 0 ? "text-loss" : "text-gain"}`}>{amount}</span>
    </p>
  );
}

function SourceChips({ adj }: { adj: FinAdjustment }) {
  if (adj.sources.length === 0) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 flex-wrap">
      {adj.sources.slice(0, 4).map((s) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          title={s.title}
          className="rounded-full border border-hairline bg-ink/4 px-2 py-0.5 text-[9px] text-muted hover:text-accent hover:border-accent/40 transition-colors truncate max-w-40"
        >
          {s.domain ?? s.title}
        </a>
      ))}
    </p>
  );
}

/** One pending proposal: the item, its line/FY/delta, rationale, sources, gate buttons. */
function AdjustmentCard({
  adj,
  currency,
  busy,
  onAct,
}: {
  adj: FinAdjustment;
  currency: string | null;
  busy: boolean;
  onAct: (id: string, action: "apply" | "dismiss" | "revert") => void;
}) {
  const { t } = useT();
  return (
    <div className="rounded-xl bg-card border border-warn/30 p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-emph min-w-0 truncate">{adj.title}</span>
        <KindChip kind={adj.kind} />
      </div>
      <div className="mt-1">
        <AdjLine adj={adj} currency={currency} />
      </div>
      {adj.rationale && <p className="text-xs text-muted mt-1.5 leading-relaxed">{adj.rationale}</p>}
      <SourceChips adj={adj} />
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={() => onAct(adj.id, "apply")}
          disabled={busy}
          className="rounded-lg bg-gain/15 text-gain font-semibold text-xs px-3 py-1.5 hover:bg-gain/25 disabled:opacity-50 transition-colors"
        >
          {busy ? t("financials.adjWorking") : t("financials.adjApply")}
        </button>
        <button
          onClick={() => onAct(adj.id, "dismiss")}
          disabled={busy}
          className="rounded-lg bg-ink/6 text-muted font-medium text-xs px-3 py-1.5 hover:bg-ink/10 hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {t("financials.adjDismiss")}
        </button>
        <span className="ml-auto text-[9px] text-muted/60">{adj.createdAt.slice(0, 10)}</span>
      </div>
    </div>
  );
}

/** One applied adjustment — compact row with a revert. */
function AppliedRow({
  adj,
  currency,
  busy,
  onRevert,
}: {
  adj: FinAdjustment;
  currency: string | null;
  busy: boolean;
  onRevert: () => void;
}) {
  const { t } = useT();
  return (
    <div className="rounded-xl bg-card/60 border border-hairline px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-emph truncate">{adj.title}</span>
          <KindChip kind={adj.kind} />
        </div>
        <AdjLine adj={adj} currency={currency} />
      </div>
      <button
        onClick={onRevert}
        disabled={busy}
        className="shrink-0 rounded-lg bg-ink/6 hover:bg-ink/10 text-[11px] font-medium text-emph px-2.5 py-1.5 disabled:opacity-50 transition-colors"
      >
        {busy ? "…" : t("financials.adjRevert")}
      </button>
    </div>
  );
}

/** Dismissed/reverted archive — read-only, auditable history. */
function ArchivePanel({
  archived,
  currency,
}: {
  archived: FinAdjustment[];
  currency: string | null;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const d = archived.filter((a) => a.status === "dismissed").length;
  const r = archived.length - d;
  return (
    <section>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-left w-full group">
        <SectionTitle>
          {t("financials.adjArchive")}{" "}
          <span className="rounded-full bg-ink/6 text-muted px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
            {t("financials.adjArchiveCounts", { d, r })}
          </span>
        </SectionTitle>
        <span className="text-muted text-[10px] group-hover:text-emph transition-colors">
          {open ? `▾ ${t("common.hide")}` : `▸ ${t("common.show")}`}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {archived.map((a) => (
            <div
              key={a.id}
              className="rounded-xl bg-card/40 border border-hairline px-4 py-2 flex items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-muted truncate">{a.title}</span>
                  <span className="shrink-0 rounded px-1.5 py-px text-[9px] uppercase tracking-wider bg-ink/8 text-muted">
                    {a.status === "dismissed"
                      ? t("financials.adjStatusDismissed")
                      : t("financials.adjStatusReverted")}
                  </span>
                </div>
                <AdjLine adj={a} currency={currency} />
              </div>
              <span className="shrink-0 text-[9px] text-muted/60">
                {(a.decidedAt ?? a.createdAt).slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// The financial analyst desk (the cleansing chat)
// ---------------------------------------------------------------------------

function AnalystDesk({
  messages,
  adjById,
  currency,
  sending,
  remoteBusy,
  error,
  disabled,
  actingId,
  onSend,
  onRetry,
  onPause,
  onAct,
}: {
  messages: FinMessage[];
  adjById: Map<string, FinAdjustment>;
  currency: string | null;
  sending: boolean;
  remoteBusy: boolean;
  error: string | null;
  disabled: boolean;
  actingId: string | null;
  onSend: (text: string) => void;
  onRetry: () => void;
  onPause: () => void;
  onAct: (id: string, action: "apply" | "dismiss" | "revert") => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const busy = sending || remoteBusy;
  const endRef = useRef<HTMLDivElement | null>(null);
  const count = messages.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [count, busy]);

  function submit() {
    const text = draft.trim();
    if (!text || busy || disabled) return;
    setDraft("");
    onSend(text);
  }

  return (
    <section className="h-full flex flex-col rounded-2xl bg-card border border-accent/20 p-4">
      <SectionTitle>{t("financials.deskTitle")}</SectionTitle>
      <p className="text-xs text-muted mt-1.5 leading-relaxed">{t("financials.deskExplainer")}</p>

      <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <p className="text-muted/70 text-xs italic leading-relaxed">{t("financials.deskEmpty")}</p>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            <div
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent/12 px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                  : "mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-ink/5 border border-hairline px-3.5 py-2 text-sm leading-relaxed"
              }
            >
              {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}
            </div>
            {/* Adjustments this turn recorded, rendered as live cards. */}
            {m.role === "assistant" && m.adjustmentIds.length > 0 && (
              <div className="mr-auto max-w-[92%] mt-1.5 space-y-1.5">
                <p className="text-[10px] text-muted">
                  {t("financials.deskParkedN", { n: m.adjustmentIds.length })}
                </p>
                {m.adjustmentIds.map((id) => {
                  const adj = adjById.get(id);
                  if (!adj) return null;
                  return (
                    <div
                      key={id}
                      className={`rounded-xl border px-3 py-2 ${
                        adj.status === "suggested" ? "border-warn/30 bg-warn/5" : "border-hairline bg-ink/4"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-emph min-w-0 truncate">
                          {adj.title}
                        </span>
                        <KindChip kind={adj.kind} />
                        <span className="ml-auto shrink-0">
                          <AdjLine adj={adj} currency={currency} />
                        </span>
                      </div>
                      {adj.status === "suggested" ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            onClick={() => onAct(adj.id, "apply")}
                            disabled={actingId === adj.id}
                            className="rounded-md bg-gain/15 text-gain font-semibold text-[11px] px-2.5 py-1 hover:bg-gain/25 disabled:opacity-50 transition-colors"
                          >
                            {actingId === adj.id ? t("financials.adjWorking") : t("financials.adjApply")}
                          </button>
                          <button
                            onClick={() => onAct(adj.id, "dismiss")}
                            disabled={actingId === adj.id}
                            className="rounded-md bg-ink/6 text-muted font-medium text-[11px] px-2.5 py-1 hover:bg-ink/10 disabled:opacity-50 transition-colors"
                          >
                            {t("financials.adjDismiss")}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1 text-[10px] text-muted">
                          {adj.status === "applied"
                            ? t("financials.adjAppliedTitle")
                            : adj.status === "reverted"
                              ? t("financials.adjStatusReverted")
                              : t("financials.adjStatusDismissed")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-ink/5 border border-hairline px-3.5 py-2 flex items-center gap-3">
            <span className="text-[12px] text-accent pulse-soft">{t("financials.deskThinking")}</span>
            <button
              onClick={onPause}
              className="rounded-md bg-ink/6 hover:bg-ink/10 text-[10px] text-muted hover:text-emph px-2 py-0.5 transition-colors"
            >
              {t("financials.deskPause")}
            </button>
          </div>
        )}
        {error && !busy && (
          <p className="text-[11px] text-loss">
            {localizeError(error, t)}{" "}
            <button onClick={onRetry} className="underline decoration-dotted hover:text-emph transition-colors">
              {t("financials.deskRetry")}
            </button>
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="mt-3 flex items-center gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("financials.deskPlaceholder")}
          disabled={disabled}
          className="flex-1 min-w-0 rounded-lg border border-hairline bg-ink/4 px-3 py-2 text-sm focus:outline-none focus:border-accent/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy || disabled}
          className="rounded-lg bg-accent/90 hover:bg-accent disabled:opacity-40 text-white text-xs font-semibold px-3.5 py-2 transition-colors"
        >
          {t("financials.deskSend")}
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// History: current raw → cleansed differences + the audit log
// ---------------------------------------------------------------------------

function HistoryPanel({
  cells,
  adjById,
  formatByKey,
  currency,
  events,
}: {
  cells: CleansedCell[];
  adjById: Map<string, FinAdjustment>;
  formatByKey: Map<string, MetricFormat>;
  currency: string | null;
  events: FinCleansingEvent[];
}) {
  const { t } = useT();
  const c = currency ?? "USD";
  return (
    <section>
      <SectionTitle>{t("financials.historyTitle")}</SectionTitle>
      <p className="text-xs text-muted mt-1.5 leading-relaxed">{t("financials.historyExplainer")}</p>

      <div className="mt-2 rounded-2xl bg-card border border-hairline p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">
          {t("financials.historyDiffTitle")}
        </p>
        {cells.length === 0 ? (
          <p className="text-muted text-xs italic mt-1.5">{t("financials.historyDiffNone")}</p>
        ) : (
          <div className="overflow-x-auto mt-1.5">
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="text-muted text-left">
                  <th className="font-medium py-1 pr-3">{t("financials.historyColMetric")}</th>
                  <th className="font-medium py-1 px-2">{t("financials.historyColFY")}</th>
                  <th className="font-medium py-1 px-2 text-right">{t("financials.historyColRaw")}</th>
                  <th className="font-medium py-1 px-2 text-right">{t("financials.historyColCleansed")}</th>
                  <th className="font-medium py-1 pl-2">{t("financials.historyColVia")}</th>
                </tr>
              </thead>
              <tbody>
                {cells.map((cell) => {
                  const fmt = formatByKey.get(cell.metricKey) ?? "money";
                  return (
                    <tr key={`${cell.metricKey}:${cell.year}`} className="border-t border-hairline/60">
                      <td className="py-1 pr-3 text-emph whitespace-nowrap">
                        {t(`financials.${cell.metricKey}` as TKey)}
                        {cell.derived && (
                          <span className="ml-1.5 rounded bg-ink/8 px-1 py-px text-[8px] uppercase tracking-wider text-muted">
                            {t("financials.historyDerived")}
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-muted">{cell.year}</td>
                      <td className="py-1 px-2 text-right text-muted">{fmtMetric(cell.raw, fmt, c)}</td>
                      <td className="py-1 px-2 text-right text-accent font-semibold">
                        {fmtMetric(cell.cleansed, fmt, c)}
                      </td>
                      <td className="py-1 pl-2 text-muted max-w-64">
                        <span className="truncate block">
                          {cell.adjustmentIds
                            .map((id) => adjById.get(id)?.title)
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[10px] uppercase tracking-wider text-muted font-semibold">
          {t("financials.historyEventsTitle")}
        </p>
        {events.length === 0 ? (
          <p className="text-muted text-xs italic mt-1.5">{t("financials.historyNone")}</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 text-[11px]">
                <span className="shrink-0 text-muted/70 tabular-nums">{e.at.slice(0, 10)}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-px text-[9px] uppercase tracking-wider ${
                    e.action === "applied"
                      ? "bg-gain/12 text-gain"
                      : e.action === "suggested"
                        ? "bg-warn/12 text-warn/90"
                        : "bg-ink/8 text-muted"
                  }`}
                >
                  {e.action}
                </span>
                <span className="text-emph min-w-0 truncate">{e.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-widest text-muted font-semibold flex items-center gap-2">
      {children}
    </h2>
  );
}
