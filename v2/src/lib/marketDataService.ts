import { queryOne, queryAll, query } from "./db";
import { requirePermission } from "./permissions";
import { manualProvider } from "./marketData/providers/manual";
import { excelProvider } from "./marketData/providers/excel";
import type { MarketDataProvider, ParsedRow, IngestResult } from "./marketData/types";

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
  orgId?: string;
  commodityId?: string;
  contractMonth?: string;
  dateFrom?: string;
  dateTo?: string;
  priceType?: string;
}

interface PriceRow {
  id: string;
  org_id: string;
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

// ─── Provider Registry ──────────────────────────────────────────────────────

const providers: Record<string, MarketDataProvider> = {
  manual: manualProvider,
  excel: excelProvider,
};

export function getProvider(type: string): MarketDataProvider {
  const provider = providers[type];
  if (!provider) throw new Error(`Unknown market data provider: ${type}`);
  return provider;
}

// ─── Create / Upsert prices (delegates to manual provider) ──────────────────

export async function createPrice(
  orgId: string,
  params: CreatePriceParams
): Promise<PriceRow> {
  await requirePermission(params.userId, "market.enter_price");

  const row: ParsedRow = {
    commodityId: params.commodityId,
    contractMonth: params.contractMonth,
    priceDate: params.priceDate,
    settle: params.price,
    open: params.openPrice,
    high: params.highPrice,
    low: params.lowPrice,
    volume: params.volume,
    openInterest: params.openInterest,
    priceType: params.priceType,
  };

  await manualProvider.ingestPrices([row], orgId, params.userId);

  // Return the upserted row
  const result = await queryOne<PriceRow>(
    `SELECT * FROM md_prices
     WHERE org_id = $1 AND commodity_id = $2 AND contract_month = $3
       AND price_date = $4 AND price_type = $5`,
    [orgId, params.commodityId, params.contractMonth, params.priceDate, params.priceType ?? "settlement"]
  );

  return result!;
}

export async function createPrices(
  orgId: string,
  params: CreatePriceParams[],
  userId: string
): Promise<IngestResult> {
  await requirePermission(userId, "market.enter_price");

  const rows: ParsedRow[] = params.map((p) => ({
    commodityId: p.commodityId,
    contractMonth: p.contractMonth,
    priceDate: p.priceDate,
    settle: p.price,
    open: p.openPrice,
    high: p.highPrice,
    low: p.lowPrice,
    volume: p.volume,
    openInterest: p.openInterest,
    priceType: p.priceType,
  }));

  return manualProvider.ingestPrices(rows, orgId, userId);
}

// ─── Get latest settlement price for one contract month ─────────────────────

export async function getLatestPrice(
  orgId: string,
  commodityId: string,
  contractMonth: string
): Promise<PriceRow | null> {
  return queryOne<PriceRow>(
    `SELECT * FROM md_prices
     WHERE org_id = $1 AND commodity_id = $2 AND contract_month = $3 AND price_type = 'settlement'
     ORDER BY price_date DESC
     LIMIT 1`,
    [orgId, commodityId, contractMonth]
  );
}

// ─── Get latest settlement prices for all months of a commodity ─────────────

export async function getLatestPrices(
  orgId: string,
  commodityId: string
): Promise<PriceRow[]> {
  return queryAll<PriceRow>(
    `SELECT DISTINCT ON (contract_month) *
     FROM md_prices
     WHERE org_id = $1 AND commodity_id = $2 AND price_type = 'settlement'
     ORDER BY contract_month, price_date DESC`,
    [orgId, commodityId]
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

  if (filters.orgId) {
    params.push(filters.orgId);
    sql += ` AND p.org_id = $${params.length}`;
  }
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

// ─── Forward Curve ──────────────────────────────────────────────────────────

export async function getForwardCurve(
  orgId: string,
  commodityId: string,
  curveDate: string
): Promise<ForwardCurveRow[]> {
  return queryAll<ForwardCurveRow>(
    `SELECT * FROM md_forward_curves
     WHERE org_id = $1 AND commodity_id = $2 AND curve_date = $3
     ORDER BY contract_month`,
    [orgId, commodityId, curveDate]
  );
}

// ─── Forward Curve Comparison ────────────────────────────────────────────────

export interface ForwardCurveComparison {
  current: { contract_month: string; price: number }[];
  comparison: { contract_month: string; price: number }[] | null;
  compareDate: string | null;
}

export async function getForwardCurveComparison(
  orgId: string,
  commodityId: string,
  compareDate?: string
): Promise<ForwardCurveComparison> {
  const currentRows = await getLatestPrices(orgId, commodityId);
  const current = currentRows.map((r) => ({
    contract_month: r.contract_month,
    price: Number(r.price),
  }));

  let comparison: { contract_month: string; price: number }[] | null = null;

  if (compareDate) {
    const curveRows = await getForwardCurve(orgId, commodityId, compareDate);
    if (curveRows.length > 0) {
      comparison = curveRows.map((r) => ({
        contract_month: r.contract_month,
        price: Number(r.price),
      }));
    } else {
      const priceRows = await queryAll<PriceRow>(
        `SELECT * FROM md_prices
         WHERE org_id = $1 AND commodity_id = $2 AND price_date = $3 AND price_type = 'settlement'
         ORDER BY contract_month`,
        [orgId, commodityId, compareDate]
      );
      if (priceRows.length > 0) {
        comparison = priceRows.map((r) => ({
          contract_month: r.contract_month,
          price: Number(r.price),
        }));
      }
    }
  }

  return { current, comparison, compareDate: compareDate ?? null };
}

// ─── Price Board (grouped by commodity with change calculations) ────────────

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

export async function getPriceBoard(
  orgId: string,
  commodityId?: string
): Promise<PriceBoardRow[]> {
  let sql = `
    WITH latest AS (
      SELECT DISTINCT ON (p.commodity_id, p.contract_month)
        p.commodity_id,
        c.name as commodity_name,
        p.contract_month,
        p.price::numeric as settle,
        p.high_price::numeric as high_price,
        p.low_price::numeric as low_price,
        p.volume::numeric as volume,
        p.open_interest::numeric as open_interest,
        p.price_date
      FROM md_prices p
      LEFT JOIN commodities c ON c.id = p.commodity_id
      WHERE p.org_id = $1 AND p.price_type = 'settlement'
  `;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND p.commodity_id = $${params.length}`;
  }

  sql += `
      ORDER BY p.commodity_id, p.contract_month, p.price_date DESC
    ),
    prev AS (
      SELECT DISTINCT ON (p.commodity_id, p.contract_month)
        p.commodity_id,
        p.contract_month,
        p.price::numeric as prev_settle
      FROM md_prices p
      WHERE p.org_id = $1 AND p.price_type = 'settlement'
        AND p.price_date < (
          SELECT MAX(price_date) FROM md_prices
          WHERE org_id = $1 AND price_type = 'settlement'
        )
  `;

  if (commodityId) {
    sql += ` AND p.commodity_id = $2`;
  }

  sql += `
      ORDER BY p.commodity_id, p.contract_month, p.price_date DESC
    )
    SELECT
      l.*,
      l.settle - COALESCE(pr.prev_settle, l.settle) as change,
      CASE WHEN pr.prev_settle > 0
        THEN ROUND(((l.settle - pr.prev_settle) / pr.prev_settle) * 100, 2)
        ELSE NULL
      END as change_percent
    FROM latest l
    LEFT JOIN prev pr
      ON pr.commodity_id = l.commodity_id AND pr.contract_month = l.contract_month
    ORDER BY l.commodity_id, l.contract_month
  `;

  return queryAll<PriceBoardRow>(sql, params);
}

// ─── Upload Prices (Excel) ──────────────────────────────────────────────────

export async function uploadPrices(
  orgId: string,
  userId: string,
  buffer: Buffer,
  _filename: string,
  options?: { sheetIndex?: number; headerRow?: number; providerId?: string }
): Promise<{ parsed: ParsedRow[]; errors: import("./marketData/types").ValidationError[] }> {
  await requirePermission(userId, "market.upload_prices");

  const parsed = await excelProvider.parseFile!(buffer, {
    sheetIndex: options?.sheetIndex,
    headerRow: options?.headerRow,
    providerId: options?.providerId,
    orgId,
  });

  // Validate all rows and collect errors
  const errors: import("./marketData/types").ValidationError[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const rowErrors = excelProvider.validateRow(parsed[i], i);
    errors.push(...rowErrors);
  }

  return { parsed, errors };
}

export async function commitUpload(
  orgId: string,
  userId: string,
  rows: ParsedRow[]
): Promise<IngestResult> {
  await requirePermission(userId, "market.upload_prices");
  return excelProvider.ingestPrices(rows, orgId, userId);
}

// ─── External API Refresh (shared by manual trigger + cron) ─────────────────

// CME month letter → month number
const LETTER_TO_MONTH: Record<string, number> = {
  F: 1, G: 2, H: 3, J: 4, K: 5, M: 6,
  N: 7, Q: 8, U: 9, V: 10, X: 11, Z: 12,
};

// HedgeLab commodity ID → CommodityPriceAPI symbol
const API_SYMBOL_MAP: Record<string, string> = {
  ZC: "CORN",
  ZS: "SOYBEAN-FUT",
  ZW: "ZW-FUT",
  ZL: "ZL",
  ZM: "ZM",
};

interface CommodityRow {
  id: string;
  contract_months: string | null;
  config: { futures_prefix?: string } | null;
}

function getFrontMonth(date: Date, contractMonths: string, prefix: string): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const letters = contractMonths.split("");

  for (const yr of [year, year + 1]) {
    for (const letter of letters) {
      const contractMonth = LETTER_TO_MONTH[letter];
      const expiryDay = 14;
      if (yr > year || contractMonth > month || (contractMonth === month && day <= expiryDay)) {
        const yrStr = String(yr).slice(-2);
        return `${prefix}${letter}${yrStr}`;
      }
    }
  }

  const firstLetter = letters[0];
  return `${prefix}${firstLetter}${String(year + 1).slice(-2)}`;
}

function formatDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/**
 * Refresh prices from CommodityPriceAPI for a given org.
 */
export async function refreshFromExternalApi(
  orgId: string,
  days: number = 1
): Promise<{ upserted: number; errors: number }> {
  const apiKey = process.env.COMMODITY_PRICE_API_KEY;
  if (!apiKey) {
    throw new Error("COMMODITY_PRICE_API_KEY not configured");
  }

  const commodities = await queryAll<CommodityRow>(
    `SELECT id, contract_months, config FROM commodities WHERE org_id = $1`,
    [orgId]
  );

  // Build date list (weekdays going back from yesterday)
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 1; dates.length < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (isWeekday(d)) dates.push(d);
    if (i > days + 10) break;
  }
  dates.reverse();

  // Build API symbol list and reverse map
  const reverseMap: Record<string, { commodityId: string; contractMonths: string; prefix: string }> = {};
  const apiSymbols: string[] = [];

  for (const c of commodities) {
    const apiSymbol = API_SYMBOL_MAP[c.id];
    if (!apiSymbol || !c.contract_months) continue;
    const prefix = c.config?.futures_prefix ?? "";
    reverseMap[apiSymbol] = { commodityId: c.id, contractMonths: c.contract_months, prefix };
    apiSymbols.push(apiSymbol);
  }

  if (apiSymbols.length === 0) {
    return { upserted: 0, errors: 0 };
  }

  let upserted = 0;
  let errors = 0;

  for (const date of dates) {
    const dateStr = formatDateStr(date);
    try {
      const url = `https://api.commoditypriceapi.com/v2/rates/historical?apiKey=${apiKey}&symbols=${apiSymbols.join(",")}&date=${dateStr}`;
      const res = await fetch(url);
      if (!res.ok) { errors++; continue; }

      const data = await res.json();
      if (!data.success || !data.rates) { errors++; continue; }

      for (const [apiSymbol, priceData] of Object.entries(data.rates)) {
        const info = reverseMap[apiSymbol];
        if (!info) continue;

        const pd = priceData as { close?: number; open?: number; high?: number; low?: number };
        if (pd.close === undefined) continue;

        const contractMonth = getFrontMonth(date, info.contractMonths, info.prefix);

        await queryOne(
          `INSERT INTO md_prices
             (org_id, commodity_id, contract_month, price_date, price_type,
              price, open_price, high_price, low_price, source)
           VALUES ($1, $2, $3, $4, 'settlement', $5, $6, $7, $8, 'commodity-price-api')
           ON CONFLICT (org_id, commodity_id, contract_month, price_date, price_type)
           DO UPDATE SET price = EXCLUDED.price,
                         open_price = EXCLUDED.open_price,
                         high_price = EXCLUDED.high_price,
                         low_price = EXCLUDED.low_price
           RETURNING id`,
          [
            orgId,
            info.commodityId,
            contractMonth,
            dateStr,
            pd.close,
            pd.open ?? null,
            pd.high ?? null,
            pd.low ?? null,
          ]
        );
        upserted++;
      }
    } catch {
      errors++;
    }
  }

