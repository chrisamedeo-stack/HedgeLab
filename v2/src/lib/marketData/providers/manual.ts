import { queryOne } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { emit, EventTypes } from "@/lib/eventBus";
import type { MarketDataProvider, ParsedRow, ValidationError, IngestResult } from "../types";

// ─── Shared upsert helper (used by manual + excel providers) ─────────────

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
}

export async function upsertPriceRow(
  row: ParsedRow,
  orgId: string,
  userId: string,
  source: string
): Promise<{ action: "inserted" | "updated" }> {
  const priceType = row.priceType ?? "settlement";

  const existing = await queryOne<PriceRow>(
    `SELECT * FROM md_prices
     WHERE org_id = $1 AND commodity_id = $2 AND contract_month = $3
       AND price_date = $4 AND price_type = $5`,
    [orgId, row.commodityId, row.contractMonth, row.priceDate, priceType]
  );

  const result = await queryOne<PriceRow>(
    `INSERT INTO md_prices
       (org_id, commodity_id, contract_month, price_date, price_type, price,
        open_price, high_price, low_price, volume, open_interest, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (org_id, commodity_id, contract_month, price_date, price_type)
     DO UPDATE SET
       price = EXCLUDED.price,
       open_price = EXCLUDED.open_price,
       high_price = EXCLUDED.high_price,
       low_price = EXCLUDED.low_price,
       volume = EXCLUDED.volume,
       open_interest = EXCLUDED.open_interest,
       source = EXCLUDED.source
     RETURNING *`,
    [
      orgId,
      row.commodityId,
      row.contractMonth,
      row.priceDate,
      priceType,
      row.settle,
      row.open ?? null,
      row.high ?? null,
      row.low ?? null,
      row.volume ?? null,
      row.openInterest ?? null,
      source,
    ]
  );

  if (!result) throw new Error("Failed to upsert price");

  await auditLog({
    userId,
    module: "market",
    entityType: "price",
    entityId: result.id,
    action: existing ? "update" : "create",
    before: existing as unknown as Record<string, unknown> | null,
    after: result as unknown as Record<string, unknown>,
    source,
  });

  await emit({
    type: EventTypes.PRICE_UPDATED,
    source: "market",
    entityType: "price",
    entityId: result.id,
    payload: {
      commodityId: row.commodityId,
      contractMonth: row.contractMonth,
      priceDate: row.priceDate,
      price: row.settle,
      priceType,
    },
    userId,
  });

  return { action: existing ? "updated" : "inserted" };
}

// ─── Manual Provider ──────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function validateRowImpl(row: Partial<ParsedRow>, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!row.commodityId) errors.push({ row: rowIndex, field: "commodityId", message: "Required" });
  if (!row.contractMonth) {
    errors.push({ row: rowIndex, field: "contractMonth", message: "Required" });
  } else if (!MONTH_RE.test(row.contractMonth)) {
    errors.push({ row: rowIndex, field: "contractMonth", message: "Must be YYYY-MM format" });
  }
  if (!row.priceDate) {
    errors.push({ row: rowIndex, field: "priceDate", message: "Required" });
  } else if (!DATE_RE.test(row.priceDate)) {
    errors.push({ row: rowIndex, field: "priceDate", message: "Must be YYYY-MM-DD format" });
  }
  if (row.settle === undefined || row.settle === null || isNaN(Number(row.settle))) {
    errors.push({ row: rowIndex, field: "settle", message: "Must be a valid number" });
  }
  return errors;
}

export const manualProvider: MarketDataProvider = {
  name: "manual",
  supportedFormats: [],

  validateRow: validateRowImpl,

  async ingestPrices(rows: ParsedRow[], orgId: string, userId: string): Promise<IngestResult> {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: ValidationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowErrors = validateRowImpl(rows[i], i);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        skipped++;
        continue;
      }

      try {
        const { action } = await upsertPriceRow(rows[i], orgId, userId, "manual");
        if (action === "inserted") inserted++;
        else updated++;
      } catch (err) {
        errors.push({ row: i, field: "general", message: (err as Error).message });
        skipped++;
      }
    }

    return { inserted, updated, skipped, errors };
  },
};
