/*! Consent Resolve — demo booking widget (self-contained, no framework). DARK theme.
    Mount: <div data-cr-booking data-api="https://consentresolve.com"></div> + this script.
    All Cal.com calls go through the Worker (/api/booking/*); the API key never reaches here.
    Scoped with the crbw- prefix + explicit input/button resets so it can't clash with a host page.

    Flow (conversion-tuned): 1 Trade → 2 Lead source (dropdown) → 3 Time → 4 Email (mobile optional)
    → booked. The commitment funnel ends at step 4; once the slot is held we ask for the rest
    (name/company/website) on a post-booking screen that's fully skippable. */
(function () {
  "use strict";
  if (window.__crbwLoaded) return; window.__crbwLoaded = true;

  // ---- On-brand icon set (Tabler paths, stroke 1.75, currentColor) --------
  var PATHS = {
    home: '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>',
    temp: '<path d="M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5"/><path d="M10 9l4 0"/>',
    droplet: '<path d="M7.5 19.4a6 6 0 0 0 9 0a6 6 0 0 0 1.57 -8.55l-4.89 -7.26a1.4 1.4 0 0 0 -2.35 0l-4.9 7.26a6 6 0 0 0 1.57 8.55z"/>',
    bolt: '<path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/>',
    bug: '<path d="M9 9v-1a3 3 0 0 1 6 0v1"/><path d="M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1 -10 0v-3a6 6 0 0 1 1 -3"/><path d="M3 13l4 0"/><path d="M17 13l4 0"/><path d="M12 20l0 -6"/><path d="M4 19l3.35 -2"/><path d="M20 19l-3.35 -2"/><path d="M4 7l3.75 2.4"/><path d="M20 7l-3.75 2.4"/>',
    tool: '<path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5"/>',
    google: '<path d="M17.788 5.108a9 9 0 1 0 3.212 6.892h-8"/>',
    clipboard: '<path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/><path d="M9 12l.01 0"/><path d="M13 12l2 0"/><path d="M9 16l.01 0"/><path d="M13 16l2 0"/>',
    facebook: '<path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3"/>',
    users: '<path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"/>',
    shuffle: '<path d="M18 4l3 3l-3 3"/><path d="M18 20l3 -3l-3 -3"/><path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5"/><path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3"/>',
    search: '<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>',
    chevron: '<path d="M9 6l6 6l-6 6"/>',
    chevronDown: '<path d="M6 9l6 6l6 -6"/>',
    left: '<path d="M15 6l-6 6l6 6"/>',
    check: '<path d="M5 12l5 5l10 -10"/>',
    circleCheck: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 12l2 2l4 -4"/>',
    arrow: '<path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/>',
    phone: '<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"/>',
    clock: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 7v5l3 3"/>',
    shield: '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/><path d="M9 12l2 2l4 -4"/>',
  };
  var ICON_SCALE = 1.25; // icons 25% larger across the widget
  function ic(name, size, stroke) {
    var s = Math.round((size || 24) * ICON_SCALE);
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="' + (stroke || 1.75) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || "") + "</svg>";
  }

  var TRADES = [
    { id: "roofing", label: "Roofing", icon: "home" },
    { id: "hvac", label: "HVAC", icon: "temp" },
    { id: "plumbing", label: "Plumbing", icon: "droplet" },
    { id: "electrical", label: "Electrical", icon: "bolt" },
    { id: "pest", label: "Pest control", icon: "bug" },
    { id: "other", label: "Other trade", icon: "tool" },
  ];
  // Extended trades shown when they tap "Other trade" — searchable, tap to pick.
  var OTHER_TRADES = [
    "Painting", "Landscaping & lawn", "Remodeling / GC", "Flooring", "Concrete & masonry",
    "Fencing", "Garage doors", "Windows & doors", "Gutters", "Solar", "Pool service",
    "Cleaning / janitorial", "Appliance repair", "Handyman", "Tree service", "Septic",
    "Water treatment", "Drywall", "Siding", "Decks & patios", "Foundation repair",
    "Chimney & fireplace", "Locksmith", "Pressure washing", "Insulation", "Excavation & grading",
  ];
  // Step 2 — single question, single tap. The channel they name is the CPL we compare to $7.
  var SOURCES = [
    { id: "Google ads", label: "Google ads", sub: "Search or Local Services", icon: "google" },
    { id: "Lead sites", label: "Lead sites", sub: "Angi, Thumbtack, HomeAdvisor", icon: "clipboard" },
    { id: "Facebook / Instagram", label: "Facebook / Instagram", sub: "Meta ads or posts", icon: "facebook" },
    { id: "Referrals & repeat", label: "Referrals & repeat", sub: "Word of mouth, past customers", icon: "users" },
    { id: "A mix / not sure", label: "A mix / not sure", sub: "A little of everything", icon: "shuffle" },
  ];
  var TIME_LEFT = ["about 40 seconds", "about 30 seconds", "about 20 seconds", "about 10 seconds"];
  var PHONE = "(727) 999-9846";
  var SLOT_CAP = 6; // times shown before the "show all" expander

  var CSS = [
    // Dark theme — elevated navy panel on the navy hero.
    ".crbw{--mint:#00e5a0;--mint-700:#00c489;--navy:#0a1628;--ink:#f8fafc;--ink-2:#cbd5e1;--muted:#94a3b8;--line:rgba(255,255,255,.10);--line-2:rgba(255,255,255,.20);--bg:#0f1f33;--surface:#16273c;--surface-hi:#1d3149;--soft:#16273c;--brand-soft:rgba(0,229,160,.13);--brand-soft-2:rgba(0,229,160,.20);--good:#22c9a0;--warn:#e0a44a;--font:'Hanken Grotesk',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--font-disp:'Bricolage Grotesque',var(--font);font-family:var(--font);color:var(--ink);background:var(--bg);border-radius:16px;overflow:hidden;box-sizing:border-box;-webkit-text-size-adjust:100%;text-align:left}",
    ".crbw *,.crbw *::before,.crbw *::after{box-sizing:border-box}",
    ".crbw button{font:inherit;cursor:pointer;margin:0;border:0;background:none;color:inherit}",
    ".crbw svg{display:block;flex:0 0 auto}",
    ".crbw input{font:inherit;margin:0;width:100%;color:var(--ink);background:var(--surface)}",
    ".crbw-prog{padding:15px 18px 0}",
    ".crbw-prog-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px}",
    ".crbw-prog-row .t{display:inline-flex;align-items:center;gap:4px}",
    ".crbw-prog-bar{height:6px;border-radius:6px;background:var(--soft);overflow:hidden}",
    ".crbw-prog-bar i{display:block;height:100%;border-radius:6px;background:var(--mint);transition:width .35s cubic-bezier(.22,.61,.36,1)}",
    ".crbw-body{padding:18px 18px 20px}",
    ".crbw-h{font-family:var(--font-disp);font-size:21px;font-weight:800;line-height:1.15;margin:2px 0 4px;letter-spacing:-.015em;color:var(--ink)}",
    ".crbw-sub{font-size:13.5px;color:var(--ink-2);line-height:1.5;margin:0 0 16px}",
    ".crbw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}",
    "@media (max-width:520px){.crbw-grid{grid-template-columns:repeat(2,1fr)}}",
    ".crbw-card{min-height:84px;border:1.5px solid var(--line);border-radius:12px;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px 6px;font-size:13.5px;font-weight:700;color:var(--ink);transition:border-color .14s,background .14s,box-shadow .14s,transform .1s}",
    ".crbw-card:hover{border-color:var(--mint);background:var(--surface-hi)}",
    ".crbw-card:active{transform:scale(.97)}",
    ".crbw-card .ic{color:var(--mint)}",
    ".crbw-card.on{border-color:var(--mint);background:var(--brand-soft-2);box-shadow:0 0 0 3px var(--brand-soft)}",
    // Stylized dropdown (step 2) — compact trigger + inline menu (no clipping)
    ".crbw-dd{position:relative}",
    ".crbw-ddtrigger{width:100%;min-height:58px;display:flex;align-items:center;gap:13px;padding:0 14px;border:1.5px solid var(--line);border-radius:12px;background:var(--surface);text-align:left;transition:border-color .14s,background .14s}",
    ".crbw-ddtrigger:hover{border-color:var(--line-2)}",
    ".crbw-ddtrigger[aria-expanded='true']{border-color:var(--mint);box-shadow:0 0 0 3px var(--brand-soft)}",
    ".crbw-ddtrigger .ric{width:38px;height:38px;border-radius:10px;background:var(--brand-soft);color:var(--mint);display:flex;align-items:center;justify-content:center}",
    ".crbw-ddtrigger .ddlab{font-size:15px;font-weight:800;color:var(--ink)}",
    ".crbw-ddtrigger .ddph{font-size:15px;font-weight:700;color:var(--muted)}",
    ".crbw-ddtrigger .ddchev{margin-left:auto;color:var(--muted);transition:transform .2s}",
    ".crbw-ddtrigger[aria-expanded='true'] .ddchev{transform:rotate(180deg);color:var(--mint)}",
    ".crbw-ddmenu{margin-top:9px;border:1.5px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface);animation:crbwFade .16s ease-out}",
    ".crbw-ddopt{display:flex;align-items:center;gap:13px;width:100%;min-height:58px;padding:10px 14px;text-align:left;border-bottom:1px solid var(--line);transition:background .12s}",
    ".crbw-ddopt:last-child{border-bottom:0}",
    ".crbw-ddopt:hover{background:var(--surface-hi)}",
    ".crbw-ddopt .ric{width:38px;height:38px;border-radius:10px;background:var(--brand-soft);color:var(--mint);display:flex;align-items:center;justify-content:center}",
    ".crbw-ddopt .rt{display:flex;flex-direction:column;gap:1px;min-width:0}",
    ".crbw-ddopt .rl{font-size:15px;font-weight:800;color:var(--ink);line-height:1.2}",
    ".crbw-ddopt .rs{font-size:12px;font-weight:600;color:var(--muted);line-height:1.3}",
    "@keyframes crbwFade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}",
    // "Other trade" search picker
    ".crbw-tsearchwrap{position:relative;margin-bottom:10px}",
    ".crbw-tsearchwrap svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--muted)}",
    ".crbw-tsearch{height:50px;padding:0 13px 0 44px;border:1.5px solid var(--line);border-radius:11px;background:var(--surface);font-size:15px;outline:none;transition:border-color .14s,box-shadow .14s}",
    ".crbw-tsearch:focus{border-color:var(--mint);box-shadow:0 0 0 3px var(--brand-soft)}",
    ".crbw-tlist{display:flex;flex-direction:column;gap:7px;max-height:248px;overflow-y:auto;padding:2px 2px 2px 0;-webkit-overflow-scrolling:touch}",
    ".crbw-topt{display:flex;align-items:center;gap:11px;width:100%;min-height:50px;padding:8px 13px;border:1.5px solid var(--line);border-radius:11px;background:var(--surface);text-align:left;font-size:14.5px;font-weight:700;color:var(--ink);transition:border-color .12s,background .12s}",
    ".crbw-topt:hover{border-color:var(--mint);background:var(--surface-hi)}",
    ".crbw-topt .tc{margin-left:auto;color:var(--line-2)}",
    ".crbw-topt:hover .tc{color:var(--mint)}",
    ".crbw-tnone{font-size:13.5px;color:var(--muted);text-align:center;padding:14px 0}",
    // Time step
    ".crbw-list{display:flex;flex-direction:column;gap:9px}",
    ".crbw-days{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:2px 0 2px}",
    ".crbw-day{border:1.5px solid var(--line);border-radius:12px;background:var(--surface);padding:11px 6px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:border-color .14s,background .14s}",
    ".crbw-day:hover{border-color:var(--line-2)}",
    ".crbw-day.on{border-color:var(--mint);background:var(--brand-soft-2);box-shadow:0 0 0 3px var(--brand-soft)}",
    ".crbw-day .dw{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}",
    ".crbw-day .dd{font-size:17px;font-weight:800;margin:3px 0 5px;color:var(--ink);line-height:1.05}",
    ".crbw-day .dn{font-size:11px;font-weight:800;color:var(--good)}",
    ".crbw-day .dn.low{color:var(--warn)}",
    ".crbw-timebox{border:1.5px solid rgba(0,229,160,.55);border-radius:12px;padding:13px 13px 14px;margin-top:14px;background:var(--brand-soft)}",
    ".crbw-timehd{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2);margin:0 0 10px}",
    ".crbw-timehd svg{color:var(--mint)}",
    ".crbw-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
    "@media (max-width:520px){.crbw-slots{grid-template-columns:repeat(2,1fr)}}",
    ".crbw-slot{min-height:46px;border:1.5px solid var(--line-2);border-radius:10px;background:var(--surface);font-size:14px;font-weight:700;color:var(--ink);display:flex;align-items:center;justify-content:center;transition:border-color .14s,background .14s,color .14s}",
    ".crbw-slot:hover{border-color:var(--mint);background:var(--surface-hi)}",
    ".crbw-slot.on{border-color:var(--mint);background:var(--mint);color:var(--navy)}",
    ".crbw-showall{width:100%;margin-top:10px;padding:11px;border:1.5px dashed var(--line-2);border-radius:10px;font-size:13px;font-weight:700;color:var(--ink-2);background:none;transition:border-color .14s,color .14s}",
    ".crbw-showall:hover{border-color:var(--mint);color:var(--mint)}",
    // Forms
    ".crbw-f{margin-bottom:13px}",
    ".crbw-f label{display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--ink)}",
    ".crbw-f label i{font-style:normal;font-weight:500;color:var(--muted)}",
    ".crbw-f input{height:48px;padding:0 13px;border:1.5px solid var(--line);border-radius:10px;background:var(--surface);font-size:15px;outline:none;transition:border-color .14s,box-shadow .14s}",
    ".crbw-f input::placeholder{color:var(--muted);opacity:.75}",
    ".crbw-f input:focus{border-color:var(--mint);box-shadow:0 0 0 3px var(--brand-soft)}",
    ".crbw-f input.bad{border-color:#ff6b85;box-shadow:0 0 0 3px rgba(255,107,133,.18)}",
    ".crbw-err{font-size:12px;font-weight:600;color:#ff8ba3;margin-top:5px}",
    ".crbw-pill{display:inline-flex;align-items:center;gap:7px;background:var(--brand-soft);border:1px solid rgba(0,229,160,.32);border-radius:999px;padding:7px 13px;font-size:13px;font-weight:800;color:#7ef0cf;margin-bottom:16px}",
    ".crbw-pill svg{color:var(--mint)}",
    ".crbw-btn{width:100%;min-height:52px;border-radius:12px;background:var(--mint);color:var(--navy);font-size:15.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .14s,transform .1s,opacity .14s}",
    ".crbw-btn:hover{background:var(--mint-700)}",
    ".crbw-btn:active{transform:scale(.99)}",
    ".crbw-btn[disabled]{opacity:.5;cursor:default}",
    ".crbw-ghost{width:100%;min-height:46px;border-radius:12px;background:none;color:var(--ink-2);font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:9px;transition:color .14s}",
    ".crbw-ghost:hover{color:var(--ink)}",
    ".crbw-note{font-size:12px;color:var(--muted);text-align:center;margin-top:12px;line-height:1.5}",
    ".crbw-trust{display:flex;align-items:center;justify-content:center;gap:7px;font-size:11.5px;color:var(--ink-2);text-align:center;margin-top:16px;font-weight:600}",
    ".crbw-trust svg{color:var(--mint)}",
    ".crbw-back{font-size:13px;font-weight:700;color:var(--ink-2);background:none;padding:4px 2px 4px 0;margin-bottom:8px;display:inline-flex;align-items:center;gap:3px}",
    ".crbw-back:hover{color:var(--ink)}",
    ".crbw-warn{background:rgba(224,164,74,.12);border:1px solid rgba(224,164,74,.35);color:#f0c98a;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:600;margin-bottom:12px;line-height:1.45}",
    ".crbw-fallback{text-align:center;padding:14px 6px 6px}",
    ".crbw-fallback a{color:var(--ink);font-weight:800;font-size:19px;text-decoration:none;display:inline-flex;align-items:center;gap:7px}",
    ".crbw-fallback a svg{color:var(--mint)}",
    ".crbw-spin{width:17px;height:17px;border:2.5px solid rgba(10,22,40,.3);border-top-color:var(--navy);border-radius:50%;animation:crbwSpin .7s linear infinite;display:inline-block}",
    "@keyframes crbwSpin{to{transform:rotate(360deg)}}",
    ".crbw-load{padding:40px 0;text-align:center;color:var(--muted);font-size:13px;font-weight:600}",
    ".crbw-load .crbw-spin{width:22px;height:22px;border-color:var(--line);border-top-color:var(--mint);margin:0 auto 10px}",
    // Booked / details / confirm
    ".crbw-booked{display:flex;align-items:center;gap:11px;background:var(--brand-soft);border:1px solid rgba(0,229,160,.28);border-radius:12px;padding:13px 14px;margin-bottom:16px}",
    ".crbw-booked .bc{width:40px;height:40px;border-radius:50%;background:var(--mint);color:var(--navy);display:flex;align-items:center;justify-content:center;flex:0 0 auto}",
    ".crbw-booked .bt{font-size:14px;font-weight:800;color:var(--ink);line-height:1.25}",
    ".crbw-booked .bs{font-size:12.5px;font-weight:700;color:#6ee7c4;line-height:1.3}",
    ".crbw-why{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:2px 0 16px}",
    ".crbw-why li{list-style:none;display:flex;gap:9px;font-size:13px;color:var(--ink-2);line-height:1.45;padding:3px 0}",
    ".crbw-why li b{color:var(--ink)}",
    ".crbw-why li svg{color:var(--mint);margin-top:1px}",
    ".crbw-conf{text-align:center;padding:26px 16px 24px}",
    ".crbw-check{width:62px;height:62px;border-radius:50%;background:var(--brand-soft);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;color:var(--mint)}",
    ".crbw-conf h3{font-family:var(--font-disp);font-size:23px;font-weight:800;margin:0 0 6px;letter-spacing:-.01em;color:var(--ink)}",
    ".crbw-conf p{font-size:14.5px;color:var(--ink-2);margin:0 0 20px}",
    ".crbw-expect{text-align:left;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:14px 15px;margin-top:18px}",
    ".crbw-expect li{list-style:none;display:flex;gap:9px;font-size:13.5px;color:var(--ink);line-height:1.5;padding:5px 0}",
    ".crbw-expect li svg{color:var(--mint);margin-top:2px}",
    "@media (prefers-reduced-motion:reduce){.crbw *{transition:none!important;animation:none!important}}",
  ].join("");

  function injectCss() {
    if (document.getElementById("crbw-css")) return;
    var s = document.createElement("style"); s.id = "crbw-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
  function fmtPhone(v) {
    var d = String(v || "").replace(/\D/g, "").slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return "(" + d.slice(0, 3) + ") " + d.slice(3);
    return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
  }
  function captureUtm() {
    var q = new URLSearchParams(location.search), u = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (k) { var v = q.get(k); if (v) u[k] = v; });
    return u;
  }

  function mount(host) {
    var api = (host.getAttribute("data-api") || location.origin).replace(/\/+$/, "");
    var session = (crypto.randomUUID ? crypto.randomUUID() : "s-" + Math.random().toString(36).slice(2));
    var utm = captureUtm();
    var state = { step: 1, trade: null, tradeLabel: null, otherOpen: false, source: null, ddOpen: false, day: null, slot: null, phone: "", days: null, showAll: false, booking: null, completed: false };

    function track(event, step, meta) {
      try {
        var body = JSON.stringify({ event: event, step: step || "", sessionId: session, meta: meta || null });
        if (event === "abandoned" && navigator.sendBeacon) { navigator.sendBeacon(api + "/api/booking/event", body); return; }
        fetch(api + "/api/booking/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
      } catch (e) {}
    }

    var root = el('<div class="crbw" role="group" aria-label="Book a demo"></div>');
    host.innerHTML = ""; host.appendChild(root);
    track("flow_start");

    function progress() {
      if (state.step > 4) return "";
      return '<div class="crbw-prog"><div class="crbw-prog-row"><span>Step ' + state.step + ' of 4</span>' +
        '<span class="t">' + ic("clock", 13, 2) + TIME_LEFT[state.step - 1] + '</span></div>' +
        '<div class="crbw-prog-bar"><i style="width:' + (state.step * 25) + '%"></i></div></div>';
    }
    function focusHeading() { var h = root.querySelector(".crbw-h,.crbw-conf h3,.crbw-booked .bt"); if (h) { h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch (e) { try { h.focus(); } catch (_) {} } } }
    function go(step) { state.step = step; render(); track("step_view", "step" + step); }

    function render() {
      var body;
      if (state.step === 1) body = viewTrade();
      else if (state.step === 2) body = viewSource();
      else if (state.step === 3) body = viewTime();
      else if (state.step === 4) body = viewContact();
      else if (state.step === 5) body = viewDetails();
      else body = viewConfirm();
      root.innerHTML = progress() + '<div class="crbw-body">' + body + "</div>";
      wire();
      focusHeading();
    }

    // ---- Step 1: Trade (+ searchable "Other" picker) ----
    function viewTrade() {
      if (state.otherOpen) {
        return '<button class="crbw-back" data-tradeall="1">' + ic("left", 15, 2) + "All trades</button>" +
          '<h2 class="crbw-h">Find your trade</h2>' +
          '<p class="crbw-sub">Start typing — we cover just about every home-service trade.</p>' +
          '<div class="crbw-tsearchwrap">' + ic("search", 18, 2) + '<input class="crbw-tsearch" id="crbw-tsearch" type="text" placeholder="Search your trade…" autocomplete="off" autocapitalize="none"></div>' +
          '<div class="crbw-tlist" id="crbw-tlist">' + OTHER_TRADES.map(function (t) {
            return '<button class="crbw-topt" data-otrade="' + esc(t) + '"><span>' + esc(t) + '</span><span class="tc">' + ic("chevron", 16, 2) + "</span></button>";
          }).join("") + '<div class="crbw-tnone" id="crbw-tnone" style="display:none">No match — <button data-otrade="Other" style="color:var(--mint);font-weight:800;text-decoration:underline">use “Other”</button></div></div>';
      }
      return '<h2 class="crbw-h">What trade are you in?</h2>' +
        '<p class="crbw-sub">We\'ll build the demo around real numbers from your industry.</p>' +
        '<div class="crbw-grid">' + TRADES.map(function (t) {
          return '<button class="crbw-card' + (state.trade === t.id ? " on" : "") + '" data-trade="' + t.id + '"><span class="ic">' + ic(t.icon, 26) + "</span>" + esc(t.label) + "</button>";
        }).join("") + "</div>" +
        '<div class="crbw-trust">' + ic("shield", 14, 2) + "15-minute demo · Consent-first · Flat $7/lead, no contracts</div>";
    }

    // ---- Step 2: Lead source — stylized dropdown (auto-advance on pick) ----
    function viewSource() {
      var sel = SOURCES.filter(function (s) { return s.id === state.source; })[0];
      var trigger = sel
        ? '<span class="ric">' + ic(sel.icon, 20) + '</span><span class="ddlab">' + esc(sel.label) + "</span>"
        : '<span class="ric">' + ic("search", 20) + '</span><span class="ddph">Choose your main source…</span>';
      var menu = state.ddOpen ? '<div class="crbw-ddmenu" id="crbw-ddmenu">' + SOURCES.map(function (s) {
        return '<button class="crbw-ddopt" data-src="' + esc(s.id) + '"><span class="ric">' + ic(s.icon, 20) + "</span>" +
          '<span class="rt"><span class="rl">' + esc(s.label) + '</span><span class="rs">' + esc(s.sub) + "</span></span></button>";
      }).join("") + "</div>" : "";
      return '<button class="crbw-back" data-back="1">' + ic("left", 15, 2) + "Back</button>" +
        '<h2 class="crbw-h">Where do most of your leads come from today?</h2>' +
        '<p class="crbw-sub">So we can put your real cost per lead next to our flat $7 — live on the call.</p>' +
        '<div class="crbw-dd"><button class="crbw-ddtrigger" id="crbw-ddtrigger" aria-haspopup="listbox" aria-expanded="' + (state.ddOpen ? "true" : "false") + '">' +
        trigger + '<span class="ddchev">' + ic("chevronDown", 18, 2) + "</span></button>" + menu + "</div>";
    }

    // ---- Step 3: Time ----
    function viewTime() {
      var inner;
      if (state.days === null) inner = '<div class="crbw-load"><span class="crbw-spin"></span>Finding live openings…</div>';
      else if (state.days === false) inner = '<div class="crbw-fallback"><div class="crbw-warn" style="text-align:left">Couldn\'t load times right now.</div><p style="font-size:13.5px;color:var(--ink-2);margin:0 0 10px">Call or text us and we\'ll grab a time by hand:</p><a href="tel:+17279999846">' + ic("phone", 20, 2) + PHONE + "</a></div>";
      else if (!state.days.length) inner = '<div class="crbw-fallback"><p style="font-size:13.5px;color:var(--ink-2);margin:0 0 10px">No open times in the next couple weeks — call or text and we\'ll fit you in:</p><a href="tel:+17279999846">' + ic("phone", 20, 2) + PHONE + "</a></div>";
      else {
        var strip = state.days.slice(0, 4).map(function (d) {
          var low = d.slotCount <= 2;
          var parts = d.label.split(", ");
          var dw = parts[0] || d.label, dd = parts.slice(1).join(", ");
          return '<button class="crbw-day' + (state.day === d.date ? " on" : "") + '" data-day="' + d.date + '"><div class="dw">' + esc(dw) + '</div><div class="dd">' + esc(dd) + '</div><div class="dn' + (low ? " low" : "") + '">' + d.slotCount + " open</div></button>";
        }).join("");
        var slotsHtml = "";
        if (state.day) {
          var day = state.days.filter(function (d) { return d.date === state.day; })[0];
          if (day && day.slots.length) {
            var all = day.slots;
            var shown = state.showAll ? all : all.slice(0, SLOT_CAP);
            var inner2 = '<div class="crbw-timehd">' + ic("clock", 14, 2) + "Times · Central</div>" +
              '<div class="crbw-slots">' + shown.map(function (s) {
                return '<button class="crbw-slot' + (state.slot === s.iso ? " on" : "") + '" data-slot="' + esc(s.iso) + '">' + esc(s.time) + "</button>";
              }).join("") + "</div>";
            if (!state.showAll && all.length > SLOT_CAP) {
              inner2 += '<button class="crbw-showall" data-showall="1">Show all ' + all.length + " times</button>";
            }
            slotsHtml = '<div class="crbw-timebox">' + inner2 + "</div>";
          }
        }
        inner = '<div class="crbw-days">' + strip + "</div>" + slotsHtml;
      }
      return '<button class="crbw-back" data-back="2">' + ic("left", 15, 2) + "Back</button>" +
        '<h2 class="crbw-h">Pick a time that works</h2>' +
        '<p class="crbw-sub">15 minutes, screen share. Tap a time and you\'re almost done.</p>' + inner;
    }

    // ---- Step 4: Email (mobile optional) ----
    function viewContact() {
      var slotObj = findSlot(state.slot);
      var pill = tradeLabel() + " demo" + (slotObj ? " — " + slotObj.day + " at " + slotObj.time : "");
      return '<button class="crbw-back" data-back="3">' + ic("left", 15, 2) + "Back</button>" +
        '<h2 class="crbw-h">Where should we send it?</h2>' +
        '<div class="crbw-pill">' + ic("clock", 14, 2) + esc(pill) + "</div>" +
        '<div class="crbw-f"><label for="crbw-email">Email <i>(for your calendar invite)</i></label><input id="crbw-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@yourcompany.com" required></div>' +
        '<div class="crbw-f"><label for="crbw-phone">Mobile <i>(we\'ll text your demo link + reminder)</i></label><input id="crbw-phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(555) 123-4567" required></div>' +
        '<button class="crbw-btn" data-submit="1">Confirm my demo ' + ic("arrow", 18, 2.2) + "</button>" +
        '<div class="crbw-note">No pressure, no contracts. Reschedule anytime.</div>';
    }

    // ---- Step 5: Post-booking details (skippable) ----
    function viewDetails() {
      var slotObj = findSlot((state.booking && state.booking.startIso) || state.slot);
      var when = slotObj ? slotObj.day + " at " + slotObj.time : "You're on the calendar";
      var needPhone = !state.phone;
      return '<div class="crbw-booked"><span class="bc">' + ic("check", 22, 2.4) + '</span><span><span class="bt">You\'re booked' + (slotObj ? "" : "!") + '</span><span class="bs">' + esc(when) + " · Central</span></span></div>" +
        '<h2 class="crbw-h">Make your 15 minutes count</h2>' +
        '<p class="crbw-sub">Add these now and we\'ll walk in ready — no warm-up, no wasted minutes.</p>' +
        '<ul class="crbw-why">' +
        "<li>" + ic("check", 15, 2.4) + "We pull up <b>your</b> website and Analytics before we dial — you see your own missed leads, not a canned demo</li>" +
        "<li>" + ic("check", 15, 2.4) + "We pre-run your numbers so the call is answers, not data entry</li>" +
        "</ul>" +
        '<div class="crbw-f"><label for="crbw-name">Your name</label><input id="crbw-name" type="text" autocomplete="name" placeholder="Jordan Torres"></div>' +
        '<div class="crbw-f"><label for="crbw-co">Company</label><input id="crbw-co" type="text" autocomplete="organization" placeholder="Torres Roofing"></div>' +
        '<div class="crbw-f"><label for="crbw-web">Website <i>(so we can pull it up live)</i></label><input id="crbw-web" type="url" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="torresroofing.com"></div>' +
        (needPhone ? '<div class="crbw-f"><label for="crbw-phone2">Mobile <i>(optional — text reminder)</i></label><input id="crbw-phone2" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(555) 123-4567"></div>' : "") +
        '<button class="crbw-btn" data-save="1">Save &amp; finish</button>' +
        '<button class="crbw-ghost" data-skip="1">Skip — I\'ll bring it to the demo</button>';
    }

    // ---- Final confirmation ----
    function viewConfirm() {
      var b = state.booking || {};
      var slotObj = findSlot(b.startIso || state.slot);
      var line = slotObj ? slotObj.day + " at " + slotObj.time + " · Central" : "You're on the calendar.";
      return '<div class="crbw-conf" aria-live="polite">' +
        '<div class="crbw-check">' + ic("circleCheck", 34, 2) + "</div>" +
        "<h3>You're all set</h3>" +
        "<p>" + esc(line) + "</p>" +
        (b.uid ? '<button class="crbw-btn" data-ics="' + esc(b.uid) + '">' + ic("clock", 18, 2) + "Add to my calendar</button>" : "") +
        '<ul class="crbw-expect">' +
        "<li>" + ic("check", 16, 2.2) + "Demo link by " + (state.phone ? "text" : "email") + " shortly, plus a reminder before we start</li>" +
        "<li>" + ic("check", 16, 2.2) + "We'll open your Analytics and show your missed leads live</li>" +
        "<li>" + ic("check", 16, 2.2) + "We compare what you pay per lead now to $7 flat — right on the call</li>" +
        "</ul></div>";
    }

    function tradeLabel() {
      return state.tradeLabel || (TRADES.filter(function (t) { return t.id === state.trade; })[0] || {}).label || "Demo";
    }
    function findSlot(iso) {
      var out = null;
      (state.days || []).forEach(function (d) { (d.slots || []).forEach(function (s) { if (s.iso === iso) out = { day: d.label, time: s.time }; }); });
      return out;
    }

    function loadSlots() {
      state.days = null; state.showAll = false; render();
      var today = new Date();
      var start = today.toISOString().slice(0, 10);
      var end = new Date(today.getTime() + 16 * 86400000).toISOString().slice(0, 10);
      fetch(api + "/api/booking/slots?start=" + start + "&end=" + end, { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          state.days = (j && Array.isArray(j.days)) ? j.days : false;
          if (state.days && !state.days.length && j._configured === false) state.days = false;
          if (state.days && state.days.length && !state.day) state.day = state.days[0].date; // preselect first open day
          render();
        })
        .catch(function () { state.days = false; render(); });
    }

    function submit(btn) {
      var email = root.querySelector("#crbw-email"), phone = root.querySelector("#crbw-phone");
      [email, phone].forEach(function (i) { i.classList.remove("bad"); });
      root.querySelectorAll(".crbw-err").forEach(function (e) { e.remove(); });
      var bad = false;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { email.classList.add("bad"); email.parentNode.appendChild(el('<div class="crbw-err">Enter a valid email so we can send your invite.</div>')); bad = true; }
      if (phone.value.replace(/\D/g, "").length < 10) { phone.classList.add("bad"); phone.parentNode.appendChild(el('<div class="crbw-err">Add a mobile number so we can text your demo link and reminder.</div>')); bad = true; }
      if (bad) { var f = root.querySelector(".crbw-f input.bad"); if (f) f.focus(); return; }

      state.phone = phone.value.trim();
      btn.disabled = true; btn.innerHTML = '<span class="crbw-spin" aria-hidden="true"></span> Confirming…';
      track("booking_submitted", "step4");
      fetch(api + "/api/booking/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startIso: state.slot, email: email.value.trim(), phone: state.phone,
          trade: tradeLabel(), leadSources: state.source ? [state.source] : [],
          utm: utm, sessionId: session,
        }),
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) {
          state.booking = j.booking || {}; state.completed = true;
          track("booking_confirmed", "confirm", { uid: state.booking.uid });
          go(5);
        } else if (j && j.reason === "slot_taken") {
          track("booking_failed", "step4", { reason: "slot_taken" });
          state.slot = null; state.step = 3; render();
          var b = root.querySelector(".crbw-body");
          if (b) b.insertBefore(el('<div class="crbw-warn">That time was just grabbed by someone else — pick another below.</div>'), b.querySelector(".crbw-days") || b.firstChild);
          loadSlots();
        } else {
          track("booking_failed", "step4", { reason: (j && j.reason) || "error" });
          btn.disabled = false; btn.innerHTML = "Confirm my demo " + ic("arrow", 18, 2.2);
          var b2 = root.querySelector(".crbw-body");
          if (b2 && !b2.querySelector(".crbw-warn")) b2.insertBefore(el('<div class="crbw-warn">Something went wrong booking that. Try again, or call ' + PHONE + ".</div>"), b2.querySelector(".crbw-pill"));
        }
      }).catch(function () {
        track("booking_failed", "step4", { reason: "network" });
        btn.disabled = false; btn.innerHTML = "Confirm my demo " + ic("arrow", 18, 2.2);
      });
    }

    function saveDetails(btn) {
      var name = val("#crbw-name"), co = val("#crbw-co"), web = val("#crbw-web"), ph = val("#crbw-phone2");
      var uidv = state.booking && state.booking.uid;
      if (!uidv) { go(6); return; }
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="crbw-spin" aria-hidden="true"></span> Saving…'; }
      track("details_saved", "step5", { has_web: !!web, has_name: !!name });
      fetch(api + "/api/booking/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: uidv, name: name, company: co, website: web, phone: ph, sessionId: session }),
      }).then(function () {}).catch(function () {}).then(function () {
        if (ph && !state.phone) state.phone = ph;
        go(6);
      });
    }
    function val(sel) { var e = root.querySelector(sel); return e ? e.value.trim() : ""; }

    function pickTrade(id, label) { state.trade = id; state.tradeLabel = label; state.otherOpen = false; track("step_complete", "step1", { trade: label }); go(2); }

    function wire() {
      root.querySelectorAll("[data-trade]").forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute("data-trade");
          if (id === "other") { state.otherOpen = true; track("other_trade_opened", "step1"); render(); return; }
          var lbl = (TRADES.filter(function (t) { return t.id === id; })[0] || {}).label || id;
          pickTrade(id, lbl);
        };
      });
      var tback = root.querySelector("[data-tradeall]"); if (tback) tback.onclick = function () { state.otherOpen = false; render(); };
      root.querySelectorAll("[data-otrade]").forEach(function (b) { b.onclick = function () { var l = b.getAttribute("data-otrade"); pickTrade(slug(l), l); }; });
      var tsearch = root.querySelector("#crbw-tsearch");
      if (tsearch) {
        tsearch.focus();
        tsearch.oninput = function () {
          var q = tsearch.value.trim().toLowerCase(); var shown = 0;
          root.querySelectorAll(".crbw-topt").forEach(function (o) {
            var hit = o.getAttribute("data-otrade").toLowerCase().indexOf(q) >= 0;
            o.style.display = hit ? "" : "none"; if (hit) shown++;
          });
          var none = root.querySelector("#crbw-tnone"); if (none) none.style.display = shown ? "none" : "block";
        };
      }
      root.querySelectorAll("[data-back]").forEach(function (b) { b.onclick = function () { var t = +b.getAttribute("data-back"); if (t === 1) state.otherOpen = false; go(t); }; });
      // Step 2 dropdown
      var ddt = root.querySelector("#crbw-ddtrigger"); if (ddt) ddt.onclick = function () { state.ddOpen = !state.ddOpen; render(); };
      root.querySelectorAll("[data-src]").forEach(function (b) { b.onclick = function () { state.source = b.getAttribute("data-src"); state.ddOpen = false; track("step_complete", "step2", { source: state.source }); go(3); loadSlots(); }; });
      // Time
      root.querySelectorAll("[data-day]").forEach(function (b) { b.onclick = function () { state.day = b.getAttribute("data-day"); state.slot = null; state.showAll = false; render(); }; });
      root.querySelectorAll("[data-slot]").forEach(function (b) { b.onclick = function () { state.slot = b.getAttribute("data-slot"); track("slot_selected", "step3"); track("step_complete", "step3"); go(4); }; });
      var showall = root.querySelector("[data-showall]"); if (showall) showall.onclick = function () { state.showAll = true; render(); };
      // Forms
      var pIn = root.querySelector("#crbw-phone"); if (pIn) pIn.oninput = function () { pIn.value = fmtPhone(pIn.value); };
      var pIn2 = root.querySelector("#crbw-phone2"); if (pIn2) pIn2.oninput = function () { pIn2.value = fmtPhone(pIn2.value); };
      var sub = root.querySelector("[data-submit]"); if (sub) sub.onclick = function () { submit(sub); };
      var save = root.querySelector("[data-save]"); if (save) save.onclick = function () { saveDetails(save); };
      var skip = root.querySelector("[data-skip]"); if (skip) skip.onclick = function () { track("details_skipped", "step5"); go(6); };
      var ics = root.querySelector("[data-ics]"); if (ics) ics.onclick = function () { window.location.href = api + "/api/booking/ics?uid=" + encodeURIComponent(ics.getAttribute("data-ics")); };
    }

    // Abandon beacon — fire once if they leave before the slot is held (steps 1-4 only).
    var beaconed = false;
    function abandon() { if (beaconed || state.completed) return; beaconed = true; track("abandoned", "step" + state.step); }
    window.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") abandon(); });
    window.addEventListener("pagehide", abandon);

    render();
  }

  function boot() {
    injectCss();
    document.querySelectorAll("[data-cr-booking]").forEach(function (h) { if (!h.__crbwMounted) { h.__crbwMounted = true; mount(h); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
