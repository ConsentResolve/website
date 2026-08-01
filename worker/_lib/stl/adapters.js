// Speed-to-Lead — channel adapters. Real provider calls (Resend / Twilio / Retell)
// gated by the simulate↔live switch (settings.js). In simulate (or when a live
// send is suppressed by the internal test allowlist) we RECORD the intended send
// and return act:"simulate" — the full flow is exercisable without touching a real
// number. build step 5–7.
import { decideDispatch } from "./settings.js";
import { logEvent } from "./classifier.js";
import { sendMessage as gmailSend } from "../gmail.js";

// Returns { act, outcome, providerRef, detail }
export async function dispatch(env, settings, channel, ctx, rendered) {
  const lead = ctx.lead;
  const recipient = channel === "email" ? lead.email : lead.phone;
  const decision = decideDispatch(settings, channel, recipient);

  if (decision.act === "paused") return { act: "paused", outcome: "skipped", detail: "engine paused" };
  if (!recipient) return { act: decision.act, outcome: "failed", detail: `no ${channel === "email" ? "email" : "phone"} on lead` };

  if (decision.act === "simulate") {
    await logEvent(env, lead.id, "simulated_send", { channel, step: ctx.step, to: recipient });
    return { act: "simulate", outcome: simulatedOutcome(channel), providerRef: "sim-" + crypto.randomUUID().slice(0, 8), detail: "simulated" };
  }

  // ---- LIVE ----
  try {
    if (channel === "email") return await sendEmail(env, lead, rendered);
    if (channel === "sms") return await sendSms(env, lead, rendered);
    if (channel === "call_ai") return await startRetell(env, lead, ctx);
    if (channel === "call_human") return await queueHumanDial(env, lead, ctx, rendered);
  } catch (e) {
    return { act: "live", outcome: "failed", detail: String(e).slice(0, 160) };
  }
  return { act: "live", outcome: "failed", detail: "unhandled channel" };
}

function simulatedOutcome(channel) {
  return channel === "email" ? "delivered" : channel === "sms" ? "sms_delivered" : "no_answer";
}

async function sendEmail(env, lead, r) {
  const subject = r.subject || "Consent Resolve";
  const text = r.text || "";
  // Primary: send through the connected Google Workspace mailbox (hello@consentresolve.com) —
  // no separate sending domain to verify, great deliverability, and replies thread straight
  // into the real inbox. The account is the first CRM inbox (default hello@).
  const account = String(env.STL_EMAIL_ACCOUNT || env.CRM_INBOX_EMAILS || "hello@consentresolve.com").split(/[,\s]+/)[0].trim().toLowerCase();
  const g = await gmailSend(env, account, lead.email, subject, text, null, {}).catch((e) => ({ error: String(e).slice(0, 120) }));
  if (g && g.ok) return { act: "live", outcome: "delivered", providerRef: g.id || null, detail: "gmail" };

  // Fallback: Resend, only if a key is configured — keeps sends alive if the Gmail token lapses.
  if (env.RESEND_API_KEY) {
    const from = env.STL_FROM_EMAIL || env.FROM_EMAIL || "Consent Resolve <hello@consentresolve.com>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [lead.email], reply_to: env.REPLY_TO || undefined, subject, text }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) return { act: "live", outcome: "delivered", providerRef: j.id || null, detail: "resend_fallback" };
    return { act: "live", outcome: "failed", detail: `gmail_fail(${(g && g.error) || "?"}); resend_${res.status}: ${String(j.message || j.error || "").slice(0, 120)}` };
  }
  return { act: "live", outcome: "failed", detail: "gmail_" + String((g && g.error) || "failed").slice(0, 140) };
}

async function sendSms(env, lead, r) {
  const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) return { act: "live", outcome: "failed", detail: "missing_twilio_creds" };
  const form = new URLSearchParams();
  form.set("To", lead.phone);
  if (env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  else form.set("From", env.TWILIO_FROM_NUMBER || "");
  form.set("Body", r.text || "");
  // Delivery status callbacks flow back to /api/stl/twilio/status → update the touchpoint.
  if (env.STL_PUBLIC_ORIGIN) form.set("StatusCallback", `${env.STL_PUBLIC_ORIGIN}/api/stl/twilio/status`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const j = await res.json().catch(() => ({}));
  // Twilio returns { code, message, more_info } on error — capture the real code (e.g. 21608 trial, 30034 10DLC).
  if (!res.ok) return { act: "live", outcome: "sms_failed", detail: `twilio_${j.code || res.status}: ${String(j.message || "").slice(0, 180)}`, moreInfo: j.more_info || null };
  return { act: "live", outcome: "sms_delivered", providerRef: j.sid || null };
}

async function startRetell(env, lead, ctx) {
  if (!env.RETELL_API_KEY) return { act: "live", outcome: "failed", detail: "missing_retell_key" };
  const rep = ctx.rep;
  // Per-call dynamic variables — Ruby's prompt + transfer tool interpolate these.
  // transfer_number drives the warm-transfer destination (the on-shift rep). Empty =
  // no rep available → Ruby confirms the slot instead of transferring.
  // Transfer destination is the HUNT number (STL_TRANSFER_NUMBER) which runs the
  // priority cascade (primary → backups w/ no-answer failover). Only set it when at
  // least one rep is available (ctx.rep non-null); empty => Ruby confirms the slot.
  const dyn = {
    first_name: lead.first_name || "there",
    company: lead.company || "",
    transfer_number: (rep && env.STL_TRANSFER_NUMBER) ? env.STL_TRANSFER_NUMBER : "",
    rep_name: (rep && rep.name) || "a teammate",
    meeting_time: (ctx.meeting && ctx.meeting.scheduled_for)
      ? new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: lead.timezone || "America/Chicago" }).format(new Date(ctx.meeting.scheduled_for))
      : "your booked time",
  };
  const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RETELL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from_number: env.RETELL_FROM_NUMBER,
      to_number: lead.phone,
      override_agent_id: env.RETELL_AGENT_ID || undefined,
      retell_llm_dynamic_variables: dyn,
      metadata: { lead_id: lead.id, touchpoint_id: ctx.touchpointId, step: ctx.step, transfer_number: dyn.transfer_number },
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { act: "live", outcome: "failed", detail: `retell_${res.status}: ${String(j.message || j.error_message || j.error || "").slice(0, 180)}` };
  return { act: "live", outcome: "no_answer", providerRef: j.call_id || null, pending: true };
}

// Human dial = queue for a rep (no external API). Notify the on-call/rep webhook.
async function queueHumanDial(env, lead, ctx, r) {
  await alert(env, `Dial queued: ${lead.first_name || "lead"} ${lead.company ? "(" + lead.company + ")" : ""} — ${lead.phone} · step ${ctx.step}`);
  return { act: "live", outcome: "queued", detail: "queued for rep", script: (r && r.script) || null };
}

// Paging / notification for gate violations and rep queue (spec §4). Best-effort.
export async function alert(env, message, extra) {
  const url = env.STL_ALERT_URL || env.TEAM_NOTIFY_URL || env.SALES_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[Speed-to-Lead] ${message}`, ...(extra || {}) }),
    });
  } catch (_) {}
}
