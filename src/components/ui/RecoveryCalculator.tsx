import { useMemo, useState } from "react";
import { IconArrowRight, IconCalculator } from "@tabler/icons-react";

/**
 * Recovery Calculator — one job: show a home-service contractor the
 * monthly job-revenue upside of recovering their bounced website
 * traffic.
 *
 * Per the repositioning brief:
 *  - Exactly two inputs (sliders only): monthly visitors, avg job value
 *  - ONE hero output: recoverable monthly job revenue
 *  - A break-even credibility line ("you only need N booked jobs to cover the cost")
 *  - All other math constants baked + disclosed in small-print
 *
 * Baked constants (matches the compare/[platform] page disclosure):
 *  - 98% bounce
 *  - 15% of bouncers are recovered (consent-adjusted)
 *  - 1% of recovered visitors become booked jobs
 *  - $7 per recovered lead (Consent Resolve cost)
 */

interface Props {
  variant?: "default" | "dark";
  defaults?: {
    visitors?: number;
    avgJob?: number;
  };
  title?: string;
  blurb?: string;
}

const BOUNCE_RATE = 0.98;
const RECOVERY_RATE = 0.15; // of bounced
const BOOKED_RATE = 0.01;   // of recovered
const COST_PER_RECOVERED = 7;

const fmtUsd0 = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));

export default function RecoveryCalculator({
  variant = "default",
  defaults = {},
  title = "Recoverable revenue calculator",
  blurb = "Slide your real numbers. Two inputs, one answer.",
}: Props) {
  const [visitors, setVisitors] = useState<number>(defaults.visitors ?? 2_000);
  const [avgJob, setAvgJob] = useState<number>(defaults.avgJob ?? 850);

  const numbers = useMemo(() => {
    const bouncers = visitors * BOUNCE_RATE;
    const recovered = bouncers * RECOVERY_RATE;
    const bookedJobs = recovered * BOOKED_RATE;
    const monthlyRevenue = bookedJobs * avgJob;
    const monthlyCost = recovered * COST_PER_RECOVERED;
    const breakEvenJobs = avgJob > 0 ? Math.max(1, Math.ceil(monthlyCost / avgJob)) : 0;
    return {
      recovered,
      bookedJobs,
      monthlyRevenue,
      monthlyCost,
      breakEvenJobs,
    };
  }, [visitors, avgJob]);

  const isDark = variant === "dark";

  // Shared surface tokens
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
          </div>
        </div>

        {/* Output */}
        <div className="flex flex-col justify-between p-7 md:p-9">
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.14em] ${isDark ? "text-[color:var(--color-mint-400)]" : "text-[color:var(--color-brand-pressed)]"}`}>
              Recoverable monthly job revenue
            </p>
            <p className="mt-3 font-display text-5xl font-black tracking-tight tabular-nums md:text-6xl">
              {fmtUsd0(numbers.monthlyRevenue)}
            </p>
            <p className={`mt-2 text-sm ${muted}`}>
              On the same ad budget you already run — recovered visitors turn into roughly{" "}
              <strong className={isDark ? "text-white" : "text-[color:var(--color-ink)]"}>
                {numbers.bookedJobs < 1 ? numbers.bookedJobs.toFixed(1) : Math.round(numbers.bookedJobs)} booked jobs / month
              </strong>{" "}
              at {fmtUsd0(avgJob)} average.
            </p>

            {/* Break-even credibility line */}
            <div className={`mt-6 rounded-xl p-4 ${isDark ? "bg-white/5 ring-1 ring-inset ring-white/10" : "bg-[color:var(--color-brand-soft)] ring-1 ring-inset ring-[color:var(--color-brand)]/30"}`}>
              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${isDark ? "text-[color:var(--color-mint-400)]" : "text-[color:var(--color-brand-pressed)]"}`}>
                Credibility check
              </p>
              <p className={`mt-1.5 text-[14px] leading-relaxed ${isDark ? "text-slate-200" : "text-[color:var(--color-ink)]"}`}>
                Recovery costs roughly <strong className="tabular-nums">{fmtUsd0(numbers.monthlyCost)}</strong>/mo at $7 per recovered lead. You only need{" "}
                <strong className="tabular-nums">{numbers.breakEvenJobs} booked job{numbers.breakEvenJobs === 1 ? "" : "s"}</strong>{" "}
                at {fmtUsd0(avgJob)} to cover that.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <a
              href="https://dashboard.consentresolve.com/register"
              className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] transition-all hover:-translate-y-0.5 ${
                isDark
                  ? "bg-[color:var(--color-brand)] text-[color:var(--color-navy-900)] hover:bg-[color:var(--color-brand-pressed)] hover:text-white"
                  : "bg-[color:var(--color-brand)] text-[color:var(--color-navy-900)] hover:bg-[color:var(--color-brand-pressed)] hover:text-white"
              }`}
            >
              Get Started <IconArrowRight size={16} stroke={2.5} />
            </a>

            <p className={`text-[11px] leading-relaxed ${dim}`}>
              Math constants baked in: 98% of visitors bounce, 15% of bouncers are recovered (consent-adjusted), about 1% of recovered visitors become booked jobs, recovery costs $7 per recovered lead. Conservative defaults; real performance varies by trade, traffic quality, close rate, and how fast your funnel re-engages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
