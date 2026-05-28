// GET /api/stats — aggregate quiz statistics for the public stats page.
//
// Strategy: KV-cache the response for 60s. On cache miss, compute from D1
// with two cheap aggregations (overall + per-genre).

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

const CACHE_KEY = "stats:v2";
const CACHE_TTL_SECONDS = 60;

type DemoBuckets = Record<string, { n: number; accuracy: number | null }>;

interface StatsResponse {
  n_sessions: number;
  overall_accuracy: number;
  per_genre: Record<string, { n: number; accuracy: number }>;
  demographics: {
    age_band: DemoBuckets;
    education: DemoBuckets;
    native_english: DemoBuckets;
    gender: DemoBuckets;
    ai_familiarity: DemoBuckets;
  };
  updated_at: number;
}

const DEMO_FIELDS = [
  "age_band",
  "education",
  "native_english",
  "gender",
  "ai_familiarity",
] as const;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // ---- Try cache first ----
  const cached = await env.CACHE.get(CACHE_KEY);
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
        "X-Cache": "HIT",
      },
    });
  }

  // ---- Compute from D1 ----
  let payload: StatsResponse;
  try {
    payload = await computeStats(env.DB);
  } catch (err) {
    console.error("stats_compute_failed", err);
    return new Response(JSON.stringify({ error: "db_read_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const json = JSON.stringify(payload);

  // Cache the response. Use waitUntil-equivalent via ctx if available; here
  // we just await so the next caller sees the warm cache immediately.
  await env.CACHE.put(CACHE_KEY, json, { expirationTtl: CACHE_TTL_SECONDS });

  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
      "X-Cache": "MISS",
    },
  });
};

// Reject non-GET so the route is well-behaved.
export const onRequest: PagesFunction<Env> = async () => {
  return new Response(JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: "GET" },
  });
};

// ---------- helpers ----------

async function computeStats(db: D1Database): Promise<StatsResponse> {
  // Overall: session count + global accuracy across all answers.
  const overall = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM sessions)                                        AS n_sessions,
         COALESCE((SELECT AVG(CAST(correct AS REAL)) FROM answers), 0.0)        AS overall_accuracy`,
    )
    .first<{ n_sessions: number; overall_accuracy: number }>();

  // Per genre: count + accuracy grouped by pair_genre.
  const perGenreRows = await db
    .prepare(
      `SELECT
         pair_genre,
         COUNT(*)                          AS n,
         AVG(CAST(correct AS REAL))        AS accuracy
       FROM answers
       GROUP BY pair_genre
       ORDER BY pair_genre`,
    )
    .all<{ pair_genre: string; n: number; accuracy: number }>();

  const per_genre: StatsResponse["per_genre"] = {};
  for (const row of perGenreRows.results ?? []) {
    per_genre[row.pair_genre] = {
      n: row.n,
      accuracy: roundTo(row.accuracy, 4),
    };
  }

  const demographics = {
    age_band: await aggregateDemographic(db, "age_band"),
    education: await aggregateDemographic(db, "education"),
    native_english: await aggregateDemographic(db, "native_english"),
    gender: await aggregateDemographic(db, "gender"),
    ai_familiarity: await aggregateDemographic(db, "ai_familiarity"),
  };

  return {
    n_sessions: overall?.n_sessions ?? 0,
    overall_accuracy: roundTo(overall?.overall_accuracy ?? 0, 4),
    per_genre,
    demographics,
    updated_at: Date.now(),
  };
}

// Per-demographic aggregation: for each bucket value of the given session
// column, return the number of sessions and average correctness across their
// answers. NULL columns (prefer-not-to-say) are bucketed as "prefer_not".
async function aggregateDemographic(
  db: D1Database,
  column: (typeof DEMO_FIELDS)[number],
): Promise<DemoBuckets> {
  const rows = await db
    .prepare(
      `SELECT
         COALESCE(s.${column}, 'prefer_not')  AS bucket,
         COUNT(DISTINCT s.id)                 AS n,
         AVG(CAST(a.correct AS REAL))         AS accuracy
       FROM sessions s
       LEFT JOIN answers a ON a.session_id = s.id
       GROUP BY bucket
       ORDER BY bucket`,
    )
    .all<{ bucket: string; n: number; accuracy: number | null }>();

  const out: DemoBuckets = {};
  for (const row of rows.results ?? []) {
    out[row.bucket] = {
      n: row.n,
      accuracy: row.accuracy == null ? null : roundTo(row.accuracy, 4),
    };
  }
  return out;
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
