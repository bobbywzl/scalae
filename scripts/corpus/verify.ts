// Stage 4 of the corpus compile (playbook §6): mechanical verification that extraction
// files were produced from the cached full texts, not from summaries or memory.
//
//   node scripts/corpus/verify.ts                # verify every extraction + ledger cross-check
//   node scripts/corpus/verify.ts --doc <slug>   # verify specific document(s)
//   node scripts/corpus/verify.ts --investor lynch
//
// Checks per extraction file (docs/investor-corpus/extractions/<investor>/<slug>.md):
//   (a) every `> ` quote, whitespace/glyph-normalized, substring-matches the cached text
//       (fallback pass forgives PDF line-break hyphenation) — any miss fails the doc;
//   (b) frontmatter says all chunks were read (chunksRead "1-N of N", coverage 100%);
//   (c) category minimums hold (≥10 verbatim quotes; ≥3 question patterns; ≥1 directive/
//       concept/metric) or the category carries an explicit nothing-found note;
//   (d) the manifest wordCount matches a fresh recount of the cached text, and the
//       frontmatter agrees.
// Exit code 0 = every checked doc passed AND no LEDGER.md row claims a stage its
// artifacts don't support. The ledger may only advance on a passing run (AGENTS.md).

import * as fs from "node:fs";
import * as path from "node:path";
import {
  CACHE_DIR, EXTRACTIONS_DIR, LEDGER_PATH, STATUS_RANK,
  loadManifest, normalizeForMatch, squashForMatch, countWords,
} from "./lib.ts";
import type { ManifestEntry, Status } from "./lib.ts";

interface DocResult { slug: string; investor: string; ok: boolean; problems: string[] }

const ANCHOR_RE = /@\s*(chars?|p(?:age|p)?\.?|lines?|loc|¶)\s*[\d:]/i;
const NOTHING_FOUND_RE = /nothing\s+found|none\s+found|no\s+\w+[\w\s]*\s+found|genuinely\s+lacks|not\s+present\s+in\s+this\s+doc/i;

