"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/PrefsProvider";
import { api } from "@/components/util";
import type { TKey } from "@/lib/i18n/dictionaries";
import type {
  DeskLesson,
  DeskSource,
  DeskSourceKind,
  ManagementPromise,
  PromiseOutcome,
} from "@/lib/types";

/**
 * The desk-memory surfaces (FOUNDATION: human sovereignty; the desk learns
 * from every interaction — through the gate, never around it):
 *   - StandingOrders: the lessons ledger — approve/edit/retire the desk's
 *     durable conduct instructions.
 *   - SourceMap: where this company's authentic record lives, with the
 *     cooperative-steering switch (the investor's explicit choice of whether
 *     the map steers the scouts).
 *   - PromiseLedger: management commitments tracked to their outcomes.
 * All three self-fetch and refetch when `refreshKey` changes (runs and chat
 * turns both feed them).
 */

const LESSON_ORIGIN_KEY: Record<DeskLesson["origin"], TKey> = {
  chat: "memory.lessonOriginChat",
  dismissal: "memory.lessonOriginDismissal",
  investor: "memory.lessonOriginInvestor",
};

const KIND_CHIP: Record<DeskSourceKind, string> = {
  primary: "bg-gain/15 text-gain",
  trade: "bg-accent/12 text-accent",
  narrative: "bg-ink/8 text-muted",
  avoid: "bg-loss/12 text-loss",
};

function Shell({
  title,
  badge,
  explainer,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge: string | null;
  explainer: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <section className="rounded-2xl bg-card border border-hairline px-5 py-4">
      <button onClick={onToggle} className="flex items-center gap-2 w-full text-left group">
        <h2 className="text-[11px] uppercase tracking-widest text-muted font-semibold">{title}</h2>
        {badge && (
          <span className="rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[10px] font-semibold">
            {badge}
          </span>
        )}
        <span className="ml-auto text-muted text-[10px] group-hover:text-emph transition-colors">
          {open ? `▾ ${t("common.hide")}` : `▸ ${t("common.show")}`}
        </span>
      </button>
      {open && (
        <>
          <p className="mt-1.5 text-[11px] text-muted/80 leading-relaxed">{explainer}</p>
          <div className="mt-3">{children}</div>
        </>
      )}
    </section>
  );
}

