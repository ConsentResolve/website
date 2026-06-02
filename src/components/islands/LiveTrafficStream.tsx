import { useEffect, useState } from "react";

type Row =
  | { kind: "anon" }
  | { kind: "revealed"; name: string; phone: string; intent: string; ago: string };

const REVEALS: Array<{ name: string; phone: string; intent: string }> = [
  { name: "Sarah Jenkins", phone: "(512) 555-0142", intent: "Water heater quote · Austin, TX" },
  { name: "Marcus Tate", phone: "(404) 555-0188", intent: "Roof inspection · Atlanta, GA" },
  { name: "Priya Shah", phone: "(602) 555-0107", intent: "AC repair · Phoenix, AZ" },
  { name: "Diego Romero", phone: "(305) 555-0163", intent: "Drain unclog · Miami, FL" },
];

export default function LiveTrafficStream() {
  const [rows, setRows] = useState<Row[]>([
    { kind: "anon" },
    { kind: "revealed", ...REVEALS[0], ago: "2m ago" },
    { kind: "anon" },
  ]);
  const [cursor, setCursor] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      const next = REVEALS[cursor % REVEALS.length];
      setRows([
        { kind: "anon" },
        { kind: "revealed", ...next, ago: "just now" },
        { kind: "anon" },
      ]);
      setCursor((c) => c + 1);
    }, 3500);
    return () => clearInterval(id);
  }, [cursor]);

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-[color:var(--color-brand)]/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--color-rule)] bg-white p-8 shadow-[0_24px_48px_-24px_rgba(19,22,17,0.18)]">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="font-bold text-[color:var(--color-ink)]">Live Lead Stream</h3>
          <span className="flex items-center gap-2 rounded-full bg-[color:var(--color-brand-soft)] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[color:var(--color-brand)]">
            <span className="size-1.5 rounded-full bg-[color:var(--color-brand)] animate-pulse" />
            Live
          </span>
        </div>
        <div className="space-y-4">
          {rows.map((row, i) =>
            row.kind === "anon" ? (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg border border-dashed border-[color:var(--color-rule)] bg-[color:var(--color-bg-alt)] p-4 opacity-70"
              >
                <span className="material-symbols-outlined !text-[color:var(--color-ink-muted)]">
                  person_off
                </span>
                <div className="h-2 flex-1 rounded bg-[color:var(--color-rule)]" />
                <div className="h-2 w-12 rounded bg-[color:var(--color-rule)]" />
              </div>
            ) : (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg border border-[color:var(--color-brand)]/30 bg-[color:var(--color-brand-soft)] p-4 transition-all"
              >
                <span className="material-symbols-outlined">person_check</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[color:var(--color-ink)]">
                    {row.name} <span className="text-[color:var(--color-brand)]">· consented</span>
                  </div>
                  <div className="text-xs text-[color:var(--color-ink-2)]">
                    {row.phone} • {row.intent}
                  </div>
                </div>
                <div className="font-mono text-xs text-[color:var(--color-ink-muted)]">{row.ago}</div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
