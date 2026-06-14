import { useMemo, useState } from "react";
import { IconArrowRight, IconCalculator } from "@tabler/icons-react";

/**
 * Recovery Calculator — shows a home-service contractor the illustrative
 * monthly job-revenue upside of recovering their bounced website traffic.
 *
 * June 2026 (LOCKED): there are NO baked recovery/booked-job rate constants
 * presented as fact. The reader sets every assumption themselves — monthly
 * visitors, average job value, recovery rate, and recovered-to-booked rate.
 * The only fixed number is the flat $7 Consent Resolve cost. Everything is
 * labeled illustrative; we don't publish performance claims. Sourced
 * industry data lives on /stats/.
 */

interface Props {
  variant?: "default" | "dark";
  // "ripoff" adds a lead-site-spend input and reframes the output as the
  // "same money, owned" contrast (drives the /lead-math growth funnel).
  mode?: "default" | "ripoff";
  defaults?: {
    visitors?: number;
    avgJob?: number;
    recoveryPct?: number;
    bookedPct?: number;
    leadSpend?: number;
  };
  title?: string;
  blurb?: string;
  // Result CTA. Defaults preserve the existing dashboard-register button so
  // current placements (homepage, [slug]) are unchanged.
  ctaHref?: string;
  ctaLabel?: string;
}

const BOUNCE_RATE = 0.98; // sourced: ~98% of visitors leave without converting (/stats/)
const COST_PER_RECOVERED = 7;

const fmtUsd0 = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

