/**
 * Per-trade average shared-lead cost, for the /lead-math calculator.
 *
 * `sharedCpl` = the mean of the four SHARED marketplaces (Thumbtack,
 * Angi/HomeAdvisor, Bark, Networx) from the Competitor CPL Matrix, rounded to
 * the dollar. Exclusive channels (Google LSA, Service Direct) and per-booked-job
 * (TaskRabbit) are intentionally excluded — this number represents what a
 * *shared* lead (sold to ~4 contractors) typically costs in that trade.
 *
 * Sourced (see the matrix's Sources tab): SearchLight Digital (888 contractors,
 * $6.72M, Feb 2026), The Media Captain, Pipeline On, Adapt Digital Solutions,
 * BaaDigi, Networx. These are researched estimates, not performance claims —
 * the page must keep the "$7" as the only fixed figure and never name a
 * competitor on public content.
 */
export interface Trade {
  id: string;
  label: string;
  sharedCpl: number;
}

export const TRADES: Trade[] = [
  { id: "plumber", label: "Plumber", sharedCpl: 54 },
  { id: "hvac", label: "HVAC pro", sharedCpl: 64 },
  { id: "electrician", label: "Electrician", sharedCpl: 43 },
  { id: "roofer", label: "Roofer", sharedCpl: 80 },
  { id: "gc", label: "General contractor", sharedCpl: 92 },
  { id: "handyman", label: "Handyman", sharedCpl: 27 },
  { id: "lawn", label: "Lawn care pro", sharedCpl: 24 },
  { id: "cleaner", label: "House cleaner", sharedCpl: 23 },
  { id: "garage", label: "Garage door pro", sharedCpl: 40 },
  { id: "appliance", label: "Appliance repair pro", sharedCpl: 29 },
  { id: "pest", label: "Pest control pro", sharedCpl: 36 },
  { id: "painter", label: "Painter", sharedCpl: 40 },
  { id: "power", label: "Power washing pro", sharedCpl: 29 },
  { id: "fence", label: "Deck & fence builder", sharedCpl: 58 },
  { id: "tree", label: "Tree removal pro", sharedCpl: 47 },
];

export const DEFAULT_TRADE = "plumber";
