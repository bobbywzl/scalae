import type { TFunc } from "@/lib/i18n/dictionaries";
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

/** ISO date string `days` ago (UTC). */
export function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from now until an ISO date (negative = past). */
export function daysUntil(iso: string): number {
  return Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
}

/** Relative time; pass t (from useT) for the display language. */
export function timeAgo(iso: string | null | undefined, t?: TFunc): string {
  if (!iso) return t ? t("common.never") : "never";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return t ? t("common.justNow") : "just now";
  if (s < 3600) {
    const n = Math.floor(s / 60);
    return t ? t("common.minutesAgo", { n }) : `${n}m ago`;
  }
  if (s < 86400) {
    const n = Math.floor(s / 3600);
    return t ? t("common.hoursAgo", { n }) : `${n}h ago`;
  }
  const n = Math.floor(s / 86400);
  return t ? t("common.daysAgo", { n }) : `${n}d ago`;
}

/** Chip styling per reading level; label via levelLabel() for the UI language. */
export const LEVEL_STYLE: Record<ReadingLevel, { label: string; cls: string }> = {
  strong: { label: "Strong", cls: "bg-[#30d158]/15 text-[#30d158]" },
  improving: { label: "Improving", cls: "bg-[#30d158]/10 text-[#7ee2a8]" },
  neutral: { label: "Neutral", cls: "bg-ink/8 text-emph" },
  deteriorating: { label: "Deteriorating", cls: "bg-[#ffd60a]/12 text-[#ffd60a]" },
  weak: { label: "Weak", cls: "bg-[#ff453a]/12 text-[#ff453a]" },
  unclear: { label: "Unclear", cls: "bg-ink/5 text-muted border border-hairline" },
};

export function levelLabel(level: ReadingLevel, t: TFunc): string {
  return t(`common.level_${level}`);
}

export function impactLabel(impact: Impact, t: TFunc): string {
  return t(`common.impact_${impact}`);
}

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

/**
 * Server error phrases are canonical English constants; map the known ones to
 * the UI language (raw message passes through for anything unrecognized).
 */
const ERROR_PATTERNS: { rx: RegExp; key: Parameters<TFunc>[0]; params?: (m: RegExpMatchArray) => Record<string, string> }[] = [
  { rx: /^Could not find "(.+)" on the public market\.$/, key: "common.errSymbolNotFound", params: (m) => ({ sym: m[1] }) },
  { rx: /^Approve at least one signal before running research\.$/, key: "common.errApproveFirst" },
  { rx: /overloaded/i, key: "common.errOverloaded" },
  { rx: /rate limit/i, key: "common.errRateLimited" },
  { rx: /dropped mid-response/i, key: "common.errConnectionDropped" },
  { rx: /^Sign in to continue\.$/, key: "common.errSignIn" },
  { rx: /^Request failed \((\d+)\)$/, key: "common.errRequestFailed", params: (m) => ({ code: m[1] }) },
  { rx: /^The comparison failed — try again\.$/, key: "common.errComparisonFailed" },
  { rx: /^History research failed — try again\.$/, key: "common.errHistoryFailed" },
  { rx: /^Run interrupted \(server restarted mid-run\)\. Start it again\.$/, key: "common.errRunInterrupted" },
  { rx: /exceeded its \d+s time limit$/, key: "common.errAnalystTimeout" },
  { rx: /^Open at least one section before synthesizing\.$/, key: "dd.errNeedSection" },
  { rx: /^Research is already running on this section\.$/, key: "dd.errResearchRunning" },
  { rx: /^Research is already running on this ticker\.$/, key: "desk.errRunning" },
  { rx: /^A moderation pass is already running on this ticker\.$/, key: "financials.errPassRunning" },
  { rx: /^Pass interrupted \(server restarted mid-pass\)\. Run it again\.$/, key: "financials.errPassInterrupted" },
  { rx: /^This adjustment already moved on — reload to see its current state\.$/, key: "financials.errAdjStale" },
  { rx: /^Financials are unavailable for this ticker\.$/, key: "financials.unavailable" },
  { rx: /^Pick a category for the request\.$/, key: "common.errPickCategory" },
  { rx: /^Give the request a short subject\.$/, key: "common.errNeedSubject" },
  { rx: /^Describe the issue or idea\.$/, key: "common.errNeedDescription" },
  { rx: /filed quite a few requests today/, key: "common.errTooManyTickets" },
];

export function localizeError(msg: string | null | undefined, t: TFunc): string {
  if (!msg) return "";
  for (const { rx, key, params } of ERROR_PATTERNS) {
    const m = msg.match(rx);
    if (m) return t(key, params?.(m));
  }
  return msg;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
