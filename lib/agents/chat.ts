import type Anthropic from "@anthropic-ai/sdk";
import { claudeJSON, effortFromEnv } from "../ai/claude";
import { CLAUDE_OVERLOAD_FALLBACK } from "../ai/fallback";
import { resolveModel } from "../ai/models";
import { withDeadline } from "./research";
import {
  CHAT_LESSON_GUIDANCE,
  CHAT_SCHEMA,
  DESK_DOCTRINE,
  deskIdentity,
  EXPERT_LOOP_GUIDANCE,
  INTAKE_STAGES_DOCTRINE,
  investorQuestionsBlock,
  OPENING_FILE_DOCTRINE,
  QUESTION_METHOD,
  QUICK_CHAT_DOCTRINE,
  QUICK_CHAT_SCHEMA,
  SIGNAL_GUIDANCE,
  STANDING_ORDERS_DOCTRINE,
  standingOrdersBlock,
} from "./framework";
import {
  approveSignal,
  getDiligenceSynthesis,
  getSetting,
  getSignal,
  getTicker,
  insertLesson,
  insertMessage,
  insertProposal,
  latestRun,
  listDeskQuestions,
  listDiligenceEvidence,
  listDiligenceResearch,
  listFocusAreas,
  listLessons,
  listMessagesWithAttachments,
  listNoteSections,
  listNotes,
  listPromises,
  listSignals,
  markOnboarded,
  readingsForSignal,
  recentDigest,
  setSetting,
  setSignalStatus,
  sourcesForSignals,
  upsertFocusArea,
} from "../db";
import { getQuote, quoteLine } from "../market";
import { financialsSummary, peekFinancials } from "../financials";
import { diligenceContext } from "../notes";
import { computeInvolvement, involvementLine } from "../portfolio";
import type { Lang } from "../i18n/config";
import type { Attachment, ChatMessage, FocusAreaProposal, SignalProposal } from "../types";

interface ChatOutput {
  reply: string;
  focusAreas: FocusAreaProposal[];
  proposals: SignalProposal[];
  lessons: { text: string; basis: string; applyNow: boolean }[];
  approveProposals: string[];
  dismissProposals: string[];
  retireSignals: string[];
  startResearch: boolean;
  onboardingComplete: boolean;
}

export interface ChatTurnResult {
  /** Null when the investor paused the turn — nothing was persisted. */
  message: ChatMessage | null;
  /** The route should kick a research run (investor asked, or desk just activated). */
  startResearch: boolean;
  /** The investor paused this turn mid-flight; the reply was discarded. */
  paused?: boolean;
}

// ---------------------------------------------------------------------------
// Chat turn status markers (settings kv), per thread (ticker desk or one
// signal's scoped chat). They let the UI show honest state across reloads and
// tabs: BUSY = a turn is running server-side (the analyst keeps thinking in
// the background when the investor navigates away); ERROR = the last turn
// failed, with the specific reason; CANCEL = the investor paused — a turn
// started before the marker discards its reply instead of persisting it.
// ---------------------------------------------------------------------------

const chatScope = (symbol: string, scopeId: string | null) => `${symbol}:${scopeId ?? "main"}`;
export const chatBusyKey = (symbol: string, scopeId: string | null) =>
  `chatBusy:${chatScope(symbol, scopeId)}`;
export const chatErrorKey = (symbol: string, scopeId: string | null) =>
  `chatError:${chatScope(symbol, scopeId)}`;
export const chatCancelKey = (symbol: string, scopeId: string | null) =>
  `chatCancel:${chatScope(symbol, scopeId)}`;
/**
 * A busy marker older than this is a dead turn (the serverless function was
 * killed mid-flight) — treat as not busy so the thread doesn't stick on
 * "thinking" forever. Comfortably above CHAT_DEADLINE_MS.
 */
export const CHAT_BUSY_STALE_MS = 6 * 60_000;

/** Is a chat turn currently running for this thread (fresh busy marker)? */
export async function chatTurnBusy(
  userId: string,
  symbol: string,
  scopeId: string | null
): Promise<boolean> {
  const at = await getSetting(userId, chatBusyKey(symbol, scopeId)).catch(() => null);
  return !!at && Date.now() - Date.parse(at) < CHAT_BUSY_STALE_MS;
}

/** The last turn's stored failure reason for this thread, if any. */
export async function chatTurnError(
  userId: string,
  symbol: string,
  scopeId: string | null
): Promise<string | null> {
  const err = await getSetting(userId, chatErrorKey(symbol, scopeId)).catch(() => null);
  return err?.trim() ? err : null;
}

