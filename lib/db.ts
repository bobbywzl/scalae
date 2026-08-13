import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomBytes, randomUUID } from "node:crypto";
import { domainOf } from "./citations";
import type {
  AdminFeedbackRow,
  AdminUserRow,
  Annotation,
  Attachment,
  ChatMessage,
  Citation,
  DeskContext,
  DigestItem,
  DiligenceEvidence,
  DiligenceResearch,
  DiligenceSynthesis,
  DividendReceipt,
  EvidenceKind,
  FeedbackCategory,
  FeedbackMessage,
  FeedbackStatus,
  FeedbackTicket,
  FinAdjustment,
  FinAdjustmentOrigin,
  FinAdjustmentProposal,
  FinAdjustmentStatus,
  FinCleansingEvent,
  FinMessage,
  FinSuggestRun,
  FocusArea,
  Note,
  NoteSection,
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
  User,
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
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    picture TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user',
    "createdAt" TEXT NOT NULL,
    "lastSeenAt" TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions("userId")`,
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
  `ALTER TABLE signals ADD COLUMN IF NOT EXISTS "dismissedAt" TEXT`,
  `ALTER TABLE signals ADD COLUMN IF NOT EXISTS backstory TEXT`,
  `ALTER TABLE signals ADD COLUMN IF NOT EXISTS "backstoryBrief" TEXT`,
  `ALTER TABLE signals ADD COLUMN IF NOT EXISTS "backstorySources" TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE signals ADD COLUMN IF NOT EXISTS "backstoryAt" TEXT`,
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
  `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS "withholdingPct" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol, status)`,
  `CREATE INDEX IF NOT EXISTS idx_readings_signal ON readings("signalId", date)`,
  `CREATE INDEX IF NOT EXISTS idx_digest_symbol ON digest_items(symbol, date)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_symbol ON messages(symbol, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_runs_symbol ON runs(symbol, "startedAt")`,
  // ---- adaptive research cadence: consecutive no-new-evidence runs (lib/cadence) ----
  `ALTER TABLE tickers ADD COLUMN IF NOT EXISTS "quietRuns" INTEGER NOT NULL DEFAULT 0`,
  // ---- multi-tenancy: every row is owned; 'local' = single-user (auth off) ----
  `ALTER TABLE tickers ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  `ALTER TABLE focus_areas ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  `ALTER TABLE signals ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  `ALTER TABLE digest_items ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  `ALTER TABLE digest_items ADD COLUMN IF NOT EXISTS "sourceClass" TEXT`,
  `ALTER TABLE digest_items ADD COLUMN IF NOT EXISTS "sourceNote" TEXT`,
  `ALTER TABLE runs ADD COLUMN IF NOT EXISTS questions TEXT`,
  // ---- single-signal checks: a run scoped to one signal (null = board run) ----
  `ALTER TABLE runs ADD COLUMN IF NOT EXISTS "signalId" TEXT`,
  `ALTER TABLE runs ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  `ALTER TABLE messages ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  `ALTER TABLE trades ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  `ALTER TABLE dividends ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL DEFAULT 'local'`,
  // per-user uniqueness replaces the old single-tenant keys
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_tickers_user_symbol ON tickers("userId", symbol)`,
  `ALTER TABLE tickers DROP CONSTRAINT IF EXISTS tickers_pkey`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_fa_user_symbol_title ON focus_areas("userId", symbol, title)`,
  `ALTER TABLE focus_areas DROP CONSTRAINT IF EXISTS focus_areas_symbol_title_key`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_settings_user_key ON settings("userId", key)`,
  `ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_div_user_symbol_ex ON dividends("userId", symbol, "exDate")`,
  `ALTER TABLE dividends DROP CONSTRAINT IF EXISTS "dividends_symbol_exDate_key"`,
  `CREATE INDEX IF NOT EXISTS idx_signals_user ON signals("userId", symbol, status)`,
  `CREATE INDEX IF NOT EXISTS idx_trades_user ON trades("userId", symbol)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders("userId", status)`,
  // ---- AI usage telemetry (one row per model call; powers the admin cost panel) ----
  `CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    "userId" TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    feature TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_events(ts)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events("userId", ts)`,
  // ---- feedback & support (tickets with a message thread + evidence files) ----
  `CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS feedback_messages (
    id TEXT PRIMARY KEY,
    "feedbackId" TEXT NOT NULL,
    role TEXT NOT NULL,
    body TEXT NOT NULL,
    attachments TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    seq BIGINT GENERATED ALWAYS AS IDENTITY
  )`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback("userId", "updatedAt")`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, "updatedAt")`,
  `CREATE INDEX IF NOT EXISTS idx_fbmsg_ticket ON feedback_messages("feedbackId", seq)`,
  // ---- display-language translation cache. Content-addressed (sha-256 of the
  // source text), shared across users: a hit requires knowing the exact source
  // text, so nothing can leak through it. ----
  `CREATE TABLE IF NOT EXISTS translations (
    hash TEXT NOT NULL,
    lang TEXT NOT NULL,
    text TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    PRIMARY KEY (hash, lang)
  )`,
  // ---- financial-statement cache. Fundamentals are immutable once reported and
  // identical across users, so this is keyed by symbol only (no userId) and
  // shared. Refreshed on a multi-day TTL by the financials route. ----
  `CREATE TABLE IF NOT EXISTS financials_cache (
    symbol TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    "fetchedAt" TEXT NOT NULL
  )`,
  // ---- investor notes: per-ticker sections, each holding rich-text notepads
  // (TipTap JSON in notes.content — rendered only through the editor schema). ----
  `CREATE TABLE IF NOT EXISTS note_sections (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    "createdAt" TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_note_sections_user ON note_sections("userId", symbol, position)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_section ON notes("sectionId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_notes_user ON notes("userId", symbol)`,
  // ---- text annotations: highlight-by-selection over any rendered surface on
  // a ticker's pages, anchored by character offsets within a surfaceId. ----
  `CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    "surfaceId" TEXT NOT NULL,
    "selectedText" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    color TEXT NOT NULL,
    comment TEXT,
    "createdAt" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations("userId", symbol)`,
  // ---- due diligence: deep-research memos per section (accept-gated) and the
  // standing synthesis of core insights across the record (one per ticker). ----
  `CREATE TABLE IF NOT EXISTS dd_research (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    question TEXT NOT NULL DEFAULT '',
    memo TEXT,
    insights TEXT,
    sources TEXT NOT NULL DEFAULT '[]',
    error TEXT,
    "createdAt" TEXT NOT NULL,
    "decidedAt" TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ddr_user ON dd_research("userId", symbol, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_ddr_section ON dd_research("sectionId", "createdAt")`,
  `CREATE TABLE IF NOT EXISTS dd_synthesis (
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    content TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    PRIMARY KEY ("userId", symbol)
  )`,
  // Who last wrote the synthesis: the desk's refresh or the investor's edit.
  `ALTER TABLE dd_synthesis ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'desk'`,
  // ---- due-diligence evidence lockers: any file type, captioned, per section.
  // data is base64 (or raw text for kind='text'); listings never select it. ----
  `CREATE TABLE IF NOT EXISTS dd_evidence (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    caption TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dde_user ON dd_evidence("userId", symbol, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_dde_section ON dd_evidence("sectionId", "createdAt")`,
  // ---- chunked evidence uploads: rows assemble across requests and only
  // become part of the record once complete (legacy rows default complete). ----
  `ALTER TABLE dd_evidence ADD COLUMN IF NOT EXISTS complete INTEGER NOT NULL DEFAULT 1`,
  // ---- finance cleansing: user-owned adjustments overlaid on the raw
  // financials (the provider cache is never touched), an append-only audit
  // log of every raw → cleansed difference, the suggestion passes, and the
  // financial analyst desk's chat thread. Nothing is ever deleted — dismissed
  // and reverted adjustments stay in the history. ----
  `CREATE TABLE IF NOT EXISTS fin_adjustments (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    delta DOUBLE PRECISION NOT NULL,
    title TEXT NOT NULL,
    rationale TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'noise',
    origin TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'suggested',
    sources TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    "appliedAt" TEXT,
    "decidedAt" TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_finadj_user ON fin_adjustments("userId", symbol, status)`,
  // ---- board edits: beyond cell deltas, an adjustment can pin a cell (set),
  // add a custom row, hide a row, or add/hide a fiscal-year column. Legacy
  // rows default to op 'delta'; the op-specific payload rides in the new
  // nullable columns (cells is a JSON {fiscalYear: value} map). ----
  `ALTER TABLE fin_adjustments ADD COLUMN IF NOT EXISTS op TEXT NOT NULL DEFAULT 'delta'`,
  `ALTER TABLE fin_adjustments ADD COLUMN IF NOT EXISTS value DOUBLE PRECISION`,
  `ALTER TABLE fin_adjustments ADD COLUMN IF NOT EXISTS "rowLabel" TEXT`,
  `ALTER TABLE fin_adjustments ADD COLUMN IF NOT EXISTS "rowFormat" TEXT`,
  `ALTER TABLE fin_adjustments ADD COLUMN IF NOT EXISTS "rowGroup" TEXT`,
  `ALTER TABLE fin_adjustments ADD COLUMN IF NOT EXISTS cells TEXT`,
  `CREATE TABLE IF NOT EXISTS fin_cleansing_events (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    at TEXT NOT NULL,
    seq BIGINT GENERATED ALWAYS AS IDENTITY
  )`,
  `CREATE INDEX IF NOT EXISTS idx_finevt_user ON fin_cleansing_events("userId", symbol, seq)`,
  `CREATE TABLE IF NOT EXISTS fin_suggest_runs (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    note TEXT,
    "proposalCount" INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    "createdAt" TEXT NOT NULL,
    "finishedAt" TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_finrun_user ON fin_suggest_runs("userId", symbol, "createdAt")`,
  // ---- the desk's context board: behind-the-scenes memory distilled after
  // every research run and read before the next (never the investor's record) ----
  `CREATE TABLE IF NOT EXISTS desk_context (
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    content TEXT NOT NULL,
    "runId" TEXT,
    "updatedAt" TEXT NOT NULL,
    PRIMARY KEY ("userId", symbol)
  )`,
  `CREATE TABLE IF NOT EXISTS fin_messages (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    symbol TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    "adjustmentIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    seq BIGINT GENERATED ALWAYS AS IDENTITY
  )`,
  `CREATE INDEX IF NOT EXISTS idx_finmsg_user ON fin_messages("userId", symbol, seq)`,
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

export async function listTickers(userId: string): Promise<Ticker[]> {
  return q<Ticker>`SELECT * FROM tickers WHERE "userId" = ${userId} ORDER BY "addedAt" ASC`;
}

/** Every user's tickers — the cron sweeps all desks. */
export async function listAllTickers(): Promise<Ticker[]> {
  return q<Ticker>`SELECT * FROM tickers ORDER BY "addedAt" ASC`;
}

export async function getTicker(userId: string, symbol: string): Promise<Ticker | undefined> {
  const rows = await q<Ticker>`SELECT * FROM tickers WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  return rows[0];
}

export async function addTicker(userId: string, symbol: string, name: string): Promise<Ticker> {
  await q`INSERT INTO tickers ("userId", symbol, name, "addedAt", onboarded)
          VALUES (${userId}, ${symbol}, ${name}, ${now()}, 0)
          ON CONFLICT ("userId", symbol) DO NOTHING`;
  return (await getTicker(userId, symbol))!;
}

export async function removeTicker(userId: string, symbol: string): Promise<void> {
  await q`DELETE FROM readings WHERE "signalId" IN (SELECT id FROM signals WHERE "userId" = ${userId} AND symbol = ${symbol})`;
  await q`DELETE FROM signals WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM focus_areas WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM digest_items WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM runs WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM messages WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM dd_research WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM dd_synthesis WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM dd_evidence WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM fin_adjustments WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM fin_cleansing_events WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM fin_suggest_runs WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM fin_messages WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM desk_context WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  await q`DELETE FROM tickers WHERE "userId" = ${userId} AND symbol = ${symbol}`;
}

export async function markOnboarded(userId: string, symbol: string): Promise<void> {
  await q`UPDATE tickers SET onboarded = 1 WHERE "userId" = ${userId} AND symbol = ${symbol}`;
}

export async function touchLastRun(userId: string, symbol: string): Promise<void> {
  await q`UPDATE tickers SET "lastRunAt" = ${now()} WHERE "userId" = ${userId} AND symbol = ${symbol}`;
}


/** Snap a desk back to daily cadence (new evidence, or a board change). */
export async function resetQuietRuns(userId: string, symbol: string): Promise<void> {
  await q`UPDATE tickers SET "quietRuns" = 0 WHERE "userId" = ${userId} AND symbol = ${symbol}`;
}

/**
 * Update a desk's dormancy counter after a run: reset to 0 when the run found
 * new evidence, otherwise increment. Drives the cron's adaptive cadence
 * (lib/cadence.ts) — a desk that keeps reading "nothing new" is swept less
 * often. Best-effort; never throw into the run's success path.
 */
export async function bumpQuietRuns(
  userId: string,
  symbol: string,
  hadNewEvidence: boolean
): Promise<void> {
  if (hadNewEvidence) {
    await resetQuietRuns(userId, symbol);
  } else {
    await q`UPDATE tickers SET "quietRuns" = "quietRuns" + 1 WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  }
}

// ---------- focus areas ----------

export async function listFocusAreas(userId: string, symbol: string): Promise<FocusArea[]> {
  return q<FocusArea>`SELECT * FROM focus_areas WHERE "userId" = ${userId} AND symbol = ${symbol} ORDER BY "createdAt" ASC`;
}

export async function upsertFocusArea(
  userId: string,
  symbol: string,
  title: string,
  description: string
): Promise<void> {
  await q`INSERT INTO focus_areas (id, "userId", symbol, title, description, "createdAt")
          VALUES (${uid()}, ${userId}, ${symbol}, ${title}, ${description}, ${now()})
          ON CONFLICT ("userId", symbol, title) DO UPDATE SET description = EXCLUDED.description`;
}

/** Materialize a focus area if absent, preserving any existing description. */
export async function ensureFocusArea(userId: string, symbol: string, title: string): Promise<void> {
  await q`INSERT INTO focus_areas (id, "userId", symbol, title, description, "createdAt")
          VALUES (${uid()}, ${userId}, ${symbol}, ${title}, ${""}, ${now()})
          ON CONFLICT ("userId", symbol, title) DO NOTHING`;
}

/**
 * Remove a focus area the board no longer uses — refused while any active or
 * pending signal still carries its title, so the delete can never orphan a
 * live instrument. Returns whether a row was deleted.
 */
export async function removeFocusAreaIfUnused(
  userId: string,
  symbol: string,
  id: string
): Promise<boolean> {
  const rows = await q<{ id: string }>`
    DELETE FROM focus_areas fa
    WHERE fa.id = ${id} AND fa."userId" = ${userId} AND fa.symbol = ${symbol}
      AND NOT EXISTS (
        SELECT 1 FROM signals s
        WHERE s."userId" = fa."userId" AND s.symbol = fa.symbol
          AND s.status IN ('active', 'suggested')
          AND lower(s."focusArea") = lower(fa.title)
      )
    RETURNING fa.id`;
  return rows.length > 0;
}

// ---------- signals ----------

export async function listSignals(userId: string, symbol: string, status?: SignalStatus): Promise<Signal[]> {
  if (status) {
    return q<Signal>`SELECT * FROM signals WHERE "userId" = ${userId} AND symbol = ${symbol} AND status = ${status} ORDER BY "createdAt" ASC`;
  }
  return q<Signal>`SELECT * FROM signals WHERE "userId" = ${userId} AND symbol = ${symbol} ORDER BY "createdAt" ASC`;
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
  userId: string,
  symbol: string,
  p: SignalProposal,
  origin: Signal["origin"]
): Promise<string | null> {
  const existing = await q<{ id: string }>`
    SELECT id FROM signals
    WHERE "userId" = ${userId} AND symbol = ${symbol} AND lower(name) = lower(${p.name}) AND status IN ('suggested','active')`;
  if (existing.length > 0) return null;

  let replacesId: string | null = null;
  const replacesName = (p.replaces ?? "").trim();
  if (replacesName) {
    const hit = await q<{ id: string }>`
      SELECT id FROM signals
      WHERE "userId" = ${userId} AND symbol = ${symbol} AND status = 'active' AND lower(name) = lower(${replacesName})
      LIMIT 1`;
    replacesId = hit[0]?.id ?? null;
  }

  const id = uid();
  await q`INSERT INTO signals (id, "userId", symbol, "focusArea", name, type, thesis, "measurementPlan", scale, status, origin, replaces, "createdAt")
          VALUES (${id}, ${userId}, ${symbol}, ${p.focusArea}, ${p.name},
                  ${p.type === "quantitative" ? "quantitative" : "qualitative"},
                  ${p.thesis}, ${p.measurementPlan}, ${p.scale}, 'suggested', ${origin}, ${replacesId}, ${now()})`;
  return id;
}

/**
 * Store a signal's researched deep-history backstory: the markdown (with [n]
 * citations), its numbered source list, and the 1-2 sentence base-rate brief
 * the daily synthesis reads. One per signal; refreshing overwrites.
 */
export async function setSignalBackstory(
  id: string,
  backstory: string,
  brief: string,
  sources: Citation[]
): Promise<void> {
  await q`UPDATE signals SET backstory = ${backstory}, "backstoryBrief" = ${brief},
          "backstorySources" = ${JSON.stringify(sources)}, "backstoryAt" = ${now()}
          WHERE id = ${id}`;
}

export async function setSignalStatus(id: string, status: SignalStatus): Promise<void> {
  if (status === "active") {
    await q`UPDATE signals SET status = 'active', "approvedAt" = ${now()} WHERE id = ${id}`;
    // Activation is the human gate (FOUNDATION: focus areas are gated on a
    // human decision) — the approved signal materializes its focus area here,
    // never the analyst's chat output on its own.
    const s = await getSignal(id);
    if (s?.focusArea?.trim()) {
      await ensureFocusArea(s.userId ?? "local", s.symbol, s.focusArea.trim()).catch(() => {});
    }
  } else if (status === "dismissed") {
    // Stamp the dismissal so re-proposals and restored proposals can say
    // "previously dismissed on <date>" — institutional memory for the gate.
    await q`UPDATE signals SET status = 'dismissed', "dismissedAt" = ${now()} WHERE id = ${id}`;
  } else {
    await q`UPDATE signals SET status = ${status} WHERE id = ${id}`;
  }
}

/**
 * Approve a proposal. If it replaces an active signal, that signal retires in
 * the same gesture — the board swaps to the sharper crux signal instead of
 * accreting near-twins. Returns the id of the retired signal, if any.
 */
export async function approveSignal(
  id: string
): Promise<{ approved: boolean; retiredId: string | null }> {
  // Approval means suggested → active, atomically. An unconditional flip let a
  // proposal dismissed in one surface be approved from another's stale list —
  // the human gate running backwards. (Archive reactivation is a different
  // gesture and keeps using setSignalStatus directly.)
  const flipped = await q<{ id: string }>`
    UPDATE signals SET status = 'active', "approvedAt" = ${now()}
    WHERE id = ${id} AND status = 'suggested' RETURNING id`;
  if (flipped.length === 0) return { approved: false, retiredId: null };
  const signal = await getSignal(id);
  // Activation is the human gate (FOUNDATION) — the approved signal
  // materializes its focus area here, never chat output on its own.
  if (signal?.focusArea?.trim()) {
    await ensureFocusArea(signal.userId ?? "local", signal.symbol, signal.focusArea.trim()).catch(
      () => {}
    );
  }
  let retiredId: string | null = null;
  if (signal?.replaces) {
    const target = await getSignal(signal.replaces);
    if (target && target.status === "active") {
      await setSignalStatus(target.id, "retired");
      retiredId = target.id;
    }
  }
  // A new active signal is a board change — wake the desk from any dormancy
  // backoff so the cron researches it on the normal daily cadence again.
  if (signal) await resetQuietRuns(signal.userId ?? "local", signal.symbol).catch(() => {});
  return { approved: true, retiredId };
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

/**
 * Record a reading — guarded to a signal that is STILL ACTIVE at write time.
 * A run works from a board snapshot taken minutes earlier; the investor (or
 * their analyst) may have retired the signal mid-run, and a retired signal
 * must not accrete fresh evidence dated after its retirement. Returns null
 * when the write was skipped for that reason.
 */
export async function insertReading(r: Omit<Reading, "id">): Promise<Reading | null> {
  const id = uid();
  const rows = await q<{ id: string }>`
    INSERT INTO readings (id, "signalId", "runId", date, value, "valueUnit", level, delta, confidence, rationale, "newEvidence", citations)
    SELECT ${id}, ${r.signalId}, ${r.runId}, ${r.date}, ${r.value}, ${r.valueUnit},
           ${r.level}, ${r.delta}, ${r.confidence}, ${r.rationale},
           ${r.newEvidence == null ? null : r.newEvidence ? 1 : 0}, ${JSON.stringify(r.citations)}
    WHERE EXISTS (SELECT 1 FROM signals WHERE id = ${r.signalId} AND status = 'active')
    RETURNING id`;
  return rows.length > 0 ? { ...r, id } : null;
}

export async function readingsForSignal(signalId: string, limit = 30): Promise<Reading[]> {
  const rows = await q<ReadingRow>`
    SELECT * FROM readings WHERE "signalId" = ${signalId} ORDER BY date DESC LIMIT ${limit}`;
  return rows.map(parseReading);
}

/** Recent readings across EVERY signal of a symbol, tagged with the signal's name (desk search). */
export async function readingsForSymbol(
  userId: string,
  symbol: string,
  limit = 500
): Promise<(Reading & { signalName: string })[]> {
  const rows = await q<ReadingRow & { signalName: string }>`
    SELECT r.*, s.name AS "signalName"
    FROM readings r JOIN signals s ON s.id = r."signalId"
    WHERE s."userId" = ${userId} AND s.symbol = ${symbol}
    ORDER BY r.date DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...parseReading(r), signalName: r.signalName }));
}

