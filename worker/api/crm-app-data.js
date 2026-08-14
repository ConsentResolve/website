// worker/api/crm-app-data.js  ->  GET /api/crm/app
// Real-data read endpoint for the rebuild frontend + migration verification.
// Returns fixture-shaped slices backed by the new tables (consent_records,
// workflows/runs/steps, crm_events) and v2 (conversations/contacts). The frozen
// /crm/app can Object.assign these onto its window.* globals (fixture->fetch swap).
// Session-gated (cr_crm). This is the growing API contract — clean screens first.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { currentUser } from "../_lib/crm-v2.js";
import { crmSessionEmail } from "../_lib/auth.js";
import { getUserSettings } from "../_lib/user-settings.js";
import { ensureRebuildSchema } from "../_lib/crm-rebuild.js";
import { ensureScoringSchema, TIER_SLA_MIN } from "../_lib/lead-scoring.js";
import { computeSources } from "../_lib/sitespy.js";
import { listSpyLeads } from "./crm-spy.js";
import { IV_RAW } from "../_lib/iv-sequence.js";
import { buildAnalytics } from "../_lib/analytics.js";
import { getAiCreditsStatus } from "../_lib/ai-credits.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureRebuildSchema(env);
  await ensureScoringSchema(env); // guarantees contacts.tier / lead_score exist before we SELECT them
  // Fast refresh: the ops pipeline re-fetches JUST its data on view-entry / manual refresh, so it
  // never shows a stale page-load snapshot. Skip building the whole app payload.
  if (new URL(request.url).searchParams.get("only") === "pipeline") {
    let P = null; try { P = await buildPipeline(env); } catch (_) {}
    return json({ PIPELINE: P, ts: Date.now() }, {}, cors);
  }
  const me = await currentUser(request, env).catch(() => null);
  // Always resolve who's signed in — fall back to the Google session email even when
  // there's no users-table row, so the header chip never shows a stale demo name.
  const sessEmail = await crmSessionEmail(request, env).catch(() => null);
  const nameFromEmail = (e) => (e || "").split("@")[0].split(/[._-]+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") || (e || "");
  const uset = sessEmail ? await getUserSettings(env, sessEmail).catch(() => ({})) : {};
  const meOut = (me || sessEmail)
    ? {
        email: me ? me.email : sessEmail,
        name: uset.name || (me ? me.name : nameFromEmail(sessEmail)),
        role: me ? me.role : "member",
        title: uset.title || "",
        avatar: uset.avatar || "",
      }
    : null;

  // ---- Consent ledger (backed by consent_records) ----
  // One row per (contact, event) with channels merged — matches the ledger UI shape
  // { ts, name, co, ch[], action, basis, form, ip, proof }.
  const consentRows = (await env.DB.prepare(
    `SELECT cr.occurred_at, cr.channel, cr.action, cr.basis, cr.capture_method method,
            cr.disclosure_text, cr.ip, cr.email, cr.phone, cr.contact_id,
            c.full_name name, co.name company
       FROM consent_records cr
       LEFT JOIN contacts c ON c.id = cr.contact_id
       LEFT JOIN companies co ON co.id = c.company_id
      ORDER BY cr.occurred_at DESC LIMIT 400`
  ).all()).results || [];
  const groups = new Map();
  for (const r of consentRows) {
    const key = `${r.contact_id || r.email}|${r.occurred_at}|${r.action}|${r.method}`;
    let g = groups.get(key);
    if (!g) { g = { occurred_at: r.occurred_at, name: r.name || r.email || "—", co: r.company || "",
                    action: r.action, method: r.method, ch: [], ip: r.ip || "", disclosure: r.disclosure_text || "",
                    contact_id: r.contact_id || null, email: r.email || "", phone: r.phone || "" }; groups.set(key, g); }
    if (!g.phone && r.phone) g.phone = r.phone;
    if (!g.ch.includes(r.channel)) g.ch.push(r.channel);
    if (!g.ip && r.ip) g.ip = r.ip;
    if (!g.disclosure && r.disclosure_text) g.disclosure = r.disclosure_text;
  }
  // Manual consent verifications (kept OUT of the immutable ledger). Keyed by a stable signature.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS consent_verifications (vkey TEXT PRIMARY KEY, verified_by TEXT, verified_by_name TEXT, verified_at TEXT)`).run().catch(() => {});
  const vmap = new Map((((await env.DB.prepare("SELECT vkey, verified_by_name, verified_at FROM consent_verifications").all().catch(() => ({ results: [] }))).results) || []).map((v) => [v.vkey, v]));
  const chOrder = { email: 0, sms: 1, voice: 2 };
  const CONSENT_LEDGER = [...groups.values()].slice(0, 120).map((g) => {
    const hasPewc = g.ch.includes("sms") || g.ch.includes("voice");
    const basis = consentBasis(g.method, hasPewc, g.action);
    const vkey = `${g.contact_id || g.email}|${g.occurred_at}|${g.action}|${g.method}`;
    const v = vmap.get(vkey);
    return {
      ts: humanTime(g.occurred_at),
      name: g.name, co: g.co,
      contact_id: g.contact_id || null, email: g.email || "", phone: g.phone || "",
      ch: g.ch.sort((a, b) => (chOrder[a] ?? 9) - (chOrder[b] ?? 9)),
      action: g.action,
      basis,
      form: consentForm(g.method),
      ip: g.ip,
      // Use the stored disclosure only if it's real proof text (migrated rows sometimes
      // hold just a version tag like "v1-2026-06" — fall back to the generated sentence).
      proof: (g.disclosure && g.disclosure.length > 24 && !/^v\d/i.test(g.disclosure))
        ? g.disclosure : consentProof(g.method, hasPewc, g.action),
      vkey,
      verified_by_name: v ? v.verified_by_name : null,
      verified_at: v ? v.verified_at : null,
    };
  });
  // Real stats for the KPI row + channel summary (window.CONSENT_STATS).
  const chStats = (await env.DB.prepare(
    `SELECT channel, action, COUNT(DISTINCT COALESCE(contact_id, email)) n FROM consent_records GROUP BY channel, action`
  ).all()).results || [];
  const byChannel = { email: { g: 0, r: 0 }, sms: { g: 0, r: 0 }, voice: { g: 0, r: 0 } };
  for (const s of chStats) { const b = byChannel[s.channel]; if (b) b[s.action === "revoked" ? "r" : "g"] += s.n; }
  const consentedContacts = firstRow(await env.DB.prepare("SELECT COUNT(DISTINCT COALESCE(contact_id,email)) n FROM consent_records WHERE action='granted'").all())?.n || 0;
  const pewcContacts = firstRow(await env.DB.prepare("SELECT COUNT(DISTINCT COALESCE(contact_id,email)) n FROM consent_records WHERE action='granted' AND channel='sms'").all())?.n || 0;
  const suppressionCount = firstRow(await env.DB.prepare("SELECT COUNT(*) n FROM suppressions").all())?.n || 0;
  const CONSENT_STATS = {
    consented: consentedContacts,
    suppressions: suppressionCount,
    pewcPct: consentedContacts ? Math.round((pewcContacts / consentedContacts) * 100) : 0,
    byChannel,
  };
  const consentSummary = { granted_contacts: consentedContacts, suppressions: suppressionCount, total_records: consentRows.length };

  // ---- Sequences (backed by workflows + runs + steps), shaped for renderSequences ----
  const wfs = (await env.DB.prepare("SELECT * FROM workflows WHERE enabled=1").all()).results || [];
  const seqLabel = { send_sms: "SMS", place_ai_call: "AI call (Retell)", send_email: "Email" };
  const seqCh = { send_sms: "sms", place_ai_call: "ai_call", send_email: "email" };
  const seqTiming = (m) => !m ? "Immediately" : m < 60 ? `+${m} min if no reply` : m < 1440 ? `+${Math.round(m / 60)} hr` : `+${Math.round(m / 1440)} day`;
  const SEQUENCES = [];
  for (const w of wfs) {
    const runs = firstRow(await env.DB.prepare(
      `SELECT COUNT(*) enrolled, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active,
              SUM(CASE WHEN exit_reason='replied' THEN 1 ELSE 0 END) replied,
              SUM(CASE WHEN exit_reason='booked' THEN 1 ELSE 0 END) booked,
              SUM(CASE WHEN exit_reason='opted_out' THEN 1 ELSE 0 END) opted_out
         FROM workflow_runs WHERE workflow_id=?`
    ).bind(w.id).all());
    const stepStats = (await env.DB.prepare(
      `SELECT s.step_index step_index, s.status status, COUNT(*) n
         FROM workflow_steps s JOIN workflow_runs r ON r.id=s.run_id
        WHERE r.workflow_id=? GROUP BY s.step_index, s.status`
    ).bind(w.id).all()).results || [];
    const cnt = (i, st) => stepStats.filter((x) => x.step_index === i && x.status === st).reduce((a, x) => a + x.n, 0);
    let def = []; try { def = JSON.parse(w.definition); } catch (_) {}
    const enrolled = runs.enrolled || 0;
    // Fold wait steps into the next touch's timing; only emit message nodes (SMS/call/email).
    const steps = []; let pending = 0;
    def.forEach((s, i) => {
      if (s.action === "wait") { pending += (s.delay_minutes || 0); return; }
      const sent = cnt(i, "sent"), skipped = cnt(i, "skipped");
      const out = [{ n: sent, t: "sent", tone: "good" }];
      if (skipped) out.push({ n: skipped, t: "skipped (no consent / on hold)", tone: "muted" });
      steps.push({
        ch: seqCh[s.action] || "email",
        label: seqLabel[s.action] || "Step",
        timing: seqTiming((s.delay_minutes || 0) + pending),
        entered: steps.length === 0 ? enrolled : 0,
        out,
        branch: s.action === "place_ai_call" ? "Answering-machine detection splits the path" : undefined,
      });
      pending = 0;
    });
    SEQUENCES.push({
      id: w.id, name: w.name,
      trigger: "New lead (any source)",
      goal: w.id === "earn-consent" ? "Earn consent" : "Book the demo",
      consent: safeJson(w.requires_consent, []),
      active: runs.active || 0,
      enrolled,
      replyRate: enrolled ? (runs.replied || 0) / enrolled : 0,
      goalRate: enrolled ? (runs.booked || 0) / enrolled : 0,
      optoutRate: enrolled ? (runs.opted_out || 0) / enrolled : 0,
      steps,
      editable: w.id === "identified-visitor",   // only the IV sequence is user-editable
      // Raw step definition for the editor. For IV email steps, attach the current
      // subject/html (edited override if present, else the code template default) so the
      // CRM can preview + edit the actual email.
      def: w.id === "identified-visitor" ? def.map((s) => (s.action === "send_email"
        ? { ...s, subject: s.subject || (IV_RAW[s.template] || {}).subject || "", html: s.html || (IV_RAW[s.template] || {}).html || "" }
        : s)) : def,
    });
  }

  // ---- Inbox summary (conversations by status) + funnel (crm_events) ----
  const buckets = firstRow(await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) open,
       SUM(CASE WHEN status='snoozed' THEN 1 ELSE 0 END) snoozed,
       SUM(CASE WHEN status='archived' THEN 1 ELSE 0 END) archived,
       COUNT(*) total FROM conversations`
  ).all());
  const funnel = {};
  for (const t of ["lead_created", "contacted", "replied", "booked", "signed_up", "activated"]) {
    funnel[t] = firstRow(await env.DB.prepare("SELECT COUNT(DISTINCT contact_id) n FROM crm_events WHERE type=?").bind(t).all())?.n || 0;
  }

  // ---- Inbox conversations (DATA.conversations shape) ----
  try { await env.DB.prepare("ALTER TABLE conversations ADD COLUMN snooze_note TEXT").run(); } catch (_) {} // ensure column exists before selecting it
  try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS conversation_tombstones (thread_key TEXT PRIMARY KEY, deleted_at TEXT NOT NULL DEFAULT (datetime('now')))").run(); } catch (_) {} // guarantee the tombstone table before the anti-resurrection filter
  try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, uid TEXT, session_id TEXT, name TEXT, company TEXT, website TEXT, phone TEXT, email TEXT, trade TEXT, traffic TEXT, lead_sources TEXT, start_iso TEXT, utm_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run(); } catch (_) {} // meeting subqueries below reference bookings
  // ANTI-RESURRECTION FILTER — never show a conversation whose thread was deleted. Whatever
  // re-inserts it (Gmail poll, a sync, a stray migration), a tombstoned thread stays hidden.
  // Gated on a NON-EMPTY external_thread_id so it only affects real per-thread channels (email,
  // sms, chat) — conversations that share an empty key (e.g. prospecting|) are never over-filtered.
  const convRows = (await env.DB.prepare(
    `SELECT cv.id, cv.channel, cv.status, cv.unread, cv.subject, cv.last_message_at, cv.last_message_preview, cv.snooze_until, cv.snooze_note, cv.external_thread_id, cv.created_at, cv.assignee_id,
            ct.id contact_id, ct.full_name, ct.primary_email, ct.phone, ct.source, ct.lead_score, ct.tier, ct.newsletter_status, co.name company, co.domain co_domain, co.enrichment co_enrichment, au.name assignee_name,
            (SELECT bk.start_iso FROM bookings bk WHERE bk.email = ct.primary_email AND substr(bk.start_iso,1,10) >= date('now') ORDER BY bk.start_iso ASC LIMIT 1) AS meeting_iso,
            (SELECT bk.uid FROM bookings bk WHERE bk.email = ct.primary_email AND substr(bk.start_iso,1,10) >= date('now') ORDER BY bk.start_iso ASC LIMIT 1) AS meeting_uid
       FROM conversations cv
       LEFT JOIN contacts ct ON ct.id = cv.contact_id
       LEFT JOIN companies co ON co.id = ct.company_id
       LEFT JOIN users au ON au.id = cv.assignee_id
      WHERE cv.external_thread_id IS NULL OR cv.external_thread_id = ''
         OR NOT EXISTS (SELECT 1 FROM conversation_tombstones t WHERE t.thread_key = cv.channel || '|' || cv.external_thread_id)
      ORDER BY COALESCE(cv.last_message_at, cv.created_at) DESC LIMIT 500`
  ).all()).results || [];
  const convIds = convRows.map((r) => r.id);
  const contactIds = [...new Set(convRows.map((r) => r.contact_id).filter(Boolean))];
  // D1 caps bound parameters per statement (~100). With up to 500 conversations loaded, any
  // `... IN (ids)` dependency query would exceed that and throw (which blanked the whole inbox).
  // selectIn runs the query in ≤90-id chunks and concatenates. Each entity's rows live in one
  // chunk (we chunk by the id list), so per-entity ordering is preserved.
  const selectIn = async (ids, tmpl) => {
    const out = [];
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      const sql = tmpl.replace("__IN__", `(${chunk.map(() => "?").join(",")})`);
      const rows = (await env.DB.prepare(sql).bind(...chunk).all()).results || [];
      out.push(...rows);
    }
    return out;
  };
  const msgsByConv = new Map();
  const notesByConv = new Map();
  if (convIds.length) {
    const msgs = await selectIn(convIds,
      `SELECT m.conversation_id, m.direction, m.channel, m.body_text, m.body_html, m.sent_at, u.name author_name, u.email author_email
         FROM messages m LEFT JOIN users u ON u.id = m.author_id
        WHERE m.conversation_id IN __IN__ ORDER BY m.sent_at ASC`);
    for (const m of msgs) { const a = msgsByConv.get(m.conversation_id) || []; a.push(m); msgsByConv.set(m.conversation_id, a); }
    // Notes (incl. legacy-imported ones) → shown in the Activity tab. Newest first.
    try {
      const notes = await selectIn(convIds,
        `SELECT conversation_id, body, created_at FROM notes WHERE conversation_id IN __IN__ ORDER BY created_at DESC`);
      for (const n of notes) { const a = notesByConv.get(n.conversation_id) || []; a.push(n); notesByConv.set(n.conversation_id, a); }
    } catch (_) {}
  }
  const consentByCt = new Map(), dealByCt = new Map(), runByCt = new Map(), geoByCt = new Map(), phoneByCt = new Map(), actByCt = new Map();
  if (contactIds.length) {
    // Phone identifier per contact → used as the display name for nameless (provisional)
    // contacts (e.g. inbound callers/texters) instead of a bare "Unknown".
    for (const p of await selectIn(contactIds, `SELECT contact_id, value FROM contact_identifiers WHERE type='phone' AND contact_id IN __IN__`)) {
      if (!phoneByCt.has(p.contact_id)) phoneByCt.set(p.contact_id, p.value);
    }
    for (const cr of await selectIn(contactIds, `SELECT contact_id, channel, action FROM consent_records WHERE contact_id IN __IN__ ORDER BY occurred_at ASC`)) {
      const s = consentByCt.get(cr.contact_id) || {}; s[cr.channel] = cr.action; consentByCt.set(cr.contact_id, s);
    }
    for (const d of await selectIn(contactIds, `SELECT primary_contact_id, title, value_cents, close_probability, lead_status FROM deals WHERE primary_contact_id IN __IN__`)) {
      if (!dealByCt.has(d.primary_contact_id)) dealByCt.set(d.primary_contact_id, d);
    }
    // Prefer an ACTIVE run when a contact has more than one (e.g. an old completed
    // earn-consent run plus a live identified-visitor run). The bucketing below turns an
    // active run into the "auto" bucket — so surfacing the active one keeps sequenced
    // contacts (identified visitors) out of the Open queue instead of arbitrarily landing
    // on a finished run and falling back to "open".
    for (const r of await selectIn(contactIds, `SELECT r.contact_id, r.status, r.current_step, r.exit_reason, w.name FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id WHERE r.contact_id IN __IN__ ORDER BY CASE WHEN r.status='active' THEN 0 ELSE 1 END`)) {
      if (!runByCt.has(r.contact_id) || (r.status === "active" && runByCt.get(r.contact_id).status !== "active")) runByCt.set(r.contact_id, r);
    }
    // Last-known IP + geo per contact (from the presence heartbeat, via visitor_links).
    try {
      for (const g of await selectIn(contactIds, `SELECT vl.contact_id, p.ip, p.city, p.region, p.country FROM visitor_links vl JOIN presence p ON p.vid=vl.vid WHERE vl.contact_id IN __IN__ ORDER BY p.last_seen DESC`)) {
        if (!geoByCt.has(g.contact_id)) geoByCt.set(g.contact_id, g);
      }
    } catch (_) {}
    // Recent intent events per contact (email clicks + site visits) → the Activity tab feed.
    try {
      for (const a of await selectIn(contactIds, `SELECT contact_id, type, meta, occurred_at FROM crm_events WHERE contact_id IN __IN__ AND type IN ('link_clicked','site_visit') ORDER BY occurred_at DESC LIMIT 300`)) {
        const list = actByCt.get(a.contact_id) || [];
        if (list.length >= 6) continue;
        let m = {}; try { m = JSON.parse(a.meta || "{}"); } catch (_) {}
        const label = a.type === "link_clicked"
          ? "Clicked: " + (m.label || "a link")
          : "Visited " + (m.path || "the site");
        list.push({ kind: a.type, label, ts: humanTime(a.occurred_at) || "—" });
        actByCt.set(a.contact_id, list);
      }
    } catch (_) {}
  }
  const srcMap = { meta: "meta", instantly: "instantly", crisp: "chat", chatwoot: "chat", chat: "chat", mack: "chat", site: "site", demo: "demo", claim50: "demo", cal: "demo", apollo: "apollo", partner: "partner", manual: "manual" };
  const srcLabelMap = { meta: "Meta · Lead form", instantly: "Instantly · cold email", chat: "Site chat · Mack", site: "Site · demo signup", demo: "Demo signup", apollo: "Apollo · identified", partner: "🤝 Agency partner", manual: "Manual" };
  const stripHtml = (h) => (h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const inits = (n) => (n ? n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?");
  const AVCOL = ["#00b985", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#0ea5e9"];
  const avColor = (s) => { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0; return AVCOL[Math.abs(h) % AVCOL.length]; };
  const fmtPhone = (v) => { const d = String(v || "").replace(/\D/g, ""); if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; return v ? "+" + d : null; };
  const DATA_CONVERSATIONS = convRows.map((r) => {
    const src = srcMap[r.source] || "manual";
    // Preserve the real channel so the inbox shows the right composer/label.
    // Chat variants collapse to chatwoot; phone/voice → phone; sms → sms; everything else → email.
    const channel = (r.channel === "chat" && String(r.external_thread_id || "").startsWith("phone:")) ? "sms"
      : (r.channel === "crisp" || r.channel === "chat" || r.channel === "chatwoot") ? "chat"
      : (r.channel === "phone" || r.channel === "voice" || r.channel === "speed_to_lead") ? "phone"
      : (r.channel === "sms") ? "sms"
      : "email";
    const cst = consentByCt.get(r.contact_id) || {};
    const consent = { email: cst.email || "none", sms: cst.sms || "none", voice: cst.voice || "none" };
    const run = runByCt.get(r.contact_id), deal = dealByCt.get(r.contact_id);
    const unread = !!r.unread;
    const mins = r.last_message_at ? Math.max(0, Math.round((Date.now() - Date.parse(r.last_message_at)) / 60000)) : 0;
    const bucket = r.status === "nurture" ? "nurture" : run && run.status === "active" ? "auto" : r.status === "archived" ? "suppressed" : r.status === "snoozed" ? "snoozed" : "open";
    const tier = r.tier || "cold";
    // SLA clock (minutes remaining) for Interested/Warm/Hot leads awaiting a human touch.
    const slaMin = TIER_SLA_MIN[tier] || null;
    // Who to name on each SMS/chat bubble: inbound = the person (their phone number,
    // or name/email if we have it); outbound = the human rep who sent it, else Mack (AI).
    // Only set for bubble-thread channels — email keeps its Gmail-style header untouched.
    const personLabel = fmtPhone(r.phone) || fmtPhone(phoneByCt.get(r.contact_id)) || r.full_name || r.primary_email || "Them";
    const cmsgs = (msgsByConv.get(r.id) || []).map((m) => {
      const chan = (m.channel === "crisp" || m.channel === "chatwoot") ? "chat" : m.channel;
      const isBubble = chan === "sms" || chan === "chat" || chan === "chatwoot" || chan === "phone" || chan === "voice" || chan === "speed_to_lead";
      const who = isBubble ? (m.direction === "in" ? personLabel : (m.author_name || "Mack")) : undefined;
      return {
        dir: m.direction === "in" ? "in" : "out", channel: chan, who,
        // Real author of an OUTBOUND message (who actually replied) — surfaced so the thread
        // shows the true sender, never the person currently viewing the page.
        author: m.direction === "out" ? (m.author_name || null) : null,
        author_email: m.direction === "out" ? (m.author_email || null) : null,
        body: m.body_text || stripHtml(m.body_html) || "", ts: humanTime(m.sent_at), meta: "",
        _ts: m.sent_at ? Date.parse(m.sent_at) : 0,   // sort key for threading merges
      };
    });
    const seqTotal = run && /earn/i.test(run.name || "") ? 3 : 4;
    return {
      id: r.id, bucket, source: src, channel,
      contact_id: r.contact_id || null,
      assignee_id: r.assignee_id || null,
      assignee: r.assignee_name ? { id: r.assignee_id, name: r.assignee_name, init: inits(r.assignee_name), color: avColor(r.assignee_name) } : null,
      chat_id: String(r.external_thread_id || "").startsWith("chat:") ? String(r.external_thread_id).slice(5) : null,
      live: r.channel === "chat" && r.status === "open",
      name: r.full_name || fmtPhone(phoneByCt.get(r.contact_id)) || "Unknown", company: r.company || null, contact_email: r.primary_email || null,
      contact_phone: fmtPhone(r.phone) || fmtPhone(phoneByCt.get(r.contact_id)) || null,
      initials: inits(r.full_name) === "?" && phoneByCt.get(r.contact_id) ? "📞" : inits(r.full_name),
      meeting: r.meeting_iso ? { iso: r.meeting_iso, label: humanTime(r.meeting_iso), uid: r.meeting_uid || null } : null,
      tier, score: r.lead_score || 0, sla_min: slaMin, newsletter: r.newsletter_status || "pending",
      hot: tier === "hot", unread, ts: humanTime(r.last_message_at) || "—",
      age_ts: r.last_message_at ? Date.parse(r.last_message_at) : null,   // last-activity epoch → urgency timer
      arrived_ts: (r.created_at ? Date.parse(r.created_at) : (r.last_message_at ? Date.parse(r.last_message_at) : null)),  // when the lead came in → Gmail-style date
      snooze_until: r.snooze_until || null,                               // reminder due time (ISO) when snoozed
      snooze_note: r.snooze_note || null,                                 // optional reminder note
      email_subject: channel === "email" ? (r.subject || "") : undefined,
      task: unread ? { tag: "do", text: "New message — reply.", cta: "Reply" } : { tag: "auto", text: "No action needed right now.", cta: "" },
      activity: [
        ...((notesByConv.get(r.id) || []).map((n) => ({ kind: "note", label: n.body || "", ts: humanTime(n.created_at) || "—" }))),
        ...(actByCt.get(r.contact_id) || []),
      ],
      last: { label: r.last_message_preview || "Activity on this conversation", ts: humanTime(r.last_message_at) || "—", tone: "info" },
      next: unread ? { kind: "you", label: "Reply", when: "now", tone: "act" } : { kind: "auto", label: "Waiting on them", when: "—", tone: "muted" },
      consent,
      sequence: run
        ? { step: (run.current_step || 0) + 1, total: seqTotal, label: run.name || "Sequence", status: run.exit_reason || (run.status === "active" ? "active" : "none") }
        : { step: 0, total: 0, label: "—", status: "none" },
      sla: { min: mins, level: unread ? (mins > 15 ? "bad" : mins > 5 ? "warn" : "none") : "none" },
      intel: (() => { const g = geoByCt.get(r.contact_id); return { fit: "unknown", time_on_site: "—", pages: 0, first_seen: humanTime(r.last_message_at) || "—", speed_to_lead_h: null, cost_per_lead: null, src_label: srcLabelMap[src] || "Lead", site_status: "—", pages_viewed: [], ip: g ? (g.ip || null) : null, location: g ? ([g.city, g.region, g.country].filter(Boolean).join(", ") || null) : null }; })(),
      deal: deal ? { title: deal.title || r.company || r.full_name || "Deal", value_usd: Math.round((deal.value_cents || 0) / 100), prob: deal.close_probability || 63, status: (deal.lead_status || "active").toLowerCase() } : null,
      messages: cmsgs.length ? cmsgs : [{ dir: "system", body: "No messages on this conversation yet.", ts: humanTime(r.last_message_at) || "" }],
    };
  });
  // ---- Thread by person/company (#2) ----
  // Collapse conversations that belong to the same person (contact_id) — or the same
  // company when a conversation has no contact — into ONE thread. The primary row is the
  // one with the newest activity (so the list stays newest-first and Reply defaults to the
  // newest channel); every member's messages are merged and sorted oldest→newest so the
  // thread reads top-to-bottom. Distinct named people at the same company stay separate.
  const THREADED = threadConversations(DATA_CONVERSATIONS);

  const DATA_COUNTS = {
    open: THREADED.filter((c) => c.bucket === "open").length,
    auto: THREADED.filter((c) => c.bucket === "auto").length,
    snoozed: THREADED.filter((c) => c.bucket === "snoozed").length,
    nurture: THREADED.filter((c) => c.bucket === "nurture").length,
    all: THREADED.length,
  };

  // ---- Site Spy visitors (from real site_visit events) ----
  let SITESPY = null;
  try {
    const svSince = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const svRows = (await env.DB.prepare(
      `SELECT e.contact_id, e.occurred_at, e.meta, e.company_id, c.full_name, c.source, co.name company
         FROM crm_events e
         LEFT JOIN contacts c ON c.id = e.contact_id
         LEFT JOIN companies co ON co.id = COALESCE(e.company_id, c.company_id)
        WHERE e.type='site_visit' AND e.occurred_at > ? AND e.contact_id IS NOT NULL
        ORDER BY e.occurred_at DESC`
    ).bind(svSince).all()).results || [];
    if (svRows.length) {
      const byCt = new Map();
      for (const r of svRows) {
        let g = byCt.get(r.contact_id);
        if (!g) { g = { contact_id: r.contact_id, name: r.full_name || "Unknown", company: r.company || "", source: srcMap[r.source] || "site", visits: [] }; byCt.set(r.contact_id, g); }
        let path = ""; try { path = (JSON.parse(r.meta || "{}").path) || ""; } catch (_) {}
        g.visits.push({ at: r.occurred_at, path });
      }
      const svIds = [...byCt.keys()];
      const engConv = new Set(), engRun = new Map(), engSupp = new Set();
      for (const x of await selectIn(svIds, `SELECT DISTINCT contact_id FROM conversations WHERE status='open' AND contact_id IN __IN__`)) engConv.add(x.contact_id);
      for (const x of await selectIn(svIds, `SELECT r.contact_id, w.name FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id WHERE r.status='active' AND r.contact_id IN __IN__`)) engRun.set(x.contact_id, x.name);
      for (const x of await selectIn(svIds, `SELECT DISTINCT contact_id FROM suppressions WHERE contact_id IN __IN__`)) engSupp.add(x.contact_id);
      const now = Date.now(); const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
      const visitors = [...byCt.values()].map((g) => {
        const latest = g.visits[0];
        const lastMin = Math.max(0, Math.round((now - Date.parse(latest.at)) / 60000));
        const trail = [...new Set(g.visits.slice().reverse().map((v) => v.path).filter(Boolean))].slice(-4);
        const run = engRun.get(g.contact_id);
        const eng = engSupp.has(g.contact_id) ? { suppressed: true }
          : run ? { seq: run, auto: true }
          : engConv.has(g.contact_id) ? { conv: true } : { none: true };
        return { name: g.name, company: g.company, source: g.source, live: lastMin < 5,
          page: latest.path || "/", trail: trail.length ? trail : [latest.path || "/"],
          time: "—", pages: g.visits.length, last: humanTime(latest.at), lastMin, eng };
      });
      SITESPY = {
        stats: {
          onSite: visitors.filter((v) => v.live).length,
          today: [...byCt.values()].filter((g) => Date.parse(g.visits[0].at) >= todayStart.getTime()).length,
          inWorkflow: visitors.filter((v) => v.eng.seq || v.eng.conv).length,
          netNew: visitors.filter((v) => v.eng.none).length,
        },
        visitors,
      };
    }
  } catch (_) {}

  // ---- Nurture pool (dormant contacts + intent, from crm_events) ----
  let NURTURE = null;
  try {
    const DORMANT_DAYS = 14, DAY = 864e5, now2 = Date.now();
    const daysAgo = (iso) => (iso ? Math.floor((now2 - Date.parse(iso)) / DAY) : 999);
    const agg = (await env.DB.prepare(
      `SELECT e.contact_id,
         SUM(CASE WHEN e.type='email_opened' THEN 1 ELSE 0 END) opens,
         SUM(CASE WHEN e.type='link_clicked' THEN 1 ELSE 0 END) clicks,
         SUM(CASE WHEN e.type='site_visit' THEN 1 ELSE 0 END) visits,
         MAX(CASE WHEN e.type NOT IN ('site_visit','link_clicked','email_opened') THEN e.occurred_at END) last_engage,
         MAX(CASE WHEN e.type IN ('site_visit','link_clicked') THEN e.occurred_at END) last_intent,
         c.full_name, c.source, co.name company
       FROM crm_events e
       LEFT JOIN contacts c ON c.id = e.contact_id
       LEFT JOIN companies co ON co.id = c.company_id
       WHERE e.contact_id IS NOT NULL
       GROUP BY e.contact_id`
    ).all()).results || [];
    const activeRun = new Set();
    for (const x of (await env.DB.prepare("SELECT DISTINCT contact_id FROM workflow_runs WHERE status='active'").all()).results || []) activeRun.add(x.contact_id);
    const dormant = agg.filter((r) => r.source !== "apollo" && r.last_engage && daysAgo(r.last_engage) >= DORMANT_DAYS && !activeRun.has(r.contact_id));
    const CH = ["email"]; // default keep-warm channel (SMS needs a PEWC lookup — kept honest)
    const pool = dormant.map((r) => ({
      name: r.full_name || "Unknown", company: r.company || "", source: srcMap[r.source] || "manual",
      channels: CH, cadence: "Monthly", last: humanTime(r.last_engage), next: "—",
      opens: r.opens || 0, clicks: r.clicks || 0, visits: r.visits || 0,
      dormant: daysAgo(r.last_engage), status: "dormant",
    })).sort((a, b) => a.dormant - b.dormant);
    const reengaging = dormant.filter((r) => r.last_intent && daysAgo(r.last_intent) <= 2).map((r) => ({
      name: r.full_name || "Unknown", company: r.company || "", source: srcMap[r.source] || "manual", channels: CH,
      signal: { kind: (r.clicks || 0) > (r.visits || 0) ? "click" : "visit",
                text: (r.visits || 0) > 0 ? "Came back to the site" : "Clicked a link in our email",
                when: humanTime(r.last_intent) },
      seq: { step: 0, of: 3, done: "Intent detected", next: "Turn the engine on to auto-fire the re-engage sequence" },
      dormant: daysAgo(r.last_engage),
    }));
    NURTURE = {
      stats: { total: pool.length, added7: dormant.filter((r) => daysAgo(r.last_engage) < DORMANT_DAYS + 7).length,
               cadence: pool.length, reengaging: reengaging.length, wonBack: 0, next7: 0 },
      reengaging, pool: pool.slice(0, 40),
    };
  } catch (_) {}

  // ---- Pipeline (real deals -> ops console). Built by the shared buildPipeline() so the
  // fast ?only=pipeline refresh returns byte-identical rows. ----
  let PIPELINE = null;
  try { PIPELINE = await buildPipeline(env); } catch (_) {}

  // ---- Analytics — windowed builder (default 30d; the date selector re-fetches other ranges via /api/crm/analytics/range) ----
  let ANALYTICS = null;
  try { ANALYTICS = await buildAnalytics(env, 30); } catch (_) {}
  // Data-source registry (Site Spy / Nurture transparency + extensibility).
  let SITE_SOURCES = null;
  try { SITE_SOURCES = await computeSources(env); } catch (_) {}

  // Identified-people table for Site Spy (Apollo/RB2B/CR-own/Instantly).
  let SPY_LEADS = [];
  try { SPY_LEADS = await listSpyLeads(env); } catch (_) {}

  // Persisted intel lookups (companies.enrichment written by /api/crm/lookup) → per-conversation
  // ENRICH/DIRECTORY/INTEL maps so a lookup survives a page reload.
  const ENRICH = {}, DIRECTORY = {}, INTEL = {};
  for (const r of convRows) {
    let en = null; try { en = r.co_enrichment ? JSON.parse(r.co_enrichment) : null; } catch (_) {}
    const domain = r.co_domain || (en && en.website && en.website.domain) || null;
    if (!en && !domain) continue;                 // nothing to show
    const { _directory, _intel, _last_cost, _looked_up_at, ...enr } = en || {};
    const base = { ...enr, _last_cost: _last_cost != null ? _last_cost : undefined };
    if (domain) base.website = { ...(base.website || {}), domain };   // show the saved domain even before a lookup
    ENRICH[r.id] = base;
    if (_directory) DIRECTORY[r.id] = _directory;
    if (_intel) INTEL[r.id] = _intel;
  }

  // Persisted Task-tab state (crm_task_state) so a page refresh doesn't wipe it.
  const TASKSTATE = {};
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS crm_task_state (id TEXT PRIMARY KEY, contact_id TEXT, found TEXT, done TEXT, updated_at TEXT)`).run().catch(() => {});
    const trows = (await env.DB.prepare("SELECT id, found, done FROM crm_task_state").all().catch(() => ({ results: [] }))).results || [];
    for (const t of trows) {
      let found = {}, done = [];
      try { found = t.found ? JSON.parse(t.found) : {}; } catch (_) {}
      try { done = t.done ? JSON.parse(t.done) : []; } catch (_) {}
      TASKSTATE[t.id] = { found, done };
    }
  } catch (_) {}

  const AI_CREDITS = await getAiCreditsStatus(env);

  return json({
    ok: true,
    me: meOut,
    CONSENT_LEDGER, CONSENT_STATS, consentSummary,
    SEQUENCES,
    DATA_CONVERSATIONS: THREADED, DATA_COUNTS,
    ENRICH, DIRECTORY, INTEL, TASKSTATE,
    SITESPY, NURTURE, SITE_SOURCES, SPY_LEADS, PIPELINE, ANALYTICS,
    inbox: { buckets },
    funnel,
    AI_CREDITS,
    generated_at: new Date().toISOString(),
    _note: "real-data slices for the rebuild UI + migration verification; growing per screen",
  }, {}, cors);
}

