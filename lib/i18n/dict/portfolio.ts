/**
 * Portfolio page (app/portfolio/page.tsx) + PnlChart. Glossary: portfolio
 * 投资组合 · position 持仓 · share 股 · contract 张 · option 期权 · call
 * 看涨期权 · put 看跌期权 · premium 权利金 · order 订单 · working order
 * 未成交订单 · filled 已成交 · canceled 已撤销 · expired 已过期 · ledger
 * 交易账本 · DRIP 股息再投资 · withholding 预扣税 · ex-date 除息日.
 */

const en = {
  title: "Portfolio",
  subtitle: "Positions, options and P&L.",
  // summary.currencyNote is composed server-side (lib/portfolio.ts); the two
  // possible shapes are mapped by exact/pattern match at render.
  currencyNoteAllUsd: "All amounts USD.",
  currencyNoteConverted: "Totals in USD ({codes} converted); positions shown in native currency.",
  resetBook: "Reset book",
  resetBookTitle: "Clear the whole book (trades, orders, dividends)",
  addTrade: "+ Trade",
  loadFailed: "Failed to load portfolio",
  saveCapitalFailed: "Failed to save capital",
  resetFailed: "Failed to reset the book",

  resetConfirmTitle: "Reset the whole book?",
  resetConfirmBody:
    "This permanently deletes {trades}, {orders} and {divs}. Your initial capital and DRIP settings are kept. This cannot be undone.",
  nTradesOne: "{n} trade",
  nTradesMany: "{n} trades",
  nOrdersOne: "{n} order",
  nOrdersMany: "{n} orders",
  nReceiptsOne: "{n} dividend receipt",
  nReceiptsMany: "{n} dividend receipts",
  deleting: "Deleting…",
  deleteEverything: "Delete everything",

  capitalLabel: "Initial capital · USD",
  capitalDesc:
    "The cash you started this book with. Cash on hand = this + every buy/sell/fee/dividend since. Leave empty to stop tracking cash.",

  loadingPortfolio: "Loading portfolio…",
  emptyTitle: "No trades yet",
  emptyBody:
    "Place orders (market, limit, stop…) or record past fills — stocks and options — to see live P&L, cost basis, dividends, and your involvement on each ticker’s desk.",
  emptyCta: "Place your first trade",
  startingCapital: "Starting capital",
  setStartingCapital: "Set starting capital",

  // Summary tiles
  cash: "Cash",
  editCapital: "✎ edit",
  editCapitalTitle: "Edit initial capital",
  ofInitial: "of {amt} initial",
  setInitialCapital: "+ Set initial capital",
  unlocksTracking: "unlocks cash & return tracking",
  marketValue: "Market value",
  costSub: "cost {amt}",
  totalPnl: "Total P&L",
  todayAmt: "{amt} today",
  onCapital: "{pct}% on capital",
  unrealized: "Unrealized",
  realized: "Realized",
  dividends: "Dividends",
  cashPlusReinvested: "cash + reinvested",

  // Detected dividends awaiting confirmation
  divsDetectedOne: "{n} dividend detected",
  divsDetectedMany: "{n} dividends detected",
  pendingDivHint: "paid on shares you held before the ex-date — apply to add them to your book",
  applyAll: "Apply all",
  applying: "Applying…",
  apply: "Apply",
  shAbbr: "sh",
  dripPreview: "DRIP: +{n} sh @ {price}",
  atMarket: "market",
  shortOwed: "short — dividend owed",
  cashWord: "cash",
  whAbbr: "w/h",
  whTitle: "Tax withheld at source — the credited amount is net of it",

  // P&L chart
  pnlOverTime: "P&L over time",
  usdUnit: "(USD)",
  optionsMarkNote:
    "Options are marked at live contract quotes where available (intrinsic value otherwise, and for history).",
  unpricedNote: "No market data for: {syms} — excluded from the curve.",
  chartEmpty:
    "The P&L curve appears after your first recorded trade (daily closes are reconstructed from the first trade date).",
  chartValue: "value {amt}",
  chartAria: "Portfolio profit and loss over time, currently {pnl}",
  range1M: "1M",
  range3M: "3M",
  range6M: "6M",
  range1Y: "1Y",
  rangeALL: "ALL",

  // Working orders
  openOrders: "Open orders",
  openOrdersSub: "— simulated fills at live prices, checked on refresh",
  placedOn: "placed {date}",
  cancelOrder: "Cancel",
  otMarket: "Market",
  otLimit: "Limit",
  otStop: "Stop",
  otStopLimit: "Stop-limit",
  tifDay: "DAY",
  tifGtc: "GTC",
  sideBuy: "buy",
  sideSell: "sell",

  // Stock positions
  stocks: "Stocks",
  noStocks: "No open stock positions.",
  shortTag: "SHORT",
  dripOnChip: "DRIP on",
  dripOffChip: "DRIP off",
  dripOnTitle: "Dividend reinvestment ON — dividends buy more shares when applied",
  dripOffTitle: "Dividend reinvestment OFF — dividends credit as cash when applied",
  qtyAvg: "{qty} sh @ {price} avg",
  pctOfBook: "{pct}% of book",
  pctOfBookTitle: "Share of the book's total market value",
  noCost: "⚠ no cost recorded",
  noCostTitle:
    "This position was recorded at price 0, so its P&L is overstated — delete the trade in Trade history and re-record it with the real fill price.",
  realizedAmt: "realized {amt}",
  sellMore: "Sell more",
  sell: "Sell",
  buyToCover: "Buy to cover",
  buyMore: "Buy more",
  recordPastTrade: "Record past trade",
  openDesk: "Open desk →",

  // Option positions
  options: "Options",
  noOptions: "No open option positions.",
  expiredTag: "EXPIRED",
  contractsAtOne: "{n} contract @ {price} premium",
  contractsAtMany: "{n} contracts @ {price} premium",
  dteShort: "{n}d to expiry",
  intrinsicMark: "intrinsic mark",
  expiredNote:
    "Expired positions are marked worthless — record a closing trade (or exercise) to realize them.",
  optionCall: "CALL",
  optionPut: "PUT",

  // Order history
  orderHistory: "Order history ({n})",
  filledAtPrice: "— filled @ {price}",
  status_open: "open",
  status_filled: "filled",
  status_canceled: "canceled",
  status_expired: "expired",

  // Dividend receipts
  dividendReceipts: "Dividend receipts ({n})",
  netOfWh: "net of {pct}% w/h",
  netOfWhTitle: "Credited net of tax withheld at source",
  dripReinvested: "DRIP — reinvested",
  nonUsdNote:
    "Non-USD receipts are shown in their native currency and converted at the live rate in the USD totals above.",

  // Trade history
  tradeHistory: "Trade history ({n})",
  feesNote: "(+{fees} fees)",
  deleteTradeTitle: "Delete trade",
  deleteTradeConfirm: "Delete this trade? {side} {qty} {sym} @ {price}",

  footerLedger: "Manual ledger, average-cost method.",
} as const;

