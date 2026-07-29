import { TickerSearch } from "@/components/TickerSearch";

/**
 * Shared frame for every ticker page (due diligence, signals, financials):
 * mounts the desk-wide floating search once so all three pills carry it.
 */
export default async function TickerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return (
    <>
      {children}
      <TickerSearch symbol={decodeURIComponent(symbol).toUpperCase()} />
    </>
  );
}
