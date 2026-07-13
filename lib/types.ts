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
export type RunStatus = "running" | "done" | "error";

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
}

export interface Ticker {
  symbol: string;
  name: string;
  addedAt: string;
  onboarded: number; // 0 | 1
  lastRunAt: string | null;
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
