"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DeskTabs } from "@/components/DeskTabs";
import { FinancialsSection, fmtMetric } from "@/components/FinancialsCard";
import { AlertTriangleIcon, SparkleIcon } from "@/components/icons";
import { Markdown } from "@/components/Markdown";
import { useT } from "@/components/PrefsProvider";
import { api, localizeError, timeAgo } from "@/components/util";
import type { TKey } from "@/lib/i18n/dictionaries";
import type {
  Citation,
  CleansedCell,
  CleansingPayload,
  FinAdjustment,
  FinAdjustmentOp,
  FinCleansingEvent,
  FinMessage,
  MetricFormat,
} from "@/lib/types";

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

/**
 * Bench display metadata shared by every adjustment line on the page: row
 * labels and value formats, with custom rows ("custom:*") resolving through
 * the addRow adjustment that created them.
 */
interface BenchMeta {
  labelFor: (key: string) => string;
  formatFor: (key: string) => MetricFormat;
}
const BenchMetaContext = createContext<BenchMeta>({
  labelFor: (key) => key,
  formatFor: () => "money",
});

/**
 * One reviewable card = one item. A recurring item proposed across several
 * line-years (same op, kind and title — e.g. the same subsidy stream in four
 * fiscal years) folds into a single group instead of repeating the card;
 * structural board edits stay singletons.
 */
