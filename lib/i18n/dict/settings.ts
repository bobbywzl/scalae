/** Settings page (preferences) and Profile page (account + investor profile). */

const en = {
  // Settings
  title: "Settings",
  subtitle: "Language, appearance and research preferences.",
  sectionLanguage: "Language",
  languageDesc:
    "Applies everywhere: the interface, the analyst's conversations, and research content (briefs, signals, evidence). Existing research is translated on display; chat history stays in the language it was written.",
  sectionAppearance: "Appearance",
  themeDark: "Dark",
  themeLight: "Light",
  themeSystem: "System",
  appearanceDesc: "Dark is the desk's native look; System follows your device.",
  sectionResearch: "Research",
  sectionSupport: "Support",
  helpFeedback: "Help & feedback",
  supportDesc:
    "Report a bug, request a feature or ask a question — with screenshots attached. You get a request ID, and responses land in your email.",
  profileCardTitle: "Profile & account",
  profileCardDesc: "Your personal information, investor profile and account actions.",
  openProfile: "Open profile →",

  // Profile
  profileTitle: "Profile",
  profileSubtitle: "Your account and investor profile.",
  sectionAccount: "Account",
  memberSince: "Member since {date} · signed in with Google",
  adminBadge: "admin",
  singleUserTitle: "Running in single-user mode.",
  singleUserDesc:
    "Everything on this deployment belongs to one local account. To turn Scalae into a multi-user app with Google sign-in, set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET — the README walks through it.",
  signOutDesc:
    "Your desks, signals, chat history and paper trades stay in your account — signing back in with the same Google address picks up where you left off.",
  sectionInvestor: "Investor profile",
  investorDesc:
    "Captured at onboarding; the analyst reads it for context. Edit anytime — leave a field blank to clear it.",
  fieldName: "Name",
  fieldAge: "Age",
  fieldCountry: "Country",
  fieldIndustries: "Industries of interest",
  industriesHint: "Comma-separated, e.g. semiconductors, luxury, banks",
  notSet: "Not set",
  profileSaved: "Profile saved.",
  profileSaveFailed: "Could not save — try again.",
  openSettings: "Settings",
} as const;

const zh: Record<keyof typeof en, string> = {
  title: "设置",
  subtitle: "语言、外观与研究偏好。",
  sectionLanguage: "语言",
  languageDesc:
    "适用于整个应用：界面、分析师对话及研究内容（晨报、信号、证据）。已有研究内容会在显示时自动翻译；对话历史保留其原始语言。",
  sectionAppearance: "外观",
  themeDark: "深色",
  themeLight: "浅色",
  themeSystem: "跟随系统",
  appearanceDesc: "深色是研究台的原生外观；跟随系统则随设备自动切换。",
  sectionResearch: "研究",
  sectionSupport: "支持",
  helpFeedback: "帮助与反馈",
  supportDesc:
    "报告问题、提出功能建议或咨询——可附截图。您会获得一个请求编号，回复将发送到您的邮箱。",
  profileCardTitle: "个人资料与账户",
  profileCardDesc: "您的个人信息、投资者资料与账户操作。",
  openProfile: "打开个人资料 →",

  profileTitle: "个人资料",
  profileSubtitle: "您的账户与投资者资料。",
  sectionAccount: "账户",
  memberSince: "注册于 {date} · 通过 Google 登录",
  adminBadge: "管理员",
  singleUserTitle: "正在以单用户模式运行。",
  singleUserDesc:
    "此部署上的所有数据都属于一个本地账户。要将 Scalae 变成支持 Google 登录的多用户应用，请设置 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 和 SESSION_SECRET——README 有完整说明。",
  signOutDesc:
    "您的研究台、信号、对话记录和模拟交易都会保留在账户中——用同一 Google 邮箱重新登录即可继续。",
  sectionInvestor: "投资者资料",
  investorDesc: "在首次引导时录入；分析师会将其作为背景参考。可随时编辑——留空即清除该项。",
  fieldName: "姓名",
  fieldAge: "年龄",
  fieldCountry: "国家/地区",
  fieldIndustries: "感兴趣的行业",
  industriesHint: "用逗号分隔，例如：半导体、奢侈品、银行",
  notSet: "未填写",
  profileSaved: "资料已保存。",
  profileSaveFailed: "保存失败——请重试。",
  openSettings: "设置",
};

export const settings = { en, zh };