const SECTIONS = [
  { key: "quotes", re: /^##\s+Verbatim quotes/i },
  { key: "questions", re: /^##\s+Question patterns/i },
  { key: "directives", re: /^##\s+Search directives/i },
  { key: "concepts", re: /^##\s+Concepts/i },
  { key: "metrics", re: /^##\s+Metrics/i },
  { key: "nothing", re: /^##\s+Nothing-?found/i },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

interface Parsed {
  front: Record<string, string>;
  sections: Record<SectionKey, string[]>;
  quoteLines: { line: string; section: SectionKey | null }[];
}

function parseExtraction(text: string): Parsed | string {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return "missing frontmatter opening '---'";
  const front: Record<string, string> = {};
  let i = 1;
  for (; i < lines.length && lines[i].trim() !== "---"; i++) {
    const m = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(lines[i]);
    if (m) front[m[1]] = m[2].trim();
  }
  if (i >= lines.length) return "frontmatter never closed with '---'";

  const sections = Object.fromEntries(SECTIONS.map((s) => [s.key, []])) as Record<SectionKey, string[]>;
  const quoteLines: Parsed["quoteLines"] = [];
  let current: SectionKey | null = null;
  for (i++; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) {
      current = SECTIONS.find((s) => s.re.test(line))?.key ?? null;
      continue;
    }
    if (current) sections[current].push(line);
    if (/^\s*(?:-\s+)?>\s+/.test(line)) quoteLines.push({ line, section: current });
  }
  return { front, sections, quoteLines };
}

function extractQuote(line: string): { quote: string; hasAnchor: boolean } {
  let body = line.replace(/^\s*(?:-\s+)?>\s+/, "").trim();
  const at = body.search(/\s@\s*(chars?|p(?:age|p)?\.?|lines?|loc|¶)/i);
  const hasAnchor = ANCHOR_RE.test(body);
  if (at > 0) body = body.slice(0, at).trim();
  body = body.replace(/^["“”']+|["“”']+$/g, "").trim();
  return { quote: body, hasAnchor };
}

function countEntries(sectionLines: string[]): number {
  return sectionLines.filter((l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l) && !/^\s*(?:[-*]|\d+\.)\s+>/.test(l) || /^###\s/.test(l)).length;
}

function verifyDoc(file: string, manifest: Map<string, ManifestEntry>): DocResult {
  const slug = path.basename(file, ".md");
  const investor = path.basename(path.dirname(file));
  const problems: string[] = [];
  const parsed = parseExtraction(fs.readFileSync(file, "utf8"));
  if (typeof parsed === "string") {
    return { slug, investor, ok: false, problems: [parsed] };
  }
  const { front, sections, quoteLines } = parsed;

  // frontmatter ↔ manifest ↔ cache agreement
  if ((front.slug ?? "") !== slug) problems.push(`frontmatter slug '${front.slug}' ≠ filename '${slug}'`);
  if ((front.investor ?? "") !== investor) problems.push(`frontmatter investor '${front.investor}' ≠ directory '${investor}'`);
  const m = manifest.get(slug);
  let sourceNorm = "";
  let sourceSquash = "";
  if (!m) {
    problems.push("no manifest entry for this slug — run fetch.ts first");
  } else if (!m.textFile) {
    problems.push(`manifest status is '${m.status}' with no cached text — cannot verify quotes`);
  } else {
    const txtPath = path.join(CACHE_DIR, m.textFile);
    if (!fs.existsSync(txtPath)) {
      problems.push(`cached text missing: ${m.textFile}`);
    } else {
      const text = fs.readFileSync(txtPath, "utf8");
      const wc = countWords(text);
      if (m.wordCount !== wc) problems.push(`manifest wordCount ${m.wordCount} ≠ recount ${wc} (stale manifest)`);
      if (Number(front.wordCount) !== wc) problems.push(`frontmatter wordCount '${front.wordCount}' ≠ cached text ${wc}`);
      sourceNorm = normalizeForMatch(text);
      sourceSquash = squashForMatch(text);
    }
  }

  // coverage
  const chunks = /^\[?\s*1\s*(?:-\s*(\d+))?\s+of\s+(\d+)\s*\]?$/.exec(front.chunksRead ?? "");
  if (!chunks) problems.push(`chunksRead '${front.chunksRead}' not in '1-N of N' form`);
  else if ((chunks[1] ?? "1") !== chunks[2]) problems.push(`chunksRead '${front.chunksRead}' does not reach EOF`);
  if ((front.coverage ?? "") !== "100%") problems.push(`coverage '${front.coverage}' ≠ 100%`);

  // quotes: every quote line in the file must match the source
  const quoteSectionQuotes = quoteLines.filter((q) => q.section === "quotes");
  if (quoteSectionQuotes.length < 10) {
    problems.push(`only ${quoteSectionQuotes.length} quotes in '## Verbatim quotes' (need ≥10)`);
  }
  if (sourceNorm) {
    for (const { line } of quoteLines) {
      const { quote, hasAnchor } = extractQuote(line);
      const words = countWords(quote);
      if (words < 8) { problems.push(`quote too short (<8 words): “${quote.slice(0, 60)}…”`); continue; }
      if (!hasAnchor) problems.push(`quote missing @anchor: “${quote.slice(0, 60)}…”`);
      const norm = normalizeForMatch(quote);
      if (!sourceNorm.includes(norm) && !sourceSquash.includes(squashForMatch(quote))) {
        problems.push(`quote NOT FOUND in cached text: “${quote.slice(0, 80)}…”`);
      }
    }
  }

  // category minimums or explicit nothing-found
  const nothingText = sections.nothing.join("\n");
  const categoryOk = (key: SectionKey, minEntries: number, label: string): void => {
    const body = sections[key].join("\n");
    const entries = countEntries(sections[key]);
    const quotesIn = quoteLines.filter((q) => q.section === key).length;
    const declaredEmpty = NOTHING_FOUND_RE.test(body) ||
      (nothingText && new RegExp(label, "i").test(nothingText));
    if (declaredEmpty) return;
    if (entries < minEntries) problems.push(`'${label}': ${entries} entr${entries === 1 ? "y" : "ies"} (need ≥${minEntries} or a nothing-found note)`);
    if (entries > 0 && quotesIn === 0) problems.push(`'${label}': entries carry no supporting > quote`);
  };
  categoryOk("questions", 3, "Question patterns");
  categoryOk("directives", 1, "Search directives");
  categoryOk("concepts", 1, "Concepts");
  categoryOk("metrics", 1, "Metrics");

  return { slug, investor, ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Ledger cross-check: no row may claim a stage its artifacts don't support.
// ---------------------------------------------------------------------------

function ledgerCrossCheck(results: Map<string, DocResult>): string[] {
  if (!fs.existsSync(LEDGER_PATH)) return ["LEDGER.md missing — run fetch.ts --ledger"];
  const problems: string[] = [];
  for (const line of fs.readFileSync(LEDGER_PATH, "utf8").split("\n")) {
    const m = /^\| `([^`]+)` \|.*\| ([^|]+) \| ([^|]*) \| ([^|]*) \|$/.exec(line.trim());
    if (!m) continue;
    const [, slug, statusCell] = m;
    const statusKey = statusCell.trim().toLowerCase().split(/[\s(]/)[0] as Status;
    const rank = STATUS_RANK[statusKey] ?? 0;
    if (rank < STATUS_RANK.extracted) continue;
    const r = results.get(slug);
    if (!r) problems.push(`ledger row '${slug}' claims '${statusCell.trim()}' but no extraction file exists`);
    else if (!r.ok) problems.push(`ledger row '${slug}' claims '${statusCell.trim()}' but its extraction FAILS verification`);
  }
  return problems;
}

// ---------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const docs: string[] = [];
  const investors: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--doc") docs.push(...argv[++i].split(","));
    else if (argv[i] === "--investor") investors.push(...argv[++i].split(","));
    else { console.error(`unknown arg: ${argv[i]}`); process.exit(2); }
  }

  const manifest = new Map(loadManifest().map((m) => [m.slug, m]));
  const files: string[] = [];
  if (fs.existsSync(EXTRACTIONS_DIR)) {
    for (const inv of fs.readdirSync(EXTRACTIONS_DIR)) {
      const dir = path.join(EXTRACTIONS_DIR, inv);
      if (!fs.statSync(dir).isDirectory()) continue;
      if (investors.length > 0 && !investors.includes(inv)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".md")) continue;
        if (docs.length > 0 && !docs.includes(path.basename(f, ".md"))) continue;
        files.push(path.join(dir, f));
      }
    }
  }

  const results = new Map<string, DocResult>();
  for (const f of files.sort()) {
    const r = verifyDoc(f, manifest);
    results.set(r.slug, r);
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.investor}/${r.slug}`);
    for (const p of r.problems) console.log(`      ✗ ${p}`);
  }

  const fullRun = docs.length === 0 && investors.length === 0;
  const ledgerProblems = fullRun ? ledgerCrossCheck(results) : [];
  for (const p of ledgerProblems) console.log(`LEDGER ✗ ${p}`);

  const failed = [...results.values()].filter((r) => !r.ok).length;
  console.log(`\n${results.size} extraction(s) checked — ${results.size - failed} passed, ${failed} failed` +
    (fullRun ? `; ledger issues: ${ledgerProblems.length}` : ""));
  if (files.length === 0 && docs.length > 0) {
    console.log("no extraction files matched — nothing verified");
    process.exit(1);
  }
  process.exit(failed > 0 || ledgerProblems.length > 0 ? 1 : 0);
}

main();
