import * as OCL from "openchemlib";

interface Env {
  DB: D1Database;
  ADMIN_KEY: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL: string;
  FROM_EMAIL: string;
  PUBLIC_BASE: string;
}

const MAX_PER_USER = 3;
const MAX_ID_LEN = 64;
const MAX_QUESTION_LEN = 1000;
const MAX_NAME_LEN = 32;
const MAX_EMAIL_LEN = 128;
const MAX_ANSWER_LEN = 4000;
const MAX_BODY_BYTES = 16 * 1024;

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

async function readJson(req: Request): Promise<unknown | null> {
  const lenHeader = req.headers.get("Content-Length");
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) return null;
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalize(s: string): string {
  return s.normalize("NFC").trim().toLowerCase();
}

function cleanId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ID_LEN) return null;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  return trimmed;
}

function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed.charCodeAt(i);
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) return null;
  }
  return trimmed;
}

function cleanOptionalText(raw: unknown, max: number): string | null | undefined {
  if (raw === undefined || raw === null || raw === "") return null;
  return cleanText(raw, max);
}

function looksLikeEmail(s: string): boolean {
  // Minimal sanity check, not RFC-perfect; we'll trust Resend for the rest.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= MAX_EMAIL_LEN;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  } as Record<string, string>)[c]);
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────────────────────────────────────
// Email via Resend
// ─────────────────────────────────────────────────────────

async function sendEmail(
  env: Env,
  args: { to: string; subject: string; text: string; html?: string; replyTo?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set; skipping email to", args.to);
    return { ok: false, error: "no_api_key" };
  }
  const payload: Record<string, unknown> = {
    from: env.FROM_EMAIL,
    to: [args.to],
    subject: args.subject,
    text: args.text,
  };
  if (args.html) payload.html = args.html;
  if (args.replyTo) payload.reply_to = args.replyTo;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Resend send failed:", res.status, body);
      return { ok: false, error: `status_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("Resend send threw:", e);
    return { ok: false, error: "fetch_failed" };
  }
}

// ─────────────────────────────────────────────────────────
// Match endpoints (existing)
// ─────────────────────────────────────────────────────────

async function handleSubmit(req: Request, env: Env, origin: string | null): Promise<Response> {
  const body = await readJson(req);
  if (body === null) return jsonResponse({ error: "invalid_json" }, 400, origin);
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
  ).bind(myNorm).first<{ n: number }>();
  if ((countRow?.n ?? 0) >= MAX_PER_USER) {
    return jsonResponse({ error: "limit_reached", limit: MAX_PER_USER }, 400, origin);
  }
  const dup = await env.DB.prepare(
    "SELECT 1 FROM submissions WHERE my_id_norm = ?1 AND target_id_norm = ?2 AND withdrawn = 0 LIMIT 1"
  ).bind(myNorm, tgtNorm).first();
  if (dup) {
    return jsonResponse({ error: "duplicate" }, 400, origin);
  }
  const token = generateToken();
  const now = Date.now();
  const reverse = await env.DB.prepare(
    "SELECT token FROM submissions WHERE my_id_norm = ?1 AND target_id_norm = ?2 AND withdrawn = 0 LIMIT 1"
  ).bind(tgtNorm, myNorm).first<{ token: string }>();
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
  ).bind(token, myClean, myNorm, tgtClean, tgtNorm, now).run();
  return jsonResponse({ token, status: "pending" }, 200, origin);
}

async function handleCheck(url: URL, env: Env, origin: string | null): Promise<Response> {
  const token = url.searchParams.get("token") || "";
  if (token.length === 0 || token.length > 64) {
    return jsonResponse({ error: "invalid_token" }, 400, origin);
  }
  const row = await env.DB.prepare(
    "SELECT matched_at, withdrawn FROM submissions WHERE token = ?1"
  ).bind(token).first<{ matched_at: number | null; withdrawn: number }>();
  if (!row) return jsonResponse({ status: "not_found" }, 404, origin);
  if (row.withdrawn) return jsonResponse({ status: "withdrawn" }, 200, origin);
  if (row.matched_at) return jsonResponse({ status: "matched" }, 200, origin);
  return jsonResponse({ status: "pending" }, 200, origin);
}

async function handleWithdraw(req: Request, env: Env, origin: string | null): Promise<Response> {
  const body = await readJson(req);
  if (body === null) return jsonResponse({ error: "invalid_json" }, 400, origin);
  const b = body as { token?: unknown };
  if (typeof b?.token !== "string" || b.token.length === 0 || b.token.length > 64) {
    return jsonResponse({ error: "invalid_token" }, 400, origin);
  }
  const res = await env.DB.prepare(
    "UPDATE submissions SET withdrawn = 1 WHERE token = ?1 AND withdrawn = 0"
  ).bind(b.token).run();
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

// ─────────────────────────────────────────────────────────
// AMA endpoints
// ─────────────────────────────────────────────────────────

async function handleAmaSubmit(req: Request, env: Env, origin: string | null): Promise<Response> {
  const body = await readJson(req);
  if (body === null) return jsonResponse({ error: "invalid_json" }, 400, origin);
  const b = body as { question?: unknown; name?: unknown; email?: unknown };

  const question = cleanText(b?.question, MAX_QUESTION_LEN);
  if (!question) return jsonResponse({ error: "invalid_question" }, 400, origin);

  const name = cleanOptionalText(b?.name, MAX_NAME_LEN);
  if (name === null && b?.name !== undefined && b?.name !== null && b?.name !== "") {
    return jsonResponse({ error: "invalid_name" }, 400, origin);
  }

  let email: string | null = null;
  if (b?.email !== undefined && b?.email !== null && b?.email !== "") {
    const e = cleanText(b.email, MAX_EMAIL_LEN);
    if (!e || !looksLikeEmail(e)) {
      return jsonResponse({ error: "invalid_email" }, 400, origin);
    }
    email = e;
  }

  const now = Date.now();
  const result = await env.DB.prepare(
    "INSERT INTO ama_questions (question, name, email, created_at, status) VALUES (?1, ?2, ?3, ?4, 'pending')"
  ).bind(question, name ?? null, email, now).run();

  const id = Number(result.meta.last_row_id ?? 0);

  // Fire-and-forget notification email to admin
  const adminCurl =
    `curl -X POST ${env.PUBLIC_BASE}/ama/answer \\\n` +
    `  -H 'Content-Type: application/json' \\\n` +
    `  -d '{"key":"<ADMIN_KEY>","id":${id},"answer":"...","mode":"public"}'`;

  const subjectPreview = question.length > 60 ? question.slice(0, 60) + "…" : question;
  const text = [
    `New AMA question (#${id})`,
    "",
    `From: ${name ?? "(anonymous)"}${email ? ` <${email}>` : ""}`,
    `Time: ${new Date(now).toISOString()}`,
    "",
    "Question:",
    question,
    "",
    "—",
    "To answer publicly (will appear on /widget/ama/):",
    adminCurl,
    "",
    email
      ? "To reply privately: just hit Reply in your mail client — Reply-To is set to the asker's email."
      : "(Asker did not leave an email, so private reply isn't possible.)",
    "",
    'To delete the question: same endpoint, body {"key":"...","id":' + id + ',"mode":"hide"}.',
  ].join("\n");

  await sendEmail(env, {
    to: env.NOTIFY_EMAIL,
    subject: `[AMA #${id}] ${subjectPreview}`,
    text,
    replyTo: email ?? undefined,
  });

  return jsonResponse({ ok: true, id }, 200, origin);
}

async function handleAmaList(url: URL, env: Env, origin: string | null): Promise<Response> {
  // Optional pagination via ?limit=N&offset=M
  const limitRaw = parseInt(url.searchParams.get("limit") || "50", 10);
  const offsetRaw = parseInt(url.searchParams.get("offset") || "0", 10);
  const limit = Math.min(Math.max(isFinite(limitRaw) ? limitRaw : 50, 1), 200);
  const offset = Math.max(isFinite(offsetRaw) ? offsetRaw : 0, 0);

  const rows = await env.DB.prepare(
    "SELECT id, question, name, answer, answered_at FROM ama_questions " +
    "WHERE status = 'answered' " +
    "ORDER BY answered_at DESC " +
    "LIMIT ?1 OFFSET ?2"
  ).bind(limit, offset).all();

  return jsonResponse({ rows: rows.results }, 200, origin);
}

async function handleAmaAdminList(url: URL, env: Env, origin: string | null): Promise<Response> {
  const key = url.searchParams.get("key") || "";
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }
  const statusFilter = url.searchParams.get("status"); // pending / answered / private / hidden / null = all
  let query: string;
  let binds: unknown[] = [];
  if (statusFilter) {
    query = "SELECT id, question, name, email, created_at, status, answer, answered_at FROM ama_questions WHERE status = ?1 ORDER BY created_at DESC";
    binds = [statusFilter];
  } else {
    query = "SELECT id, question, name, email, created_at, status, answer, answered_at FROM ama_questions ORDER BY created_at DESC";
  }
  const stmt = env.DB.prepare(query);
  const rows = await (binds.length ? stmt.bind(...binds) : stmt).all();
  return jsonResponse({ rows: rows.results }, 200, origin);
}

async function handleAmaAnswer(req: Request, env: Env, origin: string | null): Promise<Response> {
  const body = await readJson(req);
  if (body === null) return jsonResponse({ error: "invalid_json" }, 400, origin);
  const b = body as { key?: unknown; id?: unknown; answer?: unknown; mode?: unknown };

  if (typeof b?.key !== "string" || !env.ADMIN_KEY || b.key !== env.ADMIN_KEY) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }
  const id = Number(b?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonResponse({ error: "invalid_id" }, 400, origin);
  }
  const mode = b?.mode === "hide" ? "hide" : "public";

  if (mode === "hide") {
    const res = await env.DB.prepare(
      "UPDATE ama_questions SET status = 'hidden' WHERE id = ?1"
    ).bind(id).run();
    if ((res.meta.changes ?? 0) === 0) {
      return jsonResponse({ error: "not_found" }, 404, origin);
    }
    return jsonResponse({ ok: true, action: "hidden" }, 200, origin);
  }

  const answer = cleanText(b?.answer, MAX_ANSWER_LEN);
  if (!answer) return jsonResponse({ error: "invalid_answer" }, 400, origin);

  const res = await env.DB.prepare(
    "UPDATE ama_questions SET answer = ?1, answered_at = ?2, status = 'answered' WHERE id = ?3"
  ).bind(answer, Date.now(), id).run();
  if ((res.meta.changes ?? 0) === 0) {
    return jsonResponse({ error: "not_found" }, 404, origin);
  }

  return jsonResponse({ ok: true, action: "answered" }, 200, origin);
}

