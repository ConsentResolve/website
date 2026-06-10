#!/usr/bin/env python3
"""Seed the Resource Center social_queue from the live social.json payloads.

Reads /feeds/resources.xml to discover every resource, fetches each resource's
social.json, and POSTs an "enqueue" for all 7 platforms to /api/social-queue.
Idempotent (the API upserts on resource_slug+platform), so safe to re-run.

Usage:
    CR_AUTOMATION_KEY=your-secret python3 scripts/seed-social-queue.py
    # optional: BASE=https://consentresolve.com (default)

This is also the canonical example of what an external automation (Make/Zapier/
n8n) sends: poll the feed -> read social.json -> enqueue.
"""
import json
import os
import re
import sys
import urllib.request

BASE = os.environ.get("BASE", "https://consentresolve.com").rstrip("/")
KEY = os.environ.get("CR_AUTOMATION_KEY")
# Queue platform keys. LinkedIn fans into two independent streams (company page
# + personal profile) that share the same source payload but track cadence /
# publish state separately. SOURCE_KEY maps a queue platform -> social.json key.
PLATFORMS = ["linkedin_company", "linkedin_personal", "facebook", "x", "threads",
             "pinterest", "google_business_profile", "email"]
SOURCE_KEY = {"linkedin_company": "linkedin", "linkedin_personal": "linkedin"}

if not KEY:
    sys.exit("Set CR_AUTOMATION_KEY (the Cloudflare secret) in the environment.")


# Cloudflare's bot rules 403 the default "Python-urllib" UA, so send a normal one.
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ConsentResolve-Seed/1.0"


def get(url):
    req = urllib.request.Request(url)
    req.add_header("User-Agent", UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8")


def post(url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-CR-Automation-Key", KEY)
    req.add_header("User-Agent", UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.read().decode("utf-8")


def main():
    xml = get(f"{BASE}/feeds/resources.xml")
    links = re.findall(r"<link>(https?://[^<]+/resources/[^<]+/)</link>", xml)
    if not links:
        sys.exit("No resource links found in /feeds/resources.xml")

    total = 0
    for link in links:
        social_url = link.rstrip("/") + "/social.json"
        try:
            sj = json.loads(get(social_url))
        except Exception as e:  # noqa: BLE001
            print(f"skip {social_url}: {e}")
            continue
        items = [{"platform": p, "payload": sj["social"].get(SOURCE_KEY.get(p, p))}
                 for p in PLATFORMS if sj["social"].get(SOURCE_KEY.get(p, p))]
        body = {
            "action": "enqueue",
            "resource_slug": sj["resource"]["slug"],
            "resource_type": sj["resource"]["resource_type"],
            "items": items,
        }
        status, resp = post(f"{BASE}/api/social-queue", body)
        print(f"{status}  {sj['resource']['slug']}  -> {resp}")
        total += len(items)

    print(f"\nDone. Enqueued/updated {total} platform rows across {len(links)} resources.")


if __name__ == "__main__":
    main()
