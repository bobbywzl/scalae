import type { Impact, ReadingLevel } from "@/lib/types";

export function fmtPrice(v: number | null | undefined, currency?: string | null): string {
  if (v == null) return "—";
  const sym = !currency || currency === "USD" ? "$" : currency + " ";
  return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const LEVEL_STYLE: Record<ReadingLevel, { label: string; cls: string }> = {
  strong: { label: "Strong", cls: "bg-[#30d158]/15 text-[#30d158]" },
  improving: { label: "Improving", cls: "bg-[#30d158]/10 text-[#7ee2a8]" },
  neutral: { label: "Neutral", cls: "bg-white/8 text-[#c7c7cc]" },
  deteriorating: { label: "Deteriorating", cls: "bg-[#ffd60a]/12 text-[#ffd60a]" },
  weak: { label: "Weak", cls: "bg-[#ff453a]/12 text-[#ff453a]" },
  unclear: { label: "Unclear", cls: "bg-white/5 text-muted border border-hairline" },
};

export const IMPACT_DOT: Record<Impact, string> = {
  positive: "bg-gain",
  negative: "bg-loss",
  mixed: "bg-warn",
  neutral: "bg-[#8e8e93]",
};

export const DELTA_ARROW: Record<string, { ch: string; cls: string }> = {
  up: { ch: "▲", cls: "text-gain" },
  down: { ch: "▼", cls: "text-loss" },
  flat: { ch: "–", cls: "text-muted" },
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
