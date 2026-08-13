// Shared plumbing for the investor-corpus ingestion pipeline (playbook §4–§6).
// Used by fetch.ts (Stage 0) and verify.ts (Stage 4). Run with plain `node` (Node ≥22.18,
// native type stripping) — keep this file free of enums/namespaces/parameter properties.

import * as fs from "node:fs";
import * as path from "node:path";

export const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
export const CATALOG_DIR = path.join(REPO_ROOT, "docs", "investor-corpus");
export const CACHE_DIR = path.join(REPO_ROOT, "corpus-cache");
export const MANIFEST_PATH = path.join(CACHE_DIR, "manifest.json");
export const LEDGER_PATH = path.join(CATALOG_DIR, "LEDGER.md");
export const EXTRACTIONS_DIR = path.join(CATALOG_DIR, "extractions");

// ---------------------------------------------------------------------------
// Investors — Bobby's fixed priority order (playbook §5). Catalog file numbers
// do not match priority (03 = Schloss but priority 6, etc.).
// ---------------------------------------------------------------------------

export interface Investor {
  key: string;
  name: string;
  file: string;
  priority: number;
}

export const INVESTORS: Investor[] = [
  { key: "graham-dodd", name: "Benjamin Graham & David Dodd", file: "01-graham-dodd.md", priority: 1 },
  { key: "templeton", name: "John Templeton", file: "02-john-templeton.md", priority: 2 },
  { key: "lynch", name: "Peter Lynch", file: "04-peter-lynch.md", priority: 3 },
  { key: "klarman", name: "Seth Klarman", file: "05-seth-klarman.md", priority: 4 },
  { key: "li-lu", name: "Li Lu", file: "08-li-lu.md", priority: 5 },
  { key: "schloss", name: "Walter Schloss", file: "03-walter-schloss.md", priority: 6 },
  { key: "greenblatt", name: "Joel Greenblatt", file: "06-joel-greenblatt.md", priority: 7 },
  { key: "pabrai", name: "Mohnish Pabrai", file: "07-mohnish-pabrai.md", priority: 8 },
  { key: "shared-archives", name: "Shared archives", file: "09-shared-archives.md", priority: 9 },
];

// ---------------------------------------------------------------------------
// Catalog entries & manifest
// ---------------------------------------------------------------------------

export type Tier = 1 | 2 | 3 | "book";

export type Status =
  | "pending"      // known from catalog, not yet fetched
  | "fetched"      // cached with a usable text layer
  | "ocr-needed"   // cached, but image-only (no/thin text layer)
  | "blocked"      // fetch failed (bot-shield, 403/404, dead link, paywall hit)
  | "manual"       // never auto-fetched: book / [paywall] / borrow-only / video-ASR
  | "extracted"    // Stage 1 artifact exists
  | "verified"     // verify.ts passed for the extraction
  | "synthesized"; // entry landed in lib/agents/canon.ts

export const STATUS_RANK: Record<Status, number> = {
  pending: 0, blocked: 1, manual: 1, "ocr-needed": 1, fetched: 1,
  extracted: 2, verified: 3, synthesized: 4,
};

export interface CatalogEntry {
  slug: string;
  investor: string;      // Investor.key
  tier: Tier;
  title: string;
  url: string;           // canonical URL from the catalog ("—" for link-less book rows)
  fetchUrl?: string;     // when a verified mirror fetches where the canonical is gated
  tags: string[];        // paywall | unverified-fetch | zh | context
  note?: string;
  expand?: string;       // dynamic-expansion handler key (fetch.ts)
  manual?: string;       // reason this row is never auto-fetched
}

export interface ManifestEntry {
  slug: string;
  investor: string;
  tier: Tier;
  url: string;
  title: string;
  sha256: string | null;
  wordCount: number | null;
  fetchedAt: string | null;
  status: Status;
  note?: string;
  file?: string;         // cached raw file, relative to corpus-cache/
  textFile?: string;     // extracted text, relative to corpus-cache/
  parent?: string;       // slug of the catalog row this document was expanded from
}

export function loadManifest(): ManifestEntry[] {
  if (!fs.existsSync(MANIFEST_PATH)) return [];
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as ManifestEntry[];
}

