/* Inbox fixture — bucket-classified (open/auto/snoozed/suppressed), with explicit
   manual-task instructions, what-happened/next clarity events, and Gmail fields.
   Order = how the Open queue should read (highest-priority action first). */
window.DATA = {
  me: { name: "Andy Mentges", role: "sales", email: "andy@consentresolve.com" },
  counts: { open: 6, auto: 5, snoozed: 1, all: 14 },

  conversations: [
    /* ============ OPEN — a human must act ============ */
    { id:"c05", bucket:"open", source:"meta", channel:"sms", name:"Tomas Lang", company:"Lang Roofing",
      contact_email:"tomas@langroofing.com", initials:"TL", lifecycle:"SQL", hot:true, unread:true, ts:"6 min ago",
      task:{ tag:"do", text:"Reply now — he asked “how does it work?”", cta:"Reply" },
      last:{ label:"Tomas replied by SMS", ts:"6 min ago", tone:"good" },
      next:{ kind:"you", label:"Reply — answer his question", when:"now", tone:"act" },
      consent:{ email:"granted", sms:"granted", voice:"granted" },
      sequence:{ step:1, total:4, label:"Speed-to-lead", status:"replied" },
      sla:{ min:6, level:"warn" },
      intel:{ fit:"hot", time_on_site:"3m 05s", pages:5, first_seen:"22 min ago", speed_to_lead_h:0.1, cost_per_lead:12.9, src_label:"Meta · Lead form (Roofing)", site_status:"live · has form", pages_viewed:["/roofing-leads/","/pricing/"] },
      deal:{ title:"Lang Roofing", value_usd:0, prob:63 },
      messages:[
        { dir:"out", channel:"sms", body:"Hi Tomas, Andy at Consent Resolve — we turn your site visitors into $7 exclusive leads. Want the quick version? (Reply STOP to opt out)", ts:"12 min ago", meta:"delivered" },
        { dir:"in", channel:"sms", body:"yeah I'm interested, how does it work?", ts:"6 min ago" } ] },

    { id:"c08", bucket:"open", source:"meta", channel:"sms", name:"Sandra Cole", company:"Cole & Sons Painting",
      contact_email:"sandra@coleandsons.com", initials:"SC", lifecycle:"Lead", hot:false, unread:true, ts:"24 min ago",
      task:{ tag:"wait", text:"Auto-text failed (landline). Email her, or call (727) 999-9846.", cta:"Switch to email" },
      last:{ label:"SMS failed — carrier rejected (landline)", ts:"24 min ago", tone:"bad" },
      next:{ kind:"you", label:"Email her or call — sequence is paused", when:"overdue 24 min", tone:"urgent" },
      consent:{ email:"granted", sms:"granted", voice:"granted" },
      sequence:{ step:1, total:4, label:"Speed-to-lead", status:"failed" },
      sla:{ min:24, level:"bad" },
      intel:{ fit:"warm", time_on_site:"1m 40s", pages:2, first_seen:"30 min ago", speed_to_lead_h:0.4, cost_per_lead:12.9, src_label:"Meta · Lead form", site_status:"live", pages_viewed:["/painter-leads/"] },
      deal:null,
      messages:[
        { dir:"out", channel:"sms", body:"Hi Sandra, Andy at Consent Resolve…", ts:"24 min ago", meta:"failed · 30006 landline" },
        { dir:"system", body:"⚠ SMS delivery failed (landline). Sequence paused — try email or call the number on file.", ts:"24 min ago" } ] },

    { id:"c03", bucket:"open", source:"chatwoot", channel:"chatwoot", name:null, company:null,
      contact_email:null, initials:"?", lifecycle:"Lead", hot:false, unread:true, ts:"just now",
      task:{ tag:"do", text:"Answer the chat — “do you work with garage door companies?” (yes, we do)", cta:"Answer" },
      last:{ label:"New site chat", ts:"just now", tone:"info" },
      next:{ kind:"you", label:"Answer his question", when:"now", tone:"act" },
      consent:{ email:"none", sms:"none", voice:"none" },
      sequence:{ step:0, total:0, label:"—", status:"none" },
      sla:{ min:1, level:"warn" },
      intel:{ fit:"warm", time_on_site:"1m 30s", pages:3, first_seen:"3 min ago", speed_to_lead_h:null, cost_per_lead:null, src_label:"Chatwoot · site chat", site_status:"—", pages_viewed:["/garage-door-leads/","/pricing/"] },
      deal:null,
      messages:[ { dir:"in", channel:"chatwoot", body:"do you work with garage door companies?", ts:"just now" } ] },

    { id:"c13", bucket:"open", source:"site", channel:"sms", name:"Leah Cho", company:"Cho Landscaping",
      contact_email:"leah@cholandscaping.com", initials:"LC", lifecycle:"Opportunity", hot:true, unread:true, ts:"12 min ago",
      task:{ tag:"do", text:"Confirm & prep — she booked the 2:00 PM demo.", cta:"Open deal" },
      last:{ label:"Leah booked the 2:00 PM demo", ts:"12 min ago", tone:"good" },
      next:{ kind:"you", label:"Confirm & prep the demo", when:"before 2:00 PM", tone:"act" },
      consent:{ email:"granted", sms:"granted", voice:"granted" },
      sequence:{ step:2, total:4, label:"Speed-to-lead", status:"booked" },
      sla:{ min:12, level:"none" },
      intel:{ fit:"hot", time_on_site:"6m", pages:9, first_seen:"1 hr ago", speed_to_lead_h:0.1, cost_per_lead:null, src_label:"Site · demo signup", site_status:"live", pages_viewed:["/lawn-care-leads/","/get-started/"] },
      deal:{ title:"Cho Landscaping", value_usd:0, prob:88 },
      messages:[
        { dir:"out", channel:"sms", body:"Hi Leah! Andy at Consent Resolve — grab any time here to see it on your site: [link] (STOP to opt out)", ts:"20 min ago", meta:"delivered" },
        { dir:"in", channel:"sms", body:"booked the 2pm, thanks!", ts:"12 min ago" },
        { dir:"system", body:"🎉 Goal: booked. Sequence exited, deal moved to 76–99%.", ts:"12 min ago" } ] },

    { id:"c10", bucket:"open", source:"manual", channel:"email", name:"Unknown", company:null,
      contact_email:"jsmith88@gmail.com", initials:"?", lifecycle:"Lead", hot:false, unread:true, ts:"3 hr ago",
      email_subject:"Re: your ad — the $7 thing",
      task:{ tag:"do", text:"Reply & qualify — get his name + company, then explain the $7 model.", cta:"Reply" },
      last:{ label:"New email — no name/company matched", ts:"3 hr ago", tone:"info" },
      next:{ kind:"you", label:"Reply & qualify", when:"today", tone:"act" },
      consent:{ email:"granted", sms:"none", voice:"none" },
      sequence:{ step:0, total:0, label:"—", status:"none" },
      sla:{ min:180, level:"none" },
      intel:{ fit:"unknown", time_on_site:"—", pages:0, first_seen:"3 hr ago", speed_to_lead_h:null, cost_per_lead:null, src_label:"Manual · forwarded", site_status:"—", pages_viewed:[] },
      deal:null,
      messages:[ { dir:"in", channel:"email", subject:"your ad — the $7 thing", body:"hey saw your ad, what's the catch on the $7 thing", ts:"3 hr ago" } ] },

    { id:"c09", bucket:"open", source:"site", channel:"email", name:"David Hendersen", company:"Hendersen Construction",
      contact_email:"david@hendersenconstruction.com", initials:"DH", lifecycle:"Opportunity", hot:false, unread:true, ts:"yesterday",
      email_subject:"Re: volume pricing for 3 locations",
      task:{ tag:"do", text:"Reply — he wants a volume rate across 3 offices.", cta:"Reply" },
      last:{ label:"David replied — asked for volume pricing", ts:"yesterday", tone:"good" },
      next:{ kind:"you", label:"Send a 3-location volume rate", when:"today", tone:"act" },
      consent:{ email:"granted", sms:"none", voice:"none" },
      sequence:{ step:4, total:4, label:"Nurture", status:"active" },
      sla:{ min:900, level:"none" },
      intel:{ fit:"hot", time_on_site:"22m", pages:30, first_seen:"3 weeks ago", speed_to_lead_h:0.5, cost_per_lead:null, src_label:"Site · organic", site_status:"live · has form", pages_viewed:["/general-contractor-leads/","/pricing/","/compare/"] },
      deal:{ title:"Hendersen Construction — 3 locations", value_usd:6400, prob:63 },
      messages:[
        { dir:"out", channel:"email", subject:"Volume pricing for 3 locations", body:"Here's the breakdown for a single location — $7 per exclusive lead, no minimum, no reselling. Happy to talk multi-site whenever you're ready.", ts:"2 days ago", meta:"opened" },
        { dir:"in", channel:"email", subject:"Re: Volume pricing for 3 locations", body:"Following up — can you do a volume rate across our three offices?", ts:"yesterday" } ] },

    /* ============ AUTO — running a sequence, no human needed ============ */
    { id:"c01", bucket:"auto", source:"meta", channel:"sms", name:"Marcus Whitfield", company:"Whitfield Heating & Air",
      contact_email:"marcus@whitfieldheating.com", initials:"MW", lifecycle:"SQL", hot:true, unread:false, ts:"2 min ago",
      last:{ label:"SMS delivered", ts:"8 min ago", tone:"good" },
      next:{ kind:"auto", label:"AI call (Retell)", when:"in 4 min", tone:"info" },
      consent:{ email:"granted", sms:"granted", voice:"granted" },
      sequence:{ step:1, total:4, label:"Speed-to-lead", status:"active" },
      sla:{ min:6, level:"none" },
      intel:{ fit:"hot", time_on_site:"4m 12s", pages:7, first_seen:"9 min ago", speed_to_lead_h:0.1, cost_per_lead:12.9, src_label:"Meta · Lead form (HVAC)", site_status:"live · no capture", pages_viewed:["/hvac-leads/","/pricing/","/how-it-works/","/sample-lead/"] },
      deal:null,
      messages:[
        { dir:"system", body:"Lead created from Meta Lead Form “Exclusive HVAC Leads”.", ts:"9 min ago" },
        { dir:"system", body:"🔍 Website intel — live site, no lead-capture form, no chat. Fit: HOT. Pitch angle: they're paying for traffic and catching none of it.", ts:"9 min ago" },
        { dir:"out", channel:"sms", body:"Hi Marcus, it's Andy at Consent Resolve — saw you grabbed our HVAC info. We turn the visitors your site already gets into real leads, $7 each. Want the 2-min version? (Reply STOP to opt out)", ts:"8 min ago", meta:"delivered" } ] },

    { id:"c06", bucket:"auto", source:"meta", channel:"ai_call", name:"Gloria Bennett", company:"Bennett Home Services",
      contact_email:"gloria@bennetthome.com", initials:"GB", lifecycle:"MQL", hot:false, unread:false, ts:"18 min ago",
      last:{ label:"AI call → voicemail", ts:"18 min ago", tone:"info" },
      next:{ kind:"auto", label:"Email (call not answered)", when:"in 2 min", tone:"info" },
      consent:{ email:"granted", sms:"granted", voice:"granted" },
      sequence:{ step:3, total:4, label:"Speed-to-lead", status:"voicemail" },
      sla:{ min:18, level:"none" },
      intel:{ fit:"warm", time_on_site:"2m 10s", pages:4, first_seen:"40 min ago", speed_to_lead_h:0.3, cost_per_lead:12.9, src_label:"Meta · Lead form", site_status:"live", pages_viewed:["/handyman-leads/"] },
      deal:null,
      messages:[
        { dir:"out", channel:"sms", body:"Hi Gloria, Andy here — saw you were checking us out. Quick question when you have a sec. (STOP to opt out)", ts:"35 min ago", meta:"delivered" },
        { dir:"out", channel:"ai_call", body:"AI call placed (23s). AMD: voicemail. VM left: “Hi Gloria, this is the Consent Resolve team — this is an AI assistant — call or text us at (727) 999-9846.”", ts:"18 min ago", meta:"voicemail" } ] },

    { id:"c02", bucket:"auto", source:"instantly", channel:"email", name:"Dana Reyes", company:"Reyes Plumbing Co.",
      contact_email:"dana@reyesplumbing.com", initials:"DR", lifecycle:"Lead", hot:false, unread:false, ts:"1 day ago",
      email_subject:"The visitors your site is losing",
      last:{ label:"Email 2 sent", ts:"1 day ago", tone:"info" },
      next:{ kind:"auto", label:"Email 3 → preference center", when:"tomorrow", tone:"info" },
      consent:{ email:"granted", sms:"none", voice:"none" },
      sequence:{ step:2, total:3, label:"Earn consent (email only)", status:"earn_consent" },
      sla:{ min:31, level:"none" },
      intel:{ fit:"warm", time_on_site:"—", pages:0, first_seen:"cold list", speed_to_lead_h:null, cost_per_lead:null, src_label:"Instantly · HVAC US v2", site_status:"unknown", pages_viewed:[] },
      deal:null,
      messages:[
        { dir:"out", channel:"email", subject:"The visitors your site is losing", body:"Quick one — most plumbing sites lose the majority of the folks they pay to bring in. We hand the ones who opt in back to you, $7 each, never resold. Worth a look?", ts:"3 days ago", meta:"opened" },
        { dir:"out", channel:"email", subject:"Re: The visitors your site is losing", body:"Circling back — if it's useful, I can show it on your own site. No pressure either way.", ts:"1 day ago", meta:"sent" } ] },

    { id:"c12", bucket:"auto", source:"meta", channel:"email", name:"Owen Frost", company:"Frost Appliance Repair",
      contact_email:"owen@frostappliance.com", initials:"OF", lifecycle:"Lead", hot:false, unread:false, ts:"44 min ago",
      email_subject:"Can we keep emailing you?",
      last:{ label:"Routed to earn-consent (no PEWC on form)", ts:"44 min ago", tone:"info" },
      next:{ kind:"auto", label:"Email → preference center", when:"in 1 hr", tone:"info" },
      consent:{ email:"granted", sms:"none", voice:"none" },
      sequence:{ step:1, total:3, label:"Earn consent (email only)", status:"earn_consent" },
      sla:{ min:44, level:"none" },
      intel:{ fit:"warm", time_on_site:"2m", pages:3, first_seen:"50 min ago", speed_to_lead_h:0.2, cost_per_lead:12.9, src_label:"Meta · Lead form (no PEWC)", site_status:"live", pages_viewed:["/appliance-repair-leads/"] },
      deal:null,
      messages:[ { dir:"system", body:"Lead form did not capture SMS/voice consent — routed to email-only earn-consent branch.", ts:"44 min ago" } ] },

    { id:"c04", bucket:"auto", source:"demo", channel:"email", name:"Priya Nair", company:"Nair Electric",
      contact_email:"priya@nairelectric.com", initials:"PN", lifecycle:"MQL", hot:false, unread:false, ts:"1 hr ago",
      email_subject:"Welcome to Consent Resolve — one step to go live",
      last:{ label:"Welcome email opened", ts:"58 min ago", tone:"good" },
      next:{ kind:"auto", label:"Install reminder + concierge offer", when:"tomorrow", tone:"info" },
      consent:{ email:"granted", sms:"granted", voice:"none" },
      sequence:{ step:1, total:3, label:"Onboarding → activation", status:"onboarding" },
      sla:{ min:62, level:"none" },
      intel:{ fit:"hot", time_on_site:"8m 40s", pages:11, first_seen:"yesterday", speed_to_lead_h:0.2, cost_per_lead:null, src_label:"Site · demo signup", site_status:"live · script NOT detected", pages_viewed:["/get-started/","/pricing/","/how-it-works/"] },
      deal:{ title:"Nair Electric — self-serve", value_usd:0, prob:38 },
      messages:[
        { dir:"system", body:"Signed up via /get-started. PEWC checkbox: checked (email + SMS).", ts:"1 hr ago" },
        { dir:"out", channel:"email", subject:"Welcome to Consent Resolve — one step to go live", body:"Welcome! One step to go live: drop this line on your site. Want us to install it for you? Reply and we'll hop on a 10-min call.", ts:"58 min ago", meta:"opened" } ] },

    /* ============ SNOOZED ============ */
    { id:"c14", bucket:"snoozed", source:"instantly", channel:"email", name:"Hector Alvarez", company:"Alvarez Pest Control",
      contact_email:"hector@alvarezpest.com", initials:"HA", lifecycle:"Lead", hot:false, unread:false, ts:"snoozed · 5 days",
      email_subject:"Re: circling back next week",
      last:{ label:"Hector asked to circle back", ts:"2 days ago", tone:"info" },
      next:{ kind:"snoozed", label:"Wakes back into Open", when:"in 5 days", tone:"info" },
      consent:{ email:"granted", sms:"none", voice:"none" },
      sequence:{ step:3, total:3, label:"Earn consent (email only)", status:"earn_consent" },
      sla:{ min:0, level:"none" },
      intel:{ fit:"warm", time_on_site:"—", pages:0, first_seen:"cold list", speed_to_lead_h:null, cost_per_lead:null, src_label:"Instantly · HVAC US v2", site_status:"unknown", pages_viewed:[] },
      deal:null,
      messages:[ { dir:"in", channel:"email", subject:"circling back next week", body:"not now, circle back next week", ts:"2 days ago" } ] },

    /* ============ SUPPRESSED — appear only in All (no action possible) ============ */
    { id:"c07", bucket:"suppressed", source:"instantly", channel:"sms", name:"Rick Osborne", company:"Osborne Mechanical",
      contact_email:"rick@osbornemech.com", initials:"RO", lifecycle:"Lead", hot:false, unread:false, ts:"2 hr ago",
      last:{ label:"Rick replied STOP — opted out", ts:"2 hr ago", tone:"bad" },
      next:{ kind:"none", label:"No outreach — email only if he initiates", when:"—", tone:"muted" },
      consent:{ email:"granted", sms:"revoked", voice:"revoked" },
      sequence:{ step:2, total:4, label:"Speed-to-lead", status:"opted_out" },
      sla:{ min:0, level:"none" },
      intel:{ fit:"cold", time_on_site:"—", pages:0, first_seen:"cold list", speed_to_lead_h:null, cost_per_lead:null, src_label:"Instantly · HVAC US v2", site_status:"unknown", pages_viewed:[] },
      deal:null,
      messages:[
        { dir:"out", channel:"sms", body:"Hi Rick, Andy at Consent Resolve — want to see who's visiting your site? (STOP to opt out)", ts:"2 hr ago", meta:"delivered" },
        { dir:"in", channel:"sms", body:"STOP", ts:"2 hr ago", meta:"suppressed" },
        { dir:"system", body:"⛔ SMS + voice suppressed. Revocation recorded to the consent ledger.", ts:"2 hr ago" } ] },

    { id:"c11", bucket:"suppressed", source:"apollo", channel:"identified", name:"Karen Duval", company:"Duval Comfort Systems",
      contact_email:null, initials:"KD", lifecycle:"Lead", hot:false, unread:false, ts:"5 hr ago",
      last:{ label:"Identified via Leadsy (no consent)", ts:"5 hr ago", tone:"muted" },
      next:{ kind:"none", label:"Outreach disabled — retargeting only", when:"—", tone:"muted" },
      consent:{ email:"na", sms:"na", voice:"na" },
      sequence:{ step:0, total:0, label:"—", status:"blocked" },
      sla:{ min:0, level:"none" },
      intel:{ fit:"warm", time_on_site:"5m 20s", pages:6, first_seen:"5 hr ago", speed_to_lead_h:null, cost_per_lead:null, src_label:"Apollo/Leadsy · identified", site_status:"live", pages_viewed:["/hvac-leads/","/pricing/","/faq/"] },
      deal:null,
      messages:[ { dir:"system", body:"⛓ Visitor identified via Leadsy — NO consent to contact. Available for retargeting audiences + context only. Outreach actions are disabled.", ts:"5 hr ago" } ] }
  ]
};

