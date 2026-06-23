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
import * as feedback from "./api/feedback.js";
import * as queue from "./api/queue.js";
import * as hit from "./api/hit.js";
import * as analytics from "./api/analytics.js";
import * as liStatus from "./api/li-status.js";
import * as xStatus from "./api/x-status.js";
import * as xTrigger from "./api/x-trigger.js";
import * as xMetrics from "./api/x-metrics.js";
import * as requeue from "./api/requeue.js";
import * as gbpStatus from "./api/gbp-status.js";
import * as adminReset from "./api/admin-reset.js";
import * as admin from "./admin.js";
import { lastPublishedAt } from "./_lib/queue.js";
import { publishNextLive, LAUNCH_PLATFORMS, PLATFORM_CADENCE_DAYS } from "./_lib/publish.js";

const ROUTES = {
  "/api/register": register,
  "/api/visit": visit,
  "/api/consent": consent,
  "/api/status": status,
  "/api/preview": preview,
  "/api/unsubscribe": unsubscribe,
  "/api/social-queue": socialQueue,
  "/api/feedback": feedback,
  "/api/queue": queue,
  "/api/hit": hit,
  "/api/analytics": analytics,
  "/api/li-status": liStatus,
  "/api/x-status": xStatus,
  "/api/x-trigger": xTrigger,
  "/api/x-metrics": xMetrics,
  "/api/requeue": requeue,
  "/api/gbp-status": gbpStatus,
  "/api/admin-reset": adminReset,
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

  // Cron: drip the Resource Center social queue. Runs daily; each platform has
  // its own cadence (PLATFORM_CADENCE_DAYS) and only posts once that many days
  // have elapsed since its last published post — so Facebook posts daily,
  // linkedin_company every other day, linkedin_personal weekly, all from one
  // daily trigger. Safe no-op until SOCIAL_AUTOPOST_ENABLED === "true" AND a
  // platform's secrets are configured (each adapter self-skips when creds are
  // missing). On success the row is marked published with the live post URL; on
  // error it stays ready_to_publish and retries next eligible run.
  async scheduled(event, env, ctx) {
    if (env.SOCIAL_AUTOPOST_ENABLED !== "true" || !env.DB) return;
    const now = Date.now();
    for (const platform of LAUNCH_PLATFORMS) {
      try {
        // LinkedIn (via Buffer): only Mondays & Thursdays (weekday content calendar).
        if (platform === "linkedin_company" && ![1, 4].includes(new Date(now).getUTCDay())) {
          console.log("[social] linkedin_company: not Mon/Thu — skipping"); continue;
        }
        // Cadence gate: skip until enough days have passed since the last post.
        // The 0.5-day slack keeps a fixed-time daily cron from drifting to the
        // next interval (e.g. a 2-day cadence reliably fires on day 2, not 3).
        const cadenceDays = PLATFORM_CADENCE_DAYS[platform] || 1;
        const last = await lastPublishedAt(env, platform);
        if (last) {
          const elapsedDays = (now - new Date(last).getTime()) / 86400000;
          if (elapsedDays < cadenceDays - 0.5) {
            console.log(`[social] ${platform}: not due (${elapsedDays.toFixed(1)}/${cadenceDays}d)`);
            continue;
          }
        }
        const out = await publishNextLive(env, platform);
        if (out.empty || out.exhausted) {
          console.log(`[social] ${platform}: nothing live to post`);
        } else {
          const { row, res } = out;
          console.log(
            `[social] ${platform} ${row.resource_slug}: ` +
              (res.ok ? "published " + (res.post_url || "") : res.skipped ? "skipped (no creds)" : "error " + res.error)
          );
        }
      } catch (err) {
        console.log(`[social] ${platform} fatal: ${String(err).slice(0, 160)}`);
      }
    }
  },
};
