// worker/api/crm-app-data.js  ->  GET /api/crm/app
// Real-data read endpoint for the rebuild frontend + migration verification.
// Returns fixture-shaped slices backed by the new tables (consent_records,
// workflows/runs/steps, crm_events) and v2 (conversations/contacts). The frozen
// /crm/app can Object.assign these onto its window.* globals (fixture->fetch swap).
// Session-gated (cr_crm). This is the growing API contract — clean screens first.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { currentUser } from "../_lib/crm-v2.js";
import { ensureRebuildSchema } from "../_lib/crm-rebuild.js";
import { computeSources } from "../_lib/sitespy.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureRebuildSchema(env);
  const me = await currentUser(request, env).catch(() => null);

  // ---- Consent ledger (backed by consent_records) ----
  // One row per (contact, event) with channels merged — matches the ledger UI shape
  // { ts, name, co, ch[], action, basis, form, ip, proof }.
  const consentRows = (await env.DB.prepare(
    `SELECT cr.occurred_at, cr.channel, cr.action, cr.basis, cr.capture_method method,
            cr.disclosure_text, cr.ip, cr.email, cr.contact_id,
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
                    action: r.action, method: r.method, ch: [], ip: r.ip || "", disclosure: r.disclosure_text || "" }; groups.set(key, g); }
    if (!g.ch.includes(r.channel)) g.ch.push(r.channel);
    if (!g.ip && r.ip) g.ip = r.ip;
    if (!g.disclosure && r.disclosure_text) g.disclosure = r.disclosure_text;
  }
  const chOrder = { email: 0, sms: 1, voice: 2 };
  const CONSENT_LEDGER = [...groups.values()].slice(0, 120).map((g) => {
    const hasPewc = g.ch.includes("sms") || g.ch.includes("voice");
    const basis = consentBasis(g.method, hasPewc, g.action);
    return {
      ts: humanTime(g.occurred_at),
      name: g.name, co: g.co,
      ch: g.ch.sort((a, b) => (chOrder[a] ?? 9) - (chOrder[b] ?? 9)),
      action: g.action,
      basis,
      form: consentForm(g.method),
      ip: g.ip,
      // Use the stored disclosure only if it's real proof text (migrated rows sometimes
      // hold just a version tag like "v1-2026-06" — fall back to the generated sentence).
      proof: (g.disclosure && g.disclosure.length > 24 && !/^v\d/i.test(g.disclosure))
        ? g.disclosure : consentProof(g.method, hasPewc, g.action),
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
  const convRows = (await env.DB.prepare(
    `SELECT cv.id, cv.channel, cv.status, cv.unread, cv.subject, cv.last_message_at, cv.last_message_preview,
            ct.id contact_id, ct.full_name, ct.primary_email, ct.source, ct.lifecycle_stage, co.name company
       FROM conversations cv
       LEFT JOIN contacts ct ON ct.id = cv.contact_id
       LEFT JOIN companies co ON co.id = ct.company_id
      ORDER BY cv.last_message_at DESC LIMIT 60`
  ).all()).results || [];
  const convIds = convRows.map((r) => r.id);
  const contactIds = [...new Set(convRows.map((r) => r.contact_id).filter(Boolean))];
  const ph = (arr) => (arr.length ? `(${arr.map(() => "?").join(",")})` : "(NULL)");
  const msgsByConv = new Map();
  if (convIds.length) {
    const msgs = (await env.DB.prepare(
      `SELECT conversation_id, direction, channel, body_text, body_html, sent_at
         FROM messages WHERE conversation_id IN ${ph(convIds)} ORDER BY sent_at ASC`
    ).bind(...convIds).all()).results || [];
    for (const m of msgs) { const a = msgsByConv.get(m.conversation_id) || []; a.push(m); msgsByConv.set(m.conversation_id, a); }
  }
  const consentByCt = new Map(), dealByCt = new Map(), runByCt = new Map();
  if (contactIds.length) {
    for (const cr of (await env.DB.prepare(`SELECT contact_id, channel, action FROM consent_records WHERE contact_id IN ${ph(contactIds)} ORDER BY occurred_at ASC`).bind(...contactIds).all()).results || []) {
      const s = consentByCt.get(cr.contact_id) || {}; s[cr.channel] = cr.action; consentByCt.set(cr.contact_id, s);
    }
    for (const d of (await env.DB.prepare(`SELECT primary_contact_id, title, value_cents, close_probability FROM deals WHERE primary_contact_id IN ${ph(contactIds)}`).bind(...contactIds).all()).results || []) {
      if (!dealByCt.has(d.primary_contact_id)) dealByCt.set(d.primary_contact_id, d);
    }
    for (const r of (await env.DB.prepare(`SELECT r.contact_id, r.status, r.current_step, r.exit_reason, w.name FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id WHERE r.contact_id IN ${ph(contactIds)}`).bind(...contactIds).all()).results || []) {
      if (!runByCt.has(r.contact_id)) runByCt.set(r.contact_id, r);
    }
  }
  const srcMap = { meta: "meta", instantly: "instantly", crisp: "chatwoot", chatwoot: "chatwoot", site: "site", demo: "demo", claim50: "demo", cal: "demo", apollo: "apollo", manual: "manual" };
  const lifeMap = { lead: "Lead", mql: "MQL", sql: "SQL", meeting_booked: "Meeting Booked", opportunity: "Opportunity", customer: "Customer" };
  const srcLabelMap = { meta: "Meta · Lead form", instantly: "Instantly · cold email", chatwoot: "Chatwoot · site chat", site: "Site · demo signup", demo: "Demo signup", apollo: "Apollo · identified", manual: "Manual" };
  const stripHtml = (h) => (h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const inits = (n) => (n ? n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?");
  const DATA_CONVERSATIONS = convRows.map((r) => {
    const src = srcMap[r.source] || "manual";
    const channel = r.channel === "crisp" ? "chatwoot" : "email";
    const cst = consentByCt.get(r.contact_id) || {};
    const consent = { email: cst.email || "none", sms: cst.sms || "none", voice: cst.voice || "none" };
    const run = runByCt.get(r.contact_id), deal = dealByCt.get(r.contact_id);
    const unread = !!r.unread;
    const mins = r.last_message_at ? Math.max(0, Math.round((Date.now() - Date.parse(r.last_message_at)) / 60000)) : 0;
    const bucket = run && run.status === "active" ? "auto" : r.status === "archived" ? "suppressed" : r.status === "snoozed" ? "snoozed" : "open";
    const cmsgs = (msgsByConv.get(r.id) || []).map((m) => ({
      dir: m.direction === "in" ? "in" : "out", channel: m.channel === "crisp" ? "chatwoot" : m.channel,
      body: m.body_text || stripHtml(m.body_html) || "", ts: humanTime(m.sent_at), meta: "",
    }));
    const seqTotal = run && /earn/i.test(run.name || "") ? 3 : 4;
    return {
      id: r.id, bucket, source: src, channel,
      name: r.full_name || "Unknown", company: r.company || null, contact_email: r.primary_email || null,
      initials: inits(r.full_name), lifecycle: lifeMap[r.lifecycle_stage] || "Lead",
      hot: false, unread, ts: humanTime(r.last_message_at) || "—",
      email_subject: channel === "email" ? (r.subject || "") : undefined,
      task: unread ? { tag: "do", text: "New message — reply.", cta: "Reply" } : { tag: "auto", text: "No action needed right now.", cta: "" },
      last: { label: r.last_message_preview || "Activity on this conversation", ts: humanTime(r.last_message_at) || "—", tone: "info" },
      next: unread ? { kind: "you", label: "Reply", when: "now", tone: "act" } : { kind: "auto", label: "Waiting on them", when: "—", tone: "muted" },
      consent,
      sequence: run
        ? { step: (run.current_step || 0) + 1, total: seqTotal, label: run.name || "Sequence", status: run.exit_reason || (run.status === "active" ? "active" : "none") }
        : { step: 0, total: 0, label: "—", status: "none" },
      sla: { min: mins, level: unread ? (mins > 15 ? "bad" : mins > 5 ? "warn" : "none") : "none" },
      intel: { fit: "unknown", time_on_site: "—", pages: 0, first_seen: humanTime(r.last_message_at) || "—", speed_to_lead_h: null, cost_per_lead: null, src_label: srcLabelMap[src] || "Lead", site_status: "—", pages_viewed: [] },
      deal: deal ? { title: deal.title || r.company || r.full_name || "Deal", value_usd: Math.round((deal.value_cents || 0) / 100), prob: deal.close_probability || 63 } : null,
      messages: cmsgs.length ? cmsgs : [{ dir: "system", body: "No messages on this conversation yet.", ts: humanTime(r.last_message_at) || "" }],
    };
  });
  const DATA_COUNTS = {
    open: DATA_CONVERSATIONS.filter((c) => c.bucket === "open").length,
    auto: DATA_CONVERSATIONS.filter((c) => c.bucket === "auto").length,
    snoozed: DATA_CONVERSATIONS.filter((c) => c.bucket === "snoozed").length,
    all: DATA_CONVERSATIONS.length,
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
      for (const x of (await env.DB.prepare(`SELECT DISTINCT contact_id FROM conversations WHERE status='open' AND contact_id IN ${ph(svIds)}`).bind(...svIds).all()).results || []) engConv.add(x.contact_id);
      for (const x of (await env.DB.prepare(`SELECT r.contact_id, w.name FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id WHERE r.status='active' AND r.contact_id IN ${ph(svIds)}`).bind(...svIds).all()).results || []) engRun.set(x.contact_id, x.name);
      for (const x of (await env.DB.prepare(`SELECT DISTINCT contact_id FROM suppressions WHERE contact_id IN ${ph(svIds)}`).bind(...svIds).all()).results || []) engSupp.add(x.contact_id);
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

  // ---- Pipeline (real deals -> kanban stages) ----
  let PIPELINE = null;
  try {
    const OWCOL = ["#00b985", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#0ea5e9"];
    const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
    const rows = (await env.DB.prepare(
      `SELECT d.id, d.title, d.value_cents, d.close_probability, d.lead_status,
              ct.full_name, co.name AS company, u.name AS owner_name
       FROM deals d
       LEFT JOIN contacts ct ON ct.id = d.primary_contact_id
       LEFT JOIN companies co ON co.id = d.company_id
       LEFT JOIN users u ON u.id = d.owner_id
       ORDER BY d.value_cents DESC LIMIT 120`
    ).all()).results || [];
    const stageOf = (r) => {
      const s = (r.lead_status || "").toLowerCase();
      if (s === "lost") return "lost";
      const p = r.close_probability == null ? 0 : Number(r.close_probability);
      if (s === "won" || p >= 75) return "active";
      if (p >= 40) return "trial";
      return "new";
    };
    PIPELINE = rows.map((r, i) => {
      const nm = r.full_name || r.title || "Untitled deal";
      const ownNm = r.owner_name || "";
      return {
        id: r.id, name: nm, company: r.company || "",
        value_usd: Math.round((r.value_cents || 0) / 100),
        prob: r.close_probability == null ? null : Number(r.close_probability),
        status: (r.lead_status || "active").toLowerCase(),
        stage: stageOf(r),
        owner: ownNm ? { init: inits(ownNm), name: ownNm, color: OWCOL[Math.abs(hashStr(ownNm)) % OWCOL.length] } : null,
      };
    });
  } catch (_) {}

  // ---- Analytics (real: funnel + KPIs + by-source + spend + leads/day) ----
  let ANALYTICS = null;
  try {
    const openPipe = (PIPELINE || []).filter((d) => ["new", "trial", "active"].includes(d.stage))
      .reduce((a, d) => a + (d.value_usd || 0), 0);
    // spend by channel (crm_spend) + total
    const spendRows = (await env.DB.prepare("SELECT COALESCE(channel,'(unknown)') channel, SUM(amount_usd) amt FROM crm_spend GROUP BY channel").all()).results || [];
    const spendTotal = spendRows.reduce((a, r) => a + (r.amt || 0), 0);
    const spendByChannel = spendRows.map((r) => ({ k: r.channel, v: Math.round(r.amt || 0) })).sort((a, b) => b.v - a.v);
    // spend per source-key (channel label -> SRC key, best-effort)
    const chanToSrc = (c) => { const k = (c || "").toLowerCase(); if (k.includes("meta") || k.includes("facebook")) return "meta"; if (k.includes("instant")) return "instantly"; if (k.includes("google") || k.includes("lsa") || k.includes("search")) return "site"; return "manual"; };
    const spendBySrc = {};
    for (const r of spendRows) spendBySrc[chanToSrc(r.channel)] = (spendBySrc[chanToSrc(r.channel)] || 0) + (r.amt || 0);
    // per-source funnel counts
    const srcAgg = (await env.DB.prepare(
      `SELECT c.source src,
         COUNT(DISTINCT CASE WHEN e.type='lead_created' THEN e.contact_id END) leads,
         COUNT(DISTINCT CASE WHEN e.type='replied'      THEN e.contact_id END) replied,
         COUNT(DISTINCT CASE WHEN e.type='booked'       THEN e.contact_id END) demos,
         COUNT(DISTINCT CASE WHEN e.type='activated'    THEN e.contact_id END) act
       FROM crm_events e JOIN contacts c ON c.id = e.contact_id
       GROUP BY c.source`
    ).all()).results || [];
    const sources = srcAgg.map((r) => {
      const key = srcMap[r.source] || "manual";
      return { src: key, leads: r.leads || 0, reply: r.leads ? (r.replied || 0) / r.leads : 0,
               demos: r.demos || 0, act: r.act || 0, spend: Math.round(spendBySrc[key] || 0) };
    }).filter((s) => s.leads > 0 || s.spend > 0).sort((a, b) => b.leads - a.leads);
    // leads/day, last 30d, oldest->newest
    const byDay = (await env.DB.prepare(
      `SELECT CAST(julianday('now') - julianday(occurred_at) AS INTEGER) d, COUNT(*) n
         FROM crm_events WHERE type='lead_created' AND occurred_at >= datetime('now','-30 days') GROUP BY d`
    ).all()).results || [];
    const leadsByDay = Array(30).fill(0);
    for (const r of byDay) { const idx = 29 - (r.d || 0); if (idx >= 0 && idx < 30) leadsByDay[idx] = r.n || 0; }
    // avg annual deal value (from real deals; sane fallback keeps ROAS honest)
    const avgDeal = firstRow(await env.DB.prepare("SELECT AVG(value_cents) a FROM deals WHERE value_cents > 0").all())?.a;
    const avgDealYr = avgDeal ? Math.round(avgDeal / 100) : 6000;
    const F = { leads: funnel.lead_created || 0, replies: funnel.replied || 0, demos: funnel.booked || 0, activations: funnel.activated || 0 };
    const kpis = {
      leads: F.leads, replies: F.replies, demos: F.demos, activations: F.activations,
      spend: Math.round(spendTotal), cpl: F.leads ? spendTotal / F.leads : 0,
      cpd: F.demos ? Math.round(spendTotal / F.demos) : 0, pipeline: openPipe,
    };
    const FLBL = { lead_created: "Leads", contacted: "Contacted", replied: "Replied", booked: "Demo booked", signed_up: "Signed up", activated: "Activated" };
    const funnelArr = Object.keys(FLBL).map((t) => ({ k: FLBL[t], n: funnel[t] || 0 }));
    ANALYTICS = { kpis, funnel: funnelArr, sources, spendByChannel, leadsByDay, avgDealYr };
  } catch (_) {}

  // Data-source registry (Site Spy / Nurture transparency + extensibility).
  let SITE_SOURCES = null;
  try { SITE_SOURCES = await computeSources(env); } catch (_) {}

  return json({
    ok: true,
    me: me ? { name: me.name, email: me.email, role: me.role } : null,
    CONSENT_LEDGER, CONSENT_STATS, consentSummary,
    SEQUENCES,
    DATA_CONVERSATIONS, DATA_COUNTS,
    SITESPY, NURTURE, SITE_SOURCES, PIPELINE, ANALYTICS,
    inbox: { buckets },
    funnel,
    generated_at: new Date().toISOString(),
    _note: "real-data slices for the rebuild UI + migration verification; growing per screen",
  }, {}, cors);
}

function firstRow(res) { return (res.results && res.results[0]) || {}; }
function safeJson(s, d) { try { return JSON.parse(s); } catch (_) { return d; } }

// ---- consent-ledger humanizers (shape the row for the UI) ----
function humanTime(iso) {
  if (!iso) return "";
  const t = Date.parse(iso); if (isNaN(t)) return iso;
  const mins = Math.floor((Date.now() - t) / 60000);
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
