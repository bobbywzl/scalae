/**
 * memory namespace — the desk-memory surfaces (standing orders, source map,
 * promise ledger), the field file, the triangulation audit, the plan gate and
 * episode-rhyme analysis. Server-delivered content (order texts, promise
 * texts, analyses) arrives already localized; these are the chrome around it.
 *
 * Glossary additions: standing order 常设指令 · source map 信源地图 ·
 * cooperative steering 协同引导 · promise ledger 承诺台账 · field file 实地档案 ·
 * triangulation 三角验证 · plan gate 计划关口 · episode rhyme 历史押韵
 */

const en = {
  // Standing orders (the lessons ledger)
  ordersTitle: "Standing orders",
  ordersExplainer:
    "Durable conduct instructions the desk has learned from you — once approved, they bind every run, chat turn and memo. They steer conduct, never truth.",
  ordersEmpty:
    "None yet. Teach the desk in chat (“from now on…”), give a reason when ignoring a proposal, or write one below.",
  ordersAddPlaceholder: "Add a standing order (e.g. “Prefer unit-pricing evidence over survey data”)…",
  ordersAdd: "Add",
  ordersArchive: "{n} archived",
  awaitingApproval: "{n} awaiting approval",
  lessonOriginChat: "distilled from chat",
  lessonOriginDismissal: "distilled from a dismissal",
  lessonOriginInvestor: "written by you",
  basisLabel: "Basis",
  approve: "Approve",
  ignore: "Ignore",
  retire: "Retire",
  reactivate: "Reactivate",
  editTitle: "Edit the wording",

  // Source map + cooperative steering
  sourcesTitle: "Source map",
  sourcesExplainer:
    "Where this company's authentic record lives — tallied from the desk's own citations, curated by you. Recurring primary sources surface here for approval.",
  sourcesEmpty:
    "The map fills as runs cite sources — recurring primary and trade sources will surface here for your approval.",
  steeringLabel: "Cooperative steering",
  steeringOn: "ON",
  steeringOff: "OFF",
  steeringOnHint:
    "Scouts check your approved sources first on every run and deep-research pass. The map steers where they look, never what counts as evidence.",
  steeringOffHint: "The map is reference only — research direction stays fully with the desk.",
  kind_primary: "primary",
  kind_trade: "trade",
  kind_narrative: "narrative",
  kind_avoid: "avoid",
  groupCheckFirst: "Check first",
  groupAvoid: "Distrust",
  groupReference: "Reference",
  citedTimes: "cited in {n} runs",
  srcDomainPlaceholder: "domain (e.g. ir.company.com)",
  srcNotePlaceholder: "what it's good for (optional)",
  srcAdd: "Add",
  srcRemoveTitle: "Remove from the map",

  // Promise ledger
  promisesTitle: "Promise ledger",
  promisesExplainer:
    "Management's concrete commitments, tracked to their outcomes — candor as a time series, never business evidence.",
  promisesEmpty:
    "Nothing tracked yet — daily runs propose entries when management commits to something concrete, or record one below.",
  promisesAddPlaceholder: "Record a promise (e.g. “CFO: buyback of $2B by FY2026”)…",
  promisesAdd: "Add",
  statusOpen: "open",
  statusKept: "kept",
  statusMissed: "missed",
  statusDropped: "dropped",
  promiseMeta: "{by} · {made}",
  dueLabel: "due {due}",
  proposedBanner: "Desk proposes “{status}”: {note}",
  confirm: "Confirm",
  notYet: "Not yet",
  resolveLabel: "Resolve:",
  reopen: "Reopen",
  resolvedTally: "{kept} kept · {missed} missed · {dropped} dropped",
  resolvedArchive: "{n} resolved",

  // Field file (the run's persisted scout reports)
  fieldFileButton: "Field file",
  fieldFileTitle: "The scouts' raw reports behind this brief — the desk's evidence chain, verbatim.",
  fieldFileLoading: "Opening the field file…",
  fieldFileEmpty: "No field file was recorded for this run.",
  fieldFileReports: "{n} scout reports",
  fieldFileDeepDive: "deep dive",
  fieldFileReused: "reused from the morning run",
  fieldFileSources: "{n} sources",

  // Triangulation audit (post-synthesis)
  auditLabel: "Triangulation audit",
  auditOpenQuestions: "Still unanchored — queued for tomorrow's run:",
  verif_corroborated: "✓ corroborated",
  verif_contradicted: "✗ contradicted",
  verif_unanchored: "◌ unanchored",
  verifTitle: "Triangulation: {note}",

  // Teach-the-desk dismissal reason
  whyPlaceholder: "Why? (optional — teaches the desk)",
  whyHint: "A stated reason becomes gate memory and may be distilled into a standing order for your approval.",

  // Analyst questions (the desk asking the investor)
  qTitle: "The analyst asks",
  qExplainer:
    "Questions the open web cannot answer — your firsthand experience, your judgment, the documents only you hold. Your answers become first-class evidence for every later run.",
  qOpenBadge: "{n} awaiting you",
  qWhyPrefix: "Why the desk asks",
  qAnswerPlaceholder: "Your answer — firsthand and specific beats polished…",
  qAnswer: "Answer",
  qAnswered: "{n} answered",
  qYourAnswer: "You",
  qAnsweredOn: "answered {date}",
  qDismissTitle: "Dismiss — the desk won't ask again",
  qReopenTitle: "Reopen for a fresh answer (your current answer is kept until you resend)",

  // Deep-research plan gate
  planFirst: "✎ Plan first",
  planFirstTitle: "The desk drafts the research plan for your edit and approval before any searching",
  planDrafting: "Drafting the research plan…",
  planReviewTitle: "Research plan — yours to edit",
  planExplainer:
    "Edit the plan freely; your edits are binding on the pass. Nothing runs until you start it.",
  startResearch: "Start research",
  discardPlan: "Discard",

  // Finance table self-inspection (the cleansing bench)
  finInspectTitle: "Table inspection",
  finInspectClean: "The extracted table read clean — no findings.",
  finKindAnomaly: "anomaly",
  finKindDataQuality: "data quality",
  finKindTrend: "trend",
  finKindPattern: "pattern",

  // Episode-rhyme analysis
  rhymeButton: "History rhyme",
  rhymeButtonTitle: "Weigh this development against the company's and industry's record",
  rhymeRunning: "Comparing to the record…",
  rhymeVerdict_normal: "Normal variation",
  rhymeVerdict_rhyme: "Rhymes: {episode}",
  rhymeVerdict_break: "Genuine break from the record",
  rhymeFailed: "Comparison failed",
  rhymeTryAgain: "try again",
} as const;

