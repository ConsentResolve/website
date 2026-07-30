// Speed-to-Lead — Retell (AI voice) webhook. build step 7 + step 10 (disclosure).
//   POST /api/stl/retell/webhook
// Updates the call record from call_started / call_ended / call_analyzed events and
// verifies Ruby's AI-disclosure phrase in the transcript (spec §8.4 — 100%, hard fail).
import { ensureStlSchema } from "../_lib/stl/schema.js";
import { logEvent } from "../_lib/stl/classifier.js";
import { alert } from "../_lib/stl/adapters.js";
import { json } from "../_lib/http.js";

// Ruby must identify as an AI. Any transcript missing this is a P1.
const DISCLOSURE_RE = /\b(a[n]?\s+)?(ai|artificial intelligence)\b/i;
const RUBY_RE = /\bruby\b/i;

export async function onRequestPost({ request, env }) {
  await ensureStlSchema(env);
  let ev = {};
  try { ev = await request.json(); } catch (_) { return json({ ok: false }, { status: 400 }); }
  const call = ev.call || ev.data || ev;
  const meta = call.metadata || {};
  const tpId = meta.touchpoint_id;
  const eventName = ev.event || ev.event_type || call.call_status;
  if (!tpId) return json({ ok: true, note: "no touchpoint_id" });

  const transcript = call.transcript || (Array.isArray(call.transcript_object)
    ? call.transcript_object.map((t) => `${t.role}: ${t.content}`).join("\n") : "") || "";
  const answered = ["ended", "call_ended", "call_analyzed", "ongoing"].includes(eventName) && call.disconnection_reason !== "dial_no_answer" ? 1 : 0;
  const durationS = call.duration_ms ? Math.round(call.duration_ms / 1000) : (call.call_length_seconds || null);
  const disclosureOk = transcript ? (DISCLOSURE_RE.test(transcript) && RUBY_RE.test(transcript) ? 1 : 0) : null;

  await env.DB.prepare(
    `UPDATE stl_calls SET provider_call_id=COALESCE(?, provider_call_id), answered=?, disclosure_ok=COALESCE(?, disclosure_ok) WHERE touchpoint_id=?`
  ).bind(call.call_id || null, answered, disclosureOk, tpId).run().catch(() => {});

  if (transcript) {
    await env.DB.prepare("UPDATE stl_touchpoints SET transcript=?, duration_seconds=COALESCE(?, duration_seconds), outcome=? WHERE id=?")
      .bind(transcript.slice(0, 8000), durationS, answered ? "connected_dm" : "no_answer", tpId).run().catch(() => {});
  }

  if (disclosureOk === 0) {
    await alert(env, `P1: Retell call ${call.call_id || tpId} missing AI-disclosure phrase in transcript.`);
    await logEvent(env, meta.lead_id || null, "disclosure_fail", { touchpoint_id: tpId, call_id: call.call_id });
  }
  return json({ ok: true });
}
