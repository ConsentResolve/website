import { useEffect, useState } from "react";
import { IconArrowRight, IconArrowDown } from "@tabler/icons-react";
import { TRADES, DEFAULT_TRADE } from "../../data/leadCosts";

/**
 * LeadMathStory — the honest lead-economics story for /lead-math (light theme).
 *
 * Spine = COST PER BOOKED JOB (per-unit, so it can't balloon into unbelievable
 * monthly totals or be mistaken for profit). Both sides share ONE input —
 * "jobs you want to book a month" — for a fair, apples-to-apples comparison:
 * same jobs, same revenue, wildly different lead cost. Close rates shown
 * honestly on both sides.
 *
 * Voice locked: $7 is the only fixed figure. CPL = sourced per-trade average.
 * Close rates + avg job are estimates. No competitor names.
 */
const EX_COST = 7;
const CLOSE_SHARED = 0.08;
const CLOSE_CONSENT = 0.05;
const fmt0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)));

// Light palette
const INK = "#0f172a", SUB = "#475569", DIM = "#94a3b8", LINE = "#e2e8f0", NEUTRAL = "#f8fafc";
const MINT = "#00e5a0", MINT_TXT = "#047857", MINT_BG = "#ecfdf5", MINT_BD = "#a7f3d0";
const AMB_TXT = "#b45309", AMB_BG = "#fff7ed", AMB_BD = "#fed7aa";

interface Props {
  demoHref?: string;
  ctaLabel?: string;
  // Hide the CTA when embedded somewhere with its own navigation (e.g. the demo
  // tour). Defaults true so /lead-math is unchanged.
  showCta?: boolean;
}

