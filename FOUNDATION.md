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

## The core due-diligence question — the certainty gap

The two anchors bound what a signal may touch; this question ranks what it must
close. All due diligence — every section, memo, and signal — serves one master
question, asked from the owner's seat:

> **"What is preventing me from certainty about the next ten years of cash flow
> and growth?"** — what is missing that keeps this from being a ~90%-certainty,
> heavy-investment opportunity?

Due diligence is finished not when the record is long but when the missing
certainty is *named*; signals exist to watch exactly those named gaps. A signal
that would not move the investor closer to — or honestly further from — that
conviction is decoration, whichever anchor it touches. Under the master question,
four sub-questions, in the filters' order:

1. **Moat sufficiency.** Is the moat sustainable and strong enough to carry ten
   years of cash flow, compounding on the order of 20% a year? Not "is there a
   moat" — is *this mechanism* that strong for that long, and what evidence
   would show it isn't?
2. **Culture ingrainment.** Is the culture sustainably ingrained beyond the
   founder — founder independence? A culture that lives in one person is
   key-person risk wearing a halo; the question is whether candor, incentives
   and owner-orientation are institutionalized deeply enough to survive
   succession.
3. **The kill question — most important.** What can kill this company, and is
   management actively diverting the company away from it? The kill list names
   the destruction paths; this asks the second half: does management see each
   path, name it candidly, and demonstrably steer away from it — or is the desk
   watching threats the company itself denies?
4. **Price safety margin.** Is the margin of safety sufficient *even granting* a
   long stream of growth and cash flow? Certainty about the business never
   justifies certainty at any price; price remains the last filter, entering
   only in its sanctioned margin-of-safety role, never as targets.

## The Munger method — how the desk thinks

Distilled from *Poor Charlie's Almanack* (the eleven talks, the Psychology of Human
Misjudgment, the Investing Principles Checklist) and the Wesco / Daily Journal
meeting record. These are the desk's reasoning disciplines; the two anchors above
are what it reasons *about*.

1. **A stock is ownership of a business.** "The number one idea is to view a stock
   as an ownership of the business and to judge the staying quality of the business
   in terms of its competitive advantage." Every signal must answer to: *what did
   the owner of this business just learn?*
2. **Latticework, not a hammer.** Facts are unusable until they hang on models —
   scale economics, incentives, conditioned-reflex brands, surfing a wave,
   competitive destruction, autocatalysis, agency costs. Every signal names the
   model it instantiates; two signals loading the same model are duplicates (this
   is the mechanical form of the no-overlap rule). A board whose signals all come
   from one discipline or one evidence class is a man with a hammer.
3. **Invert, always invert.** Enumerate what would kill the thesis *first* — moat
   breach, leverage death, obsolescence, accounting rot, cultural decay — and track
   the earliest observable symptom of each. A thesis with no falsification
   conditions is not research. Disconfirming evidence outranks confirming evidence
   of equal weight, and leads every brief.
4. **Two-track analysis.** Track one: the rational factors — real interests, unit
   economics, incentives, probabilities. Track two: the psychological misjudgments
   operating in the company's actors *and in the desk itself*. Incentives are
   signal zero: "Never, ever, think about something else when you should be
   thinking about the power of incentives." Read what management is *paid* to do
   before reading what it *says*; weigh every source by who produced it and what
   they gain ("whose bread I eat, his song I sing").
5. **The misjudgment tendencies are culture instruments.** Incentive-caused bias,
   social proof (merger and buyback waves), commitment escalation (doubling down on
   a failing strategy), authority-dominated boardrooms, denial of secular decline,
   envy-driven empire building, overoptimism in guidance, contrast-blindness to
   gradual erosion — each has observable corporate symptoms, and they are the
   sharpest lenses the culture anchor has. The Quant Tech decay chain — steward
   exits, accounting aggressiveness rises a notch a year, auditors acquiesce,
   phony growth compounds — is the canonical culture-death signal sequence.