  return { upserted, errors };
}

/**
 * Get the last poll status for display on the market page.
 */
export async function getLastPollStatus(orgId: string): Promise<{
  lastPollAt: string | null;
  lastPollStatus: string | null;
  providerName: string | null;
} | null> {
  const row = await queryOne<{
    last_poll_at: string | null;
    last_poll_status: string | null;
    name: string;
  }>(
    `SELECT last_poll_at, last_poll_status, name
     FROM md_providers
     WHERE org_id = $1 AND is_active = true
     ORDER BY last_poll_at DESC NULLS LAST
     LIMIT 1`,
    [orgId]
  );
  if (!row) return null;
  return {
    lastPollAt: row.last_poll_at,
    lastPollStatus: row.last_poll_status,
    providerName: row.name,
  };
}

// ─── Basis CRUD ─────────────────────────────────────────────────────────────

export interface BasisRecord {
  id: string;
  org_id: string;
  commodity_id: string;
  site_id: string | null;
  location_name: string | null;
  basis_date: string;
  contract_month: string;
  basis_value: string;
  cash_price: string | null;
  futures_price: string | null;
  source: string;
}

export async function listBasis(
  orgId: string,
  commodityId?: string,
  siteId?: string
): Promise<BasisRecord[]> {
  let sql = `SELECT * FROM md_basis WHERE org_id = $1`;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND commodity_id = $${params.length}`;
  }
  if (siteId) {
    params.push(siteId);
    sql += ` AND site_id = $${params.length}`;
  }

  sql += ` ORDER BY basis_date DESC, contract_month LIMIT 500`;
  return queryAll<BasisRecord>(sql, params);
}

export async function createBasis(
  orgId: string,
  data: {
    commodityId: string;
    siteId?: string;
    locationName?: string;
    basisDate: string;
    contractMonth: string;
    basisValue: number;
    cashPrice?: number;
    futuresPrice?: number;
    source?: string;
  }
): Promise<BasisRecord> {
  const result = await queryOne<BasisRecord>(
    `INSERT INTO md_basis
       (org_id, commodity_id, site_id, location_name, basis_date, contract_month,
        basis_value, cash_price, futures_price, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      orgId,
      data.commodityId,
      data.siteId ?? null,
      data.locationName ?? null,
      data.basisDate,
      data.contractMonth,
      data.basisValue,
      data.cashPrice ?? null,
      data.futuresPrice ?? null,
      data.source ?? "manual",
    ]
  );
  return result!;
}

