// ─── Dashboard Types ─────────────────────────────────────────────────────────

// Kept from old types — used by chart components
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

// ─── Backward Compat (used by OrgUnitCardGrid, SiteCardGrid) ───────────────

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

// ─── Navigation ─────────────────────────────────────────────────────────────

export type DrillLevel = "corporate" | "unit" | "site";

export interface NavState {
  level: DrillLevel;
  orgUnitId?: string;
  siteId?: string;
  commodityId?: string;
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  totalPnl: number;
  coveragePct: number;
  hedgedVolume: number;
  netPosition: number;
  budgetedVolume: number;
  coveredVolume: number;
  openVolume: number;
  lockedVolume: number;
}

// ─── Alerts ─────────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "warning" | "info";

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  link?: string;
  entityName?: string;
}

// ─── Child Summaries (comparison table) ─────────────────────────────────────

export interface ChildSummary {
  id: string;
  name: string;
  code?: string;
  type: "unit" | "site";
  siteCount?: number;
  siteType?: string;
  coveragePct: number;
  hedgedVolume: number;
  netPosition: number;
  pnl: number;
  alertCount: number;
}

// ─── Site Operational Data ──────────────────────────────────────────────────

export interface SiteOperationalData {
  hedges: SiteOperationalHedge[];
  physicals: SiteOperationalPhysical[];
  openBoard: SiteOperationalOpenEntry[];
  allInSummary: SiteOperationalAllIn[];
  coverageSummary: { budgeted: number; covered: number; pct: number } | null;
}

export interface SiteOperationalHedge {
  id: string;
  contract_month: string;
  direction: string;
  allocated_volume: number;
  trade_price: number | null;
  status: string;
  unrealized_pnl: number | null;
  commodity_name?: string;
}

export interface SiteOperationalPhysical {
  id: string;
  delivery_month: string;
  direction: string;
  volume: number;
  price: number | null;
  commodity_name?: string;
}

export interface SiteOperationalOpenEntry {
  contract_month: string;
  direction: string | null;
  volume: number;
  trade_price: number | null;
  market_price: number | null;
  unrealized_pnl: number | null;
}

export interface SiteOperationalAllIn {
  delivery_month: string;
  total_volume: number;
  vwap_locked_price: number | null;
  avg_basis: number | null;
  total_roll_costs: number;
  all_in_price: number | null;
  currency: string;
}