/* Auto-enrichment — things we can look up about the business to arm the sale.
   website (live? captures leads?), Facebook (followers + ads running via the public
   Meta Ad Library), Google Business Profile, Google Ads/LSA, tracking pixels,
   estimated monthly ad spend, site traffic, size, tenure. Null = nothing matched yet. */
window.ENRICH = {
  c01:{website:{domain:"whitfieldheating.com",live:true,capture:false},facebook:{handle:"WhitfieldHeatingAir",followers:1800,ads_live:4},gmb:{rating:4.7,reviews:96,verified:true},ads:{google:true,lsa:true},pixels:["Meta","GA4"],spend_low:2400,spend_high:3200,spend_channels:["Meta","Google","LSA"],traffic_month:3100,employees:"10–25",years:14,signal:"Advertising on 3 channels but the site captures nothing — paying for traffic they can't catch."},
  c05:{website:{domain:"langroofing.com",live:true,capture:true},facebook:{handle:"LangRoofingTX",followers:2400,ads_live:2},gmb:{rating:4.5,reviews:128,verified:true},ads:{google:true,lsa:false},pixels:["Meta"],spend_low:1800,spend_high:2400,spend_channels:["Meta","Google"],traffic_month:2600,employees:"10–25",years:9,signal:"Has a form but still loses most visitors — sell the exclusive-lead upgrade."},
  c06:{website:{domain:"bennetthome.com",live:true,capture:false},facebook:{handle:"BennettHomeSvc",followers:900,ads_live:1},gmb:{rating:4.2,reviews:54,verified:true},ads:{google:false,lsa:true},pixels:["GA4"],spend_low:900,spend_high:1400,spend_channels:["Meta","LSA"],traffic_month:1400,employees:"3–10",years:6,signal:"Running LSA + a Meta ad, no capture on site — easy quick win."},
  c08:{website:{domain:"colesandsons.com",live:true,capture:false},facebook:{handle:"ColeAndSonsPainting",followers:620,ads_live:0},gmb:{rating:4.8,reviews:41,verified:true},ads:{google:false,lsa:false},pixels:[],spend_low:0,spend_high:0,spend_channels:[],traffic_month:700,employees:"3–10",years:11,signal:"Great reviews, not advertising yet — 'try it on the traffic you already get'."},
  c12:{website:{domain:"frostappliance.com",live:true,capture:false},facebook:{handle:"FrostApplianceRepair",followers:1100,ads_live:2},gmb:{rating:4.4,reviews:73,verified:true},ads:{google:true,lsa:false},pixels:["Meta"],spend_low:1200,spend_high:1700,spend_channels:["Meta","Google"],traffic_month:1900,employees:"3–10",years:8,signal:"Actively advertising, no lead capture — classic fit."},
  c02:{website:{domain:"reyesplumbing.com",live:true,capture:false},facebook:{handle:"ReyesPlumbingCo",followers:1500,ads_live:0},gmb:{rating:4.3,reviews:88,verified:true},ads:{google:false,lsa:false},pixels:["GA4"],spend_low:0,spend_high:0,spend_channels:[],traffic_month:1600,employees:"10–25",years:15,signal:"Established, strong reviews, not advertising — warm outbound fit."},
  c09:{website:{domain:"hendersenconstruction.com",live:true,capture:true},facebook:{handle:"HendersenConstruction",followers:5100,ads_live:5},gmb:{rating:4.6,reviews:210,verified:true},ads:{google:true,lsa:false},pixels:["Meta","GA4"],spend_low:4200,spend_high:6000,spend_channels:["Meta","Google"],traffic_month:8200,employees:"50+",years:20,signal:"3-location GC with heavy spend — high-value, multi-site expansion."},
  c11:{website:{domain:"duvalcomfort.com",live:true,capture:false},facebook:{handle:"DuvalComfortSystems",followers:1300,ads_live:3},gmb:{rating:4.5,reviews:67,verified:true},ads:{google:true,lsa:true},pixels:["Meta","GA4"],spend_low:2000,spend_high:2800,spend_channels:["Meta","Google","LSA"],traffic_month:2400,employees:"10–25",years:10,signal:"Identified from our own traffic — advertising hard, no capture. Retarget + reach a warm channel."},
  c04:{website:{domain:"nairelectric.com",live:true,capture:false},facebook:{handle:"NairElectric",followers:800,ads_live:1},gmb:{rating:4.9,reviews:38,verified:true},ads:{google:false,lsa:true},pixels:["Meta","GA4"],spend_low:600,spend_high:1000,spend_channels:["LSA"],traffic_month:1100,employees:"3–10",years:5,signal:"Signed up but script not installed — get them live to start catching the traffic they pay for."},
  c13:{website:{domain:"cholandscaping.com",live:true,capture:true},facebook:{handle:"ChoLandscaping",followers:1700,ads_live:2},gmb:{rating:4.7,reviews:59,verified:true},ads:{google:true,lsa:false},pixels:["Meta"],spend_low:1000,spend_high:1500,spend_channels:["Meta","Google"],traffic_month:1500,employees:"3–10",years:7,signal:"Booked — confirm fit and get the pixel live before the demo."},
  c07:{website:{domain:"osbornemech.com",live:true,capture:false},facebook:null,gmb:{rating:4.0,reviews:22,verified:false},ads:{google:false,lsa:false},pixels:[],spend_low:0,spend_high:0,spend_channels:[],traffic_month:600,employees:"1–3",years:4,signal:null},
  c14:{website:{domain:"alvarezpest.com",live:true,capture:false},facebook:{handle:"AlvarezPestControl",followers:700,ads_live:0},gmb:{rating:4.4,reviews:49,verified:true},ads:{google:false,lsa:false},pixels:["GA4"],spend_low:0,spend_high:0,spend_channels:[],traffic_month:900,employees:"3–10",years:8,signal:null}
  /* c03 (anonymous chat) + c10 (free email, no company) = nothing to match on → no card */
};

