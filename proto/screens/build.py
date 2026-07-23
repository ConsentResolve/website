#!/usr/bin/env python3
"""Inline tokens.css + inbox.html styles/body + data.js + render.js into a
single self-contained inbox-artifact.html for publishing as one Artifact."""
import re, pathlib

here = pathlib.Path(__file__).parent
tokens = (here / "../styles/tokens.css").read_text()
html = (here / "inbox.html").read_text()
data = (here / "inbox.data.js").read_text()
render = (here / "inbox.render.js").read_text()

# Pull the inner <style>…</style> block from inbox.html
style_m = re.search(r"<style>(.*?)</style>", html, re.S)
styles = style_m.group(1)

# Body = everything after </style> up to the first <script src=…>
after_style = html[style_m.end():]
body = after_style[: after_style.index("<script")].strip()

out = (
    "<title>Consent Resolve CRM — prototype</title>\n"
    "<style>\n"
    "/* ===== tokens (inlined) ===== */\n"
    + tokens.strip() + "\n"
    "/* ===== styles (inlined) ===== */\n"
    + styles.strip() + "\n"
    "</style>\n"
    + body + "\n"
    "<script>\n" + data.strip() + "\n</script>\n"
    "<script>\n" + render.strip() + "\n</script>\n"
)

(here / "inbox-artifact.html").write_text(out)
print("built inbox-artifact.html", len(out), "bytes")
