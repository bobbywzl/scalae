/**
 * signals namespace — signal board cards, proposal cards, the segmented
 * signal detail view and the digest (evidence) feed. Server-delivered content
 * (names, theses, rationales, headlines) arrives already localized; these are
 * the chrome/labels around it.
 */

const en = {
  // Shared signal chrome
  typeQuantitative: "# quantitative",
  typeQualitative: "◆ qualitative",
  awaitingFirstRun: "Awaiting first research run.",
  sourcesOne: "{n} source",
  sourcesMany: "{n} sources",
  readingsOne: "{n} reading",
  readingsMany: "{n} readings",

  // SignalCard
  confidenceTitle: "Confidence {pct}%",
  sparkTitle: "{n} readings · {min} → {max} range",
  noChangeThisRun: "No change — no new information this run.",
  viewAllSources: "View all sources this signal has accumulated",
  openHint: "open ⤢",
  overlapsChip: "⇄ overlaps: {name}",
  overlapKeptTitle: "You chose to keep both — open the overlapping signal",
  moreSources: "+{n} more",

  // Evidence catalog (sources modal + detail section)
  evidenceCatalog: "Evidence catalog",
  catalogGrows: "grows with each run",
  citedInReadings: "Cited in {n} readings",
  addedOn: "added {date}",
  lastCited: "last cited {date}",
  viaSources: "via {src}",

  // SuggestionCard (proposals)
  originOnboarding: "from onboarding",
  originChat: "from your feedback",
  originResearch: "discovered in today's research",
  selectProposal: "Select proposal",
  deselectProposal: "Deselect proposal",
  replacesBanner: "⇄ Replaces “{name}” — approving swaps it in and retires the old signal",
  dismissedMemoryTitle:
    "Institutional memory: the approval gate remembers what you turned down — expect materially new evidence in the thesis",
  dismissedBack: "↩ You dismissed this on {date} — it’s back",
  planLabel: "Plan:",
  approve: "Approve",
  approveSwap: "Approve & swap",
  ignore: "Ignore",

  // SignalDetail — header, retire flow
  retiredBadge: "Retired — history preserved",
  supersededBy: "superseded by “{name}”",
  retireConfirmText: "Stop tracking? It moves to the archive (reversible).",
  confirmRetire: "Confirm retire",
  retireSignal: "Retire signal",
  backToBoard: "Back to board",

  // SignalDetail — latest reading hero
  latestReading: "Latest reading",
  rangeOverReadings: "{min}–{max} over {n} readings",
  confidencePct: "confidence {pct}%",
  priorNoEvidence: "(prior — no evidence yet)",
  neverFreshOne: "No evidence-backed reading yet — carried forward since approval · {n} run.",
  neverFreshMany: "No evidence-backed reading yet — carried forward since approval · {n} runs.",
  carriedSincePre: "Carried forward — no new evidence since ",
  carriedSincePost: ".",

  // SignalDetail — lineage & overlap banners
  replacedPrefix: "⇄ Replaced ",
  viewItsHistory: " — view its history",
  keptAlongsidePre: "⇄ Knowingly kept alongside ",
  keptAlongsidePost: " — watch for overlap · open it",
  overlapKeptDetailTitle:
    "You chose to keep both — the desk will propose one merged signal if they keep reading the same evidence",

  // SignalDetail — thesis & plan
  whyWeTrack: "Why we track this",
  measurementPlan: "Measurement plan",
  scaleLabel: "Scale: {scale}",

  // SignalDetail — deep history (backstory)
  deepHistory: "Deep history",
  deepHistorySub: " — how this aspect has fared through the decades",
  historyBtnTitle: "Company- and industry-specific research: eras, stress episodes, base rates",
  researchingBusy: "Researching…",
  refreshHistory: "Refresh history",
  researchHistory: "Research history",
  historyTracing:
    "Tracing this aspect through the company’s and industry’s record — eras, crises, base rates… (takes a minute or two)",
  researchedAgo: "Researched {when}",
  informsBaseRate: "informs daily readings as this signal’s base rate",
  notResearched: "Not researched yet — the daily run fills this in over time, or research it now.",
  notResearchedRO: "Not researched yet — the daily run fills this in over time.",

  // SignalDetail — evidence rows & source tracing
  traceHint: " — click ⧉ to trace a source through the readings",
  srcCompany: "company IR",
  srcRegulator: "regulator",
  srcIndependent: "independent",
  srcCompanyTitle: "Company-controlled source — management's own account; corroborate independently",
  srcRegulatorTitle: "Regulator filing or notice",
  srcIndependentTitle: "Independent source",
  stopTracing: "Stop tracing this source",
  showCitingOne: "Show the {n} reading citing this source",
  showCitingMany: "Show the {n} readings citing this source",

  // SignalDetail — reading history
  readingHistory: "Reading history",
  citingCount: "· {shown} of {total} citing {src}",
  thisSource: "this source",
  srcClassParen: " ({label})",
  clearFilter: "clear",
  tracedNoneOne:
    "None of the last {total} readings cite this source — its {count} citing reading is older than what's shown here.",
  tracedNoneMany:
    "None of the last {total} readings cite this source — its {count} citing readings are older than what's shown here.",
  tracedSome: "{shown} of {count} citing readings shown — the rest are older than the last {total} readings.",
  confShort: "conf {pct}%",
  carryForward: "carry-forward",

  // Signal-scoped analyst desk
  signalDesk: "Signal desk",
  signalDeskHint:
    "This thread is scoped to “{name}” — the analyst has its thesis, full reading history and evidence catalog in front of it. Ask why the reading moved, challenge the measurement plan, or ask for a sharper replacement signal. (The ticker-level desk keeps the global picture.)",

  // DigestFeed
  noDigest: "No digest yet — run today’s research.",
  sourceClassPrimary: "Primary source",
  sourceClassTrade: "Trade press",
  sourceClassNarrative: "Media report",
  feedRemove: "Remove",
  feedRemoveTitle: "Remove this item from the evidence feed (readings keep their citations)",
  feedRemoveConfirm: "Remove “{headline}” from the evidence feed? Readings keep their citations.",
  srcImplication: "Implication — {level} reading, {date}",
  trackThis: "✚ track this",
  trackThisTitle: "No signal watches this thread — ask the analyst to draft one (you approve it)",
  openSignalTitle: "Open this signal",
  statusSignal: "{status} signal",
} as const;