function groupProposals(items: FinAdjustment[]): FinAdjustment[][] {
  const groups: FinAdjustment[][] = [];
  const byKey = new Map<string, FinAdjustment[]>();
  for (const a of items) {
    const op = a.op ?? "delta";
    const key =
      op === "delta" || op === "set"
        ? `${op}|${a.kind}|${a.title.toLowerCase().trim()}`
        : `one|${a.id}`;
    let g = byKey.get(key);
    if (!g) {
      g = [];
      byKey.set(key, g);
      groups.push(g);
    }
    g.push(a);
  }
  for (const g of groups) {
    g.sort((x, y) => x.fiscalYear.localeCompare(y.fiscalYear) || x.metricKey.localeCompare(y.metricKey));
  }
  return groups;
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

  /** Decide a whole grouped item at once (sequential; one reload at the end). */
  async function actMany(ids: string[], action: "apply" | "dismiss") {
    if (actingId || ids.length === 0) return;
    setActingId(ids[0]);
    try {
      for (const id of ids) {
        await api(`/api/cleansing/adjustments/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ action }),
        });
      }
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
  const benchMeta = useMemo<BenchMeta>(() => {
    const formats = new Map<string, MetricFormat>();
    const labels = new Map<string, string>();
    for (const metric of payload?.financials?.metrics ?? []) formats.set(metric.key, metric.format);
    for (const a of payload?.adjustments ?? []) {
      if ((a.op ?? "delta") === "addRow" && a.metricKey) {
        if (a.rowFormat) formats.set(a.metricKey, a.rowFormat);
        labels.set(a.metricKey, a.rowLabel ?? a.title);
      }
    }
    return {
      labelFor: (key) =>
        key.startsWith("custom:")
          ? (labels.get(key) ?? key.slice(7))
          : t(`financials.${key}` as TKey),
      formatFor: (key) => formats.get(key) ?? "money",
    };
  }, [payload, t]);

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
    <BenchMetaContext.Provider value={benchMeta}>
    <main className="w-full px-5 sm:px-6 lg:px-8 py-8 flex-1">
      {/* The per-ticker header, identical across signals / dd / finance:
          back link, symbol + company name, the desk pill, actions right. */}
      <header className="flex items-center gap-4 flex-wrap">
        <Link
          href="/"
          className="text-accent text-sm font-medium shrink-0 hover:opacity-80 transition-opacity"
        >
          {t("common.backToWatchlist")}
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{ticker.symbol}</h1>
          <p className="text-muted text-xs truncate">{ticker.name}</p>
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent/12 hover:bg-accent/20 disabled:opacity-50 text-accent text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            {!suggesting && <SparkleIcon className="h-3 w-3 shrink-0" />}
            {suggesting ? t("financials.suggestRunning") : t("financials.suggestBtn")}
          </button>
        </div>
      </header>

      {/* Currency discipline — the ADR trap stated loudly, above everything:
          statements in one currency, the listing in another. Every table
          figure and every adjustment delta is the STATEMENT currency. */}
      {financials?.currencyMismatch && financials.tradingCurrency && (
        <div className="mt-4 rounded-xl border border-warn/35 bg-warn/10 px-4 py-3">
          <p className="flex items-start gap-1.5 text-xs text-warn">
            <AlertTriangleIcon className="h-3.5 w-3.5 mt-px shrink-0" />
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
        <h2 className="text-[0.6875rem] uppercase tracking-widest text-muted font-semibold">
          {t("financials.benchAboutTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t("financials.benchAboutBody", { name: ticker.name })}
        </p>
      </section>

      {/* Side-by-side, the signals-page idiom: the numbers and the gate on
          the left, the financial analyst desk sticky on the right. */}
      <div className="mt-5 grid lg:grid-cols-[minmax(0,1fr)_22.5rem] xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem] gap-5 items-start">
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
              <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold">
                {t("financials.suggestNoteTitle")}
                <span className="normal-case tracking-normal font-normal text-muted/70">
                  {" "}
                  · {timeAgo(suggestRun.finishedAt ?? suggestRun.createdAt, t)} ·{" "}
                  {suggestRun.proposalCount > 0
                    ? t("financials.suggestFoundN", { n: suggestRun.proposalCount })
                    : t("financials.suggestFoundNone")}
                </span>
              </p>
              <p className="text-[0.8125rem] text-emph mt-1.5 leading-relaxed">{suggestRun.note}</p>
            </div>
          )}
          {suggestError && <p className="text-[0.6875rem] text-loss">{suggestError}</p>}

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
                <span className="rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[0.625rem] font-semibold normal-case tracking-normal">
                  {t("financials.adjPendingBadge", { n: pending.length })}
                </span>
              </SectionTitle>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">{t("financials.adjPendingExplainer")}</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                {groupProposals(pending).map((items) => (
                  <AdjustmentGroupCard
                    key={items[0].id}
                    items={items}
                    currency={currency}
                    actingId={actingId}
                    onAct={act}
                    onActMany={actMany}
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
            onActMany={actMany}
          />
        </div>
      </div>
    </main>
    </BenchMetaContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Adjustment cards & rows
// ---------------------------------------------------------------------------

function KindChip({ kind }: { kind: FinAdjustment["kind"] }) {
  const { t } = useT();
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-px text-[0.5625rem] uppercase tracking-wider ${
        kind === "growth" ? "bg-warn/12 text-warn/90" : "bg-ink/8 text-muted"
      }`}
    >
      {kind === "growth" ? t("financials.adjKindGrowth") : t("financials.adjKindNoise")}
    </span>
  );
}

/** Chip naming a board edit's operation (delta adjustments use KindChip). */
function OpChip({ op }: { op: FinAdjustmentOp }) {
  const { t } = useT();
  const key =
    op === "set" ? "adjOpSet"
    : op === "addRow" ? "adjOpAddRow"
    : op === "removeRow" ? "adjOpRemoveRow"
    : op === "addYear" ? "adjOpAddYear"
    : "adjOpRemoveYear";
  return (
    <span className="shrink-0 rounded px-1.5 py-px text-[0.5625rem] uppercase tracking-wider bg-accent/12 text-accent/90">
      {t(`financials.${key}` as TKey)}
    </span>
  );
}

/** The one-line summary of what an adjustment does to the board, op-aware. */
function AdjLine({ adj, currency }: { adj: FinAdjustment; currency: string | null }) {
  const { t } = useT();
  const { labelFor, formatFor } = useContext(BenchMetaContext);
  const cls = "text-[0.6875rem] text-emph tabular-nums";
  switch (adj.op ?? "delta") {
    case "addRow": {
      const n = adj.cells ? Object.values(adj.cells).filter((v) => v != null).length : 0;
      return <p className={cls}>{t("financials.adjLineAddRow", { label: adj.rowLabel ?? adj.title, n })}</p>;
    }
    case "removeRow":
      return <p className={cls}>{t("financials.adjLineRemoveRow", { label: labelFor(adj.metricKey) })}</p>;
    case "addYear":
      return <p className={cls}>{t("financials.adjLineAddYear", { year: adj.fiscalYear })}</p>;
    case "removeYear":
      return <p className={cls}>{t("financials.adjLineRemoveYear", { year: adj.fiscalYear })}</p>;
    case "set":
      return (
        <p className={cls}>
          {t("financials.adjLineSet", { key: labelFor(adj.metricKey), year: adj.fiscalYear })}{" "}
          <span className="font-semibold text-accent">
            {adj.value == null ? "—" : fmtMetric(adj.value, formatFor(adj.metricKey), currency ?? "USD")}
          </span>
        </p>
      );
    default: {
      const amount =
        adj.metricKey === "shares"
          ? `${adj.delta < 0 ? "−" : "+"}${Math.abs(adj.delta).toLocaleString()}`
          : fmtDelta(adj.delta, currency);
      return (
        <p className={cls}>
          {t("financials.adjLine", { key: labelFor(adj.metricKey), year: adj.fiscalYear })}{" "}
          <span className={`font-semibold ${adj.delta < 0 ? "text-loss" : "text-gain"}`}>{amount}</span>
        </p>
      );
    }
  }
}

/** Kind chip for deltas, op chip for board edits. */
function AdjChip({ adj }: { adj: FinAdjustment }) {
  const op = adj.op ?? "delta";
  return op === "delta" ? <KindChip kind={adj.kind} /> : <OpChip op={op} />;
}

function SourceChips({ sources }: { sources: Citation[] }) {
  if (sources.length === 0) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 flex-wrap">
      {sources.slice(0, 4).map((s) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          title={s.title}
          className="rounded-full border border-hairline bg-ink/4 px-2 py-0.5 text-[0.5625rem] text-muted hover:text-accent hover:border-accent/40 transition-colors truncate max-w-40"
        >
          {s.domain ?? s.title}
        </a>
      ))}
    </p>
  );
}

