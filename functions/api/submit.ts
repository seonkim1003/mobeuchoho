// POST /api/submit — accept a completed quiz session.
//
// Flow:
//   1. Validate payload structure (strict shape, 10 answers, A/B sides).
//   2. Verify Turnstile token with Cloudflare siteverify.
//   3. Insert one row into `sessions` and 10 rows into `answers` (batched).
//   4. Emit one Analytics Engine datapoint per answer.
//   5. Return 204 No Content on success.
//
// All client-supplied fields are domain-checked before they touch the DB.

interface Env {
  DB: D1Database;
  // Analytics Engine is optional — the binding is omitted when the
  // account hasn't enabled AE yet. submit() guards every write.
  AE?: AnalyticsEngineDataset;
  TURNSTILE_SECRET: string;
}

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const EXPECTED_ANSWERS_LEN = 10;

const AGE_BANDS = new Set([
  "under_18",
  "18_24",
  "25_34",
  "35_44",
  "45_54",
  "55_64",
  "65_plus",
  "prefer_not",
]);
const EDUCATION_LEVELS = new Set([
  "less_than_hs",
  "hs",
  "some_college",
  "bachelors",
  "masters",
  "doctorate",
  "prefer_not",
]);
const NATIVE_ENGLISH = new Set(["yes", "no", "prefer_not"]);
const GENDERS = new Set([
  "female",
  "male",
  "non_binary",
  "self_describe",
  "prefer_not",
]);
const AI_FAMILIARITY = new Set(["never", "sometimes", "daily", "prefer_not"]);

// ---- Post-survey allowed values (all optional / nullable) ----
const SURVEY_YSN = new Set(["yes", "somewhat", "no"]);
const SURVEY_USEFUL = new Set(["very", "somewhat", "not"]);
const SURVEY_CONFIDENCE = new Set([
  "much_more",
  "somewhat_more",
  "same",
  "less",
]);
const SURVEY_COURSE = new Set(["very", "somewhat", "neutral", "not"]);

interface PostSurvey {
  learned: string | null;
  useful: string | null;
  rating: number | null;
  confidence: string | null;
  ai_changed: string | null;
  learned_ai: string | null;
  course_effectiveness: string | null;
}

interface Demographics {
  age_band: string | null;
  education: string | null;
  native_english: string | null;
  gender: string | null;
  ai_familiarity: string | null;
}

interface Answer {
  q_index: number;
  pair_genre: string;
  ai_side: "A" | "B";
  user_pick: "A" | "B";
  correct: boolean;
  latency_ms: number;
}

