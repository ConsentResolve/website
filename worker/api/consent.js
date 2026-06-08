// POST /api/consent { dt } — the orchestrator.
// record consent (proof: version + timestamp + IP) -> send reveal email ->
// mark emailed -> enroll in sales -> mark enrolled. Email/webhook failures are
// logged + retried once but never block the confirmation screen.

import { json, clientIp, baseOrigin } from "../_lib/http.js";
import { getParticipant, updateParticipant, logEvent, nowIso } from "../_lib/db.js";
import { sendRevealEmail } from "../_lib/email.js";
import { enrollSales } from "../_lib/sales.js";
import { tradeProfile } from "../_lib/trades.js";

export async function onRequestPost({ request, env }) {
  let dt = "";
  try {
    const body = await request.json();
    dt = (body.dt || "").toString();
  } catch {
    /* ignore */
  }

  const p = await getParticipant(env, dt);
  if (!p) {
    return json({ ok: false, error: "invalid_token" }, { status: 404 });
  }

  const consentedAt = nowIso();
  const version = env.CONSENT_TEXT_VERSION || "v1";
  const ip = clientIp(request);

  // Record consent proof (idempotent — re-accepting just refreshes the record).
  await updateParticipant(env, p.id, {
    status: "consented",
    consented_at: consentedAt,
    consent_text_version: version,
    ip: ip || p.ip,
  });
  await logEvent(env, p.id, "consented", { version, ip });

  const enriched = { ...p, consented_at: consentedAt, sample_page: p.sample_page || env.SAMPLE_PATH || "/demo/sample/" };
  const baseUrl = baseOrigin(request, env);

  // --- Email (retry once) ---
  let email = await sendRevealEmail(env, enriched, baseUrl);
  if (!email.ok) {
    await logEvent(env, p.id, "error", { stage: "email", error: email.error, detail: email.detail });
    email = await sendRevealEmail(env, enriched, baseUrl);
  }
  if (email.ok) {
    await updateParticipant(env, p.id, { status: "emailed", emailed_at: nowIso() });
    await logEvent(env, p.id, "emailed", {});
  } else {
    await logEvent(env, p.id, "error", { stage: "email_retry", error: email.error });
  }

  // --- Sales enrollment ---
  const sales = await enrollSales(env, enriched);
  if (sales.ok) {
    await updateParticipant(env, p.id, { status: "enrolled", enrolled_at: nowIso() });
    await logEvent(env, p.id, "enrolled", {});
  } else {
    await logEvent(env, p.id, "error", { stage: "enroll", error: sales.error });
  }

  // Always succeed for the UI — the user has consented; the email is in flight.
  // Return the lead fields so the sample page can render the "here's the email
  // that just landed" preview inline (Step 2 of the guided journey).
  const t = tradeProfile(p.trade);
  return json({
    ok: true,
    emailed: email.ok,
    enrolled: sales.ok,
    lead: {
      name: p.name,
      email: p.email,
      business_name: p.business_name || "",
      trade_label: t.label,
      sample_page: enriched.sample_page,
      consented_at: consentedAt,
    },
  });
}
