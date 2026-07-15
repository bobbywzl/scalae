import { chat } from "./dict/chat";
import { common } from "./dict/common";
import { compare } from "./dict/compare";
import { desk } from "./dict/desk";
import { financials } from "./dict/financials";
import { notes } from "./dict/notes";
import { onboarding } from "./dict/onboarding";
import { portfolio } from "./dict/portfolio";
import { settings } from "./dict/settings";
import { signals } from "./dict/signals";
import { support } from "./dict/support";
import { trade } from "./dict/trade";
import { watchlist } from "./dict/watchlist";
import type { Lang } from "./config";

/**
 * UI string catalog. Each namespace file exports { en, zh } with identical
 * keys (enforced by `zh: Record<keyof typeof en, string>` in every file), so
 * a key can never exist in one language only. `t("namespace.key")` is fully
 * typed — a typo'd key is a compile error, and English is the fallback if a
 * lookup ever misses at runtime.
 */
const NAMESPACES = {
  common,
  watchlist,
  settings,
  desk,
  financials,
  notes,
  signals,
  chat,
  portfolio,
  trade,
  compare,
  onboarding,
  support,
} as const;

type Namespaces = typeof NAMESPACES;

/** "namespace.key" union across every dictionary. */
export type TKey = {
  [N in keyof Namespaces & string]: `${N}.${keyof Namespaces[N]["en"] & string}`;
}[keyof Namespaces & string];

export type TParams = Record<string, string | number>;
export type TFunc = (key: TKey, params?: TParams) => string;

function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
}

export function translate(lang: Lang, key: TKey, params?: TParams): string {
  const dot = key.indexOf(".");
  const ns = key.slice(0, dot) as keyof Namespaces;
  const k = key.slice(dot + 1);
  const table = NAMESPACES[ns] as { en: Record<string, string>; zh: Record<string, string> } | undefined;
  const s = table?.[lang]?.[k] ?? table?.en?.[k] ?? key;
  return interpolate(s, params);
}

/** Bind a language once (server code paths where hooks don't exist). */
export function translatorFor(lang: Lang): TFunc {
  return (key, params) => translate(lang, key, params);
}
