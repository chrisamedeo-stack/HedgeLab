// ─── Forecast Types ──────────────────────────────────────────────────────────

export type ScenarioType = "price_move" | "volume_change" | "what_if" | "stress_test";
export type ScenarioStatus = "draft" | "running" | "completed" | "failed";

// ─── Assumption Interfaces ──────────────────────────────────────────────────

export interface PriceMoveAssumptions {
  priceChange: number;       // absolute delta (e.g. -0.25)
  isPercent?: boolean;        // if true, priceChange is a % (e.g. 10 = +10%)
}

export interface VolumeChangeAssumptions {
  volumeChange: number;      // absolute delta in MT
  isPercent?: boolean;        // if true, volumeChange is a % (e.g. -15 = -15%)
}

export interface WhatIfAssumptions {
  siteId: string;
  futuresMonth: string;       // e.g. "2026-07"
  hedgeVolume: number;        // MT to simulate hedging
  hedgePrice: number;         // $/unit
}

export interface StressTestAssumptions {
  priceDeltas: number[];      // e.g. [-2, -1, -0.5, 0, 0.5, 1, 2]
}

export type ScenarioAssumptions =
  | PriceMoveAssumptions
  | VolumeChangeAssumptions
  | WhatIfAssumptions
  | StressTestAssumptions;

// ─── Domain Interfaces ──────────────────────────────────────────────────────

export interface FctScenario {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  scenario_type: ScenarioType;
  base_date: string;
  base_commodity: string | null;
  base_site_id: string | null;
  assumptions: ScenarioAssumptions;
  results: Record<string, unknown> | null;
  status: ScenarioStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  commodity_name?: string;
  site_name?: string;
  result_rows?: FctScenarioResult[];
}

export interface FctScenarioResult {
  id: string;
  scenario_id: string;
  site_id: string | null;
  commodity_id: string;
  label: string | null;
  current_coverage_pct: number | null;
  current_all_in_price: number | null;
  current_mtm_pnl: number | null;
  current_open_volume: number | null;
  projected_coverage_pct: number | null;
  projected_all_in_price: number | null;
  projected_mtm_pnl: number | null;
  projected_open_volume: number | null;
  coverage_change: number | null;
  price_change: number | null;
  pnl_change: number | null;
  volume_change: number | null;
  created_at: string;
  // Joined
  site_name?: string;
}

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateScenarioParams {
  orgId: string;
  userId: string;
  name: string;
  description?: string;
  scenarioType: ScenarioType;
  baseDate?: string;
  baseCommodity?: string;
  baseSiteId?: string;
  assumptions: ScenarioAssumptions;
}

export interface ScenarioFilters {
  scenarioType?: ScenarioType;
  status?: ScenarioStatus;
  baseCommodity?: string;
}
