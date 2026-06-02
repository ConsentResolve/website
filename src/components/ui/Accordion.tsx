import { useState } from "react";
import { IconPlus, IconMinus, IconChevronDown } from "@tabler/icons-react";

export interface AccordionItem {
  question: string;
  answer: string;
}

interface Props {
  items: AccordionItem[];
  variant?: "plus" | "chevron" | "boxed";
  defaultOpen?: number; // index
  allowMultiple?: boolean;
}

export default function Accordion({
  items,
  variant = "chevron",
  defaultOpen = -1,
  allowMultiple = false,
}: Props) {
  const [open, setOpen] = useState<number[]>(defaultOpen >= 0 ? [defaultOpen] : []);
  const toggle = (i: number) => {
    setOpen((prev) =>
      prev.includes(i)
        ? prev.filter((x) => x !== i)
        : allowMultiple ? [...prev, i] : [i],
    );
  };
  const isOpen = (i: number) => open.includes(i);

  if (variant === "boxed") {
    return (
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-[#e6e6e6]">
            <button
              onClick={() => toggle(i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#F9F9F9]"
              aria-expanded={isOpen(i)}
            >
              <span className="font-semibold tracking-tight text-[#0A1628]">{item.question}</span>
              <IconChevronDown
                size={18}
                stroke={2}
                className={`shrink-0 text-[#4A5568] transition-transform ${isOpen(i) ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen(i) && (
              <div className="border-t border-[#e6e6e6] px-5 py-4 text-[14px] leading-relaxed text-[#3d4338]">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#e6e6e6]">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => toggle(i)}
            className="group flex w-full items-center justify-between gap-4 py-4 text-left"
            aria-expanded={isOpen(i)}
          >
            <span className="font-semibold tracking-tight text-[#0A1628] group-hover:text-[#00A86E] transition-colors">
              {item.question}
            </span>
            {variant === "plus" ? (
              <span className="shrink-0">
                {isOpen(i) ? (
                  <IconMinus size={18} stroke={2.25} className="text-[#00A86E]" />
                ) : (
                  <IconPlus size={18} stroke={2.25} className="text-[#4A5568]" />
                )}
              </span>
            ) : (
              <IconChevronDown
                size={18}
                stroke={2}
                className={`shrink-0 text-[#4A5568] transition-transform ${isOpen(i) ? "rotate-180" : ""}`}
              />
            )}
          </button>
          {isOpen(i) && (
            <div className="pb-5 pr-8 text-[14px] leading-relaxed text-[#3d4338]">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
