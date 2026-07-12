import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { domainOf } from "./citations";
import type {
  Attachment,
  ChatMessage,
  Citation,
  DigestItem,
  DividendReceipt,
  FocusArea,
  Order,
  OrderStatus,
  Reading,
  Run,
  Signal,
  SignalProposal,
  SignalSource,
  SignalStatus,
  Ticker,
  Trade,
} from "./types";

/**
 * Data layer on Neon Postgres (works locally and on Vercel — one database for
 * both, so the local and cloud apps share the same desks). Timestamps are ISO
 * strings in TEXT columns; camelCase columns are quoted so row objects match
 * the TypeScript interfaces exactly.
 */

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` (or add a Neon connection string) first."
    );
  }
  return neon(url);
}

const g = globalThis as unknown as {
  __scalaeSql?: NeonQueryFunction<false, false>;
  __scalaeSchema?: Promise<void>;
};

// Lazy: no connection attempt at module load (Next.js imports route modules
// at build time, where DATABASE_URL may not exist).
function sqlClient(): NeonQueryFunction<false, false> {
  return (g.__scalaeSql ??= connect());
}

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS tickers (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    "addedAt" TEXT NOT NULL,
    onboarded INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS focus_areas (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,
    UNIQUE(symbol, title)
  )`,
  `CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    "focusArea" TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    thesis TEXT NOT NULL DEFAULT '',
    "measurementPlan" TEXT NOT NULL DEFAULT '',
    scale TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    origin TEXT NOT NULL,
    replaces TEXT,
    "createdAt" TEXT NOT NULL,
    "approvedAt" TEXT
  )`,
  `ALTER TABLE signals ADD COLUMN IF NOT EXISTS replaces TEXT`,
  `CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    "signalId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    date TEXT NOT NULL,
    value DOUBLE PRECISION,
    "valueUnit" TEXT,
    level TEXT NOT NULL,
    delta TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    rationale TEXT NOT NULL,
    "newEvidence" INTEGER,
    citations TEXT NOT NULL DEFAULT '[]'
  )`,
  `ALTER TABLE readings ADD COLUMN IF NOT EXISTS "newEvidence" INTEGER`,
  `CREATE TABLE IF NOT EXISTS digest_items (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    date TEXT NOT NULL,
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    url TEXT,
    source TEXT,
    impact TEXT NOT NULL,
    "signalNames" TEXT NOT NULL DEFAULT '[]',
    seq BIGINT GENERATED ALWAYS AS IDENTITY
  )`,
  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    "startedAt" TEXT NOT NULL,
    "finishedAt" TEXT,
    status TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT '',
    "stageDetail" TEXT NOT NULL DEFAULT '',
    brief TEXT,
    dossier TEXT,
    sources TEXT NOT NULL DEFAULT '[]',
    error TEXT
  )`,
  `ALTER TABLE runs ADD COLUMN IF NOT EXISTS sources TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE runs ADD COLUMN IF NOT EXISTS dossier TEXT`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    "proposalIds" TEXT NOT NULL DEFAULT '[]',
    attachments TEXT NOT NULL DEFAULT '[]',
    "signalId" TEXT,
    "createdAt" TEXT NOT NULL,
    seq BIGINT GENERATED ALWAYS AS IDENTITY
  )`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "signalId" TEXT`,
  `CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    kind TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    fees DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tradeDate" TEXT NOT NULL,
    "optionType" TEXT,
    strike DOUBLE PRECISION,
    expiry TEXT,
    multiplier DOUBLE PRECISION NOT NULL DEFAULT 100,
    note TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol, "tradeDate")`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    "orderType" TEXT NOT NULL,
    "limitPrice" DOUBLE PRECISION,
    "stopPrice" DOUBLE PRECISION,
    tif TEXT NOT NULL DEFAULT 'gtc',
    status TEXT NOT NULL DEFAULT 'open',
    "placedAt" TEXT NOT NULL,
    "filledAt" TEXT,
    "fillPrice" DOUBLE PRECISION,
    "tradeId" TEXT,
    note TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, symbol)`,
  `CREATE TABLE IF NOT EXISTS dividends (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    "exDate" TEXT NOT NULL,
    "perShare" DOUBLE PRECISION NOT NULL,
    shares DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    reinvested INTEGER NOT NULL DEFAULT 0,
    "reinvestTradeId" TEXT,
    "appliedAt" TEXT NOT NULL,
    UNIQUE (symbol, "exDate")
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol, status)`,
  `CREATE INDEX IF NOT EXISTS idx_readings_signal ON readings("signalId", date)`,
  `CREATE INDEX IF NOT EXISTS idx_digest_symbol ON digest_items(symbol, date)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_symbol ON messages(symbol, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_runs_symbol ON runs(symbol, "startedAt")`,
];

