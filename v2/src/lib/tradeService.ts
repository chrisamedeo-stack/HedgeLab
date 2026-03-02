import { query, queryOne, queryAll } from "./db";
import { auditLog } from "./audit";
import { requirePermission } from "./permissions";
import { emit, EventTypes } from "./eventBus";
import type {
  FinancialTrade,
  CreateTradeParams,
  UpdateTradeParams,
  TradeFilters,
  TradeWithAllocations,
} from "@/types/trades";
import type { Allocation } from "@/types/positions";

// ─── Create Trade ───────────────────────────────────────────────────────────

export async function createTrade(params: CreateTradeParams): Promise<FinancialTrade> {
  await requirePermission(params.userId, "trade.create");

  const result = await queryOne<FinancialTrade>(
    `INSERT INTO tc_financial_trades
       (org_id, commodity_id, trade_type, direction, trade_date, contract_month,
        broker, account_number, num_contracts, contract_size, trade_price,
        currency, commission, fees, option_type, strike_price, premium,
        expiration_date, entered_by, external_ref, notes, import_job_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [
      params.orgId,
      params.commodityId,
      params.tradeType ?? "futures",
      params.direction,
      params.tradeDate,
      params.contractMonth,
      params.broker ?? null,
      params.accountNumber ?? null,
      params.numContracts,
      params.contractSize,
      params.tradePrice,
      params.currency ?? "USD",
      params.commission ?? 0,
      params.fees ?? 0,
      params.optionType ?? null,
      params.strikePrice ?? null,
      params.premium ?? null,
      params.expirationDate ?? null,
      params.userId,
      params.externalRef ?? null,
      params.notes ?? null,
      params.importJobId ?? null,
    ]
  );

  const trade = result!;

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "trades",
    entityType: "financial_trade",
    entityId: trade.id,
    action: "create",
    after: trade as unknown as Record<string, unknown>,
  });

  await emit({
    type: EventTypes.TRADE_CREATED,
    source: "trades",
    entityType: "financial_trade",
    entityId: trade.id,
    payload: {
      commodityId: params.commodityId,
      direction: params.direction,
      contractMonth: params.contractMonth,
      numContracts: params.numContracts,
      totalVolume: trade.total_volume,
      tradePrice: params.tradePrice,
    },
    orgId: params.orgId,
    userId: params.userId,
  });

  return trade;
}

// ─── Update Trade ───────────────────────────────────────────────────────────

export async function updateTrade(
  tradeId: string,
  userId: string,
  changes: UpdateTradeParams
): Promise<FinancialTrade> {
  await requirePermission(userId, "trade.update");

  const before = await getTrade(tradeId);
  if (!before) throw new Error("Trade not found");
  if (before.status === "cancelled") throw new Error("Cannot update a cancelled trade");

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fields: [keyof UpdateTradeParams, string][] = [
    ["tradePrice", "trade_price"],
    ["broker", "broker"],
    ["accountNumber", "account_number"],
    ["commission", "commission"],
    ["fees", "fees"],
    ["notes", "notes"],
    ["externalRef", "external_ref"],
  ];

  for (const [paramKey, colName] of fields) {
    if (changes[paramKey] !== undefined) {
      setClauses.push(`${colName} = $${idx}`);
      values.push(changes[paramKey]);
      idx++;
    }
  }

  if (setClauses.length === 0) return before;

  values.push(tradeId);
  const trade = await queryOne<FinancialTrade>(
    `UPDATE tc_financial_trades SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "trades",
    entityType: "financial_trade",
    entityId: tradeId,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: trade as unknown as Record<string, unknown>,
  });

  await emit({
    type: EventTypes.TRADE_UPDATED,
    source: "trades",
    entityType: "financial_trade",
    entityId: tradeId,
    payload: {
      changes,
      tradePrice: trade!.trade_price,
      tradeDate: trade!.trade_date,
      contractMonth: trade!.contract_month,
      direction: trade!.direction,
    },
    orgId: before.org_id,
    userId,
  });

  return trade!;
}

// ─── Cancel Trade ───────────────────────────────────────────────────────────

