# Person 1 Plan: Frontend + Cloudflare Pages Delivery

## Mission

Own the quiz client experience and deployment setup for data collection:
- Capture answer-level telemetry in the browser.
- Submit completed quiz data to the backend contract.
- Add a public stats page that reads aggregate results.
- Deploy on Cloudflare Pages with production-safe client settings.

This plan is self-contained and intentionally avoids backend implementation details beyond the shared API contract.

## Scope You Own

- `index.html`
- `styles.css`
- `quiz.js`
- `stats.html` (new)
- `stats.js` (new)
- `public/_headers` (new, CSP/security headers)
- Cloudflare Pages project/dashboard configuration

Do not edit:
- `functions/**`
- `migrations/**`
- `wrangler.toml`
- `docs/api.md`

## Shared API Contract (Canonical Inputs/Outputs)

Use this contract exactly when sending data and rendering stats.

POST `/api/submit` request body:

```json
{
  "session_id": "uuid-v4",
  "started_at": 1748370000000,
  "finished_at": 1748370180000,
  "user_agent_hint": "mobile|desktop",
  "turnstile_token": "...",
  "answers": [
    {
      "q_index": 0,
      "pair_genre": "Poetry",
      "ai_side": "A",
      "user_pick": "B",
      "correct": false,
      "latency_ms": 8421
    }
  ]
}
```

GET `/api/stats` response:

```json
{
  "n_sessions": 1234,
  "overall_accuracy": 0.61,
  "per_genre": {
    "Poetry": {"n": 1234, "accuracy": 0.42},
    "Literary fiction": {"n": 1234, "accuracy": 0.58}
  },
  "updated_at": 1748370200000
}
```

## Implementation Steps

1. Add client session telemetry model in `quiz.js`:
   - `session_id` via `crypto.randomUUID()` when user clicks consent agree.
   - `started_at` in epoch ms.
   - track per-question latency with `performance.now()`.
   - `state.telemetry` array with shape:
     - `q_index`
     - `pair_genre`
     - `ai_side`
     - `user_pick`
     - `correct`
     - `latency_ms`

2. Capture telemetry in `answer(pick)`:
   - determine `ai_side` from existing layout logic.
   - compute `correct` from selected side.
   - push one telemetry row per question.
   - reset per-question timer before rendering next question.

3. Submit on completion:
   - after final question and before results rendering, call `POST /api/submit`.
   - include:
     - `session_id`
     - `started_at`
     - `finished_at`
     - `user_agent_hint` (`mobile` or `desktop` from viewport/user agent heuristic)
     - `turnstile_token`
     - `answers` (`state.telemetry`)
   - submission should be non-blocking:
     - use `fetch` with `keepalive: true` if suitable.
     - swallow network failures and continue UX.

4. Add Turnstile to consent step in `index.html`:
   - render widget before enabling actual quiz start.
   - store token for inclusion in submit payload.
   - handle token refresh/expiration gracefully.

5. Add stats page:
   - create `stats.html` and `stats.js`.
   - request `GET /api/stats`.
   - render:
     - total sessions
     - overall accuracy (percent)
     - per-genre breakdown (`n` and `accuracy`)
     - last updated timestamp
   - include empty/error states for unavailable data.

6. Add client security/perf basics:
   - create `public/_headers` with baseline CSP and security headers.
   - ensure static assets still load under chosen CSP.

7. Deploy on Cloudflare Pages:
   - connect repo and set build command to none.
   - output directory `/`.
   - configure custom domain.
   - verify preview deploy on each push.
   - add Cloudflare Web Analytics snippet to `index.html`.

8. Local development independence:
   - add `MOCK_API=true` toggle (simple const/flag) to run without backend.
   - when enabled:
     - fake successful `/api/submit`
     - return canned `/api/stats` payload for `stats.html`

## Suggested Milestones

- Milestone 1: telemetry object complete and validated in console.
- Milestone 2: quiz completion submits payload with no UX regression.
- Milestone 3: Turnstile integrated and token captured.
- Milestone 4: `stats.html` live and rendering real endpoint.
- Milestone 5: Pages production deployment and custom domain working.

## Acceptance Checklist

- [ ] `quiz.js` records all five answers with required fields.
- [ ] Submission payload exactly matches contract keys/types.
- [ ] Results screen always appears even if submit fails.
- [ ] Turnstile token is present in submit payload.
- [ ] `stats.html` shows total, overall accuracy, per-genre metrics.
- [ ] Mock mode supports frontend-only local testing.
- [ ] Cloudflare Pages production deployment succeeds.
- [ ] Cloudflare Web Analytics installed and collecting page hits.
- [ ] No edits made to backend-owned files.
