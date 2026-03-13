import { queryAll, queryOne, query } from "@/lib/db";

// ─── Symbol Map Utilities ──────────────────────────────────────────────────

interface SymbolMapRow {
  id: string;
  commodity_id: string;
  provider_symbol: string;
  provider_root: string | null;
  symbol_format: string;
  unit: string | null;
  price_format: string;
  multiplier: string;
}

/** Get all symbol mappings for an org + provider, keyed by providerSymbol */
export async function getSymbolMap(
  orgId: string,
  providerId: string
): Promise<Map<string, { commodityId: string; multiplier: number }>> {
  const rows = await queryAll<SymbolMapRow>(
    `SELECT * FROM md_symbol_map
     WHERE org_id = $1 AND provider_id = $2 AND is_active = true`,
    [orgId, providerId]
  );

  const map = new Map<string, { commodityId: string; multiplier: number }>();
  for (const r of rows) {
    map.set(r.provider_symbol, {
      commodityId: r.commodity_id,
      multiplier: Number(r.multiplier),
    });
  }
  return map;
}

/** Resolve a single provider symbol to a commodity ID */
export async function resolveSymbol(
  orgId: string,
  providerId: string,
  symbol: string
): Promise<{ commodityId: string; multiplier: number } | null> {
  const row = await queryOne<SymbolMapRow>(
    `SELECT * FROM md_symbol_map
     WHERE org_id = $1 AND provider_id = $2 AND provider_symbol = $3 AND is_active = true`,
    [orgId, providerId, symbol]
  );
  if (!row) return null;
  return { commodityId: row.commodity_id, multiplier: Number(row.multiplier) };
}

/** Insert or update a symbol mapping */
export async function upsertSymbolMapping(
  orgId: string,
  providerId: string,
  mapping: {
    commodityId: string;
    providerSymbol: string;
    providerRoot?: string;
    symbolFormat?: string;
    unit?: string;
    priceFormat?: string;
    multiplier?: number;
  }
): Promise<void> {
  await query(
    `INSERT INTO md_symbol_map
       (org_id, provider_id, commodity_id, provider_symbol, provider_root,
        symbol_format, unit, price_format, multiplier)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (org_id, provider_id, commodity_id)
     DO UPDATE SET
       provider_symbol = EXCLUDED.provider_symbol,
       provider_root = EXCLUDED.provider_root,
       symbol_format = EXCLUDED.symbol_format,
       unit = COALESCE(EXCLUDED.unit, md_symbol_map.unit),
       price_format = EXCLUDED.price_format,
       multiplier = EXCLUDED.multiplier`,
    [
      orgId,
      providerId,
      mapping.commodityId,
      mapping.providerSymbol,
      mapping.providerRoot ?? null,
      mapping.symbolFormat ?? "root_month_year",
      mapping.unit ?? null,
      mapping.priceFormat ?? "decimal",
      mapping.multiplier ?? 1,
    ]
  );
}

/** Apply multiplier to convert provider price units → HedgeLab standard */
export function applyMultiplier(price: number, multiplier: number): number {
  return price * multiplier;
}

/** Month code map: F=Jan, G=Feb, H=Mar, J=Apr, K=May, M=Jun, N=Jul, Q=Aug, U=Sep, V=Oct, X=Nov, Z=Dec */
const MONTH_CODES: Record<string, number> = {
  F: 1, G: 2, H: 3, J: 4, K: 5, M: 6,
  N: 7, Q: 8, U: 9, V: 10, X: 11, Z: 12,
};

/**
 * Parse a provider contract symbol into root + month.
 * Supports formats like "ZCN25" → { root: "ZC", month: "2025-07" }
 */
export function parseContractCode(
  symbol: string,
  _format?: string
): { root: string; month: string } | null {
  // Standard format: 2+ char root + 1 char month code + 2 digit year
  const match = symbol.match(/^([A-Z]{2,})([FGHJKMNQUVXZ])(\d{2})$/);
  if (!match) return null;

  const root = match[1];
  const monthCode = match[2];
  const yearShort = parseInt(match[3], 10);
  const year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
  const monthNum = MONTH_CODES[monthCode];
  if (!monthNum) return null;

  return {
    root,
    month: `${year}-${String(monthNum).padStart(2, "0")}`,
  };
}
