#!/usr/bin/env python3
"""Generate a long-form YouTube SCRIPT + SEO/AEO metadata from a Consent Resolve
resource article. Hybrid format: AA-Ron avatar intro/outro + slide-narrated body.
Output: social/longform/<slug>.json (+ a readable summary). NO rendering — review the
script, title, and chapters first, then we render + upload.

  python3 scripts/yt_longform_script.py <resource_url>
Needs OPENAI_API_KEY (OPENAI_MODEL overrides the default model).
"""
import os, sys, re, json, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
KEY = os.environ["OPENAI_API_KEY"]
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36"

def fetch_text(url):
    html = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read().decode("utf-8", "ignore")
    html = re.sub(r"(?is)<(script|style|nav|header|footer|svg)[^>]*>.*?</\1>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()[:9000]

SYS = ("You are the content lead for Consent Resolve, a B2B SaaS that helps home-service "
       "contractors (HVAC, roofing, plumbing, electrical, remodeling) turn anonymous website "
       "visitors into EXCLUSIVE, consent-first $7 leads that are never resold. Voice: plain-spoken, "
       "credible, lightly dry-witted, NO hype, NO fabricated customer testimonials (team voice / "
       "data only), compliance-aware (TCPA/CIPA/GDPR). Audience: busy contractor owners.")

PROMPT = """From the SOURCE ARTICLE below, write a long-form YouTube video package optimized for search + answer-engine (AEO) discovery.

Return STRICT JSON with these keys:
- title: question-style, <=90 chars, the way a contractor would actually search
- description: 250-450 words; keyword-rich first two lines; plain English; end with exactly "\\n\\n👉 See it on your own site: https://consentresolve.com/demo?utm_source=youtube&utm_medium=video&utm_campaign=longform"
- tags: array of 12-15 search tags
- playlist: one of ["Anonymous Visitor 101","The Lead-Buying Trap","Consent & Compliance","Contractor Growth Math","Consent Resolve How-To"]
- thumbnail_text: <=6 punchy words
- chapters: array of {time_label,title}, starting "00:00 Intro" (time_labels are ESTIMATES; exact ones are recomputed from the rendered audio)
- avatar_intro: 2-3 sentence on-camera hook (spoken by AA-Ron), promises the answer
- body: array of {heading,narration,bullets}; EXACTLY 7-9 slide-narrated sections; each narration MUST be 110-160 words (full spoken paragraph, concrete examples + numbers, conversational); bullets = 2-4 short on-screen phrases (<=6 words each) summarizing that section's narration
- avatar_outro: 2-3 sentence on-camera close with the consentresolve.com/demo CTA
IMPORTANT: total spoken words across intro+body+outro MUST be 1200-1700 (~8-11 min). Write real, full narration paragraphs — depth and specifics, not outlines.

SOURCE ARTICLE:
"""

def generate(text):
    body = {"model": MODEL, "temperature": 0.6, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": SYS}, {"role": "user", "content": PROMPT + text}]}
    req = urllib.request.Request("https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        sys.exit(f"OpenAI HTTP {e.code}: {e.read().decode()[:400]}")
    return json.loads(r["choices"][0]["message"]["content"])

def main():
    url = sys.argv[1]
    slug = url.rstrip("/").split("/")[-1]
    pkg = generate(fetch_text(url))
    pkg["source_url"] = url; pkg["slug"] = slug
    out = ROOT / "social/longform"; out.mkdir(parents=True, exist_ok=True)
    (out / f"{slug}.json").write_text(json.dumps(pkg, indent=2))
    spoken = " ".join([pkg.get("avatar_intro", "")] + [s.get("narration", "") for s in pkg.get("body", [])] + [pkg.get("avatar_outro", "")])
    words = len(spoken.split())
    print(f"\n=== {pkg.get('title')} ===")
    print(f"playlist: {pkg.get('playlist')}  |  ~{words} words (~{words/150:.1f} min spoken)  |  thumb: {pkg.get('thumbnail_text')}")
    print(f"\nCHAPTERS:"); [print("  ", c.get("time_label"), c.get("title")) for c in pkg.get("chapters", [])]
    print(f"\nINTRO (avatar): {pkg.get('avatar_intro')}")
    print(f"\nBODY sections:"); [print(f"  • {s.get('heading')}") for s in pkg.get("body", [])]
    print(f"\nOUTRO (avatar): {pkg.get('avatar_outro')}")
    print(f"\nwrote social/longform/{slug}.json")

if __name__ == "__main__":
    main()