export function saveManifest(entries: ManifestEntry[]): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’‘"“”&]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
}

// Titles that slugify to nothing/too little (Chinese originals) or that need a
// stable, human-scannable slug. Keyed by exact catalog URL.
const SLUG_OVERRIDES: Record<string, string> = {
  "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5f0936c4321954706fa9eca2_%E4%BB%B7%E5%80%BC%E6%8A%95%E8%B5%84%E5%9C%A8%E4%B8%AD%E5%9B%BD%E7%9A%84%E5%B1%95%E6%9C%9B-%E6%9D%8E%E5%BD%952015-10-23%E5%8C%97%E5%A4%A7%E6%BC%94%E8%AE%B2.pdf":
    "prospect-of-value-investing-in-china-zh",
  "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/67a4f8e8160103c8a74017a7_%E5%85%A8%E7%90%83%E4%BB%B7%E5%80%BC%E6%8A%95%E8%B5%84%E4%B8%8E%E6%97%B6%E4%BB%A32024%E5%B9%B412%E6%9C%88.pdf":
    "global-value-investing-in-our-era-zh",
  "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5f0936f9d3ce59738af03b4d_PCAF_Chinese_2011.pdf":
    "pca-foreword-zh",
  "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/656a90a8013607f02556e6bf_%E8%BF%BD%E5%BF%B5%E6%81%A9%E5%B8%88%E6%9F%A5%E7%90%86%E8%8A%92%E6%A0%BC.pdf":
    "remembering-charlie-munger-zh",
  "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5f0935ee7646e6ff74f6d311_%E6%9D%8E%E5%BD%95%E8%B0%88%E7%8E%B0%E4%BB%A3%E5%8C%96%20%EF%BC%88%E5%85%A8%E6%96%87%EF%BC%89%E5%A4%A7%E5%AD%97%E5%8F%B7.pdf":
    "discussion-of-modernization-zh",
  "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5f0934f93967fc62fa42c844_%E6%9D%8E%E5%BD%95%E8%B0%88%E7%8E%B0%E4%BB%A3%E5%8C%96-%E4%BB%8E%E4%BA%BA%E7%B1%BB%E6%96%87%E6%98%8E%E5%8F%B2%E8%A7%92%E5%BA%A6%E7%9C%8B%E5%BD%93%E4%BB%8A%E4%B8%AD%E7%BE%8E%E5%85%B3%E7%B3%BB%E8%B5%B0%E5%90%91.pdf":
    "sino-us-relations-zh",
  "https://cdn.prod.website-files.com/5ef3c7300432b40ed865991a/5f09347783851614276c3fdb_%E6%9D%8E%E5%BD%952019%E5%B9%B4%E5%B9%B4%E5%BA%A6%E4%B9%A6%E8%AF%84%202019.11.19.pdf":
    "annual-book-review-2019-koo-zh",
  "https://www.himcap.com/cn/publications": "himcap-publications-zh-hub",
};

// ---------------------------------------------------------------------------
// Fetch-behavior overrides, keyed by slug (computed after slugging).
//  - fetchUrl: canonical URL is member-gated/dead but a catalog-verified mirror fetches
//  - expand:   dynamic hub expansion handled in fetch.ts
//  - series:   static multi-file series expanded at parse time
// ---------------------------------------------------------------------------

interface SeriesSpec { slugBase: string; titleBase: string; urls: [string, string][] }

function grahamLectureSeries(): SeriesSpec {
  const base = "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture";
  const urls: [string, string][] = [];
  for (let i = 1; i <= 10; i++) {
    urls.push([`lecture-${String(i).padStart(2, "0")}`, `${base}${i}.pdf`]);
  }
  return { slugBase: "graham-lectures-1946-47", titleBase: "Current Problems in Security Analysis — Lecture", urls };
}

function grahamNewmanSeries(): SeriesSpec {
  const urls: [string, string][] = [];
  for (let y = 1946; y <= 1958; y++) {
    urls.push([`${y}`, `https://business.columbia.edu/sites/default/files-efs/imce-uploads/${y}.PDF`]);
  }
  return { slugBase: "graham-newman-letter", titleBase: "Graham-Newman Corp. letter to stockholders,", urls };
}

