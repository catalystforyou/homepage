interface Env {
  DB: D1Database;
  ADMIN_KEY: string;
}

const MAX_PER_USER = 3;
const MAX_ID_LEN = 64;
const ALLOWED_ORIGINS = new Set([
  "https://junren.li",
  "https://www.junren.li",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://junren.li";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

function normalize(s: string): string {
  return s.normalize("NFC").trim().toLowerCase();
}

function cleanId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ID_LEN) return null;
  // Reject ASCII control chars (allow Unicode letters incl. CJK)
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  return trimmed;
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleSubmit(req: Request, env: Env, origin: string | null): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  const b = body as { my_id?: unknown; target_id?: unknown };
  const myClean = cleanId(b?.my_id);
  const tgtClean = cleanId(b?.target_id);
  if (!myClean || !tgtClean) {
    return jsonResponse({ error: "invalid_input" }, 400, origin);
  }

  const myNorm = normalize(myClean);
  const tgtNorm = normalize(tgtClean);
  if (myNorm === tgtNorm) {
    return jsonResponse({ error: "self_match" }, 400, origin);
  }

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM submissions WHERE my_id_norm = ?1 AND withdrawn = 0"
  )
    .bind(myNorm)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= MAX_PER_USER) {
    return jsonResponse({ error: "limit_reached", limit: MAX_PER_USER }, 400, origin);
  }

  const dup = await env.DB.prepare(
    "SELECT 1 FROM submissions WHERE my_id_norm = ?1 AND target_id_norm = ?2 AND withdrawn = 0 LIMIT 1"
  )
    .bind(myNorm, tgtNorm)
    .first();
  if (dup) {
    return jsonResponse({ error: "duplicate" }, 400, origin);
  }

  const token = generateToken();
  const now = Date.now();

  const reverse = await env.DB.prepare(
    "SELECT token FROM submissions WHERE my_id_norm = ?1 AND target_id_norm = ?2 AND withdrawn = 0 LIMIT 1"
  )
    .bind(tgtNorm, myNorm)
    .first<{ token: string }>();

  if (reverse) {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO submissions (token, my_id, my_id_norm, target_id, target_id_norm, created_at, matched_at, withdrawn) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)"
      ).bind(token, myClean, myNorm, tgtClean, tgtNorm, now, now),
      env.DB.prepare(
        "UPDATE submissions SET matched_at = ?1 WHERE token = ?2 AND matched_at IS NULL"
      ).bind(now, reverse.token),
    ]);
    return jsonResponse({ token, status: "matched" }, 200, origin);
  }

  await env.DB.prepare(
    "INSERT INTO submissions (token, my_id, my_id_norm, target_id, target_id_norm, created_at, withdrawn) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)"
  )
    .bind(token, myClean, myNorm, tgtClean, tgtNorm, now)
    .run();
  return jsonResponse({ token, status: "pending" }, 200, origin);
}

async function handleCheck(url: URL, env: Env, origin: string | null): Promise<Response> {
  const token = url.searchParams.get("token") || "";
  if (token.length === 0 || token.length > 64) {
    return jsonResponse({ error: "invalid_token" }, 400, origin);
  }
  const row = await env.DB.prepare(
    "SELECT matched_at, withdrawn FROM submissions WHERE token = ?1"
  )
    .bind(token)
    .first<{ matched_at: number | null; withdrawn: number }>();
  if (!row) {
    return jsonResponse({ status: "not_found" }, 404, origin);
  }
  if (row.withdrawn) {
    return jsonResponse({ status: "withdrawn" }, 200, origin);
  }
  if (row.matched_at) {
    return jsonResponse({ status: "matched" }, 200, origin);
  }
  return jsonResponse({ status: "pending" }, 200, origin);
}

async function handleWithdraw(req: Request, env: Env, origin: string | null): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  const b = body as { token?: unknown };
  if (typeof b?.token !== "string" || b.token.length === 0 || b.token.length > 64) {
    return jsonResponse({ error: "invalid_token" }, 400, origin);
  }
  const res = await env.DB.prepare(
    "UPDATE submissions SET withdrawn = 1 WHERE token = ?1 AND withdrawn = 0"
  )
    .bind(b.token)
    .run();
  if ((res.meta.changes ?? 0) === 0) {
    return jsonResponse({ error: "not_found_or_already_withdrawn" }, 404, origin);
  }
  return jsonResponse({ ok: true }, 200, origin);
}

async function handleAdminList(url: URL, env: Env, origin: string | null): Promise<Response> {
  const key = url.searchParams.get("key") || "";
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }
  const rows = await env.DB.prepare(
    "SELECT token, my_id, target_id, created_at, matched_at, withdrawn FROM submissions ORDER BY (matched_at IS NULL), matched_at DESC, created_at DESC"
  ).all();
  return jsonResponse({ rows: rows.results }, 200, origin);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (req.method === "POST" && url.pathname === "/submit") {
      return handleSubmit(req, env, origin);
    }
    if (req.method === "GET" && url.pathname === "/check") {
      return handleCheck(url, env, origin);
    }
    if (req.method === "POST" && url.pathname === "/withdraw") {
      return handleWithdraw(req, env, origin);
    }
    if (req.method === "GET" && url.pathname === "/admin/list") {
      return handleAdminList(url, env, origin);
    }
    return jsonResponse({ error: "not_found" }, 404, origin);
  },
};