/** Idempotent, memoized per process — cheap on Fluid Compute's reused instances. */
function ensureSchema(): Promise<void> {
  if (!g.__scalaeSchema) {
    g.__scalaeSchema = (async () => {
      const sql = sqlClient();
      for (const stmt of SCHEMA_STATEMENTS) await sql.query(stmt);
    })().catch((e) => {
      g.__scalaeSchema = undefined; // allow retry on next request
      throw e;
    });
  }
  return g.__scalaeSchema;
}

async function q<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  await ensureSchema();
  return (await sqlClient()(strings, ...values)) as T[];
}

export const now = () => new Date().toISOString();
export const uid = () => randomUUID();

// ---------- tickers ----------

export async function listTickers(): Promise<Ticker[]> {
  return q<Ticker>`SELECT * FROM tickers ORDER BY "addedAt" ASC`;
}

export async function getTicker(symbol: string): Promise<Ticker | undefined> {
  const rows = await q<Ticker>`SELECT * FROM tickers WHERE symbol = ${symbol}`;
  return rows[0];
}

export async function addTicker(symbol: string, name: string): Promise<Ticker> {
  await q`INSERT INTO tickers (symbol, name, "addedAt", onboarded) VALUES (${symbol}, ${name}, ${now()}, 0)
          ON CONFLICT (symbol) DO NOTHING`;
  return (await getTicker(symbol))!;
}

export async function removeTicker(symbol: string): Promise<void> {
  await q`DELETE FROM readings WHERE "signalId" IN (SELECT id FROM signals WHERE symbol = ${symbol})`;
  await q`DELETE FROM signals WHERE symbol = ${symbol}`;
  await q`DELETE FROM focus_areas WHERE symbol = ${symbol}`;
  await q`DELETE FROM digest_items WHERE symbol = ${symbol}`;
  await q`DELETE FROM runs WHERE symbol = ${symbol}`;
  await q`DELETE FROM messages WHERE symbol = ${symbol}`;
  await q`DELETE FROM tickers WHERE symbol = ${symbol}`;
}

export async function markOnboarded(symbol: string): Promise<void> {
  await q`UPDATE tickers SET onboarded = 1 WHERE symbol = ${symbol}`;
}

export async function touchLastRun(symbol: string): Promise<void> {
  await q`UPDATE tickers SET "lastRunAt" = ${now()} WHERE symbol = ${symbol}`;
}

// ---------- focus areas ----------

export async function listFocusAreas(symbol: string): Promise<FocusArea[]> {
  return q<FocusArea>`SELECT * FROM focus_areas WHERE symbol = ${symbol} ORDER BY "createdAt" ASC`;
}

export async function upsertFocusArea(
  symbol: string,
  title: string,
  description: string
): Promise<void> {
  await q`INSERT INTO focus_areas (id, symbol, title, description, "createdAt")
          VALUES (${uid()}, ${symbol}, ${title}, ${description}, ${now()})
          ON CONFLICT (symbol, title) DO UPDATE SET description = EXCLUDED.description`;
}

// ---------- signals ----------

export async function listSignals(symbol: string, status?: SignalStatus): Promise<Signal[]> {
  if (status) {
    return q<Signal>`SELECT * FROM signals WHERE symbol = ${symbol} AND status = ${status} ORDER BY "createdAt" ASC`;
  }
  return q<Signal>`SELECT * FROM signals WHERE symbol = ${symbol} ORDER BY "createdAt" ASC`;
}

