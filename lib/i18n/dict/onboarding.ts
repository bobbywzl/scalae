/** First-run onboarding: /welcome guided intake chat + /signin front door. */

const en = {
  // Intake chat — scripted assistant lines
  introFull:
    "Welcome to Scalae — your daily intelligence desk for the businesses you own or watch. Let's set up your desk in under a minute.",
  introShort: "Welcome to Scalae. Let's set up your desk in under a minute.",
  askName: "First things first: what should I call you?",
  askAge:
    "Good to meet you, {name}. How old are you? (This stays private — it helps calibrate horizon, nothing else.)",
  askCountry: "Where do you invest from? Markets and tax treatment differ by home base.",
  askIndustries: "Which industries do you want on your radar? Pick a few — they seed my suggestions.",
  askCompanies:
    "Any specific companies you already follow? Search and add them — or continue and I'll suggest from your industries.",
  confirmSome:
    "Here's what I'd open first. Each desk researches the business daily — start with up to {n} and add more anytime.",
  confirmNone:
    "No desks picked yet — search above or go straight to the dashboard and add tickers there anytime.",
  creatingDesks:
    "Opening your desks — each will greet you with an onboarding chat to sharpen what we watch…",
  creatingDashboard: "Setting up your dashboard…",
  couldntResolve: "Couldn't resolve: {syms} — add them from the dashboard later.",
  genericErr: "Something went wrong — try again.",

  // Intake chat — user-side echoes
  sayPreferNot: "I'd rather not say",
  saySkip: "Skip",
  sayNoPreference: "No strong preference",
  saySuggest: "Suggest for me",
  sayOpenDesks: "Open {n} desk: {syms}",
  sayOpenDesksMany: "Open {n} desks: {syms}",
  sayGoDashboard: "Take me to the dashboard",

  // Header / progress
  phaseYou: "About you",
  phaseInterests: "Interests",
  phaseDesks: "Your desks",
  setupProgress: "Setup progress",
  skipSetup: "Skip setup →",

  // Desk confirmation card
  firstDesksTitle: "Your first desks",
  capNote: "Up to {n} to start — token spend scales per desk. You can add more later.",

  // Composer
  namePh: "Your name",
  agePh: "Age",
  countryPh: "Country",
  searchPh: "Search a company or ticker — Costco, TSMC, 7203.T…",
  continueBtn: "Continue",
  preferNotBtn: "Prefer not to say",
  skipBtn: "Skip",
  continueWithSelected: "Continue with {n} selected",
  noPreferenceContinue: "No preference — continue",
  continueWithCompanies: "Continue with {n} company",
  continueWithCompaniesMany: "Continue with {n} companies",
  suggestFromIndustries: "Suggest from my industries",
  openNDesks: "Open {n} desk →",
  openNDesksMany: "Open {n} desks →",
  goDashboard: "Go to my dashboard →",
  settingUpDesks: "Setting up your desks…",
  profilePrivate: "Your profile stays in your account.",

  // Industry picker
  indSemis: "Semiconductors",
  indSoftware: "Software & internet",
  indConsumer: "Consumer & retail",
  indBanks: "Banks & payments",
  indEnergy: "Energy",
  indHealthcare: "Healthcare",
  indIndustrials: "Industrials",
  indAutos: "Autos & mobility",
  indLuxury: "Luxury & brands",
  indRealEstate: "Real estate",

  // Country suggestions (free-text input; datalist only)
  countryUS: "United States",
  countryCanada: "Canada",
  countryUK: "United Kingdom",
  countryGermany: "Germany",
  countryFrance: "France",
  countryNetherlands: "Netherlands",
  countrySwitzerland: "Switzerland",
  countrySweden: "Sweden",
  countrySpain: "Spain",
  countryItaly: "Italy",
  countryJapan: "Japan",
  countryChina: "China",
  countryHongKong: "Hong Kong",
  countryTaiwan: "Taiwan",
  countrySouthKorea: "South Korea",
  countrySingapore: "Singapore",
  countryIndia: "India",
  countryAustralia: "Australia",
  countryNZ: "New Zealand",
  countryBrazil: "Brazil",
  countryMexico: "Mexico",
  countryUAE: "United Arab Emirates",
  countrySouthAfrica: "South Africa",

  // Sign-in page
  signinTagline:
    "A daily AI intelligence desk for value investors — signal boards, deep research runs, and a paper brokerage, weighed against the business every day.",
  signinGoogle: "Continue with Google",
  signinSingleUserTitle: "Running in single-user mode.",
  signinSingleUserDesc:
    "Google sign-in isn’t configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET to turn this into a multi-user app.",
  signinLocalContinue: "Continue to your desk →",
  signinPrivacy: "Your desks, notes and paper trades are private to your account.",
  signinErrNoCode: "Google returned no code",
  signinErrState: "Sign-in state mismatch — try again",
  signinErrVerify: "Could not verify your Google identity",
} as const;

