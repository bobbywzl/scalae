import type Anthropic from "@anthropic-ai/sdk";
import { CHAT_MODEL, claudeJSON } from "../ai/claude";
import {
  analystPersona,
  CHAT_SCHEMA,
  QUESTION_METHOD,
  SIGNAL_GUIDANCE,
} from "./framework";
import {
  getTicker,
  insertMessage,
  insertProposal,
  latestRun,
  listFocusAreas,
  listMessagesWithAttachments,
  listSignals,
  markOnboarded,
  readingsForSignal,
  setSignalStatus,
  upsertFocusArea,
} from "../db";
import { getQuote, quoteLine } from "../market";
import type { Attachment, ChatMessage, FocusAreaProposal, SignalProposal } from "../types";

interface ChatOutput {
  reply: string;
  focusAreas: FocusAreaProposal[];
  proposals: SignalProposal[];
  approveProposals: string[];
  dismissProposals: string[];
  retireSignals: string[];
  startResearch: boolean;
  onboardingComplete: boolean;
}

export interface ChatTurnResult {
  message: ChatMessage;
  /** The route should kick a research run (investor asked, or desk just activated). */
  startResearch: boolean;
}

/** The templated first message shown when a desk opens (stored at ticker creation). */
export function welcomeMessage(symbol: string, name: string): string {
  return `Welcome — this is your **${name}** Scalae desk. I'm your lead analyst.

My job is to run the kind of information network Buffett relied on: every day I'll sweep the open web for evidence on the questions *you* care about, keep a live signal board, and flag anything a long-term owner of this business should know. In the short run the market is a voting machine — this desk exists to weigh the business.

**To set up the desk, tell me what you want to understand about ${symbol}.** For example: is the moat holding? Is management allocating capital sensibly? Is the culture deteriorating?

If you're not sure where to start, just say so — I'll size up what kind of business ${name} is and suggest the value-investing questions with the most open debate, following the Buffett/Munger framework (moat durability, franchise vs. commodity, owner earnings, capital allocation, management candor, red flags…).

Nothing goes live without your sign-off: I'll propose focus areas and specific trackable signals, and you approve or reject each one. Once the desk is live you can also just tell me here to approve or retire signals, or to run the research now.`;
}

// ---------------------------------------------------------------------------
// Attachments → Claude content blocks
// ---------------------------------------------------------------------------

const IMAGE_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
/** How many recent user messages keep their attachment payloads inlined. */
const RECENT_ATTACHMENT_TURNS = 8;
/** Total base64/text budget per model request across all inlined attachments. */
const ATTACHMENT_BUDGET = 9_000_000;

