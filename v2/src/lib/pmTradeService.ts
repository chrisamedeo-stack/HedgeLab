import { query, queryOne, queryAll, transaction } from "./db";
import { auditLog } from "./audit";
import { emit } from "./eventBus";
import type {
  PmTrade,
  CreatePmTradeParams,
  UpdatePmTradeParams,
  PmTradeFilters,
} from "@/types/pm";

// ─── List Trades ─────────────────────────────────────────────────────────────

export async function listTrades(
  orgId: string,
  filters: PmTradeFilters = {}
): Promise<{ trades: PmTrade[]; total: number }> {
  const conditions: string[] = ["t.org_id = $1", "t.is_active = true"];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (filters.category) {
    conditions.push(`t.category = $${idx++}`);
    params.push(filters.category);
  }
  if (filters.commodity) {
    conditions.push(`t.commodity = $${idx++}`);
    params.push(filters.commodity);
  }
  if (filters.instrument) {
    conditions.push(`t.instrument = $${idx++}`);
    params.push(filters.instrument);
  }
  if (filters.direction) {
    conditions.push(`t.direction = $${idx++}`);
    params.push(filters.direction);
  }
  if (filters.portfolioId) {
    conditions.push(`t.portfolio_id = $${idx++}`);
    params.push(filters.portfolioId);
  }
  if (filters.deliveryLocationId) {
    conditions.push(`t.delivery_location_id = $${idx++}`);
    params.push(filters.deliveryLocationId);
  }
  if (filters.budgetMonth) {
    conditions.push(`t.budget_month = $${idx++}`);
    params.push(filters.budgetMonth);
  }
  if (filters.isPriced !== undefined) {
    conditions.push(`t.is_priced = $${idx++}`);
    params.push(filters.isPriced);
  }

  // Org node scoping: if orgNodeId is set, find all leaf descendants
  if (filters.orgNodeId) {
    conditions.push(`(
      t.site_id = $${idx} OR t.site_id IN (
        WITH RECURSIVE descendants AS (
          SELECT id FROM org_nodes WHERE id = $${idx}
          UNION ALL
          SELECT n.id FROM org_nodes n JOIN descendants d ON n.parent_id = d.id WHERE n.is_active = true
        )
        SELECT id FROM descendants
      )
    )`);
    params.push(filters.orgNodeId);
    idx++;
  }

  const where = conditions.join(" AND ");
  const pageSize = filters.pageSize ?? 100;
  const page = filters.page ?? 1;
  const offset = (page - 1) * pageSize;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM pm_trades t WHERE ${where}`,
    params
  );
  const total = parseInt(countResult?.count ?? "0", 10);

  const trades = await queryAll<PmTrade>(
    `SELECT t.*,
       sn.name as site_name,
       p.name as portfolio_name,
       dl.name as delivery_location_name
     FROM pm_trades t
     LEFT JOIN org_nodes sn ON sn.id = t.site_id
     LEFT JOIN portfolios p ON p.id = t.portfolio_id
     LEFT JOIN org_nodes dl ON dl.id = t.delivery_location_id
     WHERE ${where}
     ORDER BY t.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, pageSize, offset]
  );

  return { trades, total };
}

// ─── Get Single Trade ────────────────────────────────────────────────────────

export async function getTrade(tradeId: string): Promise<PmTrade | null> {
  return queryOne<PmTrade>(
    `SELECT t.*,
       sn.name as site_name,
       p.name as portfolio_name,
       dl.name as delivery_location_name
     FROM pm_trades t
     LEFT JOIN org_nodes sn ON sn.id = t.site_id
     LEFT JOIN portfolios p ON p.id = t.portfolio_id
     LEFT JOIN org_nodes dl ON dl.id = t.delivery_location_id
     WHERE t.id = $1`,
    [tradeId]
  );
}

// ─── Create Trade ────────────────────────────────────────────────────────────