/**
 * The accumulated source catalog for every active signal of a symbol, in a
 * single query: every citation from every reading, deduped by URL per signal,
 * tracking first/last-seen dates, citation count, and the union of sweeps that
 * surfaced it. This is the signal's evidence base — it grows as daily runs add
 * or re-corroborate sources. Returned freshest-first (most recently cited).
 */
export async function sourcesForSignals(userId: string, symbol: string): Promise<Map<string, SignalSource[]>> {
  const rows = await q<{ signalId: string; date: string; citations: string }>`
    SELECT r."signalId", r.date, r.citations
    FROM readings r JOIN signals s ON s.id = r."signalId"
    WHERE s."userId" = ${userId} AND s.symbol = ${symbol}
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

export async function insertDigestItem(userId: string, d: Omit<DigestItem, "id">): Promise<void> {
  await q`INSERT INTO digest_items (id, "userId", symbol, "runId", date, headline, summary, url, source, impact, "signalNames", "sourceClass", "sourceNote")
          VALUES (${uid()}, ${userId}, ${d.symbol}, ${d.runId}, ${d.date}, ${d.headline}, ${d.summary},
                  ${d.url}, ${d.source}, ${d.impact}, ${JSON.stringify(d.signalNames)}, ${d.sourceClass}, ${d.sourceNote})`;
}

/** Remove one item from the evidence feed (the readings keep their citations). */
export async function deleteDigestItem(userId: string, id: string): Promise<void> {
  await q`DELETE FROM digest_items WHERE "userId" = ${userId} AND id = ${id}`;
}

export async function recentDigest(userId: string, symbol: string, limit = 24): Promise<DigestItem[]> {
  const rows = await q<DigestRow>`
    SELECT id, symbol, "runId", date, headline, summary, url, source, impact, "signalNames", "sourceClass", "sourceNote"
    FROM digest_items WHERE "userId" = ${userId} AND symbol = ${symbol} ORDER BY date DESC, seq DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, signalNames: JSON.parse(r.signalNames) as string[] }));
}

