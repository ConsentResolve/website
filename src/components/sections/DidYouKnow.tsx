import { useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconSparkles } from "@tabler/icons-react";
import { DID_YOU_KNOW } from "~/data/team";

const INTERVAL_MS = 4000;
const FADE_MS = 180;

export default function DidYouKnow() {
  const facts = DID_YOU_KNOW;
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const intervalRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const reducedMotionRef = useRef(false);

  // Track mount state so we don't setState after unmount, and cancel
  // every pending timer/interval on cleanup. Also cancel any in-flight
  // fade timer when rapid prev/next clicks fire (rather than queueing).
  useEffect(() => {
    mountedRef.current = true;
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
      if (fadeTimerRef.current) { window.clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
    };
  }, []);

  const goTo = (next: number) => {
    // Cancel any pending fade-in from a previous rapid click — otherwise
    // a fast user can stack timeouts and setState after unmount.
    if (fadeTimerRef.current) { window.clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
    setFade(false);
    fadeTimerRef.current = window.setTimeout(() => {
      fadeTimerRef.current = null;
      if (!mountedRef.current) return;
      setIdx(((next % facts.length) + facts.length) % facts.length);
      setFade(true);
    }, FADE_MS);
  };

  // Restart the autoplay interval whenever idx changes (or on first
  // mount). The cleanup at the top of the effect cancels any prior
  // interval before we set a new one, so they can't accumulate.
  useEffect(() => {
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
    if (reducedMotionRef.current) return;
    intervalRef.current = window.setInterval(() => {
      if (!mountedRef.current) return;
      goTo(idx + 1);
    }, INTERVAL_MS);
    return () => {
      if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[color:var(--color-navy-900)] via-[#0f1f3a] to-[color:var(--color-navy-900)] p-10 ring-1 ring-inset ring-white/10 shadow-[0_30px_60px_-30px_rgba(10,22,40,0.6)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[color:var(--color-mint-400)]/20 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -bottom-16 size-56 rounded-full bg-[color:var(--color-mint-400)]/10 blur-[90px]"
        />

        <div className="relative flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => goTo(idx - 1)}
            aria-label="Previous fact"
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-[color:var(--color-mint-400)]"
          >
            <IconChevronLeft size={22} stroke={2} />
          </button>

          <div className="min-h-[120px] flex-1 text-center">
            <p className="mb-3 inline-flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--color-mint-400)]">
              <IconSparkles size={12} stroke={2.25} />
              Did you know
            </p>
            <p
              aria-live="polite"
              className={`font-display text-2xl font-black leading-snug tracking-tight text-white transition-opacity duration-200 md:text-3xl ${
                fade ? "opacity-100" : "opacity-0"
              }`}
            >
              {facts[idx]}
            </p>
          </div>

          <button
            type="button"
            onClick={() => goTo(idx + 1)}
            aria-label="Next fact"
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-[color:var(--color-mint-400)]"
          >
            <IconChevronRight size={22} stroke={2} />
          </button>
        </div>

        <div className="relative mt-6 flex items-center justify-center gap-2">
          {facts.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to fact ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-6 bg-[color:var(--color-mint-400)]" : "w-1.5 bg-white/25 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-[color:var(--color-ink-muted)]">
        Facts pulled from public LinkedIn profiles.
      </p>
    </div>
  );
}
