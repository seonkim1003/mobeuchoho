# Quiz Backend API

Canonical reference for the Cloudflare Pages Functions that back the AI-vs-human quiz. The frontend (Person 1's scope) should treat this document as the source of truth for request/response shapes.

---

## Overview

- Runtime: Cloudflare Pages Functions (TypeScript).
- Routes:
  - `POST /api/submit` — accept a completed session.
  - `GET /api/stats` — aggregate stats for the public stats page.
- Middleware (`functions/_middleware.ts`):
  - Same-origin CORS gate (cross-origin only allowed when `ALLOWED_ORIGIN` is set).
  - IP-based rate limit on `POST /api/submit` — 10 requests / hour / IP.

---

## `POST /api/submit`

Submit a completed quiz session. Idempotent on `session_id` (a duplicate POST is a no-op, not an error).

### Headers

| Header | Required | Notes |
|---|---|---|
| `Content-Type: application/json` | yes | |
| `Origin` | optional | If present, must match the runtime origin (or `ALLOWED_ORIGIN`). |

### Request body

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "started_at": 1748370000000,
  "finished_at": 1748370180000,
  "user_agent_hint": "desktop",
  "turnstile_token": "0.cQ8...",
  "demographics": {
    "age_band": "25_34",
    "education": "bachelors",
    "native_english": "yes",
    "gender": null,
    "ai_familiarity": "sometimes"
  },
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

### Validation rules

| Field | Rule |
|---|---|
| `session_id` | RFC-4122 UUID v4 (string). |
| `started_at`, `finished_at` | Finite integer epoch ms; `finished_at >= started_at`. |
| `user_agent_hint` | Exactly `"mobile"` or `"desktop"`. |
| `turnstile_token` | Non-empty string, ≤ 4096 chars. |
| `demographics` | Required object with keys `age_band`, `education`, `native_english`, `gender`, `ai_familiarity`. Each value is `null` (prefer not to say) or one of the allowed enum strings below. |
| `demographics.age_band` | `null` or: `under_18`, `18_24`, `25_34`, `35_44`, `45_54`, `55_64`, `65_plus`. |
| `demographics.education` | `null` or: `less_than_hs`, `hs`, `some_college`, `bachelors`, `masters`, `doctorate`. |
| `demographics.native_english` | `null` or: `yes`, `no`. |
| `demographics.gender` | `null` or: `female`, `male`, `non_binary`, `self_describe`. |
| `demographics.ai_familiarity` | `null` or: `never`, `sometimes`, `daily`. |
| `answers` | Array of exactly **10** answer objects (5 text + 5 image). |
| `q_index` | Integer in `[0, 10)`, unique within payload. |
| `pair_genre` | Non-empty string, ≤ 64 chars. |
| `ai_side`, `user_pick` | Exactly `"A"` or `"B"`. |
| `correct` | Boolean. Must equal `user_pick === ai_side`. |
| `latency_ms` | Integer in `[0, 86400000]`. |

### Responses

| Status | Body | When |
|---|---|---|
| `204 No Content` | empty | Validation, Turnstile, and DB write all succeeded. |
| `400 Bad Request` | `{"error": "<code>"}` | Payload validation failed. Codes: `invalid_json`, `payload_not_object`, `bad_session_id`, `bad_timestamp`, `finished_before_started`, `bad_user_agent_hint`, `missing_turnstile_token`, `turnstile_token_too_long`, `bad_demographics`, `bad_age_band`, `bad_education`, `bad_native_english`, `bad_gender`, `bad_ai_familiarity`, `bad_answers_length`, `answer_not_object`, `bad_q_index`, `duplicate_q_index`, `bad_pair_genre`, `pair_genre_too_long`, `bad_ai_side`, `bad_user_pick`, `bad_correct`, `correct_mismatch`, `bad_latency_ms`. |
| `403 Forbidden` | `{"error": "turnstile_failed"}` or `{"error": "origin_not_allowed"}` | Turnstile siteverify rejected the token, or the `Origin` header is cross-origin and not whitelisted. |
| `405 Method Not Allowed` | `{"error": "method_not_allowed"}` | Method other than POST. `Allow: POST`. |
| `429 Too Many Requests` | `{"error": "rate_limited"}` | More than 10 submissions in the current hour from this IP. `Retry-After` header set. |
| `500 Internal Server Error` | `{"error": "db_write_failed"}` | D1 insert raised. Inspect logs. |

### Sample curl

```sh
curl -sS -X POST https://YOUR-PAGES.pages.dev/api/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "session_id":"550e8400-e29b-41d4-a716-446655440000",
    "started_at":1748370000000,
    "finished_at":1748370180000,
    "user_agent_hint":"desktop",
    "turnstile_token":"PASTE_TOKEN_HERE",
    "answers":[
      {"q_index":0,"pair_genre":"Poetry","ai_side":"A","user_pick":"B","correct":false,"latency_ms":8421},
      {"q_index":1,"pair_genre":"Literary fiction","ai_side":"B","user_pick":"B","correct":true,"latency_ms":7100},
      {"q_index":2,"pair_genre":"Detective fiction","ai_side":"A","user_pick":"A","correct":true,"latency_ms":6300},
      {"q_index":3,"pair_genre":"Essay / opinion","ai_side":"B","user_pick":"A","correct":false,"latency_ms":9000},
      {"q_index":4,"pair_genre":"Nature writing","ai_side":"A","user_pick":"A","correct":true,"latency_ms":5200}
    ]
  }' -i
```

---

## `GET /api/stats`

Return cached aggregate stats for the public stats page. Cached in KV with 60-second TTL.

### Response

```json
{
  "n_sessions": 1234,
  "overall_accuracy": 0.61,
  "per_genre": {
    "Poetry":          {"n": 1234, "accuracy": 0.42},
    "Literary fiction":{"n": 1234, "accuracy": 0.58}
  },
  "updated_at": 1748370200000
}
```

- `overall_accuracy` and per-genre `accuracy` are decimals in `[0, 1]`, rounded to 4 decimal places.
- `updated_at` is the epoch-ms when the cached entry was computed.
- `X-Cache: HIT|MISS` response header lets you see the cache state.

### Responses

| Status | Body | When |
|---|---|---|
| `200 OK` | Stats JSON | Always on a healthy DB / cache. |
| `405 Method Not Allowed` | `{"error":"method_not_allowed"}` | Non-GET request. |
| `500 Internal Server Error` | `{"error":"db_read_failed"}` | D1 query failed. |

### Sample curl

```sh
curl -sS https://YOUR-PAGES.pages.dev/api/stats | jq
```

---

## One-time setup (account owner)

These commands provision the Cloudflare resources referenced by `wrangler.toml`. Run them once, then paste the returned IDs into `wrangler.toml`.

```sh
# 1. D1 database
wrangler d1 create englishproject-db
# → copy database_id into [[d1_databases]] in wrangler.toml

# 2. Apply schema (remote = production D1)
wrangler d1 execute englishproject-db --file=migrations/0001_init.sql --remote
wrangler d1 execute englishproject-db --file=migrations/0002_demographics.sql --remote

# 3. KV namespace (used for stats cache + rate-limit counters)
wrangler kv namespace create STATS_CACHE
# → copy `id` into [[kv_namespaces]] in wrangler.toml

# 4. Analytics Engine dataset
# Datasets are auto-created on first writeDataPoint; no CLI step required.
# Verify in the Cloudflare dashboard → Analytics Engine after a few submissions.

# 5. Turnstile site key + secret
#    Create a Turnstile site at https://dash.cloudflare.com/?to=/:account/turnstile
#    Frontend uses the site key (public). Backend uses the secret:
wrangler pages secret put TURNSTILE_SECRET --project-name mobeuchoho
# → paste secret when prompted

# 6. Optional cross-origin allowlist
wrangler pages secret put ALLOWED_ORIGIN --project-name mobeuchoho
# → only needed if frontend is on a different host than the Functions runtime
```

After provisioning, deploy:

```sh
wrangler pages deploy . --project-name mobeuchoho
```

---

## Test plan

### Validation tests (curl, against deployed preview)

| Scenario | Expected |
|---|---|
| Valid payload + valid token | 204 |
| Missing `turnstile_token` | 400 `missing_turnstile_token` |
| `answers.length !== 10` | 400 `bad_answers_length` |
| `correct` doesn't match `user_pick === ai_side` | 400 `correct_mismatch` |
| Bad Turnstile token | 403 `turnstile_failed` |
| 11th POST in the same hour from one IP | 429 `rate_limited` |
| `GET /api/submit` | 405 `method_not_allowed` |

### D1 verification

```sh
wrangler d1 execute englishproject-db --remote \
  --command "SELECT COUNT(*) AS s FROM sessions; SELECT COUNT(*) AS a FROM answers;"
```

`a` should be `10 * s` if every session inserted cleanly.

### Stats verification

```sh
# First call: X-Cache: MISS
curl -sS -i https://YOUR-PAGES.pages.dev/api/stats | head
# Second call within 60s: X-Cache: HIT
```

Shape matches the contract; numeric fields are present even when the table is empty (zeros / empty `per_genre`).

---

## Notes for the frontend owner (Person 1)

- Send `user_agent_hint` based on a viewport heuristic; the backend only checks for the literal strings `"mobile"` or `"desktop"`.
- The backend computes `correct` from `ai_side === user_pick`, so you must send a consistent boolean — payloads where `correct` disagrees with `ai_side/user_pick` are rejected with `correct_mismatch`. This catches double-bugs in the layout logic.
- Submissions are fire-and-forget from your perspective; the response body on success is empty (204), so always navigate to results regardless of submit outcome.
- For local dev without the backend, your `MOCK_API` toggle can short-circuit before the fetch.