// ---------- runs ----------

interface RunRow extends Omit<Run, "sources" | "questions"> {
  sources: string;
  questions: string | null;
}

function parseRun(r: RunRow | undefined): Run | undefined {
  if (!r) return undefined;
  let sources: Citation[] = [];
  try {
    sources = JSON.parse(r.sources || "[]") as Citation[];
  } catch {
    /* legacy row */
  }
  let questions: string[] = [];
  try {
    questions = JSON.parse(r.questions || "[]") as string[];
  } catch {
    /* legacy row */
  }
  return { ...r, sources, questions };
}

export async function createRun(
  userId: string,
  symbol: string,
  signalId: string | null = null
): Promise<Run> {
  const run: Run = {
    id: uid(),
    symbol,
    startedAt: now(),
    finishedAt: null,
    status: "running",
    stage: "queued",
    stageDetail: signalId ? "Preparing the signal check…" : "Preparing the desk…",
    brief: null,
    dossier: null,
    sources: [],
    questions: [],
    error: null,
    signalId,
  };
  await q`INSERT INTO runs (id, "userId", symbol, "startedAt", status, stage, "stageDetail", "signalId")
          VALUES (${run.id}, ${userId}, ${run.symbol}, ${run.startedAt}, ${run.status}, ${run.stage}, ${run.stageDetail}, ${signalId})`;
  return run;
}

export async function setRunStage(id: string, stage: string, stageDetail: string): Promise<void> {
  await q`UPDATE runs SET stage = ${stage}, "stageDetail" = ${stageDetail} WHERE id = ${id}`;
}

/** Store the run's framed focus questions (the question suggestor's output). */
export async function setRunQuestions(id: string, questions: string[]): Promise<void> {
  await q`UPDATE runs SET questions = ${JSON.stringify(questions)} WHERE id = ${id}`;
}

/** Recent finished BOARD runs (newest first) — enough to compute dossier provenance. */
export async function recentRuns(
  userId: string,
  symbol: string,
  limit = 15
): Promise<{ id: string; startedAt: string; dossier: string | null }[]> {
  return q<{ id: string; startedAt: string; dossier: string | null }>`
    SELECT id, "startedAt", dossier FROM runs
    WHERE "userId" = ${userId} AND symbol = ${symbol} AND status = 'done' AND "signalId" IS NULL
    ORDER BY "startedAt" DESC LIMIT ${limit}`;
}

/** Complete a run: store the brief + standing dossier + numbered source list ([n] → link). */
export async function finishRun(
  id: string,
  brief: string,
  sources: Citation[] = [],
  dossier: string | null = null
): Promise<void> {
  // Only a still-running run may complete — if it was stopped by the user
  // mid-flight, the zombie must not resurrect it as 'done'.
  await q`UPDATE runs SET status = 'done', stage = 'done', "stageDetail" = 'Desk updated',
          brief = ${brief}, dossier = ${dossier}, sources = ${JSON.stringify(sources)},
          "finishedAt" = ${now()} WHERE id = ${id} AND status = 'running'`;
}

export async function failRun(id: string, error: string): Promise<void> {
  await q`UPDATE runs SET status = 'error', stage = 'error', "stageDetail" = 'Run failed',
          error = ${error}, "finishedAt" = ${now()} WHERE id = ${id} AND status = 'running'`;
}

/**
 * Stop the desk's in-flight run on the investor's command: mark any running run
 * 'stopped', which frees the desk immediately so a fresh run can start. The
 * background pipeline notices the status change at its next stage checkpoint and
 * bails (see executeRun). Returns true if a run was actually stopped.
 */
export async function cancelRunningRun(userId: string, symbol: string): Promise<boolean> {
  const rows = await q<{ id: string }>`
    UPDATE runs SET status = 'stopped', stage = 'stopped', "stageDetail" = 'Stopped by you',
           error = 'Stopped — start a fresh run when ready.', "finishedAt" = ${now()}
    WHERE "userId" = ${userId} AND symbol = ${symbol} AND status = 'running'
    RETURNING id`;
  return rows.length > 0;
}

/** A run's current status (for the pipeline's cooperative cancellation checks). */
export async function runStatus(id: string): Promise<string | undefined> {
  const rows = await q<{ status: string }>`SELECT status FROM runs WHERE id = ${id}`;
  return rows[0]?.status;
}

export async function getRun(id: string): Promise<Run | undefined> {
  const rows = await q<RunRow>`SELECT * FROM runs WHERE id = ${id}`;
  return parseRun(rows[0]);
}

/** The newest BOARD run — signal-scoped checks never drive the desk's brief/dossier/banner. */
export async function latestRun(userId: string, symbol: string): Promise<Run | undefined> {
  const rows = await q<RunRow>`
    SELECT * FROM runs WHERE "userId" = ${userId} AND symbol = ${symbol} AND "signalId" IS NULL
    ORDER BY "startedAt" DESC LIMIT 1`;
  return parseRun(rows[0]);
}

/**
 * The newest COMPLETED board run — what every reader of the desk's standing
 * output (dossier, brief, research window, compare snapshots, chat context)
 * should consume. `latestRun` includes running/failed rows, whose brief and
 * dossier are null: reading it mid-run makes the desk look like it has no
 * thesis for the duration of every run.
 */
export async function latestDoneRun(userId: string, symbol: string): Promise<Run | undefined> {
  const rows = await q<RunRow>`
    SELECT * FROM runs WHERE "userId" = ${userId} AND symbol = ${symbol} AND "signalId" IS NULL
      AND status = 'done'
    ORDER BY "startedAt" DESC LIMIT 1`;
  return parseRun(rows[0]);
}

/** The newest single-signal check for a symbol (any status), if one exists. */
export async function latestSignalRun(userId: string, symbol: string): Promise<Run | undefined> {
  const rows = await q<RunRow>`
    SELECT * FROM runs WHERE "userId" = ${userId} AND symbol = ${symbol} AND "signalId" IS NOT NULL
    ORDER BY "startedAt" DESC LIMIT 1`;
  return parseRun(rows[0]);
}

export async function runningRun(userId: string, symbol: string): Promise<Run | undefined> {
  const rows = await q<RunRow>`
    SELECT * FROM runs WHERE "userId" = ${userId} AND symbol = ${symbol} AND status = 'running' ORDER BY "startedAt" DESC LIMIT 1`;
  return parseRun(rows[0]);
}

/**
 * Mark runs stuck in `running` as failed (e.g. instance died mid-run). The
 * cutoff sits just above the route's 300s maxDuration: a platform-killed run
 * can never outlive that, and every extra minute here is a minute the zombie
 * row holds the one-run-per-desk lock with the banner frozen on a dead stage.
 */
export async function reapStuckRuns(userId: string, symbol: string): Promise<void> {
  const cutoff = new Date(Date.now() - 6 * 60_000).toISOString();
  await q`UPDATE runs SET status = 'error',
          error = 'Run interrupted (server restarted mid-run). Start it again.',
          "finishedAt" = ${now()}
          WHERE "userId" = ${userId} AND symbol = ${symbol} AND status = 'running' AND "startedAt" < ${cutoff}`;
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
  userId: string,
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
  await q`INSERT INTO messages (id, "userId", symbol, role, content, "proposalIds", attachments, "signalId", "createdAt")
          VALUES (${m.id}, ${userId}, ${m.symbol}, ${m.role}, ${m.content}, ${JSON.stringify(m.proposalIds)},
                  ${JSON.stringify(m.attachments)}, ${m.signalId}, ${m.createdAt})`;
  return m;
}

/**
 * Messages with attachment payloads stripped to metadata — what the browser
 * polls. Full payloads stay server-side (see listMessagesWithAttachments).
 */