/* Discoverable directory data for the Tasks lookups (address + social handles).
   Present = an auto-lookup can find it; absent = the rep enters it manually.
   Website + Facebook already come from ENRICH (captured at lead time). */
window.DIRECTORY = {
  c01:{address:"482 Industrial Blvd, Tampa, FL 33601",linkedin:"whitfield-heating-air",instagram:"whitfieldhvac",tiktok:"whitfieldhvac"},
  c05:{address:"1907 Prospect Rd, Austin, TX 78704",linkedin:"lang-roofing",instagram:"langroofingtx",tiktok:"langroofs"},
  c06:{address:"77 Maple Ave, Ocala, FL 34470",linkedin:"bennett-home-services",instagram:"bennetthome"},
  c08:{address:"310 Bayshore Blvd, Tampa, FL 33606",instagram:"coleandsonspainting"},
  c09:{address:"5000 Post Oak Blvd, Beaumont, TX 77706",linkedin:"hendersen-construction",instagram:"hendersenbuilds",tiktok:"hendersenbuilds"},
  c02:{address:"24 Alamo Plaza, San Antonio, TX 78205",linkedin:"reyes-plumbing-co",instagram:"reyesplumbing"},
  c12:{address:"88 Frost Ln, Tampa, FL 33607",instagram:"frostappliancerepair",tiktok:"frostfixes"},
  c04:{address:"12 Sparks Dr, Deltona, FL 32725",linkedin:"nair-electric",instagram:"nairelectric"},
  c13:{address:"640 Green St, San Marcos, TX 78666",instagram:"cholandscaping",tiktok:"choscapes"},
  c11:{address:"915 Cooling Way, Jacksonville, FL 32202",linkedin:"duval-comfort-systems",instagram:"duvalcomfort"},
  c07:{address:"5 Old Mill Rd, Houston, TX 77002"},
  c14:{address:"300 Border Ave, Laredo, TX 78040",instagram:"alvarezpest"}
};

