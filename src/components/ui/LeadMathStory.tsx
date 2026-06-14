import { useEffect, useState } from "react";
import { IconArrowRight, IconArrowDown } from "@tabler/icons-react";
import { TRADES, DEFAULT_TRADE } from "../../data/leadCosts";

/**
 * LeadMathStory — the honest lead-economics story for /lead-math and the demo's
 * Step 4. Shows the WHOLE story at once, top-to-bottom (no toggle, so a visitor
 * who never interacts still sees the solution): the shared-lead problem → recover
 * your own traffic → the money payoff. Spine = cost per booked job (per-unit, so
 * it can't balloon or be mistaken for profit).
 *
 * Props: demoHref/ctaLabel (CTA target/label), showCta (hide on the demo),
 * initialTrade. A `?trade=` URL param (raw slug or label) preselects the trade —
 * the demo passes the visitor's known trade.
 *
 * Voice locked: $7 is the only fixed figure. CPL = sourced per-trade average.
 * Close rates + avg job are estimates. No competitor names.
 */
const EX_COST = 7;
const CLOSE_SHARED = 0.08;
const CLOSE_CONSENT = 0.05;
const fmt0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)));

const INK = "#0f172a", SUB = "#475569", DIM = "#94a3b8", LINE = "#e2e8f0", NEUTRAL = "#f8fafc";
const MINT = "#00e5a0", MINT_TXT = "#047857", MINT_BG = "#ecfdf5", MINT_BD = "#a7f3d0";
const AMB_TXT = "#b45309", AMB_BG = "#fff7ed", AMB_BD = "#fed7aa";

function normalizeTrade(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (TRADES.some((t) => t.id === s)) return s;
  const has = (x: string) => s.includes(x);
  if (has("plumb")) return "plumber";
  if (has("hvac") || has("heat") || has("cooling") || has("air")) return "hvac";
  if (has("electric")) return "electrician";
  if (has("roof")) return "roofer";
  if (has("general") || has("contractor") || has("remodel")) return "gc";
  if (has("handy")) return "handyman";
  if (has("lawn") || has("landscap")) return "lawn";
  if (has("clean")) return "cleaner";
  if (has("garage")) return "garage";
  if (has("appliance")) return "appliance";
  if (has("pest")) return "pest";
  if (has("paint")) return "painter";
  if (has("power") || has("wash")) return "power";
  if (has("fence") || has("deck")) return "fence";
  if (has("tree")) return "tree";
  return null;
}

interface Props {
  demoHref?: string;
  ctaLabel?: string;
  showCta?: boolean;
  initialTrade?: string;
}