function firstRow(res) { return (res.results && res.results[0]) || {}; }
function safeJson(s, d) { try { return JSON.parse(s); } catch (_) { return d; } }

// Group conversations by person (contact_id), or company when there is no contact.
// Returns one row per group: the newest-activity conversation, carrying every member's
// messages merged oldest→newest, summed unread, and a thread_count. Order is preserved
// as newest-first because the input is already sorted by last activity.
function threadConversations(list) {
  const groups = new Map(); // key → array of conversations
  const order = [];         // group keys in first-seen (newest-first) order
  for (const c of list) {
    const key = c.contact_id ? "ct:" + c.contact_id : (c.company ? "co:" + String(c.company).toLowerCase() : "id:" + c.id);
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(c);
  }
  const out = [];
  for (const key of order) {
    const members = groups.get(key);
    if (members.length === 1) { out.push(members[0]); continue; }
    // Primary = newest activity (members retain the input's newest-first order, so [0]).
    const primary = members.slice().sort((a, b) => (b.age_ts || 0) - (a.age_ts || 0))[0];
    // Merge every member's messages, drop the per-conversation "no messages yet" placeholder,
    // sort oldest→newest so the thread reads top-to-bottom.
    const msgs = [];
    for (const m of members) for (const mm of (m.messages || [])) if (mm.dir !== "system") msgs.push(mm);
    msgs.sort((a, b) => (a._ts || 0) - (b._ts || 0));
    primary.messages = msgs.length ? msgs : primary.messages;
    // Merge notes into the activity feed (contact-level activities are already shared, so
    // only fold in sibling NOTES, deduped).
    const seen = new Set((primary.activity || []).map((a) => a.kind + "|" + a.label + "|" + a.ts));
    for (const m of members) { if (m === primary) continue; for (const a of (m.activity || [])) { if (a.kind !== "note") continue; const k = a.kind + "|" + a.label + "|" + a.ts; if (!seen.has(k)) { seen.add(k); primary.activity.push(a); } } }
    primary.unread = members.some((m) => m.unread);
    primary.thread_count = members.length;
    primary.thread_ids = members.map((m) => m.id);
    out.push(primary);
  }
  return out;
}

