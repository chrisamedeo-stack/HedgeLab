import { query, queryOne, queryAll } from "./db";
import { auditLog } from "./audit";
import { emit, EventTypes } from "./eventBus";
import { requirePermission } from "./permissions";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreatePriceParams {
  userId: string;
  commodityId: string;
  contractMonth: string;
  priceDate: string; // YYYY-MM-DD
  price: number;
  priceType?: string;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  volume?: number;
  openInterest?: number;
  source?: string;
  importJobId?: string;
}

export interface PriceFilters {
  commodityId?: string;
  contractMonth?: string;
  dateFrom?: string;
  dateTo?: string;
  priceType?: string;
}

interface PriceRow {
  id: string;
  commodity_id: string;
  contract_month: string;
  price_date: string;
  price_type: string;
  price: string;
  open_price: string | null;
  high_price: string | null;
  low_price: string | null;
  volume: string | null;
  open_interest: string | null;
  source: string;
  import_job_id: string | null;
  created_at: string;
  commodity_name?: string;
}

interface ForwardCurveRow {
  id: string;
  commodity_id: string;
  curve_date: string;
  contract_month: string;
  price: string;
  source: string;
  created_at: string;
}

// ─── Create / Upsert a single price ────────────────────────────────────────

export async function createPrice(params: CreatePriceParams): Promise<PriceRow> {
  await requirePermission(params.userId, "market.enter_price");

  const priceType = params.priceType ?? "settlement";
  const source = params.source ?? "manual";

  // Check for existing record (for audit before snapshot)
  const existing = await queryOne<PriceRow>(
    `SELECT * FROM md_prices
     WHERE commodity_id = $1 AND contract_month = $2 AND price_date = $3 AND price_type = $4`,
    [params.commodityId, params.contractMonth, params.priceDate, priceType]
  );

  const result = await queryOne<PriceRow>(
    `INSERT INTO md_prices
       (commodity_id, contract_month, price_date, price_type, price,
        open_price, high_price, low_price, volume, open_interest, source, import_job_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (commodity_id, contract_month, price_date, price_type)
     DO UPDATE SET
       price = EXCLUDED.price,
       open_price = EXCLUDED.open_price,
       high_price = EXCLUDED.high_price,
       low_price = EXCLUDED.low_price,
       volume = EXCLUDED.volume,
       open_interest = EXCLUDED.open_interest,
       source = EXCLUDED.source,
       import_job_id = EXCLUDED.import_job_id
     RETURNING *`,
    [
      params.commodityId,
      params.contractMonth,
      params.priceDate,
      priceType,
      params.price,
      params.openPrice ?? null,
      params.highPrice ?? null,
      params.lowPrice ?? null,
      params.volume ?? null,
      params.openInterest ?? null,
      source,
      params.importJobId ?? null,
    ]
  );

  if (!result) throw new Error("Failed to upsert price");

  // Audit
  await auditLog({
    userId: params.userId,
    module: "market",
    entityType: "price",
    entityId: result.id,
    action: existing ? "update" : "create",
    before: existing as unknown as Record<string, unknown> | null,
    after: result as unknown as Record<string, unknown>,
    source,
  });

  // Emit PRICE_UPDATED event
  await emit({
    type: EventTypes.PRICE_UPDATED,
    source: "market",
    entityType: "price",
    entityId: result.id,
    payload: {
      commodityId: params.commodityId,
      contractMonth: params.contractMonth,
      priceDate: params.priceDate,
      price: params.price,
      priceType,
    },
    userId: params.userId,
  });

  return result;
}

// ─── Bulk create / upsert ───────────────────────────────────────────────────

export async function createPrices(params: CreatePriceParams[]): Promise<PriceRow[]> {
  const results: PriceRow[] = [];
  for (const p of params) {
    const row = await createPrice(p);
    results.push(row);
  }
  return results;
}

// ─── Get latest settlement price for one contract month ─────────────────────

export async function getLatestPrice(
  commodityId: string,
  contractMonth: string
): Promise<PriceRow | null> {
  return queryOne<PriceRow>(
    `SELECT * FROM md_prices
     WHERE commodity_id = $1 AND contract_month = $2 AND price_type = 'settlement'
     ORDER BY price_date DESC
     LIMIT 1`,
    [commodityId, contractMonth]
  );
}

// ─── Get latest settlement prices for all months of a commodity ─────────────

export async function getLatestPrices(commodityId: string): Promise<PriceRow[]> {
  return queryAll<PriceRow>(
    `SELECT DISTINCT ON (contract_month) *
     FROM md_prices
     WHERE commodity_id = $1 AND price_type = 'settlement'
     ORDER BY contract_month, price_date DESC`,
    [commodityId]
  );
}

// ─── List prices with filters ───────────────────────────────────────────────

export async function listPrices(filters: PriceFilters): Promise<PriceRow[]> {
  let sql = `
    SELECT p.*, c.name as commodity_name
    FROM md_prices p
    LEFT JOIN commodities c ON c.id = p.commodity_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters.commodityId) {
    params.push(filters.commodityId);
    sql += ` AND p.commodity_id = $${params.length}`;
  }
  if (filters.contractMonth) {
    params.push(filters.contractMonth);
    sql += ` AND p.contract_month = $${params.length}`;
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    sql += ` AND p.price_date >= $${params.length}`;
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    sql += ` AND p.price_date <= $${params.length}`;
  }
  if (filters.priceType) {
    params.push(filters.priceType);
    sql += ` AND p.price_type = $${params.length}`;
  }

  sql += ` ORDER BY p.price_date DESC, p.contract_month`;

  return queryAll<PriceRow>(sql, params);
}

// ─── Forward curve ──────────────────────────────────────────────────────────

export async function getForwardCurve(
  commodityId: string,
  curveDate: string
): Promise<ForwardCurveRow[]> {
  return queryAll<ForwardCurveRow>(
    `SELECT * FROM md_forward_curves
     WHERE commodity_id = $1 AND curve_date = $2
     ORDER BY contract_month`,
    [commodityId, curveDate]
  );
}
