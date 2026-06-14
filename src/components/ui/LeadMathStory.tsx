import { useEffect, useRef, useState } from "react";
import { IconArrowRight } from "@tabler/icons-react";

/**
 * LeadMathStory — the simplified, visual version of the lead-cost calculator
 * for /lead-math. A prominent Before/After toggle flips a 10×10 visitor grid
 * from ~2% (a form on your site) to ~35% (recovered after consent) with a
 * count-up — no lever movement required. Two optional sliders (monthly visitors,
 * lead-site spend) personalize the dollar payoff. Voice locked: only $7 is a
 * fixed claim; the ~35% is the demo's illustrative figure and is labeled so.
 */
const COST = 7;
const fmt0 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)));

const PERSON_PATH = "M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z";
// orderOf[gridPosition] = the cascade step k for a bijective scatter across the
// 10×10 grid, so dots light up in a scattered (not row-by-row) order.
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

  const litCount = mode === "before" ? 2 : 35;
  const [shown, setShown] = useState(2);
  const raf = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    let t0 = 0;
    const from = shown;
    const step = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / 650);
      setShown(Math.round(from + (litCount - from) * p));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [litCount]);

  const exclusive = Math.floor(spend / COST);
  const ctaHref = `${demoHref}${demoHref.includes("?") ? "&" : "?"}visitors=${visitors}&spend=${spend}`;
  const isAfter = mode === "after";

  return (
    <div style={{ background: "#0a1628", borderRadius: 24, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {/* Toggle — the whole interaction lives here */}
      <div style={{ display: "flex", justifyContent: "center", padding: "22px 18px 4px" }}>
        <div role="tablist" aria-label="Before and after" style={{ display: "inline-flex", background: "#0e1d33", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: 5 }}>
          {(["before", "after"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              style={{
                appearance: "none", border: "none", cursor: "pointer", borderRadius: 999,
                padding: "10px 30px", fontSize: 15, fontWeight: 700, transition: "all .2s ease",
                background: mode === m ? "#00e5a0" : "transparent",
                color: mode === m ? "#06281f" : "#9fb0c4",
              }}
            >
              {m === "before" ? "Before" : "After"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 0 }} className="md:grid-cols-2">
        {/* Visual: the animated grid + big number */}
        <div style={{ padding: "20px 28px 28px", textAlign: "center" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 4, maxWidth: 300, margin: "0 auto" }}>
            {Array.from({ length: 100 }).map((_, i) => {
              const on = ORDER[i] < litCount;
              return (
                <svg key={i} viewBox="0 0 24 24" style={{ width: "100%", aspectRatio: "1", display: "block", fill: on ? "#00e5a0" : "#22304a", transition: "fill .45s ease", transitionDelay: `${ORDER[i] * 11}ms` }}>
                  <path d={PERSON_PATH} />
                </svg>
              );
            })}
          </div>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-display, inherit)", fontSize: 64, fontWeight: 800, lineHeight: 1, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
            {shown}<span style={{ color: "#00e5a0" }}>%</span>
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#9fb0c4" }}>
            {isAfter ? "of consenting visitors come back — named, exclusive" : "of your visitors become leads today"}
          </p>
          {isAfter && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Illustrative</p>}
        </div>

        {/* Optional personalization + the money line */}
        <div style={{ padding: "8px 28px 28px", borderTop: "1px solid rgba(255,255,255,0.06)" }} className="md:border-t-0 md:border-l md:border-[rgba(255,255,255,0.06)] md:pt-6">
          <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 14px" }}>Optional — match your shop, or just flip Before / After.</p>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label htmlFor="lm-visitors" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Monthly website visitors</label>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{visitors.toLocaleString()}</span>
            </div>
            <input id="lm-visitors" type="range" min={200} max={20000} step={100} value={visitors} onChange={(e) => setVisitors(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5a0" }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label htmlFor="lm-spend" style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>Spent on lead sites / month</label>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmt0(spend)}</span>
            </div>
            <input id="lm-spend" type="range" min={0} max={10000} step={100} value={spend} onChange={(e) => setSpend(Number(e.target.value))} style={{ width: "100%", accentColor: "#00e5a0" }} />
          </div>

          <div style={{ borderRadius: 14, background: isAfter ? "rgba(0,229,160,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${isAfter ? "rgba(0,229,160,0.35)" : "rgba(255,255,255,0.08)"}`, padding: "14px 16px", transition: "all .3s ease" }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#cbd5e1" }}>
              {isAfter ? (
                <>That same <strong style={{ color: "#fff" }}>{fmt0(spend)}</strong> buys ~<strong style={{ color: "#00e5a0" }}>{exclusive.toLocaleString()}</strong> exclusive leads at $7 — yours alone, never resold.</>
              ) : (
                <><strong style={{ color: "#fff" }}>{fmt0(spend)}</strong>/mo to the machine for shared leads — sold to four other guys the second you get them.</>
              )}
            </p>
          </div>

          <a href={ctaHref} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, width: "100%", background: "#00e5a0", color: "#06281f", fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "13px 18px", borderRadius: 999 }}>
            See it work on you <IconArrowRight size={16} stroke={2.5} />
          </a>
        </div>
      </div>
    </div>
  );
}
