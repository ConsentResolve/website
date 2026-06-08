// Trade-adaptive copy + imagery for the live demo. One source of truth: the
// sample site (themed client-side from /api/visit), the quote/funnel pages, and
// the reveal email all read from here. Keyed by the canonical industry slugs
// (src/data/industries.ts). Businesses are fictional; phone numbers use the
// reserved 555-01xx demo range. Hero photos live at /demo/trades/<slug>.png.

const DEFAULT = {
  key: "home-services",
  label: "home services",
  biz: "Summit Home Services",
  city: "your town",
  phone: "(555) 010-0100",
  image: "/demo/trades/handyman.jpg",
  hero: {
    eyebrow: "Licensed · Insured · Locally owned",
    headline: "Honest home service, done right the first time",
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

function svc(a, b, c, d) { return [a, b, c, d]; }
function rv(t1, t2) {
  return [
    { name: "Dana R.", stars: 5, text: t1 },
    { name: "Marcus T.", stars: 5, text: t2 },
  ];
}

const TRADES = {
  "general-contractor": {
    key: "general-contractor", label: "remodeling", biz: "Summit Contracting Co.", city: "your town", phone: "(555) 010-0110",
    image: "/demo/trades/general-contractor.jpg",
    hero: { eyebrow: "Licensed GC · Insured · Free estimates", headline: "Remodels and additions, built right and on schedule", sub: "Clear scopes, honest budgets, and one crew that owns the whole job." },
    services: svc(
      { title: "Kitchen & bath remodels", desc: "Design-to-done renovations that finish on time and on budget." },
      { title: "Home additions", desc: "More space, permitted and built to code." },
      { title: "Whole-home renovations", desc: "One contractor accountable for the entire project." },
      { title: "Free estimates", desc: "A detailed scope and a real number before you commit." }),
    reviews: rv("They gave us one price and stuck to it through a full kitchen reno. No surprises.", "Communicated every step and the crew cleaned up daily. Worth every penny."),
  },
  "handyman": {
    key: "handyman", label: "handyman work", biz: "Summit Handyman Services", city: "your town", phone: "(555) 010-0111",
    image: "/demo/trades/handyman.jpg",
    hero: { eyebrow: "Insured · One call, dozens of fixes", headline: "Your to-do list, knocked out in one visit", sub: "From leaky faucets to mounted TVs — one trusted pro, fair flat rates." },
    services: svc(
      { title: "Repairs & odd jobs", desc: "The little fixes that have been on your list for months." },
      { title: "Mounting & assembly", desc: "TVs, shelves, furniture — done level and solid." },
      { title: "Drywall & doors", desc: "Patches, paint touch-ups, and doors that finally close right." },
      { title: "Honey-do lists", desc: "Send the whole list; we'll knock it out in one trip." }),
    reviews: rv("Fixed five things in two hours that I'd been putting off for a year.", "Texted when he was on the way, fair price, great work. My go-to now."),
  },
  "tree-removal": {
    key: "tree-removal", label: "tree service", biz: "Summit Tree Service", city: "your town", phone: "(555) 010-0112",
    image: "/demo/trades/tree-removal.jpg",
    hero: { eyebrow: "Insured · Free on-site quotes", headline: "Big trees down safely — and the yard left clean", sub: "Careful removals, smart trimming, and full cleanup hauled away." },
    services: svc(
      { title: "Tree removal", desc: "Safe takedowns, even tight spots near the house and lines." },
      { title: "Trimming & pruning", desc: "Healthier trees and a tidy, balanced canopy." },
      { title: "Stump grinding", desc: "Gone below grade so you can reclaim the space." },
      { title: "Storm cleanup", desc: "Fast response when a limb (or a tree) comes down." }),
    reviews: rv("Dropped a huge oak between my house and fence without a scratch. Pros.", "Cleaned up so well you'd never know a tree was there. Fair quote, too."),
  },
  "hvac": {
    key: "hvac", label: "HVAC", biz: "Summit Heating & Air", city: "your town", phone: "(555) 010-0113",
    image: "/demo/trades/hvac.jpg",
    hero: { eyebrow: "Licensed HVAC techs · Same-day service", headline: "Cool in summer, warm in winter — no surprises on the bill", sub: "Straight answers on repair vs. replace, and financing when you need it." },
    services: svc(
      { title: "AC repair", desc: "Same-day diagnosis and a fix that lasts, not a band-aid." },
      { title: "Heating & furnace", desc: "Tune-ups, repairs, and replacements before the cold hits." },
      { title: "New systems", desc: "Right-sized installs that actually lower your power bill." },
      { title: "Maintenance plans", desc: "Two visits a year keeps the breakdowns away." }),
    reviews: rv("AC quit during a heat wave. Tech had us running in under an hour. Lifesavers.", "Told me my unit had years left when another company tried to sell me a new one."),
  },
  "plumber": {
    key: "plumber", label: "plumbing", biz: "Summit Plumbing Co.", city: "your town", phone: "(555) 010-0114",
    image: "/demo/trades/plumber.jpg",
    hero: { eyebrow: "Licensed plumbers · Same-day service", headline: "Leaks, clogs, water heaters — handled today", sub: "Up-front flat-rate pricing and a crew that cleans up after itself." },
    services: svc(
      { title: "Drain & sewer", desc: "Clogs cleared and cameras run so it's fixed for good." },
      { title: "Water heaters", desc: "Tank and tankless repair, replacement, and same-day installs." },
      { title: "Leak detection", desc: "Find the leak fast — before it finds your drywall." },
      { title: "Repipes & fixtures", desc: "Faucets, toilets, and whole-home repipes done clean." }),
    reviews: rv("Water heater died at 6am. Hot showers again by noon. Fair price, no upsell.", "Found a slab leak two other plumbers missed. These folks know their stuff."),
  },
  "locksmith": {
    key: "locksmith", label: "locksmith service", biz: "Summit Lock & Key", city: "your town", phone: "(555) 010-0115",
    image: "/demo/trades/locksmith.jpg",
    hero: { eyebrow: "Licensed · Bonded · Fast response", headline: "Locked out or locking down — we're on the way", sub: "Quick, damage-free entry and locks you can actually trust." },
    services: svc(
      { title: "Lockouts", desc: "Fast, damage-free entry for home and car." },
      { title: "Rekey & new locks", desc: "New place? New peace of mind in minutes." },
      { title: "Smart locks", desc: "Keypad and app locks installed and set up right." },
      { title: "Key replacement", desc: "Keys and fobs cut and programmed on site." }),
    reviews: rv("Locked out at midnight; he was there in 20 minutes and didn't gouge me.", "Rekeyed the whole house after we moved in. Quick, friendly, fair."),
  },
  "electrician": {
    key: "electrician", label: "electrical", biz: "Summit Electric Co.", city: "your town", phone: "(555) 010-0116",
    image: "/demo/trades/electrician.jpg",
    hero: { eyebrow: "Licensed electricians · Up-front pricing", headline: "Safe, code-clean electrical — done right the first time", sub: "Panels, outlets, EV chargers, and the weird flickering thing nobody else could find." },
    services: svc(
      { title: "Panel upgrades", desc: "More capacity, safer wiring, and room to grow." },
      { title: "Troubleshooting", desc: "We find the real cause — not just reset the breaker." },
      { title: "EV chargers", desc: "Level 2 installs done to code and ready for inspection." },
      { title: "Lighting & outlets", desc: "Recessed lighting, new circuits, and surge protection." }),
    reviews: rv("Half my kitchen had no power. They traced it to a bad junction in 20 minutes.", "Installed my EV charger clean and passed inspection first try. Pros."),
  },
  "roofing": {
    key: "roofing", label: "roofing", biz: "Summit Roofing Co.", city: "your town", phone: "(555) 010-0117",
    image: "/demo/trades/roofing.jpg",
    hero: { eyebrow: "Licensed roofers · Free inspections", headline: "A roof that holds — through the next storm and the one after", sub: "Honest inspections, real warranties, and crews who treat your home like their own." },
    services: svc(
      { title: "Roof replacement", desc: "Architectural shingle, metal, and flat systems installed to last." },
      { title: "Storm & leak repair", desc: "Fast tarp-and-fix so a small leak stays small." },
      { title: "Free inspections", desc: "Photos, findings, and a quote — no pressure." },
      { title: "Gutters & flashing", desc: "The details that decide whether a roof keeps water out." }),
    reviews: rv("Insurance claim was a maze. They walked us through it and the roof looks incredible.", "Quoted fair, started on time, cleaned up every nail. Couldn't ask for more."),
  },
  "painter": {
    key: "painter", label: "painting", biz: "Summit Painting Co.", city: "your town", phone: "(555) 010-0118",
    image: "/demo/trades/painter.jpg",
    hero: { eyebrow: "Insured · Free color consults", headline: "Crisp lines, clean walls, no mess left behind", sub: "Interior and exterior painting that looks great and lasts." },
    services: svc(
      { title: "Interior painting", desc: "Walls, trim, and ceilings with sharp, clean edges." },
      { title: "Exterior painting", desc: "Prep done right so the finish actually holds up." },
      { title: "Cabinet refinishing", desc: "A like-new kitchen for a fraction of a remodel." },
      { title: "Color consults", desc: "Not sure on a color? We'll help you nail it." }),
    reviews: rv("Taped, prepped, and the lines are razor sharp. Spotless when they left.", "Repainted the whole exterior in three days and it looks brand new."),
  },
  "deck-fence": {
    key: "deck-fence", label: "deck & fence work", biz: "Summit Deck & Fence", city: "your town", phone: "(555) 010-0119",
    image: "/demo/trades/deck-fence.jpg",
    hero: { eyebrow: "Insured · Free design quotes", headline: "Decks and fences built to last decades", sub: "Solid framing, clean lines, and materials that hold up to the weather." },
    services: svc(
      { title: "New decks", desc: "Wood and composite decks designed for how you actually live." },
      { title: "Fence install", desc: "Privacy, picket, and ranch fencing set straight and solid." },
      { title: "Repairs & staining", desc: "Bring a tired deck or fence back to life." },
      { title: "Free quotes", desc: "A real design and number before you decide." }),
    reviews: rv("Built a composite deck that's the best part of our backyard now.", "Fence is dead straight and rock solid. Crew was respectful and fast."),
  },
  "garage-door": {
    key: "garage-door", label: "garage door service", biz: "Summit Garage Door", city: "your town", phone: "(555) 010-0120",
    image: "/demo/trades/garage-door.jpg",
    hero: { eyebrow: "Same-day service · Insured", headline: "A garage door that opens every time", sub: "Springs, openers, and full installs — fixed fast and done safely." },
    services: svc(
      { title: "Spring & cable repair", desc: "The most common failure, fixed safely the same day." },
      { title: "Opener install", desc: "Quiet, smart openers set up and tested." },
      { title: "New doors", desc: "Insulated, modern doors that boost your curb appeal." },
      { title: "Tune-ups", desc: "Quiet, smooth, and safe for another year." }),
    reviews: rv("Spring snapped and the door was stuck. Fixed within hours, fair price.", "New opener is so quiet I don't wake the baby anymore. Great install."),
  },
  "appliance-repair": {
    key: "appliance-repair", label: "appliance repair", biz: "Summit Appliance Repair", city: "your town", phone: "(555) 010-0121",
    image: "/demo/trades/appliance-repair.jpg",
    hero: { eyebrow: "Insured · Same-week appointments", headline: "Fix it for less than replacing it", sub: "Washers, dryers, fridges, and ovens — diagnosed honestly and repaired right." },
    services: svc(
      { title: "Washer & dryer", desc: "Leaks, no-spin, no-heat — back to laundry day fast." },
      { title: "Refrigerators", desc: "Cooling issues and leaks fixed before food spoils." },
      { title: "Ovens & ranges", desc: "Heating elements, igniters, and controls repaired." },
      { title: "Honest quotes", desc: "We'll tell you when a repair isn't worth it." }),
    reviews: rv("Saved me from buying a new fridge — it was a $90 part. Honest guy.", "Dryer was fixed same week and he had the part on the truck. Easy."),
  },
  "house-cleaning": {
    key: "house-cleaning", label: "house cleaning", biz: "Summit Home Cleaning", city: "your town", phone: "(555) 010-0122",
    image: "/demo/trades/house-cleaning.jpg",
    hero: { eyebrow: "Insured · Trusted, vetted cleaners", headline: "Come home to a place that actually feels clean", sub: "Reliable, detailed cleaning from a team you can trust in your home." },
    services: svc(
      { title: "Recurring cleaning", desc: "Weekly or biweekly — the same trusted team each time." },
      { title: "Deep cleaning", desc: "Top-to-bottom detail for the spots that get skipped." },
      { title: "Move in / out", desc: "Hand back the keys (or start fresh) spotless." },
      { title: "Custom checklists", desc: "Tell us your priorities; we'll hit them every visit." }),
    reviews: rv("Same team every visit and the house has never looked better.", "They notice the little things. Came home and just exhaled. So worth it."),
  },
  "pest-control": {
    key: "pest-control", label: "pest control", biz: "Summit Pest Control", city: "your town", phone: "(555) 010-0123",
    image: "/demo/trades/pest-control.jpg",
    hero: { eyebrow: "Licensed · Pet- & family-friendly", headline: "Pests gone — and kept gone", sub: "Targeted treatments that work, safe for the people and pets you love." },
    services: svc(
      { title: "General pest", desc: "Ants, roaches, spiders — knocked out and kept out." },
      { title: "Termite control", desc: "Inspections and treatments that protect your biggest asset." },
      { title: "Rodent control", desc: "Sealed entry points and a plan that actually holds." },
      { title: "Quarterly plans", desc: "Year-round protection without you thinking about it." }),
    reviews: rv("Ant problem gone after one visit and it hasn't come back. Friendly tech.", "Explained exactly what he was using and why. Safe for the dog, which mattered."),
  },
  "power-washing": {
    key: "power-washing", label: "power washing", biz: "Summit Power Washing", city: "your town", phone: "(555) 010-0124",
    image: "/demo/trades/power-washing.jpg",
    hero: { eyebrow: "Insured · Free quotes", headline: "Make it look new again — no harsh chemicals", sub: "Driveways, siding, decks, and roofs, brought back to life." },
    services: svc(
      { title: "House washing", desc: "Soft-wash siding that's safe for your paint and plants." },
      { title: "Driveways & concrete", desc: "Years of grime gone in an afternoon." },
      { title: "Decks & patios", desc: "Cleaned and prepped, ready to stain." },
      { title: "Roof cleaning", desc: "Lift the black streaks without damaging shingles." }),
    reviews: rv("My driveway looks brand new — I didn't know it was that color.", "Soft-washed the whole house and it looks freshly painted. Amazing."),
  },
  "lawn-care": {
    key: "lawn-care", label: "lawn care", biz: "Summit Lawn Care", city: "your town", phone: "(555) 010-0125",
    image: "/demo/trades/lawn-care.jpg",
    hero: { eyebrow: "Insured · Reliable weekly service", headline: "The best-looking lawn on the block, every week", sub: "Dependable mowing and treatments that keep it green and healthy." },
    services: svc(
      { title: "Weekly mowing", desc: "Crisp, even cuts on a schedule you can count on." },
      { title: "Fertilization", desc: "A program that actually greens it up and chokes weeds." },
      { title: "Cleanups", desc: "Spring and fall resets that make the yard pop." },
      { title: "Trimming & edging", desc: "The clean lines that make a lawn look pro." }),
    reviews: rv("Same crew, same day, every week — and my lawn is the nicest on the street.", "Their fertilizer program turned a patchy yard into a carpet. Highly recommend."),
  },
  "mobile-car-service": {
    key: "mobile-car-service", label: "mobile auto repair", biz: "Summit Mobile Auto", city: "your town", phone: "(555) 010-0126",
    image: "/demo/trades/mobile-car-service.jpg",
    hero: { eyebrow: "Certified mechanics · We come to you", headline: "Car repair in your driveway — skip the shop", sub: "Honest diagnostics and quality work, right where you're parked." },
    services: svc(
      { title: "Brakes & batteries", desc: "The common stuff, done in your driveway." },
      { title: "Diagnostics", desc: "Check-engine light read and explained in plain English." },
      { title: "Oil & maintenance", desc: "Stay on schedule without a trip to the shop." },
      { title: "Pre-purchase checks", desc: "Know what you're buying before you sign." }),
    reviews: rv("Replaced my brakes in my own driveway while I worked. Game changer.", "Honest about what I did and didn't need. Saved me a shop markup, too."),
  },
};

// Friendly aliases so older ?trade= values still resolve to a profile.
const ALIASES = {
  plumbing: "plumber", plumbers: "plumber",
  roofer: "roofing", roofers: "roofing",
  "heating-and-air": "hvac", "heating-cooling": "hvac", ac: "hvac",
  electrical: "electrician", electricians: "electrician",
  gc: "general-contractor", contractor: "general-contractor",
  pest: "pest-control", lawn: "lawn-care", cleaning: "house-cleaning",
};

export function tradeProfile(trade) {
  const raw = String(trade || "").trim().toLowerCase();
  const key = ALIASES[raw] || raw;
  return TRADES[key] || DEFAULT;
}

// Ordered list for the registration <select> (label = display name).
export const TRADE_OPTIONS = [
  { value: "general-contractor", label: "General Contractor" },
  { value: "handyman", label: "Handyman" },
  { value: "tree-removal", label: "Tree Removal" },
  { value: "hvac", label: "HVAC & AC" },
  { value: "plumber", label: "Plumber" },
  { value: "locksmith", label: "Locksmith" },
  { value: "electrician", label: "Electrician" },
  { value: "roofing", label: "Roofer" },
  { value: "painter", label: "Painter" },
  { value: "deck-fence", label: "Deck & Fence" },
  { value: "garage-door", label: "Garage Door" },
  { value: "appliance-repair", label: "Appliance Repair" },
  { value: "house-cleaning", label: "House Cleaning" },
  { value: "pest-control", label: "Pest Control" },
  { value: "power-washing", label: "Power Washing" },
  { value: "lawn-care", label: "Lawn Care" },
  { value: "mobile-car-service", label: "Mobile Car Service" },
];
