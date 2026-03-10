"use client";

import type { BudgetComponent } from "@/types/budget";
import type { Commodity } from "@/hooks/usePositions";
import { toPerPriceUnit, formatPriceWithUnit } from "@/lib/commodity-units";

interface ComponentTokenBarProps {
  components: BudgetComponent[];
  commodity?: Commodity | null;
  /** @deprecated Use commodity prop instead */
  bushelsPerMt?: number;
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

export function ComponentTokenBar({ components, commodity, bushelsPerMt }: ComponentTokenBarProps) {
  if (!components || components.length === 0) return null;

  // Build a compat commodity object if only bushelsPerMt was passed (legacy callers)
  const effectiveCommodity: Commodity | null = commodity ?? (bushelsPerMt
    ? { id: "", name: "", category: "", unit: "", currency: "", exchange: "", config: { units_per_mt: bushelsPerMt } }
    : null);

  // Compute all-in total in native price unit
  let baseTotal = 0;
  let pctMultiplier = 1;
  for (const c of components) {
    if (c.unit === "%") {
      pctMultiplier *= 1 + Number(c.target_value || 0) / 100;
    } else {
      baseTotal += toPerPriceUnit(Number(c.target_value), c.unit, effectiveCommodity);
    }
  }
  const allIn = baseTotal * pctMultiplier;

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
        = {formatPriceWithUnit(allIn, effectiveCommodity)}
      </span>
    </div>
  );
}
