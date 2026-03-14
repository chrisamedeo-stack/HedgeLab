// ─── Trade Capture Types ─────────────────────────────────────────────────────

import type { Direction, Allocation } from "./positions";

// ─── Status & Enums ─────────────────────────────────────────────────────────

export type TradeStatus = "open" | "partially_allocated" | "fully_allocated" | "rolled" | "cancelled";
export type TradeType = "futures" | "options" | "swap";
export type OptionType = "call" | "put";
export type OptionStyle = "american" | "european";
export type ExerciseStatus = "open" | "exercised" | "expired" | "sold";
export type SwapType = "fixed_for_floating" | "basis";
export type PaymentFrequency = "monthly" | "quarterly" | "at_expiry";
export type SettlementType = "cash" | "physical";
export type SwapSettlementStatus = "pending" | "settled" | "disputed";
export type InstrumentClass = "exchange_traded" | "otc";

// ─── Core Entity ────────────────────────────────────────────────────────────

export interface FinancialTrade {
  id: string;
  org_id: string;
  commodity_id: string;
  trade_type: TradeType;
  instrument_class: InstrumentClass;
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
  counterparty_id: string | null;
  counterparty_name: string | null;
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
  // detail sub-object (populated by getTrade)
  details?: FuturesDetails | OptionDetails | SwapDetails;
}

// ─── Instrument Detail Types ────────────────────────────────────────────────

export interface FuturesDetails {
  type: "futures";
  broker: string | null;
  accountNumber: string | null;
  exchange: string;
  contractMonth: string;
  numContracts: number;
  contractSize: number;
}

export interface OptionDetails {
  type: "options";
  optionType: OptionType;
  optionStyle: OptionStyle;
  strikePrice: number;
  premium: number;
  premiumTotal: number | null;
  expirationDate: string;
  underlyingContract: string | null;
  broker: string | null;
  accountNumber: string | null;
  exchange: string;
  exerciseStatus: ExerciseStatus;
}

export interface SwapDetails {
  type: "swap";
  swapType: SwapType;
  fixedPrice: number;
  floatingReference: string;
  floatingIndex: string | null;
  notionalVolume: number;
  volumeUnit: string;
  startDate: string;
  endDate: string;
  paymentFrequency: PaymentFrequency;
  settlementType: SettlementType;
  isdaRef: string | null;
  masterAgreement: string | null;
}

export interface SwapSettlement {
  id: string;
  swap_detail_id: string;
  trade_id: string;
  settlement_date: string;
  settlement_period_start: string;
  settlement_period_end: string;
  fixed_price: number;
  floating_price: number | null;
  volume: number;
  settlement_amount: number | null;
  status: SwapSettlementStatus;
  settled_at: string | null;
  created_at: string;
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
  // Option-specific
  optionStyle?: OptionStyle;
  underlyingContract?: string;
  exchange?: string;
  // Swap-specific
  counterpartyId?: string;
  counterpartyName?: string;
  swapType?: SwapType;
  fixedPrice?: number;
  floatingReference?: string;
  floatingIndex?: string;
  notionalVolume?: number;
  volumeUnit?: string;
  startDate?: string;
  endDate?: string;
  paymentFrequency?: PaymentFrequency;
  settlementType?: SettlementType;
  isdaRef?: string;
  masterAgreement?: string;
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
  tradeType?: TradeType;
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
  volume: string;
  tradePrice: string;
  notes: string;
}