function attachmentBlocks(atts: Attachment[]): Anthropic.ContentBlockParam[] {
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
  symbol: string,
  userText: string,
  opts: { retry?: boolean; attachments?: Attachment[] } = {}
): Promise<ChatTurnResult> {
  const ticker = await getTicker(symbol);
  if (!ticker) throw new Error(`Unknown ticker ${symbol}`);

  if (!opts.retry) {
    await insertMessage(symbol, "user", userText, [], opts.attachments ?? []);
  }

  const mode = ticker.onboarded ? "working" : "onboarding";
  const [focusAreas, active, suggested, dismissed, retired, run, quote] = await Promise.all([
    listFocusAreas(symbol),
    listSignals(symbol, "active"),
    listSignals(symbol, "suggested"),
    listSignals(symbol, "dismissed"),
    listSignals(symbol, "retired"),
    latestRun(symbol),
    getQuote(symbol).catch(() => null),
  ]);

  const boardLines = (
    await Promise.all(
      active.map(async (s) => {
        const latest = (await readingsForSignal(s.id, 1))[0];
        const reading = latest
          ? ` Latest (${latest.date.slice(0, 10)}): ${latest.level}${latest.value != null ? `, ${latest.value} ${latest.valueUnit ?? ""}` : ""} — ${latest.rationale}`
          : " No readings yet.";
        return `- "${s.name}" (${s.type}, ${s.focusArea}): ${s.measurementPlan}${reading}`;
      })
    )
  ).join("\n");

  const deskContext = `DESK STATE (today: ${new Date().toISOString().slice(0, 10)}):
Market: ${quoteLine(quote)}
Focus areas: ${focusAreas.length ? focusAreas.map((f) => `${f.title} — ${f.description}`).join("; ") : "none yet"}
Active signal board:
${boardLines || "(empty)"}
Pending proposals awaiting the investor's approval: ${suggested.map((s) => `"${s.name}"`).join(", ") || "none"}
Previously dismissed or retired signals (do NOT re-propose without materially new evidence): ${[...dismissed, ...retired].map((s) => `"${s.name}"`).join(", ") || "none"}
Research: ${run ? `last run ${run.startedAt.slice(0, 10)} (${run.status})` : "never run"}
${run?.brief ? `Latest daily brief:\n${run.brief}` : ""}`;

  const modeInstructions =
    mode === "onboarding"
      ? `MODE: Onboarding interview.
The investor just opened this desk. Follow the question-generation method above:
1. First, silently classify ${ticker.name}: great/good/gruesome economics, franchise vs. commodity — and identify which of the four filters carries the most open doubt for this specific company. Let that drive your questions and proposals, not a generic checklist.
2. Learn which questions the investor wants investigated. Ask focused questions — at most one per reply. When the investor is unsure, suggest the 3-5 lenses where ${ticker.name} has the most genuinely open debate right now, each with one line on why it's open for THIS business.
3. Once you know enough (usually within 1-3 exchanges — don't drag it out; if their first message is already clear, propose immediately): emit 2-4 focusAreas and an initial board of 4-8 signals via the structured fields, spread across those areas, mixing quantitative and qualitative, guarding load-bearing assumptions and at least one inverted/red-flag signal. In "reply", walk through the proposed board briefly — including what kind of business you judge this to be and why those are the right questions — and tell them to approve the signals they want. Set onboardingComplete=true when you do this.
Leave approveProposals/dismissProposals/retireSignals empty and startResearch=false unless the investor explicitly asks (e.g. "approve them all" → list every pending name in approveProposals).`
      : `MODE: Working session with the investor.
Use the desk state above to answer questions with evidence (cite readings/brief items by name). Take feedback into the desk:
- New trackable thread implied by their feedback → emit signal proposals (they require approval; say so).
- Investor explicitly asks to approve/reject pending proposals → put those exact names in approveProposals/dismissProposals and confirm in reply.
- Investor explicitly asks to stop tracking an active signal → put its exact name in retireSignals. If they want it replaced, also propose the sharper replacement.
- Investor asks to run/refresh research → startResearch=true.
Only emit focusAreas when the investor genuinely introduces a new area of concern. Never approve/retire/dismiss anything the investor did not explicitly request. Keep replies short and useful — this is a working desk, not a report. Set onboardingComplete=false.`;

  const system = `${analystPersona(symbol, ticker.name)}

${QUESTION_METHOD}

${SIGNAL_GUIDANCE}

ATTACHMENTS: The investor can attach images (charts, product photos, screenshots), PDFs (filings, reports, broker notes) and text files. Treat them as first-class evidence: read them through the desk's lenses, tie what you find to the active board by signal name, and propose new trackable signals when a document reveals a thread the board misses (approval-gated as always). Refer to an attachment by its filename when you rely on it.

${deskContext}

${modeInstructions}`;

  const history = (await listMessagesWithAttachments(symbol, 40)).slice(-16);
  const messages = historyToMessages(history);

  // Adaptive thinking shares the max_tokens budget with the reply, so a hard
  // turn can spend most of the budget reasoning and leave the schema-constrained
  // reply as a stub (a lone "," in the worst case). Give it real headroom, and
  // more when the turn carries a document/image the analyst has to work through.
  const hasAttachmentBlocks = messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((b) => b.type === "document" || b.type === "image")
  );
  const out = await claudeJSON<ChatOutput>({
    model: CHAT_MODEL,
    system,
    messages,
    schema: CHAT_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: hasAttachmentBlocks ? 24000 : 16000,
    effort: "medium",
  });

  // --- focus areas & new proposals (approval-gated) ---
  for (const fa of out.focusAreas ?? []) {
    if (fa.title?.trim()) await upsertFocusArea(symbol, fa.title.trim(), fa.description ?? "");
  }
  const proposalIds: string[] = [];
  for (const p of out.proposals ?? []) {
    if (!p.name?.trim()) continue;
    if (p.focusArea?.trim()) {
      const known = (await listFocusAreas(symbol)).some(
        (f) => f.title.toLowerCase() === p.focusArea.trim().toLowerCase()
      );
      if (!known) await upsertFocusArea(symbol, p.focusArea.trim(), "");
    }
    const id = await insertProposal(symbol, p, ticker.onboarded ? "chat" : "onboarding");
    if (id) proposalIds.push(id);
  }

  // --- investor-directed actions (the investor's ask IS the approval) ---
  const norm = (s: string) => s.toLowerCase().trim();
  let approvedAny = false;

  const pendingNow = await listSignals(symbol, "suggested");
  for (const name of out.approveProposals ?? []) {
    const hit = pendingNow.find((s) => norm(s.name) === norm(name));
    if (hit) {
      await setSignalStatus(hit.id, "active");
      approvedAny = true;
    }
  }
  for (const name of out.dismissProposals ?? []) {
    const hit = (await listSignals(symbol, "suggested")).find((s) => norm(s.name) === norm(name));
    if (hit) await setSignalStatus(hit.id, "dismissed");
  }
  for (const name of out.retireSignals ?? []) {
    const hit = (await listSignals(symbol, "active")).find((s) => norm(s.name) === norm(name));
    if (hit) await setSignalStatus(hit.id, "retired");
  }

  let activatedDesk = false;
  if (approvedAny && !ticker.onboarded) {
    await markOnboarded(symbol);
    activatedDesk = true;
  }

  // Defence in depth: never persist/show a degenerate reply (empty or
  // punctuation-only — the classic budget-starved stub). Actions above still
  // stand; the investor just gets a coherent nudge instead of a blank bubble.
  const meaningful = /[\p{L}\p{N}]/u.test(out.reply ?? "");
  const replyText = meaningful
    ? out.reply
    : "I processed that, but my written reply came back malformed — please ask again and I'll respond in full.";

  const message = await insertMessage(symbol, "assistant", replyText, proposalIds);
  const hasActive = (await listSignals(symbol, "active")).length > 0;
  return {
    message,
    startResearch: hasActive && (out.startResearch === true || activatedDesk),
  };
}
