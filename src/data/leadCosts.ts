/**
 * Per-trade lead economics for the /lead-math calculator.
 *
 * `sharedCpl` = mean of the four SHARED marketplaces (Thumbtack,
 * Angi/HomeAdvisor, Bark, Networx) from the Competitor CPL Matrix, rounded to
 * the dollar. Exclusive (Google LSA, Service Direct) and per-booked-job
 * (TaskRabbit) columns are excluded — this is what a *shared* lead (sold to ~4
 * contractors) typically costs in that trade. Sourced (matrix Sources tab):
 * SearchLight Digital (888 contractors, $6.72M, Feb 2026), The Media Captain,
 * Adapt Digital, BaaDigi, Networx.
 *
 * `avgJob` = a typical average job value for the trade — an ILLUSTRATIVE
 * starting point the reader can change, never a published claim. Only the flat
 * $7 Consent Resolve cost is fixed.
 *
 * "general" is the default: a blended home-services average across the trades.
 */
export interface Trade {
  id: string;
  label: string;
  sharedCpl: number;
  avgJob: number;
}

export const TRADES: Trade[] = [
  { id: "general", label: "General (home services)", sharedCpl: 46, avgJob: 850 },
  { id: "plumber", label: "Plumber", sharedCpl: 54, avgJob: 550 },
  { id: "hvac", label: "HVAC pro", sharedCpl: 64, avgJob: 1200 },
  { id: "electrician", label: "Electrician", sharedCpl: 43, avgJob: 650 },
  { id: "roofer", label: "Roofer", sharedCpl: 80, avgJob: 8000 },
  { id: "gc", label: "General contractor", sharedCpl: 92, avgJob: 11000 },
  { id: "handyman", label: "Handyman", sharedCpl: 27, avgJob: 350 },
  { id: "lawn", label: "Lawn care pro", sharedCpl: 24, avgJob: 250 },
  { id: "cleaner", label: "House cleaner", sharedCpl: 23, avgJob: 200 },
  { id: "garage", label: "Garage door pro", sharedCpl: 40, avgJob: 450 },
  { id: "appliance", label: "Appliance repair pro", sharedCpl: 29, avgJob: 350 },
  { id: "pest", label: "Pest control pro", sharedCpl: 36, avgJob: 300 },
  { id: "painter", label: "Painter", sharedCpl: 40, avgJob: 2500 },
  { id: "power", label: "Power washing pro", sharedCpl: 29, avgJob: 350 },
  { id: "fence", label: "Deck & fence builder", sharedCpl: 58, avgJob: 4000 },
  { id: "tree", label: "Tree removal pro", sharedCpl: 47, avgJob: 1100 },
];

export const DEFAULT_TRADE = "general";
