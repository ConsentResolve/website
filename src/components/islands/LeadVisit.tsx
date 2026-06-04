import { useEffect, useState } from "react";
import {
  IconShieldCheck,
  IconCircleCheck,
  IconMessage,
  IconRefresh,
  IconWifi,
  IconAntennaBars5,
  IconBatteryFilled,
  IconMapPin,
  IconDroplet,
  IconHome2,
  IconAirConditioning,
  IconBolt,
  IconUserOff,
  IconCheck,
  type Icon,
} from "@tabler/icons-react";

/**
 * LeadVisit — hero-panel island.
 *
 * Story arc in ~7s, loops forever:
 *   1. ANON      (0–3500ms)   An anonymous homeowner is browsing your
 *                             site. Phone shows live-visitor card:
 *                             ghost avatar, IP-only ID, pages-viewed
 *                             ticker, "awaiting consent" pill.
 *   2. CONSENT   (3500–4200ms) The visitor accepts the consent banner.
 *                             A green toast pulses across the top:
 *                             "✓ Consent accepted".
 *   3. LEAD      (4200–7000ms) The anonymous card crossfades to the
 *                             real homeowner contact card — name,
 *                             address, trade, intent, funnel actions.
 *   4. LOOP                   Back to ANON with the next homeowner.
 *
 * Same iPhone bezel as the old LeadPhone, so the visual continuity is
 * preserved.
 */

interface Lead {
  initials: string;
  name: string;
  address: string;
  trade: string;
  intent: string;
  TradeIcon: Icon;
  // Anonymous-phase metadata for the same homeowner
  anonIp: string;
  pages: string[];
  onSite: string;
}

const LEADS: Lead[] = [
  {
    initials: "SJ", name: "Sarah J.", address: "1428 Maple Hollow · Austin, TX",
    trade: "Plumbing", intent: "Water heater replacement", TradeIcon: IconDroplet,
    anonIp: "75.214.•••.•••", pages: ["Home", "Water heater repair", "Pricing"], onSite: "2m 14s",
  },
  {
    initials: "MT", name: "Marcus T.", address: "904 Briarcliff Pl · Atlanta, GA",
    trade: "Roofing", intent: "Storm damage inspection", TradeIcon: IconHome2,
    anonIp: "73.119.•••.•••", pages: ["Storm damage", "Service area", "About"], onSite: "3m 02s",
  },
  {
    initials: "PS", name: "Priya S.", address: "2310 Camelback Ridge · Phoenix, AZ",
    trade: "HVAC", intent: "AC not cooling, 102° forecast", TradeIcon: IconAirConditioning,
    anonIp: "98.165.•••.•••", pages: ["AC repair", "Same-day service", "Reviews"], onSite: "1m 47s",
  },
  {
    initials: "DR", name: "Diego R.", address: "517 Coral Way · Miami, FL",
    trade: "Electrical", intent: "Panel upgrade quote", TradeIcon: IconBolt,
    anonIp: "47.236.•••.•••", pages: ["Panel upgrades", "Financing", "Pricing"], onSite: "2m 38s",
  },
];

type Phase = "anon" | "consent" | "lead";

const PHASE_DURATIONS: Record<Phase, number> = {
  anon: 3500,
  consent: 700,
  lead: 2800,
};

