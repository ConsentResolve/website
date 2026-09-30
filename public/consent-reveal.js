/*!
 * Consent Reveal v1
 * A consent gate that shows visitors, live, what the platform learns about them
 * once they say yes. One file, no dependencies, renders in a shadow root so it
 * can't collide with site CSS. Brands: cr (consentresolve.com), rtv
 * (reachthevote.com), gls (greenleadsource.com).
 *
 * Install (before </body>):
 *   <script src="/consent-reveal.js" data-brand="cr"
 *           data-whoami="/api/whoami" data-resolve="/api/resolve" defer></script>
 *
 * Optional, before the script: window.ConsentRevealConfig = { ...overrides }
 *   brand, whoami, resolve, whatWeDoUrl, matchRate, mask, resolveTimeout,
 *   ctaUrl, policyUrl, ageGate (number|false),
 *   remember ('visitor' | 'session' | 'never'), acceptScripts [urls],
 *   loadFonts (bool), copy { ...any copy key below }
 *
 * Testing: add ?consent_demo=1 to any URL to ignore a saved answer.
 *          add &cr_resolve=demo-match or &cr_resolve=demo-miss to preview both outcomes.
 *
 * Identity match (data-resolve="/api/resolve"): POSTed with cookies after the yes,
 *   body { brand, page, consentAt }. Respond with one of:
 *     { "status": "pending" }                      -> polled every 1.5s up to resolveTimeout
 *     { "matched": false }                         -> "No match this time", fields hidden
 *     { "matched": true, "fields": [ { "label": "Name", "value": "...", "type": "name" },
 *        { "label": "Email", "value": "...", "type": "email" }, ... ] }
 *   Matched details start collapsed behind a "Reveal my details" button and expand on click;
 *   values only enter the page on click.
 *   Set mask: true to also partially hide email / phone / address after the click.
 *
 * Events on window:
 *   consentreveal            detail: { choice: 'accepted' | 'declined' }
 *   consentreveal:match      detail: { matched: true | false }
 * Also pushes Google Consent Mode v2 updates and dataLayer events
 *   consent_reveal_accept / consent_reveal_decline,
 *   consent_reveal_match / consent_reveal_nomatch (use these to track your real match rate).
 */
