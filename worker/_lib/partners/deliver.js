// Partner delivery dispatch — the single seam between "a lead was recovered"
// and the N partner adapters (docs/crm/PARTNER-INTEGRATIONS.md architecture).
// Adapters self-log to partner_deliveries; this layer only decides who gets
// the lead. A partner with no connected account is skipped silently so demo
// consents don't pile up failed-delivery rows before anything is connected.
import { jobberConfigured, getConnection as jobberConnection, pushLead as jobberPush } from "./jobber.js";

/** Normalize a demo participant row into the shared RecoveredLead shape.
 *  Pure — exported for offline tests. */
export function participantToLead(p, { consentedAt, policyVersion, pages } = {}) {
  return {
    email: p.email,
    name: p.name || "",
    phone: p.phone || undefined,
    company: p.business_name || undefined,
    trade: p.trade || undefined,
    consent: {
      ts: consentedAt || p.consented_at || undefined,
      policyVersion: policyVersion || p.consent_text_version || undefined,
      sourceUrl: p.sample_page || undefined,
    },
    session: {
      pages: pages && pages.length ? pages : (p.sample_page ? [p.sample_page] : []),
      firstSeen: p.created_at || undefined,
    },
  };
}

/**
 * Fan one RecoveredLead out to every partner connected for this customer.
 * customerKey identifies whose connections receive the lead — "default" is
 * ConsentResolve's own site/demo; customer sites will pass their own key once
 * the tracking pipeline carries one. Never throws — each adapter already
 * captures its own errors — and returns
 * [{ partner, skipped? } | { partner, ...adapterResult }] for callers that
 * want to log the outcome (e.g. the participant event timeline).
 */
export async function deliverLeadToPartners(env, lead, customerKey = "default") {
  const results = [];
  if (jobberConfigured(env)) {
    try {
      const conn = await jobberConnection(env, customerKey);
      results.push(conn ? { partner: "jobber", ...(await jobberPush(env, lead, customerKey)) } : { partner: "jobber", skipped: "not_connected" });
    } catch (e) {
      results.push({ partner: "jobber", ok: false, error: String(e).slice(0, 200) });
    }
  }
  return results;
}