/** The templated first message shown when a desk opens (stored at ticker creation). */
export function welcomeMessage(symbol: string, name: string, lang: Lang = "en"): string {
  if (lang === "zh") {
    return `欢迎——这里是您的 **${name}** Scalae 研究台，我是您的首席分析师。

我的工作是运行巴菲特所依赖的那种信息网络：每天从开放网络搜集与*您*关心的问题相关的证据，维护一块实时信号板，并标记任何一位长期企业所有者应当知道的动向。短期来看市场是一台投票机——这个研究台的使命是称量企业本身。

**我们像伯克希尔一样开局：从公司自己的记录读起。**告诉我您想了解 ${symbol} 的哪些方面，我会列出最能推进分析的一手文件——历年股东信与创始人致辞、新旧年报、薪酬与激励披露（委托书）、IPO 招股书。开放网络只能给我碎片和转述；文件本身需要您提供。**直接把文件拖进这个对话**（PDF、截图、文本均可），我会逐份按巴菲特/芒格的框架研读，然后我们一起设计信号板。

我们会按巴菲特研究一家新公司的方式，分六个小阶段推进——四道筛选依次进行：**① 能力圈**（也包括您的——我会问您有哪些一手了解），**② 生意经济学**（护城河的真实机制、定价权是"行使过"还是"据称有"），**③ 行业地图**（行业的利润究竟被谁赚走——以及"进攻者测试"：给你无限资本，你能夺走它的位置吗？），**④ 管理层**（坦诚记录与薪酬激励），**⑤ 反向思考**（我们一起建立证伪清单），**⑥ 结论与信号板**——先给出诚实的"投 / 不投 / 太难"判断，再提议信号。随时说"跳过"或"直接提议信号"即可快进。

如果您不确定从哪里开始，直接说一声——我会先判断 ${name} 是哪一类生意，提出当下争议最大的问题，并列出*这家*公司值得收集的具体文件。

未经您批准，任何内容都不会生效：我会提出关注领域和具体可跟踪的信号——每一条都注明依据来自我们收集的哪份材料——由您逐一批准或拒绝。赶时间？说一句"直接提议信号"，我会立即基于开放网络记录起草信号板，并标明哪些结论尚未经一手材料验证。`;
  }
  return `Welcome — this is your **${name}** Scalae desk. I'm your lead analyst.

My job is to run the kind of information network Buffett relied on: every day I'll sweep the open web for evidence on the questions *you* care about, keep a live signal board, and flag anything a long-term owner of this business should know. In the short run the market is a voting machine — this desk exists to weigh the business.

**We start the way Berkshire starts: with the company's own record.** Tell me what you want to understand about ${symbol}, and I'll tell you which primary documents would most move the analysis — shareholder and founder letters across the years, annual reports old and new, the proxy's incentive disclosures, the IPO prospectus. The open web gives me fragments and retellings; the documents themselves I need from you. **Drop them right into this conversation** (PDFs, screenshots, text) and I'll read each through the Buffett/Munger lenses before we design the board together.

We'll walk it the way Buffett walks a new company — six short stages, the filters in order: **① circle of competence** (yours counts too — I'll ask what you know firsthand), **② business economics** (the moat's actual mechanism, pricing power exercised vs. claimed), **③ industry map** (who actually earns the industry's profits — and the attacker's test: with unlimited capital, could you take their position?), **④ management** (the candor record and the proxy's incentives), **⑤ inversion** (we build the kill list together), **⑥ verdict & board** — an honest in / out / too-hard read, then the signals. Say "skip" or "just propose signals" anytime to jump ahead.

If you're not sure where to start, just say so — I'll size up what kind of business ${name} is, name the questions with the most open debate, and list the specific documents worth gathering for *this* company.

Nothing goes live without your sign-off: I'll propose focus areas and specific trackable signals — each grounded in what we gathered — and you approve or reject each one. In a hurry? Say "just propose signals" and I'll draft the board immediately from the open-web record, marking what remains unverified.`;
}

// ---------------------------------------------------------------------------
// Attachments → Claude content blocks
// ---------------------------------------------------------------------------

const IMAGE_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
/**
 * Hard wall-clock cap for one analyst turn, covering the primary call and the
 * overload-fallback attempt together. Under the chat routes' 300s maxDuration
 * with margin for the desk queries and the response write.
 */
const CHAT_DEADLINE_MS = 240_000;
/**
 * The fast lane's own cap. A value-tier reply over the compact snapshot lands
 * in seconds; if it hasn't by now, the turn falls through to the senior
 * analyst, whose deadline is whatever remains of CHAT_DEADLINE_MS.
 */
const QUICK_DEADLINE_MS = 45_000;
/** How many recent user messages keep their attachment payloads inlined. */
const RECENT_ATTACHMENT_TURNS = 8;
/** Total base64/text budget per model request across all inlined attachments. */
const ATTACHMENT_BUDGET = 9_000_000;

