import { useMemo, useState, type ReactNode } from "react";
import { IconCalculator } from "@tabler/icons-react";

export interface InputField {
  key: string;
  label: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number;
}

export interface OutputField {
  key: string;
  label: string;
  format: (values: Record<string, number>) => string;
  highlight?: boolean;
  hint?: (values: Record<string, number>) => string;
}

interface Props {
  title: string;
  blurb?: string;
  inputs: InputField[];
  outputs: OutputField[];
  cta?: { label: string; href: string };
  variant?: "default" | "dark";
}

export default function Calculator({
  title,
  blurb,
  inputs,
  outputs,
  cta,
  variant = "default",
}: Props) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(inputs.map((i) => [i.key, i.defaultValue])),
  );

  const computed = useMemo(() => {
    return outputs.map((o) => ({
      ...o,
      formatted: o.format(values),
      hintText: o.hint?.(values),
    }));
  }, [values, outputs]);

  const isDark = variant === "dark";

  return (
    <div
      className={`grid gap-0 overflow-hidden rounded-2xl md:grid-cols-2 ${
        isDark
          ? "bg-[#0A1628] text-white"
          : "bg-white ring-1 ring-inset ring-[#e6e6e6]"
      }`}
      style={{
        boxShadow: isDark
          ? "0 30px 60px -20px rgba(10,22,40,0.4)"
          : "0 12px 32px -16px rgba(10,22,40,0.18)",
      }}
    >
      {/* Inputs */}
      <div className={`p-7 ${isDark ? "border-b border-white/10 md:border-b-0 md:border-r md:border-white/10" : "border-b border-[#e6e6e6] md:border-b-0 md:border-r"}`}>
        <div className="mb-6 flex items-center gap-2">
          <IconCalculator size={18} stroke={1.75} color={isDark ? "#00E5A0" : "#00A86E"} />
          <h3
            className={`font-display text-lg font-bold tracking-tight ${
              isDark ? "text-white" : "text-[#0A1628]"
            }`}
          >
            {title}
          </h3>
        </div>
        {blurb && (
          <p className={`mb-6 text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-[#3d4338]"}`}>
            {blurb}
          </p>
        )}
        <div className="space-y-5">
          {inputs.map((f) => {
            const v = values[f.key];
            return (
              <div key={f.key}>
                <div className="mb-2 flex items-baseline justify-between">
                  <label className={`text-xs font-semibold uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-[#4A5568]"}`}>
                    {f.label}
                  </label>
                  <div className={`font-mono text-sm font-semibold ${isDark ? "text-[#00E5A0]" : "text-[#0A1628]"}`}>
                    {f.prefix}
                    {v.toLocaleString()}
                    {f.suffix}
                  </div>
                </div>
                <input
                  type="range"
                  min={f.min ?? 0}
                  max={f.max ?? 100}
                  step={f.step ?? 1}
                  value={v}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
                  }
                  className={`w-full accent-[#00C080] ${isDark ? "" : ""}`}
                  style={{ accentColor: isDark ? "#00E5A0" : "#00C080" }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Outputs */}
      <div className="p-7">
        <div className={`mb-5 text-xs font-semibold uppercase tracking-[0.14em] ${isDark ? "text-slate-400" : "text-[#4A5568]"}`}>
          Your results
        </div>
        <div className="space-y-4">
          {computed.map((o) => (
            <div
              key={o.key}
              className={`rounded-xl p-4 ${
                o.highlight
                  ? isDark
                    ? "bg-[#00E5A0]/12 ring-1 ring-inset ring-[#00E5A0]/30"
                    : "bg-[#e6faf3] ring-1 ring-inset ring-[#00C080]/30"
                  : isDark
                  ? "bg-white/5"
                  : "bg-[#F9F9F9]"
              }`}
            >
              <div className={`text-xs font-medium uppercase tracking-[0.12em] ${isDark ? "text-slate-400" : "text-[#4A5568]"}`}>
                {o.label}
              </div>
              <div
                className={`mt-1 font-display text-3xl font-bold tracking-tight leading-none ${
                  o.highlight
                    ? isDark
                      ? "text-[#00E5A0]"
                      : "text-[#00A86E]"
                    : isDark
                    ? "text-white"
                    : "text-[#0A1628]"
                }`}
              >
                {o.formatted}
              </div>
              {o.hintText && (
                <div className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-[#4A5568]"}`}>{o.hintText}</div>
              )}
            </div>
          ))}
        </div>
        {cta && (
          <a
            href={cta.href}
            className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${
              isDark
                ? "bg-[#00E5A0] text-[#0A1628] hover:bg-[#00f5b0]"
                : "bg-[#00C080] text-white hover:bg-[#00A86E]"
            }`}
          >
            {cta.label}
          </a>
        )}
      </div>
    </div>
  );
}
