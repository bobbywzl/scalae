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

export interface Ticker {
  symbol: string;
  name: string;
  addedAt: string;
  onboarded: number; // 0 | 1
  lastRunAt: string | null;
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
  createdAt: string;
  approvedAt: string | null;
}

export interface Citation {
  title: string;
  url: string;
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
  error: string | null;
}

export interface ChatMessage {
  id: string;
  symbol: string;
  role: "user" | "assistant";
  content: string;
  proposalIds: string[];
  createdAt: string;
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

export interface SignalWithReadings extends Signal {
  latest: Reading | null;
  history: Reading[];
}

/** Full payload for the ticker detail page. */
export interface DeskPayload {
  ticker: Ticker;
  quote: Quote | null;
  focusAreas: FocusArea[];
  active: SignalWithReadings[];
  suggested: Signal[];
  retired: Signal[];
  latestRun: Run | null;
  digest: DigestItem[];
  messages: ChatMessage[];
}

export interface WatchlistRow {
  ticker: Ticker;
  quote: Quote | null;
  activeCount: number;
  suggestedCount: number;
  running: boolean;
  stale: boolean;
}

/** Shape the agents emit when proposing a new signal (pre-approval). */
export interface SignalProposal {
  name: string;
  type: SignalType;
  focusArea: string;
  thesis: string;
  measurementPlan: string;
  scale: string;
}

export interface FocusAreaProposal {
  title: string;
  description: string;
}