export async function listMessages(
  userId: string,
  symbol: string,
  limit = 200,
  scope?: MessageScope
): Promise<ChatMessage[]> {
  const rows = await listMessagesWithAttachments(userId, symbol, limit, scope);
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

/**
 * Messages including full attachment data — for building model requests only.
 * The limit keeps the NEWEST rows (an ASC LIMIT would freeze the thread on its
 * first N messages forever — the analyst answering last month's question while
 * ignoring today's); the inner DESC window is re-sorted so callers still get
 * chronological order.
 */
export async function listMessagesWithAttachments(
  userId: string,
  symbol: string,
  limit = 200,
  scope?: MessageScope
): Promise<ChatMessage[]> {
  let rows: MessageRow[];
  if (scope?.signalId === undefined) {
    rows = await q<MessageRow>`
      SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt" FROM (
        SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt", seq
        FROM messages WHERE "userId" = ${userId} AND symbol = ${symbol}
        ORDER BY "createdAt" DESC, seq DESC LIMIT ${limit}
      ) newest ORDER BY "createdAt" ASC, seq ASC`;
  } else if (scope.signalId === null) {
    rows = await q<MessageRow>`
      SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt" FROM (
        SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt", seq
        FROM messages WHERE "userId" = ${userId} AND symbol = ${symbol} AND "signalId" IS NULL
        ORDER BY "createdAt" DESC, seq DESC LIMIT ${limit}
      ) newest ORDER BY "createdAt" ASC, seq ASC`;
  } else {
    rows = await q<MessageRow>`
      SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt" FROM (
        SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt", seq
        FROM messages WHERE "userId" = ${userId} AND symbol = ${symbol} AND "signalId" = ${scope.signalId}
        ORDER BY "createdAt" DESC, seq DESC LIMIT ${limit}
      ) newest ORDER BY "createdAt" ASC, seq ASC`;
  }
  return rows.map(parseMessage);
}

/**
 * The NEWEST chat messages across every thread of a symbol, attachment
 * payloads stripped (desk search: the recent record matters, not the oldest —
 * an ASC LIMIT keeps the first rows and silently drops yesterday's chat).
 */
export async function recentMessages(
  userId: string,
  symbol: string,
  limit = 400
): Promise<ChatMessage[]> {
  const rows = await q<MessageRow>`
    SELECT id, symbol, role, content, "proposalIds", attachments, "signalId", "createdAt"
    FROM messages WHERE "userId" = ${userId} AND symbol = ${symbol}
    ORDER BY "createdAt" DESC, seq DESC LIMIT ${limit}`;
  return rows.map(parseMessage).map((m) => ({
    ...m,
    attachments: m.attachments.map((a) => ({
      kind: a.kind,
      name: a.name,
      mediaType: a.mediaType,
      size: a.size,
    })),
  }));
}

// ---------- settings ----------

export async function getSetting(userId: string, key: string): Promise<string | null> {
  const rows = await q<{ value: string }>`SELECT value FROM settings WHERE "userId" = ${userId} AND key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function setSetting(userId: string, key: string, value: string): Promise<void> {
  await q`INSERT INTO settings ("userId", key, value) VALUES (${userId}, ${key}, ${value})
          ON CONFLICT ("userId", key) DO UPDATE SET value = EXCLUDED.value`;
}

/**
 * Global auto-research switch (the token budget lever). When OFF, neither the
 * cron nor stale-desk-open starts a run — only explicit human asks do (the
 * "Run research now" button, telling the analyst to run, or activating a desk).
 * Defaults ON.
 */
export async function autoResearchEnabled(userId: string): Promise<boolean> {
  return (await getSetting(userId, "autoResearch")) !== "off";
}

// ---------- translation cache (display-language layer) ----------

/** Cached translations for a batch of source-text hashes: hash → translated text. */
export async function getTranslations(lang: string, hashes: string[]): Promise<Map<string, string>> {
  if (hashes.length === 0) return new Map();
  const rows = await q<{ hash: string; text: string }>`
    SELECT hash, text FROM translations WHERE lang = ${lang} AND hash = ANY(${hashes}::text[])`;
  return new Map(rows.map((r) => [r.hash, r.text]));
}

export async function saveTranslations(
  lang: string,
  entries: { hash: string; text: string }[]
): Promise<void> {
  for (const e of entries) {
    await q`INSERT INTO translations (hash, lang, text, "createdAt")
            VALUES (${e.hash}, ${lang}, ${e.text}, ${now()})
            ON CONFLICT (hash, lang) DO UPDATE SET text = EXCLUDED.text`;
  }
}

// ---------- financials cache (per symbol, shared across users) ----------

/** Cached financials JSON for a symbol, with its fetch timestamp — or null. */
export async function getCachedFinancials(
  symbol: string
): Promise<{ data: string; fetchedAt: string } | null> {
  const rows = await q<{ data: string; fetchedAt: string }>`
    SELECT data, "fetchedAt" FROM financials_cache WHERE symbol = ${symbol.toUpperCase()}`;
  return rows[0] ?? null;
}

export async function setCachedFinancials(symbol: string, data: string): Promise<void> {
  await q`INSERT INTO financials_cache (symbol, data, "fetchedAt")
          VALUES (${symbol.toUpperCase()}, ${data}, ${now()})
          ON CONFLICT (symbol) DO UPDATE SET data = EXCLUDED.data, "fetchedAt" = EXCLUDED."fetchedAt"`;
}

// ---------- investor notes (sections + rich-text notepads) ----------

export async function listNoteSections(userId: string, symbol: string): Promise<NoteSection[]> {
  return q<NoteSection>`
    SELECT id, symbol, title, position, "createdAt" FROM note_sections
    WHERE "userId" = ${userId} AND symbol = ${symbol} ORDER BY position ASC, "createdAt" ASC`;
}

export async function createNoteSection(
  userId: string,
  symbol: string,
  title: string
): Promise<NoteSection> {
  const rows = await q<{ max: number | null }>`
    SELECT MAX(position) AS max FROM note_sections WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  const s: NoteSection = {
    id: uid(),
    symbol,
    title: title.trim().slice(0, 120),
    position: (rows[0]?.max ?? -1) + 1,
    createdAt: now(),
  };
  await q`INSERT INTO note_sections (id, "userId", symbol, title, position, "createdAt")
          VALUES (${s.id}, ${userId}, ${s.symbol}, ${s.title}, ${s.position}, ${s.createdAt})`;
  return s;
}

export async function renameNoteSection(userId: string, id: string, title: string): Promise<void> {
  await q`UPDATE note_sections SET title = ${title.trim().slice(0, 120)}
          WHERE id = ${id} AND "userId" = ${userId}`;
}

/** Deleting a section deletes its notepads, research and evidence with it — the page confirms first. */
export async function deleteNoteSection(userId: string, id: string): Promise<void> {
  await q`DELETE FROM notes WHERE "sectionId" = ${id} AND "userId" = ${userId}`;
  await q`DELETE FROM dd_research WHERE "sectionId" = ${id} AND "userId" = ${userId}`;
  await q`DELETE FROM dd_evidence WHERE "sectionId" = ${id} AND "userId" = ${userId}`;
  await q`DELETE FROM note_sections WHERE id = ${id} AND "userId" = ${userId}`;
}

export async function getNoteSection(userId: string, id: string): Promise<NoteSection | undefined> {
  const rows = await q<NoteSection>`
    SELECT id, symbol, title, position, "createdAt" FROM note_sections
    WHERE id = ${id} AND "userId" = ${userId}`;
  return rows[0];
}

export async function listNotes(userId: string, symbol: string): Promise<Note[]> {
  return q<Note>`
    SELECT id, "sectionId", symbol, title, content, "createdAt", "updatedAt" FROM notes
    WHERE "userId" = ${userId} AND symbol = ${symbol} ORDER BY "createdAt" ASC`;
}

export async function getNote(userId: string, id: string): Promise<Note | undefined> {
  const rows = await q<Note>`
    SELECT id, "sectionId", symbol, title, content, "createdAt", "updatedAt" FROM notes
    WHERE id = ${id} AND "userId" = ${userId}`;
  return rows[0];
}

export async function createNote(
  userId: string,
  sectionId: string,
  symbol: string,
  title: string,
  content: string
): Promise<Note> {
  const n: Note = {
    id: uid(),
    sectionId,
    symbol,
    title: title.trim().slice(0, 160),
    content,
    createdAt: now(),
    updatedAt: now(),
  };
  await q`INSERT INTO notes (id, "userId", "sectionId", symbol, title, content, "createdAt", "updatedAt")
          VALUES (${n.id}, ${userId}, ${n.sectionId}, ${n.symbol}, ${n.title}, ${n.content}, ${n.createdAt}, ${n.updatedAt})`;
  return n;
}

/** Autosave: update title and/or content; either may be omitted. */
export async function updateNote(
  userId: string,
  id: string,
  patch: { title?: string; content?: string }
): Promise<void> {
  if (patch.title !== undefined && patch.content !== undefined) {
    await q`UPDATE notes SET title = ${patch.title.trim().slice(0, 160)}, content = ${patch.content},
            "updatedAt" = ${now()} WHERE id = ${id} AND "userId" = ${userId}`;
  } else if (patch.title !== undefined) {
    await q`UPDATE notes SET title = ${patch.title.trim().slice(0, 160)}, "updatedAt" = ${now()}
            WHERE id = ${id} AND "userId" = ${userId}`;
  } else if (patch.content !== undefined) {
    await q`UPDATE notes SET content = ${patch.content}, "updatedAt" = ${now()}
            WHERE id = ${id} AND "userId" = ${userId}`;
  }
}

export async function deleteNote(userId: string, id: string): Promise<void> {
  await q`DELETE FROM notes WHERE id = ${id} AND "userId" = ${userId}`;
}

// ---------- due diligence (deep-research memos + standing synthesis) ----------

interface DiligenceResearchRow extends Omit<DiligenceResearch, "sources"> {
  sources: string;
}

function parseDiligenceResearch(r: DiligenceResearchRow): DiligenceResearch {
  let sources: Citation[] = [];
  try {
    sources = JSON.parse(r.sources || "[]") as Citation[];
  } catch {
    /* malformed row — memo renders without linked citations */
  }
  return { ...r, sources };
}

/** Start a research pass on a section (status 'running'; the pipeline fills it in). */
export async function createDiligenceResearch(
  userId: string,
  symbol: string,
  sectionId: string,
  question: string
): Promise<DiligenceResearch> {
  const row: DiligenceResearch = {
    id: uid(),
    sectionId,
    symbol,
    status: "running",
    question: question.trim().slice(0, 500),
    memo: null,
    insights: null,
    sources: [],
    error: null,
    createdAt: now(),
    decidedAt: null,
  };
  await q`INSERT INTO dd_research (id, "userId", symbol, "sectionId", status, question, "createdAt")
          VALUES (${row.id}, ${userId}, ${row.symbol}, ${row.sectionId}, 'running', ${row.question}, ${row.createdAt})`;
  return row;
}

/**
 * Complete a research pass: store the memo + insights + numbered sources and
 * move it to 'pending' — the investor's review gate. Guarded to a still-running
 * row so a pass the investor already cleaned up can't resurrect itself.
 */
export async function finishDiligenceResearch(
  id: string,
  memo: string,
  insights: string,
  sources: Citation[]
): Promise<void> {
  await q`UPDATE dd_research SET status = 'pending', memo = ${memo}, insights = ${insights},
          sources = ${JSON.stringify(sources)} WHERE id = ${id} AND status = 'running'`;
}

export async function failDiligenceResearch(id: string, error: string): Promise<void> {
  await q`UPDATE dd_research SET status = 'error', error = ${error}
          WHERE id = ${id} AND status = 'running'`;
}

/**
 * Stop an in-flight research pass on the investor's command. The row goes
 * terminal ('stopped') immediately, which frees the section for a fresh pass;
 * the background pipeline notices at its next checkpoint and bails, and the
 * running-only guards on finish/fail mean a zombie can never resurrect it.
 * Returns true if a running pass was actually stopped.
 */
export async function stopDiligenceResearch(userId: string, id: string): Promise<boolean> {
  const rows = await q<{ id: string }>`
    UPDATE dd_research SET status = 'stopped', "decidedAt" = ${now()}
    WHERE id = ${id} AND "userId" = ${userId} AND status = 'running'
    RETURNING id`;
  return rows.length > 0;
}

/** A research pass's current status (for the pipeline's cancellation checkpoints). */
export async function diligenceResearchStatus(id: string): Promise<string | undefined> {
  const rows = await q<{ status: string }>`SELECT status FROM dd_research WHERE id = ${id}`;
  return rows[0]?.status;
}

/**
 * The investor's review decision on a pending memo. Accepting is what admits
 * the research into the record (the caller appends the notepad); dismissing
 * leaves the record untouched. Only a pending row can be decided.
 */
export async function decideDiligenceResearch(
  userId: string,
  id: string,
  accept: boolean
): Promise<DiligenceResearch | undefined> {
  const rows = await q<DiligenceResearchRow>`
    UPDATE dd_research SET status = ${accept ? "accepted" : "dismissed"}, "decidedAt" = ${now()}
    WHERE id = ${id} AND "userId" = ${userId} AND status = 'pending'
    RETURNING *`;
  return rows[0] ? parseDiligenceResearch(rows[0]) : undefined;
}

export async function getDiligenceResearch(
  userId: string,
  id: string
): Promise<DiligenceResearch | undefined> {
  const rows = await q<DiligenceResearchRow>`
    SELECT * FROM dd_research WHERE id = ${id} AND "userId" = ${userId}`;
  return rows[0] ? parseDiligenceResearch(rows[0]) : undefined;
}

/** Every research pass for a ticker, newest first (the page groups by section). */
export async function listDiligenceResearch(
  userId: string,
  symbol: string
): Promise<DiligenceResearch[]> {
  const rows = await q<DiligenceResearchRow>`
    SELECT * FROM dd_research WHERE "userId" = ${userId} AND symbol = ${symbol}
    ORDER BY "createdAt" DESC`;
  return rows.map(parseDiligenceResearch);
}

/** Mark research stuck in 'running' for over 15 minutes as failed (instance died mid-pass). */
export async function reapStuckDiligence(userId: string, symbol: string): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  await q`UPDATE dd_research SET status = 'error',
          error = 'Research interrupted (server restarted mid-pass). Run it again.'
          WHERE "userId" = ${userId} AND symbol = ${symbol} AND status = 'running' AND "createdAt" < ${cutoff}`;
}

