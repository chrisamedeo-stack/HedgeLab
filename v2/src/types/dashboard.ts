// ─── Dashboard Types ─────────────────────────────────────────────────────────

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

// ─── Drill-Down Types ────────────────────────────────────────────────────────

export type DrillLevel = "corporate" | "unit" | "site";

export interface DrillPathEntry {
  id: string;
  name: string;
  type: DrillLevel;
}

// ─── Widget Layout ───────────────────────────────────────────────────────────

export interface WidgetLayoutEntry {
  widgetId: string;
  enabled: boolean;
  order: number;
}

// ─── Summaries for Drill-Down Cards ─────────────────────────────────────────

export interface UnitSummary {
  unitId: string;
  unitName: string;
  siteCount: number;
  coveragePct: number;
  totalVolume: number;
  budgetedVolume: number;
  alertCount: number;
}

export interface SiteSummary {
  siteId: string;
  siteName: string;
  siteCode: string;
  siteType: string;
  coveragePct: number;
  openHedges: number;
  lockedHedges: number;
  totalVolume: number;
}
