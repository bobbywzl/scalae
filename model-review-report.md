# Monthly model review — 2026-07

The app selects the **best currently-available** model per role automatically
(`lib/ai/models.ts`). Below is what it resolves **right now** from each
provider's live model list. If a stronger new model family has appeared that the
app isn't picking, widen the `include` pattern in `lib/ai/models.ts` (or pin a
model with the per-role env var) and open a PR.

## Resolved per role

| Role | Model the app will use |
|---|---|
| synthesis | `(none available — using pinned fallback)` |
| chat | `(none available — using pinned fallback)` |
| triage | `(none available — using pinned fallback)` |
| scoutBreadth | `(none available — using pinned fallback)` |
| scoutDeep | `(none available — using pinned fallback)` |

## Claude — available flagship models (0)
_none returned (check ANTHROPIC_API_KEY secret)_

## Gemini — available flash/pro models (0)
_none returned (check GEMINI_API_KEY secret)_

---
_Automated by `scripts/model-review.mjs`. Selection logic lives in `lib/ai/models.ts`._
