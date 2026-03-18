// ─── Hedge Book Service — Read Layer ────────────────────────────────────────
// All read queries for the V2 position manager. No mutations here — see positionActions.ts.

import { queryAll, queryOne } from "./db";
import type { HedgeBook, HedgeBookSummary, Position, PipelineTab } from "@/types/positions";

// ─── Hedge Book CRUD (reads) ────────────────────────────────────────────────

export async function listHedgeBooks(orgId: string): Promise<HedgeBook[]> {
  return queryAll<HedgeBook>(
    `SELECT hb.*,
            ou.name AS org_unit_name,
            c.name  AS commodity_name
     FROM hedge_books hb
     LEFT JOIN org_units ou ON ou.id = hb.org_unit_id
     LEFT JOIN commodities c ON c.id = hb.commodity_id
     WHERE hb.org_id = $1
     ORDER BY hb.display_order, hb.name`,
    [orgId]
  );
}

export async function getHedgeBook(bookId: string): Promise<HedgeBook | null> {
  return queryOne<HedgeBook>(
    `SELECT hb.*,
            ou.name AS org_unit_name,
            c.name  AS commodity_name
     FROM hedge_books hb
     LEFT JOIN org_units ou ON ou.id = hb.org_unit_id
     LEFT JOIN commodities c ON c.id = hb.commodity_id
     WHERE hb.id = $1`,
    [bookId]
  );
}

// ─── Book Positions by Pipeline Tab ─────────────────────────────────────────

const TAB_FILTERS: Record<PipelineTab, string> = {
  unallocated: `ft.position_status IN ('unallocated','budget_allocated','site_allocated') AND ft.is_split_parent = false`,
  budget:      `ft.position_status IN ('budget_allocated','site_allocated') AND ft.budget_month IS NOT NULL AND ft.is_split_parent = false`,
  site:        `ft.position_status = 'site_allocated' AND ft.is_split_parent = false`,
  closed:      `ft.position_status IN ('efp','offset','exercised','expired') AND ft.is_split_parent = false`,
  all:         `ft.is_split_parent = false`,
};

export async function getBookPositions(
  bookId: string,
  tab: PipelineTab = "all"
): Promise<Position[]> {
  const filter = TAB_FILTERS[tab] ?? TAB_FILTERS.all;
  return queryAll<Position>(
    `SELECT ft.id, ft.org_id, ft.commodity_id, ft.trade_type, ft.direction,
            ft.position_status, ft.trade_date, ft.contract_month, ft.total_volume,
            ft.trade_price, ft.currency, ft.hedge_book_id, ft.budget_month,
            ft.site_id, ft.parent_trade_id, ft.is_split_parent, ft.split_volume,
            ft.efp_pair_id, ft.efp_basis, ft.efp_date, ft.efp_market_price,
            ft.linked_physical_id, ft.futures_realized_pnl,
            ft.offset_pair_id, ft.offset_price, ft.offset_date, ft.realized_pnl,
            ft.broker, ft.strike_price, ft.premium, ft.option_type, ft.expiration_date,
            c.name  AS commodity_name,
            s.name  AS site_name,
            s.code  AS site_code,
            hb.name AS hedge_book_name
     FROM tc_financial_trades ft
     LEFT JOIN commodities c  ON c.id = ft.commodity_id
     LEFT JOIN sites s        ON s.id = ft.site_id
     LEFT JOIN hedge_books hb ON hb.id = ft.hedge_book_id
     WHERE ft.hedge_book_id = $1
       AND ft.status != 'cancelled'
       AND ${filter}
     ORDER BY ft.contract_month, ft.trade_date`,
    [bookId]
  );
}

// ─── Book Summary (9 KPI Cards) ─────────────────────────────────────────────