export default function RecoveryCalculator({
  variant = "default",
  mode = "default",
  defaults = {},
  title = "Recoverable revenue calculator",
  blurb = "Set your own assumptions. Illustrative, not a promise.",
  ctaHref = "https://dashboard.consentresolve.com/register",
  ctaLabel = "Get Started",
}: Props) {
  const isRipoff = mode === "ripoff";
  const [visitors, setVisitors] = useState<number>(defaults.visitors ?? 2_000);
  const [avgJob, setAvgJob] = useState<number>(defaults.avgJob ?? 850);
  // Assumptions the reader controls — conservative starting points, NOT
  // published performance claims.
  const [recoveryPct, setRecoveryPct] = useState<number>(defaults.recoveryPct ?? 10);
  const [bookedPct, setBookedPct] = useState<number>(defaults.bookedPct ?? 1);
  // Ripoff mode only: what they currently hand the lead sites each month.
  const [leadSpend, setLeadSpend] = useState<number>(defaults.leadSpend ?? 1_500);

  const numbers = useMemo(() => {
    const bouncers = visitors * BOUNCE_RATE;
    const recovered = bouncers * (recoveryPct / 100);
    const bookedJobs = recovered * (bookedPct / 100);
    const monthlyRevenue = bookedJobs * avgJob;
    const monthlyCost = recovered * COST_PER_RECOVERED;
    // The reframe: for the SAME money they already spend, how many exclusive,
    // never-resold leads would $7-each buy? Only $7 is fixed; leadSpend is theirs.
    const exclusiveForSameSpend = Math.floor(leadSpend / COST_PER_RECOVERED);
    return { recovered, bookedJobs, monthlyRevenue, monthlyCost, exclusiveForSameSpend };
  }, [visitors, avgJob, recoveryPct, bookedPct, leadSpend]);

  // In ripoff mode, carry the live inputs to the demo so /demo/done can echo
  // them later (Phase 2 loop). Params are harmless until then.
  const ctaFinalHref = isRipoff && !ctaHref.startsWith("#")
    ? `${ctaHref}${ctaHref.includes("?") ? "&" : "?"}visitors=${visitors}&avgJob=${avgJob}&spend=${leadSpend}`
    : ctaHref;

  const isDark = variant === "dark";

  const card = isDark
    ? "bg-[#0A1628] text-white ring-1 ring-inset ring-white/10"
    : "bg-white text-[color:var(--color-ink)] ring-1 ring-inset ring-[color:var(--color-rule)]";
  const muted = isDark ? "text-slate-300" : "text-[color:var(--color-ink-2)]";
  const dim = isDark ? "text-slate-400" : "text-[color:var(--color-ink-muted)]";
  const inputTrack = isDark ? "bg-white/10" : "bg-[color:var(--color-bg-alt)]";

  return (
    <div className={`overflow-hidden rounded-2xl ${card} shadow-[0_18px_40px_-24px_rgba(10,22,40,0.18)]`}>
      <div className="grid gap-0 md:grid-cols-2">
        {/* Inputs */}
        <div className={`p-7 md:p-9 ${isDark ? "border-b border-white/10 md:border-b-0 md:border-r md:border-white/10" : "border-b border-[color:var(--color-rule)] md:border-b-0 md:border-r md:border-[color:var(--color-rule)]"}`}>
          <div className="mb-6 flex items-center gap-3">
            <span className={`inline-flex size-9 items-center justify-center rounded-xl ${isDark ? "bg-white/10" : "bg-[color:var(--color-bg-alt)]"}`}>
              <IconCalculator size={18} stroke={1.75} />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold tracking-tight">{title}</h3>
              {blurb && <p className={`text-[13px] ${muted}`}>{blurb}</p>}
            </div>
          </div>

          <div className="space-y-6">
            {/* Visitors */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="rc-visitors" className="text-sm font-semibold">Monthly website visitors</label>
                <span className="font-display text-lg font-bold tabular-nums">{visitors.toLocaleString()}</span>
              </div>
              <input
                id="rc-visitors"
                type="range"
                min={200}
                max={20000}
                step={100}
                value={visitors}
                onChange={(e) => setVisitors(Number(e.target.value))}
                className={`w-full appearance-none rounded-full ${inputTrack} h-2 accent-[color:var(--color-brand)]`}
              />
              <div className={`mt-1 flex justify-between text-[11px] ${dim}`}>
                <span>200</span><span>20,000</span>
              </div>
            </div>

            {/* Avg job */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="rc-avgjob" className="text-sm font-semibold">Average job value</label>
                <span className="font-display text-lg font-bold tabular-nums">{fmtUsd0(avgJob)}</span>
              </div>
              <input
                id="rc-avgjob"
                type="range"
                min={150}
                max={25000}
                step={50}
                value={avgJob}
                onChange={(e) => setAvgJob(Number(e.target.value))}
                className={`w-full appearance-none rounded-full ${inputTrack} h-2 accent-[color:var(--color-brand)]`}
              />
              <div className={`mt-1 flex justify-between text-[11px] ${dim}`}>
                <span>$150</span><span>$25,000</span>
              </div>
            </div>

            {/* Your assumptions — recovery rate */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="rc-recovery" className="text-sm font-semibold">Recovery rate <span className={`font-normal ${dim}`}>(your assumption)</span></label>
                <span className="font-display text-lg font-bold tabular-nums">{recoveryPct}%</span>
              </div>
              <input
                id="rc-recovery"
                type="range"
                min={1}
                max={30}
                step={1}
                value={recoveryPct}
                onChange={(e) => setRecoveryPct(Number(e.target.value))}
                className={`w-full appearance-none rounded-full ${inputTrack} h-2 accent-[color:var(--color-brand)]`}
              />
              <div className={`mt-1 flex justify-between text-[11px] ${dim}`}>
                <span>1%</span><span>of bounced visitors who consent · 30%</span>
              </div>
            </div>

            {/* Your assumptions — recovered-to-booked rate */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <label htmlFor="rc-booked" className="text-sm font-semibold">Recovered → booked <span className={`font-normal ${dim}`}>(your assumption)</span></label>
                <span className="font-display text-lg font-bold tabular-nums">{bookedPct}%</span>
              </div>
              <input
                id="rc-booked"
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={bookedPct}
                onChange={(e) => setBookedPct(Number(e.target.value))}
                className={`w-full appearance-none rounded-full ${inputTrack} h-2 accent-[color:var(--color-brand)]`}
              />
              <div className={`mt-1 flex justify-between text-[11px] ${dim}`}>
                <span>0.5%</span><span>of recovered records · 10%</span>
              </div>
            </div>

            {/* Ripoff mode — current lead-site spend (their number) */}
            {isRipoff && (
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <label htmlFor="rc-spend" className="text-sm font-semibold">What you spend on lead sites / month</label>
                  <span className="font-display text-lg font-bold tabular-nums">{fmtUsd0(leadSpend)}</span>
                </div>
                <input
                  id="rc-spend"
                  type="range"
                  min={0}
                  max={10000}
                  step={100}
                  value={leadSpend}
                  onChange={(e) => setLeadSpend(Number(e.target.value))}
                  className={`w-full appearance-none rounded-full ${inputTrack} h-2 accent-[color:var(--color-brand)]`}
                />
                <div className={`mt-1 flex justify-between text-[11px] ${dim}`}>
                  <span>$0</span><span>shared leads, sold to four other guys · $10,000</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Output */}
        <div className="flex flex-col justify-between p-7 md:p-9">
          {isRipoff ? (
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.14em] ${isDark ? "text-[color:var(--color-mint-400)]" : "text-[color:var(--color-brand-pressed)]"}`}>
                The lead-site math
              </p>
              <p className="mt-3 font-display text-5xl font-black tracking-tight tabular-nums md:text-6xl">
                {numbers.exclusiveForSameSpend.toLocaleString()}
              </p>
              <p className={`mt-1 text-sm font-semibold ${muted}`}>exclusive leads / month — for what you already spend</p>
              <p className={`mt-3 text-sm ${muted}`}>
                <strong className={isDark ? "text-white" : "text-[color:var(--color-ink)]"}>{fmtUsd0(leadSpend)}/mo</strong> to the machine buys shared leads that go to four other guys the second you get them. The same money, owned, buys{" "}
                <strong className="tabular-nums">{numbers.exclusiveForSameSpend.toLocaleString()}</strong> leads that are yours alone — at $7 each, never resold.
              </p>
              <p className={`mt-3 text-sm ${muted}`}>
                And the traffic already on your site? At your assumptions that's about{" "}
                <strong className="tabular-nums">{fmtUsd0(numbers.monthlyRevenue)}</strong> in recoverable monthly job revenue.
              </p>
            </div>
          ) : (
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.14em] ${isDark ? "text-[color:var(--color-mint-400)]" : "text-[color:var(--color-brand-pressed)]"}`}>
                Recoverable monthly job revenue
              </p>
              <p className="mt-3 font-display text-5xl font-black tracking-tight tabular-nums md:text-6xl">
                {fmtUsd0(numbers.monthlyRevenue)}
              </p>
              <p className={`mt-2 text-sm ${muted}`}>
                On the same ad budget you already run — at your assumptions, recovered visitors turn into roughly{" "}
                <strong className={isDark ? "text-white" : "text-[color:var(--color-ink)]"}>
                  {numbers.bookedJobs < 1 ? numbers.bookedJobs.toFixed(1) : Math.round(numbers.bookedJobs)} booked jobs / month
                </strong>{" "}
                at {fmtUsd0(avgJob)} average, for about{" "}
                <strong className="tabular-nums">{fmtUsd0(numbers.monthlyCost)}</strong>/mo in recovery cost at $7 per recovered lead.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <a
              href={ctaFinalHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-brand)] px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[color:var(--color-navy-900)] transition-all hover:-translate-y-0.5 hover:bg-[color:var(--color-brand-pressed)] hover:text-white"
            >
              {ctaLabel} <IconArrowRight size={16} stroke={2.5} />
            </a>

            <p className={`text-[11px] leading-relaxed ${dim}`}>
              Illustrative only. Set your own assumptions — results depend on your traffic, close rate, and follow-up speed. We don't publish performance claims; see <a href="/stats/" className="underline">/stats/</a> for sourced industry data. The only fixed number is the flat $7 per recovered lead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