/* ========================================================================
   SEQUENCES — the automated workflows, with step-level conversion stats.
   Each step: entered N, then outcome lines. Numbers are last-30-days totals. */
window.SEQUENCES = [
  { id:"speed", name:"Speed-to-lead", trigger:"New paid lead with SMS + voice consent (PEWC captured)",
    goal:"Book the demo", consent:["sms","voice","email"], active:12,
    enrolled:214, replyRate:0.32, goalRate:0.14, optoutRate:0.05,
    steps:[
      { ch:"sms", label:"SMS — first touch", timing:"Immediately", entered:214,
        out:[{t:"Delivered",n:206},{t:"Replied → exit",n:38,tone:"good"},{t:"No reply → continue",n:176,tone:"muted"}] },
      { ch:"ai_call", label:"AI call (Retell)", timing:"+5 min if no reply", branch:"Answering-machine detection splits the path",
        entered:176, out:[{t:"Answered live",n:41,tone:"accent"},{t:"Booked on call",n:22,tone:"good"},{t:"Voicemail → email branch",n:135,tone:"muted"}] },
      { ch:"email", label:"Email — recap + link", timing:"+30 min / right after voicemail", entered:135,
        out:[{t:"Opened",n:74},{t:"Replied → exit",n:19,tone:"good"},{t:"No reply → continue",n:96,tone:"muted"}] },
      { ch:"sms", label:"Next-day SMS", timing:"+1 day if still cold", entered:96,
        out:[{t:"Replied → exit",n:11,tone:"good"},{t:"Sequence ends",n:85,tone:"muted"}] }
    ]},
  { id:"earn", name:"Earn consent (email only)", trigger:"Lead with email only — no PEWC (cold list / Instantly)",
    goal:"Opt in to SMS + voice", consent:["email"], active:31,
    enrolled:642, replyRate:0.055, goalRate:0.06, optoutRate:0.02,
    steps:[
      { ch:"email", label:"Email 1 — the leak", timing:"Immediately", entered:642,
        out:[{t:"Opened",n:263},{t:"Replied",n:24,tone:"good"},{t:"Continue",n:618,tone:"muted"}] },
      { ch:"email", label:"Email 2 — proof + sample lead", timing:"+2 days", entered:618,
        out:[{t:"Opened",n:204},{t:"Replied",n:11,tone:"good"},{t:"Continue",n:607,tone:"muted"}] },
      { ch:"email", label:"Preference center", timing:"+4 days", entered:607,
        out:[{t:"Opted in to SMS/voice",n:38,tone:"good"},{t:"No response",n:569,tone:"muted"}] }
    ]},
  { id:"onboard", name:"Onboarding → activation", trigger:"Demo signup via /get-started (PEWC checked)",
    goal:"Script live + first captured lead", consent:["email","sms"], active:6,
    enrolled:37, replyRate:0.49, goalRate:0.43, optoutRate:0,
    steps:[
      { ch:"email", label:"Welcome + install snippet", timing:"Immediately", entered:37,
        out:[{t:"Opened",n:32},{t:"Installed script",n:12,tone:"good"},{t:"Not live yet",n:25,tone:"muted"}] },
      { ch:"sms", label:"Install reminder + concierge", timing:"+1 day if not live", entered:25,
        out:[{t:"Replied",n:14,tone:"good"},{t:"Booked concierge call",n:8,tone:"accent"}] },
      { ch:"email", label:"Activated", timing:"On first captured lead", entered:20,
        out:[{t:"Activated 🎉",n:16,tone:"good"}] }
    ]}
];