function ActBtn({
  onClick,
  tone,
  children,
  title,
}: {
  onClick: () => void;
  tone: "gain" | "muted" | "loss";
  children: React.ReactNode;
  title?: string;
}) {
  const cls =
    tone === "gain"
      ? "bg-gain/15 text-gain hover:bg-gain/25 font-semibold"
      : tone === "loss"
        ? "bg-ink/6 text-muted hover:bg-loss/10 hover:text-loss"
        : "bg-ink/6 text-muted hover:bg-ink/10 hover:text-foreground";
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg text-[11px] px-2.5 py-1 transition-colors ${cls}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Standing orders
// ---------------------------------------------------------------------------

export function StandingOrders({ symbol, refreshKey }: { symbol: string; refreshKey: string }) {
  const { t } = useT();
  const [lessons, setLessons] = useState<DeskLesson[] | null>(null);
  const [open, setOpen] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<{ lessons: DeskLesson[] }>(`/api/tickers/${encodeURIComponent(symbol)}/lessons`)
        .then((r) => setLessons(r.lessons))
        .catch(() => {}),
    [symbol]
  );
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function act(id: string, action: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/lessons/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing || !editing.text.trim()) return;
    setBusy(true);
    try {
      await api(`/api/lessons/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ text: editing.text }),
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/lessons`, {
        method: "POST",
        body: JSON.stringify({ text: draft }),
      });
      setDraft("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const active = (lessons ?? []).filter((l) => l.status === "active");
  const suggested = (lessons ?? []).filter((l) => l.status === "suggested");
  const archived = (lessons ?? []).filter((l) => l.status === "retired" || l.status === "dismissed");

  const row = (l: DeskLesson) => (
    <li key={l.id} className="rounded-xl bg-ink/4 border border-hairline px-3 py-2">
      {editing?.id === l.id ? (
        <div className="flex items-center gap-2">
          <input
            value={editing.text}
            onChange={(e) => setEditing({ id: l.id, text: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
            className="flex-1 rounded-md border border-accent/40 bg-ink/4 px-2 py-1 text-xs focus:outline-none"
            autoFocus
          />
          <ActBtn onClick={saveEdit} tone="gain">
            {t("common.save")}
          </ActBtn>
          <ActBtn onClick={() => setEditing(null)} tone="muted">
            {t("common.cancel")}
          </ActBtn>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <p className="text-xs text-emph leading-relaxed flex-1">{l.text}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {l.status === "suggested" && (
                <>
                  <ActBtn onClick={() => act(l.id, "approve")} tone="gain">
                    {t("memory.approve")}
                  </ActBtn>
                  <ActBtn onClick={() => act(l.id, "dismiss")} tone="muted">
                    {t("memory.ignore")}
                  </ActBtn>
                </>
              )}
              {l.status === "active" && (
                <ActBtn onClick={() => act(l.id, "retire")} tone="loss">
                  {t("memory.retire")}
                </ActBtn>
              )}
              {(l.status === "retired" || l.status === "dismissed") && (
                <ActBtn onClick={() => act(l.id, "reactivate")} tone="muted">
                  {t("memory.reactivate")}
                </ActBtn>
              )}
              {(l.status === "active" || l.status === "suggested") && (
                <button
                  onClick={() => setEditing({ id: l.id, text: l.text })}
                  title={t("memory.editTitle")}
                  className="text-muted hover:text-emph text-[11px] px-1 transition-colors"
                >
                  ✎
                </button>
              )}
            </div>
          </div>
          <p className="mt-0.5 text-[10px] text-muted/70">
            {t(LESSON_ORIGIN_KEY[l.origin])}
            {l.basis ? ` · ${t("memory.basisLabel")}: ${l.basis}` : ""}
          </p>
        </>
      )}
    </li>
  );

  return (
    <Shell
      title={t("memory.ordersTitle")}
      badge={suggested.length > 0 ? t("memory.awaitingApproval", { n: suggested.length }) : null}
      explainer={t("memory.ordersExplainer")}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {suggested.length > 0 && <ul className="space-y-2 mb-2 border-l-2 border-warn/40 pl-2">{suggested.map(row)}</ul>}
      {active.length > 0 ? (
        <ul className="space-y-2">{active.map(row)}</ul>
      ) : (
        suggested.length === 0 && <p className="text-[11px] text-muted italic">{t("memory.ordersEmpty")}</p>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("memory.ordersAddPlaceholder")}
          className="flex-1 min-w-0 rounded-lg border border-hairline bg-ink/4 px-3 py-1.5 text-xs focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
        />
        <ActBtn onClick={add} tone="gain">
          {t("memory.ordersAdd")}
        </ActBtn>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-loss">{error}</p>}
      {archived.length > 0 && (
        <div className="mt-2.5">
          <button
            onClick={() => setArchiveOpen((v) => !v)}
            className="text-[10px] text-muted hover:text-emph transition-colors"
          >
            {archiveOpen ? "▾" : "▸"} {t("memory.ordersArchive", { n: archived.length })}
          </button>
          {archiveOpen && <ul className="mt-1.5 space-y-2 opacity-70">{archived.map(row)}</ul>}
        </div>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Source map — with the cooperative-steering switch
// ---------------------------------------------------------------------------

export function SourceMap({ symbol, refreshKey }: { symbol: string; refreshKey: string }) {
  const { t } = useT();
  const [sources, setSources] = useState<DeskSource[] | null>(null);
  const [steering, setSteering] = useState(true);
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<DeskSourceKind>("primary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<{ sources: DeskSource[]; steering: boolean }>(
        `/api/tickers/${encodeURIComponent(symbol)}/sources`
      )
        .then((r) => {
          setSources(r.sources);
          setSteering(r.steering);
        })
        .catch(() => {}),
    [symbol]
  );
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function toggleSteering() {
    const next = !steering;
    setSteering(next); // optimistic — the switch must feel instant
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/sources`, {
        method: "PATCH",
        body: JSON.stringify({ steering: next }),
      });
    } catch {
      setSteering(!next);
    }
  }

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/sources/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!domain.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/sources`, {
        method: "POST",
        body: JSON.stringify({ domain, kind, note }),
      });
      setDomain("");
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const suggested = (sources ?? []).filter((s) => s.status === "suggested");
  const active = (sources ?? []).filter((s) => s.status === "active");

  const kindChip = (s: DeskSource, clickable: boolean) => (
    <select
      value={s.kind}
      disabled={!clickable}
      onChange={(e) => act(s.id, { kind: e.target.value })}
      className={`rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide border-0 appearance-none cursor-pointer ${KIND_CHIP[s.kind]}`}
      title={t("memory.editTitle")}
    >
      {(["primary", "trade", "narrative", "avoid"] as const).map((k) => (
        <option key={k} value={k}>
          {t(`memory.kind_${k}`)}
        </option>
      ))}
    </select>
  );

  const row = (s: DeskSource, pending: boolean) => (
    <li key={s.id} className="flex items-center gap-2 text-[11px]">
      {kindChip(s, !pending)}
      <span className="text-emph font-medium truncate" title={s.label || s.domain}>
        {s.domain}
      </span>
      {s.note && <span className="text-muted truncate">— {s.note}</span>}
      {s.seenCount > 0 && (
        <span className="text-muted/60 tabular-nums shrink-0">
          {t("memory.citedTimes", { n: s.seenCount })}
        </span>
      )}
      <span className="ml-auto shrink-0 flex items-center gap-1.5">
        {pending ? (
          <>
            <ActBtn onClick={() => act(s.id, { action: "approve" })} tone="gain">
              {t("memory.approve")}
            </ActBtn>
            <ActBtn onClick={() => act(s.id, { action: "dismiss" })} tone="muted">
              {t("memory.ignore")}
            </ActBtn>
          </>
        ) : (
          <button
            onClick={() => act(s.id, { action: "dismiss" })}
            title={t("memory.srcRemoveTitle")}
            className="text-muted hover:text-loss text-[11px] px-1 transition-colors"
          >
            ✕
          </button>
        )}
      </span>
    </li>
  );

  const group = (title: string, rows: DeskSource[]) =>
    rows.length > 0 && (
      <div className="mt-2">
        <p className="text-[9px] uppercase tracking-widest text-muted/70 font-semibold">{title}</p>
        <ul className="mt-1 space-y-1.5">{rows.map((s) => row(s, false))}</ul>
      </div>
    );

  return (
    <Shell
      title={t("memory.sourcesTitle")}
      badge={suggested.length > 0 ? t("memory.awaitingApproval", { n: suggested.length }) : null}
      explainer={t("memory.sourcesExplainer")}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {/* The cooperative-research choice, stated plainly: does the investor's
          approved map steer the scouts, or stay reference-only? */}
      <div className="rounded-xl border border-hairline bg-ink/4 px-3 py-2 flex items-start gap-2.5">
        <button
          onClick={toggleSteering}
          role="switch"
          aria-checked={steering}
          className={`mt-0.5 relative h-4.5 w-8 shrink-0 rounded-full transition-colors ${steering ? "bg-accent" : "bg-ink/20"}`}
        >
          <span
            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${steering ? "left-4" : "left-0.5"}`}
          />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emph">
            {t("memory.steeringLabel")}{" "}
            <span className={steering ? "text-accent" : "text-muted"}>
              {steering ? t("memory.steeringOn") : t("memory.steeringOff")}
            </span>
          </p>
          <p className="text-[10px] text-muted/80 leading-relaxed mt-0.5">
            {steering ? t("memory.steeringOnHint") : t("memory.steeringOffHint")}
          </p>
        </div>
      </div>
      {suggested.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 border-l-2 border-warn/40 pl-2">
          {suggested.map((s) => row(s, true))}
        </ul>
      )}
      {active.length === 0 && suggested.length === 0 && (
        <p className="mt-2.5 text-[11px] text-muted italic">{t("memory.sourcesEmpty")}</p>
      )}
      {group(
        t("memory.groupCheckFirst"),
        active.filter((s) => s.kind === "primary" || s.kind === "trade")
      )}
      {group(t("memory.groupAvoid"), active.filter((s) => s.kind === "avoid"))}
      {group(t("memory.groupReference"), active.filter((s) => s.kind === "narrative"))}
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder={t("memory.srcDomainPlaceholder")}
          className="w-44 rounded-lg border border-hairline bg-ink/4 px-3 py-1.5 text-xs focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DeskSourceKind)}
          className="rounded-lg border border-hairline bg-ink/4 px-2 py-1.5 text-xs focus:outline-none"
        >
          {(["primary", "trade", "narrative", "avoid"] as const).map((k) => (
            <option key={k} value={k}>
              {t(`memory.kind_${k}`)}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("memory.srcNotePlaceholder")}
          className="flex-1 min-w-40 rounded-lg border border-hairline bg-ink/4 px-3 py-1.5 text-xs focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
        />
        <ActBtn onClick={add} tone="gain">
          {t("memory.srcAdd")}
        </ActBtn>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-loss">{error}</p>}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Promise ledger
// ---------------------------------------------------------------------------

const OUTCOME_CHIP: Record<PromiseOutcome, string> = {
  kept: "bg-gain/15 text-gain",
  missed: "bg-loss/12 text-loss",
  dropped: "bg-warn/15 text-warn",
};

export function PromiseLedger({ symbol, refreshKey }: { symbol: string; refreshKey: string }) {
  const { t } = useT();
  const [promises, setPromises] = useState<ManagementPromise[] | null>(null);
  const [open, setOpen] = useState(true);
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<{ promises: ManagementPromise[] }>(`/api/tickers/${encodeURIComponent(symbol)}/promises`)
        .then((r) => setPromises(r.promises))
        .catch(() => {}),
    [symbol]
  );
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/promises/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setResolvingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tickers/${encodeURIComponent(symbol)}/promises`, {
        method: "POST",
        body: JSON.stringify({ text: draft }),
      });
      setDraft("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const all = promises ?? [];
  const suggested = all.filter((p) => p.status === "suggested");
  const openOnes = all.filter((p) => p.status === "open");
  const resolved = all.filter(
    (p) => p.status === "kept" || p.status === "missed" || p.status === "dropped"
  );
  const tally = {
    kept: resolved.filter((p) => p.status === "kept").length,
    missed: resolved.filter((p) => p.status === "missed").length,
    dropped: resolved.filter((p) => p.status === "dropped").length,
  };

  const meta = (p: ManagementPromise) => (
    <p className="mt-0.5 text-[10px] text-muted/80">
      {p.madeBy || "—"}
      {p.madeAt ? ` · ${p.madeAt}` : ""}
      {p.due && <span className="text-warn/90"> · {t("memory.dueLabel", { due: p.due })}</span>}
      {p.sourceUrl && (
        <>
          {" · "}
          <a
            href={p.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-accent underline decoration-dotted underline-offset-2 transition-colors"
          >
            {p.sourceTitle || p.sourceUrl}
          </a>
        </>
      )}
    </p>
  );

  return (
    <Shell
      title={t("memory.promisesTitle")}
      badge={suggested.length > 0 ? t("memory.awaitingApproval", { n: suggested.length }) : null}
      explainer={t("memory.promisesExplainer")}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {suggested.length > 0 && (
        <ul className="space-y-2 mb-2 border-l-2 border-warn/40 pl-2">
          {suggested.map((p) => (
            <li key={p.id} className="rounded-xl bg-ink/4 border border-hairline px-3 py-2">
              <div className="flex items-start gap-2">
                <p className="text-xs text-emph leading-relaxed flex-1">{p.text}</p>
                <span className="flex items-center gap-1.5 shrink-0">
                  <ActBtn onClick={() => act(p.id, { action: "approve" })} tone="gain">
                    {t("memory.approve")}
                  </ActBtn>
                  <ActBtn onClick={() => act(p.id, { action: "dismiss" })} tone="muted">
                    {t("memory.ignore")}
                  </ActBtn>
                </span>
              </div>
              {meta(p)}
            </li>
          ))}
        </ul>
      )}
      {openOnes.length > 0 ? (
        <ul className="space-y-2">
          {openOnes.map((p) => (
            <li key={p.id} className="rounded-xl bg-ink/4 border border-hairline px-3 py-2">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" title={t("memory.statusOpen")} />
                <p className="text-xs text-emph leading-relaxed flex-1">{p.text}</p>
                {resolvingId === p.id ? (
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted">{t("memory.resolveLabel")}</span>
                    {(["kept", "missed", "dropped"] as const).map((o) => (
                      <ActBtn
                        key={o}
                        onClick={() => act(p.id, { action: "resolve", outcome: o })}
                        tone={o === "kept" ? "gain" : "muted"}
                      >
                        {t(`memory.status${o[0].toUpperCase()}${o.slice(1)}` as TKey)}
                      </ActBtn>
                    ))}
                    <ActBtn onClick={() => setResolvingId(null)} tone="muted">
                      ✕
                    </ActBtn>
                  </span>
                ) : (
                  <button
                    onClick={() => setResolvingId(p.id)}
                    className="shrink-0 text-[10px] text-muted hover:text-emph transition-colors"
                  >
                    {t("memory.resolveLabel")}…
                  </button>
                )}
              </div>
              {meta(p)}
              {p.proposedStatus && (
                <div className="mt-1.5 rounded-lg border border-warn/30 bg-warn/8 px-2.5 py-1.5 flex items-center gap-2 flex-wrap">
                  <p className="text-[11px] text-emph flex-1 min-w-40">
                    {t("memory.proposedBanner", {
                      status: t(
                        `memory.status${p.proposedStatus[0].toUpperCase()}${p.proposedStatus.slice(1)}` as TKey
                      ),
                      note: p.proposedResolution || "—",
                    })}
                  </p>
                  <ActBtn onClick={() => act(p.id, { action: "confirm" })} tone="gain">
                    {t("memory.confirm")}
                  </ActBtn>
                  <ActBtn onClick={() => act(p.id, { action: "reject" })} tone="muted">
                    {t("memory.notYet")}
                  </ActBtn>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        suggested.length === 0 &&
        resolved.length === 0 && <p className="text-[11px] text-muted italic">{t("memory.promisesEmpty")}</p>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("memory.promisesAddPlaceholder")}
          className="flex-1 min-w-0 rounded-lg border border-hairline bg-ink/4 px-3 py-1.5 text-xs focus:outline-none focus:border-accent/50 placeholder:text-muted/50"
        />
        <ActBtn onClick={add} tone="gain">
          {t("memory.promisesAdd")}
        </ActBtn>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-loss">{error}</p>}
      {resolved.length > 0 && (
        <div className="mt-2.5">
          <button
            onClick={() => setResolvedOpen((v) => !v)}
            className="text-[10px] text-muted hover:text-emph transition-colors"
          >
            {resolvedOpen ? "▾" : "▸"} {t("memory.resolvedArchive", { n: resolved.length })}{" "}
            <span className="text-muted/70">({t("memory.resolvedTally", tally)})</span>
          </button>
          {resolvedOpen && (
            <ul className="mt-1.5 space-y-2">
              {resolved.map((p) => (
                <li key={p.id} className="rounded-xl bg-ink/4 border border-hairline px-3 py-2 opacity-80">
                  <div className="flex items-start gap-2">
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${OUTCOME_CHIP[p.status as PromiseOutcome]}`}
                    >
                      {t(`memory.status${p.status[0].toUpperCase()}${p.status.slice(1)}` as TKey)}
                    </span>
                    <p className="text-xs text-emph leading-relaxed flex-1">{p.text}</p>
                    <ActBtn onClick={() => act(p.id, { action: "reopen" })} tone="muted">
                      {t("memory.reopen")}
                    </ActBtn>
                  </div>
                  {p.resolution && <p className="mt-0.5 text-[10px] text-muted">{p.resolution}</p>}
                  {meta(p)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Shell>
  );
}
