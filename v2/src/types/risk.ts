// ─── Risk Module Types ───────────────────────────────────────────────────────

// --- Enums ---
export type LimitType = "net" | "long" | "short" | "gross" | "concentration";
export type LimitCheckResult = "ok" | "warning" | "breached";

// --- MTM Snapshot ---

export interface MtmSnapshot {
  id: string;
  org_id: string;
  snapshot_date: string;
  commodity_id: string | null;
  futures_pnl: number;
  physical_pnl: number;
  total_pnl: number;
  net_position: number;
  realized_pnl: number;
  unrealized_pnl: number;
  currency: string;
  market_price: number | null;
  notes: string | null;
  created_at: string;
  // joined
  commodity_name?: string;
}

export interface MtmSummary {
  totalPnl: number;
  futuresPnl: number;
  physicalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  netPosition: number;
  byCommodity: {
    commodityId: string;
    commodityName: string;
    totalPnl: number;
    futuresPnl: number;
    physicalPnl: number;
    netPosition: number;
  }[];
}

export interface MtmFilters {
  orgId: string;
  commodityId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// --- Position Limits ---

export interface PositionLimit {
  id: string;
  org_id: string;
  commodity_id: string | null;
  limit_type: LimitType;
  limit_value: number;
  alert_threshold: number;
  direction: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  commodity_name?: string;
  // computed
  current_value?: number;
  utilization_pct?: number;
  status?: LimitCheckResult;
}

export interface CreateLimitParams {
  orgId: string;
  userId: string;
  commodityId?: string;
  limitType: LimitType;
  limitValue: number;
  alertThreshold?: number;
  direction?: string;
  notes?: string;
}

export interface UpdateLimitParams {
  limitValue?: number;
  alertThreshold?: number;
  isActive?: boolean;
  notes?: string;
}

// --- Limit Check ---

export interface LimitCheck {
  id: string;
  org_id: string;
  limit_id: string;
  check_date: string;
  current_value: number;
  limit_value: number;
  utilization_pct: number;
  result: LimitCheckResult;
  details: Record<string, unknown>;
  checked_by: string | null;
  created_at: string;
}

// --- Exposure ---

export interface ExposureBucket {
  tenor: string;
  longExposure: number;
  shortExposure: number;
  netExposure: number;
}

export interface CounterpartyExposure {
  counterpartyId: string;
  counterpartyName: string;
  totalExposure: number;
  contractCount: number;
  remainingVolume: number;
}

// --- P&L Attribution ---

export interface PnlAttribution {
  id: string;
  org_id: string;
  attribution_date: string;
  commodity_id: string | null;
  prior_total_pnl: number;
  current_total_pnl: number;
  total_change: number;
  price_change_pnl: number;
  new_trades_pnl: number;
  closed_positions_pnl: number;
  roll_pnl: number;
  basis_pnl: number;
  residual_pnl: number;
  currency: string;
  created_at: string;
  commodity_name?: string;
}
