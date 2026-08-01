// Live chat transcript — GET /api/crm/chat-live?chat_id=X  (CRM-gated).
// Pulls the current transcript for an in-progress Retell chat so the CRM can poll it and
// show the conversation in near-real-time. Also refreshes the stored message so a plain
// reload shows the latest even without an open poller. Retell has no per-message webhook,
// so this poll is how "watch it live" works.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!env.RETELL_API_KEY) return json({ ok: false, error: "no_retell_key" }, { status: 200 }, cors);
  const chatId = new URL(request.url).searchParams.get("chat_id");
  if (!chatId) return json({ ok: false, error: "chat_id_required" }, { status: 400 }, cors);
  try {
    const r = await fetch(`https://api.retellai.com/get-chat/${encodeURIComponent(chatId)}`, {
      headers: { Authorization: `Bearer ${env.RETELL_API_KEY}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, error: `retell_${r.status}`, detail: String(j.message || "").slice(0, 160) }, { status: 200 }, cors);

    const msgs = j.message_with_tool_calls || j.messages || j.transcript_object || [];
    let transcript = typeof j.transcript === "string" ? j.transcript : "";
    if (!transcript && Array.isArray(msgs)) {
      transcript = msgs
        .map((m) => `${/agent|assistant|bot/.test(String(m.role || "").toLowerCase()) ? "Mack" : "Them"}: ${m.content || m.message || m.text || ""}`)
        .filter((l) => l.trim().length > 5)
        .join("\n");
    }
    const status = j.chat_status || j.status || "ongoing";
    const ended = /end/i.test(String(status));

    // Keep the stored message current (thread key = "retell-chat:"+chatId, set on open).
    const body = "🟢 Website chat — Mack (AI)" + (ended ? " (ended)" : " — live") + (transcript ? "\n\n" + transcript : "\n\n(waiting for the first message…)");
    await env.DB.prepare("UPDATE messages SET body_text=? WHERE external_message_id=?").bind(body, "retell-chat:" + chatId).run().catch(() => {});

    return json({ ok: true, chat_id: chatId, status, ended, transcript }, {}, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160) }, { status: 200 }, cors);
  }
}
