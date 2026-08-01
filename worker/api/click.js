// GET /r?u=<dest>&e=<email>&c=<campaign>&l=<label>
// Public email-click redirect. Logs the click (link_clicked event + contact activity +
// outreach attribution), then 302s to the same-origin destination. Open-redirect safe:
// safeDest() drops anything cross-origin back to the home page.
import { safeDest, recordClick } from "../_lib/click-track.js";

// Mail-security scanners and image/link proxies pre-fetch links, which would register as
// phantom clicks. Skip logging (but still redirect) for HEAD requests and known scanner UAs.
const SCANNER_UA = /(GoogleImageProxy|ggpht|bing|Barracuda|Mimecast|Proofpoint|MessageLabs|Microsoft-?Office|SkypeUriPreview|Slackbot|facebookexternalhit|WhatsApp|TelegramBot|Twitterbot|LinkedInBot|preview|scanner|crawler|spider|bot\b)/i;

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const dest = safeDest(env, u.searchParams.get("u"));
  const email = u.searchParams.get("e") || "";
  const campaign = u.searchParams.get("c") || "";
  const label = u.searchParams.get("l") || "";

  // Only record a real, human GET — not a scanner/proxy prefetch (those inflate click counts
  // and can auto-flip a lead). Failures never block the redirect.
  const ua = request.headers.get("user-agent") || "";
  const isPrefetch = request.method === "HEAD" || SCANNER_UA.test(ua) ||
    /^(prefetch|prerender)$/i.test(request.headers.get("purpose") || request.headers.get("x-purpose") || "");
  if (!isPrefetch) {
    try { await recordClick(env, { dest, email, campaign, label }); } catch (_) {}
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: dest,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      // Do NOT leak the ?e=<email> (or campaign/label) to the destination page's analytics
      // via document.referrer — for a consent-first brand this matters most of all.
      "Referrer-Policy": "no-referrer",
    },
  });
}

// HEAD (scanner probes) — redirect the same way, but the method check above skips logging.
export const onRequestHead = onRequestGet;
