# Scalae findings — loop 2 (AUTOLOOP-SCALAE · tool interactions)

Run date: 2026-08-12 · Branch `claude/tool-interactions-visualizer-0i8143`.
Mode this loop: DEEP AUDIT focused on **the seams between tools** — defects that
only appear when two surfaces touch the same data (chat ↔ board ↔ runs, clip ↔
notepads, annotations ↔ regenerated text, portfolio ↔ verdicts, cleansing ↔
financials, i18n ↔ everything). Three parallel audit passes covered the seam
clusters; every finding below was then re-verified against the code by hand
before any fix shipped. Ranked by impact on the charter's goal: *one connected
desk whose record compounds and never lies*.

Fixes marked **⚡ SHIPPED (this loop)** are on this branch; **⏸ PARKED** items
need an owner decision or a bigger migration and carry a concrete direction.

---

## 1 · The desk's memory of every conversation silently ends at message 40 — the analyst answers last month instead of you

**The moment.** A desk with a long-running conversation: the investor asks a
question and the analyst responds to a topic from weeks ago. Worse, the chat
panel itself freezes — new messages stop appearing entirely (the panel shows
the oldest 200 forever). And "chat feedback steers tomorrow's research"
(FOUNDATION, Human sovereignty) quietly stops being true — the steering sweep
reads six of the *oldest* messages.

**The code.** `listMessagesWithAttachments` ordered `ASC … LIMIT` in all three
scope branches (`lib/db.ts`), returning the **oldest** N rows. Consumers: the
model context (`lib/agents/chat.ts` — `limit 40` then `.slice(-16)`, so past 40
messages the just-inserted user turn never reaches the model, and the
fast/deep lane routing keys off an ancient "last user message"), the desk
payload (`limit 200` → the UI), the signal-chat GET, and research steering
(`.slice(-6)`). The neighboring `recentMessages` documents this exact trap in
its own comment and does it right.

**⚡ SHIPPED (this loop).** All three branches now select the NEWEST N in a
DESC-limited subquery re-sorted chronologically — every consumer (model
context, panels, steering) gets recency with unchanged ordering semantics.

---

## 2 · The desk forgets its thesis the moment it starts thinking — and the research window never adapted at all

**The moment.** During every run (minutes, exactly when the investor is
watching), every reader of "the latest run" got the *running* row — whose
brief and dossier are null. Compare weighed a mid-run desk as *"(no dossier
yet — this desk's research has not produced a standing thesis)"* and tilted
the verdict; the analyst chatted without the dossier/brief in context; the
diligence topic-suggester lost the dossier too.

Separately — and worse than loop 1's finding #3 diagnosed — the adaptive
research window was **dead code**: `startRun` inserts this run's row *before*
the pipeline reads `windowDays`, and `latestRun` had no status filter, so it
returned the just-created running row (`finishedAt: null`) and the window
short-circuited to a constant 7 days. A desk paused for six weeks was swept 7
days deep and presented itself as current — the exact dishonesty FOUNDATION's
evidence discipline forbids.

**The code.** `lib/db.ts` (`latestRun` — no status filter), consumed by
`lib/agents/research.ts` (windowDays), `lib/agents/comparison.ts`,
`lib/agents/chat.ts`, `lib/agents/diligence.ts` (×2).

**⚡ SHIPPED (this loop).** New `latestDoneRun` (status='done'); every
decision-reader swapped to it (compare, chat context, diligence synthesis +
suggestions, the window). `researchWindow` now returns the true `gapDays`
since the last completed run, and when the gap exceeds the (still 14-day-
capped) window, the synthesis task carries a **COVERAGE HONESTY** block
requiring the brief to name the unswept span in one plain line — loop 1's
cheapest-move #1, now closed at its actual root. The desk page's `latestRun`
read stays as-is deliberately: the run banner needs the running row.

---

## 3 · A signal retired mid-run kept accruing evidence dated after its retirement