const zh: Record<keyof typeof en, string> = {
  introFull:
    "欢迎来到 Scalae——为您持有或关注的企业打造的每日情报研究台。让我们用不到一分钟设置您的研究台。",
  introShort: "欢迎来到 Scalae。让我们用不到一分钟设置您的研究台。",
  askName: "先从称呼开始：我应该怎么称呼您？",
  askAge: "很高兴认识您，{name}。请问您多大年纪？（此信息完全保密——仅用于校准投资期限，别无他用。）",
  askCountry: "您在哪个国家/地区投资？不同所在地的市场与税务处理各不相同。",
  askIndustries: "您想把哪些行业纳入视野？选几个——它们会作为我推荐的起点。",
  askCompanies: "有已经在关注的具体公司吗？搜索并添加——或直接继续，我会根据您选的行业来推荐。",
  confirmSome:
    "这是我建议先开设的研究台。每个研究台每天研究对应的企业——先从最多 {n} 个开始，之后可随时添加。",
  confirmNone: "还没有选择研究台——可在上方搜索，或直接前往主页，随时在那里添加股票代码。",
  creatingDesks: "正在开设您的研究台——每个研究台都会以引导对话迎接您，帮我们明确要跟踪什么…",
  creatingDashboard: "正在设置您的主页…",
  couldntResolve: "无法识别：{syms}——稍后可在主页添加。",
  genericErr: "出了点问题——请重试。",

  sayPreferNot: "不方便透露",
  saySkip: "跳过",
  sayNoPreference: "没有特别偏好",
  saySuggest: "请为我推荐",
  sayOpenDesks: "开设 {n} 个研究台：{syms}",
  sayOpenDesksMany: "开设 {n} 个研究台：{syms}",
  sayGoDashboard: "带我去主页",

  phaseYou: "关于您",
  phaseInterests: "兴趣领域",
  phaseDesks: "您的研究台",
  setupProgress: "设置进度",
  skipSetup: "跳过设置 →",

  firstDesksTitle: "您的首批研究台",
  capNote: "起步最多 {n} 个——token 消耗随研究台数量增加。之后可以再添加。",

  namePh: "您的称呼",
  agePh: "年龄",
  countryPh: "国家/地区",
  searchPh: "搜索公司或股票代码——Costco、TSMC、7203.T…",
  continueBtn: "继续",
  preferNotBtn: "不便透露",
  skipBtn: "跳过",
  continueWithSelected: "已选 {n} 个行业——继续",
  noPreferenceContinue: "没有偏好——继续",
  continueWithCompanies: "已选 {n} 家公司——继续",
  continueWithCompaniesMany: "已选 {n} 家公司——继续",
  suggestFromIndustries: "根据我选的行业推荐",
  openNDesks: "开设 {n} 个研究台 →",
  openNDesksMany: "开设 {n} 个研究台 →",
  goDashboard: "前往我的主页 →",
  settingUpDesks: "正在设置您的研究台…",
  profilePrivate: "您的资料仅保存在您的账户中。",

  indSemis: "半导体",
  indSoftware: "软件与互联网",
  indConsumer: "消费与零售",
  indBanks: "银行与支付",
  indEnergy: "能源",
  indHealthcare: "医疗健康",
  indIndustrials: "工业",
  indAutos: "汽车与出行",
  indLuxury: "奢侈品与品牌",
  indRealEstate: "房地产",

  countryUS: "美国",
  countryCanada: "加拿大",
  countryUK: "英国",
  countryGermany: "德国",
  countryFrance: "法国",
  countryNetherlands: "荷兰",
  countrySwitzerland: "瑞士",
  countrySweden: "瑞典",
  countrySpain: "西班牙",
  countryItaly: "意大利",
  countryJapan: "日本",
  countryChina: "中国",
  countryHongKong: "香港",
  countryTaiwan: "台湾",
  countrySouthKorea: "韩国",
  countrySingapore: "新加坡",
  countryIndia: "印度",
  countryAustralia: "澳大利亚",
  countryNZ: "新西兰",
  countryBrazil: "巴西",
  countryMexico: "墨西哥",
  countryUAE: "阿拉伯联合酋长国",
  countrySouthAfrica: "南非",

  signinTagline:
    "为价值投资者打造的每日 AI 情报研究台——信号板、深度研究运行与模拟券商，每天对照企业本身进行称量。",
  signinGoogle: "使用 Google 继续",
  signinSingleUserTitle: "正在以单用户模式运行。",
  signinSingleUserDesc:
    "Google 登录尚未配置——设置 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET 和 SESSION_SECRET 即可将其变成多用户应用。",
  signinLocalContinue: "继续前往您的研究台 →",
  signinPrivacy: "您的研究台、笔记与模拟交易仅您的账户可见。",
  signinErrNoCode: "Google 未返回授权码",
  signinErrState: "登录状态校验不匹配——请重试",
  signinErrVerify: "无法验证您的 Google 身份",
};

export const onboarding = { en, zh };