export default function LeadMathStory({ demoHref = "/demo", ctaLabel = "See it work on you", showCta = true }: Props) {
  const [mode, setMode] = useState<"before" | "after">("before");
  const [tradeId, setTradeId] = useState(DEFAULT_TRADE);
  const [jobs, setJobs] = useState(5);

  const trade = TRADES.find((t) => t.id === tradeId) || TRADES[0];
  const [avgJob, setAvgJob] = useState(trade.avgJob);
  useEffect(() => { setAvgJob(trade.avgJob); }, [trade.avgJob]);

  const isAfter = mode === "after";
  const cpjShared = trade.sharedCpl / CLOSE_SHARED;
  const cpjConsent = EX_COST / CLOSE_CONSENT;
  const cpl = isAfter ? EX_COST : trade.sharedCpl;
  const cpj = isAfter ? cpjConsent : cpjShared;
  const cpjOther = isAfter ? cpjShared : cpjConsent;
  const pctOfJob = Math.round((cpj / avgJob) * 100);

  const revenue = jobs * avgJob;
  const leadCost = jobs * cpj;
  const leadCostOther = jobs * cpjOther;

  const heroBg = isAfter ? MINT_BG : AMB_BG;
  const heroBd = isAfter ? MINT_BD : AMB_BD;
  const heroTxt = isAfter ? MINT_TXT : AMB_TXT;
  const ctaHref = `${demoHref}${demoHref.includes("?") ? "&" : "?"}trade=${tradeId}&jobs=${jobs}`;

  const stepBox = { borderRadius: 14, background: NEUTRAL, border: `1px solid ${LINE}`, padding: "11px 14px" } as const;

  return (
    <div style={{ background: "#ffffff", borderRadius: 24, border: `1px solid ${LINE}`, overflow: "hidden", boxShadow: "0 18px 50px -28px rgba(10,22,40,0.25)" }}>
      {/* Self-contained responsive layout — no Tailwind dependency, so it renders
          identically on /lead-math and the standalone demo pages. */}
      <style dangerouslySetInnerHTML={{ __html: ".lms-2col{display:grid;gap:0;align-items:stretch}@media(min-width:768px){.lms-2col{grid-template-columns:repeat(2,minmax(0,1fr))}.lms-right{border-left:1px solid #e2e8f0}}" }} />
      {/* Toggle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "18px 18px 0" }}>
        <div role="tablist" aria-label="Shared leads versus Consent Resolve" style={{ display: "inline-flex", background: "#f1f5f9", border: `1px solid ${LINE}`, borderRadius: 999, padding: 5 }}>
          {([["before", "Shared leads"], ["after", "Consent Resolve"]] as const).map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              style={{ appearance: "none", border: "none", cursor: "pointer", borderRadius: 999, padding: "9px 26px", fontSize: 15, fontWeight: 700, transition: "all .2s ease", background: mode === m ? MINT : "transparent", color: mode === m ? "#06281f" : SUB }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Trade selector */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 18px 2px" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: SUB }}>
          I'm a
          <select aria-label="Your trade" value={tradeId} onChange={(e) => setTradeId(e.target.value)}
            style={{ background: "#fff", color: INK, border: `1px solid #cbd5e1`, borderRadius: 10, padding: "8px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div className="lms-2col">
        {/* Left: per-job funnel — three matching boxes */}
        <div style={{ padding: "14px 28px 22px", textAlign: "center" }}>
          <div style={stepBox}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: DIM, fontWeight: 700 }}>You pay per lead</p>
            <p style={{ margin: "3px 0 0", fontSize: 26, fontWeight: 800, color: INK }}>{fmt0(cpl)}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11.5, color: DIM }}>{isAfter ? "flat, exclusive — never resold" : "researched industry average"}</p>
          </div>
          <IconArrowDown size={18} color="#cbd5e1" style={{ margin: "6px 0" }} />
          <div style={stepBox}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: DIM, fontWeight: 700 }}>That books a job</p>
            <p style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 700, color: INK }}>{isAfter ? "~1 in 20" : "~1 in 12"}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11.5, color: SUB }}>{isAfter ? "they browsed, not begged — but they're yours alone" : "sold to 4 others — a race to respond"}</p>
          </div>
          <IconArrowDown size={18} color="#cbd5e1" style={{ margin: "6px 0" }} />
          <div style={{ borderRadius: 16, background: heroBg, border: `1px solid ${heroBd}`, padding: "12px 14px", transition: "all .3s ease" }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: heroTxt, fontWeight: 700 }}>Cost per booked job</p>
            <p style={{ margin: "4px 0 0", fontSize: 52, fontWeight: 800, color: INK, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt0(cpj)}</p>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: SUB }}>
              {pctOfJob >= 100
                ? <>more than your {fmt0(avgJob)} job is worth</>
                : <>{pctOfJob}% of your {fmt0(avgJob)} job — you keep {fmt0(avgJob - cpj)} before labor</>}
            </p>
          </div>
        </div>

        {/* Right: money in / money out + the story */}
        <div className="lms-right" style={{ padding: "8px 28px 22px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-jobs" style={{ fontSize: 13, fontWeight: 600, color: SUB }}>Jobs you want to book a month</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{jobs}</span>
            </div>
            <input id="lm-jobs" type="range" min={1} max={30} step={1} value={jobs} onChange={(e) => setJobs(Number(e.target.value))} style={{ width: "100%", accentColor: MINT }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ borderRadius: 12, background: MINT_BG, border: `1px solid ${MINT_BD}`, padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MINT_TXT }}>Money in</p>
              <p style={{ margin: "3px 0 0", fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.1 }}>{fmt0(revenue)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: DIM }}>revenue · same {jobs} jobs</p>
            </div>
            <div style={{ borderRadius: 12, background: AMB_BG, border: `1px solid ${AMB_BD}`, padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: AMB_TXT }}>Money out</p>
              <p style={{ margin: "3px 0 0", fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.1 }}>{fmt0(leadCost)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: DIM }}>in leads · {isAfter ? "shared" : "with us"}: {fmt0(leadCostOther)}</p>
            </div>
          </div>

          <div style={{ marginTop: 14, borderRadius: 14, background: NEUTRAL, border: `1px solid ${LINE}`, padding: "12px 14px" }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: SUB }}>
              {isAfter
                ? <>Same {jobs} jobs from the traffic you <strong style={{ color: INK }}>already have</strong> — lead-site clicks, organic, social, paid ads — recovered as <strong style={{ color: INK }}>exclusive</strong> leads at $7.</>
                : <>A shared {trade.label.toLowerCase()} lead is sold to you <strong style={{ color: INK }}>and three competitors</strong>, so most never book — the leads to land {jobs} jobs cost you <strong style={{ color: INK }}>{fmt0(leadCost)}</strong>.</>}
            </p>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-job" style={{ fontSize: 13, fontWeight: 600, color: SUB }}>Your average job</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{fmt0(avgJob)}</span>
            </div>
            <input id="lm-job" type="range" min={100} max={15000} step={50} value={avgJob} onChange={(e) => setAvgJob(Number(e.target.value))} style={{ width: "100%", accentColor: MINT }} />
          </div>

          {showCta && (
            <a href={ctaHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, width: "100%", background: MINT, color: "#06281f", fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "12px 18px", borderRadius: 999 }}>
              {ctaLabel} <IconArrowRight size={16} stroke={2.5} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
