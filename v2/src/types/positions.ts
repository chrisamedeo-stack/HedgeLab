// ─── Position Manager Types ──────────────────────────────────────────────────

// ─── Core Entities ───────────────────────────────────────────────────────────

export type AllocationStatus = "open" | "efp_closed" | "offset" | "rolled" | "cancelled";
export type PhysicalStatus = "open" | "filled" | "cancelled";
export type RolloverStatus = "pending" | "executed" | "cancelled";
export type Direction = "long" | "short";
export type PhysicalDirection = "buy" | "sell";
export type PricingType = "fixed" | "basis" | "formula" | "hta" | "index";
export type LegType = "close" | "open";
export type CostAllocation = "site" | "position";
export type RollUrgency = "CRITICAL" | "URGENT" | "UPCOMING";

export interface Allocation {
  id: string;
  org_id: string | null;
  trade_id: string | null;
  site_id: string;
  commodity_id: string;
  allocated_volume: number;
  budget_month: string | null;
  allocation_date: string;
  status: AllocationStatus;
  trade_price: number | null;
  trade_date: string | null;
  contract_month: string | null;
  direction: Direction | null;
  currency: string;
  rolled_from_allocation_id: string | null;
  roll_id: string | null;
  allocated_by: string | null;
  notes: string | null;
  import_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LockedPosition {
  id: string;
  allocation_id: string;
  site_id: string | null;
  commodity_id: string | null;
  volume: number;
  locked_price: number;
  futures_component: number | null;
  basis_component: number | null;
  futures_pnl: number | null;
  all_in_price: number | null;
  currency: string;
  lock_date: string;
  delivery_month: string | null;
  created_at: string;
}

export interface PhysicalPosition {
  id: string;
  org_id: string | null;
  site_id: string;
  commodity_id: string;
  contract_id: string | null;
  direction: PhysicalDirection;
  volume: number;
  price: number | null;
  pricing_type: PricingType;
  basis_price: number | null;
  basis_month: string | null;
  delivery_month: string | null;
  counterparty: string | null;
  supplier_id: string | null;
  contract_ref: string | null;
  currency: string;
  status: PhysicalStatus;
  formula_id: string | null;
  formula_inputs: Record<string, number> | null;
  formula_result: Record<string, unknown> | null;
  import_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rollover {
  id: string;
  org_id: string | null;
  commodity_id: string | null;
  rollover_type: string;
  status: RolloverStatus;
  roll_date: string;
  close_month: string | null;
  close_volume: number | null;
  close_price: number | null;
  close_commodity_id: string | null;
  close_realized_pnl: number | null;
  open_month: string | null;
  open_volume: number | null;
  open_price: number | null;
  open_total_volume: number | null;
  spread_price: number | null;
  spread_cost: number | null;
  source_type: string | null;
  source_trade_id: string | null;
  source_allocation_id: string | null;
  new_trade_id: string | null;
  new_allocation_id: string | null;
  auto_reallocate: boolean;
  reallocation_site_id: string | null;
  reallocation_budget_month: string | null;
  direction: Direction | null;
  executed_by: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolloverLeg {
  id: string;
  rollover_id: string;
  leg_type: LegType;
  commodity_id: string | null;
  contract_month: string | null;
  volume: number;
  price: number | null;
  num_contracts: number | null;
  trade_id: string | null;
  allocation_id: string | null;
  realized_pnl: number | null;
  created_at: string;
}

export interface RolloverCost {
  id: string;
  rollover_id: string;
  spread_cost: number;
  commission: number;
  fees: number;
  total_cost: number;
  cost_allocation: CostAllocation;
  site_id: string | null;
  currency: string;
  created_at: string;
}

// ─── Service Input DTOs ──────────────────────────────────────────────────────

export interface AllocateToSiteParams {
  orgId: string;
  userId: string;
  tradeId?: string;
  siteId: string;
  commodityId: string;
  allocatedVolume: number;
  budgetMonth?: string;
  tradePrice?: number;
  tradeDate?: string;
  contractMonth?: string;
  direction?: Direction;
  currency?: string;
  notes?: string;
}

export interface ExecuteEFPParams {
  userId: string;
  allocationId: string;
  lockPrice: number;
  basisPrice?: number;
  deliveryMonth?: string;
}

export interface ExecuteOffsetParams {
  userId: string;
  allocationId: string;
  offsetPrice: number;
}

export interface ExecuteRollParams {
  userId: string;
  orgId: string;
  sourceAllocationId: string;
  closePrice: number;
  openPrice: number;
  openMonth: string;
  openVolume?: number;
  commission?: number;
  fees?: number;
  autoReallocate?: boolean;
  reallocationSiteId?: string;
  reallocationBudgetMonth?: string;
  notes?: string;
}

export interface CreatePhysicalParams {
  orgId: string;
  userId: string;
  siteId: string;
  commodityId: string;
  direction: PhysicalDirection;
  volume: number;
  price?: number;
  pricingType?: PricingType;
  basisPrice?: number;
  basisMonth?: string;
  deliveryMonth?: string;
  counterparty?: string;
  supplierId?: string;
  contractRef?: string;
  currency?: string;
  formulaId?: string;
  formulaInputs?: Record<string, number>;
  formulaResult?: Record<string, unknown>;
  contractId?: string;
}

export interface CancelAllocationParams {
  userId: string;
  allocationId: string;
  notes?: string;
}

// ─── Aggregated View Types ───────────────────────────────────────────────────

export interface HedgeBookEntry extends Allocation {
  site_name?: string;
  site_code?: string;
  region?: string;
  commodity_name?: string;
}

export interface RolloverCandidate {
  id: string;
  site_id: string;
  site_name: string;
  commodity_id: string;
  commodity_name: string;
  contract_month: string;
  allocated_volume: number;
  trade_price: number | null;
  direction: Direction | null;
  days_to_last_trade: number | null;
  days_to_first_notice: number | null;
  last_trade_date: string | null;
  first_notice_date: string | null;
  urgency: RollUrgency;
}

export interface SitePositionHedge extends Allocation {
  locked_price?: number | null;
  futures_pnl?: number | null;
  all_in_price?: number | null;
  cumulative_roll_cost?: number;
}

export interface SitePositionView {
  siteId: string;
  siteName: string;
  siteCode: string;
  commodityId?: string;
  hedges: SitePositionHedge[];
  physicals: PhysicalPosition[];
  openBoard: OpenBoardEntry[];
  allInSummary: AllInSummaryEntry[];
}

export interface OpenBoardEntry {
  contract_month: string;
  direction: Direction | null;
  volume: number;
  trade_price: number | null;
  market_price: number | null;    // null until Market Data plugin exists
  unrealized_pnl: number | null;
}

export interface AllInSummaryEntry {
  delivery_month: string;
  total_volume: number;
  vwap_locked_price: number | null;
  avg_basis: number | null;
  total_roll_costs: number;
  all_in_price: number | null;
  currency: string;
}

// ─── Basis Aggregation Types ─────────────────────────────────────────────────

export interface BasisBySite {
  site_id: string;
  name: string;
  code: string;
  avg_basis: number;
  total_volume: number;
  min_basis: number;
  max_basis: number;
}

export interface BasisByMonth {
  delivery_month: string;
  locked_basis: number | null;
  locked_volume: number;
  physical_basis: number | null;
  physical_volume: number;
}

export interface BasisSummary {
  bySite: BasisBySite[];
  byMonth: BasisByMonth[];
}

// ─── Position Chain ──────────────────────────────────────────────────────────

export interface PositionChain {
  current_id: string;
  original_id: string;
  original_trade_id: string | null;
  original_price: number | null;
  original_month: string | null;
  chain_start_id: string;
  status: AllocationStatus;
  site_id: string;
  commodity_id: string;
  allocated_volume: number;
  current_month: string | null;
  current_price: number | null;
  roll_count: number;
  cumulative_pnl: number;
  cumulative_roll_cost: number;
  chain_ids: string[];
}
