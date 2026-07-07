/**
 * One-time migration: copy the local SQLite desks (data/scalae.db) into the
 * Neon Postgres database, so the cloud app starts with your existing data.
 * Idempotent — rows that already exist are skipped.
 *
 * Usage: DATABASE_URL comes from .env.local (via `vercel env pull`) or env.
 *   npm run db:migrate
 */
import Database from "better-sqlite3";
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

// Minimal .env.local loader (no dotenv dependency).
if (!process.env.DATABASE_URL) {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — run `vercel env pull .env.local` first.");
  process.exit(1);
}

const sqlitePath = path.join(process.cwd(), "data", "scalae.db");
if (!fs.existsSync(sqlitePath)) {
  console.error(`No local database at ${sqlitePath} — nothing to migrate.`);
  process.exit(0);
}

const sqlite = new Database(sqlitePath, { readonly: true });
const sql = neon(process.env.DATABASE_URL);

// Schema must exist before inserts (mirror of SCHEMA_STATEMENTS in lib/db.ts).
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tickers (symbol TEXT PRIMARY KEY, name TEXT NOT NULL, "addedAt" TEXT NOT NULL, onboarded INTEGER NOT NULL DEFAULT 0, "lastRunAt" TEXT)`,
  `CREATE TABLE IF NOT EXISTS focus_areas (id TEXT PRIMARY KEY, symbol TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', "createdAt" TEXT NOT NULL, UNIQUE(symbol, title))`,
  `CREATE TABLE IF NOT EXISTS signals (id TEXT PRIMARY KEY, symbol TEXT NOT NULL, "focusArea" TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, thesis TEXT NOT NULL DEFAULT '', "measurementPlan" TEXT NOT NULL DEFAULT '', scale TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, origin TEXT NOT NULL, "createdAt" TEXT NOT NULL, "approvedAt" TEXT)`,
  `CREATE TABLE IF NOT EXISTS readings (id TEXT PRIMARY KEY, "signalId" TEXT NOT NULL, "runId" TEXT NOT NULL, date TEXT NOT NULL, value DOUBLE PRECISION, "valueUnit" TEXT, level TEXT NOT NULL, delta TEXT NOT NULL, confidence DOUBLE PRECISION NOT NULL, rationale TEXT NOT NULL, citations TEXT NOT NULL DEFAULT '[]')`,
  `CREATE TABLE IF NOT EXISTS digest_items (id TEXT PRIMARY KEY, symbol TEXT NOT NULL, "runId" TEXT NOT NULL, date TEXT NOT NULL, headline TEXT NOT NULL, summary TEXT NOT NULL, url TEXT, source TEXT, impact TEXT NOT NULL, "signalNames" TEXT NOT NULL DEFAULT '[]', seq BIGINT GENERATED ALWAYS AS IDENTITY)`,
  `CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, symbol TEXT NOT NULL, "startedAt" TEXT NOT NULL, "finishedAt" TEXT, status TEXT NOT NULL, stage TEXT NOT NULL DEFAULT '', "stageDetail" TEXT NOT NULL DEFAULT '', brief TEXT, error TEXT)`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, symbol TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, "proposalIds" TEXT NOT NULL DEFAULT '[]', "createdAt" TEXT NOT NULL, seq BIGINT GENERATED ALWAYS AS IDENTITY)`,
  `CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol, status)`,
  `CREATE INDEX IF NOT EXISTS idx_readings_signal ON readings("signalId", date)`,
  `CREATE INDEX IF NOT EXISTS idx_digest_symbol ON digest_items(symbol, date)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_symbol ON messages(symbol, "createdAt")`,
  `CREATE INDEX IF NOT EXISTS idx_runs_symbol ON runs(symbol, "startedAt")`,
];
for (const stmt of SCHEMA) await sql.query(stmt);

const counts = {};

async function copy(table, columns, conflictKey) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  let inserted = 0;
  for (const row of rows) {
    const cols = columns.map((c) => `"${c}"`).join(", ");
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const values = columns.map((c) => row[c] ?? null);
    const res = await sql.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictKey}) DO NOTHING`,
      values
    );
    inserted += res.length >= 0 ? 1 : 0;
  }
  counts[table] = `${rows.length} rows`;
}

await copy("tickers", ["symbol", "name", "addedAt", "onboarded", "lastRunAt"], "symbol");
await copy("focus_areas", ["id", "symbol", "title", "description", "createdAt"], "id");
await copy(
  "signals",
  ["id", "symbol", "focusArea", "name", "type", "thesis", "measurementPlan", "scale", "status", "origin", "createdAt", "approvedAt"],
  "id"
);
await copy(
  "readings",
  ["id", "signalId", "runId", "date", "value", "valueUnit", "level", "delta", "confidence", "rationale", "citations"],
  "id"
);
await copy(
  "digest_items",
  ["id", "symbol", "runId", "date", "headline", "summary", "url", "source", "impact", "signalNames"],
  "id"
);
await copy(
  "runs",
  ["id", "symbol", "startedAt", "finishedAt", "status", "stage", "stageDetail", "brief", "error"],
  "id"
);
await copy("messages", ["id", "symbol", "role", "content", "proposalIds", "createdAt"], "id");

console.log("Migrated to Neon:", counts);

// Verify
const t = await sql`SELECT count(*)::int AS n FROM tickers`;
const s = await sql`SELECT count(*)::int AS n FROM signals`;
const m = await sql`SELECT count(*)::int AS n FROM messages`;
console.log(`Neon now has: ${t[0].n} tickers, ${s[0].n} signals, ${m[0].n} messages`);
