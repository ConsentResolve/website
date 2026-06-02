import { useEffect, useState } from "react";

type Row =
  | { kind: "anon" }
  | { kind: "revealed"; name: string; email: string; role: string; ago: string };

const REVEALS: Array<{ name: string; email: string; role: string }> = [
  { name: "Sarah Jenkins", email: "sarah.j@enterprise.co", role: "Marketing Director" },
  { name: "Marcus Tate", email: "mtate@northridge.io", role: "VP of Sales" },
  { name: "Priya Shah", email: "priya@verdantworks.com", role: "Head of Growth" },
  { name: "Diego Romero", email: "d.romero@hillsidehvac.com", role: "Owner" },
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
      <div className="absolute -inset-4 rounded-full bg-[color:var(--color-primary)]/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--color-card-dark)] p-8">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="font-bold">Live Traffic Stream</h3>
          <span className="animate-pulse rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-400">
            LIVE
          </span>
        </div>
        <div className="space-y-4">
          {rows.map((row, i) =>
            row.kind === "anon" ? (
              <div key={i} className="flex items-center gap-4 rounded-lg bg-white/5 p-4 opacity-40">
                <span className="material-symbols-outlined !text-slate-500">person_off</span>
                <div className="h-2 flex-1 rounded bg-slate-700" />
                <div className="h-2 w-12 rounded bg-slate-700" />
              </div>
            ) : (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/10 p-4 transition-all"
              >
                <span className="material-symbols-outlined">person_check</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-[color:var(--color-primary)]">
                    {row.name} revealed
                  </div>
                  <div className="text-xs text-slate-400">
                    {row.email} • {row.role}
                  </div>
                </div>
                <div className="font-mono text-xs">{row.ago}</div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
