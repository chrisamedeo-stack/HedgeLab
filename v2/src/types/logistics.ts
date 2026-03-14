// ─── Logistics Module Types ──────────────────────────────────────────────────

export type DeliveryStatus = "scheduled" | "in_transit" | "delivered" | "cancelled";

export interface Delivery {
  id: string;
  org_id: string;
  site_id: string;
  commodity_id: string;
  contract_id: string | null;
  delivery_date: string;
  volume: number;
  unit: string;
  status: DeliveryStatus;
  carrier: string | null;
  vehicle_id: string | null;
  origin: string | null;
  destination: string | null;
  freight_cost: number | null;
  quality_results: Record<string, unknown>;
  weight_ticket: string | null;
  notes: string | null;
  import_job_id: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  site_name?: string;
  commodity_name?: string;
}

export interface Inventory {
  id: string;
  site_id: string;
  commodity_id: string;
  as_of_date: string;
  on_hand_volume: number;
  committed_out: number;
  available: number;
  unit: string;
  avg_cost: number | null;
  created_at: string;
  // joined fields
  site_name?: string;
  commodity_name?: string;
}

export interface RecordDeliveryParams {
  orgId: string;
  userId: string;
  siteId: string;
  commodityId: string;
  contractId?: string;
  deliveryDate: string;
  volume: number;
  unit: string;
  status?: DeliveryStatus;
  carrier?: string;
  vehicleId?: string;
  origin?: string;
  destination?: string;
  freightCost?: number;
  qualityResults?: Record<string, unknown>;
  weightTicket?: string;
  notes?: string;
}

export interface UpdateDeliveryParams {
  status?: DeliveryStatus;
  carrier?: string;
  vehicleId?: string;
  origin?: string;
  destination?: string;
  freightCost?: number;
  qualityResults?: Record<string, unknown>;
  weightTicket?: string;
  notes?: string;
}

export interface DeliveryFilters {
  orgId: string;
  siteId?: string;
  commodityId?: string;
  contractId?: string;
  status?: DeliveryStatus;
}
