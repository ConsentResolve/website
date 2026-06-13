#!/usr/bin/env python3
"""Deployed preview of the WRITTEN social posts (FB / LinkedIn / Instagram / X),
in platform-styled mockups. Mirrors the video calendar.html, for the text track.

Copy is pulled live from scripts/seed-voc-ads.py's ADS bank (AST-parsed, so the
preview never drifts from what actually posts). X uses the same 150-char cut the
seeder sends. Output: public/posts.html (noindex), served at /posts.html.
"""
import ast, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def load_ads():
    src = (ROOT / "scripts/seed-voc-ads.py").read_text()
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "ADS" for t in node.targets):
            return ast.literal_eval(node.value)
    raise SystemExit("ADS not found in seed-voc-ads.py")

def short(s, n=150):  # mirrors seed-voc-ads.short()
    if len(s) <= n: return s
    cut = s[:n]
    for sep in (". ", " — ", ", "):
        i = cut.rfind(sep)
        if i > 60: return cut[:i + 1].strip()
    return cut.rsplit(" ", 1)[0].strip()

ADS = load_ads()
HEADLINE = "See a visitor turn into a real, named lead."
DOMAIN = "consentresolve.com"

def esc(s): return html.escape(s)

def fb(slug, cap):
    return f"""<div class="post fb" data-p="fb">
  <div class="hd"><img class="av" src="/favicon.png"><div><div class="nm">Consent Resolve</div><div class="sub">Sponsored · 🌐</div></div></div>
  <div class="body">{esc(cap)}</div>
  <div class="linkcard"><img src="/og-default.png"><div class="lk"><div class="dom">{DOMAIN.upper()}</div><div class="ttl">{esc(HEADLINE)}</div><div class="btn">Learn More</div></div></div>
  <div class="bar"><span>👍 Like</span><span>💬 Comment</span><span>↪ Share</span></div></div>"""

def li(slug, cap):
    return f"""<div class="post li" data-p="li">
  <div class="hd"><img class="av" src="/favicon.png"><div><div class="nm">Consent Resolve</div><div class="sub">1,240 followers · Promoted</div></div></div>
  <div class="body">{esc(cap)}</div>
  <div class="linkcard li"><img src="/og-default.png"><div class="lk"><div class="ttl">{esc(HEADLINE)}</div><div class="dom">{DOMAIN}</div></div></div>
  <div class="bar"><span>👍 Like</span><span>💬 Comment</span><span>🔁 Repost</span><span>➤ Send</span></div></div>"""

def ig(slug, cap):
    return f"""<div class="post ig" data-p="ig">
  <div class="hd"><img class="av" src="/favicon.png"><div><div class="nm">consentresolve</div><div class="sub">Sponsored</div></div></div>
  <div class="igimg"><img src="/og-default.png"></div>
  <div class="cta">Learn More ›</div>
  <div class="igacts"><span>♡</span><span>💬</span><span>➤</span><span class="bk">🔖</span></div>
  <div class="body"><b>consentresolve</b> {esc(cap)}</div></div>"""

def x(slug, cap):
    return f"""<div class="post x" data-p="x">
  <div class="hd"><img class="av" src="/favicon.png"><div><div class="nm">Consent Resolve <span class="vf">✔</span></div><div class="sub">@consentresolve</div></div></div>
  <div class="body">{esc(short(cap))}</div>
  <div class="linkcard x"><img src="/og-default.png"><div class="lk"><div class="dom">{DOMAIN}</div><div class="ttl">{esc(HEADLINE)}</div></div></div>
  <div class="bar"><span>💬 18</span><span>🔁 7</span><span>♡ 64</span><span>📊 2.1K</span></div></div>"""

rows = []
for slug, cap in ADS:
    rows.append(f'<div class="adrow"><div class="ang">{esc(slug)}</div><div class="cards">'
                + fb(slug, cap) + li(slug, cap) + ig(slug, cap) + x(slug, cap) + "</div></div>")

