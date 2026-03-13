// ─── Market Data Types ──────────────────────────────────────────────────────

export interface MarketPrice {
  id: string;
  commodity_id: string;
  contract_month: string;
  price_date: string;
  price_type: string;
  price: number;
  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  volume: number | null;
  open_interest: number | null;
  source: string;
  import_job_id: string | null;
  created_at: string;
  commodity_name?: string;
}

export interface ForwardCurvePoint {
  id: string;
  commodity_id: string;
  curve_date: string;
  contract_month: string;
  price: number;
  source: string;
  created_at: string;
}

export interface LatestPrice {
  commodity_id: string;
  contract_month: string;
  price: number;
  price_date: string;
}

export interface CreatePriceParams {
  userId: string;
  commodityId: string;
  contractMonth: string;
  priceDate: string;
  price: number;
  priceType?: string;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  volume?: number;
  openInterest?: number;
  source?: string;
}

export interface PriceFilters {
  commodityId?: string;
  contractMonth?: string;
  dateFrom?: string;
  dateTo?: string;
  priceType?: string;
}

export interface PriceFormRow {
  contractMonth: string;
  price: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
}

// ─── Price Board Types ──────────────────────────────────────────────────────

export interface PriceBoardRow {
  commodity_id: string;
  commodity_name: string;
  contract_month: string;
  settle: number;
  change: number | null;
  change_percent: number | null;
  high_price: number | null;
  low_price: number | null;
  volume: number | null;
  open_interest: number | null;
  price_date: string;
}

export interface PriceBoardData {
  commodities: {
    commodityId: string;
    name: string;
    rows: PriceBoardRow[];
  }[];
}

// ─── Upload Types ───────────────────────────────────────────────────────────

export interface UploadPreviewRow {
  row: number;
  commodityId: string;
  contractMonth: string;
  priceDate: string;
  settle: number;
  status: "valid" | "error";
  error?: string;
}

export interface UploadPreview {
  filename: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: UploadPreviewRow[];
}

export interface IngestResultClient {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
}

// ─── Tab Type ───────────────────────────────────────────────────────────────

export type MarketTab = "board" | "chart" | "curves" | "upload";
