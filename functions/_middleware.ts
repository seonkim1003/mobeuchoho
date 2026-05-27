// Pages Functions middleware — runs on every request under /functions/**.
//
// Responsibilities:
//   1. Same-origin CORS guardrails (deny cross-origin POST to /api/submit).
//   2. IP-based rate limiting for POST /api/submit (10 / hour / IP) via KV.
//
// Reads `env.CACHE` (KV) and optional `env.ALLOWED_ORIGIN`.

interface Env {
  CACHE: KVNamespace;
  ALLOWED_ORIGIN?: string;
}

const SUBMIT_PATH = "/api/submit";
const RATE_LIMIT_PER_HOUR = 10;

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env, next } = ctx;
  const url = new URL(request.url);

  // ---- CORS / same-origin enforcement ----
  // Allow same-origin requests unconditionally. For cross-origin, only
  // accept when ALLOWED_ORIGIN is explicitly configured and matches.
  const origin = request.headers.get("Origin");
  if (origin) {
    const sameOrigin = origin === url.origin;
    const allowedExplicit =
      env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN;
    if (!sameOrigin && !allowedExplicit) {
      return jsonError(403, "origin_not_allowed");
    }
    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
  }

  // ---- Rate limit (POST /api/submit only) ----
  if (request.method === "POST" && url.pathname === SUBMIT_PATH) {
    const ip =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ||
      "unknown";
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const key = `rl:submit:${ip}:${hourBucket}`;

    const current = parseInt((await env.CACHE.get(key)) || "0", 10);
    if (current >= RATE_LIMIT_PER_HOUR) {
      return jsonError(429, "rate_limited", {
        "Retry-After": String(3600 - (Math.floor(Date.now() / 1000) % 3600)),
      });
    }
    // Increment counter with TTL slightly over an hour so the bucket
    // self-expires after it stops being relevant.
    ctx.waitUntil(
      env.CACHE.put(key, String(current + 1), { expirationTtl: 3900 }),
    );
  }

  const response = await next();

  // Attach CORS headers on the way out for allowed origins.
  if (origin) {
    const out = new Response(response.body, response);
    out.headers.set("Access-Control-Allow-Origin", origin);
    out.headers.set("Vary", "Origin");
    return out;
  }
  return response;
};

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
