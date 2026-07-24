"use client";

import Link from "next/link";
import { useT } from "@/components/PrefsProvider";

/**
 * The ticker's surface switch — one segmented pill next to the ticker name on
 * both desk pages: Due diligence (the record, the ticker's main page) and
 * Signals (the board). The active segment is the page you're on; the other
 * navigates.
 */
export function DeskTabs({ symbol, active }: { symbol: string; active: "dd" | "signals" }) {
  const { t } = useT();
  const base = `/t/${encodeURIComponent(symbol)}`;
  const seg = (key: "dd" | "signals", href: string, label: string) =>
    active === key ? (
      <span
        aria-current="page"
        className="rounded-full bg-accent/15 text-accent text-xs font-semibold px-3 py-1"
      >
        {label}
      </span>
    ) : (
      <Link
        href={href}
        className="rounded-full text-muted hover:text-emph text-xs font-medium px-3 py-1 transition-colors"
      >
        {label}
      </Link>
    );
  return (
    <nav className="flex items-center gap-0.5 rounded-full border border-hairline bg-ink/4 p-0.5 shrink-0">
      {seg("dd", base, t("dd.tabDiligence"))}
      {seg("signals", `${base}/signals`, t("dd.tabSignals"))}
    </nav>
  );
}
