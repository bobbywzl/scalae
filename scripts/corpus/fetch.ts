// Stage 0 of the corpus compile (playbook §4): download every cataloged Tier 1 + Tier 2
// document to corpus-cache/<investor>/<slug>.*, extract text to <slug>.txt, and write
// corpus-cache/manifest.json. Also generates docs/investor-corpus/LEDGER.md (§5).
//
//   node scripts/corpus/fetch.ts                 # fetch tiers 1+2, then refresh ledger
//   node scripts/corpus/fetch.ts --tier 1        # fetch tier 1 only
//   node scripts/corpus/fetch.ts --investor lynch --tier 1
//   node scripts/corpus/fetch.ts --ledger        # (re)generate LEDGER.md only, no network
//   node scripts/corpus/fetch.ts --force         # refetch even when cached
//
// Statuses written here: fetched | ocr-needed | blocked | manual (playbook §4 stage 0).
// Later stages advance rows to extracted / verified / synthesized via verify.ts + LEDGER.md.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  CACHE_DIR, CATALOG_DIR, LEDGER_PATH, EXTRACTIONS_DIR, INVESTORS, STATUS_RANK,
  parseAllCatalogs, loadManifest, saveManifest, countWords, slugify,
} from "./lib.ts";
import type { CatalogEntry, Investor, ManifestEntry, Status, Tier } from "./lib.ts";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SEC_UA = "scalae-corpus-fetch/0.1 (research cache; contact robertwzl311@gmail.com)";

const MIN_PDF_WORDS = 150; // below this a PDF is an image-only scan → ocr-needed
const MIN_PAGE_WORDS = 60; // below this an HTML page is a bot-shell/interstitial → blocked
const MAX_OCR_PAGES = 40;  // auto-OCR cap; larger scans stay ocr-needed for a manual pass

/** CJK text has no space-delimited words — count ideographs so Chinese PDFs
 *  aren't misread as image-only scans. Thresholds only; manifest wordCount
 *  stays the plain whitespace-token count that verify.ts recomputes. */