const zh: Record<keyof typeof en, string> = {
  typeQuantitative: "# 定量",
  typeQualitative: "◆ 定性",
  awaitingFirstRun: "等待首次研究运行。",
  sourcesOne: "{n} 个来源",
  sourcesMany: "{n} 个来源",
  readingsOne: "{n} 个读数",
  readingsMany: "{n} 个读数",

  confidenceTitle: "置信度 {pct}%",
  sparkTitle: "{n} 个读数 · 区间 {min} → {max}",
  noChangeThisRun: "无变化——本次运行无新信息。",
  viewAllSources: "查看此信号累积的全部来源",
  openHint: "打开 ⤢",
  overlapsChip: "⇄ 重叠：{name}",
  overlapKeptTitle: "您选择两者都保留——点击打开与之重叠的信号",
  moreSources: "还有 {n} 个",

  evidenceCatalog: "证据目录",
  catalogGrows: "随每次运行增长",
  citedInReadings: "被 {n} 个读数引用",
  addedOn: "收录于 {date}",
  lastCited: "最近引用于 {date}",
  viaSources: "来自 {src}",

  originOnboarding: "来自引导对话",
  originChat: "来自您的反馈",
  originResearch: "在今日研究中发现",
  selectProposal: "选择提案",
  deselectProposal: "取消选择提案",
  replacesBanner: "⇄ 替代“{name}”——批准后将换入此信号并停用旧信号",
  dismissedMemoryTitle: "机构记忆：批准关卡会记住您忽略过的提案——论点中应包含实质性新证据",
  dismissedBack: "↩ 您曾于 {date} 忽略此提案——现已再次出现",
  planLabel: "测量计划：",
  approve: "批准",
  approveSwap: "批准并替换",
  ignore: "忽略",

  retiredBadge: "已停用——历史已保留",
  supersededBy: "被“{name}”替代",
  retireConfirmText: "停止跟踪？该信号将移入归档（可恢复）。",
  confirmRetire: "确认停用",
  retireSignal: "停用信号",
  backToBoard: "返回信号板",

  latestReading: "最新读数",
  rangeOverReadings: "{min}–{max}（共 {n} 个读数）",
  confidencePct: "置信度 {pct}%",
  priorNoEvidence: "（先验——尚无证据）",
  neverFreshOne: "尚无证据支持的读数——自批准以来一直延续 · 共 {n} 次运行。",
  neverFreshMany: "尚无证据支持的读数——自批准以来一直延续 · 共 {n} 次运行。",
  carriedSincePre: "延续——自 ",
  carriedSincePost: " 起无新证据。",

  replacedPrefix: "⇄ 已替代",
  viewItsHistory: "——查看其历史",
  keptAlongsidePre: "⇄ 您选择与其并存：",
  keptAlongsidePost: "——请留意重叠 · 点击打开",
  overlapKeptDetailTitle: "您选择两者都保留——若二者持续读取相同证据，研究台将提议合并为一个信号",

  whyWeTrack: "为何跟踪此信号",
  measurementPlan: "测量计划",
  scaleLabel: "度量标尺：{scale}",

  deepHistory: "深度历史",
  deepHistorySub: "——该方面数十年来的表现",
  historyBtnTitle: "针对公司与行业的专项研究：时代脉络、压力事件、基础比率",
  researchingBusy: "研究中…",
  refreshHistory: "刷新历史",
  researchHistory: "研究历史",
  historyTracing: "正在追溯该方面在公司与行业记录中的轨迹——时代脉络、危机、基础比率…（约需一两分钟）",
  researchedAgo: "研究于 {when}",
  informsBaseRate: "作为此信号的基础比率，为每日读数提供依据",
  notResearched: "尚未研究——每日运行会逐步补全，您也可以立即研究。",
  notResearchedRO: "尚未研究——每日运行会逐步补全。",

  traceHint: "——点击 ⧉ 可在读数历史中追溯某个来源",
  srcCompany: "公司IR",
  srcRegulator: "监管机构",
  srcIndependent: "独立来源",
  srcCompanyTitle: "公司控制的来源——管理层的自述；请以独立来源相互印证",
  srcRegulatorTitle: "监管机构文件或公告",
  srcIndependentTitle: "独立来源",
  stopTracing: "停止追溯此来源",
  showCitingOne: "显示引用此来源的 {n} 个读数",
  showCitingMany: "显示引用此来源的 {n} 个读数",

  readingHistory: "读数历史",
  citingCount: "· {total} 条中有 {shown} 条引用 {src}",
  thisSource: "此来源",
  srcClassParen: "（{label}）",
  clearFilter: "清除",
  tracedNoneOne: "最近 {total} 条读数均未引用此来源——其 {count} 条引用读数早于此处显示的范围。",
  tracedNoneMany: "最近 {total} 条读数均未引用此来源——其 {count} 条引用读数早于此处显示的范围。",
  tracedSome: "已显示 {count} 条引用读数中的 {shown} 条——其余早于最近 {total} 条读数。",
  confShort: "置信 {pct}%",
  carryForward: "延续",

  signalDesk: "信号研究台",
  signalDeskHint:
    "此对话仅针对“{name}”——分析师掌握其论点、完整读数历史与证据目录。您可以询问读数为何变动、质疑测量计划，或要求提出更精准的替代信号。（股票级研究台掌握全局。）",

  noDigest: "暂无摘要——请运行今日研究。",
  sourceClassPrimary: "一手来源",
  sourceClassTrade: "行业媒体",
  sourceClassNarrative: "媒体报道",
  feedRemove: "移除",
  feedRemoveTitle: "从证据流中移除该条目（各读数仍保留其引用）",
  feedRemoveConfirm: "从证据流中移除“{headline}”？各读数仍保留其引用。",
  srcImplication: "对信号的含义——{level}读数（{date}）",
  trackThis: "✚ 跟踪此线索",
  trackThisTitle: "尚无信号跟踪此线索——可请分析师起草一个（需您批准）",
  openSignalTitle: "打开此信号",
  statusSignal: "{status}信号",
};

export const signals = { en, zh };
