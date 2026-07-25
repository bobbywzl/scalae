export type SignalType = "quantitative" | "qualitative";
export type SignalStatus = "suggested" | "active" | "dismissed" | "retired";
export type SignalOrigin = "onboarding" | "chat" | "research";
export type ReadingLevel =
  | "strong"
  | "improving"
  | "neutral"
  | "deteriorating"
  | "weak"
  | "unclear";
export type Delta = "up" | "down" | "flat";
export type Impact = "positive" | "negative" | "mixed" | "neutral";
export type RunStatus = "running" | "done" | "error" | "stopped";

// ---------------------------------------------------------------------------
// Accounts: Google sign-in makes this a multi-user app. Every data row is
// scoped by userId; 'local' is the implicit single-user id when auth is off.
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "user";

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: UserRole;
  createdAt: string;
  lastSeenAt: string;
}

/** One user's row in the admin console, with activity aggregates. */
export interface AdminUserRow {
  user: User;
  tickers: number;
  activeSignals: number;
  runs: number;
  lastRunAt: string | null;
  messages: number;
  trades: number;
  /** Sign-ins (sessions created) over the trailing 7 days. */
  logins7d: number;
  /** Support requests filed by this account. */
  feedback: number;
  /** Investor profile captured at onboarding, if completed. */
  profile: { name?: string; age?: number; country?: string; industries?: string[] } | null;
}

export interface Ticker {
  symbol: string;
  name: string;
  addedAt: string;
  onboarded: number; // 0 | 1
  lastRunAt: string | null;
  /**
   * Consecutive daily runs that found no new evidence. Resets to 0 on any run
   * with new evidence. Drives the cron's adaptive cadence (see lib/cadence.ts).
   */
  quietRuns?: number;
  /** Owner (server-side; present on rows read from the db). */
  userId?: string;
}

