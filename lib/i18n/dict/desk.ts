/**
 * Ticker desk page (app/t/[symbol]) + RunBanner. UI chrome only — signal
 * names, theses, briefs, dossiers, digest items and run stageDetail arrive
 * already localized from the API and render untouched.
 */

const en = {
  // Page states & header
  notFound: "Desk not found",
  notFoundBack: "← Back to watchlist",
  opening: "Opening the {symbol} desk…",
  researching: "Researching…",
  runNow: "Run research now",
  stopResearch: "Stop research",
  stopHint: "Stop the run in progress so you can start a fresh one.",

  // The steerable question stage: review/edit today's focus questions before
  // the sweeps; the questions stay on the page after the run finishes.
  steerTitle: "Today's focus questions — review before the run",
  steerExplainer:
    "The question suggestor framed what this run should answer — from the board, your record and what past runs already answered. Edit, remove or add questions; the sweeps steer by exactly what you submit.",
  steerFraming: "Framing questions…",
  steerStart: "▶ Start research",
  steerStarting: "Starting…",
  steerCancel: "Cancel",
  steerAdd: "+ Add question",
  steerPlaceholder: "A concrete, answerable question for today's sweeps…",
  steerEmptyHint: "No questions — the run will sweep broadly without focus steering.",
  questionsTitle: "What this run set out to answer",
  questionsAnsweredNote:
    "The brief below reports what each question found — an honest “no evidence” included.",
  errRunning: "Research is already running on this ticker.",

  // Single-signal checks (the per-signal "Run signal research" pipeline)
  runSignal: "✦ Run signal research",
  signalCheckingShort: "Checking…",
  signalCheckBusy: "Another research run is in flight on this desk — one at a time.",
  signalCheckFailed: "Signal research failed: {error}",
  signalCheckNote: "Last check",

  // Onboarding
  setupTitle: "Desk setup.",
  setupBody:
    "Tell the analyst what you want to understand about {name}. It will propose focus areas and trackable signals — approve the ones you want, and the first research run starts automatically.",
  proposedBoard: "Proposed signal board",
  awaitingApproval: "{n} awaiting approval",

  // Analyst proposals
  analystProposals: "Analyst proposals",
  awaitingYourApproval: "{n} awaiting your approval",
  proposalsExplainer:
    "The desk rediscovers candidate signals as the story evolves — nothing is tracked without your sign-off. Proposals marked ⇄ replace an active signal on approval. Approving a selection ignores the rest — one decision resolves the whole queue.",

  // Dossier (standing view)
  dossierTitle: "The business, as the desk reads it",
  dossierProvenance:
    "Standing view synthesized from the signal board — evolves only when evidence moves it, unlike the daily brief below.",
  dossierRevised: "Last revised {when}.",
  dossierRevisedHeld: "Last revised {when} · held for {n} runs.",
  retiredSuffix: "{name} (retired)",

  // Brief & evidence feed
  todaysBrief: "Today’s brief",
  briefPreparing: "The desk is preparing its first brief…",
  briefNone: "No brief yet — run today’s research.",
  evidenceFeed: "Evidence feed",
  trackStoryMsg:
    'No signal on the board watches this thread — draft a trackable signal from it (I\'ll approve or ignore): "{headline}" — {summary}{url}. Anchor it to the business model or culture, give it a measurement plan, and set "replaces" if it subsumes an active signal.',
  trackStoryUrl: " ({url})",

  // Signal board
  signalBoard: "Signal board",
  viewLabel: "view:",
  sortFocus: "Focus areas",
  sortStale: "Stalest first",
  sortConfidence: "Thinnest confidence",
  sortHealth: "Weakest first",
  statActiveOne: "{n} active signal",
  statActiveMany: "{n} active signals",
  statMoved: "moved on new evidence",
  statCarried: "carried forward",
  statUnread: "awaiting first reading",
  statDistinctSources: "{n} distinct sources",
  rosterTitle: "Show the board's full source roster",
  statSignalLinks: "({n} signal links)",
  statCompanyN: "{n} company",
  statRegulatorN: "{n} regulator",
  statIndependentN: "{n} independent",
  statAvgConf: "avg confidence (fresh)",
  rosterSignalOne: "{n} signal",
  rosterSignalMany: "{n} signals",
  rosterLinkOne: "{n} link",
  rosterLinkMany: "{n} links",
  companyConcentration:
    "{c} of {total} evidence links come from company-controlled sources — corroborate independently.",
  noActiveSignals: "No active signals.",
  otherFocusArea: "Other",

  // Archive
  archive: "Archive",
  archiveCounts: "{r} retired · {d} dismissed",
  historyLink: "history ⤢",
  archiveOpenTitle: "View this signal's full evidence trail (read-only)",
  supersededBy: "superseded by “{name}”",
  guardReplacedActive: "“{name}” replaced this signal and is still active:",
  swapBack: "Swap back — retires “{name}”",
  keepBoth: "Keep both anyway",
  keepBothTitle: "Both signals will be active — watch for overlap",
  reactivate: "Reactivate",
  restoreProposal: "Restore proposal",
  reactivateTitle: "Return this signal to the active board",
  restoreTitle: "Return this proposal to the approval queue",

  // Bulk proposal bar
  selectAll: "Select all",
  clearSelection: "Clear selection",
  nSelected: "{n} selected",
  approveN: "Approve {n}",
  approveNIgnoreRest: "Approve {n} · ignore rest ({rest})",
  ignoreN: "Ignore {n}",
  bulkApproveTitleAll: "Activates the selected signals",
  bulkApproveTitleOne:
    "Activates your {n} selected signal and ignores the other {rest} — one decision resolves the queue (ignored proposals stay recoverable in the archive)",
  bulkApproveTitleMany:
    "Activates your {n} selected signals and ignores the other {rest} — one decision resolves the queue (ignored proposals stay recoverable in the archive)",
  bulkRetires: "⇄ approving retires {names}",
  bulkRetiresMore: " +{n} more",
  listJoiner: ", ",
  anActiveSignal: "an active signal",

  // Undo toasts & errors
  toastRetired: "Retired “{name}”",
  toastDismissed: "Dismissed “{name}” — it moved to the archive",
  toastSwapped: "Swapped in “{name}” — retired “{old}”",
  toastBulkApproved: "Approved {n} · ignored the other {m} (archived)",
  replacedSignalFallback: "the replaced signal",
  predecessorFallback: "its predecessor",
  errBulkFailed: "Bulk action failed",

  // Full-screen desk bar
  backToBoard: "Back to board",

  // RunBanner
  stageQuestions: "Questions framed",
  stageSweeping: "Scouts sweep the web",
  stageProbing: "Analyst commissions deep dives",
  stageSynthesizing: "Deep synthesis",
  stageRecording: "Board updated",
  runQuestionsTitle: "Today's focus questions",
  runFailed: "Research run failed",
  runInProgress: "Daily research in progress",
  startedAgo: "started {when}",
} as const;

