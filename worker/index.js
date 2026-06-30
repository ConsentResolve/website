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
import * as identify from "./api/identify.js";
import * as analytics from "./api/analytics.js";
import * as liStatus from "./api/li-status.js";
import * as xStatus from "./api/x-status.js";
import * as xTrigger from "./api/x-trigger.js";
import * as xMetrics from "./api/x-metrics.js";
import * as requeue from "./api/requeue.js";
import * as gbpStatus from "./api/gbp-status.js";
import * as admin from "./admin.js";
import * as crm from "./crm.js";
import * as crmLeads from "./api/crm-leads.js";
import * as crmAnalytics from "./api/crm-analytics.js";
import * as crmSpend from "./api/crm-spend.js";
import * as crmSocial from "./api/crm-social.js";
import * as crmGmail from "./api/crm-gmail.js";
import * as crmCrisp from "./api/crm-crisp.js";
import * as crmApollo from "./api/crm-apollo.js";
import * as crmApolloSync from "./api/crm-apollo-sync.js";
import * as crmSocialScores from "./api/crm-social-scores.js";
import * as crmStatus from "./api/crm-status.js";
import * as crmAuth from "./api/crm-auth.js";
import * as crmMigrate from "./api/crm-migrate.js";
import * as crmInbox from "./api/crm-inbox.js";
import * as crmInstantly from "./api/crm-instantly.js";
import * as crmInstantlyCampaign from "./api/crm-instantly-campaign.js";
import * as crmLeadTokens from "./api/crm-lead-tokens.js";
import * as leadPrefill from "./api/lead-prefill.js";
import * as crmDeals from "./api/crm-deals.js";
import * as crmEnrich from "./api/crm-enrich.js";
import * as crmAnalytics2 from "./api/crm-analytics2.js";
import * as crmMeta from "./api/crm-meta.js";
import * as crmPresence from "./api/crm-presence.js";
import * as crmContact from "./api/crm-contact.js";
import * as crmMerge from "./api/crm-merge.js";
import * as crmDemoNotify from "./api/crm-demo-notify.js";
import { sweepDemoNotifications } from "./_lib/demo-notify.js";
import { autoEnrichSweep } from "./_lib/apollo.js";
import { metaConfigured, syncMetaSpend } from "./_lib/meta.js";
import * as crmMetaAds from "./api/crm-meta-ads.js";
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
  "/api/identify": identify,
  "/api/analytics": analytics,
  "/api/li-status": liStatus,
  "/api/x-status": xStatus,
  "/api/x-trigger": xTrigger,
  "/api/x-metrics": xMetrics,
  "/api/requeue": requeue,
  "/api/gbp-status": gbpStatus,
  "/api/crm/leads": crmLeads,
  "/api/crm/analytics": crmAnalytics,
  "/api/crm/spend": crmSpend,
  "/api/crm/social": crmSocial,
  "/api/crm/gmail/auth": crmGmail,
  "/api/crm/gmail/callback": crmGmail,
  "/api/crm/gmail/status": crmGmail,
  "/api/crm/gmail/disconnect": crmGmail,
  "/api/crm/gmail/thread": crmGmail,
  "/api/crm/gmail/send": crmGmail,
  "/api/crm/crisp": crmCrisp,
  "/api/crm/apollo": crmApollo,
  "/api/crm/apollo/sync": crmApolloSync,
  "/api/crm/social/scores": crmSocialScores,
  "/api/crm/status": crmStatus,
  "/api/crm/migrate": crmMigrate,
  "/api/crm/inbox": crmInbox,
  "/api/crm/instantly": crmInstantly,
  "/api/crm/instantly/campaign": crmInstantlyCampaign,
  "/api/crm/instantly/leadtokens": crmLeadTokens,
  "/api/lead-prefill": leadPrefill,
  "/api/crm/deals": crmDeals,
  "/api/crm/enrich": crmEnrich,
  "/api/crm/analytics2": crmAnalytics2,
  "/api/crm/meta": crmMeta,
  "/api/crm/meta/spend": crmMetaAds,
  "/api/crm/presence": crmPresence,
  "/api/crm/contact": crmContact,
  "/api/crm/merge": crmMerge,
  "/api/crm/demo-notify": crmDemoNotify,
  "/api/crm/auth/login": crmAuth,
  "/api/crm/auth/callback": crmAuth,
  "/api/crm/auth/logout": crmAuth,
  "/api/crm/auth/me": crmAuth,
};