// ─────────────────────────────────────────────────────────
// Geoguess leaderboard
// ─────────────────────────────────────────────────────────

const GEO_ROUNDS = 5;
const GEO_MAX_SCORE_PER_ROUND = 5000;
const GEO_MAX_TOTAL = GEO_ROUNDS * GEO_MAX_SCORE_PER_ROUND;
const GEO_MAX_NAME_LEN = 20;
const GEO_LB_MAX_LIMIT = 100;

async function handleGeoSubmit(req: Request, env: Env, origin: string | null): Promise<Response> {
  const body = await readJson(req);
  if (body === null) return jsonResponse({ error: "invalid_json" }, 400, origin);
  const b = body as { name?: unknown; score?: unknown; breakdown?: unknown };

  const name = cleanText(b?.name, GEO_MAX_NAME_LEN);
  if (!name) return jsonResponse({ error: "invalid_name" }, 400, origin);

  const score = Number(b?.score);
  if (!Number.isInteger(score) || score < 0 || score > GEO_MAX_TOTAL) {
    return jsonResponse({ error: "invalid_score" }, 400, origin);
  }

  let breakdownJson: string | null = null;
  if (Array.isArray(b?.breakdown)) {
    // Keep at most 10 rounds, each {dist, score}, both numbers, score in range.
    const arr = (b.breakdown as unknown[]).slice(0, 10).map((row) => {
      const r = row as { dist?: unknown; score?: unknown };
      const d = Number(r?.dist);
      const s = Number(r?.score);
      return {
        dist: isFinite(d) ? d : null,
        score: Number.isInteger(s) && s >= 0 && s <= GEO_MAX_SCORE_PER_ROUND ? s : 0,
      };
    });
    const sum = arr.reduce((a, x) => a + x.score, 0);
    if (sum !== score) {
      return jsonResponse({ error: "breakdown_score_mismatch" }, 400, origin);
    }
    breakdownJson = JSON.stringify(arr);
  }

  const now = Date.now();
  const ip = req.headers.get("CF-Connecting-IP") || "";
  const ins = await env.DB.prepare(
    "INSERT INTO geoguess_scores (name, score, breakdown, created_at, ip) VALUES (?1, ?2, ?3, ?4, ?5)"
  ).bind(name, score, breakdownJson, now, ip).run();
  const id = Number(ins.meta.last_row_id ?? 0);

  const rankRow = await env.DB.prepare(
    "SELECT COUNT(*) + 1 AS rank FROM geoguess_scores WHERE score > ?1"
  ).bind(score).first<{ rank: number }>();

  return jsonResponse({ ok: true, id, rank: rankRow?.rank ?? null }, 200, origin);
}

