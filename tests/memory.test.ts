/**
 * The recall memory (lib/agents/memory.ts): the mechanism that lets the desks
 * answer from the record EXACTLY instead of plausibly.
 *
 * These tests pin the four properties the guarantee rests on:
 *  1. refs are stable, unique and readable (a citation means the same record
 *     next week as it did today);
 *  2. routing sends a question to the categories it touches and withholds the
 *     rest — the token-efficiency claim, made mechanical;
 *  3. retrieval never hides part of the record: whatever is not opened is
 *     still listed in the inventory, by ref;
 *  4. verification catches an invented reference and an invented quotation
 *     before the reply reaches the investor.
 */
import test from "node:test";
import assert from "node:assert/strict";

import type { DeskBlock } from "../lib/search";
import {
  deskMemoryFromBlocks,
  expandMemory,
  MEMORY_CATEGORIES,
  retrieveMemory,
  routeQuery,
  queryTokens,
  slugify,
  toRecords,
  unknownRefs,
  verifyRecall,
} from "../lib/agents/memory";

const NOW = Date.parse("2026-08-23T00:00:00.000Z");
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const block = (b: Partial<DeskBlock> & Pick<DeskBlock, "id" | "type">): DeskBlock => ({
  pill: "signals",
  path: [],
  title: "",
  body: "",
  ...b,
});

/** A small but representative desk: every category populated. */
function fixture(): DeskBlock[] {
  return [
    block({
      id: "signal:s1",
      type: "signal",
      pill: "signals",
      path: ["Unit economics", "Subsidy dependence"],
      meta: "active",
      date: day(120),
      title: "Subsidy dependence",
      body: "Government subsidy is 41% of reported operating profit; the moat claim rests on it disappearing gracefully.",
    }),
    block({
      id: "reading:r1",
      type: "reading",
      pill: "signals",
      path: ["Subsidy dependence", "2026-08-14"],
      meta: "deteriorating",
      date: day(9),
      body: "Provincial subsidy programme cut by a third; management called the impact immaterial.",
    }),
    block({
      id: "digest:d1",
      type: "digest",
      pill: "signals",
      path: ["reuters.com"],
      meta: "negative",
      date: day(2),
      title: "Regulator opens pricing review",
      body: "The regulator opened a formal review of the group's pricing practices in three provinces.",
    }),
    block({
      id: "note:n1",
      type: "note",
      pill: "dd",
      path: ["Industry map", "China price war"],
      date: day(52),
      title: "China price war",
      body: "My read: the 2019 price war ended because the two marginal players ran out of funding, not because the moat held. If funding returns, the floor is 12% gross margin, not the 19% consensus assumes.",
    }),
    block({
      id: "section:sec1",
      type: "section",
      pill: "dd",
      path: ["Industry map"],
      date: day(60),
      title: "Industry map",
      body: "",
    }),
    block({
      id: "synthesis:current",
      type: "synthesis",
      pill: "dd",
      path: ["Standing synthesis"],
      date: day(5),
      title: "Standing synthesis of the due-diligence record",
      body: "The business earns its returns from distribution density, not brand. Culture is candid on costs and evasive on subsidy dependence.",
      agentOnly: true,
    }),
    block({
      id: "memo:m1",
      type: "memo",
      pill: "dd",
      path: ["Management", "candor record"],
      meta: "accepted",
      date: day(40),
      title: "candor record",
      body: "Across nine years of letters, three promises were kept verbatim and two were quietly dropped without mention.",
      agentOnly: true,
    }),
    block({
      id: "adjustment:a1",
      type: "adjustment",
      pill: "fin",
      path: ["Strip FY2025 IPO gain"],
      meta: "applied · FY2025",
      date: day(20),
      title: "Strip FY2025 IPO gain",
      body: "otherIncome — the FY2025 listing gain is not owner earnings; delta -4,120m.",
    }),
    block({
      id: "brief:b1",
      type: "brief",
      pill: "signals",
      path: ["2026-08-22"],
      date: day(1),
      body: "Pricing review dominates the day; subsidy programme cut confirmed by the provincial gazette.",
    }),
    block({
      id: "chat:c1",
      type: "chat",
      pill: "signals",
      meta: "assistant",
      date: day(30),
      body: "I said then that the buyback was funded from the disposal, not from operating cash.",
    }),
    block({
      id: "accumulation:acc1",
      type: "accumulation",
      pill: "signals",
      path: ["Distribution density"],
      date: day(15),
      title: "Distribution density",
      body: "Store density per city keeps rising while delivery cost per order falls — the scale mechanism is intact.",
      agentOnly: true,
    }),
  ];
}