**The moment.** The investor (or their analyst, on their ask) retires a signal
while the morning run is at "probing". Minutes later the archive shows the
retired signal carrying a brand-new reading — evidence manufactured for an
instrument the desk was told to stop watching. The trailing backstory backfill
could likewise spend a research call enriching a signal that no longer exists
on the board.

**The code.** `executeRun` snapshots the board once, then writes readings from
the snapshot with no status re-check (`lib/agents/research.ts` recording loop);
`insertReading` was an unconditional INSERT (`lib/db.ts`). The scoped
per-signal pipeline re-checks; only the board run was unguarded.

**⚡ SHIPPED (this loop).** `insertReading` is now a status-guarded
`INSERT … SELECT … WHERE EXISTS (signal active)` returning null on skip —
atomic, covers every caller. The backstory backfill re-reads each signal's
status before spending the call.

---

## 4 · The human gate could run backwards: approve was an unconditional flip (and twins are still possible)

**The moment.** A proposal dismissed in the UI a second earlier could still be
approved into `active` from chat's slightly-stale name list — a dismissal
silently reversed by an agent. The single-signal route approved *any* status;
only the bulk route checked.

**⚡ SHIPPED (this loop).** `approveSignal` is now a guarded atomic flip
(`WHERE status='suggested' RETURNING`), reports `approved: boolean`, and only
materializes its focus area / retires its replacement / marks onboarding on a
real flip. Chat and the single route consume the flag.

**⏸ PARKED — the twin-insert race.** Two concurrent writers (chat turn +
run synthesis) can still both pass `insertProposal`'s check-then-insert and
seat duplicate proposals: there is **no unique index on signals**. Direction:
`CREATE UNIQUE INDEX … ON signals("userId", symbol, lower(name)) WHERE status
IN ('suggested','active')` + `ON CONFLICT DO NOTHING` — needs a one-off dedup
migration over existing rows first, so it's an owner-scheduled change. Same
family: a partial unique index on `runs("userId", symbol) WHERE
status='running'` would close the double-POST run race (`runningRun` →
`createRun` is check-then-insert).

---

## 5 · The signal-scoped chat had the whole board's keys in its pocket

**The moment.** Inside one signal's focused desk, a retire-shaped sentence
could retire a *different* signal entirely — the scoped analyst's action loops
resolved names against the full ticker, with only prompt text holding the
lane. And asking "check this now" in a signal's chat kicked off a **full
board run** (multi-sweep spend, desk surfaces rewritten), not the scoped
check the button next to it runs.

**The code.** `lib/agents/chat.ts` action loops (no scope filter);
`app/api/signals/[id]/chat/route.ts` calling `startRun`/`executeRun`.