// ---- Ops pipeline builder (shared by the full /api/crm/app payload and the fast
// ?only=pipeline refresh). Enriches each real deal with conversation state (comm stage,
// last-activity age), the linked contact's booked demo, and business intel. ----
async function buildPipeline(env) {
  await env.DB.prepare("ALTER TABLE deals ADD COLUMN disqualify_reason TEXT").run().catch(() => {}); // idempotent
  // Guard: the query LEFT-JOINs bookings; on a fresh env the table may not exist yet.
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, uid TEXT, session_id TEXT, name TEXT, company TEXT, website TEXT, phone TEXT, email TEXT, trade TEXT, traffic TEXT, lead_sources TEXT, start_iso TEXT, utm_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`
  ).run().catch(() => {});
  const OWCOL = ["#00b985", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#0ea5e9"];
  const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  const inits = (n) => (n ? n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?");
  const rows = (await env.DB.prepare(
    `SELECT d.id, d.title, d.value_cents, d.close_probability, d.lead_status, d.owner_id, d.disqualify_reason,
            d.origin_conversation_id AS conv_id, d.company_id AS company_id, d.primary_contact_id AS contact_pid,
            ct.full_name, ct.primary_email, ct.lead_score, ct.tier,
            co.name AS company, co.domain AS domain, co.enrichment AS enrichment, u.name AS owner_name,
            cv.status AS conv_status, cv.snooze_until, cv.assignee_id,
            cv.last_message_at, cv.last_message_preview, au.name AS assignee_name,
            (SELECT m.direction FROM messages m WHERE m.conversation_id = cv.id ORDER BY COALESCE(m.sent_at, m.created_at) DESC LIMIT 1) AS last_dir,
            (SELECT 1 FROM workflow_runs wr WHERE wr.status='active' AND (wr.conversation_id = cv.id OR wr.deal_id = d.id OR wr.contact_id = d.primary_contact_id) LIMIT 1) AS wf_active,
            (SELECT bk.start_iso FROM bookings bk WHERE bk.email = ct.primary_email AND substr(bk.start_iso,1,10) >= date('now') ORDER BY bk.start_iso ASC LIMIT 1) AS meeting_iso,
            (SELECT bk.uid FROM bookings bk WHERE bk.email = ct.primary_email AND substr(bk.start_iso,1,10) >= date('now') ORDER BY bk.start_iso ASC LIMIT 1) AS meeting_uid
     FROM deals d
     LEFT JOIN contacts ct ON ct.id = d.primary_contact_id
     LEFT JOIN companies co ON co.id = d.company_id
     LEFT JOIN users u ON u.id = d.owner_id
     LEFT JOIN conversations cv ON cv.id = d.origin_conversation_id
     LEFT JOIN users au ON au.id = cv.assignee_id
     ORDER BY d.updated_at DESC LIMIT 200`
  ).all()).results || [];
  const stageOf = (r) => {
    const s = (r.lead_status || "new").toLowerCase();
    if (s === "disqualified") return "disqualified";
    if (s === "lost") return "lost";
    if (s === "won" || s === "customer") return "customer";
    if (s === "trial") return "trial";
    if (s === "lead" || s === "active" || s === "contacted" || s === "replied") return "lead";
    return "new";
  };
  return rows.map((r) => {
    const nm = r.full_name || r.title || "Untitled deal";
    const ownNm = r.owner_name || "";
    let intel = null, estSpend = null;
    try {
      const en = r.enrichment ? JSON.parse(r.enrichment) : null;
      if (en) {
        intel = {
          employees: en.employees != null ? en.employees : null,
          visits: en.traffic_month != null ? en.traffic_month : null,
          industry: en.industry || null,
          signal: en.signal || null,
        };
        estSpend = [en.ad_spend_month, en.est_ad_spend, en.monthly_ad_spend, en.ad_spend, en.spend_month]
          .map((v) => (typeof v === "string" ? Number(String(v).replace(/[^0-9.]/g, "")) : v))
          .find((v) => v != null && !Number.isNaN(v) && v > 0) ?? null;
      }
    } catch (_) {}
    const stage = stageOf(r);
    const lastTs = r.last_message_at ? Date.parse(r.last_message_at) : null;
    const ageMin = lastTs ? Math.max(0, Math.round((Date.now() - lastTs) / 60000)) : null;
    const snoozed = (r.snooze_until && Date.parse(r.snooze_until) > Date.now()) || r.conv_status === "snoozed";
    let comm;
    if (stage === "customer") comm = "won";
    else if (stage === "lost" || stage === "disqualified") comm = "closed";
    else if (r.meeting_iso) comm = "booked";
    else if (r.conv_status === "archived") comm = "closed";
    else if (snoozed) comm = "snoozed";
    else if (r.last_dir === "in") comm = "replying";
    else if (r.assignee_id || r.owner_id) comm = "open";
    else if (r.wf_active) comm = "auto";
    else comm = "open";
    return {
      id: r.id, name: nm, company: r.company || "",
      value_usd: Math.round((r.value_cents || 0) / 100),
      prob: r.close_probability == null ? null : Number(r.close_probability),
      status: (r.lead_status || "active").toLowerCase(),
      stage,
      score: r.lead_score == null ? null : Number(r.lead_score),
      tier: (r.tier || "").toLowerCase() || null,
      domain: r.domain || null,
      intel, est_spend: estSpend,
      comm, age_min: ageMin, last_ts: lastTs,
      last_label: r.last_message_preview || null,
      meeting: r.meeting_iso ? { iso: r.meeting_iso, label: humanTime(r.meeting_iso), uid: r.meeting_uid || null } : null,
      conv_id: r.conv_id || null,
      company_id: r.company_id || null,
      contact_id: r.contact_pid || null,
      assignee: r.assignee_name || null,
      disqualify_reason: r.disqualify_reason || null,
      owner_id: r.owner_id || null,
      owner: ownNm ? { init: inits(ownNm), name: ownNm, color: OWCOL[Math.abs(hashStr(ownNm)) % OWCOL.length] } : null,
    };
  });
}

// ---- consent-ledger humanizers (shape the row for the UI) ----
function humanTime(iso) {
  if (!iso) return "";
  const t = Date.parse(iso); if (isNaN(t)) return iso;
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 0) return new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); // future (e.g. a meeting time) — never "just now"
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function consentForm(method) {
  return ({ get_started: "Demo signup", meta_lead_form: "Meta Lead Form", preference_center: "Preference center",
            stop_keyword: "SMS reply", import: "Imported record" })[method] || "Signup";
}
function consentBasis(method, hasPewc, action) {
  if (action === "revoked") return "Inbound opt-out (STOP / unsubscribe)";
  const pewc = hasPewc ? "PEWC checkbox" : "email only";
  return ({ get_started: `/get-started signup — ${pewc}`, meta_lead_form: `Meta Lead Form — ${pewc}`,
            preference_center: `Preference-center opt-in — ${pewc}`, import: `Imported prior consent — ${pewc}` })[method]
    || `Captured at signup — ${pewc}`;
}
function consentProof(method, hasPewc, action) {
  if (action === "revoked") return "Contact opted out; the channel was auto-suppressed and the record retained as proof of compliance.";
  if (hasPewc) return "Prior express written consent captured at signup: agreement to receive automated marketing calls, texts, and emails from Consent Resolve. Consent is not a condition of purchase. Reply STOP to opt out.";
  return "Email opt-in captured. No SMS/voice consent was present — routed to the email-only earn-consent branch until the contact opts in.";
}