export async function getDiligenceSynthesis(
  userId: string,
  symbol: string
): Promise<DiligenceSynthesis | undefined> {
  const rows = await q<DiligenceSynthesis>`
    SELECT symbol, content, "updatedAt", origin FROM dd_synthesis
    WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  return rows[0];
}

export async function saveDiligenceSynthesis(
  userId: string,
  symbol: string,
  content: string,
  origin: "desk" | "investor" = "desk"
): Promise<DiligenceSynthesis> {
  const row: DiligenceSynthesis = { symbol, content, updatedAt: now(), origin };
  await q`INSERT INTO dd_synthesis ("userId", symbol, content, "updatedAt", origin)
          VALUES (${userId}, ${symbol}, ${row.content}, ${row.updatedAt}, ${origin})
          ON CONFLICT ("userId", symbol) DO UPDATE SET content = EXCLUDED.content,
            "updatedAt" = EXCLUDED."updatedAt", origin = EXCLUDED.origin`;
  return row;
}

// ---------- due-diligence evidence lockers (any file type, captioned) ----------

export async function insertDiligenceEvidence(
  userId: string,
  symbol: string,
  sectionId: string,
  file: { kind: EvidenceKind; name: string; mediaType: string; size: number; data: string },
  caption: string,
  complete = true
): Promise<DiligenceEvidence> {
  const row: DiligenceEvidence = {
    id: uid(),
    sectionId,
    symbol,
    kind: file.kind,
    name: file.name,
    mediaType: file.mediaType,
    size: file.size,
    caption: caption.trim().slice(0, 500),
    createdAt: now(),
  };
  await q`INSERT INTO dd_evidence (id, "userId", symbol, "sectionId", kind, name, "mediaType", size, caption, data, "createdAt", complete)
          VALUES (${row.id}, ${userId}, ${row.symbol}, ${row.sectionId}, ${row.kind}, ${row.name},
                  ${row.mediaType}, ${row.size}, ${row.caption}, ${file.data}, ${row.createdAt}, ${complete ? 1 : 0})`;
  return row;
}

/**
 * Append one chunk to an in-flight (incomplete) upload. Returns the assembled
 * length so the route can enforce the per-kind cap, or null when there is no
 * matching incomplete row (finished, reaped, or not the owner's).
 */
export async function appendEvidenceChunk(
  userId: string,
  id: string,
  chunk: string
): Promise<{ length: number; kind: EvidenceKind } | null> {
  const rows = await q<{ len: number; kind: EvidenceKind }>`
    UPDATE dd_evidence SET data = data || ${chunk}
    WHERE id = ${id} AND "userId" = ${userId} AND complete = 0
    RETURNING length(data) AS len, kind`;
  return rows[0] ? { length: Number(rows[0].len), kind: rows[0].kind } : null;
}

/** Mark a chunked upload assembled — the row joins the record atomically. */
export async function completeEvidenceUpload(userId: string, id: string): Promise<boolean> {
  const rows = await q<{ id: string }>`
    UPDATE dd_evidence SET complete = 1
    WHERE id = ${id} AND "userId" = ${userId} AND complete = 0
    RETURNING id`;
  return rows.length > 0;
}

/** Every COMPLETE evidence row for a ticker — METADATA ONLY (data never rides listings). */
export async function listDiligenceEvidence(
  userId: string,
  symbol: string
): Promise<DiligenceEvidence[]> {
  return q<DiligenceEvidence>`
    SELECT id, "sectionId", symbol, kind, name, "mediaType", size, caption, "createdAt"
    FROM dd_evidence WHERE "userId" = ${userId} AND symbol = ${symbol} AND complete = 1
    ORDER BY "createdAt" ASC`;
}

/** One complete evidence row including its payload — for the file route and the memo agent. */
export async function getDiligenceEvidenceWithData(
  userId: string,
  id: string
): Promise<(DiligenceEvidence & { data: string }) | undefined> {
  const rows = await q<DiligenceEvidence & { data: string }>`
    SELECT id, "sectionId", symbol, kind, name, "mediaType", size, caption, data, "createdAt"
    FROM dd_evidence WHERE id = ${id} AND "userId" = ${userId} AND complete = 1`;
  return rows[0];
}

/** Payloads for a SECTION's readable complete evidence, oldest first — the memo agent's pile. */
export async function evidenceDataForSection(
  userId: string,
  sectionId: string
): Promise<(DiligenceEvidence & { data: string })[]> {
  return q<DiligenceEvidence & { data: string }>`
    SELECT id, "sectionId", symbol, kind, name, "mediaType", size, caption, data, "createdAt"
    FROM dd_evidence WHERE "sectionId" = ${sectionId} AND "userId" = ${userId} AND complete = 1
    ORDER BY "createdAt" ASC`;
}

/** Delete abandoned chunked uploads (browser closed mid-upload) after an hour. */
export async function reapStaleEvidenceUploads(userId: string, symbol: string): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 60_000).toISOString();
  await q`DELETE FROM dd_evidence
          WHERE "userId" = ${userId} AND symbol = ${symbol} AND complete = 0 AND "createdAt" < ${cutoff}`;
}

export async function updateDiligenceEvidenceCaption(
  userId: string,
  id: string,
  caption: string
): Promise<void> {
  await q`UPDATE dd_evidence SET caption = ${caption.trim().slice(0, 500)}
          WHERE id = ${id} AND "userId" = ${userId}`;
}

export async function deleteDiligenceEvidence(userId: string, id: string): Promise<void> {
  await q`DELETE FROM dd_evidence WHERE id = ${id} AND "userId" = ${userId}`;
}

// ---------------------------------------------------------------------------
// Finance cleansing: adjustments (human-gated overlays on the raw financials),
// the append-only audit log, suggestion passes, and the analyst desk thread.
// ---------------------------------------------------------------------------

interface FinAdjustmentRow extends Omit<FinAdjustment, "sources" | "cells"> {
  sources: string;
  cells: string | null;
}

function parseFinAdjustment(r: FinAdjustmentRow): FinAdjustment {
  let sources: Citation[] = [];
  try {
    sources = JSON.parse(r.sources || "[]") as Citation[];
  } catch {
    /* malformed row — adjustment renders without linked citations */
  }
  let cells: FinAdjustment["cells"] = null;
  try {
    cells = r.cells ? (JSON.parse(r.cells) as FinAdjustment["cells"]) : null;
  } catch {
    /* malformed row — addRow renders without initial values */
  }
  return { ...r, op: r.op ?? "delta", sources, cells };
}

/** Every adjustment for a ticker, any status, newest first. */
export async function listFinAdjustments(userId: string, symbol: string): Promise<FinAdjustment[]> {
  const rows = await q<FinAdjustmentRow>`
    SELECT * FROM fin_adjustments WHERE "userId" = ${userId} AND symbol = ${symbol}
    ORDER BY "createdAt" DESC`;
  return rows.map(parseFinAdjustment);
}

export async function getFinAdjustment(userId: string, id: string): Promise<FinAdjustment | undefined> {
  const rows = await q<FinAdjustmentRow>`
    SELECT * FROM fin_adjustments WHERE id = ${id} AND "userId" = ${userId}`;
  return rows[0] ? parseFinAdjustment(rows[0]) : undefined;
}

/** Park a new adjustment. Status 'suggested' (the review gate) unless the caller applies it in the same gesture (an explicit investor instruction). */
export async function insertFinAdjustment(
  userId: string,
  symbol: string,
  p: FinAdjustmentProposal,
  origin: FinAdjustmentOrigin,
  sources: Citation[],
  status: Extract<FinAdjustmentStatus, "suggested" | "applied"> = "suggested"
): Promise<FinAdjustment> {
  const ts = now();
  const op = p.op ?? "delta";
  const row: FinAdjustment = {
    id: uid(),
    symbol,
    op,
    metricKey: p.metricKey,
    fiscalYear: p.fiscalYear,
    delta: op === "delta" ? p.delta : 0,
    value: op === "set" && p.value != null && Number.isFinite(p.value) ? p.value : null,
    rowLabel: op === "addRow" ? (p.rowLabel ?? "").trim().slice(0, 80) || null : null,
    rowFormat: op === "addRow" ? (p.rowFormat ?? "money") : null,
    rowGroup: op === "addRow" ? (p.rowGroup ?? "custom") : null,
    cells: op === "addRow" ? (p.cells ?? null) : null,
    title: p.title.trim().slice(0, 160),
    rationale: p.rationale.trim().slice(0, 1200),
    kind: p.kind === "growth" ? "growth" : "noise",
    origin,
    status,
    sources,
    createdAt: ts,
    appliedAt: status === "applied" ? ts : null,
    decidedAt: null,
  };
  await q`INSERT INTO fin_adjustments (id, "userId", symbol, op, "metricKey", "fiscalYear", delta, value, "rowLabel", "rowFormat", "rowGroup", cells, title, rationale, kind, origin, status, sources, "createdAt", "appliedAt")
          VALUES (${row.id}, ${userId}, ${row.symbol}, ${row.op}, ${row.metricKey}, ${row.fiscalYear}, ${row.delta},
                  ${row.value}, ${row.rowLabel}, ${row.rowFormat}, ${row.rowGroup},
                  ${row.cells ? JSON.stringify(row.cells) : null},
                  ${row.title}, ${row.rationale}, ${row.kind}, ${row.origin}, ${row.status},
                  ${JSON.stringify(row.sources)}, ${row.createdAt}, ${row.appliedAt})`;
  return row;
}

/**
 * Gated status transitions — each guarded to its legal predecessor so a stale
 * click can't double-apply or resurrect a decided row. Returns the updated
 * adjustment, or undefined when the transition didn't apply.
 *   apply:   suggested → applied      (the investor's approval)
 *   dismiss: suggested → dismissed    (rejected; stays in history)
 *   revert:  applied   → reverted     (undone; stays in history)
 */
export async function transitionFinAdjustment(
  userId: string,
  id: string,
  action: "apply" | "dismiss" | "revert"
): Promise<FinAdjustment | undefined> {
  const ts = now();
  let rows: FinAdjustmentRow[];
  if (action === "apply") {
    rows = await q<FinAdjustmentRow>`
      UPDATE fin_adjustments SET status = 'applied', "appliedAt" = ${ts}
      WHERE id = ${id} AND "userId" = ${userId} AND status = 'suggested' RETURNING *`;
  } else if (action === "dismiss") {
    rows = await q<FinAdjustmentRow>`
      UPDATE fin_adjustments SET status = 'dismissed', "decidedAt" = ${ts}
      WHERE id = ${id} AND "userId" = ${userId} AND status = 'suggested' RETURNING *`;
  } else {
    rows = await q<FinAdjustmentRow>`
      UPDATE fin_adjustments SET status = 'reverted', "decidedAt" = ${ts}
      WHERE id = ${id} AND "userId" = ${userId} AND status = 'applied' RETURNING *`;
  }
  return rows[0] ? parseFinAdjustment(rows[0]) : undefined;
}

/** Append one entry to the cleansing audit log (never updated, never deleted). */
export async function insertFinCleansingEvent(
  userId: string,
  symbol: string,
  adjustmentId: string,
  action: FinCleansingEvent["action"],
  detail: string
): Promise<void> {
  await q`INSERT INTO fin_cleansing_events (id, "userId", symbol, "adjustmentId", action, detail, at)
          VALUES (${uid()}, ${userId}, ${symbol}, ${adjustmentId}, ${action}, ${detail.slice(0, 400)}, ${now()})`;
}

/** The cleansing audit log, newest first. */
export async function listFinCleansingEvents(
  userId: string,
  symbol: string,
  limit = 200
): Promise<FinCleansingEvent[]> {
  return q<FinCleansingEvent>`
    SELECT id, symbol, "adjustmentId", action, detail, at
    FROM fin_cleansing_events WHERE "userId" = ${userId} AND symbol = ${symbol}
    ORDER BY seq DESC LIMIT ${limit}`;
}

// ---------- suggestion passes (the finance bench's research-run analogue) ----------

export async function createFinSuggestRun(userId: string, symbol: string): Promise<FinSuggestRun> {
  const run: FinSuggestRun = {
    id: uid(),
    symbol,
    status: "running",
    note: null,
    proposalCount: 0,
    error: null,
    createdAt: now(),
    finishedAt: null,
  };
  await q`INSERT INTO fin_suggest_runs (id, "userId", symbol, status, "createdAt")
          VALUES (${run.id}, ${userId}, ${run.symbol}, 'running', ${run.createdAt})`;
  return run;
}

/** Complete a pass (running-only guard — a stopped pass can't resurrect). */
export async function finishFinSuggestRun(id: string, note: string, proposalCount: number): Promise<void> {
  await q`UPDATE fin_suggest_runs SET status = 'done', note = ${note}, "proposalCount" = ${proposalCount},
          "finishedAt" = ${now()} WHERE id = ${id} AND status = 'running'`;
}

export async function failFinSuggestRun(id: string, error: string): Promise<void> {
  await q`UPDATE fin_suggest_runs SET status = 'error', error = ${error}, "finishedAt" = ${now()}
          WHERE id = ${id} AND status = 'running'`;
}

/** Stop the in-flight pass on the investor's command; true if one was stopped. */
export async function stopFinSuggestRun(userId: string, symbol: string): Promise<boolean> {
  const rows = await q<{ id: string }>`
    UPDATE fin_suggest_runs SET status = 'stopped',
           error = 'Stopped — start a fresh pass when ready.', "finishedAt" = ${now()}
    WHERE "userId" = ${userId} AND symbol = ${symbol} AND status = 'running'
    RETURNING id`;
  return rows.length > 0;
}

/** A pass's current status (for the pipeline's cooperative-cancellation checkpoints). */
export async function finSuggestRunStatus(id: string): Promise<string | undefined> {
  const rows = await q<{ status: string }>`SELECT status FROM fin_suggest_runs WHERE id = ${id}`;
  return rows[0]?.status;
}

export async function latestFinSuggestRun(
  userId: string,
  symbol: string
): Promise<FinSuggestRun | undefined> {
  const rows = await q<FinSuggestRun>`
    SELECT id, symbol, status, note, "proposalCount", error, "createdAt", "finishedAt"
    FROM fin_suggest_runs WHERE "userId" = ${userId} AND symbol = ${symbol}
    ORDER BY "createdAt" DESC LIMIT 1`;
  return rows[0];
}

/** Mark passes stuck in 'running' for over 15 minutes as failed (instance died mid-pass). */
export async function reapStuckFinSuggestRuns(userId: string, symbol: string): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  await q`UPDATE fin_suggest_runs SET status = 'error',
          error = 'Pass interrupted (server restarted mid-pass). Run it again.', "finishedAt" = ${now()}
          WHERE "userId" = ${userId} AND symbol = ${symbol} AND status = 'running' AND "createdAt" < ${cutoff}`;
}

// ---------- the financial analyst desk's thread ----------

interface FinMessageRow extends Omit<FinMessage, "adjustmentIds"> {
  adjustmentIds: string;
}

export async function insertFinMessage(
  userId: string,
  symbol: string,
  role: "user" | "assistant",
  content: string,
  adjustmentIds: string[] = []
): Promise<FinMessage> {
  const m: FinMessage = {
    id: uid(),
    symbol,
    role,
    content,
    adjustmentIds,
    createdAt: now(),
  };
  await q`INSERT INTO fin_messages (id, "userId", symbol, role, content, "adjustmentIds", "createdAt")
          VALUES (${m.id}, ${userId}, ${m.symbol}, ${m.role}, ${m.content}, ${JSON.stringify(m.adjustmentIds)}, ${m.createdAt})`;
  return m;
}

export async function listFinMessages(
  userId: string,
  symbol: string,
  limit = 200
): Promise<FinMessage[]> {
  const rows = await q<FinMessageRow>`
    SELECT id, symbol, role, content, "adjustmentIds", "createdAt"
    FROM fin_messages WHERE "userId" = ${userId} AND symbol = ${symbol}
    ORDER BY seq ASC LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, adjustmentIds: JSON.parse(r.adjustmentIds) as string[] }));
}

