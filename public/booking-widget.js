/*! Consent Resolve — demo booking widget (self-contained, no framework).
    Mount: <div data-cr-booking data-api="https://consentresolve.com"></div> + this script.
    All Cal.com calls go through the Worker (/api/booking/*); the API key never reaches here.
    Scoped with the crbw- prefix + explicit input/button resets so it can't clash with a host page. */
(function () {
  "use strict";
  if (window.__crbwLoaded) return; window.__crbwLoaded = true;

  var TRADES = [
    { id: "roofing", label: "Roofing", icon: "🏠" },
    { id: "hvac", label: "HVAC", icon: "🌡️" },
    { id: "plumbing", label: "Plumbing", icon: "🔧" },
    { id: "electrical", label: "Electrical", icon: "⚡" },
    { id: "pest", label: "Pest control", icon: "🐜" },
    { id: "other", label: "Other trade", icon: "🛠️" },
  ];
  var TRAFFIC = ["Under 500 visits/mo", "500 to 2,000 visits/mo", "Over 2,000 visits/mo", "Not sure"];
  var SOURCES = ["Google ads", "Google LSA", "Angi / HomeAdvisor", "Facebook / Meta", "Referrals", "Yard signs / trucks", "SEO / organic", "Other"];
  var TIME_LEFT = ["About 45 seconds left", "About 35 seconds left", "About 25 seconds left", "About 15 seconds left"];
  var PHONE = "(727) 999-9846";

  var CSS = [
    ".crbw{--mint:#00e5a0;--mint-hi:#00c489;--navy:#0a1628;--ink:#0e1c2e;--ink-2:#48586a;--muted:#8496a6;--line:#e2e8f0;--line-2:#cdd7e1;--bg:#ffffff;--soft:#f5f8fb;--good:#0f9d6b;--warn:#b9791a;font-family:'Hanken Grotesk',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);background:var(--bg);border-radius:16px;overflow:hidden;box-sizing:border-box;-webkit-text-size-adjust:100%;text-align:left}",
    ".crbw *,.crbw *::before,.crbw *::after{box-sizing:border-box}",
    ".crbw button{font:inherit;cursor:pointer;margin:0;border:0;background:none;color:inherit}",
    ".crbw input{font:inherit;margin:0;width:100%;color:var(--ink);background:#fff}",
    ".crbw-prog{padding:14px 18px 0}",
    ".crbw-prog-row{display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:7px}",
    ".crbw-prog-bar{height:6px;border-radius:6px;background:var(--soft);overflow:hidden}",
    ".crbw-prog-bar i{display:block;height:100%;border-radius:6px;background:var(--mint);transition:width .3s cubic-bezier(.22,.61,.36,1)}",
    ".crbw-body{padding:18px 18px 20px}",
    ".crbw-h{font-size:20px;font-weight:800;line-height:1.2;margin:2px 0 3px;letter-spacing:-.01em}",
    ".crbw-sub{font-size:13.5px;color:var(--ink-2);line-height:1.5;margin:0 0 15px}",
    ".crbw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}",
    "@media (max-width:520px){.crbw-grid{grid-template-columns:repeat(2,1fr)}}",
    ".crbw-card{min-height:76px;border:1.5px solid var(--line);border-radius:12px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:10px 6px;font-size:13.5px;font-weight:700;color:var(--ink);transition:border-color .14s,background .14s,transform .1s}",
    ".crbw-card:hover{border-color:var(--mint);background:var(--soft)}",
    ".crbw-card:active{transform:scale(.97)}",
    ".crbw-card .ic{font-size:24px;line-height:1}",
    ".crbw-card.on{border-color:var(--mint);background:rgba(0,229,160,.10)}",
    ".crbw-qh{font-size:14.5px;font-weight:800;margin:4px 0 9px}",
    ".crbw-qhh{font-size:12px;font-weight:600;color:var(--muted);margin:-4px 0 9px}",
    ".crbw-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}",
    ".crbw-chip{min-height:44px;padding:0 14px;border:1.5px solid var(--line);border-radius:999px;background:#fff;font-size:13.5px;font-weight:700;color:var(--ink-2);display:inline-flex;align-items:center;transition:border-color .14s,background .14s,color .14s}",
    ".crbw-chip:hover{border-color:var(--line-2)}",
    ".crbw-chip.on{border-color:var(--mint);background:rgba(0,229,160,.12);color:var(--navy)}",
    ".crbw-days{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 10px;-webkit-overflow-scrolling:touch}",
    ".crbw-day{flex:0 0 auto;min-width:84px;border:1.5px solid var(--line);border-radius:12px;background:#fff;padding:9px 10px;text-align:center;transition:border-color .14s,background .14s}",
    ".crbw-day:hover{border-color:var(--line-2)}",
    ".crbw-day.on{border-color:var(--mint);background:rgba(0,229,160,.10)}",
    ".crbw-day .dw{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}",
    ".crbw-day .dd{font-size:15px;font-weight:800;margin:2px 0 4px}",
    ".crbw-day .dn{font-size:11px;font-weight:800;color:var(--good)}",
    ".crbw-day .dn.low{color:var(--warn)}",
    ".crbw-slotgroup{margin-top:8px}",
    ".crbw-slotlbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:10px 0 6px}",
    ".crbw-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
    "@media (max-width:520px){.crbw-slots{grid-template-columns:repeat(2,1fr)}}",
    ".crbw-slot{min-height:44px;border:1.5px solid var(--line);border-radius:10px;background:#fff;font-size:13.5px;font-weight:700;color:var(--ink);display:flex;align-items:center;justify-content:center;transition:border-color .14s,background .14s}",
    ".crbw-slot:hover{border-color:var(--mint)}",
    ".crbw-slot.on{border-color:var(--mint);background:var(--mint);color:var(--navy)}",
    ".crbw-f{margin-bottom:12px}",
    ".crbw-f label{display:block;font-size:13px;font-weight:700;margin-bottom:5px}",
    ".crbw-f label i{font-style:normal;font-weight:500;color:var(--muted)}",
    ".crbw-f input{height:46px;padding:0 13px;border:1.5px solid var(--line);border-radius:10px;background:#fff;font-size:15px;outline:none;transition:border-color .14s,box-shadow .14s}",
    ".crbw-f input:focus{border-color:var(--mint);box-shadow:0 0 0 3px rgba(0,229,160,.18)}",
    ".crbw-f input.bad{border-color:#d34b66;box-shadow:0 0 0 3px rgba(211,75,102,.16)}",
    ".crbw-pill{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:700;color:var(--navy);margin-bottom:14px}",
    ".crbw-btn{width:100%;min-height:50px;border-radius:12px;background:var(--mint);color:var(--navy);font-size:15.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .14s,transform .1s,opacity .14s}",
    ".crbw-btn:hover{background:var(--mint-hi)}",
    ".crbw-btn:active{transform:scale(.99)}",
    ".crbw-btn[disabled]{opacity:.5;cursor:default}",
    ".crbw-note{font-size:12px;color:var(--muted);text-align:center;margin-top:10px;line-height:1.5}",
    ".crbw-trust{font-size:11.5px;color:var(--muted);text-align:center;margin-top:14px;font-weight:600}",
    ".crbw-back{font-size:13px;font-weight:700;color:var(--ink-2);background:none;padding:6px 2px;margin-bottom:6px;display:inline-flex;align-items:center;gap:5px}",
    ".crbw-back:hover{color:var(--navy)}",
    ".crbw-warn{background:rgba(185,121,26,.10);border:1px solid rgba(185,121,26,.3);color:#8a5a13;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:600;margin-bottom:12px;line-height:1.45}",
    ".crbw-fallback{text-align:center;padding:20px 6px}",
    ".crbw-fallback a{color:var(--navy);font-weight:800;font-size:19px;text-decoration:none}",
    ".crbw-spin{width:17px;height:17px;border:2.5px solid rgba(10,22,40,.25);border-top-color:var(--navy);border-radius:50%;animation:crbwSpin .7s linear infinite;display:inline-block}",
    "@keyframes crbwSpin{to{transform:rotate(360deg)}}",
    ".crbw-conf{text-align:center;padding:24px 16px 26px}",
    ".crbw-check{width:58px;height:58px;border-radius:50%;background:rgba(0,229,160,.16);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:30px;color:var(--good)}",
    ".crbw-conf h3{font-size:22px;font-weight:800;margin:0 0 5px}",
    ".crbw-conf p{font-size:14px;color:var(--ink-2);margin:0 0 18px}",
    ".crbw-expect{text-align:left;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:14px 15px;margin-top:16px}",
    ".crbw-expect li{list-style:none;display:flex;gap:9px;font-size:13.5px;color:var(--ink);line-height:1.5;padding:5px 0}",
    ".crbw-expect li::before{content:'✓';color:var(--good);font-weight:800;flex:0 0 auto}",
    ".crbw-load{padding:36px 0;text-align:center;color:var(--muted);font-size:13px;font-weight:600}",
    "@media (prefers-reduced-motion:reduce){.crbw *{transition:none!important;animation:none!important}}",
  ].join("");

  function injectCss() {
    if (document.getElementById("crbw-css")) return;
    var s = document.createElement("style"); s.id = "crbw-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
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
    var state = { step: 1, trade: null, traffic: null, sources: [], day: null, slot: null, days: null, booking: null, completed: false };

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
      return '<div class="crbw-prog"><div class="crbw-prog-row"><span>Step ' + state.step + ' of 4</span><span>' + TIME_LEFT[state.step - 1] + '</span></div>' +
        '<div class="crbw-prog-bar"><i style="width:' + (state.step * 25) + '%"></i></div></div>';
    }
    function focusHeading() { var h = root.querySelector(".crbw-h,.crbw-conf h3"); if (h) { h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: false }); } catch (e) { h.focus(); } } }

    function go(step) { state.step = step; render(); track("step_view", "step" + step); }

    function render() {
      var body;
      if (state.step === 1) body = viewTrade();
      else if (state.step === 2) body = viewMarketing();
      else if (state.step === 3) body = viewTime();
      else if (state.step === 4) body = viewContact();
      else body = viewConfirm();
      root.innerHTML = progress() + '<div class="crbw-body">' + body + "</div>";
      wire();
      focusHeading();
    }

    // ---- Step 1: Trade ----
    function viewTrade() {
      return '<h2 class="crbw-h">What trade are you in?</h2>' +
        '<p class="crbw-sub">We\'ll show your demo with real data from your industry.</p>' +
        '<div class="crbw-grid">' + TRADES.map(function (t) {
          return '<button class="crbw-card' + (state.trade === t.id ? " on" : "") + '" data-trade="' + t.id + '"><span class="ic" aria-hidden="true">' + t.icon + '</span>' + esc(t.label) + "</button>";
        }).join("") + "</div>" +
        '<div class="crbw-trust">15-minute demo · Consent-first, always · Flat $7/lead, no contracts</div>';
    }
    // ---- Step 2: Marketing ----
    function viewMarketing() {
      return '<button class="crbw-back" data-back="1">‹ Back</button>' +
        '<div class="crbw-qh">Roughly how much website traffic do you get?</div>' +
        '<div class="crbw-chips">' + TRAFFIC.map(function (t) {
          return '<button class="crbw-chip' + (state.traffic === t ? " on" : "") + '" data-traffic="' + esc(t) + '">' + esc(t) + "</button>";
        }).join("") + "</div>" +
        '<div class="crbw-qh">How do you get leads today? <i style="font-weight:500;color:var(--muted)">(optional — tap all that apply)</i></div>' +
        '<div class="crbw-qhh">Helps us compare your cost per lead to $7 flat.</div>' +
        '<div class="crbw-chips">' + SOURCES.map(function (s) {
          return '<button class="crbw-chip' + (state.sources.indexOf(s) >= 0 ? " on" : "") + '" data-src="' + esc(s) + '">' + esc(s) + "</button>";
        }).join("") + "</div>" +
        '<button class="crbw-btn" data-continue="2"' + (state.traffic ? "" : " disabled") + ">Continue</button>";
    }
    // ---- Step 3: Time ----
    function viewTime() {
      var inner;
      if (state.days === null) inner = '<div class="crbw-load">Loading live openings…</div>';
      else if (state.days === false) inner = '<div class="crbw-fallback"><div class="crbw-warn" style="text-align:left">Couldn\'t load times right now.</div><p style="font-size:13.5px;color:var(--ink-2);margin:0 0 8px">Call or text us and we\'ll grab a time by hand:</p><a href="tel:+17279999846">' + PHONE + "</a></div>";
      else if (!state.days.length) inner = '<div class="crbw-fallback"><p style="font-size:13.5px;color:var(--ink-2);margin:0 0 8px">No open times in the next couple weeks — call or text and we\'ll fit you in:</p><a href="tel:+17279999846">' + PHONE + "</a></div>";
      else {
        var strip = state.days.slice(0, 5).map(function (d) {
          var low = d.slotCount <= 2;
          var parts = d.label.split(", ");
          var dw = parts[0] || d.label, dd = parts.slice(1).join(", ");
          return '<button class="crbw-day' + (state.day === d.date ? " on" : "") + '" data-day="' + d.date + '"><div class="dw">' + esc(dw) + '</div><div class="dd">' + esc(dd) + '</div><div class="dn' + (low ? " low" : "") + '">' + d.slotCount + " open</div></button>";
        }).join("");
        var slotsHtml = "";
        if (state.day) {
          var day = state.days.filter(function (d) { return d.date === state.day; })[0];
          if (day) {
            var am = [], pm = [];
            day.slots.forEach(function (s) { (/\bAM$/i.test(s.time) ? am : pm).push(s); });
            var grp = function (label, arr) { return arr.length ? '<div class="crbw-slotgroup"><div class="crbw-slotlbl">' + label + '</div><div class="crbw-slots">' + arr.map(function (s) { return '<button class="crbw-slot' + (state.slot === s.iso ? " on" : "") + '" data-slot="' + esc(s.iso) + '">' + esc(s.time) + "</button>"; }).join("") + "</div></div>" : ""; };
            slotsHtml = grp("Morning", am) + grp("Afternoon", pm);
          }
        }
        inner = '<div class="crbw-days">' + strip + "</div>" + slotsHtml +
          '<button class="crbw-btn" data-continue="3" style="margin-top:16px"' + (state.slot ? "" : " disabled") + ">Continue</button>";
      }
      return '<button class="crbw-back" data-back="2">‹ Back</button>' +
        '<h2 class="crbw-h">Grab a demo time</h2>' +
        '<p class="crbw-sub">15 minutes, screen share, Central time. Live openings below.</p>' + inner;
    }
    // ---- Step 4: Contact ----
    function viewContact() {
      var slotObj = null;
      (state.days || []).forEach(function (d) { (d.slots || []).forEach(function (s) { if (s.iso === state.slot) slotObj = { day: d.label, time: s.time }; }); });
      var tradeLabel = (TRADES.filter(function (t) { return t.id === state.trade; })[0] || {}).label || "Demo";
      var pill = slotObj ? esc(tradeLabel) + " demo — " + esc(slotObj.day) + " at " + esc(slotObj.time) : esc(tradeLabel) + " demo";
      return '<button class="crbw-back" data-back="3">‹ Back</button>' +
        '<h2 class="crbw-h">Last step — your details</h2>' +
        '<div class="crbw-pill">' + pill + "</div>" +
        '<div class="crbw-f"><label for="crbw-name">Name</label><input id="crbw-name" type="text" autocomplete="name" required></div>' +
        '<div class="crbw-f"><label for="crbw-co">Company</label><input id="crbw-co" type="text" autocomplete="organization"></div>' +
        '<div class="crbw-f"><label for="crbw-web">Website <i>(we\'ll pull up your site live in your demo)</i></label><input id="crbw-web" type="url" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="torresroofing.com" required></div>' +
        '<div class="crbw-f"><label for="crbw-phone">Mobile number <i>(we\'ll text your demo link and a reminder)</i></label><input id="crbw-phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(555) 123-4567" required></div>' +
        '<div class="crbw-f"><label for="crbw-email">Email <i>(for the calendar invite)</i></label><input id="crbw-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" required></div>' +
        '<button class="crbw-btn" data-submit="1">Book my demo</button>' +
        '<div class="crbw-note">No pressure, no contracts. Reschedule anytime by text.</div>';
    }
    // ---- Confirmation ----
    function viewConfirm() {
      var b = state.booking || {};
      var slotObj = null;
      (state.days || []).forEach(function (d) { (d.slots || []).forEach(function (s) { if (s.iso === (b.startIso || state.slot)) slotObj = { day: d.label, time: s.time }; }); });
      var line = slotObj ? slotObj.day + " at " + slotObj.time + " · Central" : "You're on the calendar.";
      return '<div class="crbw-conf" aria-live="polite">' +
        '<div class="crbw-check" aria-hidden="true">✓</div>' +
        "<h3>Demo booked</h3>" +
        "<p>" + esc(line) + "</p>" +
        (b.uid ? '<button class="crbw-btn" data-ics="' + esc(b.uid) + '">Add to my calendar</button>' : "") +
        '<ul class="crbw-expect">' +
        "<li>We'll review your website before the call and show your missed leads live</li>" +
        "<li>Demo link by text in the next 2 minutes, reminder the morning of</li>" +
        "<li>We'll compare what you pay per lead now to $7 flat, live on the call</li>" +
        "</ul></div>";
    }

    function loadSlots() {
      state.days = null; render();
      var today = new Date();
      var start = today.toISOString().slice(0, 10);
      var end = new Date(today.getTime() + 16 * 86400000).toISOString().slice(0, 10);
      fetch(api + "/api/booking/slots?start=" + start + "&end=" + end, { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (j) { state.days = (j && Array.isArray(j.days)) ? j.days : false; if (state.days && !state.days.length && j._configured === false) state.days = false; render(); })
        .catch(function () { state.days = false; render(); });
    }

    function submit(btn) {
      var name = root.querySelector("#crbw-name"), web = root.querySelector("#crbw-web"), phone = root.querySelector("#crbw-phone"), email = root.querySelector("#crbw-email"), co = root.querySelector("#crbw-co");
      var bad = false;
      [name, web, phone, email].forEach(function (i) { i.classList.remove("bad"); });
      if (!name.value.trim()) { name.classList.add("bad"); bad = true; }
      if (!web.value.trim()) { web.classList.add("bad"); bad = true; }
      if (phone.value.replace(/\D/g, "").length < 10) { phone.classList.add("bad"); bad = true; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { email.classList.add("bad"); bad = true; }
      if (bad) { var f = root.querySelector(".crbw-f input.bad"); if (f) f.focus(); return; }

      btn.disabled = true; btn.innerHTML = '<span class="crbw-spin" aria-hidden="true"></span> Booking…';
      track("booking_submitted", "step4");
      fetch(api + "/api/booking/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startIso: state.slot, name: name.value.trim(), company: co.value.trim(), website: web.value.trim(),
          phone: phone.value.trim(), email: email.value.trim(), trade: state.trade, traffic: state.traffic,
          leadSources: state.sources, utm: utm, sessionId: session,
        }),
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) {
          state.booking = j.booking || {}; state.completed = true; state.step = 5;
          track("booking_confirmed", "confirm", { uid: state.booking.uid });
          render();
        } else if (j && j.reason === "slot_taken") {
          track("booking_failed", "step4", { reason: "slot_taken" });
          state.slot = null; state.step = 3; render();
          var w = el('<div class="crbw-warn">That time was just grabbed by someone else — pick another below.</div>');
          var b = root.querySelector(".crbw-body"); if (b) b.insertBefore(w, b.querySelector(".crbw-days") || b.firstChild);
          loadSlots();
        } else {
          track("booking_failed", "step4", { reason: (j && j.reason) || "error" });
          btn.disabled = false; btn.textContent = "Book my demo";
          var b2 = root.querySelector(".crbw-body");
          if (b2 && !b2.querySelector(".crbw-warn")) b2.insertBefore(el('<div class="crbw-warn">Something went wrong booking that. Try again, or call ' + PHONE + ".</div>"), b2.querySelector(".crbw-pill"));
        }
      }).catch(function () {
        track("booking_failed", "step4", { reason: "network" });
        btn.disabled = false; btn.textContent = "Book my demo";
      });
    }

    function wire() {
      root.querySelectorAll("[data-trade]").forEach(function (b) { b.onclick = function () { state.trade = b.getAttribute("data-trade"); track("step_complete", "step1", { trade: state.trade }); go(2); }; });
      root.querySelectorAll("[data-back]").forEach(function (b) { b.onclick = function () { go(+b.getAttribute("data-back")); }; });
      root.querySelectorAll("[data-traffic]").forEach(function (b) { b.onclick = function () { state.traffic = b.getAttribute("data-traffic"); render(); }; });
      root.querySelectorAll("[data-src]").forEach(function (b) { b.onclick = function () { var s = b.getAttribute("data-src"); var i = state.sources.indexOf(s); if (i >= 0) state.sources.splice(i, 1); else state.sources.push(s); b.classList.toggle("on"); }; });
      root.querySelectorAll("[data-day]").forEach(function (b) { b.onclick = function () { state.day = b.getAttribute("data-day"); state.slot = null; render(); }; });
      root.querySelectorAll("[data-slot]").forEach(function (b) { b.onclick = function () { state.slot = b.getAttribute("data-slot"); track("slot_selected", "step3"); render(); }; });
      var cont = root.querySelector("[data-continue]");
      if (cont) cont.onclick = function () {
        var from = +cont.getAttribute("data-continue");
        if (from === 2) { if (!state.traffic) return; track("step_complete", "step2", { traffic: state.traffic, sources: state.sources.length }); go(3); loadSlots(); }
        else if (from === 3) { if (!state.slot) return; track("step_complete", "step3"); go(4); }
      };
      var pIn = root.querySelector("#crbw-phone");
      if (pIn) pIn.oninput = function () { pIn.value = fmtPhone(pIn.value); };
      var sub = root.querySelector("[data-submit]");
      if (sub) sub.onclick = function () { submit(sub); };
      var ics = root.querySelector("[data-ics]");
      if (ics) ics.onclick = function () { window.location.href = api + "/api/booking/ics?uid=" + encodeURIComponent(ics.getAttribute("data-ics")); };
    }

    // Abandon beacon — fire once if they leave before confirming.
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