export async function cancelTrade(
  tradeId: string,
  userId: string,
  reason?: string
): Promise<FinancialTrade> {
  await requirePermission(userId, "trade.cancel");

  const before = await getTrade(tradeId);
  if (!before) throw new Error("Trade not found");
  if (before.status === "cancelled") throw new Error("Trade is already cancelled");

  // Check for open allocations
  const openAllocs = await queryAll<{ id: string }>(
    `SELECT id FROM pm_allocations WHERE trade_id = $1 AND status = 'open'`,
    [tradeId]
  );
  if (openAllocs.length > 0) {
    // TRADE_CANCELLED event will trigger auto-cancellation of open allocations
    // via positionEvents listener
  }

  const trade = await queryOne<FinancialTrade>(
    `UPDATE tc_financial_trades
     SET status = 'cancelled', notes = COALESCE(notes || E'\\n', '') || $1
     WHERE id = $2 RETURNING *`,
    [reason ? `[Cancelled] ${reason}` : "[Cancelled]", tradeId]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "trades",
    entityType: "financial_trade",
    entityId: tradeId,
    action: "cancel",
    before: before as unknown as Record<string, unknown>,
    after: trade as unknown as Record<string, unknown>,
    notes: reason ?? null,
  });

  await emit({
    type: EventTypes.TRADE_CANCELLED,
    source: "trades",
    entityType: "financial_trade",
    entityId: tradeId,
    payload: {
      reason,
      commodityId: before.commodity_id,
      contractMonth: before.contract_month,
      direction: before.direction,
      totalVolume: before.total_volume,
      openAllocationIds: openAllocs.map((a) => a.id),
    },
    orgId: before.org_id,
    userId,
  });

  return trade!;
}

// ─── Get Trade ──────────────────────────────────────────────────────────────

export async function getTrade(tradeId: string): Promise<FinancialTrade | null> {
  return queryOne<FinancialTrade>(
    `SELECT t.*, c.name as commodity_name
     FROM tc_financial_trades t
     LEFT JOIN commodities c ON c.id = t.commodity_id
     WHERE t.id = $1`,
    [tradeId]
  );
}

// ─── List Trades ────────────────────────────────────────────────────────────

export async function listTrades(filters: TradeFilters): Promise<FinancialTrade[]> {
  let sql = `
    SELECT t.*, c.name as commodity_name
    FROM tc_financial_trades t
    LEFT JOIN commodities c ON c.id = t.commodity_id
    WHERE t.org_id = $1`;
  const params: unknown[] = [filters.orgId];

  if (filters.commodityId) {
    params.push(filters.commodityId);
    sql += ` AND t.commodity_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND t.status = $${params.length}`;
  }
  if (filters.contractMonth) {
    params.push(filters.contractMonth);
    sql += ` AND t.contract_month = $${params.length}`;
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    sql += ` AND t.trade_date >= $${params.length}`;
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    sql += ` AND t.trade_date <= $${params.length}`;
  }

  sql += ` ORDER BY t.trade_date DESC, t.created_at DESC`;

  return queryAll<FinancialTrade>(sql, params);
}

// ─── Get Trade With Allocations ─────────────────────────────────────────────

export async function getTradeWithAllocations(tradeId: string): Promise<TradeWithAllocations | null> {
  const trade = await getTrade(tradeId);
  if (!trade) return null;

  const allocations = await queryAll<Allocation>(
    `SELECT a.*, s.name as site_name, s.code as site_code
     FROM pm_allocations a
     LEFT JOIN sites s ON s.id = a.site_id
     WHERE a.trade_id = $1
     ORDER BY a.created_at DESC`,
    [tradeId]
  );

  return {
    trade,
    allocations,
    summary: {
      totalVolume: Number(trade.total_volume),
      allocatedVolume: Number(trade.allocated_volume),
      unallocatedVolume: Number(trade.unallocated_volume),
      allocationCount: allocations.length,
    },
  };
}

// ─── Update Allocated Volume ────────────────────────────────────────────────

export async function updateAllocatedVolume(tradeId: string): Promise<void> {
  // Sum allocated volume from open/active allocations
  const result = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(allocated_volume), 0) as total
     FROM pm_allocations
     WHERE trade_id = $1 AND status NOT IN ('cancelled')`,
    [tradeId]
  );

  const allocatedVolume = Number(result?.total ?? 0);

  // Get the trade to determine new status
  const trade = await queryOne<{ total_volume: number; status: string }>(
    `SELECT total_volume, status FROM tc_financial_trades WHERE id = $1`,
    [tradeId]
  );
  if (!trade || trade.status === "cancelled" || trade.status === "rolled") return;

  let newStatus: string;
  if (allocatedVolume === 0) {
    newStatus = "open";
  } else if (allocatedVolume >= Number(trade.total_volume)) {
    newStatus = "fully_allocated";
  } else {
    newStatus = "partially_allocated";
  }

  await query(
    `UPDATE tc_financial_trades SET allocated_volume = $1, status = $2 WHERE id = $3`,
    [allocatedVolume, newStatus, tradeId]
  );
}
