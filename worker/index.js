// Consent Resolve — Worker entry for the main site.
//
// The marketing site is a static Astro build served by Cloudflare's static
// assets (the ASSETS binding). This Worker runs only for requests that don't
// match a static file — in practice, the live-demo API under /api/*. Everything
// else falls through to ASSETS so the static site is served exactly as before.
//
// API handlers keep the Pages-Functions signature (onRequestGet/Post/Options)
// so they stay portable.

import * as register from "./api/register.js";
import * as visit from "./api/visit.js";
import * as consent from "./api/consent.js";
import * as status from "./api/status.js";
import * as preview from "./api/preview.js";
import * as unsubscribe from "./api/unsubscribe.js";
import * as socialQueue from "./api/social-queue.js";
import * as admin from "./admin.js";

const ROUTES = {
  "/api/register": register,
  "/api/visit": visit,
  "/api/consent": consent,
  "/api/status": status,
  "/api/preview": preview,
  "/api/unsubscribe": unsubscribe,
  "/api/social-queue": socialQueue,
};

// Routes that don't need the D1 binding (so they work even before it's enabled).
const NO_DB = new Set(["/api/preview"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Authenticated admin (dynamic, Worker-rendered). Handles its own auth.
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      try {
        return await admin.handle({ request, env, ctx });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "admin_error", detail: String(err).slice(0, 300) }),
          { status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
        );
      }
    }

    const mod = ROUTES[url.pathname];

    if (mod) {
      // Demo backend needs the D1 binding. Until it's enabled in wrangler.jsonc
      // the API answers with a clean 503 (the static site is unaffected).
      if (!env.DB && !NO_DB.has(url.pathname) && request.method.toUpperCase() !== "OPTIONS") {
        return new Response(
          JSON.stringify({ error: "demo_unconfigured", message: "The live demo backend isn't enabled yet." }),
          { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
        );
      }
      const context = { request, env, ctx, waitUntil: ctx.waitUntil.bind(ctx) };
      const method = request.method.toUpperCase();
      try {
        if (method === "OPTIONS" && mod.onRequestOptions) return await mod.onRequestOptions(context);
        if (method === "GET" && mod.onRequestGet) return await mod.onRequestGet(context);
        if (method === "POST" && mod.onRequestPost) return await mod.onRequestPost(context);
        return new Response("Method not allowed", { status: 405 });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "server", detail: String(err).slice(0, 300) }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Not an API route → serve the static Astro build.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
