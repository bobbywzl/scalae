/**
 * Desk search — the floating per-ticker search that spans all three pills
 * (Signals, Due diligence, Finance) and every text block type they hold.
 */

const en = {
  open: "Search this desk",
  placeholder: "Search notes, memos, signals, evidence…",
  hint: "Across all three pills — notes, memos, signals, evidence, chats and recent briefs. Desk research is matched in its canonical English.",
  minChars: "Keep typing — two characters starts the search.",
  searching: "Searching…",
  empty: "No matches for “{q}”.",
  matches: "{n} match(es)",
  keys: "↑↓ move · ↵ open · esc close",
  filterAll: "All",
  // Block-type labels (the "type" filter + the chip on each result)
  type_section: "Section",
  type_note: "Notepad",
  type_memo: "Research memo",
  type_synthesis: "Core insights",
  type_evidence: "Evidence",
  type_annotation: "Highlight",
  type_signal: "Signal",
  type_backstory: "Deep history",
  type_reading: "Reading",
  type_digest: "Evidence feed",
  type_brief: "Today’s brief",
  type_dossier: "Dossier",
  type_chat: "Desk chat",
  type_focus: "Focus area",
  type_adjustment: "Adjustment",
  type_finChat: "Analyst desk",
  type_finLog: "Audit log",
  type_finPass: "Moderation pass",
} as const;

const zh: Record<keyof typeof en, string> = {
  open: "搜索这个工作台",
  placeholder: "搜索笔记、备忘录、信号、证据……",
  hint: "跨三个标签页搜索——笔记、备忘录、信号、证据、对话与近期晨报。工作台研究内容以英文原文记录并匹配；你自己写下的内容按原文匹配。",
  minChars: "继续输入——两个字符即开始搜索。",
  searching: "搜索中……",
  empty: "没有与“{q}”匹配的结果。",
  matches: "{n} 条结果",
  keys: "↑↓ 移动 · ↵ 打开 · esc 关闭",
  filterAll: "全部",
  type_section: "板块",
  type_note: "记事本",
  type_memo: "研究备忘录",
  type_synthesis: "核心洞见",
  type_evidence: "证据",
  type_annotation: "高亮批注",
  type_signal: "信号",
  type_backstory: "深度历史",
  type_reading: "读数",
  type_digest: "证据流",
  type_brief: "今日晨报",
  type_dossier: "档案",
  type_chat: "工作台对话",
  type_focus: "关注领域",
  type_adjustment: "调整项",
  type_finChat: "财务分析台",
  type_finLog: "审计日志",
  type_finPass: "建议扫描",
};

export const search = { en, zh };
