"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./util";
import type { SearchHit } from "@/lib/market";

export function AddTicker() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 1) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { hits } = await api<{ hits: SearchHit[] }>(
          `/api/search?q=${encodeURIComponent(q.trim())}`
        );
        setHits(hits);
        setOpen(true);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function add(symbol: string) {
    setBusy(symbol);
    setError(null);
    try {
      await api(`/api/tickers`, { method: "POST", body: JSON.stringify({ symbol }) });
      setQ("");
      setHits([]);
      setOpen(false);
      router.push(`/t/${encodeURIComponent(symbol)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add ticker");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl bg-card px-3.5 py-2.5 border border-hairline focus-within:border-accent/60 transition-colors">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-muted shrink-0">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) add(q.trim().toUpperCase());
          }}
          placeholder="Add a ticker — AAPL, COST, 7203.T…"
          className="bg-transparent outline-none text-sm w-full placeholder:text-muted/70"
        />
      </div>
      {error && <p className="text-loss text-xs mt-1.5 px-1">{error}</p>}
      {open && hits.length > 0 && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl bg-card2 border border-hairline overflow-hidden shadow-2xl shadow-black/60">
          {hits.map((h) => (
            <button
              key={h.symbol}
              onClick={() => add(h.symbol)}
              disabled={busy !== null}
              className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-white/6 text-left disabled:opacity-50"
            >
              <span>
                <span className="font-semibold text-sm">{h.symbol}</span>
                <span className="text-muted text-xs ml-2">{h.name}</span>
              </span>
              <span className="text-muted/70 text-[10px] uppercase tracking-wide">
                {busy === h.symbol ? "adding…" : h.exchange}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
