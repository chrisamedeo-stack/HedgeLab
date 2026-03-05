// ─── Dashboard Types ─────────────────────────────────────────────────────────

export interface DashboardWidget {
  widgetType: string;
  position: { x: number; y: number; w: number; h: number };
  config?: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  user_id: string;
  org_id: string;
  name: string;
  layout: DashboardWidget[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CoverageSiteEntry {
  siteId: string;
  siteName: string;
  siteCode: string;
  coveragePct: number;
  budgetedVolume: number;
  coveredVolume: number;
}

export interface PositionByMonthDataPoint {
  month: string;
  label: string;
  open: number;
  locked: number;
  offset: number;
  rolled: number;
  total: number;
}

export type TimeRange = "3" | "6" | "12" | "all";
