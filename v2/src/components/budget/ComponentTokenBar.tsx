"use client";

import type { BudgetComponent } from "@/types/budget";

interface ComponentTokenBarProps {
  components: BudgetComponent[];
  bushelsPerMt?: number;
}

function toPerBu(value: number, unit: string, bushelsPerMt: number): number {
  switch (unit) {
    case "$/bu":
      return value;
    case "$/MT":
      return bushelsPerMt > 0 ? value / bushelsPerMt : 0;
    default:
      return value;
  }
}

const PILL_COLORS = [
  "bg-[#1a3a5c]/60 text-[#7db8f0]",
  "bg-[#2d1a4e]/60 text-[#b89cf0]",
  "bg-[#1a4e3a]/60 text-[#7df0b8]",
  "bg-[#4e3a1a]/60 text-[#f0c87d]",
  "bg-[#4e1a2d]/60 text-[#f07db8]",
  "bg-[#1a4e4e]/60 text-[#7df0f0]",
  "bg-[#3a4e1a]/60 text-[#b8f07d]",
];

export function ComponentTokenBar({ components, bushelsPerMt = 39.3683 }: ComponentTokenBarProps) {
  if (!components || components.length === 0) return null;

  // Compute all-in total
  let allIn = 0;
  for (const c of components) {
    if (c.unit === "%") {
      allIn += allIn * (Number(c.target_value) / 100);
    } else {
      allIn += toPerBu(Number(c.target_value), c.unit, bushelsPerMt);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {components.map((c, i) => (
        <span
          key={i}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs tabular-nums ${PILL_COLORS[i % PILL_COLORS.length]}`}
        >
          {c.component_name}: {c.unit === "%" ? `${Number(c.target_value).toFixed(1)}%` : Number(c.target_value).toFixed(2)}
        </span>
      ))}
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-profit/15 text-profit tabular-nums">
        = ${allIn.toFixed(4)}/bu
      </span>
    </div>
  );
}
