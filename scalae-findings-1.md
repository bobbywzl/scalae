# Scalae findings — loop 1 (AUTOLOOP-SCALAE)

Run date: 2026-08-04 · Branch `claude/autoloop-recommended-output-odq5s6`.
Modes run this loop: DEEP AUDIT (lenses: evidence honesty · approval gates ·
anchors/duplicates · cost enforcement · portfolio truth · bilingual · feature
fit) + SIMULATE limited to unauthenticated live surfaces (auth wall — see
"Simulation status" at the end). Every finding carries how it was verified.
Ranked by impact on the charter's goal: *diligence compounds instead of
restarting every morning.*

---

## 1 · The standing dossier is regenerated blind every run — the "standing thesis" cannot actually stand

**The moment.** Walt (P2) opens his COST desk on day 12. "The business, as the
desk reads it" reads differently than yesterday — same facts, reshuffled
sentences — and the provenance line always says *revised today*, never
"held for 6 runs". The thesis looks like it moves daily; he stops trusting it
as a record and re-reads it from scratch each visit. That is diligence
restarting every morning, in the product's own centerpiece.

**The charter.** README: *"a live 150–300-word synthesis … **updated only where
evidence moved**"*; synthesis prompt itself: *"keep the rest stable so the
investor sees a consistent thesis evolving, not a rewrite"*; FOUNDATION bans
manufactured movement (*"a desk that manufactures daily movement is
mis-specified"*).

**The code.** The synthesis task (`lib/agents/research.ts:823-850`) includes the
board, questions, guidance, context board and sweeps — but **never the previous
dossier text** (grep confirms: the only dossier references in the file are the
output handling at `lib/agents/research.ts:934-940` and the instruction at
`:847`). The model is ordered to keep stable a text it cannot see. The UI's
honesty surface — `dossierRevisedAt` / `dossierHeldRuns`
(`app/api/tickers/[symbol]/route.ts:100-110`) — compares dossiers by **exact
string equality**, which blind regeneration defeats; "held for {n} runs"
(`lib/i18n/dict/desk.ts:58-59`) is therefore near-unreachable.

**Verified.** Code-read of the full synthesis prompt construction + grep for any
previous-dossier fetch (none); provenance equality check read directly.

**Fix direction.** Include the previous dossier verbatim in the task with:
"reproduce unchanged paragraphs **verbatim**; edit only sentences today's
readings moved; re-cite edited sentences against today's numbered sources."
The equality-based provenance then becomes meaningful for free. (Bonus: on
no-new-evidence runs, skip regeneration entirely and carry the dossier row
forward — cheaper and provably stable.)

---

## 2 · Citation identity is an opaque redirect token — the evidence layer can't tell one source from two

**The moment.** Walt clicks three source chips. Two different chips [3] and
[17] under one brief sentence open the *same* Reuters article — the desk
presented one datum as two corroborating sources. A month later, half his
catalog's links 404 (expired redirects). Both are instant-churn triggers for
the persona whose trust is the product's whole pitch.

**The charter.** SYNTHESIS_DOCTRINE (`lib/agents/framework.ts:373`): *"many
signals citing the same single source is one datum wearing costumes, not a
confluence"* — the code's own words. FOUNDATION: citations real and clickable;
the catalog *"grows across runs"* and every source is traceable.

**The code.** Scout sources are stored exactly as Gemini grounding returns them
— `vertexaisearch.cloud.google.com/grounding-api-redirect/…` tokens
(`lib/ai/gemini.ts:80-85`; acknowledged in `lib/citations.ts:4-7`). Everything
downstream keys identity on that URL:
- run-level dedup + numbering `lib/agents/research.ts:777-790` — the same
  article surfaced by two parallel sweeps (separate API responses) can mint two
  tokens → numbered twice → false "[3][17]" corroboration;
- the per-signal evidence catalog dedup `lib/db.ts:735-746` — the same article
  cited across runs accumulates as distinct entries;
- `citationOverlap` (Jaccard on URLs, `lib/compare.ts:94-106`) — cross-run
  same-source citations don't match, so the keep-both **merge escalation**
  (`lib/agents/research.ts:537-563`, ≥0.5 threshold) systematically underfires;
- redirect links expire on Google's side (~weeks), rotting the catalog.

**Verified.** Storage/identity paths code-read end-to-end. Token-per-response
behavior and redirect expiry are Google-documented provider behavior, not
reproduced live this run (no GEMINI key in the loop sandbox) — treat magnitude
as to-be-measured, mechanism as certain.

**Fix direction.** Resolve redirects server-side at capture (single HEAD/GET
follow, cached), store `{url: resolved, redirectUrl, domain}`; key dedup,
catalog identity and `citationOverlap` on the resolved URL with a
title+domain fallback. Old rows keep rendering via the stored `domain` field.

---

## 3 · A long-idle desk silently researches only the last 14 days and presents itself as current

**The moment.** Marcus (P4) pauses auto-research in November, comes back in
January, hits Run. The desk sweeps 14 days, reads mostly "No new information
this run," and the brief never says *"I did not look at the six weeks in
between."* His December risk (a proxy filing, a CFO exit) is permanently
unswept — and unflagged.

**The charter.** *"Never fabricate… missing evidence lowers confidence and is
said plainly"* (FOUNDATION, Evidence discipline); honest carry-forward is the
core of the credibility loop.

**The code.** `windowDays` caps every sweep window at 14 days
(`lib/agents/research.ts:202-207`, `Math.min(14, …)`); all wave-1 prompts take
that `days` value; nothing in the synthesis task tells the model — or the
investor — that the actual gap exceeded the window. (The primary-source sweep's
"slightly older" allowance, `:251`, softens but doesn't disclose.) The cron's
adaptive cadence caps at ~3 days (`lib/cadence.ts:31-36`), so this bites
exactly the paused/returning desks — the auto-research switch's own users.

**Verified.** Code-read; arithmetic checked against cadence and the
pause path (`autoResearchEnabled`, `lib/db.ts:1114-1116`).

**Fix direction.** Compute `gapDays` alongside `windowDays`; when
`gapDays > windowDays`, (a) append one task line requiring the brief to state
the uncovered span plainly, and (b) optionally commission one catch-up sweep
("material developments between ⟨date⟩ and ⟨date⟩"). A few lines; pure honesty.

---

## 4 · Focus areas write themselves onto the desk — the one surviving bypass of the human gate

**The moment.** Priya (P1) chats idly about supply chains; next visit her desk
shows a "Supply chain resilience" focus area she never approved — and there is
no way to remove it.

**The charter.** FOUNDATION, Human sovereignty: *"**Signals, focus areas,** and
tracking systems are proposed, argued for, and then **gated on a human
decision**."* Focus areas are named explicitly.

**The code.** Model-emitted `focusAreas` are upserted unconditionally on every
chat turn (`lib/agents/chat.ts:600-602`); a proposal naming an unknown focus
area silently creates it too (`lib/agents/chat.ts:606-611`) — and it **persists
even if that proposal is dismissed**. No delete/edit route for focus areas
exists (`focus_areas` is only cleared by ticker removal, `lib/db.ts:527`), so
the accretion is irreversible in the UI. All other write paths audited this
loop hold the gate (see "Verified clean" below).

**Verified.** Code-read of both write sites; route grep confirms no focus-area
CRUD endpoint; research pipeline confirmed not to create areas
(`insertProposal`, `lib/db.ts:611-638`, writes only the signal row).

**Fix direction.** Cheapest honest fix: create a focus area only when a signal
belonging to it is **approved** (derive areas from the approved board), and add
a delete affordance for empty areas. Fuller fix: park `focusAreas` in the same
approval queue as signals.

> **Shipped (loop 1 fix round, owner-picked).** Areas now materialize at signal
> activation (`setSignalStatus` → `ensureFocusArea`); chat persists an emitted
> area only when this turn's proposals or existing signals reference it;
> orphaned areas render as removable empty groups backed by a guarded DELETE
> route (`/api/tickers/[symbol]/focus-areas`). Re-observe next loop.

---

## 5 · The paper ledger misses fills a real broker would have made — and undercharges shorts on dividends

**The moment.** Marcus places a GTC limit buy Tuesday night; Wednesday the
price dips through his limit and recovers; he opens Scalae on Sunday — order
still "working". A real book would hold the shares. His P&L no longer
reconciles with the counterfactual he is paper-testing, which is the feature's
entire purpose.

**The charter.** Portfolio-truth lens: any path where the ledger lies. (The
in-code comment `lib/orders.ts:18-26` honestly owns "no guarantee your broker
would fill the same" — but missing multi-day crossings is a different class
from intraday slippage.)

**The code.** Fills are only checked against the **current** quote on portfolio
load / order placement (`lib/orders.ts:59-75`): a crossing that happened while
the app was closed never fills unless still true at next open; day orders
placed yesterday expire unfilled even if yesterday's session crossed them
(`:65-67`). Dividends: `applyDividend` applies withholding to *negative*
(short) amounts too — `net = amount × (1 − w/100)` (`lib/orders.ts:191-192`) —
reducing what the short owes; brokers charge shorts gross payment-in-lieu.

**Verified.** Code-read of sweep, fill and dividend paths; `fillDecision`
consumers checked (`lib/order-math.ts` semantics not re-derived line-by-line —
fill-price policy there should be re-checked when fixing).

**Fix direction.** Sweep open orders from the daily cron against day **ranges**
(high/low from `getDailyCloses`' provider), filling at limit/stop price with
the crossing date; charge shorts gross (skip withholding when `amount < 0`).

---

## 6 · Stop and stop-limit orders are voting-machine instruments inside the weighing machine (feature-fit — fix or delete)

**The felt mismatch.** The product's first principle is *"weigh the business,
never handicap the vote"*; price is admitted *"only where the framework needs
it (buyback economics, margin of safety, deal currency)"* (FOUNDATION). A
**limit** order is the margin of safety operationalized — buy at your price.
A **stop** order is its inversion: *act because the price moved* — the reflex
Graham built the whole edifice against, and Buffett explicitly refuses ("we
don't use stop losses"). The ticket even offers one-tap **52-week-low/high
anchors** for stop prices (README §"Trade with your position in view") —
chart-pattern furniture the charter bans from boards, now teaching
price-reaction in the trading surface.

**The code/UI.** Order types market/limit/stop/stop-limit with price anchors
(`components/TradeForm.tsx`, `lib/order-math.ts`; README §Brokerage-style
order ticket).

**Recommendation (under the expanded mandate: fix or delete misfit features).**
Delete `stop` / `stop-limit` from the ticket (keep market/limit; past stop
fills can still be recorded via "Record past trade"), and drop the 52-week
anchors for trigger prices. If any stop support is kept, quarantine it behind
copy that names it a mechanics-simulation, not a method the desk endorses.
This is a product decision — parked for the owner's pick, like everything else.

---

## 7 · The auto-research switch is server-enforced for the cron but only client-honored on desk-open (README overclaims)

**The code.** Cron: enforced per-user server-side
(`app/api/cron/daily/route.ts:30-31`) ✓. Desk-open auto-run: the client checks
`desk.autoResearch` (`app/t/[symbol]/signals/page.tsx:200-215`) and the run
route (`app/api/tickers/[symbol]/run/route.ts`) never consults the switch — any
POST starts a run. README §Auto-research switch says both are
*"(server-enforced)"*. Today the claim is half true; a stale tab or any direct
POST spends tokens the switch promised to hold.

**Verified.** Code-read both paths; live deployment probed: `/api/cron/daily`
returns **401** (CRON_SECRET is set in prod — the optional-secret concern was
adversarially refuted and is *not* a finding).

**Fix direction.** On-open effect sends `{auto: true}`; the route refuses
auto-tagged runs when the switch is off (explicit asks unchanged). ~10 lines.

---

## 8 · A "new evidence" reading can store zero verifiable citations without any flag

**The code.** Out-of-range `citationIndexes` are (rightly) filtered before
storage (`lib/agents/research.ts:886-888`, `:1300-1302`), but nothing reacts
when the filter leaves a `newEvidence: true` reading with an **empty** evidence
map — it renders as confident movement with no chips. The charter's line is
*"missing evidence lowers confidence and is said plainly."*

**Fix direction.** Server-side guard at insert: `newEvidence && citations
.length === 0` → clamp confidence (e.g. ×0.5) and append "(sources could not
be verified this run)" to the rationale — or flip the reading to carry-forward.
Five lines; closes the last gap between "cannot fabricate links" (already true)
and "cannot present unevidenced movement as evidenced".

> **Shipped (loop 1 fix round, owner-picked).** Guard live at both
> `insertReading` sites (board run + single-signal check): confidence halved
> and the shortfall stated in the stored rationale. Re-observe next loop.

---

## Verified clean this loop (do not re-audit; re-observe after fixes only)

- **Cleansing bench gates hold in code, not just prompt**: research-derived
  proposals force-park regardless of `applyNow`
  (`lib/agents/cleansing.ts:611-621`); transitions are status-guarded SQL
  (`lib/db.ts:1590-1611`); audit log append-only.
- **Diligence record gates hold**: memos park pending; accept is
  create-note-then-flip with concurrency guard
  (`app/api/diligence/research/[id]/route.ts:48-67`); section suggestions are
  ephemeral chips (`lib/agents/diligence.ts:449-501`).
- **Carry-forward renders honestly**: `newEvidence:false` readings show muted
  and italic (`components/SignalDetail.tsx:455,738,763`).
- **No fabricated links possible in briefs**: unresolvable `[n]` stay plain
  text (`lib/citations.ts:171-180`); confidence clamped 0..1
  (`lib/agents/research.ts:897`).
- **Bilingual negotiation verified live**: `Accept-Language: zh-CN` →
  `<html lang="zh-CN">`, fully translated signin copy; EN unaffected
  (curl probe, 2026-08-04). Canonical-English storage + display-translation
  architecture confirmed in code (`lib/i18n/translate.ts`).
- **Live cron protected**: `/api/cron/daily` → 401 in production.
- **Chat desk-actions**: approvals/retire/dismiss execute only against
  server-validated existing names (`lib/agents/chat.ts:616-635`) and the
  investor's-ask gate is the documented product design (README §Full-agency
  analyst desk) — prompt-gated by construction, with Undo affordances.

## Cheapest high-leverage moves, in order

1. **#3 window-gap honesty line** — a few lines in `executeRun`; pure trust win.
2. **#8 unevidenced-movement guard** — ~5 lines at `insertReading` call sites.
3. **#7 auto-flag on the run route** — ~10 lines; makes README true.
4. **#1 pass the previous dossier into synthesis** — one prompt block + verbatim
   rule; unlocks the whole longitudinal promise (and #1 makes the existing
   provenance UI meaningful at zero extra cost).
5. **#5b dividend short-charge fix** — one condition in `applyDividend`.
6. **#4 focus-area gate** — derive-from-approved-signals + delete route.
7. **#2 redirect resolution at capture** — ~a day; fixes catalog identity,
   merge escalation and link rot in one move.
8. **#5a cron-swept range fills** — half day, needs range data plumbing.
9. **#6 stop-order removal** — product decision first, small diff after.

## Simulation status (honest scope note)

Authenticated persona runs are **blocked by the auth wall**: prod uses Google
OAuth only. This loop built the unblocking infra on the branch —
`app/api/auth/test-login/route.ts` (sealed unless `TEST_LOGIN_TOKEN` is set;
isolated `scalae-test-persona-<n>@test.scalae.app` accounts; refuses the
first-account/admin seat) and `persona.md` (four personas). To enable full
SIMULATE mode next loop: deploy this branch (or merge) **and set
`TEST_LOGIN_TOKEN` in Vercel (Preview scope is enough for the branch URL)** —
then remove the token when the run ends. Unauthenticated surfaces (landing,
signin, language negotiation, cron guard) were probed live this loop.
