# Scalae

**A daily AI intelligence desk for value investors.** The name is Latin, for the scale in Ben Graham's law that Buffett never tires of quoting: *"In the short run, the market is a voting machine; in the long run, it is a weighing machine."* Scalae exists to weigh the business — every day, from the open web — never to handicap the vote.

Under the hood it runs Phil Fisher's "scuttlebutt" method (the practice, famously used by Warren Buffett, of gathering business intelligence from hundreds of conversations) as an orchestration of AI agents, one desk per ticker.

**The product charter lives in [FOUNDATION.md](FOUNDATION.md)** — the two anchors (every signal must illuminate the ticker's *business model* or *corporate culture*), the no-duplicate-signals rule, human approval gates, and the evidence discipline. All agent behavior derives from it.

## What it does

- **Watchlist** (Apple Stocks-style): add any public-market ticker.
- **Due Diligence workspace — the ticker's main page** (`/t/SYMBOL`): your deep qualitative research record, organized into **sections** (large qualitative topics specific to the company — moat mechanism, founder culture, regulatory exposure…), each holding freely-editable rich-text notepads. On your ask, the desk runs **deep research on a section's topic** — long-horizon company record, industry outside-view, and authentic primary-source sweeps, synthesized into a cited memo that **parks for your review**: accept adds it to the section as a dated, fully-editable notepad; dismiss leaves the record untouched (the desk never writes into your notes uninvited). Each section also has an **evidence locker**: drop files of any type — filings, screenshots, spreadsheets, photos, recordings — up to **25 MB per file** (large files upload in chunks under the platform's request-size limit, with progress shown) and caption each one; readable files (images, PDFs, text) are read natively by the desk when researching that section — within a per-pass reading budget — and everything else is carried by its caption. A standing **synthesis of core insights** distills the whole record — the thesis as written, its tensions, and the open fronts — refreshed on demand, with honest staleness shown when the record has moved. Section-topic suggestions come from your signal board ("the right things to look at"), and the growing record steers which signals the analyst proposes next — the **circle-of-competence feedback loop**. The signal board itself lives at `/t/SYMBOL/signals`.
- **Onboarding intake — the opening file, assembled together**: a Claude analyst first classifies the business Buffett-style (great/good/gruesome economics, franchise vs. commodity), then begins the way Berkshire begins — requesting the primary record the open web can't verifiably supply: shareholder/founder letters across the years, annual reports with time depth, the proxy's incentive disclosures, the IPO prospectus — each request specific to the company and tied to the lens it feeds. Drop the documents straight into the chat (PDFs, screenshots, text); the analyst reads each through the framework and says what it settled or contradicted. The study runs as **six conversation stages — Buffett's filters in veto order**: ① circle of competence (including yours — it asks what you know firsthand), ② business economics, ③ the industry map & attacker's test (who earns the profit pool; with unlimited capital, could you take this position?), ④ management & incentives, ⑤ inversion (the kill list, built together), ⑥ an honest in/out/too-hard **verdict** and then the full board — every thesis citing its grounding (or plainly "unverified: open-web only"). Each reply is labeled with its stage; the analyst announces what closed a stage before moving on; "skip", "go back", or "just propose signals" is honored instantly. Intake turns run at deeper reasoning effort than working chat.
- **Signal board**: the analyst proposes concrete, trackable signals (quantitative metrics and qualitative judgments), each with a thesis tied to the framework and a measurement plan. **Nothing activates without your approval.**
- **Deep daily research runs** — a four-stage multi-agent pipeline, every run:
  1. *Breadth sweeps (parallel)*: Google-Search-grounded scouts cover the signal bundles, broad company news, **primary sources** (filings, transcripts, IR, regulator documents) and **culture scuttlebutt** (employees, customers, suppliers, trade press).
  2. *Gap analysis*: the Claude analyst triages the evidence against the board and commissions targeted follow-up questions where evidence is thin, conflicting, or red-flag-adjacent.
  3. *Deep-dive sweeps (parallel)*: a stronger scout model runs the commissioned probes.
  4. *Deep synthesis*: the analyst weighs everything into new **readings** for every signal (level, value, confidence, **per-source citations**), a **morning brief** that leads with disconfirming evidence, and an **evidence feed**.
- **Evidence mapping**: every reading stores exactly which sources it draws on. Signal cards show clickable source chips and an accumulating **evidence catalog** (grows across runs); the morning brief's `[n]` citations render as **clickable links** into that run's numbered sources.
- **Signal detail views**: every signal opens into its own segmented layout — reading hero, thesis, plan, history, evidence catalog — with a **signal-scoped Analyst desk** (its own thread; the analyst sees that signal's full world) while the ticker-level desk keeps the global picture.
- **Honest carry-forward**: each reading declares whether the run added new evidence; no-news days record one muted "No new information this run" line instead of re-narrating the story.
- **Self-reinforcing discovery — replace, don't accrete**: each run may propose up to 3 signals, including **replacement proposals** (⇄) that name the active signal they supersede — approving swaps the sharper crux signal in and retires the old one. Proposals support **select / select-all / bulk approve / ignore**.
- **Standing dossier — "The business, as the desk reads it"**: each run maintains a live 150–300-word synthesis of the whole board into the two anchors — how the company makes money *now*, and the culture/trust verdict — updated only where evidence moved, with clickable `[n]` citations. The daily brief carries the news; the dossier carries the thesis.
- **Reversible archive & board statistics**: retired and dismissed signals stay in a desk archive (reactivate a signal, or return a dismissed proposal to the queue — approval gates intact), the board shows a diligence pulse (how many signals moved on new evidence vs. carried forward, catalog depth, average confidence), quantitative signals get trend sparklines, and every catalog source can be **traced** through exactly the readings that cited it.
- **Portfolio tracker** (💼 on the dashboard): trade ledger for **stocks and options** (long/short, average-cost, fees), live valuation with FX-normalized USD totals, a reconstructed **P&L chart** since your first trade, and per-ticker **involvement** shown on the watchlist, each desk, and in the analyst's context (margin-of-safety only — readings stay unbiased). Options are marked at live contract quotes when available, intrinsic value otherwise.
- **Brokerage-style order ticket**: a full pre-trade quote card (bid/ask × size, day & 52-week ranges, volume, P/E, EPS, dividend yield) appears as you type the ticker. Place **market / limit / stop / stop-limit** orders (Day or GTC, quantity in shares or currency amount, estimated cost, review-then-place); market and marketable orders fill immediately at the live quote, the rest stay **working** and fill — *simulated paper execution* — when live prices cross them (checked on every portfolio refresh), landing in the ledger as ordinary trades. Off-market fills and options go in via **Record past trade**.
- **Dividend accounting with DRIP**: dividends are detected from market data for shares held before each ex-date and surface as **pending receipts** — apply them (one by one or all, with optional **withholding %**) to credit cash, or flip a per-symbol **DRIP** toggle to reinvest into fractional shares at the ex-date close. A receipts history logs every applied dividend. Dividends flow into the P&L series, a summary tile, and total P&L; short positions are charged, as at a real broker.
- **Trade with your position in view**: the ticket shows your holding (shares, average cost, working orders) while you place an order, warns when a sell **exceeds what you hold** (opens a short), offers one-tap price anchors (market, your cost, 52-week low/high) for limit/stop prices, and previews how the order changes the position's **% weight of the book**. Portfolio rows carry the same weight chips.
- **Compare desks** (⇄ on the dashboard): weigh two businesses side by side — both standing dossiers, board health verdicts with red flags, **signals matched across tickers by thesis similarity** ("same question, both businesses"), and what only one desk watches.
- **Curation with memory**: sort the board by staleness / thinnest confidence / weakest health; an **Undo** window after retire, dismiss, and swap approvals; proposals that were previously dismissed say so ("you dismissed this on ⟨date⟩"); untagged evidence-feed stories get a **"✚ track this"** button that asks the analyst to draft a signal (approval-gated); and when a knowingly-kept signal pair's readings keep citing the **same sources**, the desk escalates to proposing the merged replacement.
- **Auto-research switch** (dashboard): one toggle pauses the daily cron and stale-desk auto-runs (server-enforced) so tokens are spent only on demand; manual runs and explicit chat asks always work.
- **Bilingual desk (English / 简体中文)**: one switch in Settings changes the whole product — the UI, the analyst's conversations (it simply replies in your language), and the research record itself: briefs, dossiers, signal theses, readings and evidence are translated **on display** by a cached translation layer (content-addressed `translations` table + the cheap `translate` model role), while the stored canonical record stays English — so switching back and forth never forks the data. New desks greet you in your language; support emails follow it too. First visit defaults from the browser's `Accept-Language`.
- **Appearance**: dark (native), light, or follow-system — rendered flash-free from a preference cookie in the root layout, persisted per account.
- **Profile vs. Settings, separated**: the dashboard's avatar opens **/profile** (Google account identity, editable investor profile — name, age, country, industries — and sign-out) while the gear opens **/settings** (language, appearance, auto-research, support).
- **Full-agency analyst desk**: every desk has an analyst chat. It answers from the board's evidence, takes feedback into tomorrow's research, proposes signals — and on your explicit ask it can approve/dismiss pending proposals, retire active signals, or kick off a research run. The desk zooms to **full screen** (state, approvals and live polling carry over), takes **voice dictation** and can **read replies aloud**, and accepts **attachments** — images and charts, PDFs (filings, broker notes) and text files — which the analyst reads natively as evidence.

## Going multi-user (B2C): Google sign-in + admin

Scalae runs in one of two modes:

- **Single-user (default)** — no configuration needed. Everything belongs to the implicit `local` account, exactly as before.
- **Multi-user (B2C)** — set three env vars and the app grows a **Google sign-in** front door (`/signin`), per-account data isolation (desks, signals, chats, portfolio, settings — all scoped).

The **admin console** (`/admin`) is a separate concern from consumer sign-in — see below. It works in *either* mode.

### Consumer sign-in (Google, optional)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Credentials* → *Create credentials* → **OAuth client ID** (type *Web application*). Configure the consent screen (External) if prompted. Add the authorized redirect URI: `https://<your-domain>/api/auth/callback` (e.g. `https://scalae.vercel.app/api/auth/callback`).
2. Set env vars (Vercel → Settings → Environment Variables):
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from step 1
   - `SESSION_SECRET` — any long random string (e.g. `openssl rand -hex 32`)
   - `ADMIN_EMAILS` *(optional)* — comma-separated emails that get the admin role on sign-in; independently, the **first account ever created is an admin**
   - `APP_URL` *(optional)* — canonical origin if you serve behind a proxy that mangles Host headers
3. Redeploy. Signed-out visitors are routed to `/signin` (pages redirect, APIs 401 — enforced by `proxy.ts` and per-route session checks).

**Your existing data is safe**: the first admin to sign in automatically adopts everything created in single-user mode. Sessions are database-backed (30 days, httpOnly cookies); the OAuth flow is a hand-rolled authorization-code exchange with HMAC-signed state — no auth dependencies.

### Admin console (`/admin`) — its own email + password gate

The admin console is a full ops dashboard: every account with activity aggregates (desks, signals, runs, messages, trades, onboarding profile, sign-ins over 7 days, feedback filed, last seen), **AI cost & usage telemetry** (every Claude/Gemini call records tokens + estimated cost from list prices at call time — total/30-day cost tiles, daily cost chart, cost by model / by feature / by user with share bars, and a "clear cost data" reset), a **sign-ins-per-day** chart, a **feedback inbox** (`/admin/feedback`), and the models in use. It sits behind a **dedicated sign-in at `/admin/login`** that is independent of the consumer Google flow — an app admin need not be a signed-in app user, and the gate works even in single-user mode. It's unadvertised in the consumer UI; reach it by URL.

Getting in requires **both**:
- `ADMIN_PASSWORD` — the shared admin password. **Unset seals `/admin` entirely** — no default password is ever accepted.
- an **authorized email** — one in `ADMIN_EMAILS`, or the address of a user whose role is `admin` (a live DB check, so promoting a user takes effect immediately).

Set `ADMIN_PASSWORD` (+ `ADMIN_EMAILS`) in Vercel, redeploy, then visit `/admin/login` and enter an authorized email and the password. A successful login sets a 24-hour httpOnly cookie carrying your email, signed (HMAC) with `ADMIN_PASSWORD` — so it can't be forged, and **rotating the password signs every admin out**. "Admin sign out" clears only that cookie (any consumer Google session is untouched). The daily cron sweeps every account's desks, honoring each user's own auto-research switch, so one user pausing spend never affects another (watch the Runs column in `/admin` — research runs cost tokens per user).

### First-run onboarding (`/welcome`) & the greeting splash

A brand-new account (no profile, no desks) is routed to **`/welcome`** on first landing: a guided intake chat — name, age (optional), country, industries of interest, and specific companies (resolved live against the ticker universe) — that **opens their first desks on completion** (capped at 6 to keep the first day's research spend sane; skippable). The profile is stored per-account (settings key `profile`). Existing accounts, including adopted single-user data, are never re-onboarded.

Returning users get a **time-aware greeting splash** (once per browser session) — "Good morning / afternoon / evening, ⟨name⟩." over the Scalae mark for ~2.4s, fading into the dashboard.

### Feedback & support (`/support`)

Users file support requests — bug reports, feature ideas, questions — from **`/support`** (linked from Settings and the dashboard footer), with screenshots/PDFs/text files attached as evidence. Every request gets a human-friendly **request ID** (e.g. `SCL-7K2M4Q`) and a thread; replying to a responded or closed request re-opens it.

Admins triage from **`/admin/feedback`**: respond (optionally respond-and-close), close, reopen. When email is configured, an admin response **emails the requester** automatically:

- `RESEND_API_KEY` — a [Resend](https://resend.com) API key; unset = no emails (responses still appear in the in-app thread)
- `FEEDBACK_FROM_EMAIL` *(optional)* — verified sender, e.g. `Scalae <support@yourdomain.com>` (defaults to Resend's onboarding sender, fine for testing)

## The analytical core

`lib/agents/framework.ts` encodes the Buffett/Munger doctrine distilled directly from the Berkshire Hathaway shareholder letters (1977–2007 read from source) and from the Munger corpus — *Poor Charlie's Almanack* (the eleven talks, the Psychology of Human Misjudgment, the Investing Principles Checklist) and the Wesco/Daily Journal meeting record:

- **Ten lenses**, each with Buffett's own screening test and the open-web evidence that moves it — moat & durability (with Munger's name-the-mechanism and untapped-pricing-power tests), franchise vs. commodity (the looms lesson: who captures productivity gains), owner earnings & capital intensity, management candor (promise-vs-delivery, Planck vs. chauffeur knowledge), capital allocation (opportunity cost as the master test), culture & deserved trust, and more.
- **The misjudgment checklist**: Munger's psychology of misjudgment curated to the eleven tendencies with observable corporate symptoms — incentive-caused bias first ("read the proxy before the press release"), social proof, commitment escalation, authority, denial, envy, lollapalooza confluence — run as track two of every analysis, on the company *and on the desk itself*.
- **Question generation the way Buffett and Munger do it**: classify the business first (See's vs. FlightSafety vs. airlines — the three "savings accounts"), settle the no-brainers, apply the four filters in veto order with price last, name the moat mechanism, ask the 10-20-year question, then invert — build the kill list and track each path's earliest observable symptom. "Too hard" is a legitimate first-class verdict.
- **The certainty-gap master question** governs selection: *"what is preventing me from certainty about the next ten years of cash flow and growth?"* — what is missing that keeps this from being a ~90%-certainty, heavy-investment opportunity. Four sub-questions rank the gaps, in the filters' order: a moat strong enough for a decade of ~20% compounding; culture ingrained beyond the founder (founder independence); the kill question — most important — what can kill the company and is management actively diverting it away; and a margin of safety sufficient even granting the growth (price last, margin-of-safety only).
- **Signal design rules**: measure the business, not the stock; every signal names the mental model it instantiates (the mechanical no-overlap rule); incentives are signal zero for culture; design for dormancy (activity is a cost, not a KPI); prohibited classes — macro forecasts, price targets/charts, EBITDA-family metrics, guidance-as-evidence; always include at least one red-flag signal ("never is there just one cockroach in the kitchen").
- **Evidence-weighing doctrine** for the daily synthesis: primary/mechanism-level sources outweigh fluent narrative; tag every source's incentive origin; escalate lollapaloozas instead of averaging them; run the misjudgment checklist on the desk's own reasoning (iron prescription before moving a level); Stein's law on every extrapolated trend; lead with what a bull would rather ignore; honest carry-forward when nothing new emerged.

## Architecture

| Piece | Role |
|---|---|
| Claude (adaptive thinking, structured outputs, streaming) | The analyst: onboarding, chat with desk actions, mid-run gap triage, deep daily synthesis, signal discovery |
| Gemini (native Google-Search grounding, two tiers) | The scouts: live open-web research sweeps with per-source grounding metadata |
| yahoo-finance2 | Quotes, sparklines, ticker search/validation (no key needed) |
| Neon Postgres (`@neondatabase/serverless`) | Persistence: desks, signals, readings (with per-source citations), digests, runs, chat + attachments. Local and Vercel share one database. |
| Next.js 16 App Router | UI + API routes; research runs continue via `after()` after the response |

Key paths: `lib/agents/framework.ts` (the doctrine + JSON schemas), `lib/agents/chat.ts` (onboarding/working chat + desk actions + attachments), `lib/agents/research.ts` (the four-stage daily pipeline), `lib/agents/diligence.ts` (due-diligence deep research, record synthesis, topic suggestions), `lib/citations.ts` (source-provenance helpers), `app/t/[symbol]/page.tsx` (the due-diligence workspace — the ticker's main page), `app/t/[symbol]/signals/page.tsx` (the signal desk UI + full-screen mode).

## Why these models — and how they stay current

Each stage has a different job, so each uses a different model. Rather than pin
model IDs that go stale (or break when a provider retires them), the desk
**selects the best currently-available model per role automatically**
(`lib/ai/models.ts`): each role declares what *kind* of model it wants, and the
resolver picks the top-scoring match from the provider's **live model list** on
each run.

- **Self-healing** — a retired/unavailable model is never selected.
- **Auto-latest** — a newer version in the same line is adopted automatically (`gemini-3.5-flash` → `gemini-4-flash`, `claude-opus-4-8` → `claude-opus-5`, …), preferring a stable release over a preview of the same version.
- **Overridable** — a per-role env var always wins, to pin a model by hand (see `.env.example`).

| Role | Selects | Why this kind of model |
|---|---|---|
| Breadth scouts (parallel) | newest full Gemini **Flash** | Native Google-Search grounding with per-claim source metadata; #1 on vals.ai's finance-agent retrieval benchmark; Pro-tier quality at Flash speed/price for the 6–10 parallel sweeps. |
| Deep-dive scouts | newest Gemini **Pro** | Leads FACTS-Grounding faithfulness; the extra multi-hop reasoning earns its keep on the handful of probes that cross-check conflicting primary sources. |
| Analyst-desk chat & pairwise compare | newest flagship **Opus** | The investor's live analyst — frontier judgment with fast interactive turns; chat reads attachments (images, PDFs, text) natively. |
| Deep synthesis | newest flagship **Opus** | The run's one heavy call — extracting decision-relevant *insight* (not summary) from a large evidence dump, where Claude leads. Stays flagship: it carries the desk's quality. |
| Due-diligence memos, record synthesis & topic suggestions | newest flagship **Opus** | The record is the product's centre and every call is an explicit human ask (never the cron) — flagship quality is earned here (`CLAUDE_DILIGENCE_MODEL` to pin). |
| Gap triage & signal deep-history | newest **Sonnet** (value) | Bounded support work that runs on every desk every day — routing which threads deserve a deep dive, and writing each signal's decades-scale backstory (cached forever). Sonnet handles both well; the flagship isn't earned here (`CLAUDE_TRIAGE_MODEL` / `CLAUDE_BACKSTORY_MODEL` to pin). |
| Display translation (中文 mode) | newest Claude **Haiku** | High-volume, mechanical, cached per text in the `translations` table — each string is translated exactly once, so the value tier is plenty (`CLAUDE_TRANSLATE_MODEL` to pin). |

The **flagship** tier (Opus-class) is used for Claude rather than the pricier
Fable/Mythos tier, which needs 30-day data retention and costs ~2×. To move
synthesis to that ceiling, add `fable|mythos` to the `synthesis` include in
`lib/ai/models.ts` or set `CLAUDE_SYNTHESIS_MODEL=claude-fable-5` (a Fable/Mythos
model auto-falls back to Opus on the rare safety refusal). To drop to the value
tier, set it to a Sonnet model.

**Updated monthly:** `.github/workflows/model-review.yml` runs on the 1st of each
month and opens an issue summarising each provider's current lineup and what the
resolver picks — so a genuinely new model *family* gets a human approval before
adoption (consistent with the app's approval-gate design). Version bumps within a
known line need no action; they're adopted automatically. Requires repo secrets
`ANTHROPIC_API_KEY` and `GEMINI_API_KEY` (read-only model-list access).

Both research stages keep Gemini's native grounding on the `generateContent` endpoint (now labelled "legacy" but fully supported). Synthesis stays on Claude because long-context analytical insight-extraction is exactly where it leads the field — no benchmark supported switching providers for either stage.

## Run it

```bash
npm install
npm run dev   # http://localhost:3000
```

Put your keys in `.env.local` (see `.env.example` for the full list, including per-stage model overrides):

```
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
DATABASE_URL=postgres://...        # Neon; or `vercel env pull .env.local`
```

The model defaults are set per stage in code (see **Why these models**); override any of them via env without touching code.

## Daily regeneration

1. **On open** — opening a desk whose last run is >20h old auto-starts a run.
2. **Manual** — the "Run research now" button, or just tell the analyst in chat.
3. **Scheduled** — hit `GET /api/cron/daily` from any scheduler; it runs every stale desk on its **adaptive cadence** (below). Locally e.g. `crontab`: `0 7 * * 1-5 curl -s http://localhost:3000/api/cron/daily`.

## Cost & latency note

The deep pipeline trades cost/latency for depth. Each run per ticker is roughly: a handful of parallel breadth sweeps (per-signal bundles + broad + primary-source + scuttlebutt), one gap-triage Claude call, up to 4 deep-dive sweeps, and one large synthesis call. Grounding rides Gemini's 5,000-prompt/month free pool then ~$14/1k queries. The **daily synthesis stays on flagship Opus** — it carries the desk's quality — while the supporting Claude calls are tiered down: **gap triage and signal deep-history run on Sonnet** (`CLAUDE_TRIAGE_MODEL` / `CLAUDE_BACKSTORY_MODEL` to re-pin), removing up to three flagship calls from every run without touching the reading itself. To go bigger, set `CLAUDE_SYNTHESIS_MODEL=claude-fable-5` for the top tier; to trim scout cost, set `GEMINI_DEEP_MODEL=gemini-3.5-flash`. Legacy global pins (`GEMINI_MODEL`, `CLAUDE_MODEL`) are ignored (with a log warning) — delete them; only per-role vars pin models, so auto-selection can keep tracking each provider's newest lineup. The admin page shows the models in use right now, and the cost telemetry already nets out cached tokens, so savings show up there.

Three cost controls keep spend from compounding as signals and tickers pile up, without thinning any single run:
- **Prompt caching.** The large static desk doctrine (the ten lenses + misjudgment checklist, ~3–4K tokens) is sent as an Anthropic ephemeral-cache prefix shared by *every* Claude call across every ticker and run — so the daily cron writes it once and re-reads it at ~0.1× input cost for the rest of the sweep. Only the tiny per-ticker identity + task varies (`lib/agents/framework.ts` → `DESK_DOCTRINE`).
- **Adaptive cadence (dormancy).** FOUNDATION's rule — "nothing happened today" is the healthy output; activity is a cost, not a KPI — made operational: the cron tracks a per-desk `quietRuns` counter (reset the moment a run finds new evidence), and a desk that keeps reading "nothing new" is swept less often — daily → every ~2 days → every ~3 days (capped at 3, so nothing dormant goes truly stale). Any new evidence, or approving a new signal, snaps it back to daily. The manual **Run** button and the on-open refresh always bypass this — it only slows the *unattended* sweep of desks nobody is watching (`lib/cadence.ts`).
- **Per-role tiering** (above) plus the global **auto-research switch** (a full pause).

Research runs execute inside the route's `maxDuration` (300s — the Vercel Hobby ceiling with Fluid Compute; raise to 800 on Pro/Enterprise) via `after()`; a run that outlasts the budget is reaped and retried. Transient Anthropic overloads (429/529) retry with backoff; on a sustained overload the **interactive** calls (desk chat and the pairwise compare) fall back once to a higher-capacity model — `claude-sonnet-5` by default, override with `CLAUDE_FALLBACK_MODEL` — rather than hard-failing, while the daily synthesis stays on its primary (a background run just retries later). Chat failures still keep your message with one-click retry.

Interactive latency is governed by reasoning **effort** (on current models it is the one lever for adaptive-thinking depth, and thinking spends from the same `max_tokens` as the reply): the desk chat runs at `low` (`CLAUDE_CHAT_EFFORT` to raise) and the pairwise compare at `medium` (`CLAUDE_COMPARE_EFFORT`), and both run under a hard 240s deadline that fails into the retry path instead of riding to the platform's function kill — so the analyst answers in seconds, and a genuinely hung call surfaces as a clean, retryable error rather than a browser timeout.

## Deploying

Deploys on Vercel as-is: the database is Neon Postgres (`DATABASE_URL`), shared between local and cloud. Add a cron hitting `/api/cron/daily` (protected by `CRON_SECRET` if set) and set the env vars. The default models have no special account requirements; only if you override synthesis to `claude-fable-5` must the Anthropic org meet Fable 5's 30-day data-retention requirement (not available under ZDR).

---

*Educational research tool — not investment advice.*
