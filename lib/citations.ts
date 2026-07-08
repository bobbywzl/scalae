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
