import { useState } from "react";
import { IconArrowsShuffle, IconCheck, IconCopy, IconExternalLink } from "@tabler/icons-react";
import type { Stat } from "~/data/stats";

interface Props {
  stats: Stat[];
}

/**
 * "Share a Random Stat" — picks a stat at random, shows it in a card,
 * and offers a one-click copy of a tweet-ready line with source URL.
 * Used in the /stats/ hero.
 */
export default function RandomStatButton({ stats }: Props) {
  const [picked, setPicked] = useState<Stat | null>(null);
  const [copied, setCopied] = useState(false);

  const pick = () => {
    if (!stats.length) return;
    // Avoid immediately repeating the same pick.
    let next: Stat;
    let safety = 6;
    do {
      next = stats[Math.floor(Math.random() * stats.length)];
      safety -= 1;
    } while (picked && next.label === picked.label && safety > 0);
    setPicked(next);
    setCopied(false);
  };

  const shareText = (s: Stat) =>
    `${s.value} ${s.label.toLowerCase()} — ${s.description} (${s.source.name}: ${s.source.url}) via @consentresolve`;

  const copy = async () => {
    if (!picked) return;
    try {
      await navigator.clipboard.writeText(shareText(picked));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for browsers without async clipboard
      const ta = document.createElement("textarea");
      ta.value = shareText(picked);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="inline-flex w-full max-w-2xl flex-col items-center">
      <button
        type="button"
        onClick={pick}
        className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-brand)] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-[color:var(--color-navy-900)] shadow-[0_18px_36px_-18px_rgba(0,229,160,0.55)] transition-all hover:-translate-y-0.5 hover:bg-[color:var(--color-brand-pressed)] hover:text-white"
      >
        <IconArrowsShuffle size={16} stroke={2.5} />
        Share a Random Stat
      </button>

      {picked && (
        <div className="mt-6 w-full overflow-hidden rounded-2xl bg-[color:var(--color-bg)] ring-1 ring-inset ring-[color:var(--color-rule)] shadow-[0_24px_48px_-24px_rgba(10,22,40,0.18)]">
          <span aria-hidden="true" className="block h-1 bg-[color:var(--color-brand)]"></span>
          <div className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-6">
              <div className="text-left">
                <div className="font-display text-4xl font-black tracking-tight text-[color:var(--color-brand-pressed)] sm:text-5xl">
                  {picked.value}
                </div>
                <p className="mt-3 font-display text-base font-bold tracking-tight text-[color:var(--color-ink)]">
                  {picked.label}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--color-ink-2)]">
                  {picked.description}
                </p>
              </div>
              <a
                href={picked.source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 self-start rounded-full bg-[color:var(--color-brand-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--color-brand-pressed)] transition-opacity hover:opacity-80"
              >
                {picked.source.name}
                <IconExternalLink size={11} stroke={2.25} />
              </a>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-navy-900)] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[color:var(--color-brand-pressed)]"
              >
                {copied ? (
                  <>
                    <IconCheck size={14} stroke={2.5} /> Copied
                  </>
                ) : (
                  <>
                    <IconCopy size={14} stroke={2.5} /> Copy share-ready text
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={pick}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)] ring-1 ring-inset ring-[color:var(--color-rule)] transition-colors hover:text-[color:var(--color-brand-pressed)] hover:ring-[color:var(--color-brand)]/50"
              >
                <IconArrowsShuffle size={14} stroke={2.5} />
                Pick another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
