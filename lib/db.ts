import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import type {
  ChatMessage,
  Citation,
  DigestItem,
  FocusArea,
  Reading,
  Run,
  Signal,
  SignalProposal,
  SignalStatus,
  Ticker,
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
    "createdAt" TEXT NOT NULL,
    "approvedAt" TEXT
  )`,
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
    citations TEXT NOT NULL DEFAULT '[]'
  )`,
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
    error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    "proposalIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    seq BIGINT GENERATED ALWAYS AS IDENTITY
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

/** Insert a proposal as a `suggested` signal. Skips near-duplicate names. Returns id or null. */
export async function insertProposal(
  symbol: string,
  p: SignalProposal,
  origin: Signal["origin"]
): Promise<string | null> {
  const existing = await q<{ id: string }>`
    SELECT id FROM signals
    WHERE symbol = ${symbol} AND lower(name) = lower(${p.name}) AND status IN ('suggested','active')`;
  if (existing.length > 0) return null;
  const id = uid();
  await q`INSERT INTO signals (id, symbol, "focusArea", name, type, thesis, "measurementPlan", scale, status, origin, "createdAt")
          VALUES (${id}, ${symbol}, ${p.focusArea}, ${p.name},
                  ${p.type === "quantitative" ? "quantitative" : "qualitative"},
                  ${p.thesis}, ${p.measurementPlan}, ${p.scale}, 'suggested', ${origin}, ${now()})`;
  return id;
}

export async function setSignalStatus(id: string, status: SignalStatus): Promise<void> {
  if (status === "active") {
    await q`UPDATE signals SET status = 'active', "approvedAt" = ${now()} WHERE id = ${id}`;
  } else {
    await q`UPDATE signals SET status = ${status} WHERE id = ${id}`;
  }
}

// ---------- readings ----------

interface ReadingRow extends Omit<Reading, "citations"> {
  citations: string;
}

function parseReading(r: ReadingRow): Reading {
  return { ...r, citations: JSON.parse(r.citations) as Citation[] };
}

export async function insertReading(r: Omit<Reading, "id">): Promise<Reading> {
  const id = uid();
  await q`INSERT INTO readings (id, "signalId", "runId", date, value, "valueUnit", level, delta, confidence, rationale, citations)
          VALUES (${id}, ${r.signalId}, ${r.runId}, ${r.date}, ${r.value}, ${r.valueUnit},
                  ${r.level}, ${r.delta}, ${r.confidence}, ${r.rationale}, ${JSON.stringify(r.citations)})`;
  return { ...r, id };
}

export async function readingsForSignal(signalId: string, limit = 30): Promise<Reading[]> {
  const rows = await q<ReadingRow>`
    SELECT * FROM readings WHERE "signalId" = ${signalId} ORDER BY date DESC LIMIT ${limit}`;
  return rows.map(parseReading);
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
    error: null,
  };
  await q`INSERT INTO runs (id, symbol, "startedAt", status, stage, "stageDetail")
          VALUES (${run.id}, ${run.symbol}, ${run.startedAt}, ${run.status}, ${run.stage}, ${run.stageDetail})`;
  return run;
}

export async function setRunStage(id: string, stage: string, stageDetail: string): Promise<void> {
  await q`UPDATE runs SET stage = ${stage}, "stageDetail" = ${stageDetail} WHERE id = ${id}`;
}

export async function finishRun(id: string, brief: string): Promise<void> {
  await q`UPDATE runs SET status = 'done', stage = 'done', "stageDetail" = 'Desk updated',
          brief = ${brief}, "finishedAt" = ${now()} WHERE id = ${id}`;
}

export async function failRun(id: string, error: string): Promise<void> {
  await q`UPDATE runs SET status = 'error', stage = 'error', "stageDetail" = 'Run failed',
          error = ${error}, "finishedAt" = ${now()} WHERE id = ${id}`;
}

export async function getRun(id: string): Promise<Run | undefined> {
  const rows = await q<Run>`SELECT * FROM runs WHERE id = ${id}`;
  return rows[0];
}

export async function latestRun(symbol: string): Promise<Run | undefined> {
  const rows = await q<Run>`SELECT * FROM runs WHERE symbol = ${symbol} ORDER BY "startedAt" DESC LIMIT 1`;
  return rows[0];
}

export async function runningRun(symbol: string): Promise<Run | undefined> {
  const rows = await q<Run>`
    SELECT * FROM runs WHERE symbol = ${symbol} AND status = 'running' ORDER BY "startedAt" DESC LIMIT 1`;
  return rows[0];
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

interface MessageRow extends Omit<ChatMessage, "proposalIds"> {
  proposalIds: string;
}

export async function insertMessage(
  symbol: string,
  role: "user" | "assistant",
  content: string,
  proposalIds: string[] = []
): Promise<ChatMessage> {
  const m: ChatMessage = { id: uid(), symbol, role, content, proposalIds, createdAt: now() };
  await q`INSERT INTO messages (id, symbol, role, content, "proposalIds", "createdAt")
          VALUES (${m.id}, ${m.symbol}, ${m.role}, ${m.content}, ${JSON.stringify(m.proposalIds)}, ${m.createdAt})`;
  return m;
}

export async function listMessages(symbol: string, limit = 200): Promise<ChatMessage[]> {
  const rows = await q<MessageRow>`
    SELECT id, symbol, role, content, "proposalIds", "createdAt"
    FROM messages WHERE symbol = ${symbol} ORDER BY "createdAt" ASC, seq ASC LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, proposalIds: JSON.parse(r.proposalIds) as string[] }));
}
