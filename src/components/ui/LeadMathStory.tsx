import { useEffect, useState } from "react";
import { IconArrowRight, IconArrowDown } from "@tabler/icons-react";
import { TRADES, DEFAULT_TRADE } from "../../data/leadCosts";

/**
 * LeadMathStory — the cost-per-booked-job story for /lead-math.
 *
 * Toggle: "Shared leads" (today's problem) vs "Consent Resolve". A clean funnel
 * tells the whole story: what you pay per lead → how it closes → cost per booked
 * job → how much of your job revenue the lead eats. Before focuses on shared
 * leads (low close, sold to 4 others); After shows recovering the traffic you
 * already have (lead-site clicks, organic, social, paid ads) as exclusive $7
 * leads that close better.
 *
 * Voice locked: $7 is the only fixed figure. Per-trade CPLs are sourced averages;
 * close rates + avg job value are ILLUSTRATIVE and labeled; no competitor names.
 */
const EX_COST = 7;
const CLOSE_SHARED = 0.08;     // ~1 in 12 — shared, sold to ~4, race to respond
const CLOSE_EXCLUSIVE = 0.16;  // ~1 in 6 — exclusive + warm inbound, no race
const fmt0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)));

interface Props {
  demoHref?: string;
}

export default function LeadMathStory({ demoHref = "/demo" }: Props) {
  const [mode, setMode] = useState<"before" | "after">("before");
  const [tradeId, setTradeId] = useState(DEFAULT_TRADE);

  const trade = TRADES.find((t) => t.id === tradeId) || TRADES[0];
  const [avgJob, setAvgJob] = useState(trade.avgJob);
  useEffect(() => { setAvgJob(trade.avgJob); }, [trade.avgJob]);

  const isAfter = mode === "after";
  const cpl = isAfter ? EX_COST : trade.sharedCpl;
  const close = isAfter ? CLOSE_EXCLUSIVE : CLOSE_SHARED;
  const costPerJob = cpl / close;
  const pctOfJob = Math.round((costPerJob / avgJob) * 100);

  const accent = isAfter ? "#00e5a0" : "#f6a04d";
  const ctaHref = `${demoHref}${demoHref.includes("?") ? "&" : "?"}trade=${tradeId}`;

  return (
    <div style={{ background: "#0a1628", borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {/* Toggle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "18px 18px 0" }}>
        <div role="tablist" aria-label="Shared leads versus Consent Resolve" style={{ display: "inline-flex", background: "#0e1d33", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: 5 }}>
          {([["before", "Shared leads"], ["after", "Consent Resolve"]] as const).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              style={{
                appearance: "none", border: "none", cursor: "pointer", borderRadius: 999,
                padding: "9px 26px", fontSize: 15, fontWeight: 700, transition: "all .2s ease",
                background: mode === m ? "#00e5a0" : "transparent",
                color: mode === m ? "#06281f" : "#9fb0c4",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Trade selector — under the toggle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 18px 2px" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "#9fb0c4" }}>
          I'm a
          <select
            aria-label="Your trade"
            value={tradeId}
            onChange={(e) => setTradeId(e.target.value)}
            style={{ background: "#0e1d33", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            {TRADES.map((t) => (
              <option key={t.id} value={t.id} style={{ color: "#000" }}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gap: 0, alignItems: "stretch" }} className="md:grid-cols-2">
        {/* The funnel */}
        <div style={{ padding: "14px 28px 22px", textAlign: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>You pay</p>
            <p style={{ margin: "2px 0 0", fontSize: 26, fontWeight: 800, color: "#fff" }}>{fmt0(cpl)}<span style={{ fontSize: 14, color: "#9fb0c4", fontWeight: 600 }}> / lead</span></p>
          </div>
          <IconArrowDown size={18} color="#3a4a63" style={{ margin: "8px 0" }} />
          <div>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>They close</p>
            <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: "#fff" }}>{isAfter ? "~1 in 6" : "~1 in 12"}</p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: "#9fb0c4" }}>{isAfter ? "exclusive & warm — no race" : "shared — sold to 4, race to respond"}</p>
          </div>
          <IconArrowDown size={18} color="#3a4a63" style={{ margin: "8px 0" }} />
          <div style={{ borderRadius: 16, background: isAfter ? "rgba(0,229,160,0.08)" : "rgba(246,160,77,0.08)", border: `1px solid ${isAfter ? "rgba(0,229,160,0.35)" : "rgba(246,160,77,0.3)"}`, padding: "12px 14px", transition: "all .3s ease" }}>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>Cost per booked job</p>
            <p style={{ margin: "4px 0 0", fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{fmt0(costPerJob)}</p>
          </div>
        </div>

        {/* The story + revenue impact */}
        <div style={{ padding: "8px 28px 22px" }} className="md:border-l md:border-[rgba(255,255,255,0.06)] md:pl-7">
          <div style={{ borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "14px 16px", minHeight: 132 }}>
            {isAfter ? (
              <>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#cbd5e1" }}>
                  Consent Resolve turns the traffic you <strong style={{ color: "#fff" }}>already have</strong> — your lead-site clicks, organic search, social, and paid ads — into <strong style={{ color: "#fff" }}>exclusive</strong>, consent-first leads at <strong style={{ color: "#00e5a0" }}>$7</strong>.
                </p>
                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55, color: "#cbd5e1" }}>
                  Exclusive and warm, so more of them book — and the lead is just <strong style={{ color: "#00e5a0" }}>{pctOfJob}%</strong> of your {fmt0(avgJob)} job.
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#cbd5e1" }}>
                  A shared {trade.label.toLowerCase()} lead is sold to you <strong style={{ color: "#fff" }}>and three competitors</strong> at once — so most don't book.
                </p>
                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55, color: "#cbd5e1" }}>
                  By the time one does, you've spent <strong style={{ color: "#fff" }}>{fmt0(costPerJob)}</strong> to land it — about <strong style={{ color: accent }}>{pctOfJob}%</strong> of your {fmt0(avgJob)} job{pctOfJob >= 100 ? " (more than the job is worth)" : ""}.
                </p>
              </>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-job" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Your average job</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmt0(avgJob)}</span>
            </div>
            <input id="lm-job" type="range" min={100} max={15000} step={50} value={avgJob} onChange={(e) => setAvgJob(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5a0" }} />
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>Illustrative — close rates are typical estimates; lead cost is your trade's researched average. Only the $7 is fixed.</p>
          </div>

          <a href={ctaHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, width: "100%", background: "#00e5a0", color: "#06281f", fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "12px 18px", borderRadius: 999 }}>
            See it work on you <IconArrowRight size={16} stroke={2.5} />
          </a>
        </div>
      </div>
    </div>
  );
}