function effectiveWords(s: string): number {
  const cjk = (s.match(/[㐀-鿿]/g) ?? []).length;
  return countWords(s) + Math.floor(cjk / 2);
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Args {
  tiers: Tier[];
  investors: string[] | null;
  ledgerOnly: boolean;
  force: boolean;
  limit: number;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { tiers: [1, 2], investors: null, ledgerOnly: false, force: false, limit: Infinity, concurrency: 4 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--tier") a.tiers = argv[++i].split(",").map((t) => (t === "book" ? "book" : Number(t))) as Tier[];
    else if (v === "--investor") a.investors = argv[++i].split(",");
    else if (v === "--ledger") a.ledgerOnly = true;
    else if (v === "--force") a.force = true;
    else if (v === "--limit") a.limit = Number(argv[++i]);
    else if (v === "--concurrency") a.concurrency = Number(argv[++i]);
    else { console.error(`unknown arg: ${v}`); process.exit(2); }
  }
  return a;
}

// ---------------------------------------------------------------------------
// HTTP via curl (respects HTTPS_PROXY + the environment CA bundle); falls back
// to global fetch when curl is unavailable.
// ---------------------------------------------------------------------------

const HAVE_CURL = spawnSync("curl", ["--version"], { stdio: "ignore" }).status === 0;
const HAVE_TESSERACT = spawnSync("tesseract", ["--version"], { stdio: "ignore" }).status === 0;

interface HttpResult { ok: boolean; http: number; contentType: string; err?: string }

function uaFor(url: string): string {
  const host = new URL(url).hostname;
  return host.endsWith("sec.gov") ? SEC_UA : BROWSER_UA;
}

const hostNextSlot = new Map<string, number>();
function hostGap(host: string): number {
  if (host.endsWith("archive.org")) return 1500;
  return 400;
}
async function politeWait(url: string): Promise<void> {
  const host = new URL(url).hostname;
  const now = Date.now();
  const slot = Math.max(hostNextSlot.get(host) ?? 0, now);
  hostNextSlot.set(host, slot + hostGap(host));
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

async function httpGet(url: string, dest: string): Promise<HttpResult> {
  await politeWait(url);
  if (HAVE_CURL) {
    const r = spawnSync("curl", [
      "-sS", "-L", "--compressed",
      "--max-time", "120", "--connect-timeout", "25", "--retry", "1", "--retry-delay", "2",
      "-A", uaFor(url),
      "-o", dest,
      "-w", "%{http_code}\t%{content_type}",
      url,
    ], { encoding: "utf8", maxBuffer: 1024 * 1024 });
    if (r.status !== 0) {
      return { ok: false, http: 0, contentType: "", err: `curl exit ${r.status}: ${(r.stderr || "").trim().slice(0, 160)}` };
    }
    const [codeStr, ctype = ""] = (r.stdout || "").trim().split("\t");
    const http = Number(codeStr) || 0;
    return { ok: http >= 200 && http < 300, http, contentType: ctype };
  }
  try {
    const res = await fetch(url, { headers: { "user-agent": uaFor(url) }, redirect: "follow", signal: AbortSignal.timeout(120_000) });
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return { ok: res.ok, http: res.status, contentType: res.headers.get("content-type") ?? "" };
  } catch (e) {
    return { ok: false, http: 0, contentType: "", err: String(e).slice(0, 160) };
  }
}

async function httpGetText(url: string): Promise<{ res: HttpResult; body: string }> {
  const tmp = path.join(CACHE_DIR, `.tmp-${crypto.randomBytes(6).toString("hex")}`);
  try {
    const res = await httpGet(url, tmp);
    const body = fs.existsSync(tmp) ? decodeBuffer(fs.readFileSync(tmp), res.contentType) : "";
    return { res, body };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

function decodeBuffer(buf: Buffer, contentType: string): string {
  let label = /charset=([\w-]+)/i.exec(contentType)?.[1];
  if (!label) {
    const head = buf.subarray(0, 2048).toString("latin1");
    label = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  const tryDecode = (l: string): string | null => {
    try { return new TextDecoder(l).decode(buf); } catch { return null; }
  };
  let text = tryDecode(label ?? "utf-8") ?? tryDecode("utf-8")!;
  if ((!label || /utf-?8/i.test(label))) {
    const bad = (text.match(/�/g) ?? []).length;
    if (bad > 8 && bad / text.length > 0.001) text = tryDecode("windows-1252") ?? text;
  }
  return text;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  eacute: "é", amp_: "&", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•", sect: "§",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}
function safeChar(cp: number): string {
  try { return String.fromCodePoint(cp); } catch { return " "; }
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--\s*BEGIN WAYBACK TOOLBAR INSERT[\s\S]*?END WAYBACK TOOLBAR INSERT\s*-->/gi, " ")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/td|\/blockquote|\/pre|\/title)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const decoded = decodeEntities(stripped);
  return decoded
    .split("\n")
    .map((l) => l.replace(/[ \t\r ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pdfToText(pdfPath: string, txtPath: string): { ok: boolean; err?: string } {
  const r = spawnSync("pdftotext", ["-q", "-enc", "UTF-8", pdfPath, txtPath], { encoding: "utf8" });
  if (r.error) return { ok: false, err: "pdftotext not installed" };
  if (r.status !== 0) return { ok: false, err: `pdftotext exit ${r.status}` };
  return { ok: true };
}

function pdfPageCount(pdfPath: string): number | null {
  const r = spawnSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const m = /^Pages:\s+(\d+)/m.exec(r.stdout ?? "");
  return m ? Number(m[1]) : null;
}

/** Rasterize + tesseract for image-only scans (playbook §4: “OCR via tesseract where
 *  the catalog's ingestion notes flag image-only scans”). English models only — [zh]
 *  scans stay ocr-needed for a language-aware pass. */
function ocrPdf(pdfPath: string): string | null {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-ocr-"));
  try {
    const r = spawnSync("pdftoppm", ["-r", "300", "-gray", "-png", pdfPath, path.join(tmpDir, "pg")],
      { timeout: 300_000 });
    if (r.status !== 0) return null;
    const pages = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".png")).sort();
    let out = "";
    for (const p of pages) {
      const t = spawnSync("tesseract", [path.join(tmpDir, p), "stdout", "--psm", "3"],
        { encoding: "utf8", timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
      if (t.status === 0) out += t.stdout + "\n";
    }
    return out.trim() || null;
  } catch {
    return null;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Shared PDF pipeline: pdftotext, then a tesseract fallback for image-only scans. */
function extractPdf(m: ManifestEntry, pdfPath: string, txtPath: string): void {
  m.sha256 = sha256(pdfPath);
  m.file = rel(pdfPath);
  const x = pdfToText(pdfPath, txtPath);
  const layerText = x.ok && fs.existsSync(txtPath) ? fs.readFileSync(txtPath, "utf8") : "";
  const layerEff = effectiveWords(layerText);
  if (layerEff >= MIN_PDF_WORDS) {
    m.wordCount = countWords(layerText);
    m.textFile = rel(txtPath);
    m.status = "fetched";
    m.note = undefined;
    return;
  }
  if (HAVE_TESSERACT) {
    const pages = pdfPageCount(pdfPath);
    if (pages !== null && pages > MAX_OCR_PAGES) {
      m.status = "ocr-needed";
      m.note = `image-only scan, ${pages} pp. — beyond auto-OCR cap of ${MAX_OCR_PAGES}`;
      return;
    }
    const ocr = ocrPdf(pdfPath);
    if (ocr && effectiveWords(ocr) > Math.max(layerEff, 100)) {
      fs.writeFileSync(txtPath, ocr + "\n");
      m.wordCount = countWords(ocr);
      m.textFile = rel(txtPath);
      m.status = "fetched";
      m.note = "no text layer — OCR via tesseract; expect scan artifacts";
      return;
    }
  }
  m.status = "ocr-needed";
  m.note = x.ok
    ? `image-only scan (${countWords(layerText)} words in text layer${HAVE_TESSERACT ? "; OCR attempt yielded too little" : ""})`
    : `PDF cached; text extraction failed (${x.err})`;
  if (layerText && x.ok) {
    m.wordCount = countWords(layerText);
    m.textFile = rel(txtPath);
  }
}

function sha256(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// ---------------------------------------------------------------------------
// Single-document fetch
// ---------------------------------------------------------------------------

function cachePaths(entry: { investor: string; slug: string }): { dir: string; base: string } {
  const dir = path.join(CACHE_DIR, entry.investor);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, base: path.join(dir, entry.slug) };
}

function rel(p: string): string { return path.relative(CACHE_DIR, p); }

async function fetchDocument(m: ManifestEntry, fetchUrl?: string, isFallback = false): Promise<void> {
  const url = fetchUrl ?? m.url;
  m.fetchedAt = new Date().toISOString();
  const { base } = cachePaths(m);

  // OCR retry: an ocr-needed PDF is already cached — reprocess it, no re-download
  if (!isFallback && !fetchUrl && m.status === "ocr-needed" && m.file?.endsWith(".pdf")) {
    const cached = path.join(CACHE_DIR, m.file);
    if (fs.existsSync(cached)) {
      extractPdf(m, cached, `${base}.txt`);
      return;
    }
  }

  // archive.org /details/ pages: check lending status via the metadata API
  const iaMatch = /^https?:\/\/archive\.org\/details\/([^/?#]+)/.exec(url);
  if (iaMatch) return fetchArchiveOrgItem(m, iaMatch[1]);

  const rawTmp = `${base}.download`;
  const res = await httpGet(url, rawTmp);
  if (!res.ok) {
    fs.rmSync(rawTmp, { force: true });
    m.status = "blocked";
    m.note = res.err ? `fetch error: ${res.err}` : `HTTP ${res.http}`;
    if (!isFallback) await tryWaybackFallback(m, url);
    return;
  }

  const buf = fs.readFileSync(rawTmp);
  const isPdf = buf.subarray(0, 5).toString("latin1").startsWith("%PDF");
  if (isPdf) {
    const pdfPath = `${base}.pdf`;
    fs.renameSync(rawTmp, pdfPath);
    extractPdf(m, pdfPath, `${base}.txt`);
    return;
  }

  // HTML or plain text (EDGAR .txt is SGML-ish; tag-strip is safe for both)
  const text = decodeBuffer(buf, res.contentType);
  const looksHtml = /html/i.test(res.contentType) || /^\s*<(!doctype|html|head|body)/i.test(text);
  const rawPath = looksHtml ? `${base}.html` : `${base}.raw.txt`;
  fs.renameSync(rawTmp, rawPath);
  m.sha256 = sha256(rawPath);
  m.file = rel(rawPath);
  const extracted = htmlToText(text);
  const txtPath = `${base}.txt`;
  fs.writeFileSync(txtPath, extracted + "\n");
  const words = countWords(extracted);
  m.wordCount = words;
  m.textFile = rel(txtPath);
  if (effectiveWords(extracted) < MIN_PAGE_WORDS) {
    m.status = "blocked";
    m.note = `page fetched but near-empty (${words} words) — bot shell or JS-rendered`;
    if (!isFallback) await tryWaybackFallback(m, url);
  } else {
    m.status = "fetched";
    m.note = isFallback ? m.note : undefined;
  }
}

/** The index file names the Wayback Machine as the standing fallback for link rot and
 *  bot-shielded hosts — on a blocked fetch, try the closest snapshot of the original URL. */
async function tryWaybackFallback(m: ManifestEntry, failedUrl: string): Promise<void> {
  const failureNote = m.note;
  const wb = /^https?:\/\/web\.archive\.org\/web\/(\d+)[a-z_]*\/(.+)$/i.exec(failedUrl);
  if (!wb && /(^|\.)archive\.org$/i.test(new URL(failedUrl).hostname)) return; // non-/web/ archive.org URL — nothing to fall back to
  const original = wb ? wb[2] : failedUrl;
  const tsHint = wb ? wb[1].slice(0, 8) : "2026";
  const { res, body } = await httpGetText(
    `https://archive.org/wayback/available?url=${encodeURIComponent(original)}&timestamp=${tsHint}`);
  if (!res.ok || !body) return;
  let closest: { available?: boolean; url?: string; timestamp?: string } | undefined;
  try { closest = JSON.parse(body)?.archived_snapshots?.closest; } catch { return; }
  if (!closest?.available || !closest.url) return;
  const snapUrl = closest.url.replace(/^http:/, "https:");
  if (snapUrl === failedUrl) return;
  await fetchDocument(m, snapUrl, true);
  if (m.status === "fetched" || m.status === "ocr-needed") {
    m.note = `${m.note ? m.note + "; " : ""}via Wayback snapshot ${closest.timestamp ?? ""}`.trim();
  } else {
    m.status = "blocked";
    m.note = `${failureNote}; Wayback snapshot ${closest.timestamp ?? ""} also unusable`;
  }
}

async function fetchArchiveOrgItem(m: ManifestEntry, id: string): Promise<void> {
  const { body, res } = await httpGetText(`https://archive.org/metadata/${id}`);
  if (!res.ok || !body) {
    m.status = "blocked";
    m.note = `archive.org metadata unavailable (HTTP ${res.http})`;
    return;
  }
  let meta: { is_dark?: boolean; metadata?: Record<string, unknown>; files?: { name: string; format?: string }[] };
  try { meta = JSON.parse(body); } catch {
    m.status = "blocked"; m.note = "archive.org metadata parse failure"; return;
  }
  const collections = ([] as string[]).concat((meta.metadata?.collection as string[] | string) ?? []);
  const restricted = meta.is_dark === true ||
    String(meta.metadata?.["access-restricted-item"]) === "true" ||
    collections.some((c) => ["inlibrary", "lendinglibrary", "printdisabled"].includes(c));
  if (restricted) {
    m.status = "manual";
    m.note = "archive.org controlled lending (borrow-only) — no bulk text; borrow/purchase by hand";
    return;
  }
  const files = meta.files ?? [];
  const djvu = files.find((f) => f.name.endsWith("_djvu.txt"));
  const pdf = files.find((f) => f.format === "Text PDF") ?? files.find((f) => f.name.toLowerCase().endsWith(".pdf"));
  const pick = djvu ?? pdf;
  if (!pick) {
    m.status = "blocked";
    m.note = "archive.org item has no downloadable text/PDF file";
    return;
  }
  await fetchDocument(m, `https://archive.org/download/${id}/${encodeURIComponent(pick.name).replace(/%2F/g, "/")}`);
}

// ---------------------------------------------------------------------------
// Dynamic expansions (playbook catalogs point at hubs; documents live behind them)
// ---------------------------------------------------------------------------

interface ChildSpec { slug: string; title: string; url: string }

function anchorPairs(html: string): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    out.push({ href: match[1], text: htmlToText(match[2]).replace(/\s+/g, " ").trim() });
  }
  return out;
}

/** Resolve an href against its page (1990s captures use relative links, which Wayback
 *  leaves relative) and force the https://web.archive.org origin. */
function resolveWayback(href: string, pageUrl: string): string | null {
  try {
    const u = new URL(href, pageUrl);
    if (!/(^|\.)web\.archive\.org$/i.test(u.hostname)) return null;
    return `https://web.archive.org${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

/** ~46 Worth columns behind the Wayback capture of worth.com's PL0.html index. */
async function expandWorthColumns(parent: ManifestEntry): Promise<ChildSpec[]> {
  const seenPages = new Set<string>();
  const columns = new Map<string, ChildSpec>();
  const queue: string[] = [parent.url];
  while (queue.length > 0 && seenPages.size < 12) {
    const pageUrl = queue.shift()!;
    if (seenPages.has(pageUrl)) continue;
    seenPages.add(pageUrl);
    const { res, body } = await httpGetText(pageUrl);
    if (!res.ok) continue;
    for (const { href, text } of anchorPairs(body)) {
      const full = resolveWayback(href, pageUrl);
      if (!full) continue;
      const w = /\/web\/\d+(?:[a-z_]+)?\/https?:\/\/(?:www\.)?worth\.com\/articles\/([A-Za-z0-9]+)\.html$/i.exec(full);
      if (!w) continue;
      const code = w[1].toUpperCase();
      if (/^PL\d+$/i.test(code)) {
        if (!seenPages.has(full)) queue.push(full);
      } else if (/^Z/i.test(code) && !columns.has(code)) {
        columns.set(code, {
          slug: `worth-${code.toLowerCase()}`,
          title: `Worth column: ${text || code}`,
          url: full,
        });
      }
    }
  }
  return [...columns.values()];
}

/** ~10 Templeton client-letter posts behind the Wayback capture of the memorial-site category. */
async function expandTempletonLetters(parent: ManifestEntry): Promise<ChildSpec[]> {
  const seenPages = new Set<string>();
  const posts = new Map<string, ChildSpec>();
  const queue: string[] = [parent.url];
  while (queue.length > 0 && seenPages.size < 8) {
    const pageUrl = queue.shift()!;
    if (seenPages.has(pageUrl)) continue;
    seenPages.add(pageUrl);
    const { res, body } = await httpGetText(pageUrl);
    if (!res.ok) continue;
    for (const { href, text } of anchorPairs(body)) {
      const full = resolveWayback(href, pageUrl);
      if (!full) continue;
      const m = /\/web\/\d+(?:[a-z_]+)?\/https?:\/\/(?:www\.)?sirjohntempleton\.org\/\d{4}\/\d{2}\/\d{2}\/([^/"'?#]+)\/?$/i.exec(full);
      if (m) {
        const key = m[1];
        if (!posts.has(key)) {
          posts.set(key, {
            slug: `templeton-letter-${slugify(key).slice(0, 48)}`,
            title: text && text.length > 4 ? `Templeton letters post: ${text}` : `Templeton letters post: ${key}`,
            url: full,
          });
        }
        continue;
      }
      if (/\/web\/\d+(?:[a-z_]+)?\/https?:\/\/(?:www\.)?sirjohntempleton\.org\/category\/templeton-letters\/page\/\d+\/?$/i.test(full)) {
        if (!seenPages.has(full)) queue.push(full);
      }
    }
  }
  return [...posts.values()];
}

/** All Baupost Fund N-30D filings (1996–2001) from the EDGAR submissions API. */
async function expandBaupostN30D(parent: ManifestEntry): Promise<ChildSpec[]> {
  const { res, body } = await httpGetText("https://data.sec.gov/submissions/CIK0000865827.json");
  if (!res.ok || !body) return [];
  let subs: { filings?: { recent?: { form: string[]; accessionNumber: string[]; filingDate: string[] } } };
  try { subs = JSON.parse(body); } catch { return []; }
  const r = subs.filings?.recent;
  if (!r) return [];
  const out: ChildSpec[] = [];
  const parentAccession = /(\d{10}-\d{2}-\d{6})\.txt$/.exec(parent.url)?.[1];
  for (let i = 0; i < r.form.length; i++) {
    if (!r.form[i].startsWith("N-30D")) continue;
    const acc = r.accessionNumber[i];
    if (acc === parentAccession) continue;
    out.push({
      slug: `baupost-n30d-${r.filingDate[i]}`,
      title: `The Baupost Fund ${r.form[i]} (filed ${r.filingDate[i]})`,
      url: `https://www.sec.gov/Archives/edgar/data/865827/${acc}.txt`,
    });
  }
  return out;
}

const EXPANSION_HANDLERS: Record<string, (parent: ManifestEntry) => Promise<ChildSpec[]>> = {
  "worth-columns": expandWorthColumns,
  "templeton-letters": expandTempletonLetters,
  "baupost-n30d": expandBaupostN30D,
};

// ---------------------------------------------------------------------------
// Ledger generation (§5): tier-major — ALL Tier 1 rows in investor priority
// order, then ALL Tier 2, then Tier 3, then manual/book rows. Statuses are
// merged, never downgraded, so regeneration is always safe.
// ---------------------------------------------------------------------------

interface LedgerRow { status: string; date: string; notes: string }

function parseExistingLedger(): Map<string, LedgerRow> {
  const rows = new Map<string, LedgerRow>();
  if (!fs.existsSync(LEDGER_PATH)) return rows;
  for (const line of fs.readFileSync(LEDGER_PATH, "utf8").split("\n")) {
    const m = /^\| `([^`]+)` \|.*\| ([^|]+) \| ([^|]*) \| ([^|]*) \|$/.exec(line.trim());
    if (m) rows.set(m[1], { status: m[2].trim(), date: m[3].trim(), notes: m[4].trim() });
  }
  return rows;
}

function statusRankOf(display: string): number {
  const key = display.toLowerCase().split(/[\s(]/)[0] as Status;
  return STATUS_RANK[key] ?? 0;
}

function displayStatus(m: ManifestEntry): string {
  if (m.status === "blocked") return `BLOCKED (${(m.note ?? "fetch failed").replace(/\|/g, "/")})`;
  return m.status;
}

function hasExtraction(investor: string, slug: string): boolean {
  return fs.existsSync(path.join(EXTRACTIONS_DIR, investor, `${slug}.md`));
}

export function generateLedger(entries: CatalogEntry[], manifest: ManifestEntry[], missing: Investor[]): string {
  const old = parseExistingLedger();
  const bySlug = new Map(manifest.map((m) => [m.slug, m]));
  const childrenByParent = new Map<string, ManifestEntry[]>();
  for (const m of manifest) {
    if (m.parent) {
      const list = childrenByParent.get(m.parent) ?? [];
      list.push(m);
      childrenByParent.set(m.parent, list);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push("# Investor-Corpus Ingestion Ledger");
  lines.push("");
  lines.push("> Generated by `node scripts/corpus/fetch.ts --ledger` from the catalog files in this directory —");
  lines.push("> regeneration merges by slug and never downgrades a row's status, so it is always safe to re-run.");
  lines.push("> Process rows strictly in file order (tier-major; investor priority within each tier — AGENTS.md).");
  lines.push("> Statuses: `pending → fetched | ocr-needed | BLOCKED(reason) | manual → extracted → verified → synthesized`.");
  lines.push("> A row advances only when the stage's artifact exists and `scripts/corpus/verify.ts` passes (playbook §4/§6).");
  lines.push("");
  if (missing.length > 0) {
    for (const inv of missing) {
      lines.push(`> **BLOCKED:** catalog file \`${inv.file}\` (${inv.name}, priority ${inv.priority}) is missing from the repo —`);
      lines.push(`> it was never committed. No rows can be generated for this investor until the catalog is added.`);
    }
    lines.push("");
  }

  const emitRow = (e: { slug: string; title: string; url: string }, m: ManifestEntry | undefined): void => {
    const prior = old.get(e.slug);
    let status = m ? displayStatus(m) : "pending";
    let date = m?.fetchedAt ? m.fetchedAt.slice(0, 10) : "";
    let notes = (m?.status !== "blocked" ? m?.note : "") ?? "";
    const invKey = m?.investor ?? "";
    if (m && hasExtraction(invKey, e.slug) && statusRankOf(status) < STATUS_RANK.extracted) {
      status = "extracted";
      date = today;
    }
    if (prior && statusRankOf(prior.status) > statusRankOf(status)) {
      ({ status, date, notes } = prior);
    }
    const title = e.title.replace(/\|/g, "/");
    const link = e.url === "—" ? title : `[${title}](${e.url})`;
    lines.push(`| \`${e.slug}\` | ${link} | ${status} | ${date} | ${notes.replace(/\|/g, "/")} |`);
  };

  const tiers: { tier: Tier; heading: string }[] = [
    { tier: 1, heading: "## Tier 1 — Canon" },
    { tier: 2, heading: "## Tier 2 — Important" },
    { tier: 3, heading: "## Tier 3 — Supplementary" },
    { tier: "book", heading: "## Manual / Books" },
  ];

  for (const { tier, heading } of tiers) {
    lines.push(heading);
    lines.push("");
    for (const inv of INVESTORS) {
      const group = entries.filter((e) => e.investor === inv.key && e.tier === tier);
      const isMissing = missing.some((mi) => mi.key === inv.key);
      if (group.length === 0 && !isMissing) continue;
      lines.push(`### ${inv.priority}. ${inv.name}`);
      lines.push("");
      lines.push("| Doc slug | Title / URL | Status | Date | Notes |");
      lines.push("|---|---|---|---|---|");
      if (isMissing) {
        if (tier === 1) {
          lines.push(`| \`pabrai-catalog-missing\` | ${inv.file} (all tiers) | BLOCKED (catalog file missing from repo — never committed; add it and rerun \`--ledger\`) | ${today} | rows for this investor cannot be generated |`);
        } else {
          lines.push(`| \`pabrai-catalog-missing\` | ${inv.file} | BLOCKED (see Tier 1) | ${today} | |`);
        }
      }
      for (const e of group) {
        emitRow(e, bySlug.get(e.slug));
        for (const child of (childrenByParent.get(e.slug) ?? []).sort((x, y) => x.slug.localeCompare(y.slug))) {
          emitRow({ slug: child.slug, title: child.title, url: child.url }, child);
        }
      }
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { entries, missing } = parseAllCatalogs();

  // Manifest = union of all catalog rows (all tiers) + previously discovered children.
  const prior = new Map(loadManifest().map((m) => [m.slug, m]));
  const manifest: ManifestEntry[] = [];
  const bySlug = new Map<string, ManifestEntry>();
  const push = (m: ManifestEntry): void => { manifest.push(m); bySlug.set(m.slug, m); };

  for (const e of entries) {
    const existing = prior.get(e.slug);
    if (existing && !args.force) {
      existing.title = e.title;
      existing.url = e.url;
      existing.tier = e.tier;
      push(existing);
    } else {
      push({
        slug: e.slug, investor: e.investor, tier: e.tier, url: e.url, title: e.title,
        sha256: null, wordCount: null, fetchedAt: null,
        status: e.manual ? "manual" : "pending",
        note: e.manual,
      });
    }
    if (e.manual) {
      const m = bySlug.get(e.slug)!;
      if (m.status === "pending") { m.status = "manual"; m.note = e.manual; }
    }
  }
  // carry forward dynamic children discovered on earlier runs
  for (const [slug, m] of prior) {
    if (!bySlug.has(slug) && m.parent) push(m);
  }

  if (!args.ledgerOnly) {
    const inScope = (m: ManifestEntry): boolean =>
      args.tiers.includes(m.tier) && (args.investors === null || args.investors.includes(m.investor));

    const catalogBySlug = new Map(entries.map((e) => [e.slug, e]));
    const needsFetch = (m: ManifestEntry): boolean => {
      if (m.status === "manual") return false;
      // a hub whose expansion produced no children yet must re-run the expansion
      if (catalogBySlug.get(m.slug)?.expand && !manifest.some((x) => x.parent === m.slug)) return true;
      // ocr-needed PDFs are reprocessed (from cache) whenever tesseract is available
      if (m.status === "ocr-needed" && HAVE_TESSERACT && m.file?.endsWith(".pdf")) return true;
      if (!args.force && (m.status === "fetched" || m.status === "ocr-needed") && m.file &&
        fs.existsSync(path.join(CACHE_DIR, m.file))) return false;
      return true;
    };

    let targets = manifest.filter((m) => inScope(m) && needsFetch(m));
    if (targets.length > args.limit) targets = targets.slice(0, args.limit);
    console.log(`fetch scope: tier ${args.tiers.join(",")}${args.investors ? `, investors ${args.investors.join(",")}` : ""} — ${targets.length} document(s) to fetch (curl=${HAVE_CURL})`);

    let done = 0;
    const work = [...targets];
    const workers = Array.from({ length: args.concurrency }, async () => {
      while (work.length > 0) {
        const m = work.shift()!;
        const cat = catalogBySlug.get(m.slug);
        try {
          await fetchDocument(m, cat?.fetchUrl);
          // hub expansions run after their parent page fetches
          const handler = cat?.expand ? EXPANSION_HANDLERS[cat.expand] : undefined;
          if (handler) {
            const known = new Set(manifest.filter((x) => x.parent === m.slug).map((x) => x.slug));
            const children = (await handler(m)).filter((c) => !known.has(c.slug));
            if (cat!.expand !== "baupost-n30d") {
              m.note = `${m.note ? m.note + "; " : ""}index page — expanded to ${children.length + known.size} document(s)`;
            }
            for (const c of children) {
              const child: ManifestEntry = {
                slug: c.slug, investor: m.investor, tier: m.tier, url: c.url, title: c.title,
                sha256: null, wordCount: null, fetchedAt: null, status: "pending", parent: m.slug,
              };
              push(child);
              work.push(child);
            }
          }
        } catch (err) {
          m.status = "blocked";
          m.note = `fetch crashed: ${String(err).slice(0, 160)}`;
        }
        done++;
        console.log(`  [${done}] ${m.status.padEnd(10)} ${m.investor}/${m.slug}${m.wordCount ? ` (${m.wordCount}w)` : ""}${m.status === "blocked" ? ` — ${m.note}` : ""}`);
        saveManifest(manifest);
      }
    });
    await Promise.all(workers);
  }

  saveManifest(manifest);
  fs.writeFileSync(LEDGER_PATH, generateLedger(entries, manifest, missing));
  console.log(`\nledger written: ${path.relative(process.cwd(), LEDGER_PATH)}`);

  // §4 manifest report
  const scoped = manifest.filter((m) => args.tiers.includes(m.tier) && (args.investors === null || args.investors.includes(m.investor)));
  const counts: Record<string, number> = {};
  for (const m of scoped) counts[m.status] = (counts[m.status] ?? 0) + 1;
  const words = scoped.reduce((s, m) => s + (m.wordCount ?? 0), 0);
  console.log(`manifest (tier ${args.tiers.join(",")}): ${scoped.length} docs — ` +
    Object.entries(counts).sort().map(([k, v]) => `${k}: ${v}`).join(", ") +
    ` — ${words.toLocaleString()} words cached`);
}

const isDirectRun = process.argv[1] && import.meta.filename === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