const zh: Record<keyof typeof en, string> = {
  notFound: "未找到该研究台",
  notFoundBack: "← 返回自选列表",
  opening: "正在打开 {symbol} 研究台…",
  researching: "研究中…",
  runNow: "立即运行研究",
  stopResearch: "停止研究",
  stopHint: "停止正在进行的研究，以便重新开始一次新的研究。",

  steerTitle: "今日焦点问题——运行前审阅",
  steerExplainer:
    "提问器已根据信号板、你的记录以及过往运行已回答的问题，拟定本次研究要回答的问题。可编辑、删除或添加——检索将严格按你提交的问题展开。",
  steerFraming: "正在拟定问题……",
  steerStart: "▶ 开始研究",
  steerStarting: "启动中……",
  steerCancel: "取消",
  steerAdd: "+ 添加问题",
  steerPlaceholder: "一个具体、可通过检索回答的问题……",
  steerEmptyHint: "没有问题——本次运行将进行广泛扫描，不设焦点问题。",
  questionsTitle: "本次运行要回答的问题",
  questionsAnsweredNote: "下方晨报逐一汇报每个问题的发现——包括诚实的“未找到证据”。",
  errRunning: "该股票的研究正在进行中。",

  runSignal: "✦ 运行信号研究",
  signalCheckingShort: "核查中……",
  signalCheckBusy: "该工作台已有一项研究正在进行——一次只能运行一项。",
  signalCheckFailed: "信号研究失败：{error}",
  signalCheckNote: "上次核查",

  setupTitle: "研究台设置。",
  setupBody:
    "告诉分析师您想了解 {name} 的哪些方面。分析师将提出关注领域和可跟踪的信号——批准您想要的信号后，首次研究运行会自动开始。",
  proposedBoard: "拟议信号板",
  awaitingApproval: "{n} 个待批准",

  analystProposals: "分析师提案",
  awaitingYourApproval: "{n} 个待您批准",
  proposalsExplainer:
    "随着企业故事的演进，研究台会不断发掘候选信号——未经您批准，任何信号都不会被跟踪。标有 ⇄ 的提案在批准后将替代一个现有信号。批准所选提案即忽略其余提案——一次决定即可清空整个队列。",

  dossierTitle: "研究台眼中的这家企业",
  dossierProvenance:
    "由信号板综合而成的长期观点——仅当证据推动时才会演变，有别于下方的每日晨报。",
  dossierRevised: "最近修订于 {when}。",
  dossierRevisedHeld: "最近修订于 {when} · 已连续 {n} 次运行保持不变。",
  retiredSuffix: "{name}（已停用）",

  todaysBrief: "今日晨报",
  briefPreparing: "研究台正在准备首份晨报…",
  briefNone: "还没有晨报——请运行今日研究。",
  evidenceFeed: "证据流",
  trackStoryMsg:
    "信号板上还没有信号在跟踪这条线索——请据此起草一个可跟踪的信号（我会批准或忽略）：“{headline}”——{summary}{url}。请将其锚定到商业模式或企业文化，制定相应的测量计划；若它可涵盖某个现有信号，请设置“replaces”（替代）。",
  trackStoryUrl: "（{url}）",

  signalBoard: "信号板",
  viewLabel: "视图：",
  sortFocus: "关注领域",
  sortStale: "最久未更新优先",
  sortConfidence: "置信度最低优先",
  sortHealth: "最疲弱优先",
  statActiveOne: "{n} 个已启用信号",
  statActiveMany: "{n} 个已启用信号",
  statMoved: "个因新证据变动",
  statCarried: "个延续前值",
  statUnread: "个等待首次读数",
  statDistinctSources: "{n} 个不同来源",
  rosterTitle: "显示信号板的完整来源清单",
  statSignalLinks: "（{n} 条信号链接）",
  statCompanyN: "公司来源 {n} 条",
  statRegulatorN: "监管来源 {n} 条",
  statIndependentN: "独立来源 {n} 条",
  statAvgConf: "平均置信度（新证据）",
  rosterSignalOne: "{n} 个信号",
  rosterSignalMany: "{n} 个信号",
  rosterLinkOne: "{n} 条链接",
  rosterLinkMany: "{n} 条链接",
  companyConcentration:
    "{total} 条证据链接中有 {c} 条来自公司控制的来源——请通过独立来源交叉验证。",
  noActiveSignals: "暂无已启用信号。",
  otherFocusArea: "其他",

  archive: "归档",
  archiveCounts: "{r} 个已停用 · {d} 个已忽略",
  historyLink: "历史 ⤢",
  archiveOpenTitle: "查看该信号的完整证据记录（只读）",
  supersededBy: "已被“{name}”替代",
  guardReplacedActive: "“{name}”已替代该信号，且仍在启用中：",
  swapBack: "换回——停用“{name}”",
  keepBoth: "仍保留两者",
  keepBothTitle: "两个信号都将处于启用状态——请留意重叠",
  reactivate: "重新启用",
  restoreProposal: "恢复提案",
  reactivateTitle: "将该信号恢复至启用信号板",
  restoreTitle: "将该提案恢复至审批队列",

  selectAll: "全选",
  clearSelection: "清除选择",
  nSelected: "已选 {n} 个",
  approveN: "批准 {n} 个",
  approveNIgnoreRest: "批准 {n} 个 · 忽略其余（{rest} 个）",
  ignoreN: "忽略 {n} 个",
  bulkApproveTitleAll: "启用选中的信号",
  bulkApproveTitleOne:
    "启用您选中的 {n} 个信号并忽略其余 {rest} 个——一次决定即可清空队列（被忽略的提案仍可从归档中恢复）",
  bulkApproveTitleMany:
    "启用您选中的 {n} 个信号并忽略其余 {rest} 个——一次决定即可清空队列（被忽略的提案仍可从归档中恢复）",
  bulkRetires: "⇄ 批准将停用 {names}",
  bulkRetiresMore: " 及另外 {n} 个",
  listJoiner: "、",
  anActiveSignal: "一个已启用信号",

  toastRetired: "已停用“{name}”",
  toastDismissed: "已忽略“{name}”——已移入归档",
  toastSwapped: "已换入“{name}”——已停用“{old}”",
  toastBulkApproved: "已批准 {n} 个 · 其余 {m} 个已忽略（已归档）",
  replacedSignalFallback: "被替代的信号",
  predecessorFallback: "其前身信号",
  errBulkFailed: "批量操作失败",

  backToBoard: "返回信号板",

  stageQuestions: "研究问题已拟定",
  stageSweeping: "侦察员扫描全网",
  stageProbing: "分析师委派深度调查",
  stageSynthesizing: "深度综合",
  stageRecording: "信号板已更新",
  runQuestionsTitle: "今日核心问题",
  runFailed: "研究运行失败",
  runInProgress: "每日研究进行中",
  startedAgo: "开始于 {when}",
};

export const desk = { en, zh };
