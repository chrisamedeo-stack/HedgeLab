// ─── Market Data Provider Abstraction Types ─────────────────────────────────

export interface ParsedRow {
  commodityId: string;
  contractMonth: string; // YYYY-MM
  priceDate: string;     // YYYY-MM-DD
  settle: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  openInterest?: number;
  priceType?: string;    // defaults to "settlement"
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface IngestResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: ValidationError[];
}

export interface MarketDataProvider {
  name: string;
  supportedFormats: string[];

  /** Validate + upsert price rows into md_prices */
  ingestPrices(rows: ParsedRow[], orgId: string, userId: string): Promise<IngestResult>;

  /** Parse a file buffer into rows (optional — manual provider doesn't need this) */
  parseFile?(buffer: Buffer, options?: ParseFileOptions): Promise<ParsedRow[]>;

  /** Validate a single row */
  validateRow(row: Partial<ParsedRow>, rowIndex: number): ValidationError[];
}

export interface ParseFileOptions {
  sheetIndex?: number;
  headerRow?: number;
  /** Map of provider column names → ParsedRow fields */
  columnMap?: Record<string, string>;
  /** Provider ID for symbol resolution */
  providerId?: string;
  /** Org ID for symbol resolution */
  orgId?: string;
}

export interface ProviderConfig {
  providerType: string;
  name: string;
  isPrimary: boolean;
  isActive: boolean;
  config: Record<string, unknown>;
  pollIntervalMinutes: number;
}

export interface SymbolMapping {
  commodityId: string;
  providerSymbol: string;
  providerRoot: string;
  symbolFormat: string;
  unit: string;
  priceFormat: string;
  multiplier: number;
}
