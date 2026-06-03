import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";

export interface AccordionItem {
  question: string;
  answer: string;
}

interface Props {
  items: AccordionItem[];
  defaultOpen?: number;
  allowMultiple?: boolean;
}

/**
 * AccordionLarge — PREVIEW variant. Scales the canonical Accordion's
 * type, padding, and icon roughly 1.75× and gives each row its own
 * rounded bordered card. NOT wired into any production page yet — only
 * previewed in /style-guide/faq/. Promote when approved.
 */
export default function AccordionLarge({
  items,
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

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div
          key={i}
          className={`overflow-hidden rounded-2xl bg-white ring-1 ring-inset transition-colors ${
            isOpen(i) ? "ring-[#cdd5e0]" : "ring-[#e6e6e6]"
          }`}
        >
          <button
            type="button"
            onClick={() => toggle(i)}
            className="flex w-full items-center justify-between gap-6 px-8 py-7 text-left transition-colors hover:bg-[#FAFBFC]"
            aria-expanded={isOpen(i)}
          >
            <span className="font-display text-xl font-bold tracking-tight text-[#0A1628] md:text-[22px]">
              {item.question}
            </span>
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-[#0A1628] transition-transform ${
                isOpen(i) ? "rotate-180 bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-pressed)]" : ""
              }`}
            >
              <IconChevronDown size={22} stroke={2.25} />
            </span>
          </button>
          {isOpen(i) && (
            <div className="border-t border-[#e6e6e6] px-8 pb-8 pt-6 text-[17px] leading-relaxed text-[#3d4338]">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
