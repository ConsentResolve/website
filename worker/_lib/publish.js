// Social auto-publish adapters for the Cloudflare Cron Worker.
//
// scheduled() in index.js drips ready_to_publish queue rows here — one per
// platform per daily run. Each adapter reads ITS platform's secrets from env;
// if a required secret is missing it returns { skipped: true } so the system
// fails safe until that platform is configured. Nothing runs at all unless
// env.SOCIAL_AUTOPOST_ENABLED === "true".
//
// Per-platform secrets (set with `wrangler secret put NAME`):
//   Facebook : FACEBOOK_PAGE_ID, FACEBOOK_PAGE_ACCESS_TOKEN (long-lived page token)
//   LinkedIn : LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN (urn:li:organization:####)
//   X        : X_CLIENT_ID, X_CLIENT_SECRET, X_REFRESH_TOKEN (OAuth2, tweet.write; refresh rotates → persisted in social_tokens)
//   Google   : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GBP_ACCOUNT_ID, GBP_LOCATION_ID
import { nowIso } from "./db.js";

const SITE = "https://consentresolve.com";

// Platforms we publish on launch. Others stay queued for later.
export const LAUNCH_PLATFORMS = ["linkedin", "facebook", "x", "google_business_profile"];

function abs(u) {
  if (!u) return "";
  return /^https?:\/\//.test(u) ? u : SITE + u;
}

/** Build post text from a social.json variant payload. */
export function composeText(p, platform) {
  if (!p) return "";
  const parts = [];
  if (p.caption) parts.push(String(p.caption).trim());
  if (p.utm_url && platform !== "google_business_profile") parts.push(p.utm_url); // GBP uses a CTA button
  const tags = Array.isArray(p.hashtags) ? p.hashtags : [];
  if (tags.length && ["linkedin", "facebook", "x"].includes(platform)) {
    parts.push(tags.map((t) => (String(t).startsWith("#") ? t : "#" + t)).join(" "));
  }
  return parts.join("\n\n");
}

// ── OAuth token store (D1: social_tokens) ───────────────────────────────────
async function getTokens(env, provider) {
  try {
    return await env.DB.prepare("SELECT * FROM social_tokens WHERE provider = ?").bind(provider).first();
  } catch {
    return null;
  }
}
async function saveTokens(env, provider, { access_token, refresh_token, expires_at }) {
  await env.DB.prepare(
    `INSERT INTO social_tokens (provider, access_token, refresh_token, expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, social_tokens.refresh_token),
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`
  )
    .bind(provider, access_token || null, refresh_token || null, expires_at || null, nowIso())
    .run();
}

// ── Facebook Page (long-lived page token) ────────────────────────────────────
async function postFacebook(env, p) {
  const pageId = env.FACEBOOK_PAGE_ID;
  const token = env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) return { skipped: true, error: "missing_credentials" };
  const message = composeText(p, "facebook");
  const img = abs(p.image_url);
  const endpoint = img
    ? `https://graph.facebook.com/v21.0/${pageId}/photos`
    : `https://graph.facebook.com/v21.0/${pageId}/feed`;
  const body = new URLSearchParams({ access_token: token });
  if (img) { body.set("url", img); body.set("caption", message); }
  else { body.set("message", message); if (p.utm_url) body.set("link", p.utm_url); }
  const res = await fetch(endpoint, { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error?.message || `fb_http_${res.status}` };
  const id = data.post_id || data.id;
  return { ok: true, post_id: id, post_url: id ? `https://www.facebook.com/${id}` : null };
}

