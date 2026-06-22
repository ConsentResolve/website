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
  return json({
    totals: { clicks, demos, signups },
    funnel: { clicks, registered: demos, visited, consented, enrolled, opted_in: signups },
    by_trade: await all("SELECT COALESCE(NULLIF(trade,''),'(unknown)') k, COUNT(*) c FROM participants GROUP BY k ORDER BY c DESC"),
    by_source: await all("SELECT COALESCE(NULLIF(utm_source,''),'(direct)') k, COUNT(*) c FROM traffic WHERE path LIKE '/demo%' GROUP BY k ORDER BY c DESC"),
    demos_by_source: await all("SELECT COALESCE(NULLIF(json_extract(metadata,'$.src'),''),'(direct)') k, COUNT(*) c FROM events WHERE event_type='registered' GROUP BY k ORDER BY c DESC"),
    by_day: await all("SELECT substr(created_at,1,10) k, COUNT(*) c FROM participants GROUP BY k ORDER BY k DESC LIMIT 30"),
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
