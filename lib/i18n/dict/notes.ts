/**
 * Notes page — the investor's own thinking layer per ticker: sections (custom
 * or adopted from focus areas) holding rich-text notepads, plus the clip-to-
 * notes flow from the desk's evidence feed.
 */

const en = {
  title: "Notes",
  pageSubtitle: "Your own thinking on {name} — organized your way, read (never edited) by your analyst.",
  backToDesk: "‹ Back to desk",
  openNotes: "Notes",

  // Sections
  addSection: "Add section",
  sectionNamePlaceholder: "Section name — e.g. Business moat",
  fromFocusAreas: "Or adopt a focus area:",
  suggestedSections: "Ideas:",
  sugMoat: "Business moat",
  sugProspects: "Prospects & goals",
  sugBuybacks: "Buybacks & shareholder returns",
  sugCulture: "Culture & principles",
  sugIndustry: "Industry & competition",
  renameSection: "Rename",
  deleteSection: "Delete section",
  deleteSectionConfirm: "Delete “{title}” and its {n} notepad(s)? This cannot be undone.",
  emptySection: "No notepads yet.",
  noSections: "No sections yet. Start with one of your focus areas, a suggestion, or name your own.",

  // Notepads
  addNotepad: "+ Notepad",
  addNote: "+ Add a note",
  notepadTitlePlaceholder: "Notepad title…",
  deleteNotepad: "Delete notepad",
  deleteNotepadConfirm: "Delete “{title}”? This cannot be undone.",
  untitledNotepad: "Untitled",
  savedAgo: "saved {when}",
  saving: "saving…",
  unsaved: "unsaved changes",

  // Editor toolbar
  tbBold: "Bold",
  tbItalic: "Italic",
  tbUnderline: "Underline",
  tbStrike: "Strikethrough",
  tbParagraph: "Text",
  tbH1: "Heading 1",
  tbH2: "Heading 2",
  tbH3: "Heading 3",
  tbBullets: "Bullet list",
  tbNumbered: "Numbered list",
  tbQuote: "Quote",
  tbFont: "Font",
  tbFontDefault: "Default",
  tbFontSerif: "Serif",
  tbFontMono: "Mono",
  tbSize: "Size",
  tbClear: "Clear formatting",
  tbUndo: "Undo",
  tbRedo: "Redo",

  // Clip-to-notes (from the evidence feed)
  clipAction: "Clip to notes",
  clipTitle: "Clip to a notepad",
  clipPick: "Choose where this evidence goes:",
  clipNewNotepad: "+ New notepad in “{section}”",
  clipNoSections: "No sections yet — create one on the Due diligence page first.",
  clipGoToNotes: "Open Due diligence →",
  clipped: "Clipped ✓",
  clipFailed: "Clip failed — try again.",

  loading: "Loading notes…",

  // Highlight-to-annotate (any text surface)
  annotPlaceholder: "Add a note… (Enter = amber highlight)",
  annotDelete: "Remove highlight",

  // Annotation records (the reviewable log on the desk)
  annRecTitle: "Annotations",
  annSurfBrief: "Today’s brief",
  annSurfDossier: "Dossier",
  annSurfEvidence: "Evidence: {headline}",
  annSurfEvidenceGeneric: "Evidence item",
  annSurfReading: "“{name}” reading · {date}",
  annSurfReadingGeneric: "Signal reading",
  annSurfThesis: "“{name}” — thesis",
  annSurfBackstory: "“{name}” — deep history",
  annSurfChat: "Analyst reply",
} as const;

const zh: Record<keyof typeof en, string> = {
  title: "笔记",
  pageSubtitle: "你对 {name} 的独立思考——按你的方式组织；分析师只读、绝不改动。",
  backToDesk: "‹ 返回工作台",
  openNotes: "笔记",

  addSection: "添加板块",
  sectionNamePlaceholder: "板块名称——如 商业护城河",
  fromFocusAreas: "或采用一个关注领域：",
  suggestedSections: "灵感：",
  sugMoat: "商业护城河",
  sugProspects: "前景与目标",
  sugBuybacks: "回购与股东回报",
  sugCulture: "文化与原则",
  sugIndustry: "行业与竞争",
  renameSection: "重命名",
  deleteSection: "删除板块",
  deleteSectionConfirm: "删除“{title}”及其 {n} 个记事本？此操作不可撤销。",
  emptySection: "还没有记事本。",
  noSections: "还没有板块。可以从关注领域、建议开始，或自行命名。",

  addNotepad: "+ 记事本",
  addNote: "+ 添加笔记",
  notepadTitlePlaceholder: "记事本标题……",
  deleteNotepad: "删除记事本",
  deleteNotepadConfirm: "删除“{title}”？此操作不可撤销。",
  untitledNotepad: "未命名",
  savedAgo: "已保存 {when}",
  saving: "保存中……",
  unsaved: "有未保存的更改",

  tbBold: "加粗",
  tbItalic: "斜体",
  tbUnderline: "下划线",
  tbStrike: "删除线",
  tbParagraph: "正文",
  tbH1: "标题 1",
  tbH2: "标题 2",
  tbH3: "标题 3",
  tbBullets: "无序列表",
  tbNumbered: "有序列表",
  tbQuote: "引用",
  tbFont: "字体",
  tbFontDefault: "默认",
  tbFontSerif: "衬线",
  tbFontMono: "等宽",
  tbSize: "字号",
  tbClear: "清除格式",
  tbUndo: "撤销",
  tbRedo: "重做",

  clipAction: "收藏到笔记",
  clipTitle: "收藏到记事本",
  clipPick: "选择这条证据的去处：",
  clipNewNotepad: "+ 在“{section}”中新建记事本",
  clipNoSections: "还没有板块——请先在尽职调查页创建一个。",
  clipGoToNotes: "打开尽职调查 →",
  clipped: "已收藏 ✓",
  clipFailed: "收藏失败——请重试。",

  loading: "正在加载笔记……",

  annotPlaceholder: "添加批注……（回车 = 琥珀色高亮）",
  annotDelete: "移除高亮",

  annRecTitle: "批注记录",
  annSurfBrief: "今日晨报",
  annSurfDossier: "档案",
  annSurfEvidence: "证据：{headline}",
  annSurfEvidenceGeneric: "证据条目",
  annSurfReading: "“{name}” 读数 · {date}",
  annSurfReadingGeneric: "信号读数",
  annSurfThesis: "“{name}”——论点",
  annSurfBackstory: "“{name}”——深度历史",
  annSurfChat: "分析师回复",
};

export const notes = { en, zh };
