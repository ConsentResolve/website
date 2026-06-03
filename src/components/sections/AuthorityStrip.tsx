import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconBrandLinkedin, IconX } from "@tabler/icons-react";
import { TEAM, getInitials, type TeamMember, type Credential } from "~/data/team";

interface CardItem {
  member: TeamMember;
  credential: Credential;
}

function Avatar({ member, size = 48, ring = true }: { member: TeamMember; size?: number; ring?: boolean }) {
  const initials = getInitials(member.name);
  const fontSize = Math.round(size * 0.38);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {member.photo ? (
        <img
          src={member.photo}
          alt={member.name}
          width={size}
          height={size}
          className={`rounded-full object-cover ${ring ? "ring-2 ring-[color:var(--color-mint-400)]" : ""}`}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-full bg-[color:var(--color-navy-900)] font-display font-black text-[color:var(--color-mint-400)] ${
            ring ? "ring-2 ring-[color:var(--color-mint-400)]" : ""
          }`}
          style={{ width: size, height: size, fontSize }}
        >
          {initials}
        </div>
      )}
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-[color:var(--color-mint-400)] ring-2 ring-[color:var(--color-bg)]"
      >
        <IconCheck size={12} stroke={3} color="#0A1628" />
      </span>
    </div>
  );
}

export default function AuthorityStrip() {
  // Flatten all credentials, one card per credential
  const items = useMemo<CardItem[]>(() => {
    const flat: CardItem[] = [];
    for (const member of TEAM) {
      for (const credential of member.credentials) {
        flat.push({ member, credential });
      }
    }
    return flat;
  }, []);

  // Duplicate the array so the marquee can loop seamlessly
  const looped = useMemo(() => [...items, ...items], [items]);

  const [open, setOpen] = useState<TeamMember | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Lock scroll while drawer open + close on Escape. We snapshot the
  // pre-open overflow value on the first activation and restore it on
  // every cleanup (open-change OR unmount). A second effect below acts
  // as an unconditional unmount safety net in case the drawer is open
  // when the component itself goes away.
  const prevOverflowRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (prevOverflowRef.current === null) prevOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflowRef.current ?? "";
      prevOverflowRef.current = null;
    };
  }, [open]);

  // Belt-and-suspenders: if the component unmounts while a drawer is
  // open AND React skips the per-`open` cleanup for any reason,
  // restore the body overflow here.
  useEffect(() => {
    return () => {
      if (prevOverflowRef.current !== null) {
        document.body.style.overflow = prevOverflowRef.current;
        prevOverflowRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative">
      {/* Edge fades */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[color:var(--color-bg)] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[color:var(--color-bg)] to-transparent"
      />

      <div className="overflow-hidden">
        <ul
          className={`flex gap-4 ${reducedMotion ? "" : "animate-cr-marquee"}`}
          style={{ width: "max-content" }}
        >
          {looped.map((item, i) => (
            <li key={`${item.member.slug}-${item.credential.headline}-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setOpen(item.member)}
                className="group flex w-[320px] items-center gap-4 rounded-2xl bg-[color:var(--color-bg-alt)] p-4 text-left ring-1 ring-inset ring-[color:var(--color-rule)] transition-all hover:-translate-y-0.5 hover:ring-[color:var(--color-mint-400)]/50 hover:shadow-[0_18px_36px_-24px_rgba(10,22,40,0.25)]"
                aria-label={`See credentials for ${item.member.name}`}
              >
                <Avatar member={item.member} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-brand-pressed)]">
                    {item.credential.badge}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[color:var(--color-ink)]">
                    {item.credential.headline}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Slide-out drawer */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={() => setOpen(null)}
            className="absolute inset-0 bg-[color:var(--color-navy-900)]/70 backdrop-blur-sm"
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[color:var(--color-bg)] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-rule)] p-6">
              <div className="flex items-center gap-4">
                <Avatar member={open} size={64} />
                <div>
                  <p
                    id="drawer-title"
                    className="font-display text-xl font-black tracking-tight text-[color:var(--color-ink)]"
                  >
                    {open.name}
                  </p>
                  <p className="text-sm text-[color:var(--color-ink-muted)]">{open.role}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="rounded-lg p-2 text-[color:var(--color-ink-muted)] transition-colors hover:bg-[color:var(--color-bg-alt)] hover:text-[color:var(--color-ink)]"
              >
                <IconX size={20} stroke={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--color-brand-pressed)]">
                Why this matters for you
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--color-ink-2)]">
                {open.whyItMatters}
              </p>

              <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--color-brand-pressed)]">
                Verified credentials
              </p>
              <ul className="mt-4 space-y-3">
                {open.verified.map((v) => (
                  <li key={v} className="flex items-start gap-3 text-sm leading-snug text-[color:var(--color-ink-2)]">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-soft)]">
                      <IconCheck size={12} stroke={3} color="var(--color-brand-pressed)" />
                    </span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-[color:var(--color-rule)] p-6">
              <a
                href={open.linkedin}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--color-brand)] px-5 py-3 text-sm font-bold text-[color:var(--color-navy-900)] transition-colors hover:bg-[color:var(--color-brand-pressed)] hover:text-white"
              >
                <IconBrandLinkedin size={18} stroke={2} />
                View LinkedIn profile
              </a>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