export default function LeadVisit() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("anon");
  // How many pages of the anon "pages viewed" list have appeared yet
  const [pageStep, setPageStep] = useState(1);

  // Drive phase machine
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (phase === "anon") setPhase("consent");
      else if (phase === "consent") setPhase("lead");
      else {
        // Cycle: advance lead, restart at anon
        setIdx((i) => (i + 1) % LEADS.length);
        setPageStep(1);
        setPhase("anon");
      }
    }, PHASE_DURATIONS[phase]);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Tick the anon pages list while phase === "anon"
  useEffect(() => {
    if (phase !== "anon") return;
    const ids: number[] = [];
    // Reveal pages at ~900ms, ~1900ms; "anonymous" card already shows the first
    ids.push(window.setTimeout(() => setPageStep(2), 900));
    ids.push(window.setTimeout(() => setPageStep(3), 1900));
    return () => ids.forEach(window.clearTimeout);
  }, [phase, idx]);

  const lead = LEADS[idx];
  const { TradeIcon } = lead;
  const showLead = phase === "lead";

  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      {/* Soft floor shadow */}
      <div className="absolute inset-x-8 -bottom-6 h-12 rounded-full bg-[#0A1628]/25 blur-2xl" />

      {/* Phone body */}
      <div
        className="relative rounded-[3rem] bg-[#0A1628] p-[3px]"
        style={{
          background: "linear-gradient(155deg, #1a2a3f 0%, #0A1628 45%, #050d18 100%)",
          boxShadow:
            "0 50px 80px -30px rgba(10,22,40,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 1px 0 rgba(255,255,255,0.08) inset",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[2.75rem] bg-[#0A1628] p-[2px]"
          style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.6) inset" }}
        >
          <div className="relative overflow-hidden rounded-[2.6rem] bg-[#F9F9F9]">
            {/* Dynamic island */}
            <div className="absolute left-1/2 top-2.5 z-20 h-7 w-[110px] -translate-x-1/2 rounded-full bg-black" />

            {/* Status bar */}
            <div className="relative flex items-center justify-between px-7 pb-2 pt-3 text-[12px] font-semibold text-[#0A1628]">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <IconAntennaBars5 size={14} stroke={2.5} />
                <IconWifi size={14} stroke={2.5} />
                <IconBatteryFilled size={20} stroke={1.5} className="text-[#0A1628]" />
              </div>
            </div>

            {/* App header (shared across phases) */}
            <div className="relative flex items-center justify-between px-5 pt-4">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[#0A1628]">
                  <IconShieldCheck size={16} stroke={2.25} color="#00E5A0" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A1628]">Consent Resolve</div>
                  <div className="text-[9px] text-[#4A5568]">{showLead ? "Inbox" : "Live visitors"}</div>
                </div>
              </div>

              {/* Phase pill — anon: amber, consent: pulse, lead: mint */}
              {phase === "anon" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                  </span>
                  Awaiting consent
                </span>
              )}
              {phase === "consent" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00E5A0]/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#00A86E]">
                  <IconCheck size={10} stroke={3} />
                  Consented
                </span>
              )}
              {phase === "lead" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00E5A0]/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#00A86E]">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#00C080] opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-[#00C080]" />
                  </span>
                  New lead
                </span>
              )}
            </div>

            {/* Consent toast — overlays during consent phase only */}
            {phase === "consent" && (
              <div className="absolute inset-x-4 top-[88px] z-30">
                <div
                  className="lv-toast flex items-center gap-2 rounded-xl bg-[#0A1628] px-3 py-2.5 text-[11px] font-semibold text-white ring-1 ring-inset ring-[#00E5A0]/40"
                  style={{ boxShadow: "0 10px 30px -10px rgba(0,229,160,0.45)" }}
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-[#00E5A0]">
                    <IconCheck size={12} stroke={3.5} color="#0A1628" />
                  </span>
                  <span>Consent accepted · recovering record</span>
                </div>
              </div>
            )}

            {/* Card stack — two cards crossfade. Both mounted so the
                transition is a true fade, not a remount flash. */}
            <div className="relative mx-4 mt-4 min-h-[290px]">
              {/* === ANON CARD === */}
              <div
                className={`lv-card-fade absolute inset-x-0 top-0 ${showLead ? "lv-faded" : ""}`}
                aria-hidden={showLead}
              >
                <div
                  className="rounded-2xl bg-white p-5"
                  style={{ boxShadow: "0 1px 0 rgba(10,22,40,0.04), 0 0 0 1px rgba(10,22,40,0.06), 0 12px 28px -16px rgba(10,22,40,0.25)" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="relative flex size-12 shrink-0 items-center justify-center rounded-full text-[#94a3b8]"
                      style={{ background: "linear-gradient(135deg, #1f2a3a 0%, #0A1628 100%)" }}
                    >
                      <IconUserOff size={20} stroke={1.75} />
                      {/* Tiny pulsing dot to feel "live" */}
                      <span className="absolute -right-0.5 -top-0.5 flex size-3">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
                        <span className="relative inline-flex size-3 rounded-full bg-amber-500 ring-2 ring-white" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold tracking-tight text-[#0A1628]">Anonymous visitor</h3>
                      <p className="mt-0.5 truncate text-[11px] text-[#4A5568] font-mono">IP {lead.anonIp}</p>
                    </div>
                  </div>

                  {/* Pages-viewed ticker */}
                  <div className="mt-4 rounded-xl bg-[#F9F9F9] px-3 py-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#4A5568]">Pages viewed</div>
                    <ul className="mt-1.5 space-y-1">
                      {lead.pages.slice(0, pageStep).map((p, i) => (
                        <li key={i} className="lv-page-row flex items-center gap-2 text-[12px] font-semibold text-[#0A1628]">
                          <span className="font-mono text-[10px] text-[#94a3b8]">→</span>
                          <span className="truncate">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* On-site row */}
                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-[#0A1628] px-3 py-2.5 font-mono text-[11px] font-semibold tracking-tight text-[#94a3b8]">
                    <span className="flex items-center gap-2 truncate">
                      <span className="size-1.5 rounded-full bg-amber-400" />
                      On site · {lead.onSite}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#94a3b8]">Anon</span>
                  </div>

                  {/* Locked CTAs */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button disabled className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-[#E5E7EB] py-2.5 text-[11px] font-semibold text-[#94a3b8]">
                      Email seq.
                    </button>
                    <button disabled className="flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-[#E5E7EB] py-2.5 text-[11px] font-semibold text-[#94a3b8]">
                      Retarget
                    </button>
                  </div>
                </div>
              </div>

              {/* === LEAD CARD (the "current contact screen") === */}
              <div
                className={`lv-card-fade absolute inset-x-0 top-0 ${showLead ? "" : "lv-faded"}`}
                aria-hidden={!showLead}
              >
                <div
                  className="rounded-2xl bg-white p-5"
                  style={{ boxShadow: "0 1px 0 rgba(10,22,40,0.04), 0 0 0 1px rgba(10,22,40,0.06), 0 12px 28px -16px rgba(10,22,40,0.25)" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex size-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-[#00E5A0]"
                      style={{ background: "linear-gradient(135deg, #0F2744 0%, #0A1628 100%)" }}
                    >
                      {lead.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-[15px] font-semibold tracking-tight text-[#0A1628]">{lead.name}</h3>
                        <IconCircleCheck size={14} stroke={2.5} className="text-[#00C080]" />
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[#4A5568]">
                        <IconMapPin size={11} stroke={2} />
                        <span className="truncate">{lead.address}</span>
                      </p>
                    </div>
                  </div>

                  {/* Trade tag */}
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-[#F9F9F9] px-3 py-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#00E5A0]/15">
                      <TradeIcon size={16} stroke={1.75} color="#00A86E" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#4A5568]">{lead.trade}</div>
                      <div className="text-[12px] font-semibold text-[#0A1628] truncate">{lead.intent}</div>
                    </div>
                  </div>

                  {/* Funnel status */}
                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-[#0A1628] px-3 py-2.5 font-mono text-[11px] font-semibold tracking-tight text-[#00E5A0]">
                    <span className="flex items-center gap-2 truncate">
                      <IconRefresh size={14} stroke={2} />
                      Fed into your funnel
                    </span>
                    <span className="rounded-full bg-[#00E5A0]/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em]">Live</span>
                  </div>

                  {/* CTAs */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center gap-1.5 rounded-lg bg-[#00C080] py-2.5 text-[11px] font-semibold text-white">
                      <IconMessage size={14} stroke={2.5} />
                      Email seq.
                    </button>
                    <button className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-2.5 text-[11px] font-semibold text-[#0A1628] ring-1 ring-inset ring-[#e6e6e6]">
                      <IconRefresh size={14} stroke={2} />
                      Retarget
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom hint — phase-aware caption */}
            <div className="flex items-center justify-center gap-1.5 px-5 py-5 text-[10px] font-medium text-[#4A5568]">
              <span className={`size-1 rounded-full ${showLead ? "bg-[#00C080]" : "bg-amber-500"}`} />
              {phase === "anon" && "Browsing your site · identity hidden"}
              {phase === "consent" && "Consent banner accepted"}
              {phase === "lead" && "Consented just now · record recovered"}
            </div>

            {/* Home indicator */}
            <div className="flex justify-center pb-2">
              <div className="h-[5px] w-[100px] rounded-full bg-[#0A1628]/80" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .lv-card-fade {
          transition: opacity 600ms cubic-bezier(0.2, 0.6, 0.2, 1),
                      transform 600ms cubic-bezier(0.2, 0.6, 0.2, 1);
          opacity: 1;
          transform: translateY(0);
        }
        .lv-card-fade.lv-faded {
          opacity: 0;
          transform: translateY(8px);
          pointer-events: none;
        }
        .lv-page-row {
          animation: lv-page-in 280ms cubic-bezier(0.2, 0.6, 0.2, 1) both;
        }
        @keyframes lv-page-in {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .lv-toast {
          animation: lv-toast-in 280ms cubic-bezier(0.2, 0.6, 0.2, 1);
        }
        @keyframes lv-toast-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lv-card-fade, .lv-page-row, .lv-toast { animation: none; transition: none; }
        }
      `}</style>
    </div>
  );
}