// Keyed by exact catalog URL — slugs are derived and truncation-prone.
const STATIC_SERIES: Record<string, SeriesSpec> = {
  "https://business.columbia.edu/sites/default/files-efs/imce-uploads/Graham_Sept1946Feb1947_CurrentProblemsinSecurityAnalysis_Lecture1.pdf":
    grahamLectureSeries(),
  "https://business.columbia.edu/sites/default/files-efs/imce-uploads/1953.PDF":
    grahamNewmanSeries(),
};

const FETCH_URL_OVERRIDES: Record<string, string> = {
  // FAJ 2010 Klarman Q&A: CFA page is member-gated; catalog-verified free mirror.
  "https://rpc.cfainstitute.org/research/financial-analysts-journal/2010/opportunities-for-patient-investors":
    "http://www.safalniveshak.com/wp-content/uploads/2012/09/Seth-Klarman-Interview-Financial-Analyst-Journal.pdf",
};

const DYNAMIC_EXPANSIONS: Record<string, string> = {
  // Wayback master index of the ~46 Worth columns → one document per column.
  "https://web.archive.org/web/20000815201628/http://www.worth.com/articles/PL0.html": "worth-columns",
  // Wayback capture of the defunct memorial site's letters category → ~10 letter posts.
  "https://web.archive.org/web/20191207125622/https://sirjohntempleton.org/category/templeton-letters/": "templeton-letters",
  // EDGAR: all Baupost Fund N-30D filings 1996–2001, not just the cataloged FY1999 one.
  "https://www.sec.gov/Archives/edgar/data/865827/0001072613-99-000307.txt": "baupost-n30d",
};

// Hosts that are video/audio platforms — no text to fetch; needs ASR or a bought
// transcript dropped into the cache by hand.
const MEDIA_HOSTS = ["youtube.com", "youtu.be", "podcasts.apple.com", "soundcloud.com", "vimeo.com", "valueinvestingwithlegends.libsyn.com", "capitalallocators.com"];

function manualReason(entry: { tier: Tier; url: string; tags: string[] }): string | undefined {
  if (entry.tier === "book") return "book — purchase/borrow by hand (playbook §4)";
  if (entry.tags.includes("paywall")) return "[paywall] — drop purchased text into corpus-cache/ by hand";
  let host = "";
  try { host = new URL(entry.url).hostname.replace(/^www\./, ""); } catch { /* link-less book rows */ }
  if (MEDIA_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
    return "video/audio — needs ASR or an official transcript";
  }
  if (host === "books.google.com") return "Google Books free ebook — download EPUB/PDF by hand";
  return undefined;
}

// ---------------------------------------------------------------------------
// Catalog parser. Entry format (00-INDEX.md "How entries work"):
//   - **[Exact Title](URL)** — Year · Format · Host — annotation [tags]
// Books sections also use `- **Title** (…)` / `- *Title* (…)` with an access
// link somewhere in the line. Sub-bullets (Lynch's per-column list) attach to
// the preceding entry as a note, never as their own row.
// ---------------------------------------------------------------------------

const TAG_RE = /\[(paywall|unverified-fetch|zh|context)\]/g;