export default function LeadMathStory({ demoHref = "/demo", ctaLabel = "See it work on you", showCta = true, initialTrade = DEFAULT_TRADE }: Props) {
  const [tradeId, setTradeId] = useState(initialTrade);
  const [jobs, setJobs] = useState(5);

  const trade = TRADES.find((t) => t.id === tradeId) || TRADES[0];
  const [avgJob, setAvgJob] = useState(trade.avgJob);
  useEffect(() => { setAvgJob(trade.avgJob); }, [trade.avgJob]);

  // Preselect the trade from ?trade= (the demo passes the visitor's known trade).
  useEffect(() => {
    const id = normalizeTrade(new URLSearchParams(window.location.search).get("trade"));
    if (id) setTradeId(id);
  }, []);

  const cpjShared = trade.sharedCpl / CLOSE_SHARED;
  const cpjConsent = EX_COST / CLOSE_CONSENT;
  const pctShared = Math.round((cpjShared / avgJob) * 100);
  const pctConsent = Math.round((cpjConsent / avgJob) * 100);

  const revenue = jobs * avgJob;
  const outShared = jobs * cpjShared;
  const outConsent = jobs * cpjConsent;
  const ctaHref = `${demoHref}${demoHref.includes("?") ? "&" : "?"}trade=${tradeId}&jobs=${jobs}`;

  return (
    <div style={{ background: "#ffffff", borderRadius: 24, border: `1px solid ${LINE}`, overflow: "hidden", boxShadow: "0 18px 50px -28px rgba(10,22,40,0.25)" }}>
      {/* Trade selector */}
      <div style={{ display: "flex", justifyContent: "center", padding: "18px 18px 6px" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: SUB }}>
          I'm a
          <select aria-label="Your trade" value={tradeId} onChange={(e) => setTradeId(e.target.value)}
            style={{ background: "#fff", color: INK, border: `1px solid #cbd5e1`, borderRadius: 10, padding: "8px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ padding: "6px 24px 24px" }}>
        {/* THE PROBLEM — shared leads */}
        <div style={{ borderRadius: 16, background: AMB_BG, border: `1px solid ${AMB_BD}`, padding: "16px 18px" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: AMB_TXT }}>Shared leads — what most contractors do</p>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: SUB }}>{fmt0(trade.sharedCpl)} a lead · sold to four contractors · ~1 in 12 ever books</p>
          <p style={{ margin: "8px 0 0", fontSize: 40, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt0(cpjShared)}<span style={{ fontSize: 15, color: SUB, fontWeight: 600 }}> per booked job</span></p>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: SUB }}>{pctShared >= 100 ? <>more than your {fmt0(avgJob)} job is worth</> : <>{pctShared}% of your {fmt0(avgJob)} job</>}</p>
        </div>

        <div style={{ textAlign: "center", margin: "8px 0", color: MINT_TXT, fontSize: 13, fontWeight: 700 }}>
          <IconArrowDown size={18} color={MINT} /><div>recover the traffic you already have instead</div>
        </div>

        {/* THE SOLUTION — Consent Resolve */}
        <div style={{ borderRadius: 16, background: MINT_BG, border: `1px solid ${MINT_BD}`, padding: "16px 18px" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: MINT_TXT }}>Consent Resolve</p>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: SUB }}>$7 a lead · exclusive, never resold · from your lead-site, organic, social &amp; paid-ad traffic</p>
          <p style={{ margin: "8px 0 0", fontSize: 40, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt0(cpjConsent)}<span style={{ fontSize: 15, color: SUB, fontWeight: 600 }}> per booked job</span></p>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: SUB }}>{pctConsent}% of your {fmt0(avgJob)} job — you keep {fmt0(avgJob - cpjConsent)} before labor</p>
        </div>

        {/* THE PAYOFF — money in / money out at a job goal */}
        <div style={{ marginTop: 16, borderRadius: 16, background: NEUTRAL, border: `1px solid ${LINE}`, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <label htmlFor="lm-jobs" style={{ fontSize: 13, fontWeight: 600, color: SUB }}>To book this many jobs a month</label>
            <span style={{ fontSize: 15, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{jobs}</span>
          </div>
          <input id="lm-jobs" type="range" min={1} max={30} step={1} value={jobs} onChange={(e) => setJobs(Number(e.target.value))} style={{ width: "100%", accentColor: MINT }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: DIM }}>Revenue</p>
              <p style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 800, color: INK }}>{fmt0(revenue)}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: AMB_TXT }}>Shared leads</p>
              <p style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 800, color: INK }}>{fmt0(outShared)}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MINT_TXT }}>With us</p>
              <p style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 800, color: INK }}>{fmt0(outConsent)}</p>
            </div>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: DIM }}>Same {jobs} jobs, same revenue — what changes is the lead cost. Drag to your average job below.</p>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-job" style={{ fontSize: 13, fontWeight: 600, color: SUB }}>Your average job</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{fmt0(avgJob)}</span>
            </div>
            <input id="lm-job" type="range" min={100} max={15000} step={50} value={avgJob} onChange={(e) => setAvgJob(Number(e.target.value))} style={{ width: "100%", accentColor: MINT }} />
          </div>
        </div>

        {showCta && (
          <a href={ctaHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, width: "100%", background: MINT, color: "#06281f", fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "13px 18px", borderRadius: 999 }}>
            {ctaLabel} <IconArrowRight size={16} stroke={2.5} />
          </a>
        )}
      </div>
    </div>
  );
}