export async function getBookSummary(bookId: string): Promise<HedgeBookSummary> {
  const row = await queryOne<HedgeBookSummary>(
    `WITH latest_prices AS (
       SELECT DISTINCT ON (commodity_id, contract_month)
         commodity_id, contract_month, price
       FROM md_prices
       WHERE org_id = (SELECT org_id FROM hedge_books WHERE id = $1)
         AND price_type = 'settlement'
       ORDER BY commodity_id, contract_month, price_date DESC
     )
     SELECT
       -- MTM P&L: mark-to-market using latest settlement prices
       COALESCE(SUM(
         CASE WHEN ft.position_status IN ('unallocated','budget_allocated','site_allocated')
              AND NOT ft.is_split_parent AND lp.price IS NOT NULL
         THEN (lp.price - ft.trade_price) * ft.total_volume *
              CASE ft.direction WHEN 'long' THEN 1 ELSE -1 END
         ELSE 0 END
       ), 0) AS mtm_pnl,

       -- Realized P&L: sum of realized_pnl for terminal states
       COALESCE(SUM(CASE WHEN ft.position_status IN ('offset','efp','exercised','expired')
         THEN COALESCE(ft.realized_pnl, 0) + COALESCE(ft.futures_realized_pnl, 0)
         ELSE 0 END), 0) AS realized_pnl,

       -- Avg Board Price: VWAP of entry_price across open futures
       CASE WHEN SUM(CASE WHEN ft.trade_type = 'futures' AND ft.position_status IN ('unallocated','budget_allocated','site_allocated') AND NOT ft.is_split_parent
                        THEN ft.total_volume ELSE 0 END) > 0
         THEN SUM(CASE WHEN ft.trade_type = 'futures' AND ft.position_status IN ('unallocated','budget_allocated','site_allocated') AND NOT ft.is_split_parent
                        THEN ft.trade_price * ft.total_volume ELSE 0 END)
            / SUM(CASE WHEN ft.trade_type = 'futures' AND ft.position_status IN ('unallocated','budget_allocated','site_allocated') AND NOT ft.is_split_parent
                        THEN ft.total_volume ELSE 0 END)
         ELSE NULL END AS avg_board_price,

       -- Avg Basis: VWAP of efp_basis for site_allocated + efp positions
       CASE WHEN SUM(CASE WHEN ft.position_status IN ('site_allocated','efp') AND ft.efp_basis IS NOT NULL AND NOT ft.is_split_parent
                        THEN ft.total_volume ELSE 0 END) > 0
         THEN SUM(CASE WHEN ft.position_status IN ('site_allocated','efp') AND ft.efp_basis IS NOT NULL AND NOT ft.is_split_parent
                        THEN ft.efp_basis * ft.total_volume ELSE 0 END)
            / SUM(CASE WHEN ft.position_status IN ('site_allocated','efp') AND ft.efp_basis IS NOT NULL AND NOT ft.is_split_parent
                        THEN ft.total_volume ELSE 0 END)
         ELSE NULL END AS avg_basis,

       -- Avg Net Premium: VWAP of premium across option positions
       CASE WHEN SUM(CASE WHEN ft.trade_type = 'options' AND NOT ft.is_split_parent
                        THEN ft.total_volume ELSE 0 END) > 0
         THEN SUM(CASE WHEN ft.trade_type = 'options' AND NOT ft.is_split_parent
                        THEN COALESCE(ft.premium, 0) * ft.total_volume ELSE 0 END)
            / SUM(CASE WHEN ft.trade_type = 'options' AND NOT ft.is_split_parent
                        THEN ft.total_volume ELSE 0 END)
         ELSE NULL END AS avg_net_premium,

       -- All-in Price: VWAP where physical linked
       CASE WHEN SUM(CASE WHEN ft.linked_physical_id IS NOT NULL AND NOT ft.is_split_parent
                        THEN ft.total_volume ELSE 0 END) > 0
         THEN SUM(CASE WHEN ft.linked_physical_id IS NOT NULL AND NOT ft.is_split_parent
                        THEN (COALESCE(ft.efp_market_price, ft.trade_price) + COALESCE(ft.efp_basis, 0)) * ft.total_volume ELSE 0 END)
            / SUM(CASE WHEN ft.linked_physical_id IS NOT NULL AND NOT ft.is_split_parent
                        THEN ft.total_volume ELSE 0 END)
         ELSE NULL END AS all_in_price,

       -- Open Volume
       COALESCE(SUM(CASE WHEN ft.position_status IN ('unallocated','budget_allocated','site_allocated') AND NOT ft.is_split_parent
         THEN ft.total_volume ELSE 0 END), 0) AS open_volume,

       -- EFP Volume
       COALESCE(SUM(CASE WHEN ft.position_status = 'efp' AND NOT ft.is_split_parent
         THEN ft.total_volume ELSE 0 END), 0) AS efp_volume,

       -- Offset Volume
       COALESCE(SUM(CASE WHEN ft.position_status IN ('offset','expired') AND NOT ft.is_split_parent
         THEN ft.total_volume ELSE 0 END), 0) AS offset_volume

     FROM tc_financial_trades ft
     LEFT JOIN latest_prices lp ON lp.commodity_id = ft.commodity_id
       AND lp.contract_month = ft.contract_month
     WHERE ft.hedge_book_id = $1
       AND ft.status != 'cancelled'`,
    [bookId]
  );

  return row ?? {
    mtm_pnl: 0,
    realized_pnl: 0,
    avg_board_price: null,
    avg_basis: null,
    avg_net_premium: null,
    all_in_price: null,
    open_volume: 0,
    efp_volume: 0,
    offset_volume: 0,
  };
}