/** The NEWEST analyst-desk messages (desk search — see recentMessages). */
export async function recentFinMessages(
  userId: string,
  symbol: string,
  limit = 400
): Promise<FinMessage[]> {
  const rows = await q<FinMessageRow>`
    SELECT id, symbol, role, content, "adjustmentIds", "createdAt"
    FROM fin_messages WHERE "userId" = ${userId} AND symbol = ${symbol}
    ORDER BY seq DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, adjustmentIds: JSON.parse(r.adjustmentIds) as string[] }));
}

// ---------- the desk's context board (behind-the-scenes run memory) ----------

export async function getDeskContext(
  userId: string,
  symbol: string
): Promise<DeskContext | undefined> {
  const rows = await q<DeskContext>`
    SELECT symbol, content, "runId", "updatedAt" FROM desk_context
    WHERE "userId" = ${userId} AND symbol = ${symbol}`;
  return rows[0];
}

export async function saveDeskContext(
  userId: string,
  symbol: string,
  content: string,
  runId: string | null
): Promise<void> {
  await q`INSERT INTO desk_context ("userId", symbol, content, "runId", "updatedAt")
          VALUES (${userId}, ${symbol}, ${content}, ${runId}, ${now()})
          ON CONFLICT ("userId", symbol) DO UPDATE SET content = EXCLUDED.content,
            "runId" = EXCLUDED."runId", "updatedAt" = EXCLUDED."updatedAt"`;
}

// ---------- text annotations (highlight-by-selection) ----------

export async function listAnnotations(userId: string, symbol: string): Promise<Annotation[]> {
  return q<Annotation>`
    SELECT id, symbol, "surfaceId", "selectedText", "startOffset", "endOffset", color, comment, "createdAt"
    FROM annotations WHERE "userId" = ${userId} AND symbol = ${symbol} ORDER BY "createdAt" ASC`;
}

export async function createAnnotation(
  userId: string,
  symbol: string,
  a: Pick<Annotation, "surfaceId" | "selectedText" | "startOffset" | "endOffset" | "color" | "comment">
): Promise<Annotation> {
  const row: Annotation = {
    id: uid(),
    symbol,
    surfaceId: a.surfaceId.slice(0, 120),
    selectedText: a.selectedText.slice(0, 2000),
    startOffset: a.startOffset,
    endOffset: a.endOffset,
    color: a.color,
    comment: a.comment?.trim().slice(0, 1000) || null,
    createdAt: now(),
  };
  await q`INSERT INTO annotations (id, "userId", symbol, "surfaceId", "selectedText", "startOffset", "endOffset", color, comment, "createdAt")
          VALUES (${row.id}, ${userId}, ${row.symbol}, ${row.surfaceId}, ${row.selectedText}, ${row.startOffset},
                  ${row.endOffset}, ${row.color}, ${row.comment}, ${row.createdAt})`;
  return row;
}

export async function deleteAnnotation(userId: string, id: string): Promise<void> {
  await q`DELETE FROM annotations WHERE id = ${id} AND "userId" = ${userId}`;
}

// ---------- trades (portfolio ledger) ----------

export async function insertTrade(userId: string, t: Omit<Trade, "id" | "createdAt">): Promise<Trade> {
  const trade: Trade = { ...t, id: uid(), createdAt: now() };
  await q`INSERT INTO trades (id, "userId", symbol, kind, side, quantity, price, fees, "tradeDate",
                              "optionType", strike, expiry, multiplier, note, "createdAt")
          VALUES (${trade.id}, ${userId}, ${trade.symbol}, ${trade.kind}, ${trade.side}, ${trade.quantity},
                  ${trade.price}, ${trade.fees}, ${trade.tradeDate}, ${trade.optionType},
                  ${trade.strike}, ${trade.expiry}, ${trade.multiplier}, ${trade.note}, ${trade.createdAt})`;
  return trade;
}

export async function deleteTrade(userId: string, id: string): Promise<void> {
  await q`DELETE FROM trades WHERE "userId" = ${userId} AND id = ${id}`;
}

export async function listTrades(userId: string, symbol?: string): Promise<Trade[]> {
  if (symbol) {
    return q<Trade>`SELECT * FROM trades WHERE "userId" = ${userId} AND symbol = ${symbol} ORDER BY "tradeDate" ASC, "createdAt" ASC`;
  }
  return q<Trade>`SELECT * FROM trades WHERE "userId" = ${userId} ORDER BY "tradeDate" ASC, "createdAt" ASC`;
}

// ---------- orders (paper execution against live quotes) ----------

export async function insertOrder(
  userId: string,
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
  await q`INSERT INTO orders (id, "userId", symbol, side, quantity, "orderType", "limitPrice", "stopPrice",
                              tif, status, "placedAt", note)
          VALUES (${order.id}, ${userId}, ${order.symbol}, ${order.side}, ${order.quantity}, ${order.orderType},
                  ${order.limitPrice}, ${order.stopPrice}, ${order.tif}, ${order.status},
                  ${order.placedAt}, ${order.note})`;
  return order;
}

export async function getOrder(id: string): Promise<Order | null> {
  const rows = await q<Order>`SELECT * FROM orders WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function listOpenOrders(userId: string): Promise<Order[]> {
  return q<Order>`SELECT * FROM orders WHERE "userId" = ${userId} AND status = 'open' ORDER BY "placedAt" ASC`;
}

/** Completed orders (filled/canceled/expired), newest first. */
export async function listOrderHistory(userId: string, limit = 30): Promise<Order[]> {
  return q<Order>`SELECT * FROM orders WHERE "userId" = ${userId} AND status <> 'open'
                  ORDER BY COALESCE("filledAt", "placedAt") DESC LIMIT ${limit}`;
}

/** Cancel a working order; returns false if it wasn't open (e.g. already filled). */
export async function cancelOrder(userId: string, id: string): Promise<boolean> {
  const rows = await q<{ id: string }>`UPDATE orders SET status = 'canceled'
    WHERE "userId" = ${userId} AND id = ${id} AND status = 'open' RETURNING id`;
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
  userId: string,
  d: Omit<DividendReceipt, "id" | "appliedAt">
): Promise<DividendReceipt | null> {
  const rec: DividendReceipt = { ...d, id: uid(), appliedAt: now() };
  // The unique (userId, symbol, exDate) key makes double-applies a no-op.
  const rows = await q<{ id: string }>`INSERT INTO dividends
      (id, "userId", symbol, "exDate", "perShare", shares, amount, currency, "withholdingPct",
       reinvested, "reinvestTradeId", "appliedAt")
    VALUES (${rec.id}, ${userId}, ${rec.symbol}, ${rec.exDate}, ${rec.perShare}, ${rec.shares}, ${rec.amount},
            ${rec.currency}, ${rec.withholdingPct}, ${rec.reinvested}, ${rec.reinvestTradeId}, ${rec.appliedAt})
    ON CONFLICT ("userId", symbol, "exDate") DO NOTHING RETURNING id`;
  return rows.length > 0 ? rec : null;
}

export async function listDividends(userId: string, symbol?: string): Promise<DividendReceipt[]> {
  if (symbol) {
    return q<DividendReceipt>`SELECT * FROM dividends WHERE "userId" = ${userId} AND symbol = ${symbol} ORDER BY "exDate" DESC`;
  }
  return q<DividendReceipt>`SELECT * FROM dividends WHERE "userId" = ${userId} ORDER BY "exDate" DESC`;
}

/** Per-symbol dividend-reinvestment setting (default off = receive cash). */
export async function dripEnabled(userId: string, symbol: string): Promise<boolean> {
  return (await getSetting(userId, `drip:${symbol.toUpperCase()}`)) === "on";
}

export async function setDrip(userId: string, symbol: string, on: boolean): Promise<void> {
  await setSetting(userId, `drip:${symbol.toUpperCase()}`, on ? "on" : "off");
}

/** Starting cash (USD) the book is run against; null = not set. */
export async function getInitialCapital(userId: string): Promise<number | null> {
  const v = await getSetting(userId, "initialCapital");
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function setInitialCapital(userId: string, amount: number | null): Promise<void> {
  await setSetting(userId, "initialCapital", amount == null ? "" : String(amount));
}

/**
 * Wipe the whole book: trades, orders, dividend receipts. Settings (initial
 * capital, DRIP flags, auto-research) survive — this resets the ledger, not
 * the configuration. Returns what was deleted so the UI can confirm honestly.
 */
export async function clearPortfolio(userId: string): Promise<{ trades: number; orders: number; dividends: number }> {
  const [t, o, d] = await Promise.all([
    q<{ id: string }>`DELETE FROM trades WHERE "userId" = ${userId} RETURNING id`,
    q<{ id: string }>`DELETE FROM orders WHERE "userId" = ${userId} RETURNING id`,
    q<{ id: string }>`DELETE FROM dividends WHERE "userId" = ${userId} RETURNING id`,
  ]);
  return { trades: t.length, orders: o.length, dividends: d.length };
}

// ---------- users & sessions (Google sign-in) ----------

const TENANT_TABLES = [
  "tickers", "focus_areas", "signals", "digest_items", "runs",
  "messages", "trades", "orders", "dividends", "settings",
] as const;

/**
 * Upsert the signed-in Google account. The FIRST account ever created — or
 * any email in ADMIN_EMAILS — becomes an admin; admins adopt the pre-auth
 * single-user ('local') data on first sign-in so the owner keeps their desks.
 */
export async function upsertUser(profile: {
  email: string;
  name: string;
  picture: string;
}): Promise<User> {
  const email = profile.email.toLowerCase();
  const existing = await q<User>`SELECT * FROM users WHERE email = ${email}`;
  if (existing[0]) {
    await q`UPDATE users SET name = ${profile.name}, picture = ${profile.picture},
            "lastSeenAt" = ${now()} WHERE id = ${existing[0].id}`;
    return { ...existing[0], name: profile.name, picture: profile.picture };
  }
  const count = await q<{ n: string }>`SELECT count(*) AS n FROM users`;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const role = Number(count[0]?.n ?? 0) === 0 || adminEmails.includes(email) ? "admin" : "user";
  const user: User = {
    id: uid(),
    email,
    name: profile.name,
    picture: profile.picture,
    role,
    createdAt: now(),
    lastSeenAt: now(),
  };
  await q`INSERT INTO users (id, email, name, picture, role, "createdAt", "lastSeenAt")
          VALUES (${user.id}, ${user.email}, ${user.name}, ${user.picture}, ${user.role},
                  ${user.createdAt}, ${user.lastSeenAt})`;
  if (role === "admin") await adoptLegacyData(user.id);
  return user;
}

/** Move pre-auth ('local') rows to the first admin so their desks survive sign-in. */
export async function adoptLegacyData(userId: string): Promise<void> {
  for (const table of TENANT_TABLES) {
    await sqlClient().query(`UPDATE ${table} SET "userId" = $1 WHERE "userId" = 'local'`, [userId]);
  }
}

export async function getUser(id: string): Promise<User | null> {
  const rows = await q<User>`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ?? null;
}

/** Look a user up by email (lowercased) — used by the admin email gate. */
export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await q<User>`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  return rows[0] ?? null;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = uid() + uid().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  await q`INSERT INTO sessions (token, "userId", "createdAt", "expiresAt")
          VALUES (${token}, ${userId}, ${now()}, ${expiresAt})`;
  return { token, expiresAt };
}

export async function getSessionUser(token: string): Promise<User | null> {
  const rows = await q<User & { expiresAt: string }>`
    SELECT u.*, s."expiresAt" FROM sessions s JOIN users u ON u.id = s."userId"
    WHERE s.token = ${token}`;
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt < now()) {
    await q`DELETE FROM sessions WHERE token = ${token}`;
    return null;
  }
  return {
    id: row.id, email: row.email, name: row.name, picture: row.picture,
    role: row.role, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await q`DELETE FROM sessions WHERE token = ${token}`;
}

/** Throttled activity stamp (at most ~once per 5 minutes per request path). */
export async function touchLastSeen(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  await q`UPDATE users SET "lastSeenAt" = ${now()} WHERE id = ${userId} AND "lastSeenAt" < ${cutoff}`;
}

/** The admin console's per-user activity aggregates, in a handful of grouped queries. */
export async function listUsersWithStats(): Promise<AdminUserRow[]> {
  const users = await q<User>`SELECT * FROM users ORDER BY "createdAt" ASC`;
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [tickers, signals, runs, messages, trades, logins, fb, profiles] = await Promise.all([
    q<{ userId: string; n: string }>`SELECT "userId", count(*) AS n FROM tickers GROUP BY "userId"`,
    q<{ userId: string; n: string }>`SELECT "userId", count(*) AS n FROM signals WHERE status = 'active' GROUP BY "userId"`,
    q<{ userId: string; n: string; last: string | null }>`SELECT "userId", count(*) AS n, max("startedAt") AS last FROM runs GROUP BY "userId"`,
    q<{ userId: string; n: string }>`SELECT "userId", count(*) AS n FROM messages WHERE role = 'user' GROUP BY "userId"`,
    q<{ userId: string; n: string }>`SELECT "userId", count(*) AS n FROM trades GROUP BY "userId"`,
    q<{ userId: string; n: string }>`SELECT "userId", count(*) AS n FROM sessions WHERE "createdAt" > ${since7} GROUP BY "userId"`,
    q<{ userId: string; n: string }>`SELECT "userId", count(*) AS n FROM feedback GROUP BY "userId"`,
    q<{ userId: string; value: string }>`SELECT "userId", value FROM settings WHERE key = 'profile'`,
  ]);
  const by = <T extends { userId: string }>(rows: T[]) => new Map(rows.map((r) => [r.userId, r]));
  const t = by(tickers), sg = by(signals), rn = by(runs), ms = by(messages), tr = by(trades);
  const lg = by(logins), f = by(fb), pf = by(profiles);
  const parseProfile = (raw: string | undefined): AdminUserRow["profile"] => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AdminUserRow["profile"];
    } catch {
      return null;
    }
  };
  return users.map((user) => ({
    user,
    tickers: Number(t.get(user.id)?.n ?? 0),
    activeSignals: Number(sg.get(user.id)?.n ?? 0),
    runs: Number(rn.get(user.id)?.n ?? 0),
    lastRunAt: rn.get(user.id)?.last ?? null,
    messages: Number(ms.get(user.id)?.n ?? 0),
    trades: Number(tr.get(user.id)?.n ?? 0),
    logins7d: Number(lg.get(user.id)?.n ?? 0),
    feedback: Number(f.get(user.id)?.n ?? 0),
    profile: parseProfile(pf.get(user.id)?.value),
  }));
}