export interface FocusArea {
  id: string;
  symbol: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface Signal {
  id: string;
  symbol: string;
  focusArea: string;
  name: string;
  type: SignalType;
  thesis: string;
  measurementPlan: string;
  scale: string;
  status: SignalStatus;
  origin: SignalOrigin;
  /** Id of the ACTIVE signal this proposal replaces (retired on approval), or null. */
  replaces: string | null;
  createdAt: string;
  approvedAt: string | null;
  /** When the investor dismissed it (kept after restore — gate memory). */
  dismissedAt?: string | null;
  /**
   * Deep-history backstory (markdown with [n] citations): how the aspect this
   * signal measures evolved over years/decades and fared through major events.
   * Researched once per signal (refreshable); null until researched.
   */
  backstory?: string | null;
  /** 1-2 sentence base-rate summary of the backstory, fed to daily synthesis. */
  backstoryBrief?: string | null;
  /** When the backstory was last researched (ISO). */
  backstoryAt?: string | null;
  /** Owner (server-side; present on rows read from the db). */
  userId?: string;
}

export interface Citation {
  title: string;
  url: string;
  /** Best-effort source domain (e.g. "fastretailing.com"), resolved at research time. */
  domain?: string;
  /** Labels of the research sweeps that surfaced this source (provenance). */
  foundBy?: string[];
}

export interface Reading {
  id: string;
  signalId: string;
  runId: string;
  date: string;
  value: number | null;
  valueUnit: string | null;
  level: ReadingLevel;
  delta: Delta;
  confidence: number;
  rationale: string;
  /** False = pure carry-forward day ("no new information"); null on legacy rows. */
  newEvidence: boolean | null;
  citations: Citation[];
}

/**
 * Evidence class of a digest item's cited source, per the desk's weighing
 * doctrine: "primary" = the company's or a regulator's own document
 * (mechanism-level), "trade" = specialist/industry press with original
 * reporting, "narrative" = general media / aggregator retelling.
 */
export type SourceClass = "primary" | "trade" | "narrative";

export interface DigestItem {
  id: string;
  symbol: string;
  runId: string;
  date: string;
  headline: string;
  summary: string;
  url: string | null;
  source: string | null;
  impact: Impact;
  signalNames: string[];
  /** Evidence class of the cited source (null on legacy items). */
  sourceClass: SourceClass | null;
  /** The desk's one-line source recommendation: why this source for this item. */
  sourceNote: string | null;
}

export interface Run {
  id: string;
  symbol: string;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  stage: string;
  stageDetail: string;
  brief: string | null;
  /** Standing business-model & culture dossier synthesized from the board. */
  dossier: string | null;
  /** The run's numbered source list — resolves [n] citations to links. */
  sources: Citation[];
  /**
   * Today's focus questions, framed by the question suggestor before the
   * sweeps (the run's first stage). Empty on legacy runs or when framing
   * gracefully degraded.
   */
  questions: string[];
  error: string | null;
}

export type AttachmentKind = "image" | "pdf" | "text";

/** A file the investor attached to a chat message. */
export interface Attachment {
  kind: AttachmentKind;
  name: string;
  mediaType: string;
  /** Original size in bytes (pre-encoding). */
  size: number;
  /**
   * base64 payload (image/pdf) or raw text (text files). Stripped from desk
   * payloads sent to the browser; loaded server-side when the analyst reads it.
   */
  data?: string;
}

export interface ChatMessage {
  id: string;
  symbol: string;
  role: "user" | "assistant";
  content: string;
  proposalIds: string[];
  attachments: Attachment[];
  /** null = ticker-level desk chat; set = that signal's focused chat. */
  signalId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Feedback & support: users file requests (bug / idea / question …) with
// attached evidence; admins respond from the console; responders trigger an
// email notification to the requester. Amazon-case-style request IDs.
// ---------------------------------------------------------------------------

export type FeedbackCategory = "bug" | "idea" | "question" | "account" | "other";
export type FeedbackStatus = "open" | "responded" | "closed";

export interface FeedbackMessage {
  id: string;
  feedbackId: string;
  role: "user" | "admin";
  body: string;
  attachments: Attachment[];
  createdAt: string;
}

export interface FeedbackTicket {
  /** Human-friendly request ID, e.g. "SCL-7K2M4Q" — shown to the user. */
  id: string;
  userId: string;
  category: FeedbackCategory;
  subject: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  /** Thread, oldest first. List endpoints strip attachment payloads. */
  messages: FeedbackMessage[];
}

/** One ticket in the admin inbox, with requester identity. */
export interface AdminFeedbackRow {
  ticket: FeedbackTicket;
  user: { id: string; email: string; name: string; picture: string };
}

export interface Quote {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  /** Native→USD rate (1 for USD; null when FX is unavailable). Lets the UI
   *  show a USD equivalent next to non-USD tickers. */
  fxToUsd: number | null;
  marketCap: number | null;
  trailingPE: number | null;
  marketState: string | null;
  spark: number[];
}

/** Brokerage-grade quote for the trade ticket (Schwab-style pre-trade info). */
export interface RichQuote {
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string;
  marketState: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  open: number | null;
  bid: number | null;
  ask: number | null;
  bidSize: number | null;
  askSize: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  wk52Low: number | null;
  wk52High: number | null;
  volume: number | null;
  avgVolume: number | null;
  marketCap: number | null;
  trailingPE: number | null;
  epsTTM: number | null;
  /** Trailing dividend yield in percent (e.g. 1.2 = 1.2%). */
  dividendYieldPct: number | null;
  spark: number[];
}

// ---------------------------------------------------------------------------
// Financials: multi-year value-investor metrics for a ticker (the DCF section).
// Sourced from Yahoo (fundamentalsTimeSeries + quoteSummary); numbers only, so
// they render without translation (row labels are localized client-side by key).
// ---------------------------------------------------------------------------

/** How a metric row is rendered and whether a rising value is "good". */
export type MetricFormat = "money" | "pct" | "ratio" | "shares" | "perShare" | "x";
/** Which block of the table a metric belongs to. */
export type MetricGroup = "income" | "returns" | "balance" | "cashflow" | "dcf" | "perShare";

/** One row of the metrics×years table — values aligned to `fiscalYears`. */
export interface FinancialMetric {
  key: string; // stable id, mapped to a localized label + tooltip client-side
  group: MetricGroup;
  format: MetricFormat;
  /** 1 = higher is better, -1 = lower is better, 0 = neutral (delta not colored). */
  polarity: 1 | -1 | 0;
  /** Oldest → newest, aligned to fiscalYears; null where the source lacked it. */
  values: (number | null)[];
}

/** Current point-in-time valuation & health snapshot (what it costs to own it now). */
export interface FinancialsSnapshot {
  marketCap: number | null;
  /** What you'd pay to buy the whole business today: mkt cap + debt − cash. */
  enterpriseValue: number | null;
  netDebt: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  evToEbit: number | null;
  evToEbitda: number | null;
  evToRevenue: number | null;
  roe: number | null;
  roic: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  interestCoverage: number | null;
  fcfYield: number | null; // trailing FCF / enterprise value
}

/**
 * Normalized inputs a value investor needs to build their own unlevered DCF —
 * WACC building blocks, the EV↔equity bridge, and drivers normalized (median)
 * across the available fiscal years so they aren't anchored to a single year.
 */
export interface DcfInputs {
  /** Equity beta (from the data provider) — for cost of equity. */
  beta: number | null;
  /** Effective tax rate to unlever earnings (median of reported rates). */
  effectiveTaxRate: number | null;
  /** Pre-tax cost of debt proxy: interest expense ÷ total debt. */
  costOfDebt: number | null;
  /** Market-value capital-structure weights (sum to 1). */
  equityWeight: number | null;
  debtWeight: number | null;
  /** EV→equity bridge. */
  netDebt: number | null;
  sharesOutstanding: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  // Normalized drivers to seed the projection (medians over available years):
  medianRevenueGrowth: number | null;
  medianOperatingMargin: number | null;
  medianRoic: number | null;
  medianReinvestmentRate: number | null;
  medianFcffMargin: number | null;
}

/** One peer's comparable returns/margins for the ROIC/ROE-vs-industry table. */
export interface PeerMetric {
  symbol: string;
  name: string | null;
  industry: string | null;
  roe: number | null;
  roic: number | null;
  netMargin: number | null;
  operatingMargin: number | null;
  debtToEquity: number | null;
}

/**
 * On-demand peer comparison (loaded only when the investor asks). Auto-selected
 * peers are filtered to the ticker's own industry — comparing across industries
 * is meaningless — but the investor can also name specific tickers.
 */
export interface PeerComparison {
  /** The ticker's own industry, the filter auto-peers must match. */
  industry: string | null;
  peers: PeerMetric[];
  /** True when the caller supplied explicit tickers (industry filter skipped). */
  custom: boolean;
}

/** The full per-ticker financials payload served by /api/tickers/[symbol]/financials. */
export interface TickerFinancials {
  symbol: string;
  /**
   * The STATEMENT (reporting) currency — the currency every fiscal-year
   * metric row, DCF input and cleansing-adjustment delta is denominated in.
   * For ADRs this is the home currency (PDD → CNY), NOT the quote currency.
   */
  currency: string | null;
  /** Currency the listing trades in (ADR quote currency); may differ from `currency`. */
  tradingCurrency: string | null;
  /**
   * True when statements and the listing use different currencies (the ADR
   * trap). Cross-currency ratios (derived EV, EV/EBIT, FCF yield, capital-
   * structure weights) are OMITTED rather than computed across currencies,
   * and the UI + agents state the statement currency explicitly.
   */
  currencyMismatch: boolean;
  sector: string | null;
  industry: string | null;
  /** Fiscal-year labels oldest → newest, e.g. "2016" … "2025". */
  fiscalYears: string[];
  metrics: FinancialMetric[];
  snapshot: FinancialsSnapshot;
  /** Normalized inputs for the investor's own DCF (worksheet + export). */
  dcfInputs: DcfInputs;
  /** Which data provider supplied this — "Yahoo Finance" or "Financial Modeling Prep". */
  source: string;
  /** ISO timestamp this data was fetched/computed (drives the cache + "as of"). */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Finance cleansing: the investor's own normalized view of the reported
// record, per ticker. Adjustments remove NOISE (one-time impairments,
// settlements, asset-sale gains, unstable income) and windfall GROWTH
// (unrealized mark-to-market gains, revaluation one-offs) from specific
// metric cells. The raw provider data is never touched — cleansing is a
// deterministic overlay, every change is human-gated, and an append-only
// event log records the full raw → cleansed history (FOUNDATION: human
// sovereignty; "depreciation is real" — this is owner-earnings
// normalization, never promotional adjusted metrics).
// ---------------------------------------------------------------------------

/** noise = non-recurring charges/credits & unstable income; growth = windfall/mark-to-market gains. */
export type FinAdjustmentKind = "noise" | "growth";
export type FinAdjustmentStatus = "suggested" | "applied" | "dismissed" | "reverted";
/** Where the adjustment came from: the suggestion pass or the analyst desk chat. */
export type FinAdjustmentOrigin = "suggest" | "analyst";

/**
 * One cleansing adjustment: a signed delta on one metric cell (metricKey ×
 * fiscalYear), in the ticker's reporting currency (raw units, not millions).
 * delta is the amount ADDED to the reported figure to reach the cleansed
 * figure: removing a one-time gain of X → −X; removing a one-time charge → +X.
 */
export interface FinAdjustment {
  id: string;
  symbol: string;
  /** One of the directly-adjustable base metric keys (lib/cleansing.ts). */
  metricKey: string;
  /** Fiscal-year label, matching TickerFinancials.fiscalYears (e.g. "2025"). */
  fiscalYear: string;
  delta: number;
  /** Short name of the item, e.g. "Unrealized Anthropic stake gain". */
  title: string;
  /** Why this item distorts the record, citing the disclosure it traces to. */
  rationale: string;
  kind: FinAdjustmentKind;
  origin: FinAdjustmentOrigin;
  status: FinAdjustmentStatus;
  /** Sources backing the amount ([n] indexes in rationale resolve here). */
  sources: Citation[];
  createdAt: string;
  /** When it was (last) applied to the cleansed view. */
  appliedAt: string | null;
  /** When it was dismissed or reverted. */
  decidedAt: string | null;
}

/** Shape the cleansing agents emit when proposing an adjustment (pre-review). */
export interface FinAdjustmentProposal {
  metricKey: string;
  fiscalYear: string;
  delta: number;
  title: string;
  rationale: string;
  kind: FinAdjustmentKind;
}

/**
 * One entry in the append-only cleansing audit log — the history of every
 * difference between the raw public data and the customized view.
 */
export interface FinCleansingEvent {
  id: string;
  symbol: string;
  adjustmentId: string;
  action: "suggested" | "applied" | "dismissed" | "reverted";
  /** Human line frozen at event time, e.g. "Net income FY2025 −$1.2B — SpaceX IPO gain". */
  detail: string;
  at: string;
}

/** One "suggest moderations" pass (the finance bench's research-run analogue). */
export interface FinSuggestRun {
  id: string;
  symbol: string;
  status: RunStatus;
  /** The pass's short summary once done (what it looked at, what it found). */
  note: string | null;
  /** How many proposals the pass parked for review. */
  proposalCount: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** One message on the financial analyst desk (the cleansing chat). */
export interface FinMessage {
  id: string;
  symbol: string;
  role: "user" | "assistant";
  content: string;
  /** Adjustments this assistant turn created (rendered as cards in-thread). */
  adjustmentIds: string[];
  createdAt: string;
}

/** One cell whose cleansed value differs from the raw reported value. */
export interface CleansedCell {
  metricKey: string;
  /** Fiscal-year label. */
  year: string;
  raw: number | null;
  cleansed: number | null;
  /** Applied adjustments contributing to this cell (directly or via recompute). */
  adjustmentIds: string[];
  /** True when this cell was recomputed from adjusted inputs, not directly targeted. */
  derived: boolean;
}

/** The deterministic result of overlaying the applied adjustments on the raw table. */
export interface CleansedFinancials {
  /** Full metric set, adjusted where applicable — same shape as the raw table. */
  metrics: FinancialMetric[];
  /** DCF inputs with the normalized medians recomputed off the cleansed rows. */
  dcfInputs: DcfInputs;
  /** Every cell that differs from raw (the current raw → cleansed diff). */
  cells: CleansedCell[];
}

/** Payload for the finance-cleansing screen. */
export interface CleansingPayload {
  ticker: Ticker;
  financials: TickerFinancials | null;
  /** Null when there are no applied adjustments (or no financials). */
  cleansed: CleansedFinancials | null;
  /** Every adjustment, any status, newest first. */
  adjustments: FinAdjustment[];
  /** The audit log, newest first. */
  events: FinCleansingEvent[];
  /** The latest suggestion pass, if any. */
  suggestRun: FinSuggestRun | null;
  /** The analyst desk thread, oldest first. */
  messages: FinMessage[];
  /** An analyst turn is running server-side (background thinking). */
  analystBusy: boolean;
  /** The last analyst turn failed with this reason (null = none). */
  analystError: string | null;
}

/**
 * One distinct source in a signal's accumulated evidence catalog — deduped
 * across every reading in the signal's history, so the list grows as each
 * daily run corroborates or adds sources.
 */
export interface SignalSource {
  title: string;
  url: string;
  domain: string;
  /** Research sweeps that surfaced this source, unioned across readings. */
  foundBy: string[];
  /** Date this source first entered the signal's evidence (ISO). */
  firstSeen: string;
  /** Most recent reading that cited it (ISO). */
  lastSeen: string;
  /** How many of the signal's readings have cited it. */
  count: number;
}

export interface SignalWithReadings extends Signal {
  latest: Reading | null;
  history: Reading[];
  /** Accumulated, deduped source catalog across all readings (freshest first). */
  sources: SignalSource[];
  /** Numbered sources for the backstory's [n] citations (parsed server-side). */
  backstorySources: Citation[];
}

// ---------------------------------------------------------------------------
// Notes: the investor's own thinking layer, per ticker. Sections (custom titles
// or adopted from focus areas) each hold rich-text notepads (TipTap JSON).
// ---------------------------------------------------------------------------

export interface NoteSection {
  id: string;
  symbol: string;
  title: string;
  position: number;
  createdAt: string;
}

export interface Note {
  id: string;
  sectionId: string;
  symbol: string;
  title: string;
  /** TipTap document JSON, serialized. Rendered only through the editor schema. */
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** Payload for the notes page: sections in order, each with its notepads. */
export interface NotesPayload {
  sections: (NoteSection & { notes: Note[] })[];
  /** Focus-area titles offered as one-click section suggestions. */
  focusAreaTitles: string[];
}

// ---------------------------------------------------------------------------
// Due diligence: the desk's centre (FOUNDATION.md). Sections are large
// qualitative topics; the desk contributes deep-research memos that enter the
// record only on the investor's accept, plus a standing synthesis of core
// insights across the whole record — both strictly on demand.
// ---------------------------------------------------------------------------

export type DiligenceResearchStatus =
  | "running"
  | "pending"
  | "accepted"
  | "dismissed"
  | "stopped"
  | "error";

/** One deep-research pass on a section's topic, reviewed before it enters the record. */
export interface DiligenceResearch {
  id: string;
  sectionId: string;
  symbol: string;
  status: DiligenceResearchStatus;
  /** Optional investor steer ("focus on the 2019 price war") captured at kickoff. */
  question: string;
  /** The research memo (markdown, [n] citations into `sources`); null until done. */
  memo: string | null;
  /** 2-4 sentence core-insights distillation (feeds the synthesis + analyst context). */
  insights: string | null;
  /** Numbered source list resolving the memo's [n] citations. */
  sources: Citation[];
  error: string | null;
  createdAt: string;
  /** When the investor accepted or dismissed it (null while running/pending). */
  decidedAt: string | null;
}

/** The standing synthesis of core insights across the whole record (one per ticker). */
export interface DiligenceSynthesis {
  symbol: string;
  content: string;
  updatedAt: string;
}

/**
 * Evidence files: image/pdf/text are model-readable (the memo agent reads
 * them natively); "file" is any other type — spreadsheets, decks, audio,
 * archives — stored and served back, listed to the agents by caption only.
 */
export type EvidenceKind = AttachmentKind | "file";

/**
 * One filed piece of evidence in a section's locker — any file type, with the
 * investor's caption saying what it shows. Payloads carry metadata only; the
 * bytes are served by /api/diligence/evidence/[id]/file.
 */
export interface DiligenceEvidence {
  id: string;
  sectionId: string;
  symbol: string;
  kind: EvidenceKind;
  /** Original filename. */
  name: string;
  mediaType: string;
  /** Original size in bytes (pre-encoding). */
  size: number;
  /** The investor's caption — what this evidence shows and why it's filed. */
  caption: string;
  createdAt: string;
}

/** A suggested section topic — "the right thing to look at" — from the signal board. */
export interface SectionSuggestion {
  title: string;
  rationale: string;
  /** Desk signals this topic would give qualitative depth to. */
  signalNames: string[];
}

/** Payload for the due-diligence page: the whole record plus board context. */
export interface DiligencePayload {
  ticker: Ticker;
  sections: (NoteSection & {
    notes: Note[];
    research: DiligenceResearch[];
    evidence: DiligenceEvidence[];
  })[];
  synthesis: DiligenceSynthesis | null;
  /** True when sections/notes/memos changed after the synthesis was written. */
  synthesisStale: boolean;
  /** Focus-area titles offered as one-click section suggestions. */
  focusAreaTitles: string[];
  /** Active board signals (chips + the suggest-topics flow). */
  activeSignals: { id: string; name: string; focusArea: string }[];
}

/**
 * A text annotation: highlight-by-selection over any rendered text surface on
 * a ticker's pages (brief, dossier, evidence items, readings, chat replies).
 * Anchored by character offsets within a stable surfaceId, with the selected
 * text stored so a stale offset can be recovered by searching (the pattern
 * proven in the Release Edu app's highlighter).
 */
export interface Annotation {
  id: string;
  symbol: string;
  /** Stable anchor container, e.g. "brief", "dossier", "digest:<id>", "reading:<id>", "msg:<id>". */
  surfaceId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  /** amber | blue | green | purple */
  color: string;
  comment: string | null;
  createdAt: string;
}

/** Full payload for the ticker detail page. */
export interface DeskPayload {
  ticker: Ticker;
  quote: Quote | null;
  focusAreas: FocusArea[];
  active: SignalWithReadings[];
  suggested: Signal[];
  /** Retired signals keep their full evidence trail — a swap never erases history. */
  retired: SignalWithReadings[];
  dismissed: Signal[];
  latestRun: Run | null;
  /** When the standing dossier last actually changed (run startedAt), if known. */
  dossierRevisedAt: string | null;
  /** How many consecutive runs (incl. latest) have held the dossier unchanged. */
  dossierHeldRuns: number;
  digest: DigestItem[];
  /** Ticker-level desk chat only (signal-scoped chats load per signal). */
  messages: ChatMessage[];
  /** The investor's involvement in this name, if any trades exist. */
  position: TickerInvolvement | null;
  /** Global auto-research switch — gates the stale-desk auto-run client-side. */
  autoResearch: boolean;
  /** A chat turn for the desk thread is running server-side (background thinking). */
  analystBusy: boolean;
  /** The desk thread's last turn failed with this specific reason (null = none). */
  analystError: string | null;
}

export interface WatchlistRow {
  ticker: Ticker;
  quote: Quote | null;
  activeCount: number;
  suggestedCount: number;
  running: boolean;
  stale: boolean;
  /** Compact involvement badge when the investor holds this name. */
  position: TickerInvolvement | null;
}

// ---------------------------------------------------------------------------
// Portfolio: manual trade ledger (stocks + options), average-cost method.
// ---------------------------------------------------------------------------

export type TradeKind = "stock" | "option";
export type TradeSide = "buy" | "sell";
export type OptionType = "call" | "put";

export interface Trade {
  id: string;
  symbol: string;
  kind: TradeKind;
  side: TradeSide;
  /** Shares (stock) or contracts (option); always positive — side carries direction. */
  quantity: number;
  /** Per share; for options the premium per share (total = price × multiplier × contracts). */
  price: number;
  fees: number;
  /** ISO date of execution. */
  tradeDate: string;
  optionType: OptionType | null;
  strike: number | null;
  expiry: string | null;
  multiplier: number;
  note: string;
  createdAt: string;
}

export type TradeInput = Omit<Trade, "id" | "createdAt">;

// ---------------------------------------------------------------------------
// Order ticket (brokerage-style, paper execution): market orders fill
// immediately at the live quote; limit/stop/stop-limit orders stay working
// and fill — simulated — when the live price crosses them. Fills become
// ordinary ledger trades.
// ---------------------------------------------------------------------------

export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderTif = "day" | "gtc";
export type OrderStatus = "open" | "filled" | "canceled" | "expired";

export interface Order {
  id: string;
  symbol: string;
  side: TradeSide;
  /** Shares; always positive — side carries direction. */
  quantity: number;
  orderType: OrderType;
  /** Required for limit / stop_limit. */
  limitPrice: number | null;
  /** Required for stop / stop_limit. */
  stopPrice: number | null;
  tif: OrderTif;
  status: OrderStatus;
  placedAt: string;
  filledAt: string | null;
  fillPrice: number | null;
  /** Ledger trade created by the fill. */
  tradeId: string | null;
  note: string;
}

export type OrderInput = Pick<Order, "symbol" | "side" | "quantity" | "orderType"> &
  Partial<Pick<Order, "limitPrice" | "stopPrice" | "tif" | "note">>;

// ---------------------------------------------------------------------------
// Dividends: detected from market data for held positions, applied into the
// ledger on your confirmation — as cash, or reinvested (DRIP) per symbol.
// ---------------------------------------------------------------------------

/** A dividend applied to the book (cash received, or reinvested via DRIP). */
export interface DividendReceipt {
  id: string;
  symbol: string;
  /** Ex-dividend date (ISO). */
  exDate: string;
  /** Per-share amount, native currency. */
  perShare: number;
  /** Shares held before the ex-date (negative = short, i.e. dividend owed). */
  shares: number;
  /** Total cash, native currency (perShare × shares; negative for shorts). */
  amount: number;
  currency: string;
  /** Tax withheld at source, percent (amount is net of it). */
  withholdingPct: number;
  reinvested: number; // 0 | 1
  /** The DRIP buy trade, when reinvested. */
  reinvestTradeId: string | null;
  appliedAt: string;
}

/** A detected dividend awaiting your confirmation. */
export interface PendingDividend {
  symbol: string;
  exDate: string;
  perShare: number;
  shares: number;
  amount: number;
  currency: string;
  /** The symbol's dividend-reinvestment setting right now. */
  drip: boolean;
  /** Price the DRIP buy would use (close on/after ex-date, else live). */
  reinvestPrice: number | null;
  /** Estimated shares the DRIP buy would add. */
  reinvestShares: number | null;
}

/** One open (or fully-closed) instrument computed from the ledger. */
export interface Position {
  /** stock → symbol; option → symbol|C/P|strike|expiry. */
  key: string;
  symbol: string;
  kind: TradeKind;
  optionType: OptionType | null;
  strike: number | null;
  expiry: string | null;
  multiplier: number;
  /** Signed: negative = short. Shares or contracts. */
  qty: number;
  /** Average cost per unit (per share / premium per share), native currency. */
  avgCost: number;
  /** Realized P&L to date (native currency, fees deducted). */
  realized: number;
  trades: number;
}

/** A position valued against the market (native currency unless noted). */
export interface ValuedPosition extends Position {
  currency: string;
  /** Per-unit mark: live price, option market quote, or intrinsic fallback. */
  mark: number | null;
  /** How the mark was obtained. */
  markSource: "live" | "intrinsic" | "none";
  marketValue: number | null;
  unrealized: number | null;
  unrealizedPct: number | null;
  dayChangePct: number | null;
  /** Options: expired flag (record a closing trade to realize). */
  expired: boolean;
  /** USD conversion rate applied for portfolio totals (1 for USD). */
  fxToUsd: number;
}

export interface PnlPoint {
  /** ISO date (trading day). */
  date: string;
  /** Total P&L in USD: open-position value + cumulative signed cashflow. */
  pnl: number;
  /** Market value of open positions (USD). */
  value: number;
}

export interface PortfolioSummary {
  /** All USD. */
  marketValue: number;
  costBasis: number;
  unrealized: number;
  realized: number;
  /** Dividend cash received to date (USD; included in totalPnl). */
  dividends: number;
  totalPnl: number;
  dayChange: number | null;
  currencyNote: string;
}

export interface PortfolioPayload {
  summary: PortfolioSummary;
  series: PnlPoint[];
  stocks: ValuedPosition[];
  options: ValuedPosition[];
  trades: Trade[];
  /** Working orders (paper execution against live quotes). */
  openOrders: Order[];
  /** Recent completed orders (filled / canceled / expired), newest first. */
  orderHistory: Order[];
  /** Detected dividends awaiting confirmation. */
  pendingDividends: PendingDividend[];
  /** Applied dividends, newest first. */
  dividends: DividendReceipt[];
  /** Total dividend cash received per symbol (USD, net of withholding). */
  dividendsBySymbol: Record<string, number>;
  /** Per-symbol dividend-reinvestment setting for held stocks. */
  drip: Record<string, boolean>;
  /** Starting cash (USD) the investor set for this book; null = not set. */
  initialCapital: number | null;
  /**
   * Cash on hand (USD): initial capital + every ledger cashflow to date
   * (sells − buys − fees + dividends, at trade-date FX). Null until initial
   * capital is set.
   */
  cash: number | null;
  /** Symbols whose market data could not be fetched (excluded from series). */
  unpriced: string[];
}

/** Involvement in one ticker, for the desk page + watchlist badge + analyst context. */
export interface TickerInvolvement {
  symbol: string;
  currency: string;
  stock: ValuedPosition | null;
  options: ValuedPosition[];
  /** Native currency. */
  realized: number;
  unrealized: number | null;
  /** Total dividend cash received on this name (native currency, net of withholding). */
  dividends: number;
  /** Per-symbol dividend-reinvestment setting (future dividend applies buy shares). */
  drip: boolean;
  /** Native→USD rate (1 for USD; null when FX is unavailable — never guessed). */
  fxToUsd: number | null;
}

/** Shape the agents emit when proposing a new signal (pre-approval). */
export interface SignalProposal {
  name: string;
  type: SignalType;
  focusArea: string;
  thesis: string;
  measurementPlan: string;
  scale: string;
  /**
   * Exact name of the ACTIVE signal this proposal replaces and subsumes
   * (a sharper/more comprehensive crux signal), or "" if purely additive.
   * Approving a replacement retires the named signal.
   */
  replaces?: string;
}

export interface FocusAreaProposal {
  title: string;
  description: string;
}