const memory = () => deskMemoryFromBlocks("TEST", fixture());

// ---------------------------------------------------------------------------
// Refs
// ---------------------------------------------------------------------------

test("refs are readable, unique and stable across rebuilds", () => {
  const a = toRecords(fixture());
  const b = toRecords([...fixture()].reverse());
  assert.deepEqual(
    a.map((r) => r.ref).sort(),
    b.map((r) => r.ref).sort(),
    "ref assignment must not depend on the order blocks arrive in"
  );
  const refs = a.map((r) => r.ref);
  assert.equal(new Set(refs).size, refs.length, "refs must be unique");
  assert.ok(refs.includes("note:china-price-war"));
  assert.ok(refs.includes("signal:subsidy-dependence"));
  assert.ok(refs.includes("synthesis:current"));
  assert.ok(refs.includes("adjustment:strip-fy2025-ipo-gain"));
});

test("colliding titles get distinct refs rather than overwriting each other", () => {
  const dupes = [
    block({ id: "note:x1", type: "note", title: "Moat", date: day(3), body: "first" }),
    block({ id: "note:x2", type: "note", title: "Moat", date: day(2), body: "second" }),
  ];
  const refs = toRecords(dupes).map((r) => r.ref);
  assert.deepEqual(refs.sort(), ["note:moat", "note:moat-2"]);
});

test("a title the slugger cannot render still yields a usable ref", () => {
  const [rec] = toRecords([block({ id: "note:abcdef12", type: "note", title: "🙂🙂", body: "x" })]);
  assert.equal(slugify("🙂🙂"), "");
  assert.ok(rec.ref.startsWith("note:"));
  assert.ok(rec.ref.length > "note:".length);
});

