// ─── Commodity Unit Utilities ─────────────────────────────────────────────────
// Data-driven unit conversions and formatting for any commodity.
// All conversions now use the commodity.units[] array from the database.

import type { Commodity, CommodityUnit } from "@/hooks/usePositions";

// ─── Unit Lookup Helpers ─────────────────────────────────────────────────────

/**
 * Find a reporting unit by abbreviation from a commodity's units array.
 */
export function findUnit(commodity: Commodity | null, abbr: string): CommodityUnit | undefined {
  return commodity?.units?.find((u) => u.abbreviation === abbr);
}

/**
 * Get the default reporting unit (is_default_report = true).
 * Falls back to the first unit in the list.
 */
export function getDefaultReportUnit(commodity: Commodity | null): CommodityUnit | undefined {
  if (!commodity?.units?.length) return undefined;
  return commodity.units.find((u) => u.is_default_report) ?? commodity.units[0];
}

/**
 * Get available reporting units for a commodity.
 */
export function getAvailableUnits(commodity: Commodity | null): CommodityUnit[] {
  return commodity?.units ?? [];
}

// ─── Volume Conversion ──────────────────────────────────────────────────────

/**
 * Convert a volume from one unit to another using the commodity's units array.
 *
 * Strategy: convert fromUnit → trade units → toUnit
 *   value_in_trade_units = value * fromUnit.to_trade_unit
 *   value_in_target      = value_in_trade_units * toUnit.from_trade_unit
 */
export function convertVolume(
  value: number,
  fromAbbr: string,
  toAbbr: string,
  commodity: Commodity | null
): number {
  if (fromAbbr === toAbbr) return value;
  const from = findUnit(commodity, fromAbbr);
  const to = findUnit(commodity, toAbbr);
  if (!from || !to) return value;
  const tradeUnits = value * from.to_trade_unit;
  return tradeUnits * to.from_trade_unit;
}

/**
 * Convert a price from one unit basis to another.
 * Price conversion is the inverse of volume conversion:
 * if 1 MT = 39.37 bu, then $/MT = $/bu × 39.37
 */
export function convertPrice(
  value: number,
  fromAbbr: string,
  toAbbr: string,
  commodity: Commodity | null
): number {
  if (fromAbbr === toAbbr) return value;
  const from = findUnit(commodity, fromAbbr);
  const to = findUnit(commodity, toAbbr);
  if (!from || !to) return value;
  // price_in_trade_unit = value / from.from_trade_unit (per trade unit)
  // price_in_target = price_in_trade_unit * to.from_trade_unit
  const perTradeUnit = value * from.to_trade_unit;
  return perTradeUnit / to.to_trade_unit;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format a price value using the commodity's trade_price_unit and price_decimal_places.
 */
export function formatPrice(
  value: number | null | undefined,
  commodity: Commodity | null
): string {
  if (value == null) return "—";
  const decimals = commodity?.price_decimal_places ?? commodity?.decimal_places ?? 4;
  const unit = commodity?.trade_price_unit ?? commodity?.price_unit ?? "$/bu";
  return formatWithUnit(value, unit, decimals);
}

/**
 * Format a volume value. Uses the commodity's trade_volume_unit by default,
 * or a specific reporting unit abbreviation.
 */
export function formatVolume(
  value: number | null | undefined,
  commodity: Commodity | null,
  unitAbbr?: string
): string {
  if (value == null) return "—";
  const abbr = unitAbbr ?? commodity?.trade_volume_unit ?? commodity?.unit ?? "MT";
  return `${numberFormat(value, 0)} ${abbr}`;
}

/**
 * Format a price value with the commodity's native unit suffix.
 * Examples: "$5.1234/bu", "52.30 cents/lb", "$385.00/short ton"
 * Backwards-compatible — used by budget components.
 */
export function formatPriceWithUnit(
  value: number | null | undefined,
  commodity: Commodity | null
): string {
  if (value == null || value === 0) return "—";
  const unit = commodity?.trade_price_unit ?? commodity?.price_unit ?? "$/bu";
  const decimals = commodity?.price_decimal_places ?? commodity?.decimal_places ?? 4;
  return formatWithUnit(value, unit, decimals);
}

// ─── Backwards-compatible functions ──────────────────────────────────────────

/**
 * Returns the list of allowed price units for a commodity's cost components.
 */
export function getPriceUnits(commodity: Commodity | null): string[] {
  const native = commodity?.trade_price_unit ?? commodity?.price_unit ?? "$/bu";
  const units = new Set<string>([native, "$/MT", "%"]);
  return Array.from(units);
}

/**
 * Returns the commodity's default price unit.
 */
export function getDefaultPriceUnit(commodity: Commodity | null): string {
  return commodity?.trade_price_unit ?? commodity?.price_unit ?? "$/bu";
}

/**
 * Convert a component value to the commodity's native price unit.
 * Backwards-compatible — used by budget components.
 */
export function toPerPriceUnit(
  value: number,
  unit: string,
  commodity: Commodity | null
): number {
  const nativeUnit = commodity?.trade_price_unit ?? commodity?.price_unit ?? "$/bu";
  const unitsPerMt = commodity?.config?.units_per_mt ?? 39.3683;

  if (unit === "%") return 0;
  if (unit === nativeUnit) return value;
  if (unit === "$/MT" && nativeUnit !== "$/MT") {
    return unitsPerMt > 0 ? value / unitsPerMt : 0;
  }
  if (nativeUnit === "$/MT" && unit !== "$/MT") {
    return value * unitsPerMt;
  }
  return value;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function formatWithUnit(value: number, unit: string, decimals: number): string {
  switch (unit) {
    case "$/bu":
      return `$${value.toFixed(decimals)}/bu`;
    case "cents/lb":
      return `${value.toFixed(decimals)} cents/lb`;
    case "$/short ton":
      return `$${value.toFixed(decimals)}/short ton`;
    case "$/MT":
      return `$${value.toFixed(decimals)}/MT`;
    default:
      return `${value.toFixed(decimals)} ${unit}`;
  }
}

function numberFormat(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