export async function createTrade(params: CreatePmTradeParams): Promise<PmTrade> {
  // Generate trade ref
  const refRow = await queryOne<{ generate_trade_ref: string }>(
    `SELECT generate_trade_ref()`,
    []
  );
  const tradeRef = refRow!.generate_trade_ref;

  const result = await query<PmTrade>(
    `INSERT INTO pm_trades (
       org_id, trade_ref, trade_date, category, commodity, instrument, direction, quantity,
       portfolio_id, site_id, budget_month,
       contracts, contract_month, trade_price, strike, put_call, premium, delta,
       basis, board_month, flat_price, is_priced, delivery_location_id,
       created_by
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10, $11,
       $12, $13, $14, $15, $16, $17, $18,
       $19, $20, $21, $22, $23,
       $24
     ) RETURNING *`,
    [
      params.orgId,
      tradeRef,
      params.tradeDate,
      params.category,
      params.commodity,
      params.instrument,
      params.direction,
      params.quantity,
      params.portfolioId || null,
      params.siteId || null,
      params.budgetMonth || null,
      params.contracts ?? null,
      params.contractMonth || null,
      params.tradePrice ?? null,
      params.strike ?? null,
      params.putCall || null,
      params.premium ?? null,
      params.delta ?? null,
      params.basis ?? null,
      params.boardMonth || null,
      params.flatPrice ?? null,
      params.isPriced ?? false,
      params.deliveryLocationId || null,
      params.userId,
    ]
  );
  const trade = result.rows[0];

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "position_manager",
    entityType: "pm_trade",
    entityId: trade.id,
    action: "create",
    after: trade as unknown as Record<string, unknown>,
  });

  await emit({
    type: "PM_TRADE_CREATED",
    source: "position_manager",
    entityType: "pm_trade",
    entityId: trade.id,
    orgId: params.orgId,
    userId: params.userId,
    payload: {
      tradeRef: trade.trade_ref,
      category: trade.category,
      instrument: trade.instrument,
      direction: trade.direction,
      quantity: trade.quantity,
      commodity: trade.commodity,
    },
  });

  return trade;
}

// ─── Update Trade ────────────────────────────────────────────────────────────

export async function updateTrade(params: UpdatePmTradeParams): Promise<PmTrade> {
  const before = await getTrade(params.tradeId);
  if (!before) throw new Error("Trade not found");

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const addField = (field: string, value: unknown) => {
    if (value !== undefined) {
      sets.push(`${field} = $${idx++}`);
      values.push(value);
    }
  };

  addField("site_id", params.siteId);
  addField("budget_month", params.budgetMonth);
  addField("portfolio_id", params.portfolioId);
  addField("market_price", params.marketPrice);
  addField("basis", params.basis);
  addField("flat_price", params.flatPrice);
  addField("is_priced", params.isPriced);
  addField("delivery_location_id", params.deliveryLocationId);
  addField("logistics_assigned", params.logisticsAssigned);
  addField("efp_id", params.efpId);

  if (sets.length === 0) throw new Error("No fields to update");

  const result = await query<PmTrade>(
    `UPDATE pm_trades SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    [...values, params.tradeId]
  );
  const after = result.rows[0];

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "position_manager",
    entityType: "pm_trade",
    entityId: params.tradeId,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after;
}

// ─── Soft Delete Trade ───────────────────────────────────────────────────────

export async function deleteTrade(
  tradeId: string,
  orgId: string,
  userId: string
): Promise<void> {
  const before = await getTrade(tradeId);
  if (!before) throw new Error("Trade not found");

  await query(
    `UPDATE pm_trades SET is_active = false WHERE id = $1`,
    [tradeId]
  );

  await auditLog({
    orgId,
    userId,
    module: "position_manager",
    entityType: "pm_trade",
    entityId: tradeId,
    action: "delete",
    before: before as unknown as Record<string, unknown>,
  });

  await emit({
    type: "PM_TRADE_DELETED",
    source: "position_manager",
    entityType: "pm_trade",
    entityId: tradeId,
    orgId,
    userId,
    payload: {
      tradeRef: before.trade_ref,
      category: before.category,
      quantity: before.quantity,
    },
  });
}

// ─── Bulk Actions ────────────────────────────────────────────────────────────

export async function bulkDefineSite(
  tradeIds: string[],
  siteId: string,
  orgId: string,
  userId: string
): Promise<number> {
  const result = await query(
    `UPDATE pm_trades SET site_id = $1 WHERE id = ANY($2) AND org_id = $3 AND is_active = true`,
    [siteId, tradeIds, orgId]
  );
  return result.rowCount ?? 0;
}

export async function bulkDefineBudgetMonth(
  tradeIds: string[],
  budgetMonth: string,
  orgId: string,
  userId: string
): Promise<number> {
  const result = await query(
    `UPDATE pm_trades SET budget_month = $1 WHERE id = ANY($2) AND org_id = $3 AND is_active = true`,
    [budgetMonth, tradeIds, orgId]
  );
  return result.rowCount ?? 0;
}

export async function bulkAssignPortfolio(
  tradeIds: string[],
  portfolioId: string,
  orgId: string,
  userId: string
): Promise<number> {
  const result = await query(
    `UPDATE pm_trades SET portfolio_id = $1 WHERE id = ANY($2) AND org_id = $3 AND is_active = true`,
    [portfolioId, tradeIds, orgId]
  );
  return result.rowCount ?? 0;
}