/* ========================================================================
   ANALYTICS — Command Center aggregates (last 30 days). Kept internally
   consistent: source rows sum to the KPI totals; spend is real ad spend. */
window.ANALYTICS = {
  kpis:{ leads:308, replies:68, demos:29, activations:11, spend:3300, cpl:10.71, cpd:114, pipeline:2156 },
  funnel:[ {k:"Leads",n:308},{k:"Contacted",n:296},{k:"Replied",n:68},{k:"Demo booked",n:29},{k:"Activated",n:11} ],
  sources:[
    { src:"meta",     leads:132, reply:0.28, demos:15, act:6, spend:1700 },
    { src:"instantly",leads:96,  reply:0.05, demos:2,  act:0, spend:0    },
    { src:"site",     leads:41,  reply:0.44, demos:8,  act:4, spend:1600 },
    { src:"apollo",   leads:22,  reply:0.00, demos:0,  act:0, spend:0    },
    { src:"chatwoot", leads:11,  reply:0.55, demos:3,  act:1, spend:0    },
    { src:"manual",   leads:6,   reply:0.33, demos:1,  act:0, spend:0    }
  ],
  spendByChannel:[ {k:"Meta",v:1700},{k:"Google",v:1100},{k:"LSA",v:500} ],
  leadsByDay:[9,12,7,14,11,18,10,15,13,9,16,12,8,14,11,17,13,10,15,12,9,14,16,11,8,13,10,15,12,9],
  avgDealYr:2340  /* assumed annual value per activation, for est. ROAS only */
};