// ---------- AI usage telemetry ----------

export interface UsageEventInput {
  userId?: string | null;
  provider: string;
  model: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

/** Persist one model-call usage row. Callers treat this as fire-and-forget. */
export async function insertUsageEvent(e: UsageEventInput): Promise<void> {
  await q`INSERT INTO usage_events
          (id, ts, "userId", provider, model, feature,
           "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens", "costUsd")
          VALUES (${uid()}, ${now()}, ${e.userId ?? null}, ${e.provider}, ${e.model}, ${e.feature},
                  ${e.inputTokens}, ${e.outputTokens}, ${e.cacheReadTokens}, ${e.cacheWriteTokens}, ${e.costUsd})`;
}

export interface UsageSummary {
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    costUsd: number;
    /** Cost over the trailing 30 days (the projected-month basis). */
    cost30d: number;
  };
  byModel: { model: string; calls: number; tokens: number; costUsd: number }[];
  byFeature: { feature: string; calls: number; tokens: number; costUsd: number }[];
  byUser: {
    userId: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    /** Cost of research-run features only (scouts/triage/synthesis/backstory), this window. */
    researchCostUsd: number;
    /** Research runs started in this window — the denominator for avgCostPerRun. */
    runs: number;
    /** Average cost per research run = researchCostUsd / runs (0 when no runs). */
    avgCostPerRun: number;
  }[];
  /** Daily cost, oldest → newest (gaps = no spend that day). */
  byDay: { day: string; costUsd: number }[];
}

/** usage_event.feature values that belong to a daily research run (vs chat/compare/translate). */
const RESEARCH_FEATURES = [
  "scoutBreadth",
  "triage",
  "scoutDeep",
  "synthesis",
  "backstory",
  "questions",
  "contextBoard",
];

