<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Product vision

The app's purpose and non-negotiable product rules live in `FOUNDATION.md` (two
anchors: every signal must relate to the ticker's **business model** or **corporate
culture**; no overlapping/duplicate signals; human approval gates). Any change to
signals, prompts, or agent behavior must stay consistent with it — `lib/agents/framework.ts`
is its executable form.
