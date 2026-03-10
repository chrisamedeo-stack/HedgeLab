// ─── Commodity Unit Utilities ─────────────────────────────────────────────────
// Data-driven unit conversions and formatting for any commodity.
// Replaces hardcoded toPerBu() / bushelsPerMt patterns.

import type { Commodity } from "@/hooks/usePositions";

/**
 * Returns the list of allowed price units for a commodity's cost components.
 * Always includes the commodity's native price_unit, $/MT, and %.
 */
export function getPriceUnits(commodity: Commodity | null): string[] {
  const native = commodity?.price_unit || "$/bu";
  const units = new Set<string>([native, "$/MT", "%"]);
  return Array.from(units);
}

/**
 * Returns the commodity's default price unit (from the DB column).
 */
export function getDefaultPriceUnit(commodity: Commodity | null): string {
  return commodity?.price_unit || "$/bu";
}

/**
 * Convert a component value to the commodity's native price unit.
 * Replaces the old toPerBu() function.
 *
 * For grains ($/bu): $/MT → divide by units_per_mt
 * For soyoil (cents/lb): $/MT → divide by units_per_mt (lbs per MT)
 * For soymeal ($/short ton): $/MT → divide by units_per_mt (short tons per MT)
 * Percentage units return 0 (applied as multiplier elsewhere).
 */
export function toPerPriceUnit(
  value: number,
  unit: string,
  commodity: Commodity | null
): number {
  const nativeUnit = commodity?.price_unit || "$/bu";
  const unitsPerMt = commodity?.config?.units_per_mt ?? 39.3683;

  if (unit === "%") return 0;
  if (unit === nativeUnit) return value;
  if (unit === "$/MT" && nativeUnit !== "$/MT") {
    return unitsPerMt > 0 ? value / unitsPerMt : 0;
  }
  // If native is $/MT and input is something else, convert to $/MT
  if (nativeUnit === "$/MT" && unit !== "$/MT") {
    return value * unitsPerMt;
  }
  return value;
}

/**
 * Format a price value with the commodity's native unit suffix.
 * Examples: "$5.1234/bu", "52.30 cents/lb", "$385.00/short ton"
 */
export function formatPriceWithUnit(
  value: number | null | undefined,
  commodity: Commodity | null
): string {
  if (value == null || value === 0) return "—";
  const unit = commodity?.price_unit || "$/bu";

  switch (unit) {
    case "$/bu":
      return `$${value.toFixed(4)}/bu`;
    case "cents/lb":
      return `${value.toFixed(2)} cents/lb`;
    case "$/short ton":
      return `$${value.toFixed(2)}/short ton`;
    case "$/MT":
      return `$${value.toFixed(2)}/MT`;
    default:
      return `${value.toFixed(4)} ${unit}`;
  }
}