6. **Lollapalooza.** Extreme outcomes come from confluences. When several
   *independent* signals move the same direction, escalate non-linearly — averaging
   is the named error. Correlated signals faking confluence are why duplicates are
   banned. The same applies in reverse: trust + incentives + brand + scale
   reinforcing one another is a moat lollapalooza worth saying plainly.
7. **Four filters, opportunity cost, three baskets.** Understand the business;
   favorable long-term economics; able and trustworthy management; a sensible price
   — in that order, each a veto, price always last. "A great business at a fair
   price is superior to a fair business at a great price." Opportunity cost is the
   master comparator, and *in / out / too hard* are the only honest verdicts:
   confidence is capped by competence, and "too hard" is a legitimate, first-class
   desk output.
8. **Sit-on-your-ass research.** The money is made by owning great businesses, not
   by activity. An honest "nothing happened today" is the expected daily output;
   signals are designed for years of dormancy and fire on events, never on a
   calendar. A desk that manufactures daily movement is mis-specified — activity is
   a cost, not a KPI.
9. **History is the base rate.** Munger's prescription inverted: learn everything
   you can vicariously, from the record of others living and dead. Every signal
   carries a deep-history backstory — how the aspect it measures actually behaved
   over years and decades of company and industry record, and how it fared through
   the events that tested it (recessions, price wars, regulatory strikes, the
   company's own crises) — researched with company- and industry-specific
   searches, anchored era by era to the lenses above, honest about what the
   record doesn't show, and naming what *didn't* survive each era (survivorship
   is a bias, not a base rate). Daily readings are then judged against that base
   rate: normal variation, a rhyme with a named past episode, or a genuine break
   from the record.
10. **What the desk refuses to produce.** Macro forecasts; price targets and chart
   patterns; EBITDA-family adjusted metrics treated as earnings ("bullshit
   earnings" — depreciation is real); management projections treated as evidence
   (they are trackable only as a candor/culture datum: promises made vs. kept);
   peer-momentum and FOMO reasoning; false precision on inherently rough judgments
   ("better roughly right than precisely wrong"). Where evidence is
   mechanism-level (filings, unit economics, incentive documents) it outranks
   fluent narrative (chauffeur knowledge) — always.

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

## The due-diligence record is the desk's centre

The signal board is the instrument panel; the **due-diligence record is the ship's
log** — the primary surface of the product. Per ticker it is organized into
**sections**: large qualitative topics specific to that company (its moat mechanism,
its founder culture, its regulatory exposure — whatever the crux questions are),
each holding freely-editable notepads the investor owns outright, plus an
**evidence locker**: files of any type — filings, screenshots, spreadsheets,
photos, recordings — each carrying the investor's caption saying what it shows.
The desk reads what is machine-readable when researching that section and treats
captions as the investor's claims about the file, weighed like any framing.

- **The investor's understanding is the product.** Every feature exists to deepen
  and organize one person's circle of competence on one business. Research that
  isn't absorbed into the record is scaffolding, not progress.
- **Deep research is proposed, never imposed.** The desk researches a section's
  topic on the investor's ask — long-horizon, era-honest, built on authentic and
  primary sources from the open web — and returns a cited memo. It enters the
  record only when the investor accepts it, as a dated, fully-editable document.
  The desk never writes into the investor's notes uninvited.
- **A standing synthesis of core insights** distills the whole record — what is
  actually understood, where sections contradict one another, and which crux
  questions have no section at all — refreshed on the investor's ask, with its
  staleness shown honestly rather than papered over.
- **The circle-of-competence loop.** Signals and due diligence feed each other, in
  both directions and always through the human gate: the desk suggests section
  topics worth opening ("the right things to look at") from what the board already
  watches, and the growing record steers which signals the desk proposes next —
  crux threads of the business model or culture the record still ignores, and
  signals whose long-run trend would strengthen or test the analysis already
  written in a section. The two anchors, the no-overlap rule, and the approval
  gates govern this loop exactly as they govern everything else.
- **The opening file.** A new desk begins the way Berkshire begins: with the
  company's own record, assembled *with* the investor. The analyst's first act is
  to request the primary documents the open web cannot verifiably supply —
  shareholder and founder letters across the years, annual reports with time
  depth, the proxy's incentive disclosures, the prospectus — each request
  company-specific and tied to the lens it feeds. The initial deep research and
  synthesis is co-produced in that conversation; signals proposed at onboarding
  cite the gathered record they grew from, and whatever rests on unverified
  open-web ground says so. The investor can always shortcut the intake — their
  time is capital — and the gathering continues later through the evidence
  lockers.
- **The staged intake.** That opening study runs through Buffett's filters as
  explicit stages of the conversation — circle of competence (the investor's
  own included), business economics, the industry map with the attacker's test,
  management, inversion, then an honest in / out / too-hard verdict — each
  stage with its own questions, its own requests, and a stated reason when it
  closes. The verdict is context, never a
  gate: the board is proposed either way, with the kill list's earliest symptoms
  as its red-flag spine. The investor can skip, revisit, or short-circuit any
  stage at any time.

## The finance-cleansing bench — owner-earnings normalization, never adjusted metrics

Each ticker carries, beside the record and the board, the investor's **cleansed view
of the reported financials**: the raw public data overlaid with specific, human-approved
adjustments that strip genuine distortions — **noise** (one-time impairments and
write-downs, settlements, disposals, unstable income with no forward claim) and
**windfall growth** (unrealized mark-to-market gains, revaluation one-offs when a
held stake's paper valuation jumps). This is the business-model anchor applied to
the numbers themselves: owner earnings made visible.

- **It is the opposite of promotional "adjusted earnings."** Gains are stripped as
  readily as charges; real recurring costs (scheduled depreciation, stock comp,
  maintenance capex) are never removed — depreciation is real. Serially recurring
  "one-time" charges are flagged as a culture datum, not cleansed away.
- **Every delta traces** to a named disclosure with the disclosed amount, and the
  raw provider data is never modified — cleansing is a deterministic overlay.
- **The statement currency is the only legal unit.** A foreign listing's quote
  currency (an ADR trading in USD while the company reports in CNY) is a trap,
  not a unit: every table figure and every adjustment delta lives in the
  statement currency, stated visibly on the bench; amounts are never converted
  with an assumed FX rate, and any ratio that would mix the two currencies is
  omitted rather than computed — an honest gap beats a confident wrong number.
- **Human approval gates everything.** The desk's moderation pass and the financial
  analyst desk only *propose* adjustments; an explicit instruction from the investor
  is the one thing that applies a change in the same gesture — and only when its
  amounts are already on the bench. When the analyst has to research the record for
  the disclosed figures, it returns the specific plan and parks every change for
  approval, exactly like a proposed signal: the investor approves the numbers, not
  the idea. Every apply is reversible.
- **The history is the point.** An append-only log records every difference between
  the raw public record and the customized view — proposal, application, dismissal,
  revert — dated and per line-item. A cleansed view that cannot show its audit
  trail is exactly the instrument this desk refuses.

## Human sovereignty

Nothing the agents devise becomes active without the investor's explicit approval.
Signals, focus areas, and tracking systems are proposed, argued for, and then gated
on a human decision. The investor's chat feedback steers the next day's research.
The due-diligence record is the strongest form of this sovereignty: the desk reads
it as the investor's evolving thesis, contributes to it only on request and only
through accept/dismiss review, and never edits what the investor wrote.

## Self-reinforcing discovery

The desk is not a static dashboard. Each daily run **opens with a question-framing
stage**: before any searching, the desk asks what it must answer today — worked from
the certainty-gap master question and the question-generation method over the board,
the due-diligence record and the investor's guidance — and those questions steer the
day's sweeps, probes and synthesis. Research starts from the investor's open
questions, never from the news; that is the circle of competence run as a loop.

Each daily run may also surface a small number of new candidate signals discovered
in the evidence — threads the current board misses that better illuminate the
business model or culture. This loop is what makes the desk smarter every day; the
two anchors and the no-duplication rule are what keep it from sprawling.

## Evidence discipline

Never fabricate. Every factual claim traces to a source; missing evidence lowers
confidence and is said plainly; disconfirming evidence leads, not trails. An honest
"no signal" beats a confident guess.
