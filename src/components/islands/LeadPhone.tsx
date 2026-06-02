import { useEffect, useState } from "react";

interface Lead {
  initials: string;
  name: string;
  address: string;
  trade: string;
  intent: string;
  phone: string;
  tradeIcon: string;
}

const LEADS: Lead[] = [
  { initials: "SJ", name: "Sarah J.", address: "1428 Maple Hollow Dr · Austin, TX", trade: "Plumbing", intent: "Water heater replacement", phone: "(512) 555-0142", tradeIcon: "plumbing" },
  { initials: "MT", name: "Marcus T.", address: "904 Briarcliff Pl · Atlanta, GA", trade: "Roofing", intent: "Storm damage inspection", phone: "(404) 555-0188", tradeIcon: "roofing" },
  { initials: "PS", name: "Priya S.", address: "2310 Camelback Ridge · Phoenix, AZ", trade: "HVAC", intent: "AC not cooling, 102° forecast", phone: "(602) 555-0107", tradeIcon: "hvac" },
  { initials: "DR", name: "Diego R.", address: "517 Coral Way · Miami, FL", trade: "Plumbing", intent: "Main line backup", phone: "(305) 555-0163", tradeIcon: "plumbing" },
];

export default function LeadPhone() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % LEADS.length), 4200);
    return () => clearInterval(id);
  }, []);
  const lead = LEADS[idx];

  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      {/* mint glow behind phone */}
      <div className="absolute -inset-10 rounded-[3rem] bg-[color:var(--color-mint-400)]/25 blur-3xl" />

      {/* Phone shell */}
      <div className="relative rounded-[2.5rem] border border-[color:var(--color-navy-900)]/15 bg-[color:var(--color-navy-900)] p-2 shadow-[0_40px_80px_-20px_rgba(10,22,40,0.45)]">
        {/* notch */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
          <div className="mt-2 h-5 w-28 rounded-full bg-black"></div>
        </div>

        {/* screen */}
        <div className="overflow-hidden rounded-[2rem] bg-[color:var(--color-paper)]">
          {/* status bar */}
          <div className="flex items-center justify-between px-6 pb-2 pt-7 text-[11px] font-semibold text-[color:var(--color-ink)]">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined !text-[14px] !text-[color:var(--color-ink)]">signal_cellular_alt</span>
              <span className="material-symbols-outlined !text-[14px] !text-[color:var(--color-ink)]">wifi</span>
              <span className="material-symbols-outlined !text-[14px] !text-[color:var(--color-mint-600)]">battery_full</span>
            </div>
          </div>

          {/* App header */}
          <div className="flex items-center justify-between px-5 pt-2">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-[color:var(--color-navy-900)] flex items-center justify-center">
                <span className="material-symbols-outlined !text-[16px] !text-[color:var(--color-mint-400)]">verified_user</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-ink-2)]">Consent Resolve</span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-[color:var(--color-mint-400)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-mint-700)]">
              <span className="size-1.5 rounded-full bg-[color:var(--color-mint-600)] animate-pulse" />
              New lead
            </span>
          </div>

          {/* Lead card */}
          <div className="mx-4 mt-4 rounded-2xl border border-[color:var(--color-rule)] bg-white p-5 shadow-[0_8px_24px_-12px_rgba(10,22,40,0.18)]" key={idx}>
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-navy-900)] font-black text-[color:var(--color-mint-400)]">
                {lead.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[color:var(--color-ink)]">{lead.name}</h3>
                  <span className="material-symbols-outlined !text-[16px] !text-[color:var(--color-mint-600)]">verified</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[color:var(--color-ink-muted)]">{lead.address}</p>
              </div>
            </div>

            {/* trade tag */}
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] px-3 py-2">
              <span className="material-symbols-outlined !text-[18px]">{lead.tradeIcon}</span>
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-ink-muted)]">{lead.trade}</div>
                <div className="text-xs font-semibold text-[color:var(--color-ink)]">{lead.intent}</div>
              </div>
            </div>

            {/* phone row */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-[color:var(--color-navy-900)] px-3 py-2.5 font-mono text-sm font-bold text-[color:var(--color-mint-400)]">
              <span className="flex items-center gap-2"><span className="material-symbols-outlined !text-[16px] !text-[color:var(--color-mint-400)]">call</span>{lead.phone}</span>
              <span className="material-symbols-outlined !text-[16px] !text-[color:var(--color-mint-400)]">content_copy</span>
            </div>

            {/* CTAs */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-1.5 rounded-lg bg-[color:var(--color-mint-600)] py-2.5 text-xs font-bold text-white">
                <span className="material-symbols-outlined !text-[16px] !text-white">call</span>Call
              </button>
              <button className="flex items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-rule)] bg-white py-2.5 text-xs font-bold text-[color:var(--color-ink)]">
                <span className="material-symbols-outlined !text-[16px]">sms</span>Text
              </button>
            </div>
          </div>

          {/* footer chip */}
          <div className="px-5 py-4 text-center text-[10px] font-medium uppercase tracking-widest text-[color:var(--color-ink-muted)]">
            Consented · 0 seconds ago
          </div>
        </div>
      </div>
    </div>
  );
}