/* ========================================================================
   CONSENT LEDGER — every grant/revoke, with the proof behind it.
   This is the auditable record that makes each send defensible (TCPA/CIPA). */
window.CONSENT_LEDGER = [
  { ts:"Today · 9:14 AM", name:"Marcus Whitfield", co:"Whitfield Heating & Air", ch:["email","sms","voice"], action:"granted",
    basis:"Meta Lead Form — PEWC checkbox", form:"“Exclusive HVAC Leads”", ip:"98.6.204.11",
    proof:"By submitting, I agree to receive automated marketing calls & texts from Consent Resolve at the number provided. Consent is not a condition of purchase. Msg & data rates may apply. Reply STOP to opt out." },
  { ts:"Today · 8:40 AM", name:"Priya Nair", co:"Nair Electric", ch:["email","sms"], action:"granted",
    basis:"/get-started signup — PEWC checkbox", form:"Demo signup", ip:"172.58.19.240",
    proof:"I agree to receive account and marketing emails and texts from Consent Resolve. I can opt out any time via the link in any message or by replying STOP." },
  { ts:"44 min ago", name:"Owen Frost", co:"Frost Appliance Repair", ch:["email"], action:"granted",
    basis:"Meta Lead Form — email only (no phone consent captured)", form:"“Appliance Repair” (no PEWC)", ip:"66.87.125.9",
    proof:"Form captured email opt-in only. No SMS/voice consent language was present — routed to the email-only earn-consent branch." },
  { ts:"2 hr ago", name:"Rick Osborne", co:"Osborne Mechanical", ch:["sms","voice"], action:"revoked",
    basis:"Inbound “STOP” keyword", form:"SMS reply", ip:"",
    proof:"Inbound SMS: “STOP”. SMS + voice auto-suppressed at 2:03 PM; email consent retained. Suppression is permanent unless the contact re-subscribes." },
  { ts:"3 hr ago", name:"Dana Reyes", co:"Reyes Plumbing Co.", ch:["email"], action:"granted",
    basis:"Cold list — legitimate-interest email (CAN-SPAM)", form:"Instantly · HVAC US v2", ip:"",
    proof:"B2B cold email under CAN-SPAM: physical address + one-click unsubscribe present. No SMS/voice contact permitted until they opt in via the preference center." },
  { ts:"Yesterday", name:"Leah Cho", co:"Cho Landscaping", ch:["email","sms","voice"], action:"granted",
    basis:"/get-started signup — PEWC checkbox", form:"Demo signup", ip:"70.114.30.5",
    proof:"Full opt-in captured at signup; booked a demo the same day." },
  { ts:"Yesterday", name:"Sandra Cole", co:"Cole & Sons Painting", ch:["email","sms","voice"], action:"granted",
    basis:"Meta Lead Form — PEWC checkbox", form:"“Painter Leads”", ip:"104.28.7.62",
    proof:"Consent captured, but the number is a landline — SMS failed (carrier 30006). Voice + email still permitted." },
  { ts:"2 days ago", name:"Karen Duval", co:"Duval Comfort Systems", ch:["email","sms","voice"], action:"none",
    basis:"Identified via Leadsy — NO consent to contact", form:"Anonymous site visitor (de-anonymized)", ip:"",
    proof:"Company identified from first-party traffic. There is no consent of any kind — this contact is available for retargeting audiences and context only. All outreach is disabled." },
  { ts:"2 days ago", name:"Hector Alvarez", co:"Alvarez Pest Control", ch:["email"], action:"granted",
    basis:"Cold list — legitimate-interest email (CAN-SPAM)", form:"Instantly · HVAC US v2", ip:"",
    proof:"Email-only, CAN-SPAM compliant. Asked to circle back next week — snoozed, no SMS/voice permitted." },
  { ts:"3 days ago", name:"Tomas Lang", co:"Lang Roofing", ch:["email","sms","voice"], action:"granted",
    basis:"Meta Lead Form — PEWC checkbox", form:"“Roofing Leads Q3”", ip:"45.21.88.140",
    proof:"Full opt-in; replied to the first SMS asking how it works." }
];

/* ========================================================================
   INTEL — the company-intelligence layer for the Intel dashboard.
   In production these fields are populated by 3rd-party enrichment
   (BuiltWith/Wappalyzer for tech, Meta Ad Library for ads, Google Business
   for reputation, traffic estimators) + an AI-written research brief. */