export async function getSignal(id: string): Promise<Signal | undefined> {
  const rows = await q<Signal>`SELECT * FROM signals WHERE id = ${id}`;
  return rows[0];
}

/**
 * Insert a proposal as a `suggested` signal. Skips near-duplicate names. If the
 * proposal names an active signal it replaces, the resolved id is stored so
 * approval can retire it (the desk's refine-don't-duplicate mechanism).
 * Returns id or null.
 */
export async function insertProposal(
  symbol: string,
  p: SignalProposal,
  origin: Signal["origin"]
): Promise<string | null> {
  const existing = await q<{ id: string }>`
    SELECT id FROM signals
    WHERE symbol = ${symbol} AND lower(name) = lower(${p.name}) AND status IN ('suggested','active')`;
  if (existing.length > 0) return null;

  let replacesId: string | null = null;
  const replacesName = (p.replaces ?? "").trim();
  if (replacesName) {
    const hit = await q<{ id: string }>`
      SELECT id FROM signals
      WHERE symbol = ${symbol} AND status = 'active' AND lower(name) = lower(${replacesName})
      LIMIT 1`;
    replacesId = hit[0]?.id ?? null;
  }

  const id = uid();
  await q`INSERT INTO signals (id, symbol, "focusArea", name, type, thesis, "measurementPlan", scale, status, origin, replaces, "createdAt")
          VALUES (${id}, ${symbol}, ${p.focusArea}, ${p.name},
                  ${p.type === "quantitative" ? "quantitative" : "qualitative"},
                  ${p.thesis}, ${p.measurementPlan}, ${p.scale}, 'suggested', ${origin}, ${replacesId}, ${now()})`;
  return id;
}

export async function setSignalStatus(id: string, status: SignalStatus): Promise<void> {
  if (status === "active") {
    await q`UPDATE signals SET status = 'active', "approvedAt" = ${now()} WHERE id = ${id}`;
  } else {
    await q`UPDATE signals SET status = ${status} WHERE id = ${id}`;
  }
}

/**
 * Approve a proposal. If it replaces an active signal, that signal retires in
 * the same gesture — the board swaps to the sharper crux signal instead of
 * accreting near-twins. Returns the id of the retired signal, if any.
 */
export async function approveSignal(id: string): Promise<{ retiredId: string | null }> {
  const signal = await getSignal(id);
  await setSignalStatus(id, "active");
  let retiredId: string | null = null;
  if (signal?.replaces) {
    const target = await getSignal(signal.replaces);
    if (target && target.status === "active") {
      await setSignalStatus(target.id, "retired");
      retiredId = target.id;
    }
  }
  return { retiredId };
}

// ---------- readings ----------

interface ReadingRow extends Omit<Reading, "citations" | "newEvidence"> {
  citations: string;
  newEvidence: number | null;
}

function parseReading(r: ReadingRow): Reading {
  return {
    ...r,
    newEvidence: r.newEvidence == null ? null : r.newEvidence === 1,
    citations: JSON.parse(r.citations) as Citation[],
  };
}

export async function insertReading(r: Omit<Reading, "id">): Promise<Reading> {
  const id = uid();
  await q`INSERT INTO readings (id, "signalId", "runId", date, value, "valueUnit", level, delta, confidence, rationale, "newEvidence", citations)
          VALUES (${id}, ${r.signalId}, ${r.runId}, ${r.date}, ${r.value}, ${r.valueUnit},
                  ${r.level}, ${r.delta}, ${r.confidence}, ${r.rationale},
                  ${r.newEvidence == null ? null : r.newEvidence ? 1 : 0}, ${JSON.stringify(r.citations)})`;
  return { ...r, id };
}

export async function readingsForSignal(signalId: string, limit = 30): Promise<Reading[]> {
  const rows = await q<ReadingRow>`
    SELECT * FROM readings WHERE "signalId" = ${signalId} ORDER BY date DESC LIMIT ${limit}`;
  return rows.map(parseReading);
}

/**
 * The accumulated source catalog for every active signal of a symbol, in a
 * single query: every citation from every reading, deduped by URL per signal,
 * tracking first/last-seen dates, citation count, and the union of sweeps that
 * surfaced it. This is the signal's evidence base — it grows as daily runs add
 * or re-corroborate sources. Returned freshest-first (most recently cited).
 */