/** Attachments → Claude content blocks (exported for the diligence memo agent). */
export function attachmentBlocks(atts: Attachment[]): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const a of atts) {
    if (!a.data) continue;
    if (a.kind === "image" && IMAGE_MEDIA.has(a.mediaType)) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: a.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: a.data,
        },
      });
    } else if (a.kind === "pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: a.data },
      });
    } else if (a.kind === "text") {
      blocks.push({
        type: "text",
        text: `--- Attached file: ${a.name} ---\n${a.data}\n--- End of attached file: ${a.name} ---`,
      });
    }
  }
  return blocks;
}

/**
 * Map stored history to model messages. Recent user turns keep their full
 * attachment payloads (within a size budget, newest first); older ones are
 * replaced with a filename note so long threads stay affordable.
 */
function historyToMessages(history: ChatMessage[]): Anthropic.MessageParam[] {
  const withData = new Set<string>();
  let budget = ATTACHMENT_BUDGET;
  let seen = 0;
  for (let i = history.length - 1; i >= 0 && seen < RECENT_ATTACHMENT_TURNS; i--) {
    const m = history[i];
    if (m.role !== "user" || m.attachments.length === 0) continue;
    seen++;
    const size = m.attachments.reduce((n, a) => n + (a.data?.length ?? 0), 0);
    if (size <= budget) {
      withData.add(m.id);
      budget -= size;
    }
  }

  return history.map((m): Anthropic.MessageParam => {
    const atts = m.attachments ?? [];
    if (m.role === "user" && atts.length > 0) {
      if (withData.has(m.id)) {
        const blocks = attachmentBlocks(atts);
        if (m.content.trim()) blocks.push({ type: "text", text: m.content });
        if (blocks.length > 0) return { role: "user", content: blocks };
      }
      const names = atts.map((a) => `${a.name} (${a.kind})`).join(", ");
      return {
        role: "user",
        content: `${m.content}\n[Attached earlier, no longer inlined: ${names}]`.trim(),
      };
    }
    return { role: m.role, content: m.content };
  });
}

/**
 * Handle one chat turn. The analyst can converse, propose signals/focus areas
 * (which land in the approval queue), and — only on the investor's explicit
 * ask — approve/dismiss pending proposals, retire active signals, or start a
 * research run. Set `retry` to re-run the analyst on existing history after a
 * failure, without adding a new user message. Attachments (images, PDFs, text
 * files) ride along as first-class evidence.
 */
