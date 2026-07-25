import { NextResponse } from "next/server";
import { finChatBusy, finChatError } from "@/lib/agents/cleansing";
import { applyCleansing } from "@/lib/cleansing";
import {
  getTicker,
  latestFinSuggestRun,
  listFinAdjustments,
  listFinCleansingEvents,
  listFinMessages,
  reapStuckFinSuggestRuns,
} from "@/lib/db";
import { getFinancials } from "@/lib/financials";
import { requireUser } from "@/lib/auth";
import { requestLang } from "@/lib/i18n/server";
import { localizeCleansingPayload } from "@/lib/i18n/translate";
import type { CleansingPayload } from "@/lib/types";

// A cache-miss financials fetch hits the provider several times — give the
// route the same room as the financials route.
export const maxDuration = 120;

type Params = { params: Promise<{ symbol: string }> };

/** The finance-cleansing screen's payload: raw + cleansed + the full bench state. */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const ticker = await getTicker(user.id, symbol);
  if (!ticker) return NextResponse.json({ error: "not found" }, { status: 404 });

  await reapStuckFinSuggestRuns(user.id, symbol).catch(() => {});
  const [financials, adjustments, events, suggestRun, messages, analystBusy, analystError] =
    await Promise.all([
      getFinancials(symbol),
      listFinAdjustments(user.id, symbol),
      listFinCleansingEvents(user.id, symbol),
      latestFinSuggestRun(user.id, symbol),
      listFinMessages(user.id, symbol),
      finChatBusy(user.id, symbol),
      finChatError(user.id, symbol),
    ]);

  const applied = adjustments.filter((a) => a.status === "applied");
  const payload: CleansingPayload = {
    ticker,
    financials: financials ?? null,
    cleansed: financials && applied.length > 0 ? applyCleansing(financials, applied) : null,
    adjustments,
    events,
    suggestRun: suggestRun ?? null,
    messages,
    analystBusy,
    analystError,
  };
  const lang = await requestLang(user.id);
  return NextResponse.json(await localizeCleansingPayload(payload, lang, { userId: user.id }));
}