interface Payload {
  session_id: string;
  started_at: number;
  finished_at: number;
  user_agent_hint: "mobile" | "desktop";
  turnstile_token: string;
  demographics: Demographics;
  answers: Answer[];
  post_survey: PostSurvey;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  // ---- Parse + validate ----
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json");
  }

  const parsed = validatePayload(body);
  if (!parsed.ok) return jsonError(400, parsed.error);
  const payload = parsed.value;

  // ---- Turnstile verification (skipped when no token is supplied) ----
  // The frontend stopped rendering the Turnstile widget, so payloads will
  // arrive without a token. We still verify when a token IS sent so the
  // widget can be re-enabled later by simply restoring the frontend code.
  if (payload.turnstile_token) {
    const ip = request.headers.get("CF-Connecting-IP") || undefined;
    const turnstileOk = await verifyTurnstile(
      env.TURNSTILE_SECRET,
      payload.turnstile_token,
      ip,
    );
    if (!turnstileOk) return jsonError(403, "turnstile_failed");
  }

  // ---- D1 insert (batched for atomic-ish semantics) ----
  const country = request.headers.get("CF-IPCountry") || null;
  const createdAt = Date.now();

  // Use OR IGNORE on the sessions insert to make submit idempotent — a
  // retried request for the same session_id will be a no-op rather than
  // a 500. We still want the answers to be insert-only (no duplicates).
  const sessionStmt = env.DB.prepare(
    `INSERT OR IGNORE INTO sessions
     (id, started_at, finished_at, ua_hint, country, created_at,
      age_band, education, native_english, gender, ai_familiarity,
      learned, useful, rating, confidence, ai_changed, learned_ai,
      course_effectiveness)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    payload.session_id,
    payload.started_at,
    payload.finished_at,
    payload.user_agent_hint,
    country,
    createdAt,
    payload.demographics.age_band,
    payload.demographics.education,
    payload.demographics.native_english,
    payload.demographics.gender,
    payload.demographics.ai_familiarity,
    payload.post_survey.learned,
    payload.post_survey.useful,
    payload.post_survey.rating,
    payload.post_survey.confidence,
    payload.post_survey.ai_changed,
    payload.post_survey.learned_ai,
    payload.post_survey.course_effectiveness,
  );

  const answerStmts = payload.answers.map((a) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO answers
       (session_id, q_index, pair_genre, ai_side, user_pick, correct, latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      payload.session_id,
      a.q_index,
      a.pair_genre,
      a.ai_side,
      a.user_pick,
      a.correct ? 1 : 0,
      a.latency_ms,
    ),
  );

  try {
    await env.DB.batch([sessionStmt, ...answerStmts]);
  } catch (err) {
    console.error("d1_batch_failed", { session_id: payload.session_id, err });
    return jsonError(500, "db_write_failed");
  }

  // ---- Analytics Engine: one datapoint per answer ----
  // Optional — skipped when the AE binding isn't configured yet.
  // blobs = string dimensions (genre, ua_hint, country)
  // doubles = numeric metrics (correct=0/1, latency_ms)
  // indexes = high-cardinality lookup key (session_id, capped to 96 bytes)
  if (env.AE) {
    for (const a of payload.answers) {
      env.AE.writeDataPoint({
        blobs: [a.pair_genre, payload.user_agent_hint, country || ""],
        doubles: [a.correct ? 1 : 0, a.latency_ms],
        indexes: [payload.session_id.slice(0, 96)],
      });
    }
  }

  return new Response(null, { status: 204 });
};

// Reject other methods explicitly so tooling sees a deterministic answer.
export const onRequest: PagesFunction<Env> = async ({ request }) => {
  return jsonError(405, "method_not_allowed", { Allow: "POST" });
};

// ---------- helpers ----------

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function validatePayload(body: unknown): Result<Payload> {
  if (!isObject(body)) return { ok: false, error: "payload_not_object" };

  const session_id = body.session_id;
  if (!isUuidV4(session_id)) return { ok: false, error: "bad_session_id" };

  const started_at = body.started_at;
  const finished_at = body.finished_at;
  if (!isFiniteInt(started_at) || !isFiniteInt(finished_at))
    return { ok: false, error: "bad_timestamp" };
  if (finished_at < started_at)
    return { ok: false, error: "finished_before_started" };

  const user_agent_hint = body.user_agent_hint;
  if (user_agent_hint !== "mobile" && user_agent_hint !== "desktop")
    return { ok: false, error: "bad_user_agent_hint" };

  const turnstile_token =
    typeof body.turnstile_token === "string" ? body.turnstile_token : "";
  if (turnstile_token.length > 4096)
    return { ok: false, error: "turnstile_token_too_long" };

  const demographicsParsed = validateDemographics(body.demographics);
  if (!demographicsParsed.ok) return demographicsParsed;

  const answers = body.answers;
  if (!Array.isArray(answers) || answers.length !== EXPECTED_ANSWERS_LEN)
    return { ok: false, error: "bad_answers_length" };

  const validatedAnswers: Answer[] = [];
  const seenIndexes = new Set<number>();
  for (const a of answers) {
    if (!isObject(a)) return { ok: false, error: "answer_not_object" };
    if (
      !isFiniteInt(a.q_index) ||
      a.q_index < 0 ||
      a.q_index >= EXPECTED_ANSWERS_LEN
    )
      return { ok: false, error: "bad_q_index" };
    if (seenIndexes.has(a.q_index))
      return { ok: false, error: "duplicate_q_index" };
    seenIndexes.add(a.q_index);

    if (typeof a.pair_genre !== "string" || a.pair_genre.length === 0)
      return { ok: false, error: "bad_pair_genre" };
    if (a.pair_genre.length > 64)
      return { ok: false, error: "pair_genre_too_long" };

    if (a.ai_side !== "A" && a.ai_side !== "B")
      return { ok: false, error: "bad_ai_side" };
    if (a.user_pick !== "A" && a.user_pick !== "B")
      return { ok: false, error: "bad_user_pick" };
    if (typeof a.correct !== "boolean")
      return { ok: false, error: "bad_correct" };
    if (a.correct !== (a.user_pick === a.ai_side))
      return { ok: false, error: "correct_mismatch" };

    if (
      !isFiniteInt(a.latency_ms) ||
      a.latency_ms < 0 ||
      a.latency_ms > 24 * 3600 * 1000
    )
      return { ok: false, error: "bad_latency_ms" };

    validatedAnswers.push({
      q_index: a.q_index,
      pair_genre: a.pair_genre,
      ai_side: a.ai_side,
      user_pick: a.user_pick,
      correct: a.correct,
      latency_ms: a.latency_ms,
    });
  }

  return {
    ok: true,
    value: {
      session_id,
      started_at,
      finished_at,
      user_agent_hint,
      turnstile_token,
      demographics: demographicsParsed.value,
      answers: validatedAnswers,
      post_survey: parseSurvey(body.post_survey),
    },
  };
}

// Post-survey is best-effort: never reject a submission over it. Any missing
// or out-of-domain field is stored as NULL rather than failing validation.
function parseSurvey(raw: unknown): PostSurvey {
  const obj = isObject(raw) ? raw : {};
  const pick = (v: unknown, allowed: Set<string>): string | null =>
    typeof v === "string" && allowed.has(v) ? v : null;

  let rating: number | null = null;
  const r = Number(obj.rating);
  if (Number.isInteger(r) && r >= 1 && r <= 5) rating = r;

  return {
    learned: pick(obj.learned, SURVEY_YSN),
    useful: pick(obj.useful, SURVEY_USEFUL),
    rating,
    confidence: pick(obj.confidence, SURVEY_CONFIDENCE),
    ai_changed: pick(obj.ai_changed, SURVEY_YSN),
    learned_ai: pick(obj.learned_ai, SURVEY_YSN),
    course_effectiveness: pick(obj.course_effectiveness, SURVEY_COURSE),
  };
}

function validateDemographics(raw: unknown): Result<Demographics> {
  if (!isObject(raw)) return { ok: false, error: "bad_demographics" };

  const requiredKeys = [
    "age_band",
    "education",
    "native_english",
    "gender",
    "ai_familiarity",
  ] as const;
  for (const key of requiredKeys) {
    if (!(key in raw)) return { ok: false, error: "bad_demographics" };
  }

  const age_band = normalizeDemoField(raw.age_band, AGE_BANDS);
  if (age_band === false) return { ok: false, error: "bad_age_band" };

  const education = normalizeDemoField(raw.education, EDUCATION_LEVELS);
  if (education === false) return { ok: false, error: "bad_education" };

  const native_english = normalizeDemoField(raw.native_english, NATIVE_ENGLISH);
  if (native_english === false) return { ok: false, error: "bad_native_english" };

  const gender = normalizeDemoField(raw.gender, GENDERS);
  if (gender === false) return { ok: false, error: "bad_gender" };

  const ai_familiarity = normalizeDemoField(raw.ai_familiarity, AI_FAMILIARITY);
  if (ai_familiarity === false) return { ok: false, error: "bad_ai_familiarity" };

  return {
    ok: true,
    value: {
      age_band,
      education,
      native_english,
      gender,
      ai_familiarity,
    },
  };
}

/** Map prefer_not and empty string to null; reject unknown values. */
function normalizeDemoField(
  v: unknown,
  allowed: Set<string>,
): string | null | false {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !allowed.has(v)) return false;
  if (v === "prefer_not") return null;
  return v;
}

async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  if (!secret) {
    console.error("turnstile_secret_missing");
    return false;
  }
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: form,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("turnstile_request_failed", err);
    return false;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isFiniteInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v);
}
function isUuidV4(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  );
}
function jsonError(
  status: number,
  code: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