export async function sourcesForSignals(symbol: string): Promise<Map<string, SignalSource[]>> {
  const rows = await q<{ signalId: string; date: string; citations: string }>`
    SELECT r."signalId", r.date, r.citations
    FROM readings r JOIN signals s ON s.id = r."signalId"
    WHERE s.symbol = ${symbol}
    ORDER BY r.date ASC`;

  const bySignal = new Map<string, Map<string, SignalSource>>();
  for (const row of rows) {
    let cites: Citation[];
    try {
      cites = JSON.parse(row.citations) as Citation[];
    } catch {
      continue;
    }
    if (!Array.isArray(cites) || cites.length === 0) continue;
    let urlMap = bySignal.get(row.signalId);
    if (!urlMap) {
      urlMap = new Map();
      bySignal.set(row.signalId, urlMap);
    }
    const seenThisReading = new Set<string>();
    for (const c of cites) {
      if (!c?.url || seenThisReading.has(c.url)) continue;
      seenThisReading.add(c.url);
      const existing = urlMap.get(c.url);
      if (existing) {
        existing.count += 1;
        if (row.date > existing.lastSeen) existing.lastSeen = row.date;
        if (row.date < existing.firstSeen) existing.firstSeen = row.date;
        // Prefer a richer (longer) title as the human-readable label.
        if (c.title && c.title.length > existing.title.length) existing.title = c.title;
        for (const fb of c.foundBy ?? []) {
          if (!existing.foundBy.includes(fb)) existing.foundBy.push(fb);
        }
      } else {
        urlMap.set(c.url, {
          title: c.title || domainOf(c),
          url: c.url,
          domain: domainOf(c),
          foundBy: [...(c.foundBy ?? [])],
          firstSeen: row.date,
          lastSeen: row.date,
          count: 1,
        });
      }
    }
  }

  const out = new Map<string, SignalSource[]>();
  for (const [signalId, urlMap] of bySignal) {
    out.set(
      signalId,
      [...urlMap.values()].sort(
        (a, b) => b.lastSeen.localeCompare(a.lastSeen) || b.firstSeen.localeCompare(a.firstSeen)
      )
    );
  }
  return out;
}

// ---------- digest ----------

interface DigestRow extends Omit<DigestItem, "signalNames"> {
  signalNames: string;
}

export async function insertDigestItem(d: Omit<DigestItem, "id">): Promise<void> {
  await q`INSERT INTO digest_items (id, symbol, "runId", date, headline, summary, url, source, impact, "signalNames")
          VALUES (${uid()}, ${d.symbol}, ${d.runId}, ${d.date}, ${d.headline}, ${d.summary},
                  ${d.url}, ${d.source}, ${d.impact}, ${JSON.stringify(d.signalNames)})`;
}