export function parseCatalog(investor: Investor, seen: Set<string> = new Set()): CatalogEntry[] {
  const file = path.join(CATALOG_DIR, investor.file);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const entries: CatalogEntry[] = [];
  let tier: Tier | null = null;

  const uniqueSlug = (s: string): string => {
    let out = s || "untitled";
    let n = 2;
    while (seen.has(out)) out = `${s}-${n++}`;
    seen.add(out);
    return out;
  };

  for (const line of lines) {
    const h = line.match(/^## +(.*)/);
    if (h) {
      const t = h[1];
      if (/^Tier 1\b/.test(t)) tier = 1;
      else if (/^Tier 2\b/.test(t)) tier = 2;
      else if (/^Tier 3\b/.test(t)) tier = 3;
      else if (/^Books\b/.test(t)) tier = "book";
      else tier = null;
      continue;
    }
    if (tier === null) continue;

    if (/^\s+- /.test(line) && entries.length > 0) {
      // continuation sub-bullet (e.g. the Worth column list) — annotate parent
      const parent = entries[entries.length - 1];
      parent.note = ((parent.note ?? "") + " " + line.trim().replace(/^- /, "")).trim().slice(0, 500);
      continue;
    }
    if (!/^- /.test(line)) continue;

    let title = "";
    let url = "";
    // lazy title match so bracketed suffixes like “… [zh]” survive inside the link text
    const linked = line.match(/^- \*\*\[(.+?)\]\((https?:\/\/[^)\s]+)\)\*\*/);
    if (linked) {
      title = linked[1];
      url = linked[2];
    } else {
      const bold = line.match(/^- \*\*([^*]+)\*\*/);
      const ital = line.match(/^- \*([^*]+)\*/);
      title = (bold?.[1] ?? ital?.[1] ?? "").trim();
      if (!title) continue;
      const firstLink = line.match(/\[[^\]]*\]\((https?:\/\/\S+?)\)/);
      url = firstLink?.[1] ?? "—";
    }
    title = title.replace(/\s+/g, " ").trim();

    // tags inside parentheses annotate secondary/fallback links (e.g. “(Official
    // abstract: [T&F DOI](…) [paywall])”), not the primary URL — strip before scanning.
    // Iterate because markdown link targets are themselves parenthesized.
    let tagScanText = line;
    for (let prev = ""; prev !== tagScanText;) {
      prev = tagScanText;
      tagScanText = tagScanText.replace(/\([^()]*\)/g, " ");
    }
    const tags = [...tagScanText.matchAll(TAG_RE)].map((m) => m[1]);
    const rawSlug = SLUG_OVERRIDES[url] ??
      (slugify(title.replace(/\s*\[zh\]\s*$/, "")) ||
        slugify(path.basename(new URL(url, "https://x.invalid").pathname || "untitled")));

    // static series expand to one row per file
    const series = STATIC_SERIES[url];
    if (series && tier !== "book") {
      for (const [suffix, u] of series.urls) {
        entries.push({
          slug: uniqueSlug(`${series.slugBase}-${suffix}`),
          investor: investor.key,
          tier, title: `${series.titleBase} ${suffix.replace(/^lecture-0?/, "")}`.trim(),
          url: u, tags: [...tags],
          note: `part of series “${title}”`,
        });
      }
      continue;
    }

    const slug = uniqueSlug(rawSlug);
    const entry: CatalogEntry = { slug, investor: investor.key, tier, title, url, tags };
    if (FETCH_URL_OVERRIDES[url]) entry.fetchUrl = FETCH_URL_OVERRIDES[url];
    if (DYNAMIC_EXPANSIONS[url]) entry.expand = DYNAMIC_EXPANSIONS[url];
    const manual = manualReason(entry);
    if (manual) entry.manual = manual;
    entries.push(entry);
  }
  return entries;
}

export function parseAllCatalogs(): { entries: CatalogEntry[]; missing: Investor[] } {
  const entries: CatalogEntry[] = [];
  const missing: Investor[] = [];
  const seen = new Set<string>();
  for (const inv of INVESTORS) {
    if (!fs.existsSync(path.join(CATALOG_DIR, inv.file))) {
      missing.push(inv);
      continue;
    }
    entries.push(...parseCatalog(inv, seen));
  }
  return { entries, missing };
}

// ---------------------------------------------------------------------------
// Quote matching (§6.3): whitespace-normalize, unify quote/dash glyphs, then
// substring-match. A second pass matches with PDF line-break hyphenation undone.
// ---------------------------------------------------------------------------

export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‚′`´]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[­​‎‏﻿]/g, "")
    .replace(/ /g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteMatches(quote: string, sourceTextNormalized: string, sourceDehyphenated: string): boolean {
  const q = normalizeForMatch(quote);
  if (!q) return false;
  if (sourceTextNormalized.includes(q)) return true;
  const qNoHyphen = q.replace(/[- ]/g, "");
  return sourceDehyphenated.includes(qNoHyphen);
}

/** Squash-everything variant for hyphen/linebreak-mangled scans: strip hyphens AND spaces. */
export function squashForMatch(s: string): string {
  return normalizeForMatch(s).replace(/[- ]/g, "");
}

export function countWords(s: string): number {
  const m = s.match(/\S+/g);
  return m ? m.length : 0;
}