const zh: Record<keyof typeof en, string> = {
  ordersTitle: "常设指令",
  ordersExplainer:
    "研究台从您这里学到的持久行为准则——一经批准，将约束每次研究运行、对话与备忘录。指令只引导行为，绝不扭曲事实。",
  ordersEmpty: "暂无。可在对话中教研究台（“从现在起……”），在忽略提案时说明原因，或在下方直接写一条。",
  ordersAddPlaceholder: "添加常设指令（例如“单位定价证据优先于调查数据”）…",
  ordersAdd: "添加",
  ordersArchive: "{n} 条已归档",
  awaitingApproval: "{n} 条待批准",
  lessonOriginChat: "从对话中提炼",
  lessonOriginDismissal: "从忽略原因中提炼",
  lessonOriginInvestor: "您亲自写下",
  basisLabel: "依据",
  approve: "批准",
  ignore: "忽略",
  retire: "停用",
  reactivate: "重新启用",
  editTitle: "编辑措辞",

  sourcesTitle: "信源地图",
  sourcesExplainer:
    "这家公司的真实记录所在之处——由研究台自身的引用统计而来，由您来把关。反复出现的一手信源会在此等待您批准。",
  sourcesEmpty: "地图随每次研究运行的引用逐步充实——反复出现的一手与行业信源会在此等待您批准。",
  steeringLabel: "协同引导",
  steeringOn: "开",
  steeringOff: "关",
  steeringOnHint: "每次研究运行与深度研究中，侦察员将优先查阅您批准的信源。地图只引导查找方向，绝不限定证据范围。",
  steeringOffHint: "地图仅作参考——研究方向完全由研究台决定。",
  kind_primary: "一手",
  kind_trade: "行业",
  kind_narrative: "转述",
  kind_avoid: "回避",
  groupCheckFirst: "优先查阅",
  groupAvoid: "谨慎对待",
  groupReference: "参考",
  citedTimes: "被 {n} 次运行引用",
  srcDomainPlaceholder: "域名（如 ir.company.com）",
  srcNotePlaceholder: "适用说明（可选）",
  srcAdd: "添加",
  srcRemoveTitle: "从地图中移除",

  promisesTitle: "承诺台账",
  promisesExplainer: "管理层的具体承诺及其兑现记录——坦诚度的时间序列，绝不作为业务证据。",
  promisesEmpty: "暂无跟踪——当管理层做出具体承诺时，每日研究会提议入账；也可在下方直接记录。",
  promisesAddPlaceholder: "记录一条承诺（例如“CFO：FY2026 前回购 20 亿美元”）…",
  promisesAdd: "添加",
  statusOpen: "进行中",
  statusKept: "兑现",
  statusMissed: "失约",
  statusDropped: "放弃",
  promiseMeta: "{by} · {made}",
  dueLabel: "期限 {due}",
  proposedBanner: "研究台判定为“{status}”：{note}",
  confirm: "确认",
  notYet: "暂不",
  resolveLabel: "判定：",
  reopen: "重新打开",
  resolvedTally: "兑现 {kept} · 失约 {missed} · 放弃 {dropped}",
  resolvedArchive: "{n} 条已了结",

  fieldFileButton: "实地档案",
  fieldFileTitle: "本期晨报背后侦察员的原始报告——研究台的证据链，逐字保留。",
  fieldFileLoading: "正在打开实地档案…",
  fieldFileEmpty: "本次运行未记录实地档案。",
  fieldFileReports: "{n} 份侦察报告",
  fieldFileDeepDive: "深挖",
  fieldFileReused: "复用自早间运行",
  fieldFileSources: "{n} 个信源",

  auditLabel: "三角验证",
  auditOpenQuestions: "尚未锚定——已列入明日研究：",
  verif_corroborated: "✓ 已印证",
  verif_contradicted: "✗ 有矛盾",
  verif_unanchored: "◌ 未锚定",
  verifTitle: "三角验证：{note}",

  whyPlaceholder: "原因？（可选——教研究台学习）",
  whyHint: "写下的原因会成为审批记忆，并可能被提炼为一条常设指令供您批准。",

  qTitle: "分析师提问",
  qExplainer: "开放网络无法回答的问题——您的一手体验、您的判断、只有您持有的文件。您的回答将成为此后每次研究的一手证据。",
  qOpenBadge: "{n} 条待您回答",
  qWhyPrefix: "提问缘由",
  qAnswerPlaceholder: "您的回答——一手且具体，胜过面面俱到…",
  qAnswer: "回答",
  qAnswered: "{n} 条已回答",
  qYourAnswer: "您",
  qAnsweredOn: "回答于 {date}",
  qDismissTitle: "忽略——研究台不会再问",
  qReopenTitle: "重新打开以更新回答（重新提交前保留现有回答）",

  planFirst: "✎ 先拟计划",
  planFirstTitle: "研究台先起草研究计划，经您修改批准后再开始检索",
  planDrafting: "正在起草研究计划…",
  planReviewTitle: "研究计划——由您修改",
  planExplainer: "可自由修改计划；您的修改对本次研究具有约束力。未经您启动，不会开始检索。",
  startResearch: "开始研究",
  discardPlan: "放弃",

  finInspectTitle: "报表体检",
  finInspectClean: "提取的报表读数正常——无发现。",
  finKindAnomaly: "异常",
  finKindDataQuality: "数据质量",
  finKindTrend: "趋势",
  finKindPattern: "惯犯",

  rhymeButton: "历史押韵",
  rhymeButtonTitle: "将这一进展与公司及行业的历史记录对照衡量",
  rhymeRunning: "正在对照历史记录…",
  rhymeVerdict_normal: "正常波动",
  rhymeVerdict_rhyme: "与历史押韵：{episode}",
  rhymeVerdict_break: "史无前例",
  rhymeFailed: "对照失败",
  rhymeTryAgain: "重试",
};

export const memory = { en, zh };
