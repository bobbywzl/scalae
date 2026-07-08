# Scalae — Foundation

This is the canonical statement of what Scalae is for. Every feature, prompt, signal,
and agent behavior must trace back to this document. The agent doctrine in
[`lib/agents/framework.ts`](lib/agents/framework.ts) is the executable form of this
charter — when either changes, keep them in sync.

## Purpose

Scalae gives one investor, per ticker, the information network Warren Buffett had:
the hundreds of daily conversations he used for due diligence, recreated as an
orchestration of AI agents and distilled into a live desk. The name is the scale in
Ben Graham's law — *"in the short run, the market is a voting machine; in the long
run, it is a weighing machine."* Scalae exists to weigh the business, never to
handicap the vote.

The product is a **daily livestream of decision-relevant evidence**: what changed in
the business today, read through the Buffett/Munger value-investing framework, so the
investor's deep due diligence compounds instead of restarting every morning.

## The two anchors — every signal must touch at least one

Everything the desk tracks exists to answer two foundational questions about a ticker:

1. **Business model** — how does this company actually make money, and is that engine
   strengthening or weakening? Moat and its trajectory, pricing power, franchise vs.
   commodity economics, unit economics, owner earnings and capital intensity, capital
   allocation, competitive and regulatory position, balance-sheet resilience.

2. **Corporate culture** — how does this organization behave, and can it be trusted
   with the investor's capital? Management candor and promise-keeping, incentive
   structures, owner-orientation, resistance to the institutional imperative,
   treatment of customers/employees/partners (the seamless web of deserved trust),
   long-term versus quarterly orientation, founder-mindset and talent retention.

**A signal that cannot be traced — even loosely — to the business model or the
corporate culture does not belong on a Scalae board.** Out of scope by construction:
chart patterns, price targets, analyst-rating chatter, fund flows, meme sentiment,
short-term macro noise. Price enters only where the framework needs it (buyback
economics, margin of safety, deal currency).

## The board is a curated instrument panel, not a feed

- **Every signal earns its place.** Before any signal is proposed — by onboarding,
  by chat, or by the daily research loop — it must be checked against the desk's
  existing signals: active, pending, retired, and dismissed. A proposal that overlaps
  significantly in *what it measures* with an existing signal is a duplicate, even
  under a different name, and must not be made.
- **Refine, don't duplicate.** When new evidence suggests an existing signal is
  aimed slightly wrong, the desk proposes sharpening or replacing it — explicitly,
  by name — rather than adding a near-twin beside it.
- **Rejected ideas stay rejected** unless materially new evidence emerges, and any
  re-proposal must say what changed.

## Human sovereignty

Nothing the agents devise becomes active without the investor's explicit approval.
Signals, focus areas, and tracking systems are proposed, argued for, and then gated
on a human decision. The investor's chat feedback steers the next day's research.

## Self-reinforcing discovery

The desk is not a static dashboard. Each daily run may surface a small number of new
candidate signals discovered in the evidence — threads the current board misses that
better illuminate the business model or culture. This loop is what makes the desk
smarter every day; the two anchors and the no-duplication rule are what keep it from
sprawling.

## Evidence discipline

Never fabricate. Every factual claim traces to a source; missing evidence lowers
confidence and is said plainly; disconfirming evidence leads, not trails. An honest
"no signal" beats a confident guess.
