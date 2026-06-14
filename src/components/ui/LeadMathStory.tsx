import { useEffect, useRef, useState } from "react";
import { IconArrowRight } from "@tabler/icons-react";

/**
 * LeadMathStory — the simplified, visual lead-cost calculator for /lead-math.
 * A Before/After toggle flips a 10×10 visitor grid from ~2% to ~35% with one
 * tap (no lever movement needed). The grid look + count-up + staggered light-up
 * cascade mirror the demo's "It all comes together" finale (before = blue,
 * after = green/mint), in a dark palette. Two optional sliders personalize the
 * dollar payoff. Voice locked: only $7 is a fixed claim; ~35% is the demo's
 * illustrative figure and is labeled so.
 */
const COST = 7;
const fmt0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)));

const PERSON_PATH = "M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z";
const EMPTY = "#22304a";
const BLUE = "#3b82f6";   // before (matches the demo's blue before-grid)
const MINT = "#00e5a0";   // after  (matches the demo's green after-grid)
// orderOf[gridPosition] = cascade step k, bijective scatter across the 10×10.
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
  const [visitors, setVisitors] = useState(2000);
  const [spend, setSpend] = useState(1500);

  const isAfter = mode === "after";
  const litCount = isAfter ? 35 : 2;
  const litColor = isAfter ? MINT : BLUE;
  const perDelay = isAfter ? 45 : 220;   // ms between dots — matches the demo cascade
  const countMs = isAfter ? 2000 : 700;  // count-up duration — matches the demo

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

  const exclusive = Math.floor(spend / COST);
  const ctaHref = `${demoHref}${demoHref.includes("?") ? "&" : "?"}visitors=${visitors}&spend=${spend}`;

  return (
    <div style={{ background: "#0a1628", borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {/* Toggle — the whole interaction lives here */}
      <div style={{ display: "flex", justifyContent: "center", padding: "18px 18px 2px" }}>
        <div role="tablist" aria-label="Before and after" style={{ display: "inline-flex", background: "#0e1d33", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: 5 }}>
          {(["before", "after"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              style={{
                appearance: "none", border: "none", cursor: "pointer", borderRadius: 999,
                padding: "9px 30px", fontSize: 15, fontWeight: 700, transition: "all .2s ease",
                background: mode === m ? MINT : "transparent",
                color: mode === m ? "#06281f" : "#9fb0c4",
              }}
            >
              {m === "before" ? "Before" : "After"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 0, alignItems: "center" }} className="md:grid-cols-2">
        {/* Visual: small stat on top, then the animated grid */}
        <div style={{ padding: "10px 28px 22px", textAlign: "center" }}>
          <p style={{ margin: 0, lineHeight: 1.2 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{shown}<span style={{ color: litColor }}>%</span></span>
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#9fb0c4" }}>
            {isAfter ? "of consenting visitors come back — named, exclusive" : "of your visitors become leads today"}
          </p>
          <p style={{ margin: "1px 0 0", fontSize: 11, color: "#64748b", minHeight: 14 }}>{isAfter ? "Illustrative" : " "}</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 3, maxWidth: 270, margin: "12px auto 0" }}>
            {Array.from({ length: 100 }).map((_, i) => {
              const on = ORDER[i] < litCount;
              return (
                <svg key={i} viewBox="0 0 24 24" style={{ width: "100%", aspectRatio: "1", display: "block", fill: on ? litColor : EMPTY, transition: "fill .3s ease", transitionDelay: `${on ? ORDER[i] * perDelay : 0}ms` }}>
                  <path d={PERSON_PATH} />
                </svg>
              );
            })}
          </div>
        </div>

        {/* Optional personalization + the money line */}
        <div style={{ padding: "6px 28px 22px" }} className="md:border-l md:border-[rgba(255,255,255,0.06)] md:pl-7">
          <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 14px" }}>Optional — match your shop, or just flip Before / After.</p>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-visitors" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Monthly website visitors</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{visitors.toLocaleString()}</span>
            </div>
            <input id="lm-visitors" type="range" min={200} max={20000} step={100} value={visitors} onChange={(e) => setVisitors(Number(e.target.value))} style={{ width: "100%", accentColor: MINT }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <label htmlFor="lm-spend" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Spent on lead sites / month</label>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmt0(spend)}</span>
            </div>
            <input id="lm-spend" type="range" min={0} max={10000} step={100} value={spend} onChange={(e) => setSpend(Number(e.target.value))} style={{ width: "100%", accentColor: MINT }} />
          </div>

          <div style={{ borderRadius: 14, background: isAfter ? "rgba(0,229,160,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${isAfter ? "rgba(0,229,160,0.35)" : "rgba(255,255,255,0.08)"}`, padding: "12px 14px", transition: "all .3s ease" }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#cbd5e1" }}>
              {isAfter ? (
                <>That same <strong style={{ color: "#fff" }}>{fmt0(spend)}</strong> buys ~<strong style={{ color: MINT }}>{exclusive.toLocaleString()}</strong> exclusive leads at $7 — yours alone, never resold.</>
              ) : (
                <><strong style={{ color: "#fff" }}>{fmt0(spend)}</strong>/mo to the machine for shared leads — sold to four other guys the second you get them.</>
              )}
            </p>
          </div>

          <a href={ctaHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, width: "100%", background: MINT, color: "#06281f", fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "12px 18px", borderRadius: 999 }}>
            See it work on you <IconArrowRight size={16} stroke={2.5} />
          </a>
        </div>
      </div>
    </div>
  );
}