(function () {
  'use strict';
  if (window.__consentReveal) return;
  window.__consentReveal = true;

  var VERSION = 1;
  var tag = document.currentScript || {};
  var ds = tag.dataset || {};
  var qs = new URLSearchParams(location.search);

  /* ---------- Brand presets ---------- */
  var BRANDS = {
    cr: {
      name: 'Consent Resolve',
      fonts: 'family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600',
      ctaUrl: '/demo', policyUrl: '/privacy', ageGate: false,
      t: {
        card: '#132036', ink: '#E6EDF7', muted: '#8FA3BF', rule: '#26395A',
        accent: '#F2B544', accentInk: '#0E1726', hl: 'rgba(242,181,68,.30)',
        scrim: 'rgba(5,10,18,.80)', head: "'Barlow Condensed','Arial Narrow',sans-serif",
        body: "'Barlow',system-ui,-apple-system,'Segoe UI',sans-serif",
        hs: '2.15rem', hw: '700', radius: '10px', br: '6px'
      },
      copy: {
        mark: 'Consent Resolve', markNote: 'Visitor identification',
        askH: 'We only identify visitors who say yes.',
        askP: 'We use cookies to enhance your experience. Choose your preference below.',
        accept: 'Accept, show me', decline: 'No, keep me anonymous',
        fine: 'If you say no, the only thing we keep is your answer.',
        decH: 'You’re a stranger to us.',
        decP: 'No location, no device, nothing saved except this answer. Every visitor on your site gets the same deal. That’s what consent-first means.',
        revH: 'Here’s you, from our side.',
        revP: 'Gathered in the second after you said yes.',
        outro: 'Every visitor who says yes on your site becomes a record like this, delivered to you as a lead.',
        cta: 'See it on your site', cont: 'Continue to site',
        checking: 'Checking for a match…',
        checkingP: 'Looking for the name and email behind this visit.',
        matchH: 'We found you.',
        matchP: 'We can put a name to {rate} who say yes, without them filling anything out. You’re one of them. This is the lead a business would get.',
        missH: 'No match this time.',
        missP: 'We can put a name to {rate} who say yes. Shared Wi-Fi, a new device, or a privacy tool can keep someone unnamed.',
        matchSrc: 'matched by Consent Resolve',
        found: '{n} contact details found', revealBtn: 'Reveal my details', matchBadge: 'What We Do'
      }
    },
    rtv: {
      name: 'ReachTheVote',
      fonts: 'family=Old+Standard+TT:wght@400;700&family=Libre+Franklin:wght@400;500;600',
      ctaUrl: '/', policyUrl: '/privacy', ageGate: false,
      t: {
        card: '#F7F5F0', ink: '#000000', muted: '#55524C', rule: '#000000',
        accent: '#000000', accentInk: '#F7F5F0', hl: 'rgba(0,0,0,.12)',
        scrim: 'rgba(20,18,15,.72)', head: "'Old Standard TT',Georgia,'Times New Roman',serif",
        body: "'Libre Franklin',system-ui,-apple-system,'Segoe UI',sans-serif",
        hs: '2.2rem', hw: '700', radius: '0', br: '0'
      },
      copy: {
        mark: 'ReachTheVote', markNote: 'Late edition',
        askH: 'Before you read on: may we know who you are?',
        askP: 'ReachTheVote only identifies visitors who say yes. Say yes here and see exactly what a campaign would see about you.',
        accept: 'Yes, show me', decline: 'No, stay anonymous',
        fine: 'If you say no, the only thing we keep is your answer.',
        decH: 'Anonymous citizen, noted.',
        decP: 'Nothing kept but your answer. Campaigns using ReachTheVote run on the same rule: no yes, no record.',
        revH: 'Reported just now: you.',
        revP: 'Everything below arrived the moment you said yes.',
        outro: 'Every supporter who says yes on a campaign site becomes a record like this, sent straight into the tools the campaign already uses.',
        cta: 'Find Supporters', cont: 'Continue to site',
        checking: 'Checking for a match…',
        checkingP: 'Looking for the name and email behind this visit.',
        matchH: 'We found you.',
        matchP: 'ReachTheVote can name {rate} who say yes, without a form. You’re one of them. This is the supporter record a campaign would get.',
        missH: 'No match this time.',
        missP: 'ReachTheVote can name {rate} who say yes. Shared Wi-Fi, a new device, or a privacy tool can keep someone unnamed.',
        matchSrc: 'matched by ReachTheVote',
        found: '{n} contact details found', revealBtn: 'Reveal my details', matchBadge: 'What We Do'
      }
    },
    gls: {
      name: 'GreenLeadSource',
      fonts: 'family=Shrikhand&family=Karla:wght@400;500;700',
      ctaUrl: '/sell-more-cannabis/', policyUrl: '/privacy', ageGate: 21,
      t: {
        card: '#F2E6CC', ink: '#1F3B2C', muted: '#5B6650', rule: '#C9B78F',
        accent: '#1F3B2C', accentInk: '#F2E6CC', hl: 'rgba(217,162,27,.40)',
        scrim: 'rgba(22,38,28,.78)', head: "'Shrikhand',Georgia,serif",
        body: "'Karla',system-ui,-apple-system,'Segoe UI',sans-serif",
        hs: '2rem', hw: '400', radius: '18px', br: '999px'
      },
      copy: {
        mark: 'GreenLeadSource', markNote: 'For dispensaries and brands',
        ageH: 'Are you 21 or older?', ageP: 'This site is about the cannabis industry and is for adults only.',
        ageYes: 'Yes, I’m 21 or older', ageNo: 'No',
        underH: 'Come back on your 21st.', underP: 'This site is for adults 21 and over.',
        askH: 'We only learn who you are if you say yes.',
        askP: 'Say yes and we’ll show you the record a dispensary gets when a shopper opts in on its site.',
        accept: 'Yes, show me', decline: 'No, keep me anonymous',
        fine: 'If you say no, the only thing we keep is your answer.',
        decH: 'Still just browsing.',
        decP: 'Nothing saved but your answer. Shoppers on your site get the same deal.',
        revH: 'Here’s you, from behind the counter.',
        revP: 'Gathered in the second after you said yes.',
        outro: 'Every shopper who says yes on your site becomes a record like this, sent into the marketing tools you already own.',
        cta: 'Sell More Cannabis', cont: 'Continue to site',
        checking: 'Checking for a match…',
        checkingP: 'Looking for the name and email behind this visit.',
        matchH: 'We found you.',
        matchP: 'We can put a name to {rate} who say yes, without a form. You’re one of them. This is the customer record a dispensary would get.',
        missH: 'No match this time.',
        missP: 'We can put a name to {rate} who say yes. Shared Wi-Fi, a new device, or a privacy tool can keep someone unnamed.',
        matchSrc: 'matched by GreenLeadSource',
        found: '{n} contact details found', revealBtn: 'Reveal my details', matchBadge: 'What We Do'
      }
    }
  };

  function detectBrand() {
    var h = location.hostname;
    if (/reachthevote/i.test(h)) return 'rtv';
    if (/greenleadsource/i.test(h)) return 'gls';
    return 'cr';
  }

  var user = window.ConsentRevealConfig || {};
  var brandKey = user.brand || qs.get('cr_brand') || ds.brand || detectBrand();
  var B = BRANDS[brandKey] || BRANDS.cr;
  var cfg = {
    whoami: user.whoami || ds.whoami || 'https://ipapi.co/json/',
    // Identity match endpoint. URL params may only select the demo modes.
    resolve: /^demo-(match|miss)$/.test(qs.get('cr_resolve') || '') ? qs.get('cr_resolve')
      : (user.resolve || ds.resolve || null),
    resolveTimeout: user.resolveTimeout || 8000,
    matchRate: user.matchRate || ds.matchRate || 'about 30%',
    whatWeDoUrl: user.whatWeDoUrl || ds.whatWeDo || null,
    mask: 'mask' in user ? user.mask : ds.mask === 'on',
    ctaUrl: user.ctaUrl || ds.cta || B.ctaUrl,
    policyUrl: user.policyUrl || ds.policy || B.policyUrl,
    ageGate: 'ageGate' in user ? user.ageGate : B.ageGate,
    remember: user.remember || ds.remember || 'visitor',
    acceptScripts: user.acceptScripts || (ds.acceptScripts ? ds.acceptScripts.split(',') : []),
    loadFonts: 'loadFonts' in user ? user.loadFonts : ds.fonts !== 'off'
  };
  var C = Object.assign({}, B.copy, user.copy || {});
  var T = B.t;
  var KEY = 'consent_reveal_' + brandKey;
  var store = cfg.remember === 'session' ? sessionStorage : localStorage;
  var state = { openedAt: performance.now(), age: false, signals: {}, locked: [] };

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readChoice() {
    try { var v = JSON.parse(store.getItem(KEY) || 'null'); return v && v.v === VERSION ? v : null; }
    catch (e) { return null; }
  }
  function saveChoice(choice) {
    var rec = { v: VERSION, choice: choice, at: new Date().toISOString() };
    try { store.setItem(KEY, JSON.stringify(rec)); } catch (e) {}
    return rec;
  }
  function reducedMotion() {
    return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- What the browser tells us ---------- */
  function device() {
    var ua = navigator.userAgent, b = 'A browser', o = '';
    if (/Edg\//.test(ua)) b = 'Edge';
    else if (/OPR\//.test(ua)) b = 'Opera';
    else if (/SamsungBrowser/.test(ua)) b = 'Samsung Internet';
    else if (/FxiOS|Firefox\//.test(ua)) b = 'Firefox';
    else if (/CriOS|Chrome\//.test(ua)) b = 'Chrome';
    else if (/Safari\//.test(ua)) b = 'Safari';
    if (/iPhone/.test(ua)) o = 'iPhone';
    else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) o = 'iPad';
    else if (/Android/.test(ua)) o = /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
    else if (/Windows/.test(ua)) o = 'Windows';
    else if (/CrOS/.test(ua)) o = 'Chromebook';
    else if (/Mac OS X/.test(ua)) o = 'Mac';
    else if (/Linux/.test(ua)) o = 'Linux';
    return o ? b + ' on ' + o : b;
  }
  function cameFrom() {
    var src = qs.get('utm_source'), camp = qs.get('utm_campaign');
    if (src) return src + (camp ? ', campaign “' + camp + '”' : '') + ' (tracked link)';
    if (qs.get('gclid') || qs.get('gbraid') || qs.get('wbraid')) return 'A Google ad';
    if (qs.get('fbclid')) return 'Facebook or Instagram';
    if (qs.get('msclkid')) return 'A Microsoft ad';
    var r = document.referrer;
    if (!r) return 'Typed in, a bookmark, or an app';
    try {
      var h = new URL(r).hostname.replace(/^www\./, '');
      if (h === location.hostname.replace(/^www\./, '')) return 'Another page on this site';
      if (/(^|\.)google\./.test(h)) return 'Google search';
      if (/(^|\.)bing\.com$/.test(h)) return 'Bing search';
      if (/duckduckgo/.test(h)) return 'DuckDuckGo';
      if (/facebook|fb\.|instagram/.test(h)) return 'Facebook or Instagram';
      if (/linkedin|lnkd\.in/.test(h)) return 'LinkedIn';
      if (/^t\.co$|twitter|(^|\.)x\.com$/.test(h)) return 'X (Twitter)';
      if (/chatgpt|openai|perplexity|claude\.ai|gemini/.test(h)) return 'An AI assistant (' + h + ')';
      if (/mail|outlook/.test(h)) return 'An email (' + h + ')';
      return h;
    } catch (e) { return 'Unknown'; }
  }
  function localTime() {
    var d = new Date(), t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), z = '';
    try {
      var p = new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' }).formatToParts(d);
      for (var i = 0; i < p.length; i++) if (p[i].type === 'timeZoneName') z = p[i].value;
    } catch (e) {}
    return z ? t + ', ' + z : t;
  }
  function language() {
    var l = navigator.language || 'en-US';
    try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(l) || l; } catch (e) { return l; }
  }
  function screenInfo() {
    var dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
    return screen.width + ' × ' + screen.height + (dark ? ', dark mode' : '');
  }
  function localSignals() {
    var secs = Math.max(1, Math.round((performance.now() - state.openedAt) / 1000));
    return [
      { k: 'device', label: 'Device', v: device(), src: 'from your browser' },
      { k: 'source', label: 'Came from', v: cameFrom(), src: 'from your browser' },
      { k: 'page', label: 'Reading', v: document.title || location.pathname, src: 'this page' },
      { k: 'time', label: 'Local time', v: localTime(), src: 'from your device clock' },
      { k: 'lang', label: 'Language', v: language(), src: 'from your browser' },
      { k: 'screen', label: 'Screen', v: screenInfo(), src: 'from your device' },
      { k: 'decided', label: 'Decided in', v: secs + (secs === 1 ? ' second' : ' seconds'), src: 'measured on this page' }
    ];
  }

  /* ---------- What the connection tells us ---------- */
  function lookup() {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { ctrl && ctrl.abort(); }, 3500);
    return fetch(cfg.whoami, { signal: ctrl && ctrl.signal, credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        clearTimeout(timer);
        // Accepts the bundled Cloudflare Worker shape or ipapi.co's shape.
        var city = d.city, region = d.region, zip = d.postalCode || d.postal;
        var country = d.country_code || d.country;
        var org = (d.asOrganization || d.org || '').replace(/^AS\d+\s*/, '');
        var place = [city, region].filter(Boolean).join(', ') + (zip ? ' ' + zip : '');
        if (country && country !== 'US') place += (place ? ', ' : '') + (d.country_name || country);
        return { location: place || null, provider: org || null };
      })
      .catch(function () { clearTimeout(timer); return { location: null, provider: null, failed: true }; });
  }

  /* ---------- Consent side effects ---------- */
  function applyChoice(choice) {
    var granted = choice === 'accepted', v = granted ? 'granted' : 'denied';
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('consent', 'update', { ad_storage: v, analytics_storage: v, ad_user_data: v, ad_personalization: v });
    window.dataLayer.push({ event: granted ? 'consent_reveal_accept' : 'consent_reveal_decline', consent_brand: brandKey });
    window.dispatchEvent(new CustomEvent('consentreveal', { detail: { choice: choice, brand: brandKey } }));
    if (granted) cfg.acceptScripts.forEach(function (src) {
      src = src.trim();
      if (!src || document.querySelector('script[src="' + src + '"]')) return;
      var s = document.createElement('script'); s.src = src; s.async = true; document.head.appendChild(s);
    });
  }

  /* ---------- Styles ---------- */
  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    '.scrim{position:fixed;inset:0;z-index:2147483646;background:var(--scrim);display:grid;place-items:center;padding:16px;font-family:var(--body);color:var(--ink);-webkit-font-smoothing:antialiased}',
    '.scrim[hidden],.pill[hidden]{display:none}',
    '.card{width:min(560px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--card);border:1px solid var(--rule);border-radius:var(--radius);padding:26px 28px 24px;box-shadow:0 30px 80px rgba(0,0,0,.35)}',
    '.rtv .card{border:2px solid #000;box-shadow:8px 8px 0 #000}',
    '.mark{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 0 20px;padding-bottom:12px;border-bottom:1px solid var(--rule)}',
    '.rtv .mark{border-bottom:3px double #000}',
    '.mark b{font-family:var(--head);font-weight:var(--hw);font-size:1.15rem;letter-spacing:.01em}',
    '.mark span:not(.badge){color:var(--muted);font-size:.8rem}',
    '.badge{display:inline-block;font:600 .75rem/1 var(--body);letter-spacing:.02em;padding:6px 11px;border-radius:999px;background:var(--accent);color:var(--accentInk);text-decoration:none;white-space:nowrap}',
    '.rtv .badge{border-radius:0}',
    'a.badge:hover{filter:brightness(1.08)}',
    'a.badge:focus-visible{outline:3px solid var(--accent);outline-offset:3px}',
    '.cr .mark b::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-right:8px;vertical-align:middle;box-shadow:0 0 0 4px rgba(242,181,68,.18)}',
    'h2{font-family:var(--head);font-weight:var(--hw);font-size:var(--hs);line-height:1.08;margin:0 0 12px;text-wrap:balance;outline:none}',
    '.cr h2{letter-spacing:.005em}',
    'p{margin:0 0 14px;line-height:1.55;font-size:1rem;max-width:62ch}',
    '.rtv p{line-height:1.6}',
    '.fine{color:var(--muted);font-size:.84rem;margin:14px 0 0}',
    '.fine a,.link{color:inherit;text-decoration:underline;text-underline-offset:2px;background:none;border:0;padding:0;font:inherit;cursor:pointer}',
    '.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}',
    '.btn{appearance:none;font:600 1rem/1.2 var(--body);min-height:50px;padding:12px 16px;border-radius:var(--br);border:2px solid var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none}',
    '.fill{background:var(--accent);border-color:var(--accent);color:var(--accentInk)}',
    '.line{background:transparent;color:var(--ink)}',
    '.btn:hover{filter:brightness(1.06)}',
    '.btn:focus-visible,.link:focus-visible,.fine a:focus-visible,.pill:focus-visible{outline:3px solid var(--accent);outline-offset:3px}',
    '.cr .line{border-color:var(--rule);color:var(--ink)}',
    '.record{margin:4px 0 18px;padding:0;border-top:1px solid var(--rule)}',
    '.rtv .record{border-top:2px solid #000}',
    '.row{display:grid;grid-template-columns:8.5rem 1fr;gap:2px 16px;padding:10px 0;border-bottom:1px solid var(--rule)}',
    '.rtv .row{border-bottom-style:dotted}',
    'dt{color:var(--muted);font-size:.875rem;padding-top:2px}',
    'dd{margin:0;min-width:0}',
    '.v{font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;padding:0 2px;margin:0 -2px;background:linear-gradient(var(--hl),var(--hl)) no-repeat 0 88%/100% 45%}',
    '.src{display:block;color:var(--muted);font-size:.78rem;margin-top:2px}',
    '.pending .v{font-weight:400;color:var(--muted);background:none}',
    '.animate .row{opacity:0;transform:translateY(5px);animation:rin .38s ease forwards;animation-delay:calc(var(--i) * 150ms)}',
    '.animate .v{background-size:0% 45%;animation:hl .5s ease forwards;animation-delay:calc(var(--i) * 150ms + 220ms)}',
    '@keyframes rin{to{opacity:1;transform:none}}',
    '@keyframes hl{to{background-size:100% 45%}}',
    '.status{margin:0 0 16px;padding:14px 16px;border-radius:var(--radius);border:1px solid var(--rule);border-left:4px solid var(--muted)}',
    '.status strong{display:block;font-family:var(--head);font-weight:var(--hw);font-size:1.25rem;line-height:1.2;margin-bottom:4px}',
    '.status p{margin:0;font-size:.95rem}',
    '.status[data-state=match]{border-left-color:#2E9E5B;background:rgba(46,158,91,.08)}',
    '.status[data-state=miss]{border-left-color:var(--accent)}',
    '.status[data-state=checking] strong::after{content:"";display:inline-block;width:.6em;height:.6em;margin-left:.5em;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:spin .8s linear infinite;vertical-align:middle}',
    '@keyframes spin{to{transform:rotate(360deg)}}',
    '.rtv .status{border:2px solid #000;border-left-width:6px;border-radius:0}',
    '.rtv .status[data-state=match]{background:#fff;border-left-color:#000}',
    '.contact{margin:0 0 14px;border:1px solid var(--rule);border-radius:var(--radius);padding:0 14px}',
    '.rtv .contact{border:2px solid #000;border-radius:0}',
    '.contact .record{border-top:0;margin:0}',
    '.contact .row:last-child{border-bottom:0}',
    '.contact-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0}',
    '.contact-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .45s ease}',
    '.contact-body>dl{overflow:hidden;min-height:0}',
    '.contact.open .contact-body{grid-template-rows:1fr}',
    '.contact.open .contact-rows{border-top:1px solid var(--rule)}',
    '.rtv .contact.open .contact-rows{border-top:2px solid #000}',
    '@media (prefers-reduced-motion:reduce){.contact-body{transition:none}}',
    '.contact-head span{font-weight:600}',
    '.contact-head .btn{min-height:42px;padding:8px 16px;font-size:.95rem}',
    '.v:focus{outline:none}',
    '@media (max-width:460px){.contact-head{flex-direction:column;align-items:stretch}}',
    '.record[hidden],.lede[hidden],.outro[hidden]{display:none}',
    '.outro{font-size:.95rem}',
    '.pill{position:fixed;left:14px;bottom:14px;z-index:2147483645;font:500 .8rem/1 var(--body);padding:9px 13px;border-radius:999px;background:var(--card);color:var(--ink);border:1px solid var(--rule);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18)}',
    '@media (max-width:460px){.card{padding:20px 18px}.actions{grid-template-columns:1fr}.row{grid-template-columns:1fr}h2{font-size:calc(var(--hs) * .85)}}',
    '@media (prefers-reduced-motion:reduce){.status strong::after{animation:none}.animate .row,.animate .v{animation:none;opacity:1;transform:none;background-size:100% 45%}}'
  ].join('\n');

  /* ---------- Mount ---------- */
  var host, root, scrim, card, pill;
  function mount() {
    if (cfg.loadFonts && B.fonts) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + B.fonts + '&display=swap';
      document.head.appendChild(l);
    }
    host = document.createElement('div');
    host.id = 'consent-reveal';
    document.body.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    var vars = ':host{--card:' + T.card + ';--ink:' + T.ink + ';--muted:' + T.muted + ';--rule:' + T.rule +
      ';--accent:' + T.accent + ';--accentInk:' + T.accentInk + ';--hl:' + T.hl + ';--scrim:' + T.scrim +
      ';--head:' + T.head + ';--body:' + T.body + ';--hs:' + T.hs + ';--hw:' + T.hw +
      ';--radius:' + T.radius + ';--br:' + T.br + '}';
    root.innerHTML = '<style>' + vars + CSS + '</style>' +
      '<div class="' + brandKey + '">' +
      '<div class="scrim" hidden><div class="card" role="dialog" aria-modal="true" aria-labelledby="cr-h"></div></div>' +
      '<button class="pill" type="button" hidden>Privacy choice</button></div>';
    scrim = root.querySelector('.scrim');
    card = root.querySelector('.card');
    pill = root.querySelector('.pill');
    card.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    pill.addEventListener('click', function () {
      var c = readChoice();
      open(c && c.choice === 'accepted' ? 'reveal' : 'ask');
    });
  }

  function lockPage(on) {
    var de = document.documentElement;
    if (on) {
      state.locked = [];
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === host || el.inert) return;
        el.inert = true; state.locked.push(el);
      });
      state.overflow = de.style.overflow; de.style.overflow = 'hidden';
    } else {
      state.locked.forEach(function (el) { el.inert = false; });
      state.locked = [];
      de.style.overflow = state.overflow || '';
    }
  }

  function open(screenName) {
    state.openedAt = performance.now();
    lockPage(true);
    scrim.hidden = false; pill.hidden = true;
    render(screenName);
  }
  function close() {
    lockPage(false);
    scrim.hidden = true; pill.hidden = false;
  }

  /* ---------- Screens ---------- */
  function markup(body) {
    return '<div class="mark"><b>' + esc(C.mark) + '</b><span>' + esc(C.markNote) + '</span></div>' + body;
  }
  var screens = {
    age: function () {
      return markup('<h2 id="cr-h" tabindex="-1">' + esc(C.ageH) + '</h2><p>' + esc(C.ageP) + '</p>' +
        '<div class="actions"><button class="btn fill" data-act="age-yes">' + esc(C.ageYes) + '</button>' +
        '<button class="btn line" data-act="age-no">' + esc(C.ageNo) + '</button></div>');
    },
    underage: function () {
      return markup('<h2 id="cr-h" tabindex="-1">' + esc(C.underH) + '</h2><p>' + esc(C.underP) + '</p>');
    },
    ask: function () {
      return markup('<h2 id="cr-h" tabindex="-1">' + esc(C.askH) + '</h2><p>' + esc(C.askP) + '</p>' +
        '<div class="actions"><button class="btn fill" data-act="accept">' + esc(C.accept) + '</button>' +
        '<button class="btn line" data-act="decline">' + esc(C.decline) + '</button></div>' +
        '<p class="fine">' + esc(C.fine) + ' <a href="' + esc(cfg.policyUrl) + '" target="_blank" rel="noopener">Privacy policy</a></p>');
    },
    declined: function () {
      return markup('<h2 id="cr-h" tabindex="-1">' + esc(C.decH) + '</h2><p>' + esc(C.decP) + '</p>' +
        '<div class="actions"><button class="btn fill" data-act="close">' + esc(C.cont) + '</button>' +
        '<button class="btn line" data-act="accept">Show me after all</button></div>');
    },
    reveal: function (rows) {
      var list = rows.map(function (r, i) { return row(r, i); }).join('');
      return markup('<h2 id="cr-h" tabindex="-1">' + esc(C.revH) + '</h2><p class="lede">' + esc(C.revP) + '</p>' +
        (cfg.resolve ? '<div class="status" data-state="checking" role="status" aria-live="polite"><strong>' + esc(C.checking) + '</strong><p>' + esc(C.checkingP) + '</p></div>' : '') +
        '<dl class="record' + (reducedMotion() ? '' : ' animate') + '"' + (cfg.resolve ? ' hidden' : '') + '>' + list + '</dl>' +
        '<p class="outro">' + esc(C.outro) + '</p>' +
        '<div class="actions"><a class="btn fill" href="' + esc(cfg.ctaUrl) + '">' + esc(C.cta) + '</a>' +
        '<button class="btn line" data-act="close">' + esc(C.cont) + '</button></div>' +
        '<p class="fine"><button class="link" data-act="withdraw">Take back my yes</button> and we stop collecting.</p>');
    }
  };
  function row(r, i) {
    return '<div class="row' + (r.pending ? ' pending' : '') + '" data-k="' + esc(r.k) + '" style="--i:' + i + '">' +
      '<dt>' + esc(r.label) + '</dt><dd><span class="v">' + esc(r.v) + '</span><span class="src">' + esc(r.src) + '</span></dd></div>';
  }

  function render(name, data) {
    state.revealToken = null;
    card.innerHTML = screens[name](data);
    state.screen = name;
    var h = card.querySelector('h2');
    h && h.focus({ preventScroll: true });
    card.scrollTop = 0;
  }

  function reveal() {
    var local = localSignals();
    var rows = [
      { k: 'location', label: 'Location', v: 'Looking up…', src: 'from your internet connection', pending: true },
      { k: 'provider', label: 'Internet provider', v: 'Looking up…', src: 'from your internet connection', pending: true }
    ].concat(local);
    state.signals = {};
    local.forEach(function (r) { state.signals[r.k] = r.v; });
    render('reveal', rows);
    lookup().then(function (net) {
      fill('location', net.location, net.failed ? 'Blocked by a browser extension or network' : 'Not available on this connection');
      fill('provider', net.provider, net.failed ? 'Blocked by a browser extension or network' : 'Not available on this connection');
      state.signals.location = net.location; state.signals.provider = net.provider;
    });
    if (cfg.resolve) {
      var token = state.revealToken = {};
      resolveIdentity().then(function (res) { if (state.revealToken === token) showMatch(res); });
    }
  }

  /* ---------- Identity match ---------- */
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function resolveIdentity() {
    if (cfg.resolve === 'demo-match') return delay(1800).then(function () {
      return { matched: true, sample: true, fields: [
        { label: 'Name', value: 'Sam Rivera', type: 'name' },
        { label: 'Email', value: 'sam.rivera@example.com', type: 'email' },
        { label: 'Home address', value: '123 Example Ln, Springfield, TX 75000', type: 'address' }
      ] };
    });
    if (cfg.resolve === 'demo-miss') return delay(1800).then(function () { return { matched: false }; });
    var deadline = Date.now() + cfg.resolveTimeout;
    function attempt() {
      return fetch(cfg.resolve, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brandKey, page: location.href, consentAt: (state.consent || readChoice() || {}).at })
      })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) {
          if (d && d.status === 'pending' && Date.now() < deadline) return delay(1500).then(attempt);
          return d || { matched: false };
        })
        .catch(function () {
          return Date.now() < deadline ? delay(1500).then(attempt) : { matched: false, error: true };
        });
    }
    return Promise.race([attempt(), delay(cfg.resolveTimeout + 500).then(function () { return { matched: false, timeout: true }; })]);
  }
  function maskField(f) {
    var v = String(f.value == null ? '' : f.value), t = (f.type || '').toLowerCase();
    if (!cfg.mask) return v;
    if (t === 'email') { var p = v.split('@'); return p[0].charAt(0) + '•••@' + (p[1] || ''); }
    if (t === 'phone') return v.replace(/\d(?=(?:\D*\d){4})/g, '•');
    if (t === 'address') return v.indexOf(',') > -1 ? 'Street on file,' + v.slice(v.indexOf(',') + 1) : 'On file';
    return v;
  }
  function revealContact() {
    var box = card.querySelector('.contact'), m = state.match;
    if (!box || !m) return;
    var rows = box.querySelector('.contact-rows');
    rows.innerHTML = m.fields.map(function (f, i) {
      return row({ k: 'match' + i, label: f.label, v: maskField(f), src: m.src }, i);
    }).join('');
    if (!reducedMotion()) rows.classList.add('animate');
    void box.offsetHeight; // commit collapsed state so the expand transition runs
    box.classList.add('open');
    var btn = box.querySelector('[data-act=reveal-contact]'); btn.parentNode.removeChild(btn);
    ['.record:not(.contact-rows)', '.lede', '.outro'].forEach(function (sel) { var el = card.querySelector(sel); if (el) el.hidden = false; });
    var first = box.querySelector('.v'); if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
    (window.dataLayer = window.dataLayer || []).push({ event: 'consent_reveal_contact_revealed', consent_brand: brandKey });
  }
  function showMatch(res) {
    var st = card.querySelector('.status');
    if (!st || state.screen !== 'reveal') return;
    var fields = (res && res.matched && res.fields) || [];
    var matched = fields.length > 0;
    state.matched = matched;
    (window.dataLayer = window.dataLayer || []).push({ event: matched ? 'consent_reveal_match' : 'consent_reveal_nomatch', consent_brand: brandKey });
    window.dispatchEvent(new CustomEvent('consentreveal:match', { detail: { matched: matched, brand: brandKey } }));
    var rate = function (t) { return t.replace('{rate}', cfg.matchRate); };
    st.setAttribute('data-state', matched ? 'match' : 'miss');
    st.innerHTML = '<strong>' + esc(matched ? C.matchH : C.missH) + '</strong><p>' + esc(rate(matched ? C.matchP : C.missP)) + '</p>';
    if (matched) {
      var src = C.matchSrc + (res.sample ? ' (sample record for testing)' : '');
      state.match = { fields: fields, src: src };
      var note = card.querySelector('.mark span');
      if (note) note.outerHTML = cfg.whatWeDoUrl
        ? '<a class="badge" href="' + esc(cfg.whatWeDoUrl) + '">' + esc(C.matchBadge) + '</a>'
        : '<span class="badge">' + esc(C.matchBadge) + '</span>';
      st.insertAdjacentHTML('afterend',
        '<div class="contact"><div class="contact-head"><span>' +
        esc(C.found.replace('{n}', fields.length)) + '</span>' +
        '<button class="btn fill" data-act="reveal-contact" aria-expanded="false" aria-controls="cr-contact">' + esc(C.revealBtn) + '</button></div>' +
        '<div class="contact-body" id="cr-contact"><dl class="record contact-rows"></dl></div></div>');
      ['.lede', '.outro'].forEach(function (sel) { var el = card.querySelector(sel); if (el) el.hidden = true; });
    } else {
      var lede = card.querySelector('.lede'); if (lede) lede.hidden = true;
      var outro = card.querySelector('.outro'); if (outro) outro.hidden = true; // "a record like this" needs a record
    }
  }
  function fill(k, v, fallback) {
    var el = card.querySelector('.row[data-k="' + k + '"]');
    if (!el) return;
    el.querySelector('.v').textContent = v || fallback;
    if (v) el.classList.remove('pending');
  }

  /* ---------- Interactions ---------- */
  function onClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'age-yes') { state.age = true; render('ask'); }
    else if (act === 'age-no') { render('underage'); }
    else if (act === 'accept') { state.consent = saveChoice('accepted'); applyChoice('accepted'); reveal(); }
    else if (act === 'decline' || act === 'withdraw') { state.consent = saveChoice('declined'); applyChoice('declined'); render('declined'); }
    else if (act === 'close') { close(); }
    else if (act === 'reveal-contact') { revealContact(); }
  }

  function onKey(e) {
    if (scrim.hidden) return;
    if (e.key === 'Escape' && (state.screen === 'reveal' || state.screen === 'declined')) { close(); return; }
    if (e.key !== 'Tab') return;
    var f = card.querySelectorAll('button:not([disabled]),a[href]');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], active = root.activeElement;
    if (e.shiftKey && (active === first || !card.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- Start ---------- */
  function start() {
    mount();
    var saved = readChoice();
    var force = qs.get('consent_demo') === '1' || cfg.remember === 'never';
    if (saved && !force) {
      applyChoice(saved.choice);
      pill.hidden = false;
      return;
    }
    open(cfg.ageGate ? 'age' : 'ask');
  }
  window.ConsentReveal = {
    open: function () { open('ask'); },
    reset: function () { try { store.removeItem(KEY); } catch (e) {} },
    choice: function () { var c = readChoice(); return c ? c.choice : null; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
