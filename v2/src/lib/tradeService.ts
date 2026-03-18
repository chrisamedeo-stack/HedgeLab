import { query, queryOne, queryAll, transaction } from "./db";
import { auditLog } from "./audit";
import { requirePermission } from "./permissions";
import { emit, EventTypes } from "./eventBus";
import type {
  FinancialTrade,
  CreateTradeParams,
  UpdateTradeParams,
  TradeFilters,
  TradeWithAllocations,
  FuturesDetails,
  OptionDetails,
  SwapDetails,
  SwapSettlement,
} from "@/types/trades";
import type { Allocation } from "@/types/positions";

// ─── Create Trade ───────────────────────────────────────────────────────────

export async function createTrade(params: CreateTradeParams): Promise<FinancialTrade> {
  const tradeType = params.tradeType ?? "futures";

  // Swaps require special permission
  if (tradeType === "swap") {
    await requirePermission(params.userId, "trade.create_swap");
  } else {
    await requirePermission(params.userId, "trade.create");
  }

  const instrumentClass = tradeType === "swap" ? "otc" : "exchange_traded";

  return await transaction(async (tx) => {
    // Insert into the main trade header
    const result = await tx.query<FinancialTrade>(
      `INSERT INTO tc_financial_trades
         (org_id, commodity_id, trade_type, instrument_class, direction, trade_date,
          contract_month, broker, account_number, num_contracts, contract_size,
          trade_price, currency, commission, fees, option_type, strike_price,
          premium, expiration_date, counterparty_id, counterparty_name,
          entered_by, external_ref, notes, import_job_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING *`,
      [
        params.orgId,
        params.commodityId,
        tradeType,
        instrumentClass,
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
        params.counterpartyId ?? null,
        params.counterpartyName ?? null,
        params.userId,
        params.externalRef ?? null,
        params.notes ?? null,
        params.importJobId ?? null,
      ]
    );

    const trade = result.rows[0];

    // Insert into the appropriate detail table
    if (tradeType === "futures") {
      await tx.query(
        `INSERT INTO tc_futures_details
           (trade_id, broker, account_number, exchange, contract_month, num_contracts, contract_size)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          trade.id,
          params.broker ?? null,
          params.accountNumber ?? null,
          params.exchange ?? "CME",
          params.contractMonth,
          params.numContracts,
          params.contractSize,
        ]
      );
    } else if (tradeType === "options") {
      const premiumTotal = (params.premium ?? 0) * params.numContracts * params.contractSize;
      await tx.query(
        `INSERT INTO tc_option_details
           (trade_id, option_type, option_style, strike_price, premium, premium_total,
            expiration_date, underlying_contract, broker, account_number, exchange)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          trade.id,
          params.optionType ?? "call",
          params.optionStyle ?? "american",
          params.strikePrice ?? 0,
          params.premium ?? 0,
          premiumTotal,
          params.expirationDate ?? null,
          params.underlyingContract ?? params.contractMonth,
          params.broker ?? null,
          params.accountNumber ?? null,
          params.exchange ?? "CME",
        ]
      );
    } else if (tradeType === "swap") {
      await tx.query(
        `INSERT INTO tc_swap_details
           (trade_id, swap_type, fixed_price, floating_reference, floating_index,
            notional_volume, volume_unit, start_date, end_date,
            payment_frequency, settlement_type, isda_ref, master_agreement)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          trade.id,
          params.swapType ?? "fixed_for_floating",
          params.fixedPrice ?? params.tradePrice,
          params.floatingReference ?? `${params.commodityId}:${params.contractMonth}`,
          params.floatingIndex ?? null,
          params.notionalVolume ?? params.numContracts * params.contractSize,
          params.volumeUnit ?? "bushels",
          params.startDate ?? params.tradeDate,
          params.endDate ?? params.tradeDate,
          params.paymentFrequency ?? "monthly",
          params.settlementType ?? "cash",
          params.isdaRef ?? null,
          params.masterAgreement ?? null,
        ]
      );
    }

    return trade;
  }).then(async (trade) => {
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
        tradeType,
      },
      orgId: params.orgId,
      userId: params.userId,
    });

    return trade;
  });
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

// ─── Delete Trade (hard delete) ──────────────────────────────────────────────

export async function deleteTrade(
  tradeId: string,
  userId: string
): Promise<void> {
  await requirePermission(userId, "trade.delete");

  const trade = await getTrade(tradeId);
  if (!trade) throw new Error("Trade not found");
  if (Number(trade.allocated_volume) > 0) {
    throw new Error("Cannot delete a trade with allocations. Cancel allocations first.");
  }

  // Check for any non-cancelled allocations
  const openAllocs = await queryAll<{ id: string }>(
    `SELECT id FROM pm_allocations WHERE trade_id = $1 AND status != 'cancelled'`,
    [tradeId]
  );
  if (openAllocs.length > 0) {
    throw new Error("Cannot delete a trade with open allocations. Cancel allocations first.");
  }

  await transaction(async (tx) => {
    // Delete from detail tables first
    await tx.query(`DELETE FROM tc_swap_settlements WHERE trade_id = $1`, [tradeId]);
    await tx.query(`DELETE FROM tc_swap_details WHERE trade_id = $1`, [tradeId]);
    await tx.query(`DELETE FROM tc_option_details WHERE trade_id = $1`, [tradeId]);
    await tx.query(`DELETE FROM tc_futures_details WHERE trade_id = $1`, [tradeId]);
    // Delete cancelled allocations referencing this trade
    await tx.query(`DELETE FROM pm_allocations WHERE trade_id = $1 AND status = 'cancelled'`, [tradeId]);
    // Delete the trade itself
    await tx.query(`DELETE FROM tc_financial_trades WHERE id = $1`, [tradeId]);
  });

  await auditLog({
    orgId: trade.org_id,
    userId,
    module: "trades",
    entityType: "financial_trade",
    entityId: tradeId,
    action: "delete",
    before: trade as unknown as Record<string, unknown>,
    after: null,
  });

  await emit({
    type: EventTypes.TRADE_DELETED,
    source: "trades",
    entityType: "financial_trade",
    entityId: tradeId,
    payload: {
      commodityId: trade.commodity_id,
      contractMonth: trade.contract_month,
      direction: trade.direction,
      totalVolume: trade.total_volume,
      tradeType: trade.trade_type,
    },
    orgId: trade.org_id,
    userId,
  });
}

// ─── Get Trade (with details) ───────────────────────────────────────────────

export async function getTrade(tradeId: string): Promise<FinancialTrade | null> {
  const trade = await queryOne<FinancialTrade>(
    `SELECT t.*, c.name as commodity_name
     FROM tc_financial_trades t
     LEFT JOIN commodities c ON c.id = t.commodity_id
     WHERE t.id = $1`,
    [tradeId]
  );

  if (!trade) return null;

  // Load instrument-specific details
  trade.details = await loadTradeDetails(trade);

  return trade;
}

async function loadTradeDetails(
  trade: FinancialTrade
): Promise<FuturesDetails | OptionDetails | SwapDetails | undefined> {
  if (trade.trade_type === "futures") {
    const row = await queryOne<{
      broker: string | null;
      account_number: string | null;
      exchange: string;
      contract_month: string;
      num_contracts: number;
      contract_size: number;
    }>(`SELECT * FROM tc_futures_details WHERE trade_id = $1`, [trade.id]);
    if (!row) return undefined;
    return {
      type: "futures",
      broker: row.broker,
      accountNumber: row.account_number,
      exchange: row.exchange,
      contractMonth: row.contract_month,
      numContracts: row.num_contracts,
      contractSize: Number(row.contract_size),
    };
  }

  if (trade.trade_type === "options") {
    const row = await queryOne<{
      option_type: "call" | "put";
      option_style: "american" | "european";
      strike_price: number;
      premium: number;
      premium_total: number | null;
      expiration_date: string;
      underlying_contract: string | null;
      broker: string | null;
      account_number: string | null;
      exchange: string;
      exercise_status: "open" | "exercised" | "expired" | "sold";
    }>(`SELECT * FROM tc_option_details WHERE trade_id = $1`, [trade.id]);
    if (!row) return undefined;
    return {
      type: "options",
      optionType: row.option_type,
      optionStyle: row.option_style,
      strikePrice: Number(row.strike_price),
      premium: Number(row.premium),
      premiumTotal: row.premium_total ? Number(row.premium_total) : null,
      expirationDate: row.expiration_date,
      underlyingContract: row.underlying_contract,
      broker: row.broker,
      accountNumber: row.account_number,
      exchange: row.exchange,
      exerciseStatus: row.exercise_status,
    };
  }

  if (trade.trade_type === "swap") {
    const row = await queryOne<{
      swap_type: "fixed_for_floating" | "basis";
      fixed_price: number;
      floating_reference: string;
      floating_index: string | null;
      notional_volume: number;
      volume_unit: string;
      start_date: string;
      end_date: string;
      payment_frequency: "monthly" | "quarterly" | "at_expiry";
      settlement_type: "cash" | "physical";
      isda_ref: string | null;
      master_agreement: string | null;
    }>(`SELECT * FROM tc_swap_details WHERE trade_id = $1`, [trade.id]);
    if (!row) return undefined;
    return {
      type: "swap",
      swapType: row.swap_type,
      fixedPrice: Number(row.fixed_price),
      floatingReference: row.floating_reference,
      floatingIndex: row.floating_index,
      notionalVolume: Number(row.notional_volume),
      volumeUnit: row.volume_unit,
      startDate: row.start_date,
      endDate: row.end_date,
      paymentFrequency: row.payment_frequency,
      settlementType: row.settlement_type,
      isdaRef: row.isda_ref,
      masterAgreement: row.master_agreement,
    };
  }

  return undefined;
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
  if (filters.tradeType) {
    params.push(filters.tradeType);
    sql += ` AND t.trade_type = $${params.length}`;
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

  sql += ` ORDER BY
    CASE WHEN RIGHT(t.contract_month, 2) ~ '^[0-9]+$'
         THEN CAST(RIGHT(t.contract_month, 2) AS INTEGER)
         ELSE 99 END ASC,
    CASE SUBSTRING(t.contract_month FROM LENGTH(t.contract_month) - 2 FOR 1)
      WHEN 'F' THEN 1 WHEN 'G' THEN 2 WHEN 'H' THEN 3 WHEN 'J' THEN 4
      WHEN 'K' THEN 5 WHEN 'M' THEN 6 WHEN 'N' THEN 7 WHEN 'Q' THEN 8
      WHEN 'U' THEN 9 WHEN 'V' THEN 10 WHEN 'X' THEN 11 WHEN 'Z' THEN 12
      ELSE 99 END ASC,
    t.trade_date DESC, t.created_at DESC`;

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
  const result = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(allocated_volume), 0) as total
     FROM pm_allocations
     WHERE trade_id = $1 AND status NOT IN ('cancelled')`,
    [tradeId]
  );

  const allocatedVolume = Number(result?.total ?? 0);

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

// ─── Recalculate All Allocated Volumes ──────────────────────────────────────

/** One-time reconciliation: recalculates allocated_volume for all active trades */
export async function recalculateAllAllocatedVolumes(): Promise<number> {
  const result = await query(
    `UPDATE tc_financial_trades t
     SET allocated_volume = sub.total,
         status = CASE
           WHEN sub.total = 0 THEN 'open'
           WHEN sub.total >= t.total_volume THEN 'fully_allocated'
           ELSE 'partially_allocated'
         END
     FROM (
       SELECT trade_id, COALESCE(SUM(allocated_volume), 0) as total
       FROM pm_allocations
       WHERE status NOT IN ('cancelled')
       GROUP BY trade_id
     ) sub
     WHERE t.id = sub.trade_id
       AND t.status NOT IN ('cancelled', 'rolled')
       AND (t.allocated_volume IS DISTINCT FROM sub.total)
     RETURNING t.id`
  );
  return result.rowCount ?? 0;
}

// ─── Swap Settlement Functions ──────────────────────────────────────────────

/** Get all settlement periods for a swap trade */
export async function getSwapSettlements(tradeId: string): Promise<SwapSettlement[]> {
  return queryAll<SwapSettlement>(
    `SELECT * FROM tc_swap_settlements
     WHERE trade_id = $1
     ORDER BY settlement_date`,
    [tradeId]
  );
}

/** Settle a swap period with the floating price */
export async function settleSwapPeriod(
  settlementId: string,
  userId: string,
  floatingPrice: number
): Promise<SwapSettlement> {
  await requirePermission(userId, "trade.settle_swap");

  const before = await queryOne<SwapSettlement>(
    `SELECT * FROM tc_swap_settlements WHERE id = $1`,
    [settlementId]
  );
  if (!before) throw new Error("Settlement period not found");
  if (before.status === "settled") throw new Error("Already settled");

  // settlement_amount = (fixed_price - floating_price) * volume
  // Positive = payer of fixed benefits (floating went up)
  // Negative = payer of fixed pays (floating went down)
  const settlementAmount = (Number(before.fixed_price) - floatingPrice) * Number(before.volume);

  const updated = await queryOne<SwapSettlement>(
    `UPDATE tc_swap_settlements
     SET floating_price = $1, settlement_amount = $2, status = 'settled', settled_at = NOW()
     WHERE id = $3 RETURNING *`,
    [floatingPrice, settlementAmount, settlementId]
  );

  await auditLog({
    userId,
    module: "trades",
    entityType: "swap_settlement",
    entityId: settlementId,
    action: "settle",
    before: { status: before.status, floating_price: null },
    after: { status: "settled", floating_price: floatingPrice, settlement_amount: settlementAmount },
  });

  return updated!;
}

/** Auto-generate settlement rows from start_date to end_date based on payment_frequency */
export async function generateSwapSettlements(tradeId: string): Promise<SwapSettlement[]> {
  // Get swap details
  const swap = await queryOne<{
    id: string;
    fixed_price: number;
    notional_volume: number;
    start_date: string;
    end_date: string;
    payment_frequency: string;
  }>(`SELECT * FROM tc_swap_details WHERE trade_id = $1`, [tradeId]);

  if (!swap) throw new Error("Swap details not found for trade");

  // Check if settlements already exist
  const existing = await queryAll<{ id: string }>(
    `SELECT id FROM tc_swap_settlements WHERE swap_detail_id = $1`,
    [swap.id]
  );
  if (existing.length > 0) {
    return getSwapSettlements(tradeId);
  }

  // Generate periods
  const start = new Date(swap.start_date);
  const end = new Date(swap.end_date);
  const periods: { start: Date; end: Date; settlementDate: Date }[] = [];

  if (swap.payment_frequency === "at_expiry") {
    periods.push({ start, end, settlementDate: end });
  } else {
    const monthStep = swap.payment_frequency === "quarterly" ? 3 : 1;
    let periodStart = new Date(start);

    while (periodStart < end) {
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + monthStep);
      if (periodEnd > end) periodEnd.setTime(end.getTime());

      const settlementDate = new Date(periodEnd);
      periods.push({
        start: new Date(periodStart),
        end: new Date(periodEnd),
        settlementDate,
      });

      periodStart = new Date(periodEnd);
    }
  }

  // Calculate volume per period
  const totalMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
  const monthsPerPeriod = swap.payment_frequency === "quarterly" ? 3 : swap.payment_frequency === "at_expiry" ? totalMonths : 1;
  const volumePerPeriod = Number(swap.notional_volume) / Math.max(1, totalMonths) * monthsPerPeriod;

  // Insert all periods
  for (const period of periods) {
    await query(
      `INSERT INTO tc_swap_settlements
         (swap_detail_id, trade_id, settlement_date, settlement_period_start,
          settlement_period_end, fixed_price, volume)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (swap_detail_id, settlement_date) DO NOTHING`,
      [
        swap.id,
        tradeId,
        period.settlementDate.toISOString().slice(0, 10),
        period.start.toISOString().slice(0, 10),
        period.end.toISOString().slice(0, 10),
        swap.fixed_price,
        Math.round(volumePerPeriod),
      ]
    );
  }

  return getSwapSettlements(tradeId);
}