async function handleGeoLeaderboard(url: URL, env: Env, origin: string | null): Promise<Response> {
  const limitRaw = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Math.min(Math.max(isFinite(limitRaw) ? limitRaw : 20, 1), GEO_LB_MAX_LIMIT);
  const rows = await env.DB.prepare(
    "SELECT id, name, score, breakdown, created_at FROM geoguess_scores ORDER BY score DESC, created_at ASC LIMIT ?1"
  ).bind(limit).all();
  const totalRow = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM geoguess_scores"
  ).first<{ n: number }>();
  return jsonResponse({ rows: rows.results, total: totalRow?.n ?? 0 }, 200, origin);
}

async function handleGeoAdminDelete(req: Request, env: Env, origin: string | null): Promise<Response> {
  const body = await readJson(req);
  if (body === null) return jsonResponse({ error: "invalid_json" }, 400, origin);
  const b = body as { key?: unknown; id?: unknown };
  if (typeof b?.key !== "string" || !env.ADMIN_KEY || b.key !== env.ADMIN_KEY) {
    return jsonResponse({ error: "forbidden" }, 403, origin);
  }
  const id = Number(b?.id);
  if (!Number.isInteger(id) || id <= 0) return jsonResponse({ error: "invalid_id" }, 400, origin);
  const res = await env.DB.prepare("DELETE FROM geoguess_scores WHERE id = ?1").bind(id).run();
  if ((res.meta.changes ?? 0) === 0) return jsonResponse({ error: "not_found" }, 404, origin);
  return jsonResponse({ ok: true }, 200, origin);
}