/** Distinct sources across a grouped item's line-years. */
function mergedSources(items: FinAdjustment[]): Citation[] {
  const out: Citation[] = [];
  for (const a of items) {
    for (const s of a.sources) {
      if (s?.url && !out.some((x) => x.url === s.url)) out.push(s);
    }
  }
  return out;
}

/**
 * One pending ITEM: a single proposal, or a recurring item grouped across
 * line-years — the title and rationale once, each line-year separately
 * reviewable, plus apply-all / dismiss-all for the whole item.
 */
function AdjustmentGroupCard({
  items,
  currency,
  actingId,
  onAct,
  onActMany,
}: {
  items: FinAdjustment[];
  currency: string | null;
  actingId: string | null;
  onAct: (id: string, action: "apply" | "dismiss" | "revert") => void;
  onActMany: (ids: string[], action: "apply" | "dismiss") => void;
}) {
  const { t } = useT();
  const lead = items[0];
  const acting = actingId != null;
  const single = items.length === 1;
  return (
    <div className="rounded-xl bg-card border border-warn/30 p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-[0.8125rem] font-semibold text-emph min-w-0 truncate">{lead.title}</span>
        <AdjChip adj={lead} />
      </div>
      {single ? (
        <div className="mt-1">
          <AdjLine adj={lead} currency={currency} />
        </div>
      ) : (
        <>
          <p className="text-[0.625rem] text-muted mt-1">{t("financials.adjGroupHint", { n: items.length })}</p>
          <div className="mt-1.5 space-y-1">
            {items.map((a) => (
              <div key={a.id} className="flex items-center gap-2" title={a.rationale || undefined}>
                <AdjLine adj={a} currency={currency} />
                <span className="ml-auto flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onAct(a.id, "apply")}
                    disabled={acting}
                    className="rounded bg-gain/15 text-gain font-semibold text-[0.625rem] px-2 py-0.5 hover:bg-gain/25 disabled:opacity-50 transition-colors"
                  >
                    {actingId === a.id ? "…" : t("financials.adjApply")}
                  </button>
                  <button
                    onClick={() => onAct(a.id, "dismiss")}
                    disabled={acting}
                    className="rounded bg-ink/6 text-muted font-medium text-[0.625rem] px-2 py-0.5 hover:bg-ink/10 disabled:opacity-50 transition-colors"
                  >
                    {t("financials.adjDismiss")}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {lead.rationale && <p className="text-xs text-muted mt-1.5 leading-relaxed">{lead.rationale}</p>}
      <SourceChips sources={mergedSources(items)} />
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={() => (single ? onAct(lead.id, "apply") : onActMany(items.map((a) => a.id), "apply"))}
          disabled={acting}
          className="rounded-lg bg-gain/15 text-gain font-semibold text-xs px-3 py-1.5 hover:bg-gain/25 disabled:opacity-50 transition-colors"
        >
          {acting && items.some((a) => a.id === actingId)
            ? t("financials.adjWorking")
            : single
              ? t("financials.adjApply")
              : t("financials.adjApplyAll", { n: items.length })}
        </button>
        <button
          onClick={() => (single ? onAct(lead.id, "dismiss") : onActMany(items.map((a) => a.id), "dismiss"))}
          disabled={acting}
          className="rounded-lg bg-ink/6 text-muted font-medium text-xs px-3 py-1.5 hover:bg-ink/10 hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {single ? t("financials.adjDismiss") : t("financials.adjDismissAll", { n: items.length })}
        </button>
        <span className="ml-auto text-[0.5625rem] text-muted/60">{lead.createdAt.slice(0, 10)}</span>
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
          <AdjChip adj={adj} />
        </div>
        <AdjLine adj={adj} currency={currency} />
      </div>
      <button
        onClick={onRevert}
        disabled={busy}
        className="shrink-0 rounded-lg bg-ink/6 hover:bg-ink/10 text-[0.6875rem] font-medium text-emph px-2.5 py-1.5 disabled:opacity-50 transition-colors"
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
          <span className="rounded-full bg-ink/6 text-muted px-2 py-0.5 text-[0.625rem] font-semibold normal-case tracking-normal">
            {t("financials.adjArchiveCounts", { d, r })}
          </span>
        </SectionTitle>
        <span className="text-muted text-[0.625rem] group-hover:text-emph transition-colors">
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
                  <span className="text-[0.8125rem] text-muted truncate">{a.title}</span>
                  <AdjChip adj={a} />
                  <span className="shrink-0 rounded px-1.5 py-px text-[0.5625rem] uppercase tracking-wider bg-ink/8 text-muted">
                    {a.status === "dismissed"
                      ? t("financials.adjStatusDismissed")
                      : t("financials.adjStatusReverted")}
                  </span>
                </div>
                <AdjLine adj={a} currency={currency} />
              </div>
              <span className="shrink-0 text-[0.5625rem] text-muted/60">
                {(a.decidedAt ?? a.createdAt).slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * A grouped item inside the analyst-desk thread: compact rows per line-year,
 * live gate buttons on pending rows, status chips on decided ones.
 */
function ChatAdjustmentGroup({
  items,
  currency,
  actingId,
  onAct,
  onActMany,
}: {
  items: FinAdjustment[];
  currency: string | null;
  actingId: string | null;
  onAct: (id: string, action: "apply" | "dismiss" | "revert") => void;
  onActMany: (ids: string[], action: "apply" | "dismiss") => void;
}) {
  const { t } = useT();
  const lead = items[0];
  const acting = actingId != null;
  const pendingIds = items.filter((a) => a.status === "suggested").map((a) => a.id);
  const statusLabel = (s: FinAdjustment["status"]) =>
    s === "applied"
      ? t("financials.adjStatusApplied")
      : s === "reverted"
        ? t("financials.adjStatusReverted")
        : t("financials.adjStatusDismissed");
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        pendingIds.length > 0 ? "border-warn/30 bg-warn/5" : "border-hairline bg-ink/4"
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[0.75rem] font-semibold text-emph min-w-0 truncate">{lead.title}</span>
        <AdjChip adj={lead} />
      </div>
      <div className="mt-1 space-y-0.5">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-2" title={a.rationale || undefined}>
            <AdjLine adj={a} currency={currency} />
            {a.status === "suggested" ? (
              <span className="ml-auto flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onAct(a.id, "apply")}
                  disabled={acting}
                  className="rounded-md bg-gain/15 text-gain font-semibold text-[0.6875rem] px-2.5 py-1 hover:bg-gain/25 disabled:opacity-50 transition-colors"
                >
                  {actingId === a.id ? t("financials.adjWorking") : t("financials.adjApply")}
                </button>
                <button
                  onClick={() => onAct(a.id, "dismiss")}
                  disabled={acting}
                  className="rounded-md bg-ink/6 text-muted font-medium text-[0.6875rem] px-2.5 py-1 hover:bg-ink/10 disabled:opacity-50 transition-colors"
                >
                  {t("financials.adjDismiss")}
                </button>
              </span>
            ) : (
              <span className="ml-auto shrink-0 rounded px-1.5 py-px text-[0.5625rem] uppercase tracking-wider bg-ink/8 text-muted">
                {statusLabel(a.status)}
              </span>
            )}
          </div>
        ))}
      </div>
      {pendingIds.length > 1 && (
        <div className="mt-1.5 flex items-center gap-2">
          <button
            onClick={() => onActMany(pendingIds, "apply")}
            disabled={acting}
            className="rounded-md bg-gain/15 text-gain font-semibold text-[0.6875rem] px-2.5 py-1 hover:bg-gain/25 disabled:opacity-50 transition-colors"
          >
            {t("financials.adjApplyAll", { n: pendingIds.length })}
          </button>
          <button
            onClick={() => onActMany(pendingIds, "dismiss")}
            disabled={acting}
            className="rounded-md bg-ink/6 text-muted font-medium text-[0.6875rem] px-2.5 py-1 hover:bg-ink/10 disabled:opacity-50 transition-colors"
          >
            {t("financials.adjDismissAll", { n: pendingIds.length })}
          </button>
        </div>
      )}
    </div>
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
  onActMany,
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
  onActMany: (ids: string[], action: "apply" | "dismiss") => void;
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
            {/* Adjustments this turn recorded, rendered as live cards —
                grouped exactly like the pending section, so one multi-year
                item is one card here too. */}
            {m.role === "assistant" && m.adjustmentIds.length > 0 && (
              <div className="mr-auto max-w-[92%] mt-1.5 space-y-1.5">
                <p className="text-[0.625rem] text-muted">
                  {t("financials.deskParkedN", { n: m.adjustmentIds.length })}
                </p>
                {groupProposals(
                  m.adjustmentIds.map((id) => adjById.get(id)).filter((a): a is FinAdjustment => !!a)
                ).map((items) => (
                  <ChatAdjustmentGroup
                    key={items[0].id}
                    items={items}
                    currency={currency}
                    actingId={actingId}
                    onAct={onAct}
                    onActMany={onActMany}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-ink/5 border border-hairline px-3.5 py-2 flex items-center gap-3">
            <span className="text-[0.75rem] text-accent pulse-soft">{t("financials.deskThinking")}</span>
            <button
              onClick={onPause}
              className="rounded-md bg-ink/6 hover:bg-ink/10 text-[0.625rem] text-muted hover:text-emph px-2 py-0.5 transition-colors"
            >
              {t("financials.deskPause")}
            </button>
          </div>
        )}
        {error && !busy && (
          <p className="text-[0.6875rem] text-loss">
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
  currency,
  events,
}: {
  cells: CleansedCell[];
  adjById: Map<string, FinAdjustment>;
  currency: string | null;
  events: FinCleansingEvent[];
}) {
  const { t } = useT();
  const { labelFor, formatFor } = useContext(BenchMetaContext);
  const c = currency ?? "USD";
  return (
    <section>
      <SectionTitle>{t("financials.historyTitle")}</SectionTitle>
      <p className="text-xs text-muted mt-1.5 leading-relaxed">{t("financials.historyExplainer")}</p>

      <div className="mt-2 rounded-2xl bg-card border border-hairline p-4">
        <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold">
          {t("financials.historyDiffTitle")}
        </p>
        {cells.length === 0 ? (
          <p className="text-muted text-xs italic mt-1.5">{t("financials.historyDiffNone")}</p>
        ) : (
          <div className="overflow-x-auto mt-1.5">
            <table className="w-full text-[0.6875rem] tabular-nums">
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
                  const fmt = formatFor(cell.metricKey);
                  return (
                    <tr key={`${cell.metricKey}:${cell.year}`} className="border-t border-hairline/60">
                      <td className="py-1 pr-3 text-emph whitespace-nowrap">
                        {labelFor(cell.metricKey)}
                        {cell.derived && (
                          <span className="ml-1.5 rounded bg-ink/8 px-1 py-px text-[0.5rem] uppercase tracking-wider text-muted">
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

        <p className="mt-4 text-[0.625rem] uppercase tracking-wider text-muted font-semibold">
          {t("financials.historyEventsTitle")}
        </p>
        {events.length === 0 ? (
          <p className="text-muted text-xs italic mt-1.5">{t("financials.historyNone")}</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 text-[0.6875rem]">
                <span className="shrink-0 text-muted/70 tabular-nums">{e.at.slice(0, 10)}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-px text-[0.5625rem] uppercase tracking-wider ${
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
    <h2 className="text-[0.6875rem] uppercase tracking-widest text-muted font-semibold flex items-center gap-2">
      {children}
    </h2>
  );
}