// ─── Spreads CRUD ───────────────────────────────────────────────────────────

export interface SpreadRecord {
  id: string;
  org_id: string;
  commodity_id: string;
  near_month: string;
  far_month: string;
  spread_date: string;
  spread_value: string;
  near_price: string | null;
  far_price: string | null;
  source: string;
}

export async function listSpreads(
  orgId: string,
  commodityId?: string
): Promise<SpreadRecord[]> {
  let sql = `SELECT * FROM md_spreads WHERE org_id = $1`;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND commodity_id = $${params.length}`;
  }

  sql += ` ORDER BY spread_date DESC, near_month LIMIT 500`;
  return queryAll<SpreadRecord>(sql, params);
}

export async function createSpread(
  orgId: string,
  data: {
    commodityId: string;
    nearMonth: string;
    farMonth: string;
    spreadDate: string;
    spreadValue: number;
    nearPrice?: number;
    farPrice?: number;
    source?: string;
  }
): Promise<SpreadRecord> {
  const result = await queryOne<SpreadRecord>(
    `INSERT INTO md_spreads
       (org_id, commodity_id, near_month, far_month, spread_date, spread_value,
        near_price, far_price, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (org_id, commodity_id, near_month, far_month, spread_date)
     DO UPDATE SET
       spread_value = EXCLUDED.spread_value,
       near_price = EXCLUDED.near_price,
       far_price = EXCLUDED.far_price,
       source = EXCLUDED.source
     RETURNING *`,
    [
      orgId,
      data.commodityId,
      data.nearMonth,
      data.farMonth,
      data.spreadDate,
      data.spreadValue,
      data.nearPrice ?? null,
      data.farPrice ?? null,
      data.source ?? "calculated",
    ]
  );
  return result!;
}