// ── LinkedIn (org article share; LinkedIn scrapes our OG image) ──────────────
async function postLinkedIn(env, p) {
  const token = env.LINKEDIN_ACCESS_TOKEN;
  const author = env.LINKEDIN_AUTHOR_URN;
  if (!token || !author) return { skipped: true, error: "missing_credentials" };
  const commentary = composeText(p, "linkedin");
  const hasLink = Boolean(p.utm_url);
  const payload = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: commentary },
        shareMediaCategory: hasLink ? "ARTICLE" : "NONE",
        ...(hasLink ? { media: [{ status: "READY", originalUrl: p.utm_url }] } : {}),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `li_http_${res.status}:${t.slice(0, 140)}` };
  }
  const id = res.headers.get("x-restli-id") || (await res.json().catch(() => ({}))).id;
  return { ok: true, post_id: id, post_url: id ? `https://www.linkedin.com/feed/update/${id}/` : null };
}

// ── X / Twitter (OAuth2 user context; refresh token rotates → persist) ───────
async function xAccessToken(env) {
  const clientId = env.X_CLIENT_ID, clientSecret = env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const stored = await getTokens(env, "x");
  const refresh = (stored && stored.refresh_token) || env.X_REFRESH_TOKEN;
  if (!refresh) return null;
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) return null;
  // X rotates the refresh token on every use — persist the new one or the next run breaks.
  await saveTokens(env, "x", {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refresh,
    expires_at: new Date(Date.now() + (data.expires_in || 7200) * 1000).toISOString(),
  });
  return data.access_token;
}
async function postX(env, p) {
  if (!env.X_CLIENT_ID || !(env.X_REFRESH_TOKEN || (await getTokens(env, "x"))?.refresh_token)) {
    return { skipped: true, error: "missing_credentials" };
  }
  const token = await xAccessToken(env);
  if (!token) return { ok: false, error: "x_token_refresh_failed" };
  const text = composeText(p, "x").slice(0, 280);
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.detail || data.title || `x_http_${res.status}` };
  const id = data.data?.id;
  return { ok: true, post_id: id, post_url: id ? `https://x.com/i/web/status/${id}` : null };
}

// ── Google Business Profile (localPosts; stable refresh token) ───────────────
async function googleAccessToken(env) {
  const clientId = env.GOOGLE_CLIENT_ID, clientSecret = env.GOOGLE_CLIENT_SECRET, refresh = env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refresh) return null;
  const cached = await getTokens(env, "google");
  if (cached && cached.access_token && cached.expires_at && new Date(cached.expires_at) > new Date(Date.now() + 60000)) {
    return cached.access_token;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refresh }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) return null;
  await saveTokens(env, "google", {
    access_token: data.access_token,
    refresh_token: refresh,
    expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
  });
  return data.access_token;
}
async function postGBP(env, p) {
  const acct = env.GBP_ACCOUNT_ID, loc = env.GBP_LOCATION_ID;
  if (!env.GOOGLE_REFRESH_TOKEN || !acct || !loc) return { skipped: true, error: "missing_credentials" };
  const token = await googleAccessToken(env);
  if (!token) return { ok: false, error: "google_token_refresh_failed" };
  const summary = composeText(p, "google_business_profile").slice(0, 1500);
  const img = abs(p.image_url);
  const post = {
    languageCode: "en-US",
    summary,
    ...(p.utm_url ? { callToAction: { actionType: "LEARN_MORE", url: p.utm_url } } : {}),
    ...(img ? { media: [{ mediaFormat: "PHOTO", sourceUrl: img }] } : {}),
  };
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${acct}/locations/${loc}/localPosts`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(post) }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error?.message || `gbp_http_${res.status}` };
  return { ok: true, post_id: data.name || null, post_url: data.searchUrl || null };
}

const ADAPTERS = {
  facebook: postFacebook,
  linkedin: postLinkedIn,
  x: postX,
  google_business_profile: postGBP,
};

/** Publish one queue row's payload to its platform. Returns a result object. */
export async function publish(env, platform, payload) {
  const fn = ADAPTERS[platform];
  if (!fn) return { skipped: true, error: "no_adapter" };
  try {
    return await fn(env, payload);
  } catch (err) {
    return { ok: false, error: "exception:" + String(err).slice(0, 160) };
  }
}
