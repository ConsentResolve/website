// Performance analytics — /api/analytics?key=<FEEDBACK_KEY>  (GET, key-gated, aggregates only — no PII)
// Funnel: clicks (/demo landings) → demos (registered) → opted-in signups, plus sub-steps + breakdowns.
import { json, corsHeaders } from "../_lib/http.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: { ...corsHeaders(request, env), "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}

export async function onRequestGet({ request, env }) {
  const key = env.FEEDBACK_KEY;
  if (!key || new URL(request.url).searchParams.get("key") !== key) return json({ error: "unauthorized" }, { status: 401 });
  const one = async (sql) => { try { const r = await env.DB.prepare(sql).first(); return r ? Object.values(r)[0] : 0; } catch { return 0; } };
  const all = async (sql) => { try { const { results } = await env.DB.prepare(sql).all(); return results || []; } catch { return []; } };
  // Fetch R2 JSON server-side (no CORS) so the dashboard needs only this one same-origin call.
  const R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev";
  const r2json = async (k) => { try { const r = await fetch(`${R2}/${k}`); return r.ok ? await r.json() : []; } catch { return []; } };
  const demos = await one("SELECT COUNT(*) FROM participants");
  const signups = await one("SELECT COUNT(*) FROM participants WHERE consent_contact=1");
  const clicks = await one("SELECT COUNT(*) FROM traffic WHERE path LIKE '/demo%'");
  const visited = await one("SELECT COUNT(*) FROM participants WHERE visited_at IS NOT NULL");
  const consented = await one("SELECT COUNT(*) FROM participants WHERE consented_at IS NOT NULL");
  const enrolled = await one("SELECT COUNT(*) FROM participants WHERE enrolled_at IS NOT NULL");
  // Instantly campaign analytics (Bearer; guarded so it never breaks the dashboard).
  // Field names mapped defensively across likely V2 keys; validate on first live campaign.
  const instantly = await (async () => {
    try {
      if (!env.INSTANTLY_API_KEY) return [];
      const r = await fetch("https://api.instantly.ai/api/v2/campaigns/analytics", {
        headers: { Authorization: `Bearer ${env.INSTANTLY_API_KEY}`, Accept: "application/json",
          // Instantly's API is behind Cloudflare; a browser-like UA avoids 403/1010 bot blocks.
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } });
      if (!r.ok) return [];
      const d = await r.json();
      const list = Array.isArray(d) ? d : (d.items || d.data || d.campaigns || []);
      const num = (o, ...keys) => { for (const k of keys) if (o && o[k] != null) return +o[k] || 0; return 0; };
      return list.map((c) => ({
        name: c.campaign_name || c.name || c.campaign_id || c.id || "campaign",
        leads: num(c, "leads_count", "total_leads", "leads"),
        sent: num(c, "emails_sent_count", "sent_count", "emails_sent", "contacted_count", "sent"),
        opens: num(c, "open_count", "unique_opens", "opened", "opens"),
        replies: num(c, "reply_count", "replied", "replies"),
        interested: num(c, "interested_count", "positive_reply_count", "interested"),
      }));
    } catch { return []; }
  })();
  return json({
    totals: { clicks, demos, signups },
    funnel: { clicks, registered: demos, visited, consented, enrolled, opted_in: signups },
    by_trade: await all("SELECT COALESCE(NULLIF(trade,''),'(unknown)') k, COUNT(*) c FROM participants GROUP BY k ORDER BY c DESC"),
    by_source: await all("SELECT COALESCE(NULLIF(utm_source,''),'(direct)') k, COUNT(*) c FROM traffic WHERE path LIKE '/demo%' GROUP BY k ORDER BY c DESC"),
    demos_by_source: await all("SELECT COALESCE(NULLIF(json_extract(metadata,'$.src'),''),'(direct)') k, COUNT(*) c FROM events WHERE event_type='registered' GROUP BY k ORDER BY c DESC"),
    // Per-wave dimension (utm_campaign, e.g. hvac_2026) — drives the per-industry view
    by_campaign: await all("SELECT COALESCE(NULLIF(utm_campaign,''),'(none)') k, COUNT(*) c FROM traffic WHERE path LIKE '/demo%' GROUP BY k ORDER BY c DESC"),
    signups_by_trade: await all("SELECT COALESCE(NULLIF(trade,''),'(unknown)') k, COUNT(*) c FROM participants WHERE consent_contact=1 GROUP BY k ORDER BY c DESC"),
    by_day: await all("SELECT substr(created_at,1,10) k, COUNT(*) c FROM participants GROUP BY k ORDER BY k DESC LIMIT 30"),
    instantly,
    metrics: await r2json("social/metrics.json"),
    // Delivery = runner reels (R2 post-log) + worker-queue posts (X / GBP live in D1,
    // not the post-log) so the dashboard shows every platform that actually posts.
    delivery: [
      ...(await r2json("social/post-log.json")),
      ...(await all(
        "SELECT platform, resource_slug name, post_url, published_at ts FROM social_queue WHERE status='published' AND platform IN ('x','google_business_profile','linkedin_company') ORDER BY published_at DESC LIMIT 60"
      )).map((r) => ({ platform: r.platform === "google_business_profile" ? "gbp" : (r.platform === "linkedin_company" ? "li" : r.platform),
        name: r.name, status: "ok", ts: r.ts, note: r.post_url || "" })),
    ],
  });
}
