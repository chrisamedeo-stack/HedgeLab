import type { HedgeBookItem, MonthAllocationItem, SiteAllocationItem } from "@/hooks/useCorn";

// ─── Constants ──────────────────────────────────────────────────────────────

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
  avgSettle: number | null;
}

export interface BudgetMonthGroup {
  budgetMonth: string;
  monthOnly: MonthAllocationItem[];
  siteAssigned: SiteAllocationItem[];
  totalLots: number;
  totalBu: number;
  vwap: number;
  totalMtm: number;
  avgSettle: number | null;
}
