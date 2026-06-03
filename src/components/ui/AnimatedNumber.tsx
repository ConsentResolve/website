import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
}

/**
 * Animated count-up number. SSR renders the FINAL value so crawlers and
 * users on slow networks don't see "0" flashes; the effect then resets
 * to 0 on mount and counts up to `value` once the element is visible.
 */
export default function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  duration = 1400,
  decimals = 0,
  className,
}: Props) {
  // SSR / first paint: render the final value so crawlers see it.
  const [current, setCurrent] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // On first effect run after hydration, reset the displayed value to
    // 0 so the count-up has somewhere to start. If reduced-motion is on,
    // or IntersectionObserver isn't available, skip the animation and
    // leave the final value showing.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!mounted.current) {
      mounted.current = true;
      if (reduceMotion || !("IntersectionObserver" in window)) {
        setCurrent(value);
        return;
      }
      setCurrent(0);
    }

    if (!("IntersectionObserver" in window)) {
      setCurrent(value);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !fired.current) {
            fired.current = true;
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

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
