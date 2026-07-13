/**
 * chat namespace — ChatPanel (analyst desk thread) and Markdown chrome.
 * Message content itself is not translated here: the analyst already replies
 * in the user's language; these are only the surrounding UI strings.
 */

const en = {
  title: "Analyst desk",
  headerHint: "your feedback steers tomorrow’s research",
  exitFullTitle: "Exit full screen (Esc)",
  exitFull: "Exit full screen",
  enterFull: "Full-screen desk",
  exit: "Exit",
  thinking: "Analyst is thinking…",
  strandedNote: "The analyst hasn’t replied to your last message.",
  askToRespond: "Ask the analyst to respond",
  send: "Send",
  placeholder: "Tell your analyst what to focus on…",
  placeholderListening: "Listening — speak now…",
  attachTitle: "Attach files or images",
  dictate: "Dictate with your voice",
  dictateStop: "Stop dictation",
  readAloud: "Read aloud",
  stopReading: "Stop reading",
  read: "read",
  stop: "stop",
  openSignal: "Open this signal",
  activeOpen: "✓ active — open ⤢",
  preparingFiles: "Preparing files…",
  maxFiles: "At most {n} files per message.",
  fileReadFailed: "Couldn't read that file.",
  micBlocked: "Microphone access was blocked.",
  removeAttachment: "Remove {name}",

  // Client-side attachment errors (canonical English thrown by attach.ts,
  // pattern-matched back to these keys in ChatPanel).
  pdfTooLarge: "{name} is {size} — PDFs up to {max} only.",
  textTooLarge: "{name} is {size} — text files up to {max} only.",
  fileUnreadable: "Could not read {name}",
  notReadableImage: "Not a readable image",

  // Lens chips — starter questions shown while the thread is empty.
  lensMoat: "Moat durability",
  lensCandor: "Management candor",
  lensCapital: "Capital allocation",
  lensOwnerEarnings: "Owner earnings",
  lensCulture: "Culture & trust",
  lensRedFlags: "Red flags",
  lensSuggest: "Not sure — suggest questions",
} as const;

const zh: Record<keyof typeof en, string> = {
  title: "分析师研究台",
  headerHint: "您的反馈将引导明日的研究",
  exitFullTitle: "退出全屏（Esc）",
  exitFull: "退出全屏",
  enterFull: "全屏研究台",
  exit: "退出",
  thinking: "分析师思考中…",
  strandedNote: "分析师尚未回复您的上一条消息。",
  askToRespond: "请分析师回复",
  send: "发送",
  placeholder: "告诉您的分析师应重点关注什么…",
  placeholderListening: "正在聆听——请说话…",
  attachTitle: "附加文件或图片",
  dictate: "语音输入",
  dictateStop: "停止语音输入",
  readAloud: "朗读",
  stopReading: "停止朗读",
  read: "朗读",
  stop: "停止",
  openSignal: "打开此信号",
  activeOpen: "✓ 已启用——打开 ⤢",
  preparingFiles: "正在准备文件…",
  maxFiles: "每条消息最多 {n} 个文件。",
  fileReadFailed: "无法读取该文件。",
  micBlocked: "麦克风访问被拒绝。",
  removeAttachment: "移除 {name}",

  pdfTooLarge: "{name} 大小为 {size}——仅支持不超过 {max} 的 PDF。",
  textTooLarge: "{name} 大小为 {size}——仅支持不超过 {max} 的文本文件。",
  fileUnreadable: "无法读取 {name}",
  notReadableImage: "无法识别的图片",

  lensMoat: "护城河持久性",
  lensCandor: "管理层坦诚度",
  lensCapital: "资本配置",
  lensOwnerEarnings: "所有者盈余",
  lensCulture: "企业文化与信任",
  lensRedFlags: "风险警示",
  lensSuggest: "不确定——请建议一些问题",
};

export const chat = { en, zh };
