import { useEffect, useRef, useState } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import { TRADES, DEFAULT_TRADE } from "../../data/leadCosts";

/**
 * LeadMathStory — the simplified, visual lead-cost calculator for /lead-math.
 * Pick your trade → see one digestible number: what a shared lead costs in your
 * trade vs the flat $7 exclusive. A Before/After toggle flips a 10×10 visitor
 * grid from ~2% to ~35% (one tap, no levers) with the demo's count-up + cascade
 * (before = blue, after = green/mint), dark palette. One optional visitors
 * slider personalizes the tangible counts. Voice locked: $7 is the only fixed
 * figure; per-trade CPLs are sourced researched averages; ~35% is illustrative;
 * no competitor names on the page.
 */
const COST = 7;
const fmt0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)));

const PERSON_PATH = "M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z";
const EMPTY = "#22304a";
const BLUE = "#3b82f6";
const MINT = "#00e5a0";
const ORDER: number[] = (() => {
  const o = new Array(100);
  for (let k = 0; k < 100; k++) o[(k * 37) % 100] = k;
  return o;
})();

interface Props {
  demoHref?: string;
}

export default function LeadMathStory({ demoHref = "/demo" }: Props) {
  const [mode, setMode] = useState<"before" | "after">("before");
  const [tradeId, setTradeId] = useState(DEFAULT_TRADE);
  const [visitors, setVisitors] = useState(2000);

  const trade = TRADES.find((t) => t.id === tradeId) || TRADES[0];
  const cpl = trade.sharedCpl;
  const mult = Math.round(cpl / COST);

  const isAfter = mode === "after";
  const litCount = isAfter ? 35 : 2;
  const litColor = isAfter ? MINT : BLUE;
  const perDelay = isAfter ? 45 : 220;
  const countMs = isAfter ? 2000 : 700;

  const [shown, setShown] = useState(2);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    let t0 = 0;
    const from = shown;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / countMs);
      setShown(Math.round(from + (litCount - from) * p));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [litCount]);

  const formCount = Math.round(visitors * 0.02);
  const backCount = Math.round(visitors * 0.35);
  const ctaHref = `${demoHref}${demoHref.includes("?") ? "&" : "?"}trade=${tradeId}&visitors=${visitors}`;

  return (
    <div style={{ background: "#0a1628", borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {/* Toggle + trade selector — the whole interaction lives here */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 14, padding: "18px 18px 4px" }}>
        <div role="tablist" aria-label="Before and after" style={{ display: "inline-flex", background: "#0e1d33", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: 5 }}>
          {(["before", "after"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              style={{
                appearance: "none", border: "none", cursor: "pointer", borderRadius: 999,
                padding: "9px 28px", fontSize: 15, fontWeight: 700, transition: "all .2s ease",
                background: mode === m ? MINT : "transparent",
                color: mode === m ? "#06281f" : "#9fb0c4",
              }}
            >
              {m === "before" ? "Before" : "After"}
            </button>
          ))}
        </div>
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

      <div style={{ display: "grid", gap: 0, alignItems: "center" }} className="md:grid-cols-2">
        {/* Visual: small stat on top, then the animated grid */}
        <div style={{ padding: "8px 28px 20px", textAlign: "center" }}>
          <p style={{ margin: 0, lineHeight: 1.2 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{shown}<span style={{ color: litColor }}>%</span></span>
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#9fb0c4" }}>
            {isAfter ? "of consenting visitors come back — named, exclusive" : "of your visitors become leads today"}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 3, maxWidth: 264, margin: "12px auto 0" }}>
            {Array.from({ length: 100 }).map((_, i) => {
              const on = ORDER[i] < litCount;
              return (
                <svg key={i} viewBox="0 0 24 24" style={{ width: "100%", aspectRatio: "1", display: "block", fill: on ? litColor : EMPTY, transition: "fill .3s ease", transitionDelay: `${on ? ORDER[i] * perDelay : 0}ms` }}>
                  <path d={PERSON_PATH} />
                </svg>
              );
            })}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
            {isAfter ? `≈ ${backCount.toLocaleString()} of your ${visitors.toLocaleString()} visitors · illustrative` : `≈ ${formCount.toLocaleString()} of your ${visitors.toLocaleString()} visitors fill a form`}
          </p>
        </div>

        {/* The one number: shared cost in your trade vs $7 */}
        <div style={{ padding: "6px 28px 22px" }} className="md:border-l md:border-[rgba(255,255,255,0.06)] md:pl-7">
          <div style={{ borderRadius: 16, background: isAfter ? "rgba(0,229,160,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${isAfter ? "rgba(0,229,160,0.35)" : "rgba(255,255,255,0.08)"}`, padding: "16px 18px", transition: "all .3s ease" }}>
            {isAfter ? (
              <>
                <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "#00e5a0", fontWeight: 700 }}>From your own site</p>
                <p style={{ margin: "6px 0 0", fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1 }}>$7<span style={{ fontSize: 18, color: "#9fb0c4", fontWeight: 600 }}> / lead</span></p>
                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "#cbd5e1" }}>
                  Exclusive, never resold. For the price of one shared {trade.label.toLowerCase()} lead, that's about <strong style={{ color: MINT }}>{mult}× the leads</strong>.
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9fb0c4", fontWeight: 700 }}>A shared {trade.label.toLowerCase()} lead</p>
                <p style={{ margin: "6px 0 0", fontSize: 44, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{fmt0(cpl)}<span style={{ fontSize: 18, color: "#9fb0c4", fontWeight: 600 }}> / lead</span></p>
                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "#cbd5e1" }}>
                  And it's sold to four other contractors the second you get it.
                </p>
              </>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-visitors" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Monthly website visitors</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{visitors.toLocaleString()}</span>
            </div>
            <input id="lm-visitors" type="range" min={200} max={20000} step={100} value={visitors} onChange={(e) => setVisitors(Number(e.target.value))} style={{ width: "100%", accentColor: MINT }} />
            <p style={{ margin: "5px 0 0", fontSize: 11, color: "#64748b" }}>Optional — or just flip Before / After.</p>
          </div>

          <a href={ctaHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, width: "100%", background: MINT, color: "#06281f", fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "12px 18px", borderRadius: 999 }}>
            See it work on you <IconArrowRight size={16} stroke={2.5} />
          </a>
        </div>
      </div>
    </div>
  );
}
