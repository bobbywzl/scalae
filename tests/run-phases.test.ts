/**
 * The phased-run helpers (lib/agents/phases.ts): phase order, the per-stage
 * budget inside a phase, how the continuation target resolves from the
 * deployment's environment, and how a hand-off's outcome is classified.
 *
 * Run: npm test (tsx --test). Import-light: phases.ts only — the pipeline
 * itself needs live models and a database.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  continuationBaseUrl,
  continuationTarget,
  continuationToken,
  isRunPhase,
  nextRunPhase,
  PHASE_BUDGET_MS,
  requestRunPhase,
  RUN_PHASES,
  STAGE_LIMIT_MS,
  stageBudgetMs,
  tokenMatches,
} from "../lib/agents/phases";

test("phases run sweep → probe → synthesize → enrich, then stop", () => {
  assert.deepEqual([...RUN_PHASES], ["sweep", "probe", "synthesize", "enrich"]);
  assert.equal(nextRunPhase("sweep"), "probe");
  assert.equal(nextRunPhase("probe"), "synthesize");
  assert.equal(nextRunPhase("synthesize"), "enrich");
  assert.equal(nextRunPhase("enrich"), null);
  assert.ok(isRunPhase("probe"));
  assert.ok(!isRunPhase("recording"));
  assert.ok(!isRunPhase(undefined));
});

test("a stage's budget is the stage limit, shrunk to what the phase has left", () => {
  const start = 1_000_000;
  // Fresh phase: the flat stage limit.
  assert.equal(stageBudgetMs(start, { now: start }), STAGE_LIMIT_MS);
  // Late in the phase: whatever remains minus the reserve, never the cap.
  const late = start + PHASE_BUDGET_MS - 30_000;
  assert.equal(stageBudgetMs(start, { now: late }), 20_000);
  // Past the budget: zero, never negative.
  assert.equal(stageBudgetMs(start, { now: start + PHASE_BUDGET_MS + 1 }), 0);
  // Synthesis asks for everything left (no cap) minus its recording reserve.
  const mid = start + 10_000;
  assert.equal(
    stageBudgetMs(start, { cap: Infinity, reserve: 15_000, now: mid }),
    PHASE_BUDGET_MS - 10_000 - 15_000
  );
});

test("the continuation base URL prefers APP_URL, then Vercel's system variables", () => {
  assert.equal(continuationBaseUrl({}), null);
  assert.equal(continuationBaseUrl({ APP_URL: "https://desk.example.com/" }), "https://desk.example.com");
  assert.equal(
    continuationBaseUrl({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "scalae.vercel.app",
      VERCEL_URL: "scalae-abc123.vercel.app",
    }),
    "https://scalae.vercel.app"
  );
  // A preview deployment has no production domain of its own — use its URL.
  assert.equal(
    continuationBaseUrl({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_PRODUCTION_URL: "scalae.vercel.app",
      VERCEL_URL: "scalae-abc123.vercel.app",
    }),
    "https://scalae-abc123.vercel.app"
  );
});

test("the continuation token is pinned by RUN_PHASE_SECRET or derived from an existing secret", () => {
  assert.equal(continuationToken({}), null);
  assert.equal(continuationToken({ RUN_PHASE_SECRET: " pinned " }), "pinned");
  const derived = continuationToken({ SESSION_SECRET: "s3cret" });
  assert.ok(derived && /^[0-9a-f]{64}$/.test(derived));
  assert.notEqual(derived, "s3cret");
  // Deterministic across invocations, distinct per seed, CRON_SECRET as the fallback seed.
  assert.equal(continuationToken({ SESSION_SECRET: "s3cret" }), derived);
  assert.notEqual(continuationToken({ CRON_SECRET: "other" }), derived);
  assert.equal(continuationToken({ CRON_SECRET: "other" }), continuationToken({ CRON_SECRET: "other" }));
  // SESSION_SECRET wins when both exist.
  assert.equal(continuationToken({ SESSION_SECRET: "s3cret", CRON_SECRET: "other" }), derived);
});

test("a target needs both an origin and a token; the bypass header rides along when set", () => {
  assert.equal(continuationTarget({ APP_URL: "https://desk.example.com" }), null);
  assert.equal(continuationTarget({ SESSION_SECRET: "s3cret" }), null);
  const t = continuationTarget({
    APP_URL: "https://desk.example.com",
    SESSION_SECRET: "s3cret",
    VERCEL_AUTOMATION_BYPASS_SECRET: "bypass",
  });
  assert.ok(t);
  assert.equal(t.url, "https://desk.example.com/api/internal/run-phase");
  assert.equal(t.token, continuationToken({ SESSION_SECRET: "s3cret" }));
  assert.equal(t.bypass, "bypass");
  assert.equal(continuationTarget({ APP_URL: "https://x.test", RUN_PHASE_SECRET: "p" })?.bypass, undefined);
});

test("bearer comparison is exact and rejects the empty token", () => {
  assert.ok(tokenMatches("abc", "abc"));
  assert.ok(!tokenMatches("abd", "abc"));
  assert.ok(!tokenMatches("ab", "abc"));
  assert.ok(!tokenMatches("", ""));
});

test("a hand-off is accepted on 202, declined on 409, unavailable otherwise", async () => {
  const target = { url: "https://desk.example.com/api/internal/run-phase", token: "tok", bypass: "byp" };
  const seen: { url: string; init: RequestInit }[] = [];
  const fake = (status: number, body = ""): typeof fetch =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), init: init ?? {} });
      return new Response(body, { status });
    }) as typeof fetch;

  assert.equal((await requestRunPhase(target, "run-1", "probe", fake(202))).result, "accepted");
  assert.equal((await requestRunPhase(target, "run-1", "probe", fake(409))).result, "declined");
  assert.equal((await requestRunPhase(target, "run-1", "probe", fake(401))).result, "unavailable");
  assert.equal((await requestRunPhase(target, "run-1", "probe", fake(404))).result, "unavailable");
  assert.equal((await requestRunPhase(target, "run-1", "probe", fake(503))).result, "unavailable");
  const failing = (async () => {
    throw new Error("connect ECONNREFUSED");
  }) as unknown as typeof fetch;
  const r = await requestRunPhase(target, "run-1", "probe", failing);
  assert.equal(r.result, "unavailable");
  assert.match(r.detail, /ECONNREFUSED/);

  // The request carries the token, the bypass header and the phase payload.
  const first = seen[0];
  assert.equal(first.url, target.url);
  const headers = first.init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer tok");
  assert.equal(headers["x-vercel-protection-bypass"], "byp");
  assert.deepEqual(JSON.parse(String(first.init.body)), { runId: "run-1", phase: "probe" });
});
