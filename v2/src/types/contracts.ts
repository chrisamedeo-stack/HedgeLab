// ─── Contract Module Types ───────────────────────────────────────────────────

// --- Enums ---
export type ContractStatus = "draft" | "active" | "completed" | "cancelled";
export type ContractType = "purchase" | "sale";
export type ContractDirection = "buy" | "sell";
export type ContractPricingType = "fixed" | "basis" | "formula";
export type CounterpartyType = "commercial" | "broker" | "exchange" | "producer" | "consumer" | "trader";

// --- Counterparty ---

export interface Counterparty {
  id: string;
  org_id: string;
  name: string;
  short_name: string | null;
  counterparty_type: CounterpartyType;
  credit_limit: number | null;
  credit_rating: string | null;
  payment_terms_days: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCounterpartyParams {
  orgId: string;
  userId: string;
  name: string;
  shortName?: string;
  counterpartyType?: CounterpartyType;
  creditLimit?: number;
  creditRating?: string;
  paymentTermsDays?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCounterpartyParams {
  name?: string;
  shortName?: string;
  counterpartyType?: CounterpartyType;
  creditLimit?: number;
  creditRating?: string;
  paymentTermsDays?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  isActive?: boolean;
  notes?: string;
}

// --- Physical Contract ---

export interface PhysicalContract {
  id: string;
  org_id: string;
  counterparty_id: string | null;
  commodity_id: string | null;
  site_id: string | null;
  contract_ref: string | null;
  contract_type: ContractType;
  status: ContractStatus;
  pricing_type: ContractPricingType;
  direction: ContractDirection;
  total_volume: number;
  delivered_volume: number;
  remaining_volume: number;
  price: number | null;
  basis_price: number | null;
  basis_month: string | null;
  formula_id: string | null;
  currency: string;
  delivery_start: string | null;
  delivery_end: string | null;
  delivery_location: string | null;
  payment_terms_days: number | null;
  incoterms: string | null;
  quality_specs: Record<string, unknown>;
  notes: string | null;
  entered_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  counterparty_name?: string;
  commodity_name?: string;
  site_name?: string;
}

export interface CreateContractParams {
  orgId: string;
  userId: string;
  counterpartyId?: string;
  commodityId?: string;
  siteId?: string;
  contractRef?: string;
  contractType: ContractType;
  pricingType?: ContractPricingType;
  direction: ContractDirection;
  totalVolume: number;
  price?: number;
  basisPrice?: number;
  basisMonth?: string;
  formulaId?: string;
  currency?: string;
  deliveryStart?: string;
  deliveryEnd?: string;
  deliveryLocation?: string;
  paymentTermsDays?: number;
  incoterms?: string;
  qualitySpecs?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateContractParams {
  counterpartyId?: string;
  siteId?: string;
  contractRef?: string;
  pricingType?: ContractPricingType;
  totalVolume?: number;
  price?: number;
  basisPrice?: number;
  basisMonth?: string;
  formulaId?: string;
  deliveryStart?: string;
  deliveryEnd?: string;
  deliveryLocation?: string;
  paymentTermsDays?: number;
  incoterms?: string;
  qualitySpecs?: Record<string, unknown>;
  notes?: string;
}

export interface ContractFilters {
  orgId: string;
  commodityId?: string;
  counterpartyId?: string;
  status?: ContractStatus;
  contractType?: ContractType;
  direction?: ContractDirection;
}

export interface CounterpartyFilters {
  orgId: string;
  isActive?: boolean;
}
