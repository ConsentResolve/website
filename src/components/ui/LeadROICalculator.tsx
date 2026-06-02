import Calculator from "./Calculator";

interface Props { variant?: "default" | "dark" }

export default function LeadROICalculator({ variant = "default" }: Props) {
  const fmtUsd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <Calculator
      variant={variant}
      title="Lead ROI calculator"
      blurb="Estimate the monthly upside of switching from shared leads to consented exclusive leads."
      inputs={[
        { key: "leads", label: "Leads per month", defaultValue: 60, min: 10, max: 500, step: 5 },
        { key: "closeRate", label: "Close rate", suffix: "%", defaultValue: 28, min: 5, max: 60, step: 1 },
        { key: "avgJob", label: "Avg job value", prefix: "$", defaultValue: 850, min: 150, max: 8000, step: 50 },
        { key: "leadCost", label: "Cost per lead (current)", prefix: "$", defaultValue: 48, min: 5, max: 200, step: 1 },
      ]}
      outputs={[
        {
          key: "revenue",
          label: "Monthly revenue",
          highlight: true,
          format: (v) => fmtUsd(v.leads * (v.closeRate / 100) * v.avgJob),
          hint: (v) => `${Math.round(v.leads * (v.closeRate / 100))} jobs booked / month`,
        },
        {
          key: "spend",
          label: "Current monthly lead spend",
          format: (v) => fmtUsd(v.leads * v.leadCost),
        },
        {
          key: "cac",
          label: "Cost per acquired customer",
          format: (v) => {
            const closed = v.leads * (v.closeRate / 100);
            return closed > 0 ? fmtUsd((v.leads * v.leadCost) / closed) : "—";
          },
        },
        {
          key: "annual",
          label: "Annualized revenue",
          format: (v) => fmtUsd(v.leads * (v.closeRate / 100) * v.avgJob * 12),
        },
      ]}
      cta={{ label: "Start $10 Trial", href: "/get-started/" }}
    />
  );
}
