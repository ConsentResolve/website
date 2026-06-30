# Consent Resolve — Google Ads API Tool Design

**Company:** Consent Resolve  ·  **Website:** https://consentresolve.com
**Tool type:** Internal, single-company marketing tool (not a third-party/agency platform; not resold)
**Access requested:** Basic access
**Manager account:** Consent Resolve Manager (manages only our own Google Ads account)

## 1. Overview

Consent Resolve operates an internal marketing CRM (a Cloudflare Worker + D1 application,
accessed by our own staff at consentresolve.com/crm). It already integrates the Meta
Marketing API and the Google Business Profile API for the **same company's own accounts**.
This request adds the Google Ads API so the same internal tool can (a) read our campaign
and conversion performance into our dashboard, and (b) create/manage campaigns in **our own
single Google Ads account** — replacing manual work in the Ads UI.

We do **not** manage other advertisers' accounts, do not offer this tool to third parties,
and do not resell or redistribute Google Ads data.

## 2. Architecture

- **Backend:** Cloudflare Worker (serverless), Cloudflare D1 (SQLite) for token + cache storage.
- **Auth:** OAuth 2.0 (scope `https://www.googleapis.com/auth/adwords`). A refresh token for
  our own account is obtained via a one-time browser consent flow and stored server-side; the
  worker exchanges it for short-lived access tokens. The developer token + `login-customer-id`
  (our manager account) are stored as encrypted Cloudflare secrets.
- **Frontend:** Our gated internal CRM (`/crm`), staff-only (Google SSO + allowlist).
- **API transport:** Google Ads API REST/gRPC, current stable version.

## 3. API services used

**Read / reporting (primary, daily):**
- `GoogleAdsService.SearchStream` (GAQL) — pull campaign, ad group, and conversion metrics
  (impressions, clicks, cost, conversions, conversion value) into our CRM dashboard for
  spend + ROAS reporting alongside Meta.
- `ConversionActionService` / GAQL on `conversion_action` — read our conversion actions and
  their tag labels (used to keep on-site conversion tracking in sync).
- `CustomerService.ListAccessibleCustomers` — resolve our own customer ID.

**Write / management (gated, low-frequency):**
- `CampaignBudgetService.MutateCampaignBudgets` — create a daily budget.
- `CampaignService.MutateCampaigns` — create campaigns (Search, Display, Performance Max),
  **always created PAUSED** for human review before activation.
- `AdGroupService` / `AdGroupAdService` / `AdGroupCriterionService` — create ad groups,
  responsive ads, and targeting.
- Campaign status changes (enable/pause) and budget edits — **only on explicit, per-action
  staff confirmation in the CRM** (never automated/autonomous).

## 4. Data flow

1. Staff member authenticates to the internal CRM (Google SSO).
2. A scheduled worker job (a few times/day) runs GAQL reporting queries → writes aggregate
   metrics to D1 → surfaced on the CRM dashboard (spend, conversions, cost-per-conversion).
3. To launch a campaign, a staff member defines it in the CRM; the worker creates the
   budget + campaign + ad group + ads via mutate operations, **PAUSED**. The staff member
   reviews in the Google Ads UI and activates manually.
4. No end-user/consumer data from the public site is sent to Google Ads beyond standard,
   consent-gated conversion events already implemented via gtag.

## 5. Access pattern, scale & compliance

- **Accounts managed:** exactly one (our own), under one manager account.
- **Volume:** low — a handful of reporting queries per day and occasional mutate operations;
  well within Basic access limits. We respect rate limits and back off on `RESOURCE_EXHAUSTED`.
- **Required Minimum Functionality:** the tool creates and reports on campaigns (not a
  reporting-only or bid-only stub).
- **Data handling:** Google Ads data is used solely inside our internal dashboard; it is not
  stored beyond aggregate caches, not shared with third parties, and not resold.
- **Policy:** we comply with the Google Ads API Terms and RMF; destructive/automated bidding
  or autonomous spend changes are not performed — money-affecting actions require explicit
  staff confirmation.

## 6. Mockup / current state

The internal CRM already runs equivalent integrations (Meta Marketing API spend + campaign
status, Google Business Profile localPosts) at consentresolve.com/crm. The Google Ads view
mirrors the existing "Spend / ROAS" and "What's Live" dashboards: a read-only metrics card
plus a gated, paused-by-default campaign creation flow.
