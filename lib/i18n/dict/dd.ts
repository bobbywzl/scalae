/**
 * Due Diligence — the ticker's main page (FOUNDATION: "The due-diligence
 * record is the desk's centre"): sections of deep qualitative topics, each
 * holding freely-editable notepads; on-demand desk research that enters the
 * record only on the investor's accept; and the standing synthesis of core
 * insights across the whole record.
 */

const en = {
  title: "Due diligence",
  pageSubtitle:
    "Your deep qualitative research on {name} — your own notes plus desk research that enters the record only when you accept it.",
  openDiligence: "Due diligence",
  openSignals: "Signals desk",
  tabDiligence: "Due diligence",
  tabSignals: "Signals",
  tabFinCleansing: "Finance cleansing",
  loading: "Loading the record…",

  // Standing synthesis of core insights
  synthesisTitle: "Core insights",
  synthesisExplainer:
    "The whole record — your notes and accepted research — distilled: the thesis as written, its tensions, and the open fronts.",
  synthesisRefresh: "Refresh synthesis",
  synthesisRefreshing: "Synthesizing…",
  synthesisStale: "record changed since this synthesis",
  synthesisNone:
    "No synthesis yet. Once sections hold notes or accepted research, refresh to distill the record's core insights.",
  synthesisRefreshedAgo: "refreshed {when}",

  // Section research
  runResearch: "Deep research",
  researchSteerPlaceholder: "Optional steer — what should this pass dig into?",
  researchRunning:
    "Deep research underway — long-horizon, outside-view and primary-source sweeps, then the memo. A few minutes.",
  researchFailed: "Research failed: {error}",
  tryAgain: "Try again",
  reviewTitle: "Research memo — awaiting your review",
  reviewExplainer:
    "Nothing enters your record without your sign-off. Accept to add this memo to the section as a dated, editable notepad — or dismiss it and the record stays untouched.",
  briefLabel: "In brief",
  accept: "Accept — add to section",
  dismiss: "Dismiss",
  deciding: "Working…",

  // Topic suggestions (the signals → due-diligence half of the loop)
  suggestTopics: "✦ Suggest topics",
  suggesting: "Asking the desk…",
  suggestExplainer: "From your signal board — the right things to look at next:",
  suggestDeepens: "Deepens: {names}",
  suggestNone: "The desk had no new topics to suggest — the record already covers the board's crux questions.",

  // Evidence lockers (any file type, captioned, per section)
  evidenceTitle: "Evidence",
  evidenceDrop: "Drop files here or click to add — filings, screenshots, spreadsheets, photos, anything",
  evidenceUploading: "Filing “{name}”…",
  evidenceCaptionPlaceholder: "Caption — what does this evidence show?",
  evidenceDelete: "Remove evidence",
  evidenceDeleteConfirm: "Remove “{name}” from this section's evidence? This cannot be undone.",
  evidenceOpen: "Open",
  evidenceReadNote: "Readable files are read by the desk when researching this section; everything else is judged by its caption.",
  evidenceFailed: "“{name}” failed: {error}",

  // Signals cross-links
  boardLine: "{n} active signal(s) on the board feed this record.",
  boardLineNone: "No active signals yet — the signals desk proposes what to track.",

  // Errors
  errNeedSection: "Open at least one section before synthesizing.",
  errResearchRunning: "Research is already running on this section.",
} as const;

const zh: Record<keyof typeof en, string> = {
  title: "尽职调查",
  pageSubtitle:
    "你对 {name} 的深度定性研究——你自己的笔记，加上只有经你接受才会进入记录的分析台研究。",
  openDiligence: "尽职调查",
  openSignals: "信号工作台",
  tabDiligence: "尽职调查",
  tabSignals: "信号",
  tabFinCleansing: "财务清洗",
  loading: "正在加载记录……",

  synthesisTitle: "核心洞见",
  synthesisExplainer:
    "整份记录——你的笔记与已接受的研究——的提炼：已写下的论点、其中的张力，以及待开拓的领域。",
  synthesisRefresh: "刷新综合",
  synthesisRefreshing: "综合中……",
  synthesisStale: "记录在此综合之后已有变化",
  synthesisNone: "还没有综合。板块中有了笔记或已接受的研究后，点击刷新即可提炼记录的核心洞见。",
  synthesisRefreshedAgo: "刷新于 {when}",

  runResearch: "深度研究",
  researchSteerPlaceholder: "可选指引——这次研究应聚焦什么？",
  researchRunning: "深度研究进行中——长周期、外部视角与一手来源三路检索，随后撰写备忘录。约需几分钟。",
  researchFailed: "研究失败：{error}",
  tryAgain: "重试",
  reviewTitle: "研究备忘录——待你审阅",
  reviewExplainer:
    "未经你的确认，任何内容都不会进入你的记录。接受后，备忘录将作为带日期、可自由编辑的记事本加入该板块；不采纳则记录保持原样。",
  briefLabel: "要点",
  accept: "接受——加入板块",
  dismiss: "不采纳",
  deciding: "处理中……",

  suggestTopics: "✦ 推荐主题",
  suggesting: "正在询问分析台……",
  suggestExplainer: "来自你的信号板——接下来值得深入的方向：",
  suggestDeepens: "可深化：{names}",
  suggestNone: "分析台暂无新主题可推荐——记录已覆盖信号板的关键问题。",

  evidenceTitle: "证据",
  evidenceDrop: "拖放文件到此处或点击添加——申报文件、截图、电子表格、照片，任何类型皆可",
  evidenceUploading: "正在归档“{name}”……",
  evidenceCaptionPlaceholder: "说明——这份证据显示了什么？",
  evidenceDelete: "移除证据",
  evidenceDeleteConfirm: "从该板块的证据中移除“{name}”？此操作不可撤销。",
  evidenceOpen: "打开",
  evidenceReadNote: "可读文件会在研究该板块时被分析台阅读；其余文件按其说明来判断。",
  evidenceFailed: "“{name}”失败：{error}",

  boardLine: "信号板上有 {n} 个活跃信号为这份记录供给证据。",
  boardLineNone: "还没有活跃信号——信号工作台会提议要跟踪的信号。",

  errNeedSection: "请先创建至少一个板块，再进行综合。",
  errResearchRunning: "该板块的研究正在进行中。",
};

export const dd = { en, zh };
