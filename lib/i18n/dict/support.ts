/** Help & feedback page — request form, ticket list, threads, attachments. */

const en = {
  title: "Help & feedback",
  subtitle: "Report a bug, request a feature, or ask a question — attach screenshots as evidence.",

  // Categories
  catBug: "Bug report",
  catBugHint: "Something is broken or wrong",
  catIdea: "Feature idea",
  catIdeaHint: "Something Scalae should do",
  catQuestion: "Question",
  catQuestionHint: "How does something work?",
  catAccount: "Account",
  catAccountHint: "Sign-in, data or billing",
  catOther: "Other",
  catOtherHint: "Anything else",

  // Status chips
  statusOpen: "Open",
  statusResponded: "Response ready",
  statusClosed: "Closed",

  // New request form
  newRequest: "New request",
  filedOk: "Request filed",
  reqIdIs: "Your request ID is",
  reqIdKeep: "— keep it for reference.",
  emailNotice: "We'll email {email} when there's a response; the full thread lives on this page.",
  responsesHere: "Responses appear on this page, under Your requests.",
  fileAnother: "File another request",
  pickCategory: "Pick a category.",
  subjectPh: "Subject — one line, e.g. “Order ticket rejects limit price”",
  bodyPh: "What happened, what you expected, and any steps to reproduce…",
  filing: "Filing…",
  submitRequest: "Submit request",
  fileFailed: "Could not file the request.",

  // Ticket list & thread
  yourRequests: "Your requests",
  nothingFiled: "Nothing filed yet — your requests and our responses will appear here.",
  loadingThread: "Loading thread…",
  threadLoadFailed: "Could not load the thread — try again.",
  supportTeam: "Scalae team",
  you: "You",
  replyPh: "Reply to this thread…",
  closeTitle: "Mark this request resolved",
  closeRequest: "Close request",
  sending: "Sending…",
  sendReply: "Send reply",
  replyFailed: "Could not send the reply.",
  closedNote: "This request is closed. Replying isn’t possible — reopen it first.",
  reopen: "Reopen",
  footerNote:
    "Keep your request ID handy when following up. Evidence stays private to your account and the app administrators.",

  // Attachments
  attachEvidence: "Attach evidence",
  attachTitle: "Attach screenshots, PDFs or text files as evidence",
  removeFile: "Remove {name}",
  maxFilesErr: "At most {n} files per message.",
  readFileFailed: "Could not read that file.",
  errCouldNotReadFile: "Could not read {name}",
  errPdfTooBig: "{name} is {size} — PDFs up to {max} only.",
  errTextTooBig: "{name} is {size} — text files up to {max} only.",
  errNotImage: "Not a readable image",
} as const;

const zh: Record<keyof typeof en, string> = {
  title: "帮助与反馈",
  subtitle: "报告故障、提出功能建议或咨询问题——可附截图作为证据。",

  catBug: "故障报告",
  catBugHint: "有功能损坏或表现异常",
  catIdea: "功能建议",
  catIdeaHint: "希望 Scalae 增加的能力",
  catQuestion: "咨询",
  catQuestionHint: "想了解某项功能如何使用？",
  catAccount: "账户",
  catAccountHint: "登录、数据或账单问题",
  catOther: "其他",
  catOtherHint: "其他任何事项",

  statusOpen: "处理中",
  statusResponded: "已回复",
  statusClosed: "已关闭",

  newRequest: "新请求",
  filedOk: "请求已提交",
  reqIdIs: "您的请求编号是",
  reqIdKeep: "——请妥善保存以便日后查询。",
  emailNotice: "有回复时我们会发送邮件至 {email}；完整对话记录保留在本页面。",
  responsesHere: "回复会显示在本页面的“您的请求”下方。",
  fileAnother: "提交新的请求",
  pickCategory: "请选择一个类别。",
  subjectPh: "主题——一句话概括，例如“下单面板拒绝限价单”",
  bodyPh: "发生了什么、您期望的结果，以及复现步骤…",
  filing: "提交中…",
  submitRequest: "提交请求",
  fileFailed: "无法提交请求。",

  yourRequests: "您的请求",
  nothingFiled: "还没有提交过请求——您的请求与我们的回复会显示在这里。",
  loadingThread: "正在加载对话…",
  threadLoadFailed: "无法加载对话——请重试。",
  supportTeam: "Scalae 团队",
  you: "您",
  replyPh: "回复此对话…",
  closeTitle: "将此请求标记为已解决",
  closeRequest: "关闭请求",
  sending: "发送中…",
  sendReply: "发送回复",
  replyFailed: "无法发送回复。",
  closedNote: "此请求已关闭。无法直接回复——请先重新打开。",
  reopen: "重新打开",
  footerNote: "跟进时请提供您的请求编号。证据材料仅您的账户与应用管理员可见。",

  attachEvidence: "附加证据",
  attachTitle: "附加截图、PDF 或文本文件作为证据",
  removeFile: "移除 {name}",
  maxFilesErr: "每条消息最多附 {n} 个文件。",
  readFileFailed: "无法读取该文件。",
  errCouldNotReadFile: "无法读取 {name}",
  errPdfTooBig: "{name} 大小为 {size}——PDF 最大仅支持 {max}。",
  errTextTooBig: "{name} 大小为 {size}——文本文件最大仅支持 {max}。",
  errNotImage: "无法读取的图片",
};

export const support = { en, zh };
