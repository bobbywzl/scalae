# Scalae

**A daily AI intelligence desk for value investors.** The name is Latin, for the scale in Ben Graham's law that Buffett never tires of quoting: *"In the short run, the market is a voting machine; in the long run, it is a weighing machine."* Scalae exists to weigh the business — every day, from the open web — never to handicap the vote.

Under the hood it runs Phil Fisher's "scuttlebutt" method (the practice, famously used by Warren Buffett, of gathering business intelligence from hundreds of conversations) as an orchestration of AI agents, one desk per ticker.

**The product charter lives in [FOUNDATION.md](FOUNDATION.md)** — the two anchors (every signal must illuminate the ticker's *business model* or *corporate culture*), the no-duplicate-signals rule, human approval gates, and the evidence discipline. All agent behavior derives from it.

## What it does

- **Watchlist** (Apple Stocks-style): add any public-market ticker.
- **Onboarding conversation**: a Claude analyst first classifies the business Buffett-style (great/good/gruesome economics, franchise vs. commodity), then interviews you about the value-investing questions you care about — or proposes the ones with the most open debate if you're unsure.
- **Signal board**: the analyst proposes concrete, trackable signals (quantitative metrics and qualitative judgments), each with a thesis tied to the framework and a measurement plan. **Nothing activates without your approval.**
- **Deep daily research runs** — a four-stage multi-agent pipeline, every run:
  1. *Breadth sweeps (parallel)*: Google-Search-grounded scouts cover the signal bundles, broad company news, **primary sources** (filings, transcripts, IR, regulator documents) and **culture scuttlebutt** (employees, customers, suppliers, trade press).
  2. *Gap analysis*: the Claude analyst triages the evidence against the board and commissions targeted follow-up questions where evidence is thin, conflicting, or red-flag-adjacent.
  3. *Deep-dive sweeps (parallel)*: a stronger scout model runs the commissioned probes.
  4. *Deep synthesis*: the analyst weighs everything into new **readings** for every signal (level, value, confidence, **per-source citations**), a **morning brief** that leads with disconfirming evidence, and an **evidence feed**.
- **Evidence mapping**: every reading stores exactly which sources it draws on — signal cards show clickable source chips (domain) plus, expanded, each source's title and which research sweep surfaced it.
- **Self-reinforcing discovery**: each run may propose up to 3 *new* signals it found in the news — queued for your approval.
- **Full-agency analyst desk**: every desk has an analyst chat. It answers from the board's evidence, takes feedback into tomorrow's research, proposes signals — and on your explicit ask it can approve/dismiss pending proposals, retire active signals, or kick off a research run. The desk zooms to **full screen** (state, approvals and live polling carry over), takes **voice dictation** and can **read replies aloud**, and accepts **attachments** — images and charts, PDFs (filings, broker notes) and text files — which the analyst reads natively as evidence.

## The analytical core

`lib/agents/framework.ts` encodes the Buffett/Munger doctrine distilled directly from the Berkshire Hathaway shareholder letters (1977–2007 read from source):

- **Ten lenses**, each with Buffett's own screening test and the open-web evidence that moves it — moat & durability, franchise vs. commodity, owner earnings & capital intensity, management candor, capital allocation, the institutional imperative, and more.
- **Question generation the way Buffett does it**: classify the business first (See's vs. FlightSafety vs. airlines — the three "savings accounts"), apply the four filters (understandable? favorable economics? trustworthy management? sensible price?), ask the 10-20-year question, then invert — what would kill it, and what's the earliest observable symptom?
- **Signal design rules**: measure the business, not the stock; guard load-bearing assumptions; always include at least one red-flag signal ("never is there just one cockroach in the kitchen").
- **Evidence-weighing doctrine** for the daily synthesis: primary sources outweigh aggregator retellings; flag institutional-imperative symptoms; lead with what a bull would rather ignore; honest carry-forward when nothing new emerged.

## Architecture

| Piece | Role |
|---|---|
| Claude (adaptive thinking, structured outputs, streaming) | The analyst: onboarding, chat with desk actions, mid-run gap triage, deep daily synthesis, signal discovery |
| Gemini (native Google-Search grounding, two tiers) | The scouts: live open-web research sweeps with per-source grounding metadata |
| yahoo-finance2 | Quotes, sparklines, ticker search/validation (no key needed) |
| Neon Postgres (`@neondatabase/serverless`) | Persistence: desks, signals, readings (with per-source citations), digests, runs, chat + attachments. Local and Vercel share one database. |
| Next.js 16 App Router | UI + API routes; research runs continue via `after()` after the response |

Key paths: `lib/agents/framework.ts` (the doctrine + JSON schemas), `lib/agents/chat.ts` (onboarding/working chat + desk actions + attachments), `lib/agents/research.ts` (the four-stage daily pipeline), `lib/citations.ts` (source-provenance helpers), `app/t/[symbol]/page.tsx` (the desk UI + full-screen mode).

## Why these models

The stages have different jobs, so they use different models (all env-overridable — see `.env.example`). Chosen against July-2026 benchmarks:

| Stage | Default | Why |
|---|---|---|
| Breadth scouts (parallel) | `gemini-3.5-flash` | Native Google-Search grounding returns per-claim source metadata no competitor matches; #1 on vals.ai's finance-agent retrieval benchmark; Pro-tier quality at Flash speed/price — right for the 6–10 sweeps that run in parallel each cycle. |
| Deep-dive scouts | `gemini-3.1-pro-preview` | Leads FACTS-Grounding faithfulness; the extra multi-hop reasoning earns its keep on the handful of commissioned probes that cross-check conflicting primary sources. |
| Gap triage | `claude-opus-4-8` | Frontier judgment, fast turns — decides what's worth a deep dive between the two scout waves. |
| Deep synthesis | `claude-sonnet-5` | The run's one heavy call — extracting decision-relevant *insight* (not summary) from a large evidence dump. Sonnet 5 delivers near-Opus long-context analytical reasoning at Sonnet cost and speed, with no data-retention constraint. Step up to `claude-opus-4-8` or `claude-fable-5` (top of HLE / GDPval-AA / Vals Index / 1M retrieval) via `CLAUDE_SYNTHESIS_MODEL` when you want the ceiling; a Fable/Mythos override auto-falls back to `claude-opus-4-8` on the rare safety refusal. |
| Analyst-desk chat | `claude-opus-4-8` | Frontier quality with fast interactive turns; reads attachments (images, PDFs, text) natively. |

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
3. **Scheduled** — hit `GET /api/cron/daily` from any scheduler; it runs every stale desk. Locally e.g. `crontab`: `0 7 * * 1-5 curl -s http://localhost:3000/api/cron/daily`.

## Cost & latency note

The deep pipeline trades cost/latency for depth. Each run per ticker is roughly: a handful of parallel breadth sweeps (per-signal bundles + broad + primary-source + scuttlebutt), one gap-triage Claude call, up to 4 deep-dive sweeps, and one Sonnet-5 synthesis. Grounding rides Gemini's 5,000-prompt/month free pool then ~$14/1k queries; synthesis is one large Claude call. To go bigger, set `CLAUDE_SYNTHESIS_MODEL=claude-opus-4-8` or `claude-fable-5` for the top tier; to trim scout cost, point both Gemini tiers at `gemini-3.5-flash`. Research runs execute inside the route's `maxDuration` (800s, clamped to your Vercel plan) via `after()`; transient Anthropic overloads (429/529) retry with backoff, and chat failures keep your message with one-click retry.

## Deploying

Deploys on Vercel as-is: the database is Neon Postgres (`DATABASE_URL`), shared between local and cloud. Add a cron hitting `/api/cron/daily` (protected by `CRON_SECRET` if set) and set the env vars. The default models have no special account requirements; only if you override synthesis to `claude-fable-5` must the Anthropic org meet Fable 5's 30-day data-retention requirement (not available under ZDR).

---

*Educational research tool — not investment advice.*