// ─── Physical Contracts (for EFP modal selector) ───────────────────────────

export interface PhysicalContractOption {
  id: string;
  contract_ref: string | null;
  site_id: string;
  site_name: string;
  delivery_month: string | null;
  volume: number;
  pricing_status: string;
}

export async function getPhysicalContracts(
  orgId: string,
  siteId?: string,
  deliveryMonth?: string,
  pricingStatus?: string
): Promise<PhysicalContractOption[]> {
  const conditions = [`pc.org_id = $1`];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (siteId) {
    conditions.push(`pc.site_id = $${idx++}`);
    params.push(siteId);
  }
  if (deliveryMonth) {
    conditions.push(`pc.delivery_month = $${idx++}`);
    params.push(deliveryMonth);
  }
  if (pricingStatus) {
    conditions.push(`pc.physical_pricing_status = $${idx++}`);
    params.push(pricingStatus);
  }

  return queryAll<PhysicalContractOption>(
    `SELECT pc.id, pc.contract_ref, pc.site_id, s.name AS site_name,
            pc.delivery_month, pc.volume, pc.physical_pricing_status AS pricing_status
     FROM ct_physical_contracts pc
     LEFT JOIN sites s ON s.id = pc.site_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY pc.delivery_month, s.name`,
    params
  );
}

// ─── Hedge Book Write Helpers ───────────────────────────────────────────────

export interface CreateHedgeBookParams {
  orgId: string;
  name: string;
  currency?: string;
  orgUnitId?: string;
  commodityId?: string;
  displayOrder?: number;
}

export async function createHedgeBook(params: CreateHedgeBookParams): Promise<HedgeBook> {
  const row = await queryOne<HedgeBook>(
    `INSERT INTO hedge_books (org_id, name, currency, org_unit_id, commodity_id, display_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.orgId,
      params.name,
      params.currency ?? "USD",
      params.orgUnitId ?? null,
      params.commodityId ?? null,
      params.displayOrder ?? 0,
    ]
  );
  return row!;
}

export interface UpdateHedgeBookParams {
  name?: string;
  currency?: string;
  orgUnitId?: string | null;
  commodityId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export async function updateHedgeBook(
  bookId: string,
  params: UpdateHedgeBookParams
): Promise<HedgeBook | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(params.name); }
  if (params.currency !== undefined) { sets.push(`currency = $${idx++}`); vals.push(params.currency); }
  if (params.orgUnitId !== undefined) { sets.push(`org_unit_id = $${idx++}`); vals.push(params.orgUnitId); }
  if (params.commodityId !== undefined) { sets.push(`commodity_id = $${idx++}`); vals.push(params.commodityId); }
  if (params.displayOrder !== undefined) { sets.push(`display_order = $${idx++}`); vals.push(params.displayOrder); }
  if (params.isActive !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(params.isActive); }

  if (sets.length === 0) return getHedgeBook(bookId);

  vals.push(bookId);
  return queryOne<HedgeBook>(
    `UPDATE hedge_books SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
}

export async function deactivateHedgeBook(bookId: string): Promise<{ success: boolean; error?: string }> {
  // Check if any active positions exist in this book
  const count = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM tc_financial_trades
     WHERE hedge_book_id = $1 AND status != 'cancelled'
       AND position_status NOT IN ('offset','efp','exercised','expired')`,
    [bookId]
  );

  if (count && parseInt(count.cnt) > 0) {
    return { success: false, error: `Cannot deactivate: ${count.cnt} active positions in this book` };
  }

  await queryOne(
    `UPDATE hedge_books SET is_active = false WHERE id = $1`,
    [bookId]
  );
  return { success: true };
}
