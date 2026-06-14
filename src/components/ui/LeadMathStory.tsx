import { useEffect, useState } from "react";
import { IconArrowRight, IconArrowDown } from "@tabler/icons-react";
import { TRADES, DEFAULT_TRADE } from "../../data/leadCosts";

/**
 * LeadMathStory — the honest lead-economics story for /lead-math.
 *
 * Spine = COST PER BOOKED JOB (per-unit, so it can't balloon into unbelievable
 * monthly totals and can't be mistaken for profit). Both sides share ONE input
 * — "jobs you want to book a month" — so it's a fair, apples-to-apples compare:
 * same jobs, same revenue, wildly different lead cost. Close rates are shown
 * honestly on both sides (shared leads are higher-intent but sold to 4; recovered
 * visitors are lower-intent but exclusive and $7).
 *
 * Voice locked: $7 is the only fixed figure. CPL = sourced per-trade average.
 * Close rates + avg job are ILLUSTRATIVE and labeled. No competitor names.
 */
const EX_COST = 7;
const CLOSE_SHARED = 0.08;     // ~1 in 12 — shared, sold to ~4, race to respond
const CLOSE_CONSENT = 0.05;    // ~1 in 20 — recovered visitors, lower intent, but exclusive & $7
const fmt0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)));

interface Props {
  demoHref?: string;
}

export default function LeadMathStory({ demoHref = "/demo" }: Props) {
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

  const revenue = jobs * avgJob;        // money in (same both sides — same jobs)
  const leadCost = jobs * cpj;          // money out — what you pay in leads to get there
  const leadCostOther = jobs * cpjOther;

  const accent = isAfter ? "#00e5a0" : "#f6a04d";
  const ctaHref = `${demoHref}${demoHref.includes("?") ? "&" : "?"}trade=${tradeId}&jobs=${jobs}`;

  return (
    <div style={{ background: "#0a1628", borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {/* Toggle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "18px 18px 0" }}>
        <div role="tablist" aria-label="Shared leads versus Consent Resolve" style={{ display: "inline-flex", background: "#0e1d33", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: 5 }}>
          {([["before", "Shared leads"], ["after", "Consent Resolve"]] as const).map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              style={{ appearance: "none", border: "none", cursor: "pointer", borderRadius: 999, padding: "9px 26px", fontSize: 15, fontWeight: 700, transition: "all .2s ease", background: mode === m ? "#00e5a0" : "transparent", color: mode === m ? "#06281f" : "#9fb0c4" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Trade selector */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 18px 2px" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "#9fb0c4" }}>
          I'm a
          <select aria-label="Your trade" value={tradeId} onChange={(e) => setTradeId(e.target.value)}
            style={{ background: "#0e1d33", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {TRADES.map((t) => <option key={t.id} value={t.id} style={{ color: "#000" }}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gap: 0, alignItems: "stretch" }} className="md:grid-cols-2">
        {/* Left: per-job funnel (can't explode, can't be confused with profit) */}
        <div style={{ padding: "14px 28px 22px", textAlign: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>You pay per lead</p>
            <p style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 800, color: "#fff" }}>{fmt0(cpl)}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "#64748b" }}>{isAfter ? "flat, exclusive — never resold" : "researched industry average"}</p>
          </div>
          <IconArrowDown size={18} color="#3a4a63" style={{ margin: "8px 0" }} />
          <div>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>That books a job</p>
            <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: "#fff" }}>{isAfter ? "~1 in 20" : "~1 in 12"}</p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: "#9fb0c4" }}>{isAfter ? "they browsed, not begged — but they're yours alone" : "sold to 4 others — a race to respond"}</p>
          </div>
          <IconArrowDown size={18} color="#3a4a63" style={{ margin: "8px 0" }} />
          <div style={{ borderRadius: 16, background: isAfter ? "rgba(0,229,160,0.08)" : "rgba(246,160,77,0.08)", border: `1px solid ${isAfter ? "rgba(0,229,160,0.35)" : "rgba(246,160,77,0.3)"}`, padding: "12px 14px", transition: "all .3s ease" }}>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>Cost per booked job</p>
            <p style={{ margin: "4px 0 0", fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt0(cpj)}</p>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#cbd5e1" }}>
              {pctOfJob >= 100
                ? <>more than your {fmt0(avgJob)} job is worth</>
                : <>{pctOfJob}% of your {fmt0(avgJob)} job — you keep {fmt0(avgJob - cpj)} before labor</>}
            </p>
          </div>
        </div>

        {/* Right: money in / money out for the SAME job goal + the story */}
        <div style={{ padding: "8px 28px 22px" }} className="md:border-l md:border-[rgba(255,255,255,0.06)] md:pl-7">
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-jobs" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Jobs you want to book a month</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{jobs}</span>
            </div>
            <input id="lm-jobs" type="range" min={1} max={30} step={1} value={jobs} onChange={(e) => setJobs(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5a0" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ borderRadius: 12, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.3)", padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#00e5a0" }}>Money in</p>
              <p style={{ margin: "3px 0 0", fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{fmt0(revenue)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>revenue · same {jobs} jobs</p>
            </div>
            <div style={{ borderRadius: 12, background: "rgba(246,160,77,0.08)", border: "1px solid rgba(246,160,77,0.28)", padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f6a04d" }}>Money out</p>
              <p style={{ margin: "3px 0 0", fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{fmt0(leadCost)}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>in leads · {isAfter ? "shared" : "with us"}: {fmt0(leadCostOther)}</p>
            </div>
          </div>

          <div style={{ marginTop: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "12px 14px" }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "#cbd5e1" }}>
              {isAfter
                ? <>Same {jobs} jobs from the traffic you <strong style={{ color: "#fff" }}>already have</strong> — lead-site clicks, organic, social, paid ads — recovered as <strong style={{ color: "#fff" }}>exclusive</strong> leads at $7.</>
                : <>A shared {trade.label.toLowerCase()} lead is sold to you <strong style={{ color: "#fff" }}>and three competitors</strong>, so most never book — the leads to land {jobs} jobs cost you <strong style={{ color: "#fff" }}>{fmt0(leadCost)}</strong>.</>}
            </p>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-job" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Your average job</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmt0(avgJob)}</span>
            </div>
            <input id="lm-job" type="range" min={100} max={15000} step={50} value={avgJob} onChange={(e) => setAvgJob(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5a0" }} />
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>Illustrative — lead cost is your trade's researched average; close rates are typical estimates; revenue is gross, before labor &amp; materials. Only the $7 is fixed.</p>
          </div>

          <a href={ctaHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, width: "100%", background: "#00e5a0", color: "#06281f", fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "12px 18px", borderRadius: 999 }}>
            See it work on you <IconArrowRight size={16} stroke={2.5} />
          </a>
        </div>
      </div>
    </div>
  );
}
