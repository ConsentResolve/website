import Calculator from "./Calculator";

interface Props { variant?: "default" | "dark" }

export default function LeadCostCalculator({ variant = "default" }: Props) {
  const fmtUsd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <Calculator
      variant={variant}
      title="Lead cost calculator"
      blurb="Compare what you pay per booked job on shared-lead platforms vs. Consent Resolve."
      inputs={[
        { key: "leads", label: "Leads purchased per month", defaultValue: 80, min: 10, max: 500, step: 5 },
        { key: "sharedCost", label: "Avg shared-lead price", prefix: "$", defaultValue: 48, min: 5, max: 200, step: 1 },
        { key: "sharedCloseRate", label: "Shared-lead close rate", suffix: "%", defaultValue: 12, min: 1, max: 50, step: 1 },
        { key: "exclusiveCloseRate", label: "Exclusive-lead close rate", suffix: "%", defaultValue: 32, min: 5, max: 60, step: 1 },
      ]}
      outputs={[
        {
          key: "sharedCac",
          label: "Shared-lead cost per booked job",
          format: (v) => {
            const closed = v.leads * (v.sharedCloseRate / 100);
            return closed > 0 ? fmtUsd((v.leads * v.sharedCost) / closed) : "—";
          },
          hint: (v) => `${Math.round(v.leads * (v.sharedCloseRate / 100))} jobs booked / month`,
        },
        {
          key: "consentCac",
          label: "Consent Resolve cost per booked job",
          highlight: true,
          format: (v) => {
            const PER_LEAD = 7;
            const closed = v.leads * (v.exclusiveCloseRate / 100);
            return closed > 0 ? fmtUsd((v.leads * PER_LEAD) / closed) : "—";
          },
          hint: (v) => `${Math.round(v.leads * (v.exclusiveCloseRate / 100))} jobs booked at $7 a lead`,
        },
        {
          key: "savings",
          label: "Estimated monthly savings",
          format: (v) => {
            const PER_LEAD = 7;
            const sharedSpend = v.leads * v.sharedCost;
            const consentSpend = v.leads * PER_LEAD;
            return fmtUsd(Math.max(0, sharedSpend - consentSpend));
          },
        },
      ]}
      cta={{ label: "Get Started", href: "https://dashboard.consentresolve.com/register" }}
    />
  );
}
