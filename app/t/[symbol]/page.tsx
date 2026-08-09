import { redirect } from "next/navigation";

/**
 * Entering a ticker lands on the signal board: /t/SYM → /t/SYM/signals.
 * The due-diligence record (FOUNDATION's centre of the product) lives at
 * /t/SYM/dd — one pill away on every desk page, never the entry surface.
 */
export default async function TickerIndexRedirect({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  redirect(`/t/${encodeURIComponent(decodeURIComponent(symbol).toUpperCase())}/signals`);
}
