import type { HedgeBookItem, MonthAllocationItem, SiteAllocationItem } from "@/hooks/useCorn";

// ─── Constants ──────────────────────────────────────────────────────────────

export const ZC_MONTHS = [
  "ZCH25","ZCK25","ZCN25","ZCU25","ZCZ25",
  "ZCH26","ZCK26","ZCN26","ZCU26","ZCZ26",
  "ZCH27","ZCK27","ZCN27","ZCU27","ZCZ27",
];

export const BUSHELS_PER_LOT = 5_000;

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** "2025-07" → "Jul 25" */
export function fmtBudgetMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const mi = parseInt(m, 10) - 1;
  return `${MONTH_SHORT[mi] ?? m} ${y.slice(2)}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type Book = "CANADA" | "US";

export interface SiteOption {
  code: string;
  name: string;
}

export interface FuturesMonthGroup {
  futuresMonth: string;
  items: HedgeBookItem[];
  totalBu: number;
  unallocBu: number;
  totalLots: number;
  wtdAvgEntry: number;
  totalMtm: number;
}

export interface BudgetMonthGroup {
  budgetMonth: string;
  monthOnly: MonthAllocationItem[];
  siteAssigned: SiteAllocationItem[];
  totalLots: number;
  totalBu: number;
  vwap: number;
}
