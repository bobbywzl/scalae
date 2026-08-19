/**
 * Shared vocabulary: navigation, generic actions, reading levels, relative
 * time, and the known server-error phrases the client maps to the UI language.
 *
 * Terminology glossary (keep every namespace consistent with these):
 *   desk 研究台 · watchlist 自选列表 · signal 信号 · signal board 信号板 ·
 *   reading 读数 · brief 晨报 · dossier 业务档案 · evidence 证据 ·
 *   focus area 关注领域 · proposal 提案 · approve 批准 · dismiss 忽略 ·
 *   retire 停用 · reactivate 重新启用 · archive 归档 · moat 护城河 ·
 *   run research 运行研究 · portfolio 投资组合 · position 持仓 ·
 *   confidence 置信度 · carry-forward 延续 · analyst 分析师 · scout 侦察员
 */

const en = {
  appName: "Scalae",
  backToWatchlist: "‹ Watchlist",
  loading: "Loading…",
  save: "Save",
  saving: "Saving…",
  saved: "Saved",
  cancel: "Cancel",
  close: "Close",
  undo: "Undo",
  retry: "Retry",
  dismiss: "Dismiss",
  expand: "Expand",
  collapse: "Collapse",
  show: "show",
  hide: "hide",
  edit: "Edit",
  remove: "Remove",
  working: "Working…",
  on: "on",
  off: "off",
  never: "never",
  justNow: "just now",
  minutesAgo: "{n}m ago",
  hoursAgo: "{n}h ago",
  daysAgo: "{n}d ago",
  updatedAgo: "updated {when}",
  settings: "Settings",
  profile: "Profile",
  signOut: "Sign out",
  signIn: "Sign in",
  showPassword: "Show password",
  hidePassword: "Hide password",
  notAdvice: "Educational research tool — not investment advice.",

  // Reading levels (signal health vocabulary, shared everywhere)
  level_strong: "Strong",
  level_improving: "Improving",
  level_neutral: "Neutral",
  level_deteriorating: "Deteriorating",
  level_weak: "Weak",
  level_unclear: "Unclear",

  // Signal lifecycle states
  status_active: "active",
  status_suggested: "proposed",
  status_retired: "retired",
  status_dismissed: "dismissed",

  // Impact of a digest item
  impact_positive: "positive",
  impact_negative: "negative",
  impact_mixed: "mixed",
  impact_neutral: "neutral",

  // Known server error phrases (exact or pattern-matched client-side —
  // see localizeError in components/util.ts)
  errSymbolNotFound: "Could not find “{sym}” on the public market.",
  errApproveFirst: "Approve at least one signal before running research.",
  errOverloaded: "Anthropic's API is briefly overloaded. Your message was saved — hit retry in a moment.",
  errRateLimited: "Anthropic rate limit hit. Wait a few seconds and retry.",
  errConnectionDropped: "Connection to Anthropic dropped mid-response. Your message was saved — hit retry.",
  errSignIn: "Sign in to continue.",
  errRequestFailed: "Request failed ({code})",
  errComparisonFailed: "The comparison failed — try again.",
  errHistoryFailed: "History research failed — try again.",
  errRunInterrupted: "Run interrupted (server restarted mid-run). Start it again.",
  errAnalystTimeout: "The analyst took too long and was stopped — try again.",
  errChatFailed: "Chat failed",
  errRunFailed: "Failed to start run",
  errPickCategory: "Pick a category for the request.",
  errNeedSubject: "Give the request a short subject.",
  errNeedDescription: "Describe the issue or idea.",
  errTooManyTickets: "You've filed quite a few requests today — please add to an existing thread instead.",
} as const;

const zh: Record<keyof typeof en, string> = {
  appName: "Scalae",
  backToWatchlist: "‹ 自选列表",
  loading: "加载中…",
  save: "保存",
  saving: "保存中…",
  saved: "已保存",
  cancel: "取消",
  close: "关闭",
  undo: "撤销",
  retry: "重试",
  dismiss: "关闭",
  expand: "展开",
  collapse: "收起",
  show: "显示",
  hide: "隐藏",
  edit: "编辑",
  remove: "移除",
  working: "处理中…",
  on: "开",
  off: "关",
  never: "从未",
  justNow: "刚刚",
  minutesAgo: "{n} 分钟前",
  hoursAgo: "{n} 小时前",
  daysAgo: "{n} 天前",
  updatedAgo: "更新于 {when}",
  settings: "设置",
  profile: "个人资料",
  signOut: "退出登录",
  signIn: "登录",
  showPassword: "显示密码",
  hidePassword: "隐藏密码",
  notAdvice: "教育性研究工具——不构成投资建议。",

  level_strong: "强劲",
  level_improving: "改善中",
  level_neutral: "中性",
  level_deteriorating: "恶化中",
  level_weak: "疲弱",
  level_unclear: "不明朗",

  status_active: "已启用",
  status_suggested: "待批准",
  status_retired: "已停用",
  status_dismissed: "已忽略",

  impact_positive: "利好",
  impact_negative: "利空",
  impact_mixed: "喜忧参半",
  impact_neutral: "中性",

  errSymbolNotFound: "在公开市场上找不到“{sym}”。",
  errApproveFirst: "请先批准至少一个信号，再运行研究。",
  errOverloaded: "Anthropic API 暂时过载。您的消息已保存——请稍后点击重试。",
  errRateLimited: "已触发 Anthropic 速率限制。请等几秒后重试。",
  errConnectionDropped: "与 Anthropic 的连接在响应中途断开。您的消息已保存——请点击重试。",
  errSignIn: "请登录后继续。",
  errRequestFailed: "请求失败（{code}）",
  errComparisonFailed: "比较失败——请重试。",
  errHistoryFailed: "历史研究失败——请重试。",
  errRunInterrupted: "研究运行被中断（服务器在运行中重启）。请重新启动。",
  errAnalystTimeout: "分析师响应超时，已中止——请重试。",
  errChatFailed: "对话失败",
  errRunFailed: "启动研究失败",
  errPickCategory: "请为该请求选择一个类别。",
  errNeedSubject: "请为该请求填写一个简短的主题。",
  errNeedDescription: "请描述您遇到的问题或建议。",
  errTooManyTickets: "您今天提交的请求较多——请在现有会话中补充说明。",
};

export const common = { en, zh };