**⚡ SHIPPED (this loop).** Server-side write-scope rule (FOUNDATION: "each
surface writes only to its own board"): a scoped chat may retire only its
signal and approve/dismiss only proposals that replace it. The scoped route's
research ask now runs `startSignalRun`/`executeSignalRun`.

---

## 6 · "✚ track this" promised a draft signal and usually delivered a chat reply

**The moment.** The evidence feed's track-this button routes through the chat
fast lane — whose schema has **no proposals field**. Unless the value-tier
model chose to escalate, the promised draft was silently impossible: a
friendly reply, an empty queue, no error.

**⚡ SHIPPED (this loop).** Track-this turns carry `deep: true` →
`handleChatTurn` skips the fast lane (`forceDeep`) and starts on the senior
analyst, whose schema can actually draft the proposal. (The gate is
unchanged: the draft still parks for approval.)

---

## 7 · Clip to notes: the clip was invisible on an open record page — and one keystroke erased it

**The moment.** Clip an evidence item into a notepad from the signals desk
while the record page is open elsewhere (the intended workflow). The notepad
card holds mount-time state: the poll delivers the clip and the card shows the
stale copy — an empty notepad keeps saying "empty" while the clip sits in the
database. Type one character in that stale card and the debounced whole-
content autosave commits the **pre-clip** document: the clip is gone, and the
header says "saved just now".

**The code.** `NotepadCard` (`app/t/[symbol]/dd/page.tsx`): state initialized
once from props, no resync; whole-content last-write-wins PATCH.

**⚡ SHIPPED (this loop).** A clean card (read mode, nothing pending) now
adopts the server copy whenever `updatedAt` moves — the clip appears on the
next poll, and the stale-overwrite path is closed for every card not actively
being edited. Same class, same fix: evidence-caption edits now flush on
unmount instead of dying with the debounce timer.

**⏸ PARKED — the full fix.** An *open editor* can still overwrite a clip that
lands mid-edit (same note, same 30 seconds — rare but real). Direction:
optimistic concurrency — PATCH carries the `updatedAt` it read; `updateNote`
guards `WHERE "updatedAt" = expected`; 409 → re-fetch, replay local edits (a
clip is append-only, so merge is safe), or surface "this notepad changed
elsewhere". The clip route's own read-modify-write wants the same guard.

---

## 8 · The investor's P&L was whispering to the referee

**The moment.** Compare weighs A (up 47%) against B (down 12%) — and the
verdict prompt contained both P&Ls with **no** unbias guard, under a doctrine
that says "use ONLY the snapshots" (which the position line is part of). The
chat fast lane — the default path for most working turns — carried the same
bare position line, while the deep lane's version has carried a guard all
along. That's the disposition effect wired into the referee's briefing.

**The code.** `lib/agents/comparison.ts` (bare `Investor's position:` line),
`lib/agents/chat.ts` `quickContext` (guard present only in deep context).

**⚡ SHIPPED (this loop).** The guard now travels with the position everywhere
it goes: shared guard suffix in both chat contexts, an exposure-context-only
clause on the compare snapshot line, and comparison persona rule 7 — the
ranking never cites the investor's cost basis, gains or losses. (Loop 1's
"verified clean" note — *"research and diligence agents carry no position
data"* — still holds; this was the other two surfaces.)

---

## 9 · The analyst that writes the readings had never seen the investor's numbers

**The moment.** FOUNDATION ("one desk, fully connected") requires every
analyst surface to carry the reported financials with the investor's cleansed
view. Chat, compare-adjacent surfaces, the DD memo agent and the cleansing
desk all do. The **daily research pipeline** — the one that writes the
readings and the dossier — imported none of it: an hour of bench work
stripping a windfall was invisible to the very run that reads owner earnings
the next morning.

**⚡ SHIPPED (this loop).** The synthesis task now carries
`cleansingBenchContext` (cache-only — no provider fetch on the cron path, and
position-free, so reading neutrality is untouched).

---

## 10 · The record the agents call "verbatim" was silently truncated three ways

**The moment.** `diligenceContext` capped notes at 280 chars with no marker,
kept 2 memos/section, and cut the whole block at 2,600 chars **in section
order** — a mature record's later sections never reached the model at all,
while the header claimed the content was the investor's thinking "verbatim"
and ordered the model to steer proposals by it. The run then re-proposes what
section 8 already concluded; the memo "engages" with a third of a note and
contradicts the rest — exactly what the no-silent-contradiction rule forbids.

**⚡ SHIPPED (this loop).** Every cut is now marked inline (`[cut — N more
chars in the record]`), overflow drops whole sections (never mid-sentence)
with the omitted sections **named** ("do not treat them as unexamined"), memo
and evidence overflow counts stated, and the header downgraded from
"verbatim" to "excerpted — cuts are marked". (Bigger budgets / round-robin
allocation left for an owner call: it's a token-spend decision.)

---

## 11 · Highlights on regenerating surfaces: gone from the page, alive in the log — or re-anchored onto words the investor never marked

**The moment.** Highlight a sentence in today's brief; tomorrow's run rewrites
it. The mark vanishes from the page (quote-recovery finds nothing) while the
annotations log still lists it as a live highlight on "Today's brief". Worse:
recovery takes the **first occurrence** of the quoted text anywhere in the new
surface — a short quote can silently re-anchor onto a different paragraph, a
manufactured association wearing the investor's own highlight color. A
language switch (中文 ↔ EN) unpaints every desk-authored surface's highlights
the same way, since anchors are captured from the *displayed* (translated)
text and no language is stored.

**The code.** `components/Annotations.tsx` (`indexOf` recovery, silent skip);
surface ids `brief`/`dossier` are global-per-ticker while their text is
per-run (`app/t/[symbol]/signals/page.tsx`); `annotations` rows carry no
language (`lib/db.ts`).

**⏸ PARKED (design decision).** Direction, in order of value: (a) scope
regenerating surfaces per run (`brief:<runId>`) so old highlights become
honestly-labeled history instead of ghosts; (b) have the painter report
anchored/orphaned state so `AnnotationRecords` can label "no longer present in
the current brief — kept from ⟨date⟩"; (c) restrict quote-recovery to a
window around the stored offsets; (d) store the annotation's language and
resolve quotes through the content-addressed `translations` table before
giving up. **⚡ Mitigation shipped meanwhile:** the dossier and brief Markdown
subtrees are now keyed on their text, so a text change remounts wholesale —
this also closes the React-vs-painter DOM conflict (duplicated phrases /
`removeChild` errors when React patched text nodes the painter had split).

---

## 12 · Removing a ticker destroys half the record, keeps the other half, and tells the investor neither

**The moment.** The confirm says *"Remove {sym} and its desk (signals,
readings, chat)?"*. What actually happens (`removeTicker`, `lib/db.ts`):
**deleted** — the evidence locker (`dd_evidence`: the uploaded filings and
screenshots FOUNDATION calls the investor's own record), every memo, the
synthesis, and the cleansing bench *including its append-only audit log* ("a
cleansed view that cannot show its audit trail is exactly the instrument this
desk refuses"). **Kept, orphaned** — `note_sections`, `notes`, `annotations`
(unreachable: the dd page 404s), and the whole ledger (`trades`, `orders`,
`dividends`) — where a working GTC order **keeps filling** on a symbol with no
desk (`sweepOpenOrders` lists by user, not ticker). Re-adding the symbol
resurrects the notepads with empty lockers.

**⏸ PARKED (product decision — the mixture is the bug).** Recommendation:
the ledger is a financial record and should survive, but cancel the symbol's
open orders inside `removeTicker`; pick ONE policy for the DD record (keep it
all — don't delete evidence/memos/synthesis — or delete it all including
notes/annotations); and rewrite the confirm to enumerate exactly what dies
and what survives. One decision, three small diffs.

---

## 13 · A missing FX rate silently becomes 1.00 in the portfolio's headline numbers

**The moment.** One failed `JPYUSD=X` lookup and the Toyota position enters
the USD totals at ~150× its true weight — market value, cost basis,
unrealized, allocation ring and the P&L series all confidently wrong, while
the footnote asserts *"Totals in USD (JPY converted)"*. The same file already
does it right twice: `computeInvolvement` returns `fxToUsd: null` with a
comment saying "never guess here", and unconvertible dividends are excluded
with a warning. The headline aggregates guess.

**The code.** `lib/portfolio.ts` (`?? 1` in `valueAll`, asserting
`currencyNote`), `lib/portfolio-math.ts` (`?? 1` fallback chain in the
series).

**⏸ PARKED (needs a careful diff across math + three surfaces).** Direction:
make `ValuedPosition.fxToUsd` nullable, exclude unconvertible positions from
USD aggregates exactly as the dividend branch does, and extend `currencyNote`
honestly: *"N position(s) in JPY excluded — no FX rate available."* Same
family as loop 1's #5 (portfolio truth).

---

## 14 · Paper fills execute at another user's minute-old price while the module promises "live"

`lib/orders.ts` fills market orders (and sweeps working orders) off
`getPriceQuote` — a 60-second cache hung on `globalThis` **keyed by symbol
only**, so on a warm instance another account's poll sets your fill price; the
trade ticket beside it shows a different 45s-tier number, and the docstring
says *"checked against LIVE quotes"*. **⏸ PARKED**: route fills through an
uncached read (or record the quote's timestamp on the fill note); align the
watchlist/desk-header quote tier with the position tier so one row stops
disagreeing with itself.

---

## 15 · Smaller confirmed findings — shipped this loop

- **Zombie runs held the desk lock ~10 minutes past death** (reap cutoff 15m
  vs the platform's 300s kill; banner frozen, Run button a silent no-op).
  ⚡ Cutoff now 6 minutes. (Surfacing `started:false` as a toast: parked, UI copy.)
- **The first applied cleansing adjustment didn't move the financials table**
  (`view` state initialized once; the gate fired, the display stayed raw).
  ⚡ The null→cleansed transition now flips the view; manual toggles kept.
- **Onboarding reported a successfully created desk as "couldn't resolve"**
  when only the greeting insert failed. ⚡ Greeting failure is now a logged
  warning, never a failed desk.
- **Evidence files that merely missed the memo pass's 10 MB budget were
  described to the model as "not machine-readable"** — a false claim about
  the investor's own filing, repeatable into the memo. ⚡ Over-budget now says
  "readable, but over this pass's reading budget (not read this time)".
- **The desk payload route had no `maxDuration`** while the zh path can pay a
  multi-batch cold translation after a fresh run. ⚡ `maxDuration = 120`.
- **Search copy promised "memos"** which the index deliberately skips.
  ⚡ Copy fixed (EN + ZH).

## 16 · Smaller confirmed findings — parked with directions

- **zh search can't find displayed text** (literal `indexOf` on canonical
  English; hits return untranslated). Direction: reverse-translate the query
  via the existing content-addressed cache, match both token sets, localize
  snippets; move the canonical-English note into the empty-result state.
- **Search results don't deep-link** (all hits land at a pill root; hit ids
  are computed then discarded). Direction: `#<hit.id>` anchors +
  `?signal=<id>` for scoped chats/archive hits.
- **Recording isn't transactional** — a platform kill mid-recording leaves
  half a board updated under a run marked failed. Direction: batch the
  recording block (readings + digest + proposals + finishRun) through the
  driver's transaction API.
- **`swap_back` restores the board but not what happened in between** (readings
  written to the replacement stay dated after its retirement; `replaces`
  linkage never cleared; only the first replacement retires). Direction:
  return the interim readings ("2 readings recorded on B while active — kept
  in the archive"), clear the link, handle multi-replacement.
- **Chat-executed approvals/retires have no Undo affordance** (UI actions get
  the 8s toast; the same action via chat gets nothing).
- **Compare verdict goes stale silently client-side** (keyed by pair only
  while both desks poll underneath). Direction: key by pair + each desk's
  `latestRun.finishedAt`, dim on drift.
- **Clips freeze display-language text and translated signal names** into the
  canonical-English record (unmatchable names, mixed-language search corpus).
  Direction: pass canonical names + both headline variants through the clip.
- **`createAnnotation` truncates `selectedText` at 2000 chars but keeps full
  offsets** — a long highlight shrinks after reload (recovery matches the
  truncated quote). Direction: truncate offsets consistently or raise the cap.
- **A stopped run's stage keeps being overwritten by the zombie**
  (`setRunStage` unguarded — cosmetic; archive rows read oddly).
- **The dd payload still ships (and for zh, translates) memo bodies nothing
  renders** since the desk-surfaces redesign — dead model spend on first zh
  load. Direction: strip memo bodies from the payload or lazy-load.

---

## Verified clean this loop (do not re-audit; evidence in the code)

- **One-run-per-desk mutual exclusion holds across all five triggers** (manual,
  cron, both chats, per-signal, on-open): `runningRun` is status-only and
  ignores `signalId`; both starters consult it after reaping.
- **Cancellation can't cross-contaminate**: `finishRun`/`failRun` guarded to
  `status='running'`; per-run stop checkpoints throughout the pipeline.
- **Chat thread scoping is SQL, not convention** — desk vs signal threads
  cannot bleed either direction; cross-desk signal targeting rejected.
- **Cleansing gates hold end-to-end**: research-derived and board-edit
  proposals force-park; transitions are guarded SQL with 409s; pending
  adjustments reach **no** display or prompt (every `applyCleansing` call site
  filters to applied); the audit log is append-only.
- **Research/diligence agents carry no position data** (the ledger reaches
  only chat/compare, now guarded — see #8).
- **Partially-uploaded evidence can't be read or rendered** (`complete = 1`
  filters on all three read paths; chunk append/finalize guarded; hourly
  reaping). One robustness note parked: `expectedLength` isn't persisted, so a
  hostile client could mark a truncated upload complete — server-side length
  verification at `last:true` would close it.
- **No agent writes into the investor's notes** — the only writers of note
  content are the clip route, memo-accept, and the notepad PATCH, each an
  explicit human gesture; memo-accept's double-accept race is correctly
  settled (note-then-guarded-flip, note deleted if the flip loses).
- **ADR currency discipline is consistent** across financials, cleansing and
  the UI (cross-currency ratios omitted, statement vs trading currency never
  blurred); **onboarded-state gating is coherent** across all three pills; the
  cron respects both the onboarded and auto-research gates.
- **Retired signals keep their full evidence trail through swaps**; the
  archive renders them with readings and sources like active ones.

## Loop-1 re-observations

- **#3 (window honesty)** — root cause was deeper than diagnosed (dead code,
  not a 14-day cap); fixed at the root this loop (finding 2).
- **#4 (focus-area gate)** — the loop-1 fix holds in code: areas materialize
  only on approval, chat persists only referenced titles, orphans deletable
  behind a guarded route.
- **#8 (unevidenced-movement clamp)** — holding at both insert sites.
- **#1 (dossier verbatim-carry), #2 (citation identity), #5 (order fills /
  dividends), #6 (stop orders), #7 (auto-flag on run route)** — unchanged,
  still open, directions unchanged from loop 1.

## Cheapest high-leverage moves for next loop, in order

1. **Signals + runs unique indexes with dedup migration** (#4 parked half) —
   the last duplicate-signal hole and the double-run race, one migration.
2. **Optimistic concurrency on notes** (#7 parked half) — closes the last
   clip-erase path; the 409-merge is mechanical for append-only clips.
3. **Run-scoped annotation surfaces + orphan labeling** (#11a/b) — turns
   ghost highlights into honest history; small schema addition.
4. **FX-honest portfolio aggregates** (#13) — one nullable field + the
   exclusion branch that already exists for dividends.
5. **removeTicker policy + confirm copy + cancel-open-orders** (#12) — one
   product decision, three small diffs.
6. **Transactional recording** (#16) — kills the torn-board class (also
   loop-1 #1's provenance would benefit).
7. **zh query reverse-translation in search** (#16) — the cache makes it
   nearly free; unblocks the 中文 desk's own record.

## Simulation status (honest scope note)

Same as loop 1: authenticated persona runs remain blocked by the auth wall in
prod (Google OAuth only; `TEST_LOGIN_TOKEN` unset). This loop was code-path
audit + hand verification of every shipped fix (tsc + eslint + production
build green); no live multi-tab race was reproduced against a deployment.
The `persona.md` cast and the sealed test-login door from loop 1 are still on
main, ready when the owner sets the token for a preview deployment.
