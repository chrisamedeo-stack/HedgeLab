// ─── Budget Types ────────────────────────────────────────────────────────────

export interface BudgetPeriod {
  id: string;
  org_id: string;
  site_id: string;
  commodity_id: string;
  budget_year: number;
  status: "draft" | "submitted" | "approved";
  approved_by: string | null;
  approved_at: string | null;
  locked_at: string | null;
  notes: string | null;
  import_job_id: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  site_name?: string;
  site_code?: string;
  commodity_name?: string;
  line_items?: BudgetLineItem[];
}

export interface BudgetLineItem {
  id: string;
  period_id: string;
  budget_month: string;
  budgeted_volume: number;
  budget_price: number | null;
  budget_cost: number;
  committed_volume: number;
  committed_avg_price: number | null;
  committed_cost: number;
  hedged_volume: number;
  hedged_avg_price: number | null;
  hedged_cost: number;
  total_covered_volume: number;
  coverage_pct: number;
  open_volume: number;
  forecast_volume: number | null;
  forecast_price: number | null;
  futures_month: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Computed transient fields (populated by backend)
  components?: BudgetComponent[];
  target_all_in_price?: number | null;
  over_hedged?: boolean;
  total_notional?: number | null;
}

export interface BudgetComponent {
  id?: string;
  line_item_id?: string;
  component_name: string;
  unit: string;
  target_value: number;
  display_order: number;
}

export interface ForecastHistoryEntry {
  id: string;
  line_item_id: string;
  forecast_volume: number | null;
  forecast_price: number | null;
  recorded_at: string;
  recorded_by: string | null;
  notes: string | null;
}

export interface BudgetVersion {
  id: string;
  period_id: string;
  version_number: number;
  version_name: string | null;
  snapshot: BudgetLineItem[];
  created_by: string | null;
  created_at: string;
}

export interface CreatePeriodParams {
  orgId: string;
  userId: string;
  siteId: string;
  commodityId: string;
  budgetYear: number;
  notes?: string;
  currency?: string;
}

export interface UpsertLineItemParams {
  budgetMonth: string;
  budgetedVolume?: number;
  budgetPrice?: number | null;
  committedVolume?: number;
  committedAvgPrice?: number | null;
  committedCost?: number;
  hedgedVolume?: number;
  hedgedAvgPrice?: number | null;
  hedgedCost?: number;
  forecastVolume?: number | null;
  forecastPrice?: number | null;
  futuresMonth?: string | null;
  components?: BudgetComponent[];
  notes?: string | null;
}

export interface BudgetFilters {
  siteId?: string;
  commodityId?: string;
  budgetYear?: number;
  status?: string;
}

export interface CoverageSummary {
  totalBudgeted: number;
  totalCommitted: number;
  totalHedged: number;
  totalOpen: number;
  overallCoveragePct: number;
  byMonth: CoverageDataPoint[];
}

export interface CoverageDataPoint {
  month: string;
  budgeted: number;
  committed: number;
  hedged: number;
  open: number;
  coveragePct: number;
}