window.INTEL = {
  c01:{trade:"HVAC",tech:["WordPress","PHP","GA4","Meta Pixel","Cloudflare","reCAPTCHA"],chat:false,
    brief:"Established HVAC shop running paid traffic across Meta, Google and LSA to a WordPress site with no lead-capture form and no chat. They're paying to bring homeowners in and catching almost none — the clearest possible fit for consent-first recovery."},
  c05:{trade:"Roofing",tech:["WordPress","Gravity Forms","Meta Pixel","GA4"],chat:false,
    brief:"Roofing company advertising on Meta + Google with a form on-site that catches only a sliver of visitors. Strong 4.5★ reputation. Angle: recover the 98% who never fill the form as exclusive leads."},
  c06:{trade:"Handyman",tech:["Wix","GA4"],chat:false,
    brief:"Home-services shop running Google Local Services Ads plus a Meta ad, no capture on a lightly-tracked site. Small but active advertiser — an easy quick win."},
  c08:{trade:"Painting",tech:["Squarespace","Squarespace Analytics"],chat:false,
    brief:"Painters with an excellent 4.8★ reputation but no ad spend and no tracking. Organic-first pitch: prove recovery on the traffic they already earn before they scale ads."},
  c09:{trade:"General contractor",tech:["WordPress","HubSpot Forms","Meta Pixel","GA4","Cloudflare"],chat:true,
    brief:"Multi-location GC with the heaviest spend in the pipeline (~$4–6k/mo across Meta + Google) and a form-equipped site. High-value, multi-site expansion play."},
  c02:{trade:"Plumbing",tech:["WordPress","GA4"],chat:false,
    brief:"Established plumber with strong reviews, not currently advertising. Warm-outbound fit — email-only until they opt in to calls and texts."},
  c12:{trade:"Appliance repair",tech:["WordPress","Meta Pixel","GA4"],chat:false,
    brief:"Appliance-repair shop actively advertising on Meta + Google with a Meta Pixel but no lead capture. Textbook 'paying for traffic, catching none' fit."},
  c04:{trade:"Electrical",tech:["Wix","Meta Pixel","GA4"],chat:false,
    brief:"Electrician who signed up for a trial but hasn't installed the script yet. 4.9★ reputation, running LSA. Priority: get them live to start catching the traffic they already pay for."},
  c13:{trade:"Landscaping",tech:["WordPress","Gravity Forms","Meta Pixel"],chat:false,
    brief:"Lawn-care company that booked a demo, advertising on Meta + Google with a form on-site. Confirm fit and get the pixel live before the demo."},
  c11:{trade:"HVAC",tech:["WordPress","Meta Pixel","GA4"],chat:false,
    brief:"Identified from our own first-party traffic (no consent yet). Advertising hard on three channels with no capture — retarget and reach out via a warm channel."},
  c07:{trade:"Mechanical",tech:["GoDaddy Website Builder"],chat:false,
    brief:"Small mechanical shop, no advertising, thin reputation. Opted out of SMS/voice — email only if they re-engage."},
  c14:{trade:"Pest control",tech:["Wix","GA4"],chat:false,
    brief:"Pest-control shop with decent reviews, not advertising. Snoozed — email-only, circle back next week."}
};

/* ===== Nurture pool — dormant leads on long-term auto follow-up =====
   They keep getting low-frequency email+SMS touches but we ignore them until
   they show intent (link click or site visit); then a fast re-engage sequence
   fires and they surface back into the Inbox. */
window.NURTURE = {
  stats: { total:148, added7:6, cadence:137, reengaging:4, wonBack:11, next7:42 },
  /* just tripped an intent signal → re-engage sequence auto-firing right now */
  reengaging: [
    { name:"Priya Nair", company:"Nair Electric", source:"instantly", channels:["email","sms"],
      signal:{kind:"visit", text:"Came back to the site · viewed /pricing", when:"2h ago"},
      seq:{step:2, of:3, done:"SMS sent 1h ago", next:"Email in 3h"}, dormant:58 },
    { name:"Owen Frost", company:"Frost Appliance Repair", source:"site", channels:["email"],
      signal:{kind:"click", text:"Clicked the link in our monthly email", when:"5h ago"},
      seq:{step:1, of:3, done:"Follow-up email sent", next:"SMS tomorrow 9am"}, dormant:44 },
    { name:"Dana Reyes", company:"Reyes Plumbing Co.", source:"apollo", channels:["email"],
      signal:{kind:"visit", text:"Returned to site · 3 pages in one session", when:"yesterday"},
      seq:{step:3, of:3, done:"Book-a-demo email sent", next:"Hand off to Inbox"}, dormant:96 },
    { name:"Marcus Whitfield", company:"Whitfield Heating & Air", source:"meta", channels:["email","sms"],
      signal:{kind:"click", text:"Tapped the link in an SMS touch", when:"1d ago"},
      seq:{step:2, of:3, done:"Email sent 20h ago", next:"SMS in 2d"}, dormant:33 }
  ],
  /* the long-term pool — grows over time; status: dormant | recovered */
  pool: [
    {name:"Karen Duval", company:"Duval Comfort Systems", source:"meta", channels:["email","sms"], cadence:"Monthly", last:"22d ago", next:"in 8d", opens:4, clicks:1, visits:0, dormant:71, status:"dormant"},
    {name:"Rick Osborne", company:"Osborne Mechanical", source:"instantly", channels:["email"], cadence:"Monthly", last:"18d ago", next:"in 12d", opens:2, clicks:0, visits:0, dormant:54, status:"dormant"},
    {name:"Gloria Bennett", company:"Bennett Home Services", source:"site", channels:["email","sms"], cadence:"Bi-weekly", last:"4d ago", next:"in 10d", opens:9, clicks:2, visits:1, dormant:0, status:"recovered", note:"Booked a demo from nurture"},
    {name:"Hector Alvarez", company:"Alvarez Roofing", source:"instantly", channels:["email"], cadence:"Monthly", last:"27d ago", next:"in 3d", opens:1, clicks:0, visits:0, dormant:88, status:"dormant"},
    {name:"Sabrina Kelly", company:"Kelly Electric & Solar", source:"meta", channels:["email","sms"], cadence:"Monthly", last:"12d ago", next:"in 18d", opens:6, clicks:1, visits:0, dormant:47, status:"dormant"},
    {name:"Devon Pratt", company:"Pratt Plumbing", source:"apollo", channels:["email"], cadence:"Quarterly", last:"31d ago", next:"in 59d", opens:0, clicks:0, visits:0, dormant:124, status:"dormant"},
    {name:"Nadia Feldman", company:"Feldman Heating", source:"site", channels:["email","sms"], cadence:"Monthly", last:"9d ago", next:"in 21d", opens:5, clicks:0, visits:0, dormant:38, status:"dormant"},
    {name:"Curtis Yang", company:"Yang HVAC", source:"instantly", channels:["email"], cadence:"Monthly", last:"20d ago", next:"in 10d", opens:3, clicks:1, visits:0, dormant:63, status:"dormant"},
    {name:"Renee Solis", company:"Solis Comfort Co.", source:"meta", channels:["email","sms"], cadence:"Bi-weekly", last:"6d ago", next:"in 8d", opens:7, clicks:0, visits:0, dormant:29, status:"dormant"},
    {name:"Toby Grant", company:"Grant Mechanical", source:"apollo", channels:["email"], cadence:"Quarterly", last:"44d ago", next:"in 46d", opens:1, clicks:0, visits:0, dormant:142, status:"dormant"},
    {name:"Ana Ruiz", company:"Ruiz Roofing & Gutters", source:"site", channels:["email","sms"], cadence:"Monthly", last:"2d ago", next:"in 12d", opens:11, clicks:3, visits:2, dormant:0, status:"recovered", note:"Replied — moved to Inbox"},
    {name:"Wesley Boone", company:"Boone Electric", source:"instantly", channels:["email"], cadence:"Monthly", last:"25d ago", next:"in 5d", opens:2, clicks:0, visits:0, dormant:79, status:"dormant"},
    {name:"Lena Ostrowski", company:"Ostrowski Plumbing", source:"meta", channels:["email","sms"], cadence:"Monthly", last:"14d ago", next:"in 16d", opens:4, clicks:1, visits:0, dormant:52, status:"dormant"},
    {name:"Darius Cole", company:"Cole Heating & Air", source:"apollo", channels:["email"], cadence:"Quarterly", last:"38d ago", next:"in 52d", opens:0, clicks:0, visits:0, dormant:117, status:"dormant"},
    {name:"Fiona Mercer", company:"Mercer Home Services", source:"site", channels:["email","sms"], cadence:"Bi-weekly", last:"5d ago", next:"in 9d", opens:8, clicks:1, visits:0, dormant:34, status:"dormant"},
    {name:"Grant Whitaker", company:"Whitaker Mechanical", source:"instantly", channels:["email"], cadence:"Monthly", last:"29d ago", next:"in 1d", opens:1, clicks:0, visits:0, dormant:91, status:"dormant"}
  ]
};

