import { useEffect, useState } from "react";
import {
  IconShieldCheck,
  IconCircleCheck,
  IconPhone,
  IconMessage,
  IconCopy,
  IconWifi,
  IconAntennaBars5,
  IconBatteryFilled,
  IconMapPin,
  IconDroplet,
  IconHome2,
  IconAirConditioning,
  IconBolt,
  type Icon,
} from "@tabler/icons-react";

interface Lead {
  initials: string;
  name: string;
  address: string;
  trade: string;
  intent: string;
  phone: string;
  TradeIcon: Icon;
}

const LEADS: Lead[] = [
  { initials: "SJ", name: "Sarah J.", address: "1428 Maple Hollow · Austin, TX", trade: "Plumbing", intent: "Water heater replacement", phone: "(512) 555-0142", TradeIcon: IconDroplet },
  { initials: "MT", name: "Marcus T.", address: "904 Briarcliff Pl · Atlanta, GA", trade: "Roofing", intent: "Storm damage inspection", phone: "(404) 555-0188", TradeIcon: IconHome2 },
  { initials: "PS", name: "Priya S.", address: "2310 Camelback Ridge · Phoenix, AZ", trade: "HVAC", intent: "AC not cooling, 102° forecast", phone: "(602) 555-0107", TradeIcon: IconAirConditioning },
  { initials: "DR", name: "Diego R.", address: "517 Coral Way · Miami, FL", trade: "Electrical", intent: "Panel upgrade quote", phone: "(305) 555-0163", TradeIcon: IconBolt },
];

export default function LeadPhone() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % LEADS.length), 4400);
    return () => clearInterval(id);
  }, []);
  const lead = LEADS[idx];
  const { TradeIcon } = lead;

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

            {/* App header */}
            <div className="flex items-center justify-between px-5 pt-4">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[#0A1628]">
                  <IconShieldCheck size={16} stroke={2.25} color="#00E5A0" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A1628]">Consent Resolve</div>
                  <div className="text-[9px] text-[#4A5568]">Inbox</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00E5A0]/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#00A86E]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#00C080] opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-[#00C080]" />
                </span>
                New lead
              </span>
            </div>

            {/* Lead card */}
            <div
              key={idx}
              className="lead-card mx-4 mt-4 rounded-2xl bg-white p-5"
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

              {/* Phone row */}
              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-[#0A1628] px-3 py-2.5 font-mono text-[13px] font-semibold tracking-tight text-[#00E5A0]">
                <span className="flex items-center gap-2">
                  <IconPhone size={14} stroke={2} />
                  {lead.phone}
                </span>
                <IconCopy size={14} stroke={1.75} className="text-[#00E5A0]/70" />
              </div>

              {/* CTAs */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="flex items-center justify-center gap-1.5 rounded-lg bg-[#00C080] py-2.5 text-[12px] font-semibold text-white">
                  <IconPhone size={14} stroke={2.5} />
                  Call now
                </button>
                <button className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-2.5 text-[12px] font-semibold text-[#0A1628] ring-1 ring-inset ring-[#e6e6e6]">
                  <IconMessage size={14} stroke={2} />
                  Text
                </button>
              </div>
            </div>

            {/* Bottom hint */}
            <div className="flex items-center justify-center gap-1.5 px-5 py-5 text-[10px] font-medium text-[#4A5568]">
              <span className="size-1 rounded-full bg-[#00C080]" />
              Consented just now
            </div>

            {/* Home indicator */}
            <div className="flex justify-center pb-2">
              <div className="h-[5px] w-[100px] rounded-full bg-[#0A1628]/80" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes lead-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lead-card { animation: lead-in 0.35s cubic-bezier(0.2, 0.6, 0.2, 1); }
        @media (prefers-reduced-motion: reduce) {
          .lead-card { animation: none; }
        }
      `}</style>
    </div>
  );
}
