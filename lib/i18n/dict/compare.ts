/** Compare page — side-by-side weighing of two desks (theses, matched signals, verdict). */

const en = {
  title: "Compare desks",
  subtitle: "Weigh two businesses side by side — theses, matched signals, red flags.",
  pickDesk: "Pick a desk…",
  vs: "vs",
  needTwo: "Add and onboard at least two tickers to compare their desks.",
  loadingBoth: "Loading both desks…",

  // Signal cells
  notTracked: "not tracked",
  awaitingFirstReading: "awaiting first reading",
  carryFwd: "carry-fwd",

  // Board pulse strip
  mktCap: "mkt cap",
  peRatio: "P/E",
  goodCount: "{n} strong/improving",
  badCount: "{n} weak/deteriorating",
  confFresh: "conf (fresh)",

  // Standing theses
  thesisTitle: "{sym} — the business, as the desk reads it",
  noDossier: "No dossier yet — run research on this desk first.",

  // Analyst verdict
  verdictTitle: "Analyst verdict — opportunity cost",
  verdictDesc:
    "Four filters in veto order, price last; kill lists compared; weighed on the desks’ existing evidence only — run each desk’s research first for freshness.",
  weighTitle: "Weigh {a} against {b} as businesses",
  weighDisabledTitle: "Both desks need a dossier or at least one read signal — run research first",
  weighing: "Weighing…",
  weighAgain: "Weigh again",
  weighPair: "Weigh {a} vs {b}",
  weighingNote: "The analyst is weighing both boards — filters, moat mechanisms, kill lists…",
  verdictDisclaimer: "Weighs the businesses, not the stocks — no trade advice; the decision stays yours.",

  // Matched signals
  matchedTitle: "Matched signals — same question, both businesses",
  noOverlap:
    "No overlapping signal themes — these desks ask different questions of their businesses (that itself is worth knowing).",
  onlyDeskWatches: "Only the {sym} desk watches",
  nothingUnique: "nothing unique",
  matchNote: "Signals are matched by thesis similarity — open a desk to see full evidence and history.",
} as const;

const zh: Record<keyof typeof en, string> = {
  title: "对比研究台",
  subtitle: "并排称量两家企业——投资论点、匹配信号与风险警示。",
  pickDesk: "选择研究台…",
  vs: "vs",
  needTwo: "请先添加并完成至少两个股票代码的引导，才能对比它们的研究台。",
  loadingBoth: "正在加载两个研究台…",

  notTracked: "未跟踪",
  awaitingFirstReading: "等待首次读数",
  carryFwd: "延续",

  mktCap: "市值",
  peRatio: "市盈率",
  goodCount: "{n} 个强劲/改善中",
  badCount: "{n} 个疲弱/恶化中",
  confFresh: "置信度（新证据）",

  thesisTitle: "{sym}——研究台眼中的这家企业",
  noDossier: "尚无业务档案——请先在该研究台运行研究。",

  verdictTitle: "分析师结论——机会成本",
  verdictDesc:
    "四道筛选按否决顺序进行，价格放在最后；对比双方的否决清单；仅基于两个研究台的现有证据称量——如需最新情况，请先分别运行研究。",
  weighTitle: "以企业视角称量 {a} 与 {b}",
  weighDisabledTitle: "两个研究台都需要业务档案或至少一个已有读数的信号——请先运行研究",
  weighing: "称量中…",
  weighAgain: "重新称量",
  weighPair: "称量 {a} vs {b}",
  weighingNote: "分析师正在称量两块信号板——筛选条件、护城河机制、否决清单…",
  verdictDisclaimer: "称量的是企业而非股票——不构成交易建议；决定权始终在您手中。",

  matchedTitle: "匹配信号——同一问题，两家企业",
  noOverlap: "没有重叠的信号主题——两个研究台向各自的企业提出的问题不同（这本身也值得了解）。",
  onlyDeskWatches: "仅 {sym} 研究台在跟踪",
  nothingUnique: "无独有信号",
  matchNote: "信号按论点相似度匹配——打开研究台可查看完整证据与历史。",
};

export const compare = { en, zh };
