// ─── Feature Flags ───────────────────────────────────────────────────────────

export type FeatureFlag =
  | "physical_positions"
  | "efp_module"
  | "logistics_module"
  | "options_trading"
  | "swap_trading"
  | "multi_portfolio"
  | "org_hierarchy"
  | "basis_trading"
  | "index_trading"
  | "budget_month"
  | "roll_action"
  | "offset_close_action";

export interface OrgFeature {
  id: string;
  org_id: string;
  flag_name: FeatureFlag;
  enabled: boolean;
}

// ─── Org Tier Config ─────────────────────────────────────────────────────────

export interface OrgTierConfig {
  id: string;
  org_id: string;
  tier_level: number;
  tier_name: string;
  tier_name_plural: string;
  is_leaf: boolean;
}

// ─── Org Nodes ───────────────────────────────────────────────────────────────

export interface OrgNode {
  id: string;
  org_id: string;
  parent_id: string | null;
  tier_level: number;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
}

export interface OrgNodeTreeNode extends OrgNode {
  children: OrgNodeTreeNode[];
  tier_name?: string;
}

// ─── Portfolios ──────────────────────────────────────────────────────────────

export interface Portfolio {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  commodity: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreatePortfolioParams {
  orgId: string;
  userId: string;
  name: string;
  description?: string;
  commodity?: string;
}

// ─── PM Trades ───────────────────────────────────────────────────────────────

export type TradeCategory = "financial" | "physical";

export type TradeInstrument =
  | "futures"
  | "swap_otc"
  | "call_option"
  | "put_option"
  | "fixed_price"
  | "hta"
  | "basis"
  | "index";

export type TradeDirection = "long" | "short" | "buy" | "sell";

export interface PmTrade {
  id: string;
  org_id: string;
  trade_ref: string;
  trade_date: string;
  category: TradeCategory;
  commodity: string;
  instrument: TradeInstrument;
  direction: TradeDirection;
  quantity: number;
  portfolio_id: string | null;
  site_id: string | null;
  budget_month: string | null;

  // Financial fields
  contracts: number | null;
  contract_month: string | null;
  trade_price: number | null;
  market_price: number | null;
  strike: number | null;
  put_call: "P" | "C" | null;
  premium: number | null;
  delta: number | null;

  // Physical fields
  basis: number | null;
  board_month: string | null;
  flat_price: number | null;
  is_priced: boolean;
  delivery_location_id: string | null;
  logistics_assigned: boolean;

  // EFP
  efp_id: string | null;

  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;

  // Joined fields (optional, from queries)
  site_name?: string;
  portfolio_name?: string;
  delivery_location_name?: string;
}

export interface CreatePmTradeParams {
  orgId: string;
  userId: string;
  tradeDate: string;
  category: TradeCategory;
  commodity: string;
  instrument: TradeInstrument;
  direction: TradeDirection;
  quantity: number;
  portfolioId?: string;
  siteId?: string;
  budgetMonth?: string;

  // Financial
  contracts?: number;
  contractMonth?: string;
  tradePrice?: number;
  strike?: number;
  putCall?: "P" | "C";
  premium?: number;
  delta?: number;

  // Physical
  basis?: number;
  boardMonth?: string;
  flatPrice?: number;
  isPriced?: boolean;
  deliveryLocationId?: string;
}

export interface UpdatePmTradeParams {
  orgId: string;
  userId: string;
  tradeId: string;
  siteId?: string;
  budgetMonth?: string | null;
  portfolioId?: string | null;
  marketPrice?: number;
  basis?: number;
  flatPrice?: number;
  isPriced?: boolean;
  deliveryLocationId?: string | null;
  logisticsAssigned?: boolean;
  efpId?: string;
}

export interface PmTradeFilters {
  category?: TradeCategory;
  orgNodeId?: string;
  portfolioId?: string;
  commodity?: string;
  instrument?: TradeInstrument;
  direction?: TradeDirection;
  isPriced?: boolean;
  deliveryLocationId?: string;
  budgetMonth?: string;
  page?: number;
  pageSize?: number;
}

// ─── EFP Transactions ────────────────────────────────────────────────────────

export interface PmEfpTransaction {
  id: string;
  org_id: string;
  financial_trade_id: string | null;
  physical_trade_id: string | null;
  efp_date: string;
  efp_price: number | null;
  contracts: number | null;
  quantity: number | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}