/* ===== Site Spy — known visitors by last activity =====
   Who is on the site (or was recently), what they're looking at, and whether
   we're already engaging them via a sequence, automation, or human chat. */
window.SITESPY = {
  stats: { onSite:4, today:22, inWorkflow:9, netNew:5 },
  visitors: [
    /* live = on the site right now */
    { name:"Priya Nair", company:"Nair Electric", source:"instantly", live:true,
      page:"/pricing", trail:["/","/how-it-works","/pricing"], time:"4m 12s",
      eng:{seq:"Speed-to-lead · step 2", auto:true}, last:"now", lastMin:0 },
    { name:"David Hendersen", company:"Hendersen Construction", source:"site", live:true,
      page:"/industries/roofing-leads", trail:["/industries/","/industries/roofing-leads"], time:"2m 03s",
      eng:{conv:true}, last:"now", lastMin:0 },
    { name:"Tomas Lang", company:"Lang Roofing", source:"meta", live:true,
      page:"/sample-lead", trail:["/","/pricing","/sample-lead"], time:"6m 40s",
      eng:{conv:true, auto:false}, last:"now", lastMin:0 },
    { name:"Nina Brooks", company:"Brooks Plumbing", source:"apollo", live:true,
      page:"/how-it-works", trail:["/","/how-it-works"], time:"1m 20s",
      eng:{none:true}, last:"now", lastMin:0 },
    /* recent — by last activity */
    { name:"Leah Cho", company:"Cho Landscaping", source:"site", live:false,
      page:"/pricing", trail:["/","/faq","/pricing"], time:"5m 08s", pages:3,
      eng:{seq:"Onboarding → activation", auto:true}, last:"3m ago", lastMin:3 },
    { name:"Marcus Whitfield", company:"Whitfield Heating & Air", source:"meta", live:false,
      page:"/industries/hvac-leads", trail:["/","/industries/hvac-leads"], time:"2m 44s", pages:2,
      eng:{nurture:true}, last:"12m ago", lastMin:12 },
    { name:"Owen Frost", company:"Frost Appliance Repair", source:"site", live:false,
      page:"/pricing", trail:["/how-it-works","/pricing"], time:"3m 19s", pages:2,
      eng:{nurture:true}, last:"18m ago", lastMin:18 },
    { name:"Dana Reyes", company:"Reyes Plumbing Co.", source:"apollo", live:false,
      page:"/how-it-works", trail:["/","/how-it-works"], time:"1m 55s", pages:2,
      eng:{seq:"Earn consent (email only)", auto:true}, last:"26m ago", lastMin:26 },
    { name:"Sabrina Kelly", company:"Kelly Electric & Solar", source:"meta", live:false,
      page:"/faq", trail:["/","/pricing","/faq"], time:"4m 02s", pages:3,
      eng:{none:true}, last:"40m ago", lastMin:40 },
    { name:"Gloria Bennett", company:"Bennett Home Services", source:"meta", live:false,
      page:"/sample-lead", trail:["/","/how-it-works","/sample-lead"], time:"3m 30s", pages:3,
      eng:{seq:"Speed-to-lead · step 3", auto:true}, last:"1h ago", lastMin:60 },
    { name:"Nadia Feldman", company:"Feldman Heating", source:"site", live:false,
      page:"/about", trail:["/","/about"], time:"0m 48s", pages:2,
      eng:{nurture:true}, last:"2h ago", lastMin:120 },
    { name:"Wesley Boone", company:"Boone Electric", source:"instantly", live:false,
      page:"/pricing", trail:["/pricing"], time:"0m 36s", pages:1,
      eng:{none:true}, last:"3h ago", lastMin:180 },
    { name:"Rick Osborne", company:"Osborne Mechanical", source:"instantly", live:false,
      page:"/pricing", trail:["/","/pricing"], time:"1m 12s", pages:2,
      eng:{suppressed:true}, last:"4h ago", lastMin:240 },
    { name:"Fiona Mercer", company:"Mercer Home Services", source:"site", live:false,
      page:"/how-it-works", trail:["/","/how-it-works"], time:"2m 10s", pages:2,
      eng:{nurture:true}, last:"5h ago", lastMin:300 }
  ]
};
