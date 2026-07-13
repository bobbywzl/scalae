import { NextResponse } from "next/server";
import { insertTrade } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { resolveSymbol } from "@/lib/market";
import type { OptionType, TradeInput, TradeKind, TradeSide } from "@/lib/types";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

/** Record a trade (stock or option, buy or sell). */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Partial<TradeInput>;

  const symbol = String(b.symbol ?? "").trim().toUpperCase();
  if (!symbol) return bad("Ticker symbol required.");
  const kind = b.kind as TradeKind;
  if (kind !== "stock" && kind !== "option") return bad("kind must be stock or option.");
  const side = b.side as TradeSide;
  if (side !== "buy" && side !== "sell") return bad("side must be buy or sell.");
  const quantity = Number(b.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return bad("Quantity must be positive.");
  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0) return bad("Price must be a non-negative number.");
  const fees = Number(b.fees ?? 0);
  if (!Number.isFinite(fees) || fees < 0) return bad("Fees must be non-negative.");
  const tradeDate = String(b.tradeDate ?? "").slice(0, 10);
  if (!ISO_DAY.test(tradeDate) || isNaN(Date.parse(tradeDate))) return bad("Trade date required (YYYY-MM-DD).");

  let optionType: OptionType | null = null;
  let strike: number | null = null;
  let expiry: string | null = null;
  let multiplier = 1;
  if (kind === "option") {
    optionType = b.optionType as OptionType;
    if (optionType !== "call" && optionType !== "put") return bad("Option type must be call or put.");
    strike = Number(b.strike);
    if (!Number.isFinite(strike) || strike <= 0) return bad("Strike must be positive.");
    expiry = String(b.expiry ?? "").slice(0, 10);
    if (!ISO_DAY.test(expiry) || isNaN(Date.parse(expiry))) return bad("Expiry required (YYYY-MM-DD).");
    multiplier = Number(b.multiplier ?? 100);
    if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 10000) multiplier = 100;
  }

  // Validate the ticker exists on the public market (same gate as the watchlist).
  const name = await resolveSymbol(symbol);
  if (!name) return bad(`Could not find "${symbol}" on the public market.`);

  const trade = await insertTrade(user.id, {
    symbol,
    kind,
    side,
    quantity,
    price,
    fees,
    tradeDate,
    optionType,
    strike,
    expiry,
    multiplier,
    note: String(b.note ?? "").slice(0, 500),
  });
  return NextResponse.json({ trade }, { status: 201 });
}