const zh: Record<keyof typeof en, string> = {
  title: "投资组合",
  subtitle: "持仓、期权与盈亏。",
  currencyNoteAllUsd: "所有金额均为美元。",
  currencyNoteConverted: "总计以美元计（{codes} 已折算）；持仓以原币种显示。",
  resetBook: "清空账本",
  resetBookTitle: "清空整个账本（交易、订单、股息）",
  addTrade: "+ 交易",
  loadFailed: "加载投资组合失败",
  saveCapitalFailed: "保存初始资金失败",
  resetFailed: "清空账本失败",

  resetConfirmTitle: "确定清空整个账本？",
  resetConfirmBody:
    "此操作将永久删除 {trades}、{orders} 和 {divs}。您的初始资金与股息再投资设置将保留。此操作无法撤销。",
  nTradesOne: "{n} 笔交易",
  nTradesMany: "{n} 笔交易",
  nOrdersOne: "{n} 笔订单",
  nOrdersMany: "{n} 笔订单",
  nReceiptsOne: "{n} 条股息入账记录",
  nReceiptsMany: "{n} 条股息入账记录",
  deleting: "删除中…",
  deleteEverything: "删除全部",

  capitalLabel: "初始资金 · USD",
  capitalDesc:
    "您开设此账本时投入的现金。当前现金 = 初始资金 + 此后每笔买入/卖出/手续费/股息。留空则停止追踪现金。",

  loadingPortfolio: "正在加载投资组合…",
  emptyTitle: "还没有交易",
  emptyBody:
    "下达订单（市价单、限价单、止损单……）或录入过往成交——股票与期权——即可查看实时盈亏、成本基础、股息，以及您在各股票研究台的持仓情况。",
  emptyCta: "下您的第一笔交易",
  startingCapital: "初始资金",
  setStartingCapital: "设置初始资金",

  cash: "现金",
  editCapital: "✎ 编辑",
  editCapitalTitle: "编辑初始资金",
  ofInitial: "初始资金 {amt}",
  setInitialCapital: "+ 设置初始资金",
  unlocksTracking: "开启现金与回报追踪",
  marketValue: "市值",
  costSub: "成本 {amt}",
  totalPnl: "总盈亏",
  todayAmt: "今日 {amt}",
  onCapital: "较初始资金 {pct}%",
  unrealized: "未实现盈亏",
  realized: "已实现盈亏",
  dividends: "股息",
  cashPlusReinvested: "现金 + 已再投资",

  divsDetectedOne: "检测到 {n} 笔股息",
  divsDetectedMany: "检测到 {n} 笔股息",
  pendingDivHint: "派发给您在除息日前持有的股份——应用后即计入账本",
  applyAll: "全部应用",
  applying: "应用中…",
  apply: "应用",
  shAbbr: "股",
  dripPreview: "股息再投资：+{n} 股 @ {price}",
  atMarket: "市价",
  shortOwed: "空头——需支付股息",
  cashWord: "现金",
  whAbbr: "预扣",
  whTitle: "源头预扣税——入账金额为税后净额",

  pnlOverTime: "盈亏走势",
  usdUnit: "（USD）",
  optionsMarkNote: "期权尽可能按实时合约报价计价（否则按内在价值计价，历史数据亦然）。",
  unpricedNote: "无市场数据：{syms}——已从曲线中排除。",
  chartEmpty: "记录第一笔交易后即会显示盈亏曲线（每日收盘数据自首笔交易日起重建）。",
  chartValue: "市值 {amt}",
  chartAria: "投资组合盈亏走势，当前为 {pnl}",
  range1M: "1个月",
  range3M: "3个月",
  range6M: "6个月",
  range1Y: "1年",
  rangeALL: "全部",

  openOrders: "未成交订单",
  openOrdersSub: "——按实时价格模拟成交，刷新时核查",
  placedOn: "下单于 {date}",
  cancelOrder: "撤单",
  otMarket: "市价单",
  otLimit: "限价单",
  otStop: "止损单",
  otStopLimit: "止损限价单",
  tifDay: "当日有效",
  tifGtc: "撤销前有效",
  sideBuy: "买入",
  sideSell: "卖出",

  stocks: "股票持仓",
  noStocks: "暂无股票持仓。",
  shortTag: "空头",
  dripOnChip: "股息再投资 开",
  dripOffChip: "股息再投资 关",
  dripOnTitle: "股息再投资已开启——应用股息时将买入更多股份",
  dripOffTitle: "股息再投资已关闭——应用股息时将以现金入账",
  qtyAvg: "{qty} 股 @ 平均成本 {price}",
  pctOfBook: "权重 {pct}%",
  pctOfBookTitle: "占投资组合总市值的比例",
  noCost: "⚠ 未记录成本",
  noCostTitle:
    "该持仓以 0 价格录入，盈亏因此被高估——请在交易历史中删除该笔交易，并按真实成交价重新录入。",
  realizedAmt: "已实现 {amt}",
  sellMore: "继续卖出",
  sell: "卖出",
  buyToCover: "买入平仓",
  buyMore: "继续买入",
  recordPastTrade: "录入过往交易",
  openDesk: "打开研究台 →",

  options: "期权持仓",
  noOptions: "暂无期权持仓。",
  expiredTag: "已过期",
  contractsAtOne: "{n} 张 @ 权利金 {price}",
  contractsAtMany: "{n} 张 @ 权利金 {price}",
  dteShort: "{n} 天后到期",
  intrinsicMark: "按内在价值计价",
  expiredNote: "已过期持仓按零价值计——请录入平仓交易（或行权）以实现盈亏。",
  optionCall: "看涨期权",
  optionPut: "看跌期权",

  orderHistory: "订单历史（{n}）",
  filledAtPrice: "——成交价 {price}",
  status_open: "未成交",
  status_filled: "已成交",
  status_canceled: "已撤销",
  status_expired: "已过期",

  dividendReceipts: "股息入账记录（{n}）",
  netOfWh: "已扣 {pct}% 预扣税",
  netOfWhTitle: "入账金额已扣除源头预扣税",
  dripReinvested: "股息已再投资",
  nonUsdNote: "非美元入账以原币种显示，并按实时汇率折算计入上方美元总计。",

  tradeHistory: "交易历史（{n}）",
  feesNote: "（+{fees} 手续费）",
  deleteTradeTitle: "删除交易",
  deleteTradeConfirm: "删除这笔交易？{side} {qty} {sym} @ {price}",

  footerLedger: "手动交易账本，采用平均成本法。",
};

export const portfolio = { en, zh };
