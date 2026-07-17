# SEO Dashboard — setup (Phase 1)

A `/seo` dashboard now lives alongside `/crm`, gated by the same auth (your CRM
Google sign-in, or `?key=<CRM_KEY>`). It has four tabs: **Overview, Queries,
Pages, Indexing**. Until you connect Google, every data tab shows a "not
connected" banner but the page works.

## ✅ Working now, no action needed — IndexNow

New/updated URLs can be pushed to Bing/Yandex instantly.
- Key file is live at `https://consentresolve.com/0452ce57fb0d3bbfdcb0d12e1ee8b142.txt`.
- **Manual:** `/seo` → **Indexing** tab → "Submit all URLs now".
- **CLI (post-deploy):** `python3 scripts/indexnow.py` (submits every sitemap URL),
  or `python3 scripts/indexnow.py <url> …` for specific pages.
- Google ignores IndexNow (it uses your sitemap on its own) — this is for Bing/Yandex/etc.

## 🔌 To light up the Overview / Queries / Pages tabs — connect Google (one service account powers both)

**1. Verify the site in Google Search Console** (if not already): https://search.google.com/search-console
   — a **Domain** property for `consentresolve.com` is best.

**2. Create a service account** (Google Cloud Console → any project):
   - Enable APIs: **Google Search Console API** and **Google Analytics Data API**.
   - IAM & Admin → Service Accounts → Create → **download the JSON key**.
   - Note the `client_email` (…@….iam.gserviceaccount.com) and `private_key`.

**3. Grant the service account read access:**
   - **Search Console** → Settings → Users and permissions → Add user →
     paste the SA `client_email`, permission **Restricted** (read is enough).
   - **GA4** → Admin → Property → Property Access Management → Add →
     SA `client_email`, role **Viewer**. Copy the **Property ID** (numeric, e.g. `501234567`).

**4. Add the Worker secrets** (from the repo root):
   ```bash
   npx wrangler secret put GSC_CLIENT_EMAIL     # the SA client_email
   npx wrangler secret put GSC_PRIVATE_KEY       # the SA private_key (paste the whole PEM, incl. BEGIN/END)
   npx wrangler secret put GSC_SITE_URL          # "sc-domain:consentresolve.com" (domain prop) OR "https://consentresolve.com/"
   npx wrangler secret put GA4_PROPERTY_ID       # the numeric GA4 property id
   # optional — only if GA4 uses a different service account:
   #   GA4_CLIENT_EMAIL, GA4_PRIVATE_KEY
   ```
   (Or add them in the Cloudflare dashboard → Worker → Settings → Variables → Encrypt.)

That's it — refresh `/seo` and Overview/Queries/Pages fill in (GSC data lags ~3 days,
so the dashboard reports a 28-day window ending 3 days ago vs. the prior 28 days).

## Notes
- **GA4 property**: if you don't have GA4 on the site yet, create one and add the tag;
  Overview's Sessions/Users/Key-events tiles stay empty until it's collecting data.
- **Access = read-only.** The SA can only read GSC/GA4; it can't change anything.
- **CRM_KEY**: the dashboard also accepts `?key=<CRM_KEY>` (defaults to `cr-dash-2026`
  unless you've set `CRM_KEY`/`DASHBOARD_KEY`) for quick access without signing in.