export async function handleChatTurn(
  userId: string,
  symbol: string,
  userText: string,
  opts: { retry?: boolean; attachments?: Attachment[]; signalId?: string; lang?: Lang } = {}
): Promise<ChatTurnResult> {
  const ticker = await getTicker(userId, symbol);
  if (!ticker) throw new Error(`Unknown ticker ${symbol}`);

  // Signal-scoped desk: same analyst, context narrowed to one signal's world.
  const focusSignal = opts.signalId ? await getSignal(opts.signalId) : undefined;
  if (opts.signalId && (!focusSignal || focusSignal.symbol !== symbol)) {
    throw new Error("Unknown signal for this desk.");
  }
  const scopeId = focusSignal?.id ?? null;

  if (!opts.retry) {
    await insertMessage(userId, symbol, "user", userText, [], opts.attachments ?? [], scopeId);
  }

  // Turn status markers: the turn keeps running server-side even if the
  // investor navigates away (the UI reads BUSY to show honest state), and a
  // pause (CANCEL marker newer than this turn's start) discards the reply
  // instead of persisting it. On failure the ROUTE records the specific
  // reason under chatErrorKey and clears busy.
  const turnStartedAt = new Date().toISOString();
  await setSetting(userId, chatBusyKey(symbol, scopeId), turnStartedAt).catch(() => {});
  await setSetting(userId, chatErrorKey(symbol, scopeId), "").catch(() => {});
  const clearBusy = () => setSetting(userId, chatBusyKey(symbol, scopeId), "").catch(() => {});
  const pausedByInvestor = async () =>
    ((await getSetting(userId, chatCancelKey(symbol, scopeId)).catch(() => null)) ?? "") >=
    turnStartedAt;

  const mode = ticker.onboarded ? "working" : "onboarding";
  const [
    focusAreas,
    active,
    suggested,
    dismissed,
    retired,
    run,
    quote,
    involvement,
    financials,
    noteSections,
    notes,
    ddResearch,
    ddSynthesis,
    ddEvidence,
    activeLessons,
    pendingLessons,
    openPromises,
    resolvedPromises,
    deskQuestions,
  ] = await Promise.all([
    listFocusAreas(userId, symbol),
    listSignals(userId, symbol, "active"),
    listSignals(userId, symbol, "suggested"),
    listSignals(userId, symbol, "dismissed"),
    listSignals(userId, symbol, "retired"),
    latestRun(userId, symbol),
    getQuote(symbol).catch(() => null),
    computeInvolvement(userId, symbol).catch(() => null),
    // Cache-only: never pay the Yahoo fetch on the chat path (the desk page
    // warms it). Present once the investor has opened the desk.
    peekFinancials(symbol).catch(() => null),
    listNoteSections(userId, symbol).catch(() => []),
    listNotes(userId, symbol).catch(() => []),
    listDiligenceResearch(userId, symbol).catch(() => []),
    getDiligenceSynthesis(userId, symbol).catch(() => null),
    listDiligenceEvidence(userId, symbol).catch(() => []),
    listLessons(userId, symbol, "active").catch(() => []),
    listLessons(userId, symbol, "suggested").catch(() => []),
    listPromises(userId, symbol, ["open"]).catch(() => []),
    listPromises(userId, symbol, ["kept", "missed", "dropped"]).catch(() => []),
    listDeskQuestions(userId, symbol).catch(() => []),
  ]);

  // Keep-both pairs (active replacement + knowingly reactivated original):
  // surface the overlap so the analyst keeps steering toward one crux signal.
  const overlapWith = new Map<string, string>();
  {
    const byId = new Map(active.map((s) => [s.id, s]));
    for (const s of active) {
      const other = s.replaces ? byId.get(s.replaces) : undefined;
      if (other) {
        overlapWith.set(s.id, other.name);
        overlapWith.set(other.id, s.name);
      }
    }
  }
  const latestBySignal = await Promise.all(
    active.map(async (s) => ({ s, latest: (await readingsForSignal(s.id, 1))[0] }))
  );
  const boardLines = latestBySignal
    .map(({ s, latest }) => {
      const reading = latest
        ? ` Latest (${latest.date.slice(0, 10)}): ${latest.level}${latest.value != null ? `, ${latest.value} ${latest.valueUnit ?? ""}` : ""} — ${latest.rationale}`
        : " No readings yet.";
      const overlapNote = overlapWith.has(s.id)
        ? ` NOTE: investor knowingly kept this alongside "${overlapWith.get(s.id)}" despite overlap — if both keep reading the same evidence, propose ONE merged replacement.`
        : "";
      return `- "${s.name}" (${s.type}, ${s.focusArea}): ${s.measurementPlan}${reading}${overlapNote}`;
    })
    .join("\n");

  const positionLine = involvementLine(involvement);
  const ordersBlock = standingOrdersBlock(activeLessons, pendingLessons);
  // The analyst-questions channel: what the desk has asked the investor, and
  // their answers (first-class testimony). The chat may discuss open ones
  // naturally, but marking answered/dismissed happens on the questions card.
  const askedBlock = investorQuestionsBlock(
    deskQuestions.filter((q) => q.status === "open"),
    deskQuestions.filter((q) => q.status === "answered").slice(0, 6),
    deskQuestions.filter((q) => q.status === "dismissed").slice(0, 4)
  );
  // The promise ledger, compact: candor context for management questions.
  const promiseTally = (["kept", "missed", "dropped"] as const)
    .map((s) => ({ s, n: resolvedPromises.filter((p) => p.status === s).length }))
    .filter((t) => t.n > 0)
    .map((t) => `${t.n} ${t.s}`)
    .join(", ");
  const promiseBlock =
    openPromises.length > 0 || promiseTally
      ? `Promise ledger (management commitments the desk tracks — candor evidence, never business evidence):\n${
          openPromises
            .slice(0, 8)
            .map(
              (p) =>
                `- OPEN: "${p.text}" (${p.madeBy || "management"}, ${p.madeAt || "date unstated"}${p.due ? `, due ${p.due}` : ""})${p.proposedStatus ? ` — desk proposes "${p.proposedStatus}", awaiting the investor` : ""}`
            )
            .join("\n") || "(none open)"
        }${promiseTally ? `\nResolved to date: ${promiseTally}.` : ""}`
      : "";
  const deskContext = `DESK STATE (today: ${new Date().toISOString().slice(0, 10)}):
Market: ${quoteLine(quote)}
Investor's position in ${symbol}: ${positionLine || "none recorded"}${positionLine ? " — use only for margin-of-safety and exposure context; weigh the business on its merits, never bend readings toward the position." : ""}
Focus areas: ${focusAreas.length ? focusAreas.map((f) => `${f.title} — ${f.description}`).join("; ") : "none yet"}
Active signal board:
${boardLines || "(empty)"}
Pending proposals awaiting the investor's approval: ${suggested.map((s) => `"${s.name}"`).join(", ") || "none"}
Previously dismissed or retired signals (do NOT re-propose without materially new evidence): ${[...dismissed, ...retired].map((s) => `"${s.name}"`).join(", ") || "none"}
Research: ${run ? `last run ${run.startedAt.slice(0, 10)} (${run.status})` : "never run"}
${ordersBlock ? `${ordersBlock}\n` : ""}${askedBlock ? `${askedBlock}\n` : ""}${promiseBlock ? `${promiseBlock}\n` : ""}${financials ? financialsSummary(financials) : ""}
${diligenceContext(noteSections, notes, ddResearch, ddSynthesis, ddEvidence)}
${run?.brief ? `Latest daily brief:\n${run.brief}` : ""}`;

  // Compact snapshot for the fast lane: the dossier + brief carry the standing
  // thesis, board lines carry each signal's latest reading — a fraction of the
  // deep context, enough to answer simple questions in seconds.
  const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const quickBoardLines = latestBySignal
    .map(({ s, latest }) => {
      const reading = latest
        ? `${latest.level}${latest.value != null ? ` (${latest.value} ${latest.valueUnit ?? ""})` : ""} ${latest.date.slice(0, 10)} — ${clip(latest.rationale, 200)}`
        : "no readings yet";
      return `- "${s.name}" (${s.focusArea}): ${clip(s.thesis, 150)} Latest: ${reading}`;
    })
    .join("\n");
  const quickContext = `DESK STATE — COMPACT SNAPSHOT (today: ${new Date().toISOString().slice(0, 10)}):
Market: ${quoteLine(quote)}
Investor's position in ${symbol}: ${positionLine || "none recorded"}
Focus areas: ${focusAreas.map((f) => f.title).join("; ") || "none yet"}
Active signals (${active.length}), latest reading each:
${quickBoardLines || "(empty board)"}
Pending proposals awaiting the investor's approval: ${suggested.map((s) => `"${s.name}"`).join(", ") || "none"}
Research: ${run ? `last run ${run.startedAt.slice(0, 10)} (${run.status})` : "never run"}
Due-diligence sections: ${noteSections.map((n) => n.title).join("; ") || "none"}
${run?.dossier ? `\nTHE BUSINESS, AS THE DESK READS IT (standing dossier):\n${run.dossier}\n` : ""}${run?.brief ? `\nLATEST DAILY BRIEF:\n${run.brief}\n` : ""}${ddSynthesis?.content ? `\nDUE-DILIGENCE RECORD — STANDING SYNTHESIS:\n${ddSynthesis.content}\n` : ""}`;

  // Signal-focused context: the one signal's full world, in depth.
  let signalContext = "";
  let quickSignalContext = "";
  if (focusSignal) {
    const [readings, catalog, digest] = await Promise.all([
      readingsForSignal(focusSignal.id, 10),
      sourcesForSignals(userId, symbol).then((m) => m.get(focusSignal.id) ?? []),
      recentDigest(userId, symbol, 40),
    ]);
    const readingLines = readings
      .map(
        (r) =>
          `- ${r.date.slice(0, 10)}: ${r.level}${r.value != null ? `, ${r.value} ${r.valueUnit ?? ""}` : ""} (delta ${r.delta}, confidence ${r.confidence}) — ${r.rationale}${
            r.citations.length ? ` [sources: ${r.citations.map((c) => c.domain ?? c.title).join(", ")}]` : ""
          }`
      )
      .join("\n");
    const catalogLines = catalog
      .slice(0, 20)
      .map((s) => `- ${s.domain}: ${s.title}${s.count > 1 ? ` (cited in ${s.count} readings)` : ""}`)
      .join("\n");
    const related = digest
      .filter((d) => d.signalNames.some((n) => n.toLowerCase() === focusSignal.name.toLowerCase()))
      .slice(0, 6)
      .map((d) => `- ${d.date.slice(0, 10)}: ${d.headline}`)
      .join("\n");
    signalContext = `SIGNAL IN FOCUS — the investor opened this signal's dedicated view:
"${focusSignal.name}" (${focusSignal.type}, focus area: ${focusSignal.focusArea}, status: ${focusSignal.status})
Thesis: ${focusSignal.thesis}
Measurement plan: ${focusSignal.measurementPlan}
Scale: ${focusSignal.scale}
Reading history (newest first):
${readingLines || "(no readings yet)"}
Accumulated evidence catalog (${catalog.length} distinct sources):
${catalogLines || "(none yet)"}
Digest items tied to this signal:
${related || "(none)"}`;
    quickSignalContext = `SIGNAL IN FOCUS — the investor opened this signal's dedicated view; answer from ITS world first:
"${focusSignal.name}" (${focusSignal.type}, focus area: ${focusSignal.focusArea}, status: ${focusSignal.status})
Thesis: ${focusSignal.thesis}
Measurement plan: ${focusSignal.measurementPlan}
Recent readings (newest first):
${
  readings
    .slice(0, 3)
    .map(
      (r) =>
        `- ${r.date.slice(0, 10)}: ${r.level}${r.value != null ? `, ${r.value} ${r.valueUnit ?? ""}` : ""} — ${clip(r.rationale, 200)}`
    )
    .join("\n") || "(no readings yet)"
}`;
  }

  const modeInstructions = focusSignal
    ? `MODE: Signal-focused working session.
This conversation lives inside the dedicated view for "${focusSignal.name}" — answer from THIS signal's thesis, readings, and evidence catalog first; bring in the wider board or brief only as supporting context and say when you do. The ticker-level desk chat (separate) keeps the global picture.
- Interrogate the signal itself, not just its readings: is it still aimed at the crux of the business model/culture? If the investor's feedback (or the evidence) shows it is aimed wrong, too narrow, or subsumable by something sharper, propose the upgraded signal with replaces="${focusSignal.name}" — approval swaps it in and retires this one.
- New adjacent threads → normal additive proposals (approval-gated; no overlap with the board).
- Investor explicitly asks to retire this signal → put "${focusSignal.name}" in retireSignals and confirm.
- Investor asks to run/refresh research → startResearch=true.
Keep replies concrete and evidence-first; cite sources by domain when you lean on them. Set onboardingComplete=false.`
    : mode === "onboarding"
      ? `MODE: Onboarding intake — the desk's opening study of ${ticker.name}, conducted WITH the investor. Run THE STAGED INTAKE above (①→⑥, the filters in veto order), assembling THE OPENING FILE as you go; the question-generation method drives what each stage asks. Rules that bind every stage:
- Open each reply by naming the current stage ("② Business economics —"). Infer the stage from the conversation so far; on the very first reply, run stage ① (your one-paragraph classification of ${ticker.name}, the opening-file request, and the investor's-own-circle questions).
- Everything that arrives (documents, answers, anecdotes) is read through the lenses immediately; lead the reply with what it settled, unsettled or contradicted before pressing on. Never re-request what has arrived; acknowledge gaps the investor cannot fill and move on.
- One question per reply (two only when tightly coupled); document requests may list several items with one-line whys. Announce each stage transition with what settled it.
- THE BOARD (stage ⑥, or immediately on "just propose signals"): deliver the honest IN/OUT/TOO HARD verdict with its carrying reasons — context, never a gate — then emit 2-4 focusAreas and a full board of 4-8 signals via the structured fields: spread across the areas, mixing quantitative and qualitative, guarding load-bearing assumptions, the kill list's earliest symptoms as red-flag signals. EVERY thesis names its grounding: the document or statement it draws on ("the 2021 letter's margin promise", "the proxy's revenue-weighted comp"), the investor's own point ("your rival ranking from ③"), or plainly "unverified: open-web only" plus the document that would firm it. In "reply", walk the board through the verdict, why these are the crux questions, and what remains unverified — then tell them to approve the signals they want. Set onboardingComplete=true when you do this.
- The investor controls the pace: "skip", "go back", or "just propose signals" is honored instantly, that turn.
Leave approveProposals/dismissProposals/retireSignals empty and startResearch=false unless the investor explicitly asks (e.g. "approve them all" → list every pending name in approveProposals).`
      : `MODE: Working session with the investor.
Use the desk state above to answer questions with evidence (cite readings/brief items by name). Take feedback into the desk:
- New trackable thread implied by their feedback → emit signal proposals (they require approval; say so).
- Investor explicitly asks to approve/reject pending proposals → put those exact names in approveProposals/dismissProposals and confirm in reply.
- Investor explicitly asks to stop tracking an active signal → put its exact name in retireSignals. If they want it replaced, also propose the sharper replacement.
- Investor asks to run/refresh research → startResearch=true.
Only emit focusAreas when the investor genuinely introduces a new area of concern. Never approve/retire/dismiss anything the investor did not explicitly request. Keep replies short and useful — this is a working desk, not a report. Set onboardingComplete=false.`;

  // Conversation language: the analyst speaks the investor's language, but
  // everything destined for the board stays canonical English — the display
  // layer (lib/i18n/translate.ts) localizes stored content uniformly, so the
  // desk never forks into mixed-language data.
  const languageDirective =
    opts.lang === "zh"
      ? `

LANGUAGE: The investor uses Simplified Chinese. Write "reply" in natural, professional Simplified Chinese (keep ticker symbols, company names and numbers as-is; use standard finance terminology — 护城河, 所有者盈余, 资本配置, 安全边际). EVERYTHING ELSE stays in ENGLISH: proposals (name, thesis, measurementPlan, scale, focusArea), focusAreas entries, and the exact signal names you place in approveProposals / dismissProposals / retireSignals — match the English names in the desk state verbatim (the app translates board content for display automatically). When you mention a signal in your Chinese reply, give its English name in quotes, optionally with a short Chinese gloss.`
      : "";

  // Cache the static desk doctrine (shared prefix across every Claude call);
  // the ticker identity, method, board state and mode instructions follow it.
  const systemTail = `${deskIdentity(symbol, ticker.name)}

${QUESTION_METHOD}

${!ticker.onboarded && !focusSignal ? `${OPENING_FILE_DOCTRINE}\n\n${INTAKE_STAGES_DOCTRINE}\n\n` : ""}${SIGNAL_GUIDANCE}

${EXPERT_LOOP_GUIDANCE}

${STANDING_ORDERS_DOCTRINE}

${CHAT_LESSON_GUIDANCE}

ATTACHMENTS: The investor can attach images (charts, product photos, screenshots), PDFs (filings, reports, broker notes) and text files. Treat them as first-class evidence: read them through the desk's lenses, tie what you find to the active board by signal name, and propose new trackable signals when a document reveals a thread the board misses (approval-gated as always). Refer to an attachment by its filename when you rely on it.

${deskContext}

${signalContext ? `${signalContext}\n\n` : ""}${modeInstructions}${languageDirective}`;
  const system = [
    { text: DESK_DOCTRINE, cache: true },
    { text: systemTail },
  ];

  const historyAll = await listMessagesWithAttachments(userId, symbol, 40, { signalId: scopeId });
  const history = historyAll.slice(-16);
  const messages = historyToMessages(history);
  const [chatModel, chatFastModel] = await Promise.all([resolveModel("chat"), resolveModel("chatFast")]);

  // ---- The fast lane --------------------------------------------------------
  // Working-chat turns without fresh documents go to the value-tier model
  // first, over the compact snapshot: simple questions come back in seconds
  // instead of riding the flagship's full-context think. The fast lane takes
  // no desk action (its schema has none) — it either answers or escalates, and
  // any failure falls through to the senior analyst below. Onboarding turns
  // and turns carrying attachments always start deep: the opening study and
  // document work are exactly where the flagship is earned.
  const turnStart = Date.now();
  const lastUser = [...historyAll].reverse().find((m) => m.role === "user");
  const freshAttachments =
    (opts.attachments?.length ?? 0) > 0 ||
    (opts.retry === true && (lastUser?.attachments?.length ?? 0) > 0);
  if (mode === "working" && !freshAttachments) {
    const quickLanguageDirective =
      opts.lang === "zh"
        ? `\n\nLANGUAGE: The investor uses Simplified Chinese — write "reply" in natural, professional Simplified Chinese (keep ticker symbols, company names and numbers as-is; give signal names in English quotes, optionally with a short Chinese gloss).`
        : "";
    const quickSystem = `${QUICK_CHAT_DOCTRINE}

${deskIdentity(symbol, ticker.name)}

${quickContext}

${quickSignalContext ? `${quickSignalContext}\n\n` : ""}Escalation is seamless and costs the investor nothing — when in doubt whether this turn is yours, escalate.${quickLanguageDirective}`;
    // Attachments never inline in the fast lane — a document question escalates.
    const quickMessages: Anthropic.MessageParam[] = history.slice(-8).map((m) => {
      const atts = m.attachments ?? [];
      const note = atts.length
        ? `\n[Attached files on record, not shown in the fast lane: ${atts.map((a) => `${a.name} (${a.kind})`).join(", ")}]`
        : "";
      return { role: m.role, content: `${m.content}${note}`.trim() || "…" };
    });
    try {
      const q = await withDeadline(
        "Quick analyst reply",
        (signal) =>
          claudeJSON<{ reply: string; escalate: boolean; startResearch: boolean }>({
            model: chatFastModel,
            signal,
            system: quickSystem,
            messages: quickMessages,
            schema: QUICK_CHAT_SCHEMA as unknown as Record<string, unknown>,
            maxTokens: 3000,
            effort: effortFromEnv("CLAUDE_CHAT_FAST_EFFORT", "low"),
            meta: { userId, feature: "chat-fast" },
          }),
        QUICK_DEADLINE_MS
      );
      if (!q.escalate && /[\p{L}\p{N}]/u.test(q.reply ?? "")) {
        if (await pausedByInvestor()) {
          await clearBusy();
          return { message: null, startResearch: false, paused: true };
        }
        const message = await insertMessage(userId, symbol, "assistant", q.reply, [], [], scopeId);
        await clearBusy();
        return { message, startResearch: active.length > 0 && q.startResearch === true };
      }
    } catch (e) {
      console.warn(
        `[scalae] chat fast lane failed for ${symbol} — falling through to the senior analyst:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  // Adaptive thinking shares the max_tokens budget with the reply, so a hard
  // turn can spend most of the budget reasoning and leave the schema-constrained
  // reply as a stub (a lone "," in the worst case). Give it real headroom, and
  // more when the turn carries a document/image the analyst has to work through.
  const hasAttachmentBlocks = messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((b) => b.type === "document" || b.type === "image")
  );
  // Interactive turn: LOW effort by default (see effortFromEnv — effort is the
  // only thinking-depth lever, and a medium/high think over this desk-sized
  // context runs minutes and can starve the reply's token budget), and a hard
  // deadline covering the primary AND the overload-fallback attempt — a hung
  // turn fails fast into the saved-message + retry path instead of riding to
  // the platform's function kill, which the investor experiences as a timeout.
  // Two deliberate exceptions run at MEDIUM: onboarding-intake turns (the
  // opening study of the company — framework depth is the product there, and
  // the investor is settling in, not firing quick questions) and turns whose
  // history carries documents/images the analyst must actually work through.
  const out = await withDeadline(
    "Analyst reply",
    (signal) =>
      claudeJSON<ChatOutput>({
        model: chatModel,
        signal,
        system,
        messages,
        schema: CHAT_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: hasAttachmentBlocks ? 24000 : 16000,
        effort: effortFromEnv(
          "CLAUDE_CHAT_EFFORT",
          mode === "onboarding" || hasAttachmentBlocks ? "medium" : "low"
        ),
        meta: { userId, feature: "chat" },
        // Interactive: don't hard-fail the investor on a transient Opus overload.
        fallbackModel: CLAUDE_OVERLOAD_FALLBACK,
      }),
    // Whatever the fast lane left of the turn's wall-clock budget (all of it
    // when the turn started deep), floored so an escalated turn still gets a
    // real window.
    Math.max(90_000, CHAT_DEADLINE_MS - (Date.now() - turnStart))
  );

  // Paused mid-turn: the investor stopped this turn — discard the reply and
  // take NO desk action (no proposals, approvals, or research kicks).
  if (await pausedByInvestor()) {
    await clearBusy();
    return { message: null, startResearch: false, paused: true };
  }

  // --- focus areas & new proposals (approval-gated) ---
  for (const fa of out.focusAreas ?? []) {
    if (fa.title?.trim()) await upsertFocusArea(userId, symbol, fa.title.trim(), fa.description ?? "");
  }
  const proposalIds: string[] = [];
  for (const p of out.proposals ?? []) {
    if (!p.name?.trim()) continue;
    if (p.focusArea?.trim()) {
      const known = (await listFocusAreas(userId, symbol)).some(
        (f) => f.title.toLowerCase() === p.focusArea.trim().toLowerCase()
      );
      if (!known) await upsertFocusArea(userId, symbol, p.focusArea.trim(), "");
    }
    const id = await insertProposal(userId, symbol, p, ticker.onboarded ? "chat" : "onboarding");
    if (id) proposalIds.push(id);
  }

  // --- standing orders (the teach-the-desk loop) ---
  // applyNow=true only when the investor explicitly commanded the standing
  // behavior this turn (their ask is the approval — the cleansing-bench
  // precedent); everything else parks as 'suggested' for their review in the
  // standing-orders card. Dedup lives in insertLesson.
  for (const l of (out.lessons ?? []).slice(0, 2)) {
    if (!l.text?.trim()) continue;
    await insertLesson(userId, symbol, {
      text: l.text,
      basis: l.basis ?? "",
      origin: "chat",
      status: l.applyNow === true ? "active" : "suggested",
    }).catch(() => null);
  }

  // --- investor-directed actions (the investor's ask IS the approval) ---
  const norm = (s: string) => s.toLowerCase().trim();
  let approvedAny = false;

  const pendingNow = await listSignals(userId, symbol, "suggested");
  for (const name of out.approveProposals ?? []) {
    const hit = pendingNow.find((s) => norm(s.name) === norm(name));
    if (hit) {
      await approveSignal(hit.id); // retires the replaced signal too, if any
      approvedAny = true;
    }
  }
  for (const name of out.dismissProposals ?? []) {
    const hit = (await listSignals(userId, symbol, "suggested")).find((s) => norm(s.name) === norm(name));
    if (hit) await setSignalStatus(hit.id, "dismissed");
  }
  for (const name of out.retireSignals ?? []) {
    const hit = (await listSignals(userId, symbol, "active")).find((s) => norm(s.name) === norm(name));
    if (hit) await setSignalStatus(hit.id, "retired");
  }

  let activatedDesk = false;
  if (approvedAny && !ticker.onboarded) {
    await markOnboarded(userId, symbol);
    activatedDesk = true;
  }

  // Defence in depth: never persist/show a degenerate reply (empty or
  // punctuation-only — the classic budget-starved stub). Actions above still
  // stand; the investor just gets a coherent nudge instead of a blank bubble.
  const meaningful = /[\p{L}\p{N}]/u.test(out.reply ?? "");
  const replyText = meaningful
    ? out.reply
    : opts.lang === "zh"
      ? "我已处理您的请求，但书面回复生成异常——请再问一次，我会完整作答。"
      : "I processed that, but my written reply came back malformed — please ask again and I'll respond in full.";

  const message = await insertMessage(userId, symbol, "assistant", replyText, proposalIds, [], scopeId);
  await clearBusy();
  const hasActive = (await listSignals(userId, symbol, "active")).length > 0;
  return {
    message,
    startResearch: hasActive && (out.startResearch === true || activatedDesk),
  };
}