test("Chinese titles keep a readable ref", () => {
  const [rec] = toRecords([block({ id: "note:zh1", type: "note", title: "护城河笔记", body: "x" })]);
  assert.equal(rec.ref, "note:护城河笔记");
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

test("a question is routed to the categories it names, and the rest are withheld", () => {
  const r = routeQuery("what did I write in my due-diligence notes about the price war?");
  assert.ok(r.categories.includes("diligence"));
  assert.ok(r.withheld.includes("financials"), "a notes question must not pay for the bench");
  assert.ok(r.withheld.includes("readings"));
  assert.equal(r.fallback, false);
});

test("a bench question routes to financials, not to the whole desk", () => {
  const r = routeQuery("strip the FY2025 IPO gain from operating margin");
  assert.deepEqual(r.categories, ["financials"]);
  assert.equal(r.withheld.length, MEMORY_CATEGORIES.length - 1);
});

test("Chinese questions route through the same lexicon", () => {
  const r = routeQuery("我在尽调笔记里写了什么？");
  assert.ok(r.categories.includes("diligence"));
});

test("a recall question that names no category opens the whole filing system", () => {
  const r = routeQuery("what did we say about the CEO earlier?");
  assert.equal(r.recall, true);
  assert.deepEqual(r.categories, [...MEMORY_CATEGORIES]);
  assert.deepEqual(r.withheld, []);
});

test("a question naming nothing falls back to the working set", () => {
  const r = routeQuery("how is this business doing?");
  assert.equal(r.fallback, true);
  assert.deepEqual(r.categories, ["signals", "diligence", "briefs"]);
});

test("a follow-up inherits the categories of the exchange it continues", () => {
  const r = routeQuery("and in 2019?", { context: "the FY2025 revenue adjustment on the bench" });
  assert.ok(r.categories.includes("financials"));
});

test("the caller can force and exclude categories", () => {
  const r = routeQuery("how is this business doing?", {
    force: ["readings"],
    exclude: ["financials"],
  });
  assert.ok(r.categories.includes("readings"));
  assert.ok(!r.categories.includes("financials"));
  assert.ok(!r.withheld.includes("financials"), "an excluded category is not 'withheld' — it is rendered elsewhere");
});

test("query tokens drop stopwords, keep stems and split CJK into bigrams", () => {
  const t = queryTokens("what did we say about the margins?");
  assert.ok(t.includes("margins"));
  assert.ok(t.includes("margin"), "cheap stemming so 'margins' finds 'margin'");
  assert.ok(!t.includes("the"));
  assert.ok(queryTokens("护城河").includes("护城"));
});

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

test("retrieval opens the record the question is about, verbatim", () => {
  const pack = retrieveMemory(memory(), {
    query: "what did I write about the price war floor?",
    now: NOW,
  });
  assert.ok(pack.refs.has("note:china-price-war"));
  assert.ok(
    pack.text.includes("the floor is 12% gross margin"),
    "the record's own words must be in the prompt, not a summary of them"
  );
});

test("everything not opened is still listed in the inventory, by ref", () => {
  const pack = retrieveMemory(memory(), { query: "strip the FY2025 IPO gain", now: NOW });
  assert.ok(pack.refs.has("adjustment:strip-fy2025-ipo-gain"));
  assert.ok(!pack.refs.has("note:china-price-war"), "an unrelated note should not be paid for");
  assert.ok(
    pack.text.includes("[note:china-price-war]"),
    "but the analyst must still know the note exists, and how to ask for it"
  );
  assert.equal(pack.allRefs.size, memory().records.length);
});

test("routing keeps the pack small; a recall question is allowed to be large", () => {
  const m = memory();
  const narrow = retrieveMemory(m, { query: "strip the FY2025 IPO gain", now: NOW });
  const wide = retrieveMemory(m, {
    query: "recall exactly what the record says about the price war and the subsidy",
    now: NOW,
  });
  assert.equal(wide.recall, true);
  assert.ok(
    wide.retrieved.length > narrow.retrieved.length,
    "a recall question casts the wider net"
  );
});

test("the standing synthesis can be pinned into every turn", () => {
  const pack = retrieveMemory(memory(), {
    query: "strip the FY2025 IPO gain",
    pin: ["synthesis:current"],
    now: NOW,
  });
  assert.ok(pack.refs.has("synthesis:current"));
});

test("an excluded category is not retrieved (the bench renders itself)", () => {
  const pack = retrieveMemory(memory(), {
    query: "strip the FY2025 IPO gain from FY2025",
    exclude: ["financials"],
    now: NOW,
  });
  assert.ok(![...pack.refs].some((r) => r.startsWith("adjustment:")));
  assert.ok(pack.text.includes("Rendered in full elsewhere in this prompt: financials"));
});

test("records already inlined elsewhere are not retrieved twice", () => {
  const pack = retrieveMemory(memory(), {
    query: "what does the daily brief say about the subsidy programme?",
    excludeKeys: ["brief:b1"],
    now: NOW,
  });
  assert.ok(![...pack.refs].some((r) => r.startsWith("brief:")));
});

test("a strongly matching record surfaces even from an unrouted category", () => {
  // "bench"/"adjustment" words are absent: this routes to diligence, yet the
  // adjustment matches two distinct query terms and must not stay invisible.
  const pack = retrieveMemory(memory(), {
    query: "in my notes — what happened with the FY2025 listing gain?",
    now: NOW,
  });
  assert.ok(pack.refs.has("adjustment:strip-fy2025-ipo-gain"));
});

test("nothing matching is said plainly rather than filled in", () => {
  const pack = retrieveMemory(deskMemoryFromBlocks("EMPTY", []), {
    query: "what did I write about the CFO?",
    now: NOW,
  });
  assert.equal(pack.retrieved.length, 0);
  assert.ok(pack.text.includes("nothing on the desk matched this question"));
  assert.ok(pack.text.includes("the desk holds no records yet"));
});

test("long bodies are cut with an honest, actionable marker", () => {
  const long = block({
    id: "note:long",
    type: "note",
    title: "Long note",
    date: day(1),
    body: `moat ${"x".repeat(5000)}`,
  });
  const pack = retrieveMemory(deskMemoryFromBlocks("T", [long]), {
    query: "moat note",
    maxRecordChars: 200,
    now: NOW,
  });
  assert.ok(pack.text.includes("[cut here"));
  assert.ok(pack.text.includes("ask for this record by ref"));
});

test("expansion opens exactly the records the analyst asked for", () => {
  const m = memory();
  const opts = { query: "strip the FY2025 IPO gain", now: NOW };
  const before = retrieveMemory(m, opts);
  assert.ok(!before.refs.has("memo:candor-record"));
  const after = expandMemory(m, opts, ["memo:candor-record", "[note:china-price-war]"]);
  assert.ok(after.refs.has("memo:candor-record"));
  assert.ok(after.refs.has("note:china-price-war"), "brackets are tolerated in a requested ref");
});

test("refs the desk does not hold are reported, never silently opened", () => {
  assert.deepEqual(unknownRefs(memory(), ["note:china-price-war", "note:invented"]), [
    "note:invented",
  ]);
});

test("a flat field of near-matches is cut to the records that answer", () => {
  // Sixty adjustments all contain the word "adjustment"; only one is about 12.
  const many = Array.from({ length: 60 }, (_, i) =>
    block({
      id: `adjustment:a${i}`,
      type: "adjustment",
      pill: "fin",
      path: [`Adjustment ${i}`],
      meta: "applied · FY2025",
      date: day(i * 3),
      title: `Adjustment ${i}`,
      body: `Rationale for adjustment ${i}.`,
    })
  );
  const pack = retrieveMemory(deskMemoryFromBlocks("BIG", many), {
    query: "recall exactly what the record says about Adjustment 12",
    now: NOW,
  });
  assert.ok(pack.refs.has("adjustment:adjustment-12"));
  assert.ok(pack.retrieved.length <= 6, `opened ${pack.retrieved.length} records — the floor should cut the field`);
  assert.ok(
    /\(\+\d+ more financials record\(s\) on file/.test(pack.text),
    "the rest stay named in the inventory, with the record's true depth"
  );
});

test("numbers survive tokenization — they are the sharpest recall terms", () => {
  const t = queryTokens("what did the FY2025 adjustment do in 2019, item 12?");
  assert.ok(t.includes("fy2025"));
  assert.ok(t.includes("2019"));
  assert.ok(t.includes("12"));
});

test("the inventory shrinks to fit its budget instead of running away", () => {
  const many = Array.from({ length: 400 }, (_, i) =>
    block({
      id: `note:n${i}`,
      type: "note",
      pill: "dd",
      path: [`Section ${i % 6}`, `A fairly long notepad title number ${i}`],
      date: day(i),
      title: `A fairly long notepad title number ${i}`,
      body: `Body ${i}`,
    })
  );
  const pack = retrieveMemory(deskMemoryFromBlocks("BIG", many), {
    query: "recall everything",
    now: NOW,
  });
  const inventory = pack.text.slice(pack.text.indexOf("INVENTORY"), pack.text.indexOf("RETRIEVED RECORDS"));
  assert.ok(inventory.length < 12_000, `inventory was ${inventory.length} chars`);
  assert.ok(inventory.includes("(+"), "the unlisted tail is named, not silently dropped");
  assert.ok(inventory.includes("diligence (400)"), "and the true total is always stated");
});

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

const packFor = (query: string) => retrieveMemory(memory(), { query, now: NOW });

test("a reply citing real records passes untouched", () => {
  const pack = packFor("what did I write about the price war floor?");
  const reply = 'Your note [note:china-price-war] puts the floor at 12% gross margin.';
  const { text, violations } = verifyRecall(reply, pack);
  assert.deepEqual(violations, []);
  assert.equal(text, reply);
});

test("an invented reference is marked unverified and flagged", () => {
  const pack = packFor("what did I write about the price war floor?");
  const { text, violations } = verifyRecall("As you noted in [note:the-ceo-interview], margins hold.", pack);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, "unknown-ref");
  assert.ok(text.includes("[unverified ref: note:the-ceo-interview]"));
  assert.ok(text.includes("Recall check"));
});

test("a quotation that is not in the record is flagged", () => {
  const pack = packFor("what did I write about the price war floor?");
  const { violations } = verifyRecall(
    'You wrote: "the moat held through the price war because customers would not switch at any price".',
    pack
  );
  assert.deepEqual(violations.map((v) => v.kind), ["unverified-quote"]);
});

test("a verbatim quotation of an opened record passes", () => {
  const pack = packFor("what did I write about the price war floor?");
  const { violations } = verifyRecall(
    'You wrote: "the 2019 price war ended because the two marginal players ran out of funding".',
    pack
  );
  assert.deepEqual(violations, []);
});

test("quoting the investor's own message back is not a claim about the record", () => {
  const pack = packFor("what did I write about the price war floor?");
  const ask = "tell me whether the subsidy cut changes the twelve percent floor you flagged before";
  const { violations } = verifyRecall(`You asked: "${ask}" — here is the record.`, pack, {
    allowText: [ask],
  });
  assert.deepEqual(violations, []);
});

test("short quotations (signal names, phrases) are never flagged", () => {
  const pack = packFor("how is the board doing?");
  const { violations } = verifyRecall('The signal "Subsidy dependence" is deteriorating.', pack);
  assert.deepEqual(violations, []);
});

test("the caveat speaks the investor's language", () => {
  const pack = packFor("what did I write about the price war floor?");
  const { text } = verifyRecall("见 [note:不存在的笔记]。", pack, { lang: "zh" });
  assert.ok(text.includes("记录核验"));
});
