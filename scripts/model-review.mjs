/**
 * Monthly model review (run by .github/workflows/model-review.yml).
 *
 * Deterministic — no LLM. Fetches each provider's live model list, computes
 * what the app's auto-selector (lib/ai/models.ts) will resolve for each role,
 * and writes model-review-report.md. The workflow posts it as a GitHub issue
 * so a human can approve adopting a genuinely new model family. Keep the role
 * patterns below in sync with lib/ai/models.ts.
 */

const ROLES = [
  { role: "synthesis", provider: "claude", include: /^claude-opus-\d/, exclude: /-(fast|latest)\b/ },
  { role: "chat", provider: "claude", include: /^claude-opus-\d/, exclude: /-(fast|latest)\b/ },
  { role: "triage", provider: "claude", include: /^claude-opus-\d/, exclude: /-(fast|latest)\b/ },
  {
    role: "scoutBreadth",
    provider: "gemini",
    include: /^gemini-[\d.]+-flash/,
    exclude: /(lite|embedding|aqa|tts|image|audio|live|vision|learnlm|robotics|thinking)/,
  },
  {
    role: "scoutDeep",
    provider: "gemini",
    include: /^gemini-[\d.]+-pro/,
    exclude: /(embedding|aqa|tts|image|audio|live|vision|learnlm|robotics)/,
  },
];

function score(id) {
  const n = (id.match(/\d+/g) ?? []).map(Number);
  let s = (n[0] ?? 0) * 1_000_000 + (n[1] ?? 0) * 1_000;
  if (/preview|-exp\b|experimental|\d{8}/.test(id)) s -= 200;
  if (/lite/.test(id)) s -= 400;
  return s - id.length;
}

async function geminiModels() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  const out = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200${
      pageToken ? `&pageToken=${pageToken}` : ""
    }`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    for (const m of data.models ?? []) {
      if (!(m.supportedGenerationMethods ?? []).includes("generateContent")) continue;
      const id = (m.name ?? "").replace(/^models\//, "");
      if (id) out.push(id);
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out;
}

async function claudeModels() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return [];
  const out = [];
  let afterId = "";
  for (let page = 0; page < 10; page++) {
    const url = `https://api.anthropic.com/v1/models?limit=100${afterId ? `&after_id=${afterId}` : ""}`;
    const res = await fetch(url, {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (!res.ok) break;
    const data = await res.json();
    for (const m of data.data ?? []) if (m.id) out.push(m.id);
    if (!data.has_more || !data.last_id) break;
    afterId = data.last_id;
  }
  return out;
}

function pick(ids, cfg) {
  return (
    ids
      .filter((id) => cfg.include.test(id) && !cfg.exclude.test(id))
      .sort((a, b) => score(b) - score(a))[0] ?? "(none available — using pinned fallback)"
  );
}

const [claude, gemini] = await Promise.all([
  claudeModels().catch(() => []),
  geminiModels().catch(() => []),
]);

const month = new Date().toISOString().slice(0, 7);
const byProvider = { claude, gemini };
const rows = ROLES.map((r) => `| ${r.role} | \`${pick(byProvider[r.provider], r)}\` |`).join("\n");

const claudeFlagships = claude.filter((id) => /^claude-opus-|^claude-fable|^claude-mythos/.test(id)).sort();
const geminiFlagships = gemini
  .filter((id) => /^gemini-[\d.]+-(flash|pro)/.test(id) && !/(embedding|tts|image|audio|live|vision)/.test(id))
  .sort();

const report = `# Monthly model review — ${month}

The app selects the **best currently-available** model per role automatically
(\`lib/ai/models.ts\`). Below is what it resolves **right now** from each
provider's live model list. If a stronger new model family has appeared that the
app isn't picking, widen the \`include\` pattern in \`lib/ai/models.ts\` (or pin a
model with the per-role env var) and open a PR.

## Resolved per role

| Role | Model the app will use |
|---|---|
${rows}

## Claude — available flagship models (${claudeFlagships.length})
${claudeFlagships.length ? claudeFlagships.map((m) => `- \`${m}\``).join("\n") : "_none returned (check ANTHROPIC_API_KEY secret)_"}

## Gemini — available flash/pro models (${geminiFlagships.length})
${geminiFlagships.length ? geminiFlagships.map((m) => `- \`${m}\``).join("\n") : "_none returned (check GEMINI_API_KEY secret)_"}

---
_Automated by \`scripts/model-review.mjs\`. Selection logic lives in \`lib/ai/models.ts\`._
`;

const { writeFileSync } = await import("node:fs");
writeFileSync("model-review-report.md", report);
console.log(report);
