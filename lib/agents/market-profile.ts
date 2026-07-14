import { claudeJSON } from "../ai/claude";
import { geminiGroundedSearch } from "../ai/gemini";
import { resolveModel } from "../ai/models";
import { getTicker, setMarketProfile } from "../db";
import type { MarketProfile, Ticker } from "../types";
import { MARKET_PROFILE_DOCTRINE, MARKET_PROFILE_SCHEMA } from "./framework";

/**
 * Resolve a ticker's home-market "information geography": the country and
 * language the business actually lives in, how visible it is to international
 * media, and the named local venues a scout should search. This is what lets
 * the research desk route to local investment press, native-language filings,
 * founder interviews and community forums for a company that is opaque to
 * foreign outlets (a US-listed Chinese ADR, a Japanese industrial, …) — where
 * the truest read of the business model and culture usually lives.
 *
 * Cheap and cached on the ticker row: one grounded sweep + one structuring
 * call, run once per ticker (refreshable). Never throws in a way that should
 * break a research run — callers treat a null profile as "search normally".
 */

/** How long a resolved profile stays fresh before a re-resolve is allowed. */
const PROFILE_TTL_MS = 180 * 86_400_000; // ~6 months — home geography moves slowly

function profileScoutPrompt(t: Ticker): string {
  return `You are a research scout mapping the HOME-MARKET INFORMATION ENVIRONMENT of ${t.name} (${t.symbol}) for a value-investing desk. Today is ${new Date().toDateString()}.

Determine, from the web:
1. The company's HOME country — where the business actually operates and is headquartered — as distinct from where its stock is listed. (A NASDAQ or NYSE ticker can be a wholly Chinese, Israeli, Latin American, or European operating business.)
2. The primary LANGUAGE of that home market's business and investment coverage.
3. The LISTING structure (domestic listing, ADR/GDR, dual-listing) and what it implies about the company's disclosure culture and who its filings are really written for.
4. How VISIBLE and TRANSPARENT the company is to international / English-language media versus its home press — is serious coverage abundant in English, or does the candid, detailed reporting live mostly in the local language?
5. The specific LOCAL venues and source types where the richest evidence lives: local financial newspapers and investment media, domestic brokerage/independent analyst research, the home-exchange filing system, native-language earnings calls, outlets that publish founder/executive interviews, and community venues (investor forums, review sites, trade blogs) where customers, employees and retail investors actually talk. Name real outlets/platforms where you can (e.g. for China: 雪球/Xueqiu, 东方财富/东财股吧, 财新/Caixin; for Japan: Nikkei, 会社四季報; adapt to the real market).

Ground every claim in search results. Be concrete and name real sources. If the company is a straightforward US/UK business whose coverage is predominantly English, say so plainly — no special local routing is needed there.`;
}

/**
 * Get the ticker's market profile, resolving and caching it if missing/stale.
 * Returns null (and logs) on failure — the caller should proceed without it.
 */
export async function ensureMarketProfile(
  userId: string,
  symbol: string,
  ticker?: Ticker
): Promise<MarketProfile | null> {
  const t = ticker ?? (await getTicker(userId, symbol));
  if (!t) return null;
  if (t.marketProfile && isFresh(t.marketProfileAt)) return t.marketProfile;
  try {
    return await resolveMarketProfile(userId, symbol, t);
  } catch (e) {
    console.error(
      `[scalae] market profile for ${symbol} failed (continuing without):`,
      e instanceof Error ? e.message : e
    );
    // Fall back to a stale profile if one exists; else null.
    return t.marketProfile ?? null;
  }
}

function isFresh(at: string | null | undefined): boolean {
  if (!at) return false;
  const ts = Date.parse(at);
  return Number.isFinite(ts) && Date.now() - ts < PROFILE_TTL_MS;
}

/**
 * Research and store a ticker's market profile. Throws on unknown ticker or if
 * both the grounded sweep and the structuring call yield nothing usable.
 */
export async function resolveMarketProfile(
  userId: string,
  symbol: string,
  ticker?: Ticker
): Promise<MarketProfile> {
  const t = ticker ?? (await getTicker(userId, symbol));
  if (!t) throw new Error(`Unknown ticker ${symbol}`);

  const [breadthModel, synthModel] = await Promise.all([
    resolveModel("scoutBreadth"),
    resolveModel("triage"),
  ]);

  const grounded = await geminiGroundedSearch(profileScoutPrompt(t), {
    model: breadthModel,
    meta: { userId, feature: "marketProfile" },
  });

  const task = `Company: ${t.name} (${t.symbol}).

FIELD RESEARCH (grounded web search on this company's home-market information environment):
${grounded.text}

TASK: Distill the research into the company's home-market information-geography profile per the schema. Determine the HOME country (where the business operates, not the listing venue), the home-market language, the listing/disclosure note, the coverage-transparency reality, and the named local sources a research scout should prioritize when the home market is non-English. For a straightforward US/UK business whose coverage is predominantly English, set language to "English" and localSources to an empty array. Be concrete; never invent outlets the research did not surface.`;

  const profile = await claudeJSON<MarketProfile>({
    model: synthModel,
    system: `You map where a public company truly lives, informationally, so a value-investing research desk can route its scouts to the local record.\n\n${MARKET_PROFILE_DOCTRINE}`,
    messages: [{ role: "user", content: task }],
    schema: MARKET_PROFILE_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 2000,
    effort: "low",
    meta: { userId, feature: "marketProfile" },
  });

  const cleaned: MarketProfile = {
    country: (profile.country ?? "").trim(),
    language: (profile.language ?? "").trim() || "English",
    listingNote: (profile.listingNote ?? "").trim(),
    coverageNote: (profile.coverageNote ?? "").trim(),
    localSources: (profile.localSources ?? [])
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean)
      .slice(0, 8),
  };
  if (!cleaned.country) throw new Error("Market profile came back without a home country.");

  await setMarketProfile(userId, symbol, cleaned);
  return cleaned;
}
