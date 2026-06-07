// Sales enrollment: hand the participant to Make.com (CRM upsert + drip),
// plus an optional instant team ping so sales can follow up while it's hot.

export async function enrollSales(env, p) {
  if (!env.SALES_WEBHOOK_URL) return { ok: false, error: "missing_webhook" };

  const payload = {
    source: "live_demo",
    demo_token: p.id,
    name: p.name,
    email: p.email,
    business_name: p.business_name || null,
    phone: p.phone || null,
    trade: p.trade || null,
    consent_contact: !!p.consent_contact,
    consented_at: p.consented_at || null,
    sample_page: p.sample_page || null,
    status: "enrolled",
  };

  try {
    const res = await fetch(env.SALES_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Best-effort internal ping; never blocks enrollment.
    if (env.TEAM_NOTIFY_URL) {
      const note = `🔥 Hot demo lead: ${p.name} (${p.email})${p.business_name ? " · " + p.business_name : ""}${p.trade ? " · " + p.trade : ""}`;
      env.TEAM_NOTIFY_URL &&
        (await fetch(env.TEAM_NOTIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: note, ...payload }),
        }).catch(() => {}));
    }

    if (!res.ok) return { ok: false, error: `webhook_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: "webhook_failed", detail: String(err) };
  }
}
