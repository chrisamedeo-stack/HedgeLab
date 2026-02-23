import { CornBudgetLineResponse } from "@/hooks/useCorn";

// ─── Constants ────────────────────────────────────────────────────────────────

export const COMMODITY_OPTIONS = [
  { value: "CORN-ZC", label: "Corn (CBOT ZC)" },
  { value: "CORN",    label: "Corn (Generic)" },
];
export const UNIT_OPTIONS = ["$/bu", "$/MT", "¢/bu", "CAD/MT", "%"];
export const PRESET_COMPONENTS = [
  { name: "Board Price",     unit: "$/bu" },
  { name: "Basis",           unit: "$/bu" },
  { name: "Freight",         unit: "$/MT" },
  { name: "Elevation",       unit: "$/MT" },
  { name: "Insurance",       unit: "$/MT" },
  { name: "FX Premium",      unit: "$/MT" },
  { name: "Quality Premium", unit: "$/MT" },
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
