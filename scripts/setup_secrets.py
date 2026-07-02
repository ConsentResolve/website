#!/usr/bin/env python3
"""One-time (and re-runnable) secrets setup → macOS Keychain.

    python3 scripts/setup_secrets.py            # interactive: prompts for each key
    python3 scripts/setup_secrets.py --status   # show which keys are set (no values)

Each key is stored encrypted in your login Keychain (service `cr-<name>`, account `cr`).
Values are read with getpass (not echoed) and passed straight to `security` — never printed,
logged, or written to disk. Leave a prompt blank to skip/keep the existing value.
After this, every local script resolves keys via cr_secrets.py — no more /tmp drops.
"""
import getpass
import subprocess
import sys

from cr_secrets import SPEC, _keychain

# Friendly prompt + hint per secret.
HINTS = {
    "heygen":       "HeyGen API key (console.heygen.com -> API Keys)",
    "r2":           "Cloudflare R2 — enter the 5 fields when prompted",
    "instantly":    "Instantly API key",
    "recraft":      "Recraft API key",
    "apollo":       "Apollo API key",
    "feedback":     "FEEDBACK_KEY (gates CRM diagnostic endpoints)",
    "meta_token":   "Meta System-User access token",
    "meta_account": "Meta ad account id (act_XXXXXXXX)",
    "meta_page":    "Facebook Page id",
    "elevenlabs":   "ElevenLabs API key (optional)",
}


def store(service, value):
    subprocess.run(
        ["security", "add-generic-password", "-U", "-s", service, "-a", "cr", "-w", value],
        check=True, capture_output=True,
    )


def status():
    print("Secret status (Keychain / env / legacy):")
    for name, (_env, service, _legacy) in SPEC.items():
        print(f"  {name:14s} {'SET   ' if _keychain(service) else 'unset '} (service {service})")


def main():
    if "--status" in sys.argv:
        status(); return
    print("Consent Resolve secrets → macOS Keychain. Blank = skip.\n")
    for name, (_env, service, _legacy) in SPEC.items():
        hint = HINTS.get(name, name)
        already = " [already set]" if _keychain(service) else ""
        if name == "r2":
            print(f"\n{name} — {hint}{already}")
            acc = getpass.getpass("  account_id (blank=skip R2): ").strip()
            if not acc:
                continue
            r2 = {
                "account_id": acc,
                "access_key": getpass.getpass("  access_key: ").strip(),
                "secret_key": getpass.getpass("  secret_key: ").strip(),
                "bucket":     getpass.getpass("  bucket: ").strip(),
                "public_base": getpass.getpass("  public_base [https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev]: ").strip()
                               or "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev",
            }
            import json
            store(service, json.dumps(r2))
            print("  stored r2 ✓")
        else:
            val = getpass.getpass(f"{name} — {hint}{already}: ").strip()
            if not val:
                continue
            store(service, val)
            print(f"  stored {name} ✓")
    print("\nDone. Verify with: python3 scripts/setup_secrets.py --status")


if __name__ == "__main__":
    main()
