# Scalae

**A daily AI intelligence desk for value investors.** The name is Latin, for the scale in Ben Graham's law that Buffett never tires of quoting: *"In the short run, the market is a voting machine; in the long run, it is a weighing machine."* Scalae exists to weigh the business — every day, from the open web — never to handicap the vote.

Under the hood it runs Phil Fisher's "scuttlebutt" method (the practice, famously used by Warren Buffett, of gathering business intelligence from hundreds of conversations) as an orchestration of AI agents, one desk per ticker.

**The product charter lives in [FOUNDATION.md](FOUNDATION.md)** — the two anchors (every signal must illuminate the ticker's *business model* or *corporate culture*), the no-duplicate-signals rule, human approval gates, and the evidence discipline. All agent behavior derives from it.

## What it does

- **Watchlist** (Apple Stocks-style): add any public-market ticker.
- **Onboarding conversation**: a Claude analyst first classifies the business Buffett-style (great/good/gruesome economics, franchise vs. commodity), then interviews you about the value-investing questions you care about — or proposes the ones with the most open debate if you're unsure.
- **Signal board**: the analyst proposes concrete, trackable signals (quantitative metrics and qualitative judgments), each with a thesis tied to the framework and a measurement plan. **Nothing activates without your approval.**
- **Daily research runs**: Gemini scouts (Google-Search-grounded) sweep the open web per signal bundle; the Claude analyst weighs the evidence into new **readings** for every signal (level, value, confidence, cited sources), a **morning brief** that leads with disconfirming evidence, and an **evidence feed**.
- **Self-reinforcing discovery**: each run may propose up to 3 *new* signals it found in the news — queued for your approval.
- **Full-agency chat**: every desk has an analyst chat. It answers from the board's evidence, takes feedback into tomorrow's research, proposes signals — and on your explicit ask it can approve/dismiss pending proposals, retire active signals, or kick off a research run.

## The analytical core

`lib/agents/framework.ts` encodes the Buffett/Munger doctrine distilled directly from the Berkshire Hathaway shareholder letters (1977–2007 read from source):

- **Ten lenses**, each with Buffett's own screening test and the open-web evidence that moves it — moat & durability, franchise vs. commodity, owner earnings & capital intensity, management candor, capital allocation, the institutional imperative, and more.
- **Question generation the way Buffett does it**: classify the business first (See's vs. FlightSafety vs. airlines — the three "savings accounts"), apply the four filters (understandable? favorable economics? trustworthy management? sensible price?), ask the 10-20-year question, then invert — what would kill it, and what's the earliest observable symptom?
- **Signal design rules**: measure the business, not the stock; guard load-bearing assumptions; always include at least one red-flag signal ("never is there just one cockroach in the kitchen").
- **Evidence-weighing doctrine** for the daily synthesis: primary sources outweigh aggregator retellings; flag institutional-imperative symptoms; lead with what a bull would rather ignore; honest carry-forward when nothing new emerged.

## Architecture

| Piece | Role |
|---|---|
| Claude (`claude-opus-4-8`, adaptive thinking, structured outputs, streaming) | The analyst: onboarding, chat with desk actions, daily synthesis, signal discovery |
| Gemini (`gemini-2.5-flash` + Google Search grounding) | The scouts: live open-web research sweeps with source citations |
| yahoo-finance2 | Quotes, sparklines, ticker search/validation (no key needed) |
| SQLite (better-sqlite3, `data/scalae.db`) | Local persistence: desks, signals, readings, digests, runs, chat |
| Next.js 16 App Router | UI + API routes; research runs continue via `after()` after the response |

Key paths: `lib/agents/framework.ts` (the doctrine + JSON schemas), `lib/agents/chat.ts` (onboarding/working chat + desk actions), `lib/agents/research.ts` (the daily pipeline), `app/t/[symbol]/page.tsx` (the desk UI).

## Run it

```bash
npm install
npm run dev   # http://localhost:3000
```

Put your keys in `.env.local` (see `.env.example`):

```
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
CLAUDE_MODEL=claude-opus-4-8      # swap to claude-sonnet-4-6 for ~5x lower cost
GEMINI_MODEL=gemini-2.5-flash
```

## Daily regeneration

1. **On open** — opening a desk whose last run is >20h old auto-starts a run.
2. **Manual** — the "Run research now" button, or just tell the analyst in chat.
3. **Scheduled** — hit `GET /api/cron/daily` from any scheduler; it runs every stale desk. Locally e.g. `crontab`: `0 7 * * 1-5 curl -s http://localhost:3000/api/cron/daily`.

## Cost note

Each daily run per ticker ≈ 3–6 API calls (Gemini sweeps + one Claude Opus synthesis). Chat turns are one Claude call each. Set `CLAUDE_MODEL=claude-sonnet-4-6` in `.env.local` to cut Claude cost roughly 5x. Transient Anthropic overloads (429/529) are retried automatically with backoff; chat failures keep your message and offer a one-click retry.

## Deploying

The app is local-first (SQLite on disk). To deploy on Vercel: swap `lib/db.ts` for a hosted Postgres (e.g. Neon via Vercel Marketplace), add a `vercel.ts` cron hitting `/api/cron/daily`, and set the env vars. Everything else is portable.

---

*Educational research tool — not investment advice.*
