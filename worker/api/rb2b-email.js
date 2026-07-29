// Consent Resolve — RB2B daily-CSV-email -> CRM ingest.
//
// RB2B's FREE tier can't do a webhook — it only emails a daily CSV of identified
// website visitors. So we receive that email via Cloudflare Email Routing (route a
// dedicated address, e.g. rb2b@consentresolve.com, to THIS worker) and parse the
// CSV attachment into CRM leads (source "rb2b", identified).
//
// Wiring: the worker's default export exposes `async email(message, env, ctx)`,
// which calls handleRb2bEmail(message, env). No wrangler binding is needed to
// RECEIVE mail — Email Routing points the address at the worker in the dashboard.
//
// Idempotent: upsertLead is keyed on email (ON CONFLICT), and we only log an
// "identified" activity for genuinely new leads, so re-delivering the same daily
// CSV never duplicates leads or spams the timeline.
import { upsertLead, addActivity, ensureCrmSchema, crmAuthed } from "../_lib/crm.js";
import { gAccessToken } from "../_lib/gmail.js";
import { json, corsHeaders } from "../_lib/http.js";

// ---- raw email -> text --------------------------------------------------------
async function streamToText(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const all = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  return new TextDecoder("utf-8").decode(all);
}

function decodeBase64ToText(b64) {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function decodeQuotedPrintable(s) {
  return s
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function decodePart(head, body) {
  const enc = (head.match(/content-transfer-encoding:\s*([^\s;\r\n]+)/i) || [, "7bit"])[1].toLowerCase();
  if (enc === "base64") { try { return decodeBase64ToText(body); } catch { return null; } }
  if (enc === "quoted-printable") return decodeQuotedPrintable(body);
  return body;
}

function looksLikeCsvPart(head) {
  return /content-type:\s*(text\/csv|application\/(octet-stream|csv|vnd\.ms-excel))/i.test(head)
    || /filename\*?=[^\r\n]*\.csv/i.test(head);
}

// Walk a MIME body given its boundary; recurse into nested multipart parts.
function extractCsvFromBoundary(raw, boundary, depth) {
  if (depth > 4) return null;
  const parts = raw.split("--" + boundary);
  for (const part of parts) {
    const sep = part.search(/\r?\n\r?\n/);
    if (sep === -1) continue;
    const head = part.slice(0, sep);
    let body = part.slice(sep).replace(/^\r?\n\r?\n/, "");
    if (looksLikeCsvPart(head)) {
      // Trim any trailing boundary marker that leaked into the tail.
      body = body.replace(/\r?\n--[^\r\n]*--?\s*$/, "");
      return decodePart(head, body);
    }
    const nb = head.match(/boundary="?([^";\r\n]+)"?/i);
    if (nb && /content-type:\s*multipart/i.test(head)) {
      const inner = extractCsvFromBoundary(body, nb[1], depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

function extractCsv(raw) {
  const ct = raw.match(/content-type:\s*multipart\/[^\r\n]*boundary="?([^";\r\n]+)"?/i);
  if (ct) {
    const found = extractCsvFromBoundary(raw, ct[1], 0);
    if (found) return found;
  }
  // Fallback: a non-multipart message whose body IS the CSV.
  if (/content-type:\s*text\/csv/i.test(raw)) {
    const sep = raw.search(/\r?\n\r?\n/);
    if (sep !== -1) return decodePart(raw.slice(0, sep), raw.slice(sep).replace(/^\r?\n\r?\n/, ""));
  }
  return null;
}

// ---- CSV parsing (RFC 4180-ish: quoted fields w/ commas + newlines) -----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
}

const key = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function mapColumns(header) {
  const idx = {};
  header.forEach((h, i) => {
    const k = key(h);
    if (idx.email === undefined && /email/.test(k) && !/hash|md5|sha/.test(k)) idx.email = i;
    else if (idx.firstName === undefined && (k === "firstname" || k === "first")) idx.firstName = i;
    else if (idx.lastName === undefined && (k === "lastname" || k === "last")) idx.lastName = i;
    else if (idx.fullName === undefined && (k === "name" || k === "fullname" || k === "personname")) idx.fullName = i;
    else if (idx.company === undefined && (k === "company" || k === "companyname" || k === "organization")) idx.company = i;
    else if (idx.domain === undefined && (/website/.test(k) || /companydomain/.test(k) || k === "domain")) idx.domain = i;
    else if (idx.title === undefined && (k === "title" || k === "jobtitle")) idx.title = i;
    else if (idx.linkedin === undefined && /linkedin/.test(k)) idx.linkedin = i;
    else if (idx.city === undefined && k === "city") idx.city = i;
    else if (idx.state === undefined && (k === "state" || k === "region")) idx.state = i;
  });
  return idx;
}

const at = (row, i) => (i === undefined ? "" : String(row[i] || "").trim());

// ---- ingest -------------------------------------------------------------------
export async function ingestRb2bCsv(env, csvText, meta = {}) {
  await ensureCrmSchema(env);
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { ingested: 0, skipped: 0, rows: rows.length, error: "no data rows" };
  const idx = mapColumns(rows[0]);
  if (idx.email === undefined) return { ingested: 0, skipped: 0, rows: rows.length, error: "no email column" };

  let ingested = 0, skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const email = at(row, idx.email).toLowerCase();
    if (!email || !email.includes("@")) { skipped++; continue; }
    const name = at(row, idx.fullName) || [at(row, idx.firstName), at(row, idx.lastName)].filter(Boolean).join(" ");
    const company = at(row, idx.company);
    const domain = at(row, idx.domain).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const title = at(row, idx.title);
    const linkedin = at(row, idx.linkedin);
    const loc = [at(row, idx.city), at(row, idx.state)].filter(Boolean).join(", ");

    const existing = await env.DB.prepare("SELECT id FROM crm_leads WHERE email=?").bind(email).first();
    const noteBits = [title, loc, linkedin ? "LinkedIn: " + linkedin : ""].filter(Boolean);
    const id = await upsertLead(env, {
      source: "rb2b", email, name: name || null, company: company || null,
      domain: domain || null, consent_status: "identified",
      notes: noteBits.length ? noteBits.join(" · ") : null,
    });
    if (!existing) {
      await addActivity(env, id, "identified", "Identified via RB2B" + (company ? " · " + company : "") + (loc ? " · " + loc : ""), "rb2b");
      ingested++;
    } else skipped++;
  }
  return { ingested, skipped, rows: rows.length - 1, from: meta.from || null };
}

// Cloudflare Email Worker entry — wired from the default export's email() handler.
export async function handleRb2bEmail(message, env) {
  if (!env || !env.DB) { console.log("[rb2b-email] no DB binding; drop"); return; }
  const from = String(message.from || "").toLowerCase();
  // Optional sender allowlist (comma-separated substrings). The Email Routing address
  // is the real gate; this is defense-in-depth. Default: accept.
  const allow = (env.RB2B_FROM_ALLOW || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.some((a) => from.includes(a))) {
    console.log(`[rb2b-email] sender ${from} not in RB2B_FROM_ALLOW; skip`);
    return;
  }
  try {
    const raw = await streamToText(message.raw);
    const csv = extractCsv(raw);
    if (!csv) { console.log(`[rb2b-email] no CSV attachment found (from ${from})`); return; }
    const out = await ingestRb2bCsv(env, csv, { from });
    console.log(`[rb2b-email] from ${from}: +${out.ingested} new, ${out.skipped} skipped (${out.rows} rows)${out.error ? " err=" + out.error : ""}`);
  } catch (err) {
    console.log(`[rb2b-email] error: ${String(err).slice(0, 200)}`);
  }
}

// ---- Gmail path (the one we actually use) -------------------------------------
// consentresolve.com's MX points to Google Workspace, so Cloudflare Email Routing
// can't receive mail without hijacking the whole domain's email. Instead, RB2B
// emails hello@consentresolve.com (already Gmail-OAuth connected) and we pull the
// daily CSV attachment via the Gmail API — reusing ingestRb2bCsv() verbatim.
function decodeB64UrlToText(d) {
  try {
    const bin = atob(String(d || "").replace(/-/g, "+").replace(/_/g, "/"));
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(b);
  } catch (_) { return ""; }
}

function collectParts(payload) {
  const out = [];
  (function walk(p) { if (!p) return; out.push(p); (p.parts || []).forEach(walk); })(payload);
  return out;
}

async function fetchGmailAttachment(tok, msgId, attId) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attId}`,
    { headers: { Authorization: "Bearer " + tok } });
  const j = await r.json();
  return j && j.data ? decodeB64UrlToText(j.data) : null;
}

// Poll the connected inbox(es) for RB2B's CSV email and ingest the attachment.
// Idempotent twice over: a rb2b_seen guard skips already-processed Gmail messages,
// and ingestRb2bCsv upserts by email so a re-run never duplicates leads.
export async function pollRb2bGmail(env) {
  if (!env.DB) return { error: "no_db" };
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS rb2b_seen (msg_id TEXT PRIMARY KEY, processed_at TEXT)").run();
  const accounts = (env.CRM_INBOX_EMAILS || "hello@consentresolve.com")
    .split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  // Sender gate so an unrelated CSV email never gets ingested as leads.
  const senders = (env.RB2B_FROM_ALLOW || "rb2b,retention.com,getemails")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const query = env.RB2B_GMAIL_QUERY || "has:attachment filename:csv newer_than:8d";
  const now = new Date().toISOString();
  let ingested = 0, processed = 0, scanned = 0;
  const detail = [];
  for (const account of accounts) {
    const tok = await gAccessToken(env, account);
    if (!tok) { detail.push({ account, error: "no_token" }); continue; }
    const lr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=" + encodeURIComponent(query),
      { headers: { Authorization: "Bearer " + tok } });
    const lj = await lr.json();
    if (lj.error) { detail.push({ account, error: (lj.error && lj.error.message) || "list_failed" }); continue; }
    for (const ref of (lj.messages || [])) {
      scanned++;
      const already = await env.DB.prepare("SELECT msg_id FROM rb2b_seen WHERE msg_id=?").bind(ref.id).first();
      if (already) continue;
      const mr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + ref.id + "?format=full",
        { headers: { Authorization: "Bearer " + tok } });
      const m = await mr.json();
      if (m.error) continue;
      const headers = (m.payload && m.payload.headers) || [];
      const from = String((headers.find((h) => h.name.toLowerCase() === "from") || {}).value || "").toLowerCase();
      // Not from RB2B — remember it so we don't full-fetch it again, then skip.
      if (senders.length && !senders.some((s) => from.includes(s))) {
        await env.DB.prepare("INSERT OR IGNORE INTO rb2b_seen (msg_id, processed_at) VALUES (?,?)").bind(ref.id, now).run();
        continue;
      }
      let csv = null, filename = null;
      for (const p of collectParts(m.payload)) {
        const fn = p.filename || "";
        const isCsv = /\.csv$/i.test(fn) || /csv/i.test(p.mimeType || "");
        if (!isCsv) continue;
        if (p.body && p.body.attachmentId) csv = await fetchGmailAttachment(tok, ref.id, p.body.attachmentId);
        else if (p.body && p.body.data) csv = decodeB64UrlToText(p.body.data);
        if (csv) { filename = fn; break; }
      }
      if (csv) {
        const out = await ingestRb2bCsv(env, csv, { from });
        ingested += out.ingested || 0;
        processed++;
        detail.push({ account, msg: ref.id, filename, ingested: out.ingested, skipped: out.skipped, rows: out.rows, error: out.error });
      }
      await env.DB.prepare("INSERT OR IGNORE INTO rb2b_seen (msg_id, processed_at) VALUES (?,?)").bind(ref.id, now).run();
    }
  }
  return { ingested, processed, scanned, detail };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const u = new URL(request.url);
  if (u.searchParams.get("run") || u.searchParams.get("test")) {
    const out = await pollRb2bGmail(env);
    return json({ ok: !out.error, ...out }, out.error ? { status: 502 } : {}, cors);
  }
  return json({ ok: true, usage: "?run=1 to poll the connected inbox for RB2B's CSV attachment and import it" }, {}, cors);
}
