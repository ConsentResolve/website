import { useState, type ReactNode } from "react";

export interface Tab {
  label: string;
  content: ReactNode;
  icon?: ReactNode;
}

interface Props {
  tabs: Tab[];
  variant?: "underline" | "pill" | "boxed";
  defaultIndex?: number;
}

export default function Tabs({ tabs, variant = "underline", defaultIndex = 0 }: Props) {
  const [active, setActive] = useState(defaultIndex);

  const tabClass = (i: number) => {
    if (variant === "pill") {
      return `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active === i
          ? "bg-[#0A1628] text-white"
          : "text-[#3d4338] hover:bg-[#F9F9F9]"
      }`;
    }
    if (variant === "boxed") {
      return `inline-flex items-center gap-2 rounded-t-lg border-x border-t px-5 py-2.5 text-sm font-semibold transition-colors -mb-px ${
        active === i
          ? "border-[#e6e6e6] bg-white text-[#0A1628]"
          : "border-transparent text-[#4A5568] hover:text-[#0A1628]"
      }`;
    }
    return `relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
      active === i
        ? "text-[#0A1628] after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-[#00C080]"
        : "text-[#4A5568] hover:text-[#0A1628]"
    }`;
  };

  return (
    <div>
      <div
        role="tablist"
        className={`flex flex-wrap items-center gap-1 ${
          variant === "underline" ? "border-b border-[#e6e6e6]" : variant === "boxed" ? "border-b border-[#e6e6e6]" : ""
        }`}
      >
        {tabs.map((t, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={tabClass(i)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div
        className={
          variant === "boxed"
            ? "rounded-b-lg rounded-tr-lg border border-[#e6e6e6] bg-white p-6"
            : "py-6"
        }
      >
        {tabs[active]?.content}
      </div>
    </div>
  );
}