/** Aggregates over the trailing `days` window, in a handful of grouped queries. */
export async function usageSummary(days: number): Promise<UsageSummary> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [totals, cost30, byModel, byFeature, byUser, runsByUser, byDay] = await Promise.all([
    q<{ calls: string; inp: string | null; outp: string | null; cr: string | null; cost: number | null }>`
      SELECT count(*) AS calls, sum("inputTokens") AS inp, sum("outputTokens") AS outp,
             sum("cacheReadTokens") AS cr, sum("costUsd") AS cost
      FROM usage_events WHERE ts > ${since}`,
    q<{ cost: number | null }>`SELECT sum("costUsd") AS cost FROM usage_events WHERE ts > ${since30}`,
    q<{ model: string; calls: string; tokens: string | null; cost: number | null }>`
      SELECT model, count(*) AS calls, sum("inputTokens" + "outputTokens") AS tokens, sum("costUsd") AS cost
      FROM usage_events WHERE ts > ${since} GROUP BY model ORDER BY sum("costUsd") DESC`,
    q<{ feature: string; calls: string; tokens: string | null; cost: number | null }>`
      SELECT feature, count(*) AS calls, sum("inputTokens" + "outputTokens") AS tokens, sum("costUsd") AS cost
      FROM usage_events WHERE ts > ${since} GROUP BY feature ORDER BY sum("costUsd") DESC`,
    q<{ userId: string | null; calls: string; inp: string | null; outp: string | null; cost: number | null; rcost: number | null }>`
      SELECT "userId", count(*) AS calls, sum("inputTokens") AS inp, sum("outputTokens") AS outp,
             sum("costUsd") AS cost,
             sum("costUsd") FILTER (WHERE feature = ANY(${RESEARCH_FEATURES})) AS rcost
      FROM usage_events WHERE ts > ${since} GROUP BY "userId" ORDER BY sum("costUsd") DESC`,
    q<{ userId: string | null; n: string }>`
      SELECT "userId", count(*) AS n FROM runs WHERE "startedAt" > ${since} GROUP BY "userId"`,
    q<{ day: string; cost: number | null }>`
      SELECT substr(ts, 1, 10) AS day, sum("costUsd") AS cost
      FROM usage_events WHERE ts > ${since30} GROUP BY substr(ts, 1, 10) ORDER BY day ASC`,
  ]);
  const runsMap = new Map(runsByUser.map((r) => [r.userId ?? "", Number(r.n)]));
  return {
    totals: {
      calls: Number(totals[0]?.calls ?? 0),
      inputTokens: Number(totals[0]?.inp ?? 0),
      outputTokens: Number(totals[0]?.outp ?? 0),
      cacheReadTokens: Number(totals[0]?.cr ?? 0),
      costUsd: Number(totals[0]?.cost ?? 0),
      cost30d: Number(cost30[0]?.cost ?? 0),
    },
    byModel: byModel.map((r) => ({ model: r.model, calls: Number(r.calls), tokens: Number(r.tokens ?? 0), costUsd: Number(r.cost ?? 0) })),
    byFeature: byFeature.map((r) => ({ feature: r.feature, calls: Number(r.calls), tokens: Number(r.tokens ?? 0), costUsd: Number(r.cost ?? 0) })),
    byUser: byUser.map((r) => {
      const userId = r.userId ?? "system";
      const researchCostUsd = Number(r.rcost ?? 0);
      const runs = Number(runsMap.get(r.userId ?? "") ?? 0);
      return {
        userId,
        calls: Number(r.calls),
        inputTokens: Number(r.inp ?? 0),
        outputTokens: Number(r.outp ?? 0),
        costUsd: Number(r.cost ?? 0),
        researchCostUsd,
        runs,
        avgCostPerRun: runs > 0 ? researchCostUsd / runs : 0,
      };
    }),
    byDay: byDay.map((r) => ({ day: r.day, costUsd: Number(r.cost ?? 0) })),
  };
}

/** Wipe all cost/usage telemetry (admin "clear cost data"). */
export async function clearUsage(): Promise<number> {
  const rows = await q<{ n: string }>`
    WITH deleted AS (DELETE FROM usage_events RETURNING 1) SELECT count(*) AS n FROM deleted`;
  return Number(rows[0]?.n ?? 0);
}

/** Sign-ins per day (sessions created), oldest → newest, trailing `days`. */
export async function loginsPerDay(days: number): Promise<{ day: string; logins: number }[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await q<{ day: string; n: string }>`
    SELECT substr("createdAt", 1, 10) AS day, count(*) AS n
    FROM sessions WHERE "createdAt" > ${since}
    GROUP BY substr("createdAt", 1, 10) ORDER BY day ASC`;
  return rows.map((r) => ({ day: r.day, logins: Number(r.n) }));
}

// ---------- feedback & support ----------

/** Unambiguous alphabet (no 0/O/1/I/L) for human-friendly request IDs. */
const FEEDBACK_ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function mintFeedbackId(): string {
  const bytes = randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += FEEDBACK_ID_ALPHABET[bytes[i] % FEEDBACK_ID_ALPHABET.length];
  return `SCL-${s}`;
}

type FeedbackRow = Omit<FeedbackTicket, "messages">;
interface FeedbackMessageRow extends Omit<FeedbackMessage, "attachments"> {
  attachments: string;
}

const toFeedbackMessage = (r: FeedbackMessageRow): FeedbackMessage => ({
  id: r.id,
  feedbackId: r.feedbackId,
  role: r.role,
  body: r.body,
  attachments: JSON.parse(r.attachments) as Attachment[],
  createdAt: r.createdAt,
});

/** Drop attachment payloads for list views (keep name/kind/size for chips). */
export function stripAttachmentData(m: FeedbackMessage): FeedbackMessage {
  return {
    ...m,
    attachments: m.attachments.map((a) => ({
      kind: a.kind,
      name: a.name,
      mediaType: a.mediaType,
      size: a.size,
    })),
  };
}

/** Tickets a user filed in the last 24h — the new-request rate-limit input. */
export async function countRecentFeedback(userId: string): Promise<number> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const rows = await q<{ n: string }>`
    SELECT count(*) AS n FROM feedback WHERE "userId" = ${userId} AND "createdAt" > ${since}`;
  return Number(rows[0]?.n ?? 0);
}

export async function createFeedback(
  userId: string,
  category: FeedbackCategory,
  subject: string,
  body: string,
  attachments: Attachment[]
): Promise<FeedbackTicket> {
  const ts = now();
  // Request IDs are short for humans — retry the rare collision.
  for (let attempt = 0; ; attempt++) {
    const id = mintFeedbackId();
    try {
      await q`INSERT INTO feedback (id, "userId", category, subject, status, "createdAt", "updatedAt")
              VALUES (${id}, ${userId}, ${category}, ${subject}, 'open', ${ts}, ${ts})`;
      const msg: FeedbackMessage = {
        id: uid(),
        feedbackId: id,
        role: "user",
        body,
        attachments,
        createdAt: ts,
      };
      await q`INSERT INTO feedback_messages (id, "feedbackId", role, body, attachments, "createdAt")
              VALUES (${msg.id}, ${id}, 'user', ${body}, ${JSON.stringify(attachments)}, ${ts})`;
      return { id, userId, category, subject, status: "open", createdAt: ts, updatedAt: ts, messages: [msg] };
    } catch (e) {
      if (attempt < 3 && e instanceof Error && /duplicate key|unique/i.test(e.message)) continue;
      throw e;
    }
  }
}

async function feedbackMessages(feedbackId: string): Promise<FeedbackMessage[]> {
  const rows = await q<FeedbackMessageRow>`
    SELECT * FROM feedback_messages WHERE "feedbackId" = ${feedbackId} ORDER BY seq ASC`;
  return rows.map(toFeedbackMessage);
}

/** A user's tickets, newest activity first, with attachment payloads stripped. */
export async function listFeedback(userId: string): Promise<FeedbackTicket[]> {
  const tickets = await q<FeedbackRow>`
    SELECT * FROM feedback WHERE "userId" = ${userId} ORDER BY "updatedAt" DESC`;
  if (tickets.length === 0) return [];
  const msgs = await q<FeedbackMessageRow>`
    SELECT m.* FROM feedback_messages m JOIN feedback f ON f.id = m."feedbackId"
    WHERE f."userId" = ${userId} ORDER BY m.seq ASC`;
  const byTicket = new Map<string, FeedbackMessage[]>();
  for (const r of msgs) {
    const m = stripAttachmentData(toFeedbackMessage(r));
    (byTicket.get(m.feedbackId) ?? byTicket.set(m.feedbackId, []).get(m.feedbackId)!).push(m);
  }
  return tickets.map((t) => ({ ...t, messages: byTicket.get(t.id) ?? [] }));
}

/** One ticket with the full thread (attachment payloads included). */
export async function getFeedback(id: string): Promise<FeedbackTicket | null> {
  const rows = await q<FeedbackRow>`SELECT * FROM feedback WHERE id = ${id}`;
  const t = rows[0];
  if (!t) return null;
  return { ...t, messages: await feedbackMessages(id) };
}

/**
 * Append to a ticket's thread. A user message re-opens the ticket (replying to
 * a response or a closed case reactivates it, Amazon-style); an admin message
 * marks it responded.
 */
export async function addFeedbackMessage(
  feedbackId: string,
  role: "user" | "admin",
  body: string,
  attachments: Attachment[]
): Promise<FeedbackMessage> {
  const m: FeedbackMessage = { id: uid(), feedbackId, role, body, attachments, createdAt: now() };
  await q`INSERT INTO feedback_messages (id, "feedbackId", role, body, attachments, "createdAt")
          VALUES (${m.id}, ${feedbackId}, ${role}, ${body}, ${JSON.stringify(attachments)}, ${m.createdAt})`;
  const status: FeedbackStatus = role === "admin" ? "responded" : "open";
  await q`UPDATE feedback SET status = ${status}, "updatedAt" = ${m.createdAt} WHERE id = ${feedbackId}`;
  return m;
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  await q`UPDATE feedback SET status = ${status}, "updatedAt" = ${now()} WHERE id = ${id}`;
}

/** Admin inbox: every ticket with requester identity, newest activity first. */
export async function listAllFeedback(): Promise<AdminFeedbackRow[]> {
  const tickets = await q<FeedbackRow & { email: string; name: string; picture: string }>`
    SELECT f.*, u.email, u.name, u.picture FROM feedback f
    LEFT JOIN users u ON u.id = f."userId" ORDER BY f."updatedAt" DESC`;
  if (tickets.length === 0) return [];
  const msgs = await q<FeedbackMessageRow>`SELECT * FROM feedback_messages ORDER BY seq ASC`;
  const byTicket = new Map<string, FeedbackMessage[]>();
  for (const r of msgs) {
    const m = stripAttachmentData(toFeedbackMessage(r));
    (byTicket.get(m.feedbackId) ?? byTicket.set(m.feedbackId, []).get(m.feedbackId)!).push(m);
  }
  return tickets.map(({ email, name, picture, ...t }) => ({
    ticket: { ...t, messages: byTicket.get(t.id) ?? [] },
    user: {
      id: t.userId,
      email: email ?? (t.userId === "local" ? "local@scalae" : t.userId),
      name: name ?? "Local investor",
      picture: picture ?? "",
    },
  }));
}
