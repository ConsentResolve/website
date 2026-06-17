// Reel feedback API — /api/feedback
//   POST { video, note, author? }  -> store a review note (open: anyone reviewing)
//   GET  ?key=<FEEDBACK_KEY>        -> all notes as JSON (gated by env.FEEDBACK_KEY)
// Self-initializes the reel_feedback table. Uses the existing D1 binding (env.DB).
import { json, corsHeaders } from "../_lib/http.js";

async function ensure(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS reel_feedback (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       video TEXT NOT NULL,
       note TEXT NOT NULL,
       author TEXT,
       created_at TEXT DEFAULT (datetime('now'))
     )`
  ).run();
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders(request, env), "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }); }
  await ensure(env);
  // Clear notes (gated by FEEDBACK_KEY): { action:"clear", key, video? }. Omit video to clear all.
  if (b.action === "clear") {
    if (!env.FEEDBACK_KEY || b.key !== env.FEEDBACK_KEY) return json({ error: "unauthorized" }, { status: 401 });
    const r = b.video
      ? await env.DB.prepare("DELETE FROM reel_feedback WHERE video = ?").bind(b.video.toString().slice(0, 120)).run()
      : await env.DB.prepare("DELETE FROM reel_feedback").run();
    return json({ ok: true, cleared: r.meta?.changes ?? null, video: b.video || "ALL" });
  }
  const video = (b.video || "").toString().slice(0, 120);
  const note = (b.note || "").toString().slice(0, 4000);
  const author = (b.author || "").toString().slice(0, 80);
  if (!video || !note.trim()) return json({ error: "missing_fields", need: "video, note" }, { status: 400 });
  await env.DB.prepare("INSERT INTO reel_feedback (video, note, author) VALUES (?, ?, ?)").bind(video, note, author).run();
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const key = env.FEEDBACK_KEY;
  if (!key) return json({ error: "read_disabled", message: "Set FEEDBACK_KEY env to enable reads." }, { status: 503 });
  if (new URL(request.url).searchParams.get("key") !== key) return json({ error: "unauthorized" }, { status: 401 });
  await ensure(env);
  const { results } = await env.DB.prepare(
    "SELECT video, note, author, created_at FROM reel_feedback ORDER BY video, created_at DESC"
  ).all();
  return json({ count: results.length, feedback: results });
}
