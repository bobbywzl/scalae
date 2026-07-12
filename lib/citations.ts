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

// ---------------------------------------------------------------------------
// Source independence: who controls the evidence? Display/statistics metadata
// ONLY — evidence weighting lives in the synthesis doctrine, and nothing here
// may bias readings or confidence.
// ---------------------------------------------------------------------------

export type SourceClass = "company" | "regulator" | "independent";

const REGULATOR_DOMAINS = ["sec.gov", "sedarplus.ca", "europa.eu", "hkexnews.hk", "fsa.go.jp", "fca.org.uk"];
const COMPANY_HOST_LABELS = new Set(["ir", "investor", "investors", "corporate"]);
const COMPANY_TITLE_RX =
  /investor relations|press release|earnings (call|release)|annual report|form (10-[kq]|20-f|6-k)/i;

/**
 * Conservative, pure heuristic classification off the resolved domain (never
 * the raw URL host — grounding returns redirect URLs): regulator filings,
 * company-controlled channels (IR sites, releases), or independent. Pass the
 * ticker's learned company domains (learnCompanyDomains) for exact matching —
 * then www.pddholdings.com press pages classify like ir.pddholdings.com.
 */
export function sourceClass(
  c: {
    url: string;
    title?: string;
    domain?: string;
  },
  companyDomains: string[] = []
): SourceClass {
  const domain = domainOf({ title: c.title ?? "", url: c.url, domain: c.domain }).toLowerCase();
  if (
    domain.endsWith(".gov") ||
    domain.includes(".gov.") ||
    REGULATOR_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))
  ) {
    return "regulator";
  }
  if (companyDomains.some((d) => domain === d || domain.endsWith("." + d))) return "company";
  if (COMPANY_HOST_LABELS.has(domain.split(".")[0])) return "company";
  if (COMPANY_TITLE_RX.test(c.title ?? "")) return "company";
  return "independent";
}

/**
 * Learn a ticker's company-controlled base domains from its own evidence:
 * every source whose host label marks it company (ir.pddholdings.com)
 * teaches the base domain (pddholdings.com), so sibling hosts classify
 * exactly without any stored configuration.
 */
export function learnCompanyDomains(
  sources: { url: string; title?: string; domain?: string }[]
): string[] {
  const out = new Set<string>();
  for (const s of sources) {
    const domain = domainOf({ title: s.title ?? "", url: s.url, domain: s.domain }).toLowerCase();
    const labels = domain.split(".");
    if (labels.length >= 3 && COMPANY_HOST_LABELS.has(labels[0])) {
      out.add(labels.slice(1).join("."));
    }
  }
  return [...out];
}

/** Short display text for a source class chip. */
export function sourceClassLabel(cls: SourceClass): string {
  return cls === "company" ? "company IR" : cls === "regulator" ? "regulator" : "independent";
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