CSS = """
*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:28px 24px 6px;text-align:center}header h1{margin:0;font-size:26px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
.filters{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:16px}
.f{background:#0d1b2a;color:#f5f8fa;border:1px solid #1e293b;border-radius:999px;padding:7px 14px;font-size:13px;cursor:pointer}
.f.active{background:#00e5a0;color:#0a1628;border-color:#00e5a0;font-weight:700}
.adrow{max-width:1400px;margin:0 auto;padding:10px 24px 30px;border-bottom:1px solid #16233a}
.ang{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin:14px 0 12px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.post{background:#fff;color:#0f1419;border-radius:14px;overflow:hidden;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.35);align-self:start}
.post .hd{display:flex;gap:10px;align-items:center;padding:12px 14px}
.post .av{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#0a1628}
.post .nm{font-weight:700;font-size:14px;line-height:1.1}.post .sub{color:#65707a;font-size:12px;margin-top:2px}
.post .vf{color:#1d9bf0;font-size:12px}
.post .body{padding:0 14px 12px;line-height:1.5;white-space:pre-wrap}
.linkcard{border-top:1px solid #e6ecf0;display:flex;flex-direction:column}
.linkcard img{width:100%;height:170px;object-fit:cover;background:#0a1628}
.linkcard .lk{padding:10px 14px;background:#f7f9fa}
.linkcard .dom{font-size:11px;color:#65707a;text-transform:uppercase;letter-spacing:.04em}
.linkcard .ttl{font-weight:700;font-size:14px;margin-top:3px}
.linkcard .btn{margin-top:8px;display:inline-block;background:#e4e6eb;color:#0f1419;font-weight:700;font-size:13px;padding:7px 14px;border-radius:7px}
.linkcard.x,.linkcard.li{border:1px solid #e6ecf0;border-radius:12px;margin:0 14px 12px}
.linkcard.x img,.linkcard.li img{height:150px;border-radius:12px 12px 0 0}
.post .bar{display:flex;justify-content:space-between;padding:10px 16px;border-top:1px solid #eef2f5;color:#536471;font-size:13px}
.igimg img{width:100%;aspect-ratio:1/1;object-fit:cover;background:#0a1628;display:block}
.igacts{display:flex;gap:16px;padding:10px 14px 4px;font-size:20px}.igacts .bk{margin-left:auto}
.post.ig .cta{background:#0095f6;color:#fff;text-align:center;font-weight:600;padding:9px;font-size:13px}
.note{color:#94a3b8;font-size:12px;text-align:center;padding:0 24px 20px;max-width:900px;margin:0 auto}
"""
JS = """
const fs=document.querySelectorAll('.f');fs.forEach(b=>b.onclick=()=>{
 fs.forEach(x=>x.classList.remove('active'));b.classList.add('active');const f=b.dataset.f;
 document.querySelectorAll('.post').forEach(p=>{p.style.display=(f==='all'||p.dataset.p===f)?'':'none'});
 document.querySelectorAll('.adrow').forEach(r=>{r.style.display=[...r.querySelectorAll('.post')].some(p=>p.style.display!=='none')?'':'none'});
});
"""
HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — Social Post Preview</title>
<style>{CSS}</style></head><body>
<header><h1>Consent Resolve — Written Post Preview</h1>
<p>{len(ADS)} VoC ad posts · Facebook, LinkedIn, Instagram, X · copy pulled live from the seeder</p></header>
<div class="filters"><button class="f active" data-f="all">All</button><button class="f" data-f="fb">Facebook</button><button class="f" data-f="li">LinkedIn</button><button class="f" data-f="ig">Instagram</button><button class="f" data-f="x">X</button></div>
<p class="note">Mockups for layout/copy review. FB, LinkedIn &amp; X run as written link-posts; Instagram feed posts are shown for completeness (IG currently runs Reels, not feed text posts).</p>
{''.join(rows)}
<script>{JS}</script></body></html>"""

out = ROOT / "public/posts.html"
out.write_text(HTML)
print(f"wrote {out} — {len(ADS)} ads × 4 platforms = {len(ADS)*4} mockups")
