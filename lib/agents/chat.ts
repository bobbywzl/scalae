import type Anthropic from "@anthropic-ai/sdk";
import { claudeJSON } from "../ai/claude";
import { resolveModel } from "../ai/models";
import {
  analystPersona,
  CHAT_SCHEMA,
  QUESTION_METHOD,
  SIGNAL_GUIDANCE,
} from "./framework";
import {
  approveSignal,
  getSignal,
  getTicker,
  insertMessage,
  insertProposal,
  latestRun,
  listFocusAreas,
  listMessagesWithAttachments,
  listSignals,
  markOnboarded,
  readingsForSignal,
  recentDigest,
  setSignalStatus,
  sourcesForSignals,
  upsertFocusArea,
} from "../db";
import { getQuote, quoteLine } from "../market";
import { computeInvolvement, involvementLine } from "../portfolio";
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

If you're not sure where to start, just say so — I'll size up what kind of business ${name} is and suggest the value-investing questions with the most open debate, following the Buffett/Munger framework: name the moat's actual mechanism, read the incentives before the press releases, build the kill list (invert!), and check the psychology — management's and ours — against Munger's misjudgment checklist. Moat durability, franchise vs. commodity, owner earnings, capital allocation, management candor, red flags…

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
  userId: string,
  symbol: string,
  userText: string,
  opts: { retry?: boolean; attachments?: Attachment[]; signalId?: string } = {}
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

  const mode = ticker.onboarded ? "working" : "onboarding";
  const [focusAreas, active, suggested, dismissed, retired, run, quote, involvement] =
    await Promise.all([
      listFocusAreas(userId, symbol),
      listSignals(userId, symbol, "active"),
      listSignals(userId, symbol, "suggested"),
      listSignals(userId, symbol, "dismissed"),
      listSignals(userId, symbol, "retired"),
      latestRun(userId, symbol),
      getQuote(symbol).catch(() => null),
      computeInvolvement(userId, symbol).catch(() => null),
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
  const boardLines = (
    await Promise.all(
      active.map(async (s) => {
        const latest = (await readingsForSignal(s.id, 1))[0];
        const reading = latest
          ? ` Latest (${latest.date.slice(0, 10)}): ${latest.level}${latest.value != null ? `, ${latest.value} ${latest.valueUnit ?? ""}` : ""} — ${latest.rationale}`
          : " No readings yet.";
        const overlapNote = overlapWith.has(s.id)
          ? ` NOTE: investor knowingly kept this alongside "${overlapWith.get(s.id)}" despite overlap — if both keep reading the same evidence, propose ONE merged replacement.`
          : "";
        return `- "${s.name}" (${s.type}, ${s.focusArea}): ${s.measurementPlan}${reading}${overlapNote}`;
      })
    )
  ).join("\n");

  const positionLine = involvementLine(involvement);
  const deskContext = `DESK STATE (today: ${new Date().toISOString().slice(0, 10)}):
Market: ${quoteLine(quote)}
Investor's position in ${symbol}: ${positionLine || "none recorded"}${positionLine ? " — use only for margin-of-safety and exposure context; weigh the business on its merits, never bend readings toward the position." : ""}
Focus areas: ${focusAreas.length ? focusAreas.map((f) => `${f.title} — ${f.description}`).join("; ") : "none yet"}
Active signal board:
${boardLines || "(empty)"}
Pending proposals awaiting the investor's approval: ${suggested.map((s) => `"${s.name}"`).join(", ") || "none"}
Previously dismissed or retired signals (do NOT re-propose without materially new evidence): ${[...dismissed, ...retired].map((s) => `"${s.name}"`).join(", ") || "none"}
Research: ${run ? `last run ${run.startedAt.slice(0, 10)} (${run.status})` : "never run"}
${run?.brief ? `Latest daily brief:\n${run.brief}` : ""}`;

  // Signal-focused context: the one signal's full world, in depth.
  let signalContext = "";
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

${signalContext ? `${signalContext}\n\n` : ""}${modeInstructions}`;

  const history = (await listMessagesWithAttachments(userId, symbol, 40, { signalId: scopeId })).slice(-16);
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
    model: await resolveModel("chat"),
    system,
    messages,
    schema: CHAT_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: hasAttachmentBlocks ? 24000 : 16000,
    effort: "medium",
  });

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
    : "I processed that, but my written reply came back malformed — please ask again and I'll respond in full.";

  const message = await insertMessage(userId, symbol, "assistant", replyText, proposalIds, [], scopeId);
  const hasActive = (await listSignals(userId, symbol, "active")).length > 0;
  return {
    message,
    startResearch: hasActive && (out.startResearch === true || activatedDesk),
  };
}