// Routes that don't need the D1 binding (so they work even before it's enabled).
const NO_DB = new Set(["/api/preview"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CRM app (gated: admin session OR ?key=<CRM_KEY>). Worker-rendered like /admin.
    if (url.pathname === "/crm" || url.pathname.startsWith("/crm/")) {
      try {
        return await crm.handle({ request, env, ctx });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "crm_error", detail: String(err).slice(0, 300) }),
          { status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
        );
      }
    }

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
    // Apollo visitor sync — frequent cron. Incremental (only new emails), so it's
    // cheap to run often. No-op until APOLLO_API_KEY + APOLLO_CONTACTS_LABEL are set.
    if (event.cron === "*/5 * * * *") {
      if (!env.DB) return;
      try {
        const out = await crmApolloSync.runScheduledSync(env);
        if (out && out.synced) console.log(`[apollo] synced ${out.synced} new (${out.skipped} skipped)`);
      } catch (err) {
        console.log(`[apollo] sync error: ${String(err).slice(0, 160)}`);
      }
      // Unified inbox: pull new mail for the configured mailbox(es). No-op until a
      // CRM_INBOX_EMAILS account (default hello@) is Gmail-OAuth connected.
      try {
        const polled = await crmInbox.pollAllInboxes(env);
        for (const p of polled) if (p && p.ingested) console.log(`[inbox] ${p.account}: +${p.ingested} of ${p.seen}`);
      } catch (err) {
        console.log(`[inbox] poll error: ${String(err).slice(0, 160)}`);
      }
      // Instantly Unibox: ingest campaign replies as channel='instantly'. No-op without key.
      try {
        if (env.INSTANTLY_API_KEY) {
          const r = await crmInstantly.pollInstantly(env, { limit: 100 });
          if (r && r.messages_ingested) console.log(`[instantly] +${r.messages_ingested} msgs across ${r.replied_threads} replied threads`);
        }
      } catch (err) {
        console.log(`[instantly] poll error: ${String(err).slice(0, 160)}`);
      }
      // Resurface due snoozed conversations (BUILD-PLAN P1-10).
      try {
        const woke = await crmInbox.sweepSnoozed(env);
        if (woke) console.log(`[inbox] resurfaced ${woke} snoozed`);
      } catch (err) {
        console.log(`[inbox] snooze sweep error: ${String(err).slice(0, 160)}`);
      }
      // Deferred demo-signup notifications -> hello@ ~12 min after submit, with demo progress.
      try {
        const dn = await sweepDemoNotifications(env, { minMinutes: 12 });
        if (dn && dn.sent) console.log(`[demo-notify] sent ${dn.sent} of ${dn.scanned}`);
      } catch (err) {
        console.log(`[demo-notify] error: ${String(err).slice(0, 160)}`);
      }
      // Credit-gated Apollo auto-enrich: newest un-enriched business-email contacts.
      try {
        if (env.APOLLO_API_KEY) {
          const ae = await autoEnrichSweep(env, { limit: 8 });
          if (ae && ae.enriched) console.log(`[apollo-auto] enriched ${ae.enriched} of ${ae.scanned}`);
        }
      } catch (err) {
        console.log(`[apollo-auto] error: ${String(err).slice(0, 160)}`);
      }
      // Meta ad-spend sync (~4×/day): pull live spend into crm_spend so cost-per-lead +
      // ROAS reflect real numbers. Idempotent per calendar month.
      try {
        if (metaConfigured(env) && [3, 9, 15, 21].includes(new Date().getUTCHours()) && new Date().getUTCMinutes() < 5) {
          const ms = await syncMetaSpend(env);
          if (ms && ms.ok) console.log(`[meta-spend] synced ${ms.synced} campaigns, $${ms.total} (${ms.period})`);
        }
      } catch (err) {
        console.log(`[meta-spend] error: ${String(err).slice(0, 160)}`);
      }
      return;
    }

    // Daily social drip.
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
