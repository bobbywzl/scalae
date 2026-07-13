import { recordGeminiUsage, type UsageMeta } from "./usage";

// Which Gemini model runs each scout tier is decided by lib/ai/models.ts
// (automatic best-available selection, env-overridable) and passed in via
// opts.model. This is only the stable floor used if a caller omits the model.
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export interface GroundedResult {
  text: string;
  /** De-duplicated web sources Gemini grounded on. */
  sources: { title: string; url: string }[];
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  error?: { message?: string; status?: string };
}

/**
 * One Google-Search-grounded research call to Gemini. Returns the model's
 * findings plus the list of web sources from grounding metadata.
 */
export async function geminiGroundedSearch(
  prompt: string,
  opts: { model?: string; meta?: UsageMeta } = {}
): Promise<GroundedResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const model = opts.model ?? DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  });

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 120_000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
        await sleep(1500 * (attempt + 1));
        continue;
      }
      const data = (await res.json()) as GeminiResponse;
      if (!res.ok || data.error) {
        throw new Error(`Gemini error: ${data.error?.message || res.statusText}`);
      }
      recordGeminiUsage(data.usageMetadata, model, opts.meta);
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      const seen = new Set<string>();
      const sources: GroundedResult["sources"] = [];
      for (const chunk of cand?.groundingMetadata?.groundingChunks ?? []) {
        const uri = chunk.web?.uri;
        if (!uri || seen.has(uri)) continue;
        seen.add(uri);
        sources.push({ title: chunk.web?.title || uri, url: uri });
      }
      return { text: text || "(no findings returned)", sources };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (lastErr.name === "AbortError") lastErr = new Error("Gemini request timed out.");
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr ?? new Error("Gemini request failed.");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * List Gemini model IDs that support text generation (grounded scouting), for
 * automatic best-model selection. Returns [] on any failure — the caller falls
 * back to a pinned default.
 */
export async function listGeminiModels(): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  const out: string[] = [];
  let pageToken = "";
  for (let page = 0; page < 5; page++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200${
      pageToken ? `&pageToken=${pageToken}` : ""
    }`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = (await res.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
      nextPageToken?: string;
    };
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
