import { redirect } from "next/navigation";

/**
 * The Notes page was absorbed into the Due Diligence workspace — the ticker's
 * main page (FOUNDATION: "The due-diligence record is the desk's centre").
 * Sections and notepads live on unchanged; old links land there.
 */
export default async function NotesRedirect({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  redirect(`/t/${encodeURIComponent(decodeURIComponent(symbol).toUpperCase())}`);
}
