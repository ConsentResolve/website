import { useEffect, useRef, useState } from "react";
import type { Icon } from "@tabler/icons-react";

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  label?: string;
  hint?: string;
  Icon?: Icon;
  align?: "left" | "center";
  size?: "md" | "lg" | "xl";
  tone?: "ink" | "brand" | "danger";
}

export default function AnimatedStat({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1500,
  label,
  hint,
  Icon: IconCmp,
  align = "left",
  size = "lg",
  tone = "ink",
}: Props) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setCurrent(value);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !fired.current) {
            fired.current = true;
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (reduceMotion) {
              setCurrent(value);
              return;
            }
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - p, 3);
              setCurrent(value * eased);
              if (p < 1) requestAnimationFrame(tick);
              else setCurrent(value);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, duration]);

  const display = current.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });

  const sizeClass =
    size === "xl"
      ? "text-6xl md:text-7xl"
      : size === "lg"
      ? "text-4xl md:text-5xl"
      : "text-3xl md:text-4xl";

  const toneClass =
    tone === "brand"
      ? "text-[var(--color-brand)]"
      : tone === "danger"
      ? "text-[#dc2626]"
      : "text-[var(--color-ink)]";

  return (
    <div
      ref={ref}
      className={`${align === "center" ? "text-center" : "text-left"}`}
    >
      {IconCmp && (
        <div className={`mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] ${align === "center" ? "" : ""}`}>
          <IconCmp size={20} stroke={1.75} color="#00A86E" />
        </div>
      )}
      <div className={`font-display font-bold leading-none tracking-tight ${sizeClass} ${toneClass}`}>
        {prefix}
        {display}
        {suffix}
      </div>
      {label && (
        <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
          {label}
        </div>
      )}
      {hint && (
        <div className="mt-1 text-sm text-[var(--color-ink-2)]">{hint}</div>
      )}
    </div>
  );
}
