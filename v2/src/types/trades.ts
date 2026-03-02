// ─── Trade Capture Types ─────────────────────────────────────────────────────

import type { Direction, Allocation } from "./positions";

// ─── Status & Enums ─────────────────────────────────────────────────────────

export type TradeStatus = "open" | "partially_allocated" | "fully_allocated" | "rolled" | "cancelled";
export type TradeType = "futures" | "options" | "swap";
export type OptionType = "call" | "put";

// ─── Core Entity ────────────────────────────────────────────────────────────

export interface FinancialTrade {
  id: string;
  org_id: string;
  commodity_id: string;
  trade_type: TradeType;
  direction: Direction;
  status: TradeStatus;
  trade_date: string;
  contract_month: string;
  broker: string | null;
  account_number: string | null;
  num_contracts: number;
  contract_size: number;
  total_volume: number;
  trade_price: number;
  currency: string;
  commission: number;
  fees: number;
  allocated_volume: number;
  unallocated_volume: number;
  option_type: OptionType | null;
  strike_price: number | null;
  premium: number | null;
  expiration_date: string | null;
  rolled_from_id: string | null;
  roll_id: string | null;
  entered_by: string | null;
  external_ref: string | null;
  notes: string | null;
  import_job_id: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  commodity_name?: string;
}

// ─── Aggregated Views ───────────────────────────────────────────────────────

export interface TradeWithAllocations {
  trade: FinancialTrade;
  allocations: Allocation[];
  summary: {
    totalVolume: number;
    allocatedVolume: number;
    unallocatedVolume: number;
    allocationCount: number;
  };
}

// ─── Input DTOs ─────────────────────────────────────────────────────────────

export interface CreateTradeParams {
  orgId: string;
  userId: string;
  commodityId: string;
  tradeType?: TradeType;
  direction: Direction;
  tradeDate: string;
  contractMonth: string;
  broker?: string;
  accountNumber?: string;
  numContracts: number;
  contractSize: number;
  tradePrice: number;
  currency?: string;
  commission?: number;
  fees?: number;
  optionType?: OptionType;
  strikePrice?: number;
  premium?: number;
  expirationDate?: string;
  externalRef?: string;
  notes?: string;
  importJobId?: string;
}

export interface UpdateTradeParams {
  tradePrice?: number;
  broker?: string;
  accountNumber?: string;
  commission?: number;
  fees?: number;
  notes?: string;
  externalRef?: string;
}

export interface TradeFilters {
  orgId: string;
  commodityId?: string;
  status?: TradeStatus;
  contractMonth?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ─── Form Row (for bulk entry) ──────────────────────────────────────────────

export interface TradeFormRow {
  key: string;
  commodityId: string;
  direction: Direction;
  contractMonth: string;
  numContracts: string;
  contractSize: string;
  tradePrice: string;
  notes: string;
}
