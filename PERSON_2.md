# Person 2 Plan: Pages Functions + D1 + Analytics Engine

## Mission

Own all server-side ingestion, validation, storage, and aggregate reporting for the AI-vs-human quiz:
- Accept signed client submissions.
- Validate anti-bot proof and payload shape.
- Persist research-grade records in D1.
- Emit aggregate-friendly events to Analytics Engine.
- Serve lightweight stats JSON to power the public stats page.

This plan is self-contained and does not require frontend file changes.

## Scope You Own

- `functions/api/submit.ts` (new)
- `functions/api/stats.ts` (new)
- `functions/_middleware.ts` (new)
- `migrations/0001_init.sql` (new)
- `wrangler.toml` (bindings/secrets references only)
- `docs/api.md` (new, endpoint and schema documentation)

Do not edit:
- `index.html`
- `styles.css`
- `quiz.js`
- `stats.html`
- `stats.js`

## Shared API Contract (Canonical Inputs/Outputs)

Implement endpoint behavior against this exact contract.

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

## Data Model (D1)

Create and apply migration for:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  started_at INTEGER, finished_at INTEGER,
  ua_hint TEXT, country TEXT, created_at INTEGER
);
CREATE TABLE answers (
  session_id TEXT, q_index INTEGER,
  pair_genre TEXT, ai_side TEXT, user_pick TEXT,
  correct INTEGER, latency_ms INTEGER,
  PRIMARY KEY (session_id, q_index)
);
```

Recommended indexes:
- `CREATE INDEX idx_answers_genre ON answers(pair_genre);`
- `CREATE INDEX idx_sessions_created_at ON sessions(created_at);`

## Cloudflare Resources to Provision

1. D1 database:
   - create: `englishproject-db`
   - binding name: `DB`

2. Analytics Engine dataset:
   - dataset: `quiz_events`
   - binding name: `AE`

3. KV namespace for cache/rate limit:
   - namespace: `STATS_CACHE`
   - binding name: `CACHE`

4. Secret:
   - `TURNSTILE_SECRET`

Keep all bindings in `wrangler.toml` aligned with function runtime env names.

## Endpoint Implementation Steps

### 1) `functions/api/submit.ts`

- Only allow `POST`.
- Parse JSON body and strict-validate:
  - all top-level fields required.
  - `answers` must be array of length 5.
  - each answer has expected primitive types and valid side values (`A|B`).
- Verify Turnstile:
  - call `https://challenges.cloudflare.com/turnstile/v0/siteverify`
  - send `secret`, `response`, and optionally remote IP.
  - reject with 400/403 when invalid.
- Insert into D1 in a transaction-like sequence:
  - upsert/insert one row in `sessions`.
  - insert 5 rows in `answers`.
- Emit one Analytics Engine datapoint per answer:
  - genre in blobs
  - correctness in doubles (0/1)
  - session ID in indexes
- Return `204 No Content` on success.
- Return deterministic JSON errors for invalid payloads.

### 2) `functions/api/stats.ts`

- Only allow `GET`.
- First check KV key `stats:v1`.
- On cache miss, compute from D1:
  - overall:
    - session count from `sessions`
    - accuracy from `answers`
  - per genre:
    - `SELECT pair_genre, AVG(correct), COUNT(*) FROM answers GROUP BY pair_genre`
- Shape JSON exactly to shared contract.
- Store JSON in KV with 60-second TTL.
- Return `application/json` response.

### 3) `functions/_middleware.ts`

- Restrict CORS to same-origin usage pattern.
- Add IP-based rate limiting for submit:
  - key format like `rl:submit:<ip>:<hourBucket>`.
  - limit 10 submissions/hour/IP.
  - increment counter in KV and reject with 429 when over limit.
- Ensure middleware does not block GET `/api/stats`.

## Reliability and Safety Rules

- Reject malformed/partial payloads early.
- Never trust client-computed fields without type/domain checks.
- Preserve idempotency:
  - if duplicate `session_id` appears, either reject explicitly or upsert safely and prevent duplicate answer rows.
- Keep stats endpoint cheap with KV caching.
- Log structured server errors for debugging without exposing secrets.

## Testing Plan

1. Unit-like validation tests (or table-driven checks) for payload parser.
2. `curl` integration checks:
   - valid submit returns 204.
   - bad token returns 403.
   - malformed payload returns 400.
   - over rate limit returns 429.
3. D1 verification:
   - row counts in `sessions` and `answers` match submissions.
4. Stats verification:
   - `GET /api/stats` fields and numeric shapes match contract.
   - cache hit path works and updates every <= 60s.

## Documentation Requirement

Write `docs/api.md` as the canonical backend reference:
- endpoint methods
- request/response schemas
- validation rules
- error codes
- sample `curl` commands
- binding/env setup summary

## Acceptance Checklist

- [ ] D1 database/binding exists and migration applied successfully.
- [ ] Analytics Engine dataset/binding active and receiving datapoints.
- [ ] KV namespace configured for cache + rate limit.
- [ ] `TURNSTILE_SECRET` configured as Pages secret.
- [ ] `/api/submit` validates, verifies Turnstile, writes D1, writes AE, returns 204.
- [ ] `/api/stats` returns exact contract shape and uses KV TTL cache.
- [ ] Middleware rate limits submit route correctly.
- [ ] `docs/api.md` is complete and usable by frontend owner.
- [ ] No edits made to frontend-owned files.
- [x] Demographics columns added via `migrations/0002_demographics.sql` and accepted by `/api/submit`.
