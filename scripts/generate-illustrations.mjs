/**
 * Generate the 9 Consent Resolve illustrations using OpenAI's Images API.
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   node scripts/generate-illustrations.mjs
 *
 * Optional flags:
 *   --only=01,03            Generate only specific indices (comma-separated)
 *   --model=gpt-image-1     Override model (default: gpt-image-1)
 *   --size=1024x1024        Image size (default: 1024x1024)
 *   --dry-run               Print prompts without calling the API
 *
 * Output: PNGs written to public/illustrations/style/{NN}-{slug}.png
 * (Trace these to SVG via Illustrator Image Trace, vectorizer.ai, or Recraft
 *  for crisp scaling and to overwrite the placeholder .svg files.)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "public", "illustrations", "style");

// === STYLE LOCK — Block A. Paste verbatim, never modify. ===
const STYLE_LOCK = `Minimalist hand-drawn vector illustration of a single subject, centered with
generous negative space, on a fully transparent background (NOT black, NOT a
colored fill). Hand-inked marker style: thick, slightly rough, organic outlines
of even medium-heavy weight in deep navy (#0A1628), with the occasional doubled
"ghost" outline stroke for a sketched feel. Flat color fills from a strict
four-value palette only — primary brand mint/cyan (#00E5A0), card navy
(#1E293B), and almost-white (#F8FAFC) reserved for inner highlights and small
curved "shine" strokes. Each major shape casts ONE flat, hard-edged offset
drop shadow (no blur, no gradient) in the card navy (#1E293B), offset slightly
down and to the right. Rounded, friendly, organic forms with soft corners.
Completely flat shading: no gradients, no directional lighting, no texture,
no 3D. Straight-on 2D perspective. Square 1:1 composition. Modern, confident,
trustworthy tone.

Negative: no black or colored background, no photorealism, no gradients, no
ambient occlusion, no neon, no colors outside the four-color palette above,
no lettering or numbers, no eyes / surveillance-camera / spying imagery.`;

// === SUBJECT LIBRARY — Block B ===
const SUBJECTS = [
  {
    n: "01",
    slug: "contact-card",
    caption: "Real names, real numbers",
    subject:
      "a contact card showing a person icon above a phone handset, arranged center-frame.",
  },
  {
    n: "02",
    slug: "map-pin",
    caption: "Mapped to your zip",
    subject:
      "a single map pin dropping onto a small neighborhood grid, arranged center-frame.",
  },
  {
    n: "03",
    slug: "speech-wrench",
    caption: "Why they're shopping",
    subject:
      "a speech bubble containing a wrench, arranged center-frame.",
  },
  {
    n: "04",
    slug: "phone-alert",
    caption: "On your phone in five",
    subject:
      "a phone handset with three short motion lines and a small upward arrow, arranged center-frame.",
  },
  {
    n: "05",
    slug: "crm-inbox",
    caption: "Lands in your CRM",
    subject:
      "a card sliding on an arrow into an open labeled inbox tray, arranged center-frame.",
  },
  {
    n: "06",
    slug: "bell-return",
    caption: "Return-visit alerts",
    subject:
      "a notification bell with a small circular return-arrow loop around it, arranged center-frame.",
  },
  {
    n: "07",
    slug: "lead-house-lock",
    caption: "Yours alone, never resold",
    subject:
      "one lead card linked by a single line to ONE house, sealed with a small padlock, arranged center-frame.",
  },
  {
    n: "08",
    slug: "shield-doc",
    caption: "Audit-ready by default",
    subject:
      "a rounded shield bearing a checkmark, overlapping a document with a wax-style seal in the corner, arranged center-frame.",
  },
  {
    n: "09",
    slug: "code-clock",
    caption: "Set up in ten minutes",
    subject:
      "a code-tag </> bracket shape next to a small clock, arranged center-frame.",
  },
];

function parseFlags() {
  const args = process.argv.slice(2);
  const flags = {};
  for (const a of args) {
    const [k, v] = a.replace(/^--/, "").split("=");
    flags[k] = v ?? true;
  }
  return flags;
}

async function ensureDir(d) {
  await fs.mkdir(d, { recursive: true });
}

async function generateOne(item, flags) {
  const prompt = `${STYLE_LOCK}\n\nSubject: ${item.subject}`;
  if (flags["dry-run"]) {
    console.log(`\n=== ${item.n} ${item.slug} (${item.caption}) ===`);
    console.log(prompt);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY env var.");
    process.exit(1);
  }
  const model = flags.model ?? "gpt-image-1";
  const size = flags.size ?? "1024x1024";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      n: 1,
      background: "transparent",
      output_format: "png",
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error for ${item.slug}: ${res.status} ${txt}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image data returned for ${item.slug}`);

  const outFile = path.join(OUT_DIR, `${item.n}-${item.slug}.png`);
  await fs.writeFile(outFile, Buffer.from(b64, "base64"));
  console.log(`✓ ${item.n}-${item.slug}.png (${(Buffer.from(b64, "base64").length / 1024).toFixed(1)} KB)`);
}

async function main() {
  const flags = parseFlags();
  await ensureDir(OUT_DIR);

  let items = SUBJECTS;
  if (flags.only) {
    const set = new Set(String(flags.only).split(","));
    items = SUBJECTS.filter((s) => set.has(s.n));
  }

  console.log(`Generating ${items.length} illustration${items.length === 1 ? "" : "s"}…`);
  for (const item of items) {
    try {
      await generateOne(item, flags);
    } catch (err) {
      console.error(err);
    }
  }
  console.log("\nDone. Trace PNGs to SVG (recommended) and overwrite the placeholder .svg files.");
}

main();
