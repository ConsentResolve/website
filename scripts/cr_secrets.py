"""Shared secret loader for Consent Resolve local scripts.

Resolves a named secret in priority order so nothing breaks during migration:
  1. Environment variable (e.g. HEYGEN_KEY)
  2. macOS Keychain — `security find-generic-password -s cr-<name> -a cr -w`  (the durable store)
  3. Legacy fallbacks (/tmp/<name>.txt, ~/.config/<name>/key) — so pre-existing drops still work

Set every key ONCE with:  python3 scripts/setup_secrets.py
(or per key:  security add-generic-password -U -s cr-<name> -a cr -w "<value>")

Nothing here prints or logs a secret value.

Usage:
    from cr_secrets import secret, secret_json
    key = secret("heygen")            # -> str
    r2  = secret_json("r2")           # -> dict
"""
import json
import os
import subprocess
from pathlib import Path

# name -> (env var, keychain service, [legacy file paths])
SPEC = {
    "heygen":       ("HEYGEN_KEY",          "cr-heygen",       ["/tmp/heygen_key.txt"]),
    "r2":           ("R2_JSON",             "cr-r2",           ["/tmp/r2.json"]),            # JSON blob
    "instantly":    ("INSTANTLY_API_KEY",   "cr-instantly",    ["/tmp/instantly_key.txt"]),
    "recraft":      ("RECRAFT_KEY",         "cr-recraft",      ["~/.config/recraft/key"]),
    "apollo":       ("APOLLO_API_KEY",      "cr-apollo",       ["/tmp/apollo_key.txt"]),
    "feedback":     ("FEEDBACK_KEY",        "cr-feedback",     ["/tmp/feedback_key.txt"]),
    "meta_token":   ("META_ACCESS_TOKEN",   "cr-meta-token",   ["/tmp/meta_token.txt"]),
    "meta_account": ("META_AD_ACCOUNT_ID",  "cr-meta-account", ["/tmp/meta_ad_account.txt"]),
    "meta_page":    ("META_PAGE_ID",        "cr-meta-page",    ["/tmp/meta_page_id.txt"]),
    "elevenlabs":   ("ELEVENLABS_API_KEY",  "cr-elevenlabs",   ["/tmp/elevenlabs_key.txt"]),
}


def _keychain(service):
    try:
        r = subprocess.run(
            ["security", "find-generic-password", "-s", service, "-a", "cr", "-w"],
            capture_output=True, text=True,
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass
    return None


def secret(name, required=True):
    env, service, legacy = SPEC.get(name, (name.upper(), "cr-" + name, []))
    v = os.environ.get(env)
    if v:
        return v.strip()
    v = _keychain(service)
    if v:
        return v.strip()
    for p in legacy:
        fp = Path(os.path.expanduser(p))
        if fp.exists() and fp.read_text().strip():
            return fp.read_text().strip()
    if required:
        raise SystemExit(
            f"secret '{name}' not found. Set it once:\n"
            f"  security add-generic-password -U -s {service} -a cr -w '<value>'\n"
            f"  (or run: python3 scripts/setup_secrets.py)"
        )
    return None


def secret_json(name, required=True):
    v = secret(name, required)
    return json.loads(v) if v else None
