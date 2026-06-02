import { useState } from "react";

interface Props {
  label?: string;
  description?: string;
  defaultOn?: boolean;
  size?: "sm" | "md";
}

export default function Toggle({ label, description, defaultOn = false, size = "md" }: Props) {
  const [on, setOn] = useState(defaultOn);
  const sm = size === "sm";
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative shrink-0 rounded-full transition-colors ${
          sm ? "h-5 w-9" : "h-6 w-11"
        } ${on ? "bg-[#00C080]" : "bg-[#cbd5e1]"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform ${
            sm ? "size-4" : "size-5"
          }`}
          style={{ transform: on ? (sm ? "translateX(16px)" : "translateX(20px)") : "translateX(0)" }}
        />
      </button>
      {(label || description) && (
        <div className="flex-1">
          {label && <div className="font-semibold text-[#0A1628]">{label}</div>}
          {description && <div className="text-sm text-[#4A5568]">{description}</div>}
        </div>
      )}
    </label>
  );
}
