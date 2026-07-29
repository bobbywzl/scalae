import { NextResponse } from "next/server";
import { getSetting, getTicker, listDeskSources, setSetting, upsertInvestorSource } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { DeskSourceKind } from "@/lib/types";

type Params = { params: Promise<{ symbol: string }> };

const KINDS: DeskSourceKind[] = ["primary", "trade", "narrative", "avoid"];

/**
 * The desk's source map + the steering switch. steering is the investor's
 * explicit choice of cooperative research: ON = approved entries direct where
 * the scouts look first; OFF = the map is reference only.
 */
export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const [sources, steering] = await Promise.all([
    listDeskSources(user.id, symbol),
    getSetting(user.id, `sourceSteering:${symbol}`),
  ]);
  return NextResponse.json({
    // Observed rows are an internal tally — only reviewable entries surface.
    sources: sources.filter((s) => s.status !== "observed"),
    steering: steering !== "off",
  });
}

/** The investor adds a source-map entry directly (their add is the approval). */
export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    label?: string;
    kind?: string;
    note?: string;
  };
  const domain = (body.domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "a valid domain is required" }, { status: 400 });
  }
  const kind = KINDS.includes(body.kind as DeskSourceKind) ? (body.kind as DeskSourceKind) : "primary";
  await upsertInvestorSource(user.id, symbol, {
    domain,
    label: (body.label ?? "").slice(0, 200),
    kind,
    note: (body.note ?? "").slice(0, 300),
  });
  const sources = await listDeskSources(user.id, symbol);
  return NextResponse.json({ sources: sources.filter((s) => s.status !== "observed") });
}

/** The steering switch — the cooperative-research choice. Body: { steering }. */
export async function PATCH(req: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!(await getTicker(user.id, symbol))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { steering } = (await req.json().catch(() => ({}))) as { steering?: boolean };
  if (typeof steering !== "boolean") {
    return NextResponse.json({ error: "steering must be a boolean" }, { status: 400 });
  }
  await setSetting(user.id, `sourceSteering:${symbol}`, steering ? "on" : "off");
  return NextResponse.json({ steering });
}
