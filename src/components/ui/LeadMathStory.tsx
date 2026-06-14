import { useEffect, useState } from "react";
import { IconArrowRight, IconArrowDown } from "@tabler/icons-react";
import { TRADES, DEFAULT_TRADE } from "../../data/leadCosts";

/**
 * LeadMathStory — the money-in / money-out story for /lead-math.
 *
 * Toggle: "Shared leads" (today) vs "Consent Resolve".
 *   Shared  — input: monthly spend ($1,500). spend → leads (spend ÷ CPL) →
 *             booked jobs (× shared close) → revenue. Money out = spend.
 *   Consent — input: monthly website traffic. traffic → recovered exclusive
 *             leads → cost (× $7) → booked jobs → revenue. Money out = cost.
 * Both show cost per booked job and revenue so the full math is visible.
 *
 * Voice locked: $7 is the only fixed figure. CPL = sourced per-trade average.
 * Close/recovery rates + avg job are ILLUSTRATIVE estimates, labeled; the
 * recovered count is shown as an illustrative number, never a "% identified"
 * claim. No competitor names.
 */
const EX_COST = 7;
const CLOSE_SHARED = 0.08;     // ~1 in 12 — shared, sold to ~4, race to respond
const IDENTIFY = 0.10;         // illustrative share of traffic recovered after consent
const CLOSE_RECOVERED = 0.05;  // recovered visitors book at a modest rate, but exclusive + cheap
const fmt0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)));

interface Props {
  demoHref?: string;
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color }}>{label}</span>;
}

export default function LeadMathStory({ demoHref = "/demo" }: Props) {
  const [mode, setMode] = useState<"before" | "after">("before");
  const [tradeId, setTradeId] = useState(DEFAULT_TRADE);
  const [spend, setSpend] = useState(1500);
  const [visitors, setVisitors] = useState(2000);

  const trade = TRADES.find((t) => t.id === tradeId) || TRADES[0];
  const [avgJob, setAvgJob] = useState(trade.avgJob);
  useEffect(() => { setAvgJob(trade.avgJob); }, [trade.avgJob]);

  const isAfter = mode === "after";

  // Shared
  const sLeads = spend / trade.sharedCpl;
  const sJobs = sLeads * CLOSE_SHARED;
  const sRevenue = sJobs * avgJob;
  const sCpj = sJobs > 0 ? spend / sJobs : 0;

  // Consent
  const cRecovered = visitors * IDENTIFY;
  const cCost = cRecovered * EX_COST;
  const cJobs = cRecovered * CLOSE_RECOVERED;
  const cRevenue = cJobs * avgJob;
  const cCpj = cJobs > 0 ? cCost / cJobs : 0;

  const ctaHref = `${demoHref}${demoHref.includes("?") ? "&" : "?"}trade=${tradeId}&visitors=${visitors}&spend=${spend}`;
  const r = (n: number) => Math.max(0, Math.round(n)).toLocaleString();

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
        {/* The money flow */}
        <div style={{ padding: "14px 28px 22px" }}>
          {/* Input slider at the top of the funnel */}
          {isAfter ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                <label htmlFor="lm-visitors" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Your monthly website traffic</label>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{r(visitors)}</span>
              </div>
              <input id="lm-visitors" type="range" min={200} max={50000} step={200} value={visitors} onChange={(e) => setVisitors(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5a0" }} />
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "#64748b" }}>Lead-site clicks · organic · social · paid ads</p>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                <label htmlFor="lm-spend" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Monthly spend on shared leads</label>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmt0(spend)}</span>
              </div>
              <input id="lm-spend" type="range" min={200} max={10000} step={100} value={spend} onChange={(e) => setSpend(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5a0" }} />
            </div>
          )}

          {/* Money OUT */}
          <div style={{ borderRadius: 12, background: "rgba(246,160,77,0.08)", border: "1px solid rgba(246,160,77,0.28)", padding: "10px 14px" }}>
            <Pill label="Money out" color="#f6a04d" />
            <p style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 800, color: "#fff" }}>{fmt0(isAfter ? cCost : spend)}<span style={{ fontSize: 13, color: "#9fb0c4", fontWeight: 600 }}> / mo</span></p>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#9fb0c4" }}>
              {isAfter ? <>~{r(cRecovered)} recovered exclusive leads × $7</> : <>~{r(sLeads)} shared leads × {fmt0(trade.sharedCpl)}</>}
            </p>
          </div>

          <div style={{ textAlign: "center", margin: "6px 0" }}>
            <IconArrowDown size={16} color="#3a4a63" />
            <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>~{r(isAfter ? cJobs : sJobs)} booked jobs ({isAfter ? "exclusive, warm" : "shared, ~1 in 12"})</span>
          </div>

          {/* Money IN */}
          <div style={{ borderRadius: 12, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.32)", padding: "10px 14px" }}>
            <Pill label="Money in" color="#00e5a0" />
            <p style={{ margin: "3px 0 0", fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{fmt0(isAfter ? cRevenue : sRevenue)}<span style={{ fontSize: 14, color: "#9fb0c4", fontWeight: 600 }}> / mo revenue</span></p>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9fb0c4" }}>at {fmt0(avgJob)} per job · {fmt0(isAfter ? cCpj : sCpj)} cost per booked job</p>
          </div>
        </div>

        {/* Story + avg job + CTA */}
        <div style={{ padding: "8px 28px 22px" }} className="md:border-l md:border-[rgba(255,255,255,0.06)] md:pl-7">
          <div style={{ borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px 16px", minHeight: 116 }}>
            {isAfter ? (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#cbd5e1" }}>
                Consent Resolve turns the traffic you <strong style={{ color: "#fff" }}>already have</strong> — lead-site clicks, organic search, social, and paid ads — into <strong style={{ color: "#fff" }}>exclusive</strong>, consent-first leads at <strong style={{ color: "#00e5a0" }}>$7</strong>. Far more leads from the same traffic, sold to no one but you.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#cbd5e1" }}>
                A shared {trade.label.toLowerCase()} lead is sold to you <strong style={{ color: "#fff" }}>and three competitors</strong> at once, so most never book. You spend <strong style={{ color: "#fff" }}>{fmt0(sCpj)}</strong> to land one {fmt0(avgJob)} job.
              </p>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-job" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Your average job</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmt0(avgJob)}</span>
            </div>
            <input id="lm-job" type="range" min={100} max={15000} step={50} value={avgJob} onChange={(e) => setAvgJob(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5a0" }} />
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>Illustrative — lead cost is your trade's researched average; close &amp; recovery rates are typical estimates; only the $7 is fixed.</p>
          </div>

          <a href={ctaHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, width: "100%", background: "#00e5a0", color: "#06281f", fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "12px 18px", borderRadius: 999 }}>
            See it work on you <IconArrowRight size={16} stroke={2.5} />
          </a>
        </div>
      </div>
    </div>
  );
}