// ─────────────────────────────────────────────────────────
// SMILES → SVG (public embed endpoint)
// ─────────────────────────────────────────────────────────

const MAX_SMILES_LEN = 500;
const MIN_SVG_DIM = 50;
const MAX_SVG_DIM = 1200;

function placeholderSvg(w: number, h: number, msg: string): Response {
  const text = escapeHtml(msg).slice(0, 60);
  const body =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="100%" height="100%" fill="#fafafa" stroke="#ddd"/>` +
    `<text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="#999" text-anchor="middle" dominant-baseline="middle">${text}</text>` +
    `</svg>`;
  return new Response(body, {
    status: 400,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function clampDim(raw: string | null, fallback: number): number {
  const n = parseInt(raw || "", 10);
  if (!isFinite(n)) return fallback;
  return Math.min(Math.max(n, MIN_SVG_DIM), MAX_SVG_DIM);
}

async function handleMolSvg(url: URL): Promise<Response> {
  const smiles = (url.searchParams.get("smiles") || "").trim();
  if (!smiles) return placeholderSvg(300, 200, "no smiles");
  if (smiles.length > MAX_SMILES_LEN) return placeholderSvg(300, 200, "smiles too long");

  const w = clampDim(url.searchParams.get("w"), 400);
  const h = clampDim(url.searchParams.get("h"), 300);

  let svg: string;
  try {
    const mol = OCL.Molecule.fromSmiles(smiles);
    if (!mol || mol.getAllAtoms() === 0) return placeholderSvg(w, h, "empty molecule");
    svg = mol.toSVG(w, h);
  } catch (e) {
    return placeholderSvg(w, h, "invalid SMILES");
  }

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Cache aggressively at CF edge; SVG is deterministic per (smiles, w, h)
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ─────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Match
    if (req.method === "POST" && url.pathname === "/submit") return handleSubmit(req, env, origin);
    if (req.method === "GET" && url.pathname === "/check") return handleCheck(url, env, origin);
    if (req.method === "POST" && url.pathname === "/withdraw") return handleWithdraw(req, env, origin);
    if (req.method === "GET" && url.pathname === "/admin/list") return handleAdminList(url, env, origin);

    // AMA
    if (req.method === "POST" && url.pathname === "/ama/submit") return handleAmaSubmit(req, env, origin);
    if (req.method === "GET" && url.pathname === "/ama/list") return handleAmaList(url, env, origin);
    if (req.method === "GET" && url.pathname === "/ama/admin/list") return handleAmaAdminList(url, env, origin);
    if (req.method === "POST" && url.pathname === "/ama/answer") return handleAmaAnswer(req, env, origin);

    // Public SMILES-to-SVG embed
    if (req.method === "GET" && url.pathname === "/mol/svg") return handleMolSvg(url);

    // Geoguess leaderboard
    if (req.method === "POST" && url.pathname === "/geo/score")        return handleGeoSubmit(req, env, origin);
    if (req.method === "GET"  && url.pathname === "/geo/leaderboard")  return handleGeoLeaderboard(url, env, origin);
    if (req.method === "POST" && url.pathname === "/geo/admin/delete") return handleGeoAdminDelete(req, env, origin);

    return jsonResponse({ error: "not_found" }, 404, origin);
  },
};
