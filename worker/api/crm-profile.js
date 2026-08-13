// Consent Resolve CRM — signed-in user's own profile / account settings.
//   GET  /api/crm/profile  -> current profile (merged over the users-table row)
//   POST /api/crm/profile  -> save profile fields, returns the merged profile
// CRM-gated; always scoped to the caller's own Google session email.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { crmSessionEmail } from "../_lib/auth.js";
import { currentUser } from "../_lib/crm-v2.js";
import { getUserSettings, saveUserSettings } from "../_lib/user-settings.js";

const STR_FIELDS = ["name", "title", "phone", "avatar", "signature"];
const SOCIALS = ["linkedin", "x", "facebook", "instagram", "youtube", "tiktok", "website", "github"];
const CAP = { signature: 6000, avatar: 500000 }; // avatar is a resized data URL (~256px)
const nameFromEmail = (e) => (e || "").split("@")[0].split(/[._-]+/).filter(Boolean)
  .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") || (e || "");

function merge(email, user, s) {
  s = s || {};
  return {
    email,
    name: s.name || (user && user.name) || nameFromEmail(email),
    title: s.title || "",
    phone: s.phone || "",
    avatar: s.avatar || "",
    signature: s.signature || "",
    role: (user && user.role) || "member",
    socials: s.socials || {},
    persona: s.persona || "",
    notifications: s.notifications || null, // null => frontend applies the role-preset defaults
  };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const email = await crmSessionEmail(request, env);
  if (!email) return json({ error: "no_session" }, { status: 401 }, cors);
  const user = await currentUser(request, env).catch(() => null);
  const s = await getUserSettings(env, email);
  return json({ ok: true, me: merge(email, user, s) }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const email = await crmSessionEmail(request, env);
  if (!email) return json({ error: "no_session" }, { status: 401 }, cors);
  let body = {};
  try { body = await request.json(); } catch (_) {}

  const patch = {};
  for (const f of STR_FIELDS) {
    if (typeof body[f] === "string") patch[f] = body[f].slice(0, CAP[f] || 300);
  }
  if (body.socials && typeof body.socials === "object") {
    patch.socials = {};
    for (const k of SOCIALS) {
      if (typeof body.socials[k] === "string") patch.socials[k] = body.socials[k].trim().slice(0, 400);
    }
  }
  if (typeof body.persona === "string") patch.persona = body.persona.slice(0, 40);
  // Notification prefs: a flat map of { <notifKey>: { inapp: bool, email: bool } }.
  // Stored verbatim (bounded) so the frontend owns the catalog; no per-key allowlist.
  if (body.notifications && typeof body.notifications === "object") {
    const n = {};
    let count = 0;
    for (const k of Object.keys(body.notifications)) {
      if (count++ >= 100) break;
      const v = body.notifications[k];
      if (v && typeof v === "object") n[String(k).slice(0, 60)] = { inapp: !!v.inapp, email: !!v.email };
    }
    patch.notifications = n;
  }
  const saved = await saveUserSettings(env, email, patch);
  const user = await currentUser(request, env).catch(() => null);
  return json({ ok: true, me: merge(email, user, saved) }, {}, cors);
}
