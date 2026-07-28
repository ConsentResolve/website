# GA4 automation

Service-account key is in macOS Keychain (base64):
    security find-generic-password -s cr-ga4_sa -a cr -w | base64 -d

- Project: consent-resolve-seo
- Service account: consentr-resolve-ads@consent-resolve-seo.iam.gserviceaccount.com
- GA4 property: properties/524679634 (measurement_id G-6JTD5SZNFY), account 384596105
- venv: /Users/aaronphillips/GIT/.ga-venv (google-analytics-admin, google-auth)

Run: /Users/aaronphillips/GIT/.ga-venv/bin/python scripts/analytics/ga4_key_events.py
Marks book_meeting + generate_lead as Key Events (conversions).