export async function recentDigest(symbol: string, limit = 24): Promise<DigestItem[]> {
  const rows = await q<DigestRow>`
    SELECT id, symbol, "runId", date, headline, summary, url, source, impact, "signalNames"
    FROM digest_items WHERE symbol = ${symbol} ORDER BY date DESC, seq DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, signalNames: JSON.parse(r.signalNames) as string[] }));
}

// ---------- runs ----------

interface RunRow extends Omit<Run, "sources"> {
  sources: string;
}

function parseRun(r: RunRow | undefined): Run | undefined {
  if (!r) return undefined;
  let sources: Citation[] = [];
  try {
    sources = JSON.parse(r.sources || "[]") as Citation[];
  } catch {
    /* legacy row */
  }
  return { ...r, sources };
}

export async function createRun(symbol: string): Promise<Run> {
  const run: Run = {
    id: uid(),
    symbol,
    startedAt: now(),
    finishedAt: null,
    status: "running",
    stage: "queued",
    stageDetail: "Preparing the desk…",
    brief: null,
    dossier: null,
    sources: [],
    error: null,
  };
  await q`INSERT INTO runs (id, symbol, "startedAt", status, stage, "stageDetail")
          VALUES (${run.id}, ${run.symbol}, ${run.startedAt}, ${run.status}, ${run.stage}, ${run.stageDetail})`;
  return run;
}

export async function setRunStage(id: string, stage: string, stageDetail: string): Promise<void> {
  await q`UPDATE runs SET stage = ${stage}, "stageDetail" = ${stageDetail} WHERE id = ${id}`;
}

/** Recent finished runs (newest first) — enough to compute dossier provenance. */
export async function recentRuns(
  symbol: string,
  limit = 15
): Promise<{ id: string; startedAt: string; dossier: string | null }[]> {
  return q<{ id: string; startedAt: string; dossier: string | null }>`
    SELECT id, "startedAt", dossier FROM runs
    WHERE symbol = ${symbol} AND status = 'done'
    ORDER BY "startedAt" DESC LIMIT ${limit}`;
}

/** Complete a run: store the brief + standing dossier + numbered source list ([n] → link). */
export async function finishRun(
  id: string,
  brief: string,
  sources: Citation[] = [],
  dossier: string | null = null
): Promise<void> {
  await q`UPDATE runs SET status = 'done', stage = 'done', "stageDetail" = 'Desk updated',
          brief = ${brief}, dossier = ${dossier}, sources = ${JSON.stringify(sources)},
          "finishedAt" = ${now()} WHERE id = ${id}`;
}

export async function failRun(id: string, error: string): Promise<void> {
  await q`UPDATE runs SET status = 'error', stage = 'error', "stageDetail" = 'Run failed',
          error = ${error}, "finishedAt" = ${now()} WHERE id = ${id}`;
}

export async function getRun(id: string): Promise<Run | undefined> {
  const rows = await q<RunRow>`SELECT * FROM runs WHERE id = ${id}`;
  return parseRun(rows[0]);
}

export async function latestRun(symbol: string): Promise<Run | undefined> {
  const rows = await q<RunRow>`SELECT * FROM runs WHERE symbol = ${symbol} ORDER BY "startedAt" DESC LIMIT 1`;
  return parseRun(rows[0]);
}

export async function runningRun(symbol: string): Promise<Run | undefined> {
  const rows = await q<RunRow>`
    SELECT * FROM runs WHERE symbol = ${symbol} AND status = 'running' ORDER BY "startedAt" DESC LIMIT 1`;
  return parseRun(rows[0]);
}

/** Mark runs stuck in `running` for over 15 minutes as failed (e.g. instance died mid-run). */
export async function reapStuckRuns(symbol: string): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  await q`UPDATE runs SET status = 'error',
          error = 'Run interrupted (server restarted mid-run). Start it again.',
          "finishedAt" = ${now()}
          WHERE symbol = ${symbol} AND status = 'running' AND "startedAt" < ${cutoff}`;
}

// ---------- messages ----------

interface MessageRow extends Omit<ChatMessage, "proposalIds" | "attachments"> {
  proposalIds: string;
  attachments: string;
}

function parseMessage(r: MessageRow): ChatMessage {
  return {
    ...r,
    proposalIds: JSON.parse(r.proposalIds) as string[],
    attachments: JSON.parse(r.attachments) as Attachment[],
  };
}

/**
 * Chat scoping: every message belongs either to the ticker-level desk
 * (signalId null) or to one signal's focused chat (signalId set).
 *   { signalId: null }  → desk-level messages only
 *   { signalId: "…" }   → that signal's chat only
 *   omitted             → ALL messages (e.g. research guidance sweep)
 */
export interface MessageScope {
  signalId?: string | null;
}

export async function insertMessage(
  symbol: string,
  role: "user" | "assistant",
  content: string,
  proposalIds: string[] = [],
  attachments: Attachment[] = [],
  signalId: string | null = null
): Promise<ChatMessage> {
  const m: ChatMessage = {
    id: uid(),
    symbol,
    role,
    content,
    proposalIds,
    attachments,
    signalId,
    createdAt: now(),
  };
  await q`INSERT INTO messages (id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt")
          VALUES (${m.id}, ${m.symbol}, ${m.role}, ${m.content}, ${JSON.stringify(m.proposalIds)},
                  ${JSON.stringify(m.attachments)}, ${m.signalId}, ${m.createdAt})`;
  return m;
}

/**
 * Messages with attachment payloads stripped to metadata — what the browser
 * polls. Full payloads stay server-side (see listMessagesWithAttachments).
 */
export async function listMessages(
  symbol: string,
  limit = 200,
  scope?: MessageScope
): Promise<ChatMessage[]> {
  const rows = await listMessagesWithAttachments(symbol, limit, scope);
  return rows.map((m) => ({
    ...m,
    attachments: m.attachments.map((a) => ({
      kind: a.kind,
      name: a.name,
      mediaType: a.mediaType,
      size: a.size,
    })),
  }));
}

/** Messages including full attachment data — for building model requests only. */
export async function listMessagesWithAttachments(
  symbol: string,
  limit = 200,
  scope?: MessageScope
): Promise<ChatMessage[]> {
  let rows: MessageRow[];
  if (scope?.signalId === undefined) {
    rows = await q<MessageRow>`
      SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt"
      FROM messages WHERE symbol = ${symbol} ORDER BY "createdAt" ASC, seq ASC LIMIT ${limit}`;
  } else if (scope.signalId === null) {
    rows = await q<MessageRow>`
      SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt"
      FROM messages WHERE symbol = ${symbol} AND "signalId" IS NULL
      ORDER BY "createdAt" ASC, seq ASC LIMIT ${limit}`;
  } else {
    rows = await q<MessageRow>`
      SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt"
      FROM messages WHERE symbol = ${symbol} AND "signalId" = ${scope.signalId}
      ORDER BY "createdAt" ASC, seq ASC LIMIT ${limit}`;
  }
  return rows.map(parseMessage);
}

// ---------- settings ----------

export async function getSetting(key: string): Promise<string | null> {
  const rows = await q<{ value: string }>`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await q`INSERT INTO settings (key, value) VALUES (${key}, ${value})
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

/**
 * Global auto-research switch (the token budget lever). When OFF, neither the
 * cron nor stale-desk-open starts a run — only explicit human asks do (the
 * "Run research now" button, telling the analyst to run, or activating a desk).
 * Defaults ON.
 */
export async function autoResearchEnabled(): Promise<boolean> {
  return (await getSetting("autoResearch")) !== "off";
}

// ---------- trades (portfolio ledger) ----------

export async function insertTrade(t: Omit<Trade, "id" | "createdAt">): Promise<Trade> {
  const trade: Trade = { ...t, id: uid(), createdAt: now() };
  await q`INSERT INTO trades (id, symbol, kind, side, quantity, price, fees, "tradeDate",
                              "optionType", strike, expiry, multiplier, note, "createdAt")
          VALUES (${trade.id}, ${trade.symbol}, ${trade.kind}, ${trade.side}, ${trade.quantity},
                  ${trade.price}, ${trade.fees}, ${trade.tradeDate}, ${trade.optionType},
                  ${trade.strike}, ${trade.expiry}, ${trade.multiplier}, ${trade.note}, ${trade.createdAt})`;
  return trade;
}

export async function deleteTrade(id: string): Promise<void> {
  await q`DELETE FROM trades WHERE id = ${id}`;
}

export async function listTrades(symbol?: string): Promise<Trade[]> {
  if (symbol) {
    return q<Trade>`SELECT * FROM trades WHERE symbol = ${symbol} ORDER BY "tradeDate" ASC, "createdAt" ASC`;
  }
  return q<Trade>`SELECT * FROM trades ORDER BY "tradeDate" ASC, "createdAt" ASC`;
}

// ---------- orders (paper execution against live quotes) ----------

export async function insertOrder(
  o: Pick<Order, "symbol" | "side" | "quantity" | "orderType" | "limitPrice" | "stopPrice" | "tif" | "note">
): Promise<Order> {
  const order: Order = {
    ...o,
    id: uid(),
    status: "open",
    placedAt: now(),
    filledAt: null,
    fillPrice: null,
    tradeId: null,
  };
  await q`INSERT INTO orders (id, symbol, side, quantity, "orderType", "limitPrice", "stopPrice",
                              tif, status, "placedAt", note)
          VALUES (${order.id}, ${order.symbol}, ${order.side}, ${order.quantity}, ${order.orderType},
                  ${order.limitPrice}, ${order.stopPrice}, ${order.tif}, ${order.status},
                  ${order.placedAt}, ${order.note})`;
  return order;
}

export async function getOrder(id: string): Promise<Order | null> {
  const rows = await q<Order>`SELECT * FROM orders WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function listOpenOrders(): Promise<Order[]> {
  return q<Order>`SELECT * FROM orders WHERE status = 'open' ORDER BY "placedAt" ASC`;
}

/** Completed orders (filled/canceled/expired), newest first. */
export async function listOrderHistory(limit = 30): Promise<Order[]> {
  return q<Order>`SELECT * FROM orders WHERE status <> 'open'
                  ORDER BY COALESCE("filledAt", "placedAt") DESC LIMIT ${limit}`;
}

/** Cancel a working order; returns false if it wasn't open (e.g. already filled). */
export async function cancelOrder(id: string): Promise<boolean> {
  const rows = await q<{ id: string }>`UPDATE orders SET status = 'canceled'
    WHERE id = ${id} AND status = 'open' RETURNING id`;
  return rows.length > 0;
}

export async function markOrderFilled(id: string, fillPrice: number, tradeId: string): Promise<void> {
  await q`UPDATE orders SET status = 'filled', "fillPrice" = ${fillPrice},
          "tradeId" = ${tradeId}, "filledAt" = ${now()} WHERE id = ${id}`;
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  await q`UPDATE orders SET status = ${status} WHERE id = ${id}`;
}

// ---------- dividends ----------

export async function insertDividend(
  d: Omit<DividendReceipt, "id" | "appliedAt">
): Promise<DividendReceipt | null> {
  const rec: DividendReceipt = { ...d, id: uid(), appliedAt: now() };
  // The unique (symbol, exDate) key makes double-applies a no-op.
  const rows = await q<{ id: string }>`INSERT INTO dividends
      (id, symbol, "exDate", "perShare", shares, amount, currency, reinvested, "reinvestTradeId", "appliedAt")
    VALUES (${rec.id}, ${rec.symbol}, ${rec.exDate}, ${rec.perShare}, ${rec.shares}, ${rec.amount},
            ${rec.currency}, ${rec.reinvested}, ${rec.reinvestTradeId}, ${rec.appliedAt})
    ON CONFLICT (symbol, "exDate") DO NOTHING RETURNING id`;
  return rows.length > 0 ? rec : null;
}

export async function listDividends(symbol?: string): Promise<DividendReceipt[]> {
  if (symbol) {
    return q<DividendReceipt>`SELECT * FROM dividends WHERE symbol = ${symbol} ORDER BY "exDate" DESC`;
  }
  return q<DividendReceipt>`SELECT * FROM dividends ORDER BY "exDate" DESC`;
}

/** Per-symbol dividend-reinvestment setting (default off = receive cash). */
export async function dripEnabled(symbol: string): Promise<boolean> {
  return (await getSetting(`drip:${symbol.toUpperCase()}`)) === "on";
}

export async function setDrip(symbol: string, on: boolean): Promise<void> {
  await setSetting(`drip:${symbol.toUpperCase()}`, on ? "on" : "off");
}

/** Starting cash (USD) the book is run against; null = not set. */
export async function getInitialCapital(): Promise<number | null> {
  const v = await getSetting("initialCapital");
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function setInitialCapital(amount: number | null): Promise<void> {
  await setSetting("initialCapital", amount == null ? "" : String(amount));
}

/**
 * Wipe the whole book: trades, orders, dividend receipts. Settings (initial
 * capital, DRIP flags, auto-research) survive — this resets the ledger, not
 * the configuration. Returns what was deleted so the UI can confirm honestly.
 */
export async function clearPortfolio(): Promise<{ trades: number; orders: number; dividends: number }> {
  const [t, o, d] = await Promise.all([
    q<{ id: string }>`DELETE FROM trades RETURNING id`,
    q<{ id: string }>`DELETE FROM orders RETURNING id`,
    q<{ id: string }>`DELETE FROM dividends RETURNING id`,
  ]);
  return { trades: t.length, orders: o.length, dividends: d.length };
}
