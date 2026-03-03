import { CornBudgetLineResponse } from "@/hooks/useCorn";
import { COMMODITIES, type CommodityConfig } from "@/lib/commodity-config";

// ─── Constants ────────────────────────────────────────────────────────────────

export function getCommodityOptions(config: CommodityConfig) {
  return [
    { value: `${config.code}-${config.futuresPrefix}`, label: `${config.label} (${config.exchange} ${config.futuresPrefix})` },
    { value: config.code, label: `${config.label} (Generic)` },
  ];
}

/** Default options for backward compat — corn */
export const COMMODITY_OPTIONS = getCommodityOptions(COMMODITIES.corn);
export const UNIT_OPTIONS = ["$/bu", "%"];
export const PRESET_COMPONENTS = [
  { name: "Board Price",     unit: "$/bu" },
  { name: "Basis",           unit: "$/bu" },
  { name: "Freight",         unit: "$/bu" },
  { name: "Elevation",       unit: "$/bu" },
  { name: "Insurance",       unit: "$/bu" },
  { name: "FX Premium",      unit: "$/bu" },
  { name: "Quality Premium", unit: "$/bu" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComponentRow {
  key: number;
  componentName: string;
  unit: string;
  targetValue: string;
  displayOrder: number;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/** Compute notional spend with client-side fallback */
export function lineNotional(l: CornBudgetLineResponse): number | null {
  return l.totalNotionalSpend
    ?? (l.targetAllInPerMt != null && l.budgetVolumeMt != null ? l.targetAllInPerMt * l.budgetVolumeMt : null);
}

export function fmtVol(n: number | null | undefined): string {
  if (n == null || n === 0) return "\u2014";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDollars(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
