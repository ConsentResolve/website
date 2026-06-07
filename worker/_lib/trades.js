// Trade-adaptive copy for the live demo. One source of truth: the sample site
// (themed client-side from /api/visit) and the reveal email both read from here.
// Businesses are fictional; phone numbers use the reserved 555-01xx demo range.

const DEFAULT = {
  key: "home-services",
  label: "home services",
  biz: "Summit Home Services",
  city: "your town",
  phone: "(555) 010-0100",
  hero: {
    eyebrow: "Licensed · Insured · Locally owned",
    headline: "Honest home repair, done right the first time",
    sub: "Same-week appointments. Up-front pricing. A crew your neighbors already trust.",
  },
  services: [
    { title: "Repairs & service", desc: "Fast diagnosis and a fair quote before any work starts." },
    { title: "Installs & upgrades", desc: "Quality parts, clean installs, and a workmanship guarantee." },
    { title: "Maintenance plans", desc: "Catch small problems before they become expensive ones." },
    { title: "Emergency help", desc: "Real people answer the phone, day or night." },
  ],
  reviews: [
    { name: "Dana R.", stars: 5, text: "Showed up on time, explained everything, and the price didn't change at the end. Rare these days." },
    { name: "Marcus T.", stars: 5, text: "Booked in the morning, fixed by lunch. Will absolutely call them again." },
  ],
};

const TRADES = {
  plumber: {
    key: "plumber",
    label: "plumbing",
    biz: "Summit Plumbing Co.",
    city: "your town",
    phone: "(555) 010-0111",
    hero: {
      eyebrow: "Licensed plumbers · Same-day service",
      headline: "Leaks, clogs, water heaters — handled today",
      sub: "Up-front flat-rate pricing and a crew that cleans up after itself.",
    },
    services: [
      { title: "Drain & sewer", desc: "Clogs cleared and cameras run so it's fixed for good." },
      { title: "Water heaters", desc: "Tank and tankless repair, replacement, and same-day installs." },
      { title: "Leak detection", desc: "Find the leak fast — before it finds your drywall." },
      { title: "Repipes & fixtures", desc: "Faucets, toilets, and whole-home repipes done clean." },
    ],
    reviews: [
      { name: "Dana R.", stars: 5, text: "Water heater died at 6am. Hot showers again by noon. Fair price, no upsell." },
      { name: "Marcus T.", stars: 5, text: "Found a slab leak two other plumbers missed. These folks know their stuff." },
    ],
  },
  roofer: {
    key: "roofer",
    label: "roofing",
    biz: "Summit Roofing Co.",
    city: "your town",
    phone: "(555) 010-0122",
    hero: {
      eyebrow: "Licensed roofers · Free inspections",
      headline: "A roof that holds — through the next storm and the one after",
      sub: "Honest inspections, real warranties, and crews who treat your home like their own.",
    },
    services: [
      { title: "Roof replacement", desc: "Architectural shingle, metal, and flat systems installed to last." },
      { title: "Storm & leak repair", desc: "Fast tarp-and-fix so a small leak stays small." },
      { title: "Free inspections", desc: "Photos, findings, and a quote — no pressure, no scare tactics." },
      { title: "Gutters & flashing", desc: "The details that decide whether a roof actually keeps water out." },
    ],
    reviews: [
      { name: "Dana R.", stars: 5, text: "Insurance claim was a maze. They walked us through it and the roof looks incredible." },
      { name: "Marcus T.", stars: 5, text: "Quoted fair, started on time, cleaned up every nail. Couldn't ask for more." },
    ],
  },
  hvac: {
    key: "hvac",
    label: "HVAC",
    biz: "Summit Heating & Air",
    city: "your town",
    phone: "(555) 010-0133",
    hero: {
      eyebrow: "Licensed HVAC techs · Same-day service",
      headline: "Cool in summer, warm in winter — no surprises on the bill",
      sub: "Straight answers on repair vs. replace, and financing when you need it.",
    },
    services: [
      { title: "AC repair", desc: "Same-day diagnosis and a fix that lasts, not a band-aid." },
      { title: "Heating & furnace", desc: "Tune-ups, repairs, and replacements before the cold hits." },
      { title: "New systems", desc: "Right-sized installs that actually lower your power bill." },
      { title: "Maintenance plans", desc: "Two visits a year keeps the breakdowns away." },
    ],
    reviews: [
      { name: "Dana R.", stars: 5, text: "AC quit during a heat wave. Tech had us running in under an hour. Lifesavers." },
      { name: "Marcus T.", stars: 5, text: "Told me my unit had years left when another company tried to sell me a new one." },
    ],
  },
  electrician: {
    key: "electrician",
    label: "electrical",
    biz: "Summit Electric Co.",
    city: "your town",
    phone: "(555) 010-0144",
    hero: {
      eyebrow: "Licensed electricians · Up-front pricing",
      headline: "Safe, code-clean electrical — done right the first time",
      sub: "Panels, outlets, EV chargers, and the weird flickering thing nobody else could find.",
    },
    services: [
      { title: "Panel upgrades", desc: "More capacity, safer wiring, and room to grow." },
      { title: "Troubleshooting", desc: "We find the real cause — not just reset the breaker." },
      { title: "EV chargers", desc: "Level 2 installs done to code and ready for inspection." },
      { title: "Lighting & outlets", desc: "Recessed lighting, new circuits, and surge protection." },
    ],
    reviews: [
      { name: "Dana R.", stars: 5, text: "Half my kitchen had no power. They traced it to a bad junction in 20 minutes." },
      { name: "Marcus T.", stars: 5, text: "Installed my EV charger clean and passed inspection first try. Pros." },
    ],
  },
};

// Friendly aliases so ?trade= values from the marketing site all resolve.
const ALIASES = {
  plumbing: "plumber",
  plumbers: "plumber",
  roofing: "roofer",
  roofers: "roofer",
  "heating-and-air": "hvac",
  "heating-cooling": "hvac",
  ac: "hvac",
  electrical: "electrician",
  electricians: "electrician",
};

export function tradeProfile(trade) {
  const raw = String(trade || "").trim().toLowerCase();
  const key = ALIASES[raw] || raw;
  return TRADES[key] || DEFAULT;
}
