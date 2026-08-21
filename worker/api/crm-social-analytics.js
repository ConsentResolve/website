// Social Media Analytics — /api/crm/analytics/social
//
// Feeds the "Social Media" section on /crm/app#analytics. Built to add channels one at
// a time: each channel is a self-contained entry in CHANNELS below, returning the same
// {channel, label, updated_at, live, stats[], rows[]} shape so the frontend renders any
// number of channel cards from one generic loop — adding a channel later means adding
// one function here + one card in crm-app.html, nothing else changes.
//
// Two channel kinds:
//   - LIVE channels (e.g. linkedin_organic) compute straight from tables this Worker
//     already owns (social_queue) — accurate on every request, no sync needed.
//   - SNAPSHOT channels (e.g. gojiberry) can't be computed live: this Worker has no
//     Gojiberry API key (only the reverse — Gojiberry pushes leads TO us), so there's
//     nothing to query in real time. Snapshot channels read the last value a sync job
//     pushed into social_analytics_snapshots via POST (automation-key gated, same
//     pattern as prospecting-gojiberry.js) — a scheduled Claude session with Gojiberry
//     MCP access is what pushes those snapshots today.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS social_analytics_snapshots (
       channel TEXT PRIMARY KEY, metrics TEXT NOT NULL, synced_at TEXT DEFAULT (datetime('now')))`
  ).run();
}

function authedAutomation(request, env) {
  const key = env.CR_AUTOMATION_KEY;
  if (!key) return false;
  const given = request.headers.get("X-CR-Automation-Key") || new URL(request.url).searchParams.get("key") || "";
  return given.length === key.length && given === key;
}

async function linkedinOrganic(env) {
  const rows = (await env.DB.prepare(
    "SELECT status, COUNT(*) n, MAX(published_at) last_pub FROM social_queue WHERE platform='linkedin_company' GROUP BY status"
  ).all()).results || [];
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  const lastPub = rows.map((r) => r.last_pub).filter(Boolean).sort().pop() || null;
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const last7 = await env.DB.prepare(
    "SELECT COUNT(*) n FROM social_queue WHERE platform='linkedin_company' AND status='published' AND published_at >= ?"
  ).bind(since7).first().catch(() => ({ n: 0 }));
  return {
    channel: "linkedin_organic",
    label: "LinkedIn — Company Page",
    updated_at: new Date().toISOString(),
    live: true,
    stats: [
      { value: byStatus.published || 0, label: "Published" },
      { value: (last7 && last7.n) || 0, label: "Last 7 days" },
      { value: byStatus.scheduled || 0, label: "Scheduled" },
      { value: byStatus.ready_to_publish || 0, label: "Ready to publish" },
    ],
    rows: [],
    note: lastPub ? `Last published ${lastPub}` : "Nothing published yet",
    todo: "Engagement (likes/comments/shares) isn't wired yet — needs Buffer's analytics API confirmed against BUFFER_TOKEN. Publish counts above are exact; engagement is not shown until that's built.",
  };
}

async function gojiberrySnapshot(env) {
  await ensureTable(env);
  const row = await env.DB.prepare("SELECT metrics, synced_at FROM social_analytics_snapshots WHERE channel='gojiberry'").first().catch(() => null);
  if (!row) {
    return {
      channel: "gojiberry", label: "Gojiberry — LinkedIn Lead Gen", updated_at: null, live: false,
      stats: [], rows: [], note: "No sync yet.",
    };
  }
  let m = {}; try { m = JSON.parse(row.metrics || "{}"); } catch (_) {}
  return {
    channel: "gojiberry",
    label: "Gojiberry — LinkedIn Lead Gen",
    updated_at: row.synced_at,
    live: false,
    stats: [
      { value: m.total_contacts || 0, label: "Contacts loaded" },
      { value: m.invited || 0, label: "Connections sent" },
      { value: m.accepted || 0, label: "Accepted", sub: m.invited ? Math.round((m.accepted / m.invited) * 100) + "%" : null },
      { value: m.replied || 0, label: "Replies" },
    ],
    rows: m.by_campaign || [],
    note: `Last synced ${row.synced_at} — snapshot from a scheduled Gojiberry pull, not live (no API key wired into this Worker).`,
  };
}

const CHANNELS = { linkedin_organic: linkedinOrganic, gojiberry: gojiberrySnapshot };

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: { ...corsHeaders(request, env), "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-CR-Automation-Key" } });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const channels = await Promise.all(Object.values(CHANNELS).map((fn) => fn(env)));
  return json({ ok: true, channels }, {}, cors);
}

// Sync ingest — a channel's own sync job (currently: a scheduled Claude session pulling
// Gojiberry via MCP) pushes its latest metrics here. Automation-key gated like the
// Gojiberry inbound webhook, not the CRM session cookie, since the caller isn't a
// logged-in browser.
export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!authedAutomation(request, env)) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureTable(env);
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }
  const { channel, metrics } = b || {};
  if (!channel || !metrics) return json({ ok: false, error: "missing_channel_or_metrics" }, { status: 400 }, cors);
  await env.DB.prepare(
    "INSERT INTO social_analytics_snapshots (channel, metrics, synced_at) VALUES (?,?,datetime('now')) ON CONFLICT(channel) DO UPDATE SET metrics=excluded.metrics, synced_at=excluded.synced_at"
  ).bind(channel, JSON.stringify(metrics)).run();
  return json({ ok: true, channel }, {}, cors);
}
