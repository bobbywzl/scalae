"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/PrefsProvider";
import { api } from "@/components/util";
import type { TKey } from "@/lib/i18n/dictionaries";
import type { DeskSearchHit, SearchBlockType, SearchPill } from "@/lib/search";

/**
 * Desk search: a minimal floating button on the right edge of every ticker
 * page that expands into a Spotlight-style bubble. One query spans all three
 * pills — Signals, Due diligence, Finance — and every text block they hold;
 * each result shows its directory (pill › section › item) and a snippet with
 * the matched words emphasized. Filter by pill and by block type. ⌘K / Ctrl+K
 * opens it; ↑↓/↵ navigate; esc closes.
 */

const PILL_ORDER: SearchPill[] = ["signals", "dd", "fin"];

const PILL_LABEL_KEY: Record<SearchPill, TKey> = {
  signals: "dd.tabSignals",
  dd: "dd.tabDiligence",
  fin: "dd.tabFinance",
};

function pillHref(symbol: string, pill: SearchPill): string {
  const base = `/t/${encodeURIComponent(symbol)}`;
  return pill === "signals" ? `${base}/signals` : pill === "fin" ? `${base}/financials` : base;
}

/** Emphasize every query word inside a snippet (case-insensitive). */
function Highlighted({ text, tokens }: { text: string; tokens: string[] }) {
  const parts = useMemo(() => {
    if (tokens.length === 0) return [text];
    const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const rx = new RegExp(`(${escaped.join("|")})`, "gi");
    return text.split(rx);
  }, [text, tokens]);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-accent/20 text-accent rounded-[3px] px-px font-medium">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function TickerSearch({ symbol }: { symbol: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DeskSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [pillFilter, setPillFilter] = useState<"all" | SearchPill>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | SearchBlockType>("all");
  const [sel, setSel] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const reqSeq = useRef(0);

  const tokens = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const active = q.trim().length >= 2;

  // Debounced fetch; a sequence counter drops stale responses. Busy state is
  // set in the input handler (not here) so the effect never sets state
  // synchronously; results for a shortened query are hidden by `active`.
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) return;
    const seq = ++reqSeq.current;
    const timer = setTimeout(() => {
      api<{ hits: DeskSearchHit[] }>(
        `/api/tickers/${encodeURIComponent(symbol)}/search?q=${encodeURIComponent(query)}`
      )
        .then((r) => {
          if (reqSeq.current !== seq) return;
          setHits(r.hits);
          setBusy(false);
        })
        .catch(() => {
          if (reqSeq.current !== seq) return;
          setHits([]);
          setBusy(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [open, q, symbol]);

  // ⌘K / Ctrl+K toggles; esc closes (esc handled on the input + globally).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Click outside the bubble closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown as EventListener, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown as EventListener);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const shown = useMemo(() => (active ? hits : []), [active, hits]);

  // Types present in the current pill scope, with counts (for the type chips).
  const typeCounts = useMemo(() => {
    const scoped = shown.filter((h) => pillFilter === "all" || h.pill === pillFilter);
    const m = new Map<SearchBlockType, number>();
    for (const h of scoped) m.set(h.type, (m.get(h.type) ?? 0) + 1);
    return m;
  }, [shown, pillFilter]);

  // A stale type selection (no longer present in scope) falls back to "all"
  // without a state sync — derived, never set in an effect.
  const effTypeFilter = typeFilter !== "all" && typeCounts.has(typeFilter) ? typeFilter : "all";

  const visible = useMemo(
    () =>
      shown.filter(
        (h) =>
          (pillFilter === "all" || h.pill === pillFilter) &&
          (effTypeFilter === "all" || h.type === effTypeFilter)
      ),
    [shown, pillFilter, effTypeFilter]
  );

  // Group in the pill bar's order; groups keep the server's relevance order.
  const groups = useMemo(
    () =>
      PILL_ORDER.map((pill) => ({ pill, items: visible.filter((h) => h.pill === pill) })).filter(
        (g) => g.items.length > 0
      ),
    [visible]
  );
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const go = useCallback(
    (hit: DeskSearchHit) => {
      setOpen(false);
      router.push(pillHref(symbol, hit.pill));
    },
    [router, symbol]
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && flat[sel]) {
      e.preventDefault();
      go(flat[sel]);
    }
  }

  // Keep the keyboard selection in view.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-hit-idx="${sel}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const showEmpty = !busy && active && flat.length === 0;

  return (
    <>
      {/* The floating trigger — a quiet circle on the right edge. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title={`${t("search.open")} (⌘K)`}
          aria-label={t("search.open")}
          className="fixed right-5 top-[38vh] z-40 flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-card/90 text-muted shadow-lg shadow-black/20 backdrop-blur-sm transition-all hover:scale-105 hover:border-accent/40 hover:text-accent"
        >
          <SearchIcon />
        </button>
      )}

      {open && (
        <div
          ref={boxRef}
          role="dialog"
          aria-label={t("search.open")}
          className="bubble-in fixed right-5 top-[max(4.5rem,10vh)] z-50 flex max-h-[min(600px,80vh)] w-[min(430px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-hairline bg-card shadow-2xl shadow-black/40"
        >
          {/* Query row */}
          <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
            <span className="shrink-0 text-muted">
              <SearchIcon />
            </span>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                const v = e.target.value;
                setQ(v);
                setBusy(v.trim().length >= 2);
                setSel(0);
              }}
              onKeyDown={onInputKey}
              placeholder={t("search.placeholder")}
              className="min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none placeholder:text-muted/60"
            />
            {busy && active && (
              <span className="shrink-0 text-xs text-accent pulse-soft">{t("search.searching")}</span>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label="esc"
              className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-muted/70 hover:text-emph transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Filters: pill row + block-type row */}
          <div className="border-b border-hairline px-4 py-2.5 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <FilterChip
                active={pillFilter === "all"}
                onClick={() => {
                  setPillFilter("all");
                  setSel(0);
                }}
              >
                {t("search.filterAll")}
              </FilterChip>
              {PILL_ORDER.map((pill) => (
                <FilterChip
                  key={pill}
                  active={pillFilter === pill}
                  onClick={() => {
                    setPillFilter((p) => (p === pill ? "all" : pill));
                    setSel(0);
                  }}
                >
                  {t(PILL_LABEL_KEY[pill])}
                </FilterChip>
              ))}
            </div>
            {typeCounts.size > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[...typeCounts.entries()].map(([type, n]) => (
                  <FilterChip
                    key={type}
                    subtle
                    active={effTypeFilter === type}
                    onClick={() => {
                      setTypeFilter((x) => (x === type ? "all" : type));
                      setSel(0);
                    }}
                  >
                    {t(`search.type_${type}` as TKey)}
                    <span className="ml-1 opacity-60 tabular-nums">{n}</span>
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {!active ? (
              <div className="px-3 py-6 text-center">
                <p className="text-sm text-muted">{t("search.hint")}</p>
                <p className="mt-1.5 text-xs text-muted/60">{t("search.minChars")}</p>
              </div>
            ) : showEmpty ? (
              <p className="px-3 py-6 text-center text-sm text-muted">
                {t("search.empty", { q: q.trim() })}
              </p>
            ) : (
              groups.map((g) => {
                const offset = flat.indexOf(g.items[0]);
                return (
                  <div key={g.pill} className="mb-2 last:mb-0">
                    <p className="px-2.5 pb-1 pt-1.5 text-[10px] uppercase tracking-widest text-muted/70 font-semibold">
                      {t(PILL_LABEL_KEY[g.pill])}
                    </p>
                    {g.items.map((hit, i) => (
                      <ResultRow
                        key={hit.id}
                        hit={hit}
                        idx={offset + i}
                        selected={offset + i === sel}
                        tokens={tokens}
                        onHover={() => setSel(offset + i)}
                        onOpen={() => go(hit)}
                      />
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: count + keyboard hints */}
          <div className="flex items-center justify-between border-t border-hairline px-4 py-2 text-[10px] text-muted/60">
            <span className="tabular-nums">
              {active && !busy ? t("search.matches", { n: flat.length }) : ""}
            </span>
            <span>{t("search.keys")}</span>
          </div>
        </div>
      )}
    </>
  );
}

function ResultRow({
  hit,
  idx,
  selected,
  tokens,
  onHover,
  onOpen,
}: {
  hit: DeskSearchHit;
  idx: number;
  selected: boolean;
  tokens: string[];
  onHover: () => void;
  onOpen: () => void;
}) {
  const { t } = useT();
  return (
    <button
      data-hit-idx={idx}
      onClick={onOpen}
      onMouseEnter={onHover}
      className={`block w-full rounded-xl px-2.5 py-2 text-left transition-colors ${
        selected ? "bg-accent/10" : "hover:bg-ink/5"
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 rounded bg-accent/12 px-1.5 py-px text-[10px] font-semibold text-accent">
          {t(`search.type_${hit.type}` as TKey)}
        </span>
        {hit.path.length > 0 && (
          <span className="min-w-0 truncate text-xs text-muted">
            {hit.path.map((seg, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1 text-muted/50">›</span>}
                {seg}
              </span>
            ))}
          </span>
        )}
        {hit.meta && (
          <span className="shrink-0 rounded bg-ink/6 px-1.5 py-px text-[9px] uppercase tracking-wider text-muted/80">
            {hit.meta}
          </span>
        )}
        {hit.date && (
          <span className="ml-auto shrink-0 text-[10px] text-muted/50 tabular-nums">
            {hit.date.slice(0, 10)}
          </span>
        )}
      </span>
      {hit.snippet && (
        <span className="mt-1 block text-[13px] leading-relaxed text-emph">
          <Highlighted text={hit.snippet} tokens={tokens} />
        </span>
      )}
    </button>
  );
}

function FilterChip({
  active,
  subtle,
  onClick,
  children,
}: {
  active: boolean;
  subtle?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-accent/15 text-accent"
          : subtle
            ? "bg-ink/4 text-muted/80 hover:bg-ink/8 hover:text-emph"
            : "border border-hairline text-muted hover:text-emph"
      }`}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
