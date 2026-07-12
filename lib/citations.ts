import type { Citation } from "./types";

/**
 * Source-provenance helpers. Gemini grounding returns redirect URLs
 * (vertexaisearch.cloud.google.com/…) whose `title` is usually the real
 * source domain — so the title, not the URL host, is the best domain signal.
 */

const DOMAIN_RX = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const REDIRECT_HOSTS = new Set(["vertexaisearch.cloud.google.com"]);

/** Best-effort source domain for display ("investing.com"). */
export function domainOf(c: Citation): string {
  if (c.domain) return c.domain;
  const title = (c.title ?? "").trim();
  if (DOMAIN_RX.test(title)) return title.toLowerCase().replace(/^www\./, "");
  try {
    const host = new URL(c.url).hostname.replace(/^www\./, "");
    if (REDIRECT_HOSTS.has(host)) return title || "source";
    return host;
  } catch {
    return title || "source";
  }
}

/** Annotate a citation with its resolved domain (stored so old rows still render). */
export function withDomain(c: Citation): Citation {
  return { ...c, domain: domainOf(c) };
}

/**
 * Display label for a source chip: the domain, plus enough of the title to
 * tell same-domain siblings apart (an evidence trail citing three SEC filings
 * needs more than "sec.gov ×3" to be auditable).
 */
export function chipLabel(c: Citation, siblings: Citation[]): string {
  const domain = domainOf(c);
  const dupes = siblings.filter((s) => domainOf(s) === domain).length;
  if (dupes <= 1) return domain;
  const title = (c.title ?? "").trim();
  if (!title || DOMAIN_RX.test(title)) return domain;
  const short = title.length > 42 ? title.slice(0, 40).trimEnd() + "…" : title;
  return `${domain} · ${short}`;
}

/**
 * Resolve a dossier's [[sig:<id>]] signal markers into markdown links
 * ("[Name](#sig:<id>)") the Markdown component renders as inline clickable
 * chips. Unresolvable ids drop; legacy dossiers pass through untouched.
 */
export function dossierToMarkdown(md: string, resolveName: (id: string) => string | null): string {
  return md.replace(/\s?\[\[sig:([\w-]+)\]\]/g, (_m, id: string) => {
    const name = resolveName(id);
    return name ? ` [${name.replace(/[[\]]/g, "")}](#sig:${id})` : "";
  });
}

/**
 * Resolve bracketed citation indexes in analyst markdown ("…program [37][40].")
 * into clickable links against the run's numbered source list. Unresolvable
 * indexes are left as-is; already-linked text (e.g. "[12](http…)") is skipped.
 */
export function linkCitations(md: string, sources: Citation[] | undefined): string {
  if (!md || !sources || sources.length === 0) return md;
  return md.replace(/\[(\d{1,3})\](?!\()/g, (match, nStr: string) => {
    const n = Number(nStr);
    const src = sources[n];
    if (!src?.url) return match;
    // Link text keeps the bracket style; angle-bracket destination survives odd URLs.
    return `[[${n}]](<${src.url}> "${(src.title ?? domainOf(src)).replace(/"/g, "'")}")`;
  });
}
