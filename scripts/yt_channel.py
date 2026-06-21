#!/usr/bin/env python3
"""Set channel About (description + SEO keywords). Needs force-ssl. Merges into existing
brandingSettings so other settings are preserved.
  python3 scripts/yt_channel.py         -> show current
  python3 scripts/yt_channel.py apply   -> apply the Consent Resolve About + keywords
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from yt_api import token, api

DESC = ("Consent Resolve helps home-service contractors turn the ~98% of website visitors "
        "who leave without calling into exclusive, consent-first leads — $7, never resold. "
        "We break down how anonymous visitor identification works, what's actually legal "
        "(TCPA / CIPA / GDPR), why shared leads from Angi & aggregators quietly drain your "
        "budget, and the real math of cost-per-booked-job. Plain-English explainers for HVAC, "
        "roofing, plumbing, electrical & remodeling owners. New videos weekly.\n\n"
        "👉 See it on your own site: https://consentresolve.com/demo")
KEYWORDS = ('"contractor leads" "home service marketing" "exclusive leads" "Angi alternative" '
            '"anonymous website visitors" "website visitor identification" "HVAC leads" '
            '"roofing leads" "plumbing leads" "TCPA compliance" "consent based marketing" '
            '"cost per lead" "lead generation for contractors"')

tok = token()
me = api("GET", "/channels", tok, {"part": "id,brandingSettings", "mine": "true"})
ch = me["items"][0]; cid = ch["id"]; bs = ch.get("brandingSettings", {})
if len(sys.argv) > 1 and sys.argv[1] == "apply":
    bs.setdefault("channel", {})
    bs["channel"]["description"] = DESC
    bs["channel"]["keywords"] = KEYWORDS
    api("PUT", "/channels", tok, {"part": "brandingSettings"}, {"id": cid, "brandingSettings": bs})
    print("applied About + keywords to channel", cid)
else:
    print("channel", cid)
    print("current description:", (bs.get("channel", {}).get("description", "") or "(none)")[:200])
