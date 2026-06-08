// GET /api/preview?type=promo|owner|customer&trade=plumber&name=...&email=...
// Renders the email HTML in the browser (no send) so you can design/iterate.
// Uses sample data; never touches D1. noindex.

import { renderEmail } from "../_lib/email.js";
import { baseOrigin } from "../_lib/http.js";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const type = u.searchParams.get("type") || env.EMAIL_MODE || "promo";
  const sample = {
    id: "preview-token",
    name: u.searchParams.get("name") || "Jordan Smith",
    email: u.searchParams.get("email") || "jordan@example.com",
    business_name: u.searchParams.get("business_name") || "Smith Plumbing & Air",
    trade: u.searchParams.get("trade") || "plumber",
    consented_at: new Date().toISOString(),
    sample_page: "/demo/sample/",
  };
  const { subject, html } = renderEmail(env, sample, baseOrigin(request, env), type);
  // Prepend a tiny dev banner showing the subject line (stripped from the real send).
  const banner = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#0a1628;color:#fff;padding:10px 16px;font-size:13px">
    <strong>Email preview</strong> · type=<code>${type}</code> · Subject: <em>${subject.replace(/</g, "&lt;")}</em>
    <span style="color:#94a3b8"> — append ?type=promo|owner|customer&amp;trade=roofer to switch</span>
  </div>`;
  return new Response(banner + html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
  });
}
