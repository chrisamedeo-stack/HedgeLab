// ─── Position Actions — Atomic Transactions ─────────────────────────────────
// Each function: load trade FOR UPDATE → validate state machine → execute in
// transaction → write position_events → emit event.

import { query as rawQuery, queryOne, transaction } from "./db";
import { validateTransition } from "./positionStateMachine";
import { emit, EventTypes } from "./eventBus";
import type { PositionStatus } from "@/types/positions";
import type { TradeType } from "@/types/trades";

// ─── Helpers ────────────────────────────────────────────────────────────────

interface TradeRow {
  id: string;
  org_id: string;
  commodity_id: string;
  trade_type: TradeType;
  direction: "long" | "short";
  position_status: PositionStatus;
  status: string;
  trade_date: string;
  contract_month: string;
  total_volume: number;
  trade_price: number;
  currency: string;
  hedge_book_id: string | null;
  budget_month: string | null;
  site_id: string | null;
  is_split_parent: boolean;
  num_contracts: number;
  contract_size: number;
  broker: string | null;
  account_number: string | null;
  option_type: string | null;
  strike_price: number | null;
  premium: number | null;
  expiration_date: string | null;
  instrument_class: string;
  commission: number;
  fees: number;
  external_ref: string | null;
  notes: string | null;
  entered_by: string | null;
}

async function loadTradeForUpdate(
  client: { query: typeof rawQuery },
  tradeId: string
): Promise<TradeRow> {
  const result = await client.query<TradeRow>(
    `SELECT * FROM tc_financial_trades WHERE id = $1 FOR UPDATE`,
    [tradeId]
  );
  const trade = result.rows[0];
  if (!trade) throw new Error(`Trade ${tradeId} not found`);
  return trade;
}

async function writePositionEvent(
  client: { query: typeof rawQuery },
  params: {
    orgId: string;
    tradeHeaderId: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    performedBy: string;
    metadata?: Record<string, unknown>;
  }
) {
  await client.query(
    `INSERT INTO position_events (org_id, trade_header_id, event_type, from_status, to_status, performed_by, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.orgId,
      params.tradeHeaderId,
      params.eventType,
      params.fromStatus,
      params.toStatus,
      params.performedBy,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  );
}

function directionMultiplier(direction: string): number {
  return direction === "long" ? 1 : -1;
}

function oppositeDirection(direction: string): string {
  return direction === "long" ? "short" : "long";
}

// ─── 5A. Allocate Position ──────────────────────────────────────────────────

export interface AllocatePositionParams {
  tradeId: string;
  userId: string;
  budgetMonth?: string;
  siteId?: string;
  volume?: number; // if less than total → split first
}

export async function allocatePosition(params: AllocatePositionParams) {
  return transaction(async (client) => {
    const trade = await loadTradeForUpdate(client, params.tradeId);
    const fromStatus = trade.position_status;

    // Determine target status
    let targetStatus: PositionStatus;
    if (params.siteId) {
      targetStatus = "site_allocated";
    } else if (params.budgetMonth) {
      targetStatus = "budget_allocated";
    } else {
      throw new Error("Must provide siteId or budgetMonth");
    }

    // If partial volume, split first
    if (params.volume && params.volume < trade.total_volume) {
      const splitResult = await doSplit(client, trade, params.userId, [
        { volume: params.volume, siteId: params.siteId, budgetMonth: params.budgetMonth },
        { volume: trade.total_volume - params.volume },
      ]);
      // Allocate the first child (the one with site/budget)
      const childId = splitResult.childIds[0];
      return { tradeId: childId, splitFrom: trade.id, childIds: splitResult.childIds };
    }

    // Validate transition
    const check = validateTransition(fromStatus, targetStatus, trade.trade_type);
    if (!check.valid) throw new Error(check.reason);

    // Update trade
    await client.query(
      `UPDATE tc_financial_trades
       SET position_status = $1,
           budget_month = COALESCE($2, budget_month),
           site_id = COALESCE($3, site_id)
       WHERE id = $4`,
      [targetStatus, params.budgetMonth ?? null, params.siteId ?? null, trade.id]
    );

    await writePositionEvent(client, {
      orgId: trade.org_id,
      tradeHeaderId: trade.id,
      eventType: "ALLOCATE",
      fromStatus,
      toStatus: targetStatus,
      performedBy: params.userId,
      metadata: { budgetMonth: params.budgetMonth, siteId: params.siteId },
    });

    await emit({
      type: EventTypes.POSITION_STATUS_CHANGED,
      source: "positionActions",
      entityType: "trade",
      entityId: trade.id,
      orgId: trade.org_id,
      userId: params.userId,
      payload: { fromStatus, toStatus: targetStatus, action: "allocate" },
    });

    return { tradeId: trade.id };
  });
}

// ─── 5B. Execute EFP ────────────────────────────────────────────────────────

export interface ExecuteEFPParams {
  tradeId: string;
  userId: string;
  physicalContractId: string;
  efpBasis: number;
  efpDate: string;
  efpMarketPrice: number;
  volume?: number; // partial → split first
}

export async function executeEFP(params: ExecuteEFPParams) {
  return transaction(async (client) => {
    let trade = await loadTradeForUpdate(client, params.tradeId);
    const fromStatus = trade.position_status;

    // Partial volume → split
    if (params.volume && params.volume < trade.total_volume) {
      const splitResult = await doSplit(client, trade, params.userId, [
        { volume: params.volume },
        { volume: trade.total_volume - params.volume },
      ]);
      // Re-load the first child for EFP
      trade = await loadTradeForUpdate(client, splitResult.childIds[0]);
    }

    // Validate
    const check = validateTransition(trade.position_status, "efp", trade.trade_type);
    if (!check.valid) throw new Error(check.reason);
    if (trade.trade_type !== "futures") throw new Error("EFP is only valid for futures trades");

    // 1. Create offsetting futures position (opposite side, same month, market price)
    const offsetResult = await client.query<{ id: string }>(
      `INSERT INTO tc_financial_trades (
         org_id, commodity_id, trade_type, instrument_class, direction, status,
         trade_date, contract_month, num_contracts, contract_size, total_volume,
         trade_price, currency, hedge_book_id, position_status, site_id, budget_month,
         efp_pair_id, broker, account_number, commission, fees, entered_by
       ) VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8,$9,$10,$11,$12,$13,'efp',$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING id`,
      [
        trade.org_id, trade.commodity_id, "futures", trade.instrument_class,
        oppositeDirection(trade.direction), params.efpDate, trade.contract_month,
        trade.num_contracts, trade.contract_size, trade.total_volume,
        params.efpMarketPrice, trade.currency, trade.hedge_book_id,
        trade.site_id, trade.budget_month, trade.id,
        trade.broker, trade.account_number, 0, 0, params.userId,
      ]
    );
    const offsetId = offsetResult.rows[0].id;

    // 2. Calculate futures realized P&L
    const mult = directionMultiplier(trade.direction);
    const futuresRealizedPnl = (params.efpMarketPrice - trade.trade_price) * trade.total_volume * mult;

    // 3. Update physical contract
    const boardPrice = params.efpMarketPrice + params.efpBasis;
    await client.query(
      `UPDATE ct_physical_contracts
       SET physical_board_price = $1,
           physical_board_date = $2,
           physical_pricing_status = 'board_priced',
           linked_futures_id = $3
       WHERE id = $4`,
      [boardPrice, params.efpDate, trade.id, params.physicalContractId]
    );

    // 4. Update original trade to EFP status
    await client.query(
      `UPDATE tc_financial_trades
       SET position_status = 'efp',
           efp_pair_id = $1,
           efp_basis = $2,
           efp_date = $3,
           efp_market_price = $4,
           linked_physical_id = $5,
           futures_realized_pnl = $6
       WHERE id = $7`,
      [offsetId, params.efpBasis, params.efpDate, params.efpMarketPrice,
       params.physicalContractId, futuresRealizedPnl, trade.id]
    );

    await writePositionEvent(client, {
      orgId: trade.org_id,
      tradeHeaderId: trade.id,
      eventType: "EFP",
      fromStatus,
      toStatus: "efp",
      performedBy: params.userId,
      metadata: {
        offsetId,
        physicalContractId: params.physicalContractId,
        efpBasis: params.efpBasis,
        efpMarketPrice: params.efpMarketPrice,
        boardPrice,
        futuresRealizedPnl,
      },
    });

    await emit({
      type: EventTypes.POSITION_EFP_EXECUTED,
      source: "positionActions",
      entityType: "trade",
      entityId: trade.id,
      orgId: trade.org_id,
      userId: params.userId,
      payload: { offsetId, physicalContractId: params.physicalContractId, futuresRealizedPnl },
    });

    return { tradeId: trade.id, offsetId, futuresRealizedPnl, boardPrice };
  });
}

// ─── 5C. Execute Offset ─────────────────────────────────────────────────────

export interface ExecuteOffsetParams {
  tradeId: string;
  userId: string;
  offsetPrice: number;
  offsetDate: string;
  volume?: number;
}

export async function executeOffset(params: ExecuteOffsetParams) {
  return transaction(async (client) => {
    let trade = await loadTradeForUpdate(client, params.tradeId);
    const fromStatus = trade.position_status;

    // Partial volume → split
    if (params.volume && params.volume < trade.total_volume) {
      const splitResult = await doSplit(client, trade, params.userId, [
        { volume: params.volume },
        { volume: trade.total_volume - params.volume },
      ]);
      trade = await loadTradeForUpdate(client, splitResult.childIds[0]);
    }

    const check = validateTransition(trade.position_status, "offset", trade.trade_type);
    if (!check.valid) throw new Error(check.reason);

    // Create offsetting record
    const offsetResult = await client.query<{ id: string }>(
      `INSERT INTO tc_financial_trades (
         org_id, commodity_id, trade_type, instrument_class, direction, status,
         trade_date, contract_month, num_contracts, contract_size, total_volume,
         trade_price, currency, hedge_book_id, position_status, site_id, budget_month,
         offset_pair_id, broker, account_number, commission, fees, entered_by
       ) VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8,$9,$10,$11,$12,$13,'offset',$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING id`,
      [
        trade.org_id, trade.commodity_id, trade.trade_type, trade.instrument_class,
        oppositeDirection(trade.direction), params.offsetDate, trade.contract_month,
        trade.num_contracts, trade.contract_size, trade.total_volume,
        params.offsetPrice, trade.currency, trade.hedge_book_id,
        trade.site_id, trade.budget_month, trade.id,
        trade.broker, trade.account_number, 0, 0, params.userId,
      ]
    );
    const offsetId = offsetResult.rows[0].id;

    // Calculate realized P&L
    const mult = directionMultiplier(trade.direction);
    const realizedPnl = (params.offsetPrice - trade.trade_price) * trade.total_volume * mult;

    // Update original
    await client.query(
      `UPDATE tc_financial_trades
       SET position_status = 'offset',
           offset_pair_id = $1,
           offset_price = $2,
           offset_date = $3,
           realized_pnl = $4
       WHERE id = $5`,
      [offsetId, params.offsetPrice, params.offsetDate, realizedPnl, trade.id]
    );

    await writePositionEvent(client, {
      orgId: trade.org_id,
      tradeHeaderId: trade.id,
      eventType: "OFFSET",
      fromStatus,
      toStatus: "offset",
      performedBy: params.userId,
      metadata: { offsetId, offsetPrice: params.offsetPrice, realizedPnl },
    });

    await emit({
      type: EventTypes.POSITION_OFFSET_EXECUTED,
      source: "positionActions",
      entityType: "trade",
      entityId: trade.id,
      orgId: trade.org_id,
      userId: params.userId,
      payload: { offsetId, realizedPnl },
    });

    return { tradeId: trade.id, offsetId, realizedPnl };
  });
}

// ─── 5D. Exercise Option ────────────────────────────────────────────────────

export interface ExerciseOptionParams {
  tradeId: string;
  userId: string;
  exerciseDate: string;
}

export async function exerciseOption(params: ExerciseOptionParams) {
  return transaction(async (client) => {
    const trade = await loadTradeForUpdate(client, params.tradeId);
    const fromStatus = trade.position_status;

    if (trade.trade_type !== "options") throw new Error("Can only exercise option trades");

    const check = validateTransition(fromStatus, "exercised", trade.trade_type);
    if (!check.valid) throw new Error(check.reason);

    // Determine child futures direction: buy if call, sell if put
    const childDirection = trade.option_type === "call" ? "long" : "short";

    // Create child futures position inheriting site/budget/book
    const childResult = await client.query<{ id: string }>(
      `INSERT INTO tc_financial_trades (
         org_id, commodity_id, trade_type, instrument_class, direction, status,
         trade_date, contract_month, num_contracts, contract_size, total_volume,
         trade_price, currency, hedge_book_id, position_status, site_id, budget_month,
         broker, account_number, commission, fees, entered_by, notes
       ) VALUES ($1,$2,'futures',$3,$4,'open',$5,$6,$7,$8,$9,$10,$11,$12,'site_allocated',$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        trade.org_id, trade.commodity_id, trade.instrument_class,
        childDirection, params.exerciseDate, trade.contract_month,
        trade.num_contracts, trade.contract_size, trade.total_volume,
        trade.strike_price, trade.currency, trade.hedge_book_id,
        trade.site_id, trade.budget_month,
        trade.broker, trade.account_number, 0, 0, params.userId,
        `Exercised from option ${trade.id}`,
      ]
    );
    const childId = childResult.rows[0].id;

    // Update option to exercised
    await client.query(
      `UPDATE tc_financial_trades
       SET position_status = 'exercised'
       WHERE id = $1`,
      [trade.id]
    );

    // Update option details with exercise_futures_id
    await client.query(
      `UPDATE tc_option_details
       SET exercise_futures_id = $1
       WHERE trade_id = $2`,
      [childId, trade.id]
    );

    await writePositionEvent(client, {
      orgId: trade.org_id,
      tradeHeaderId: trade.id,
      eventType: "EXERCISE",
      fromStatus,
      toStatus: "exercised",
      performedBy: params.userId,
      metadata: {
        childFuturesId: childId,
        strikePrice: trade.strike_price,
        optionType: trade.option_type,
        exerciseDate: params.exerciseDate,
      },
    });

    await emit({
      type: EventTypes.OPTION_EXERCISED,
      source: "positionActions",
      entityType: "trade",
      entityId: trade.id,
      orgId: trade.org_id,
      userId: params.userId,
      payload: { childFuturesId: childId },
    });

    return { tradeId: trade.id, childFuturesId: childId };
  });
}

// ─── 5E. Expire Option ──────────────────────────────────────────────────────

export interface ExpireOptionParams {
  tradeId: string;
  userId: string;
  expiryDate: string;
}

export async function expireOption(params: ExpireOptionParams) {
  return transaction(async (client) => {
    const trade = await loadTradeForUpdate(client, params.tradeId);
    const fromStatus = trade.position_status;

    if (trade.trade_type !== "options") throw new Error("Can only expire option trades");

    const check = validateTransition(fromStatus, "expired", trade.trade_type);
    if (!check.valid) throw new Error(check.reason);

    // Realized P&L: bought = -premium × volume, sold = +premium × volume
    const optionSideResult = await client.query<{ option_side: string | null }>(
      `SELECT option_side FROM tc_option_details WHERE trade_id = $1`,
      [trade.id]
    );
    const optionSide = optionSideResult.rows[0]?.option_side ?? "bought";
    const premiumTotal = (trade.premium ?? 0) * trade.total_volume;
    const realizedPnl = optionSide === "sold" ? premiumTotal : -premiumTotal;

    await client.query(
      `UPDATE tc_financial_trades
       SET position_status = 'expired',
           realized_pnl = $1
       WHERE id = $2`,
      [realizedPnl, trade.id]
    );

    await writePositionEvent(client, {
      orgId: trade.org_id,
      tradeHeaderId: trade.id,
      eventType: "EXPIRE",
      fromStatus,
      toStatus: "expired",
      performedBy: params.userId,
      metadata: { expiryDate: params.expiryDate, realizedPnl, optionSide },
    });

    await emit({
      type: EventTypes.OPTION_EXPIRED,
      source: "positionActions",
      entityType: "trade",
      entityId: trade.id,
      orgId: trade.org_id,
      userId: params.userId,
      payload: { realizedPnl },
    });

    return { tradeId: trade.id, realizedPnl };
  });
}

// ─── 5F. Split Position ─────────────────────────────────────────────────────

export interface SplitPositionParams {
  tradeId: string;
  userId: string;
  splits: { volume: number; siteId?: string; budgetMonth?: string }[];
}

export async function splitPosition(params: SplitPositionParams) {
  return transaction(async (client) => {
    const trade = await loadTradeForUpdate(client, params.tradeId);
    return doSplit(client, trade, params.userId, params.splits);
  });
}

/** Internal split logic — called by other actions too */
async function doSplit(
  client: { query: typeof rawQuery },
  trade: TradeRow,
  userId: string,
  splits: { volume: number; siteId?: string; budgetMonth?: string }[]
) {
  const fromStatus = trade.position_status;

  // Cannot split terminal states
  if (["efp", "offset", "exercised", "expired", "partial"].includes(fromStatus)) {
    throw new Error(`Cannot split a position in '${fromStatus}' status`);
  }

  // Validate volumes sum
  const totalSplit = splits.reduce((s, sp) => s + sp.volume, 0);
  if (Math.abs(totalSplit - trade.total_volume) > 0.001) {
    throw new Error(`Split volumes (${totalSplit}) must equal trade volume (${trade.total_volume})`);
  }

  // Mark parent as split
  await client.query(
    `UPDATE tc_financial_trades
     SET position_status = 'partial',
         is_split_parent = true
     WHERE id = $1`,
    [trade.id]
  );

  // Create child trades
  const childIds: string[] = [];
  for (const split of splits) {
    // Determine child status based on allocation
    let childStatus: PositionStatus = fromStatus as PositionStatus;
    if (split.siteId) childStatus = "site_allocated";
    else if (split.budgetMonth && fromStatus === "unallocated") childStatus = "budget_allocated";

    const numContracts = trade.contract_size > 0
      ? Math.round(split.volume / trade.contract_size)
      : trade.num_contracts;

    const childResult = await client.query<{ id: string }>(
      `INSERT INTO tc_financial_trades (
         org_id, commodity_id, trade_type, instrument_class, direction, status,
         trade_date, contract_month, num_contracts, contract_size, total_volume,
         trade_price, currency, hedge_book_id, position_status, site_id, budget_month,
         parent_trade_id, split_volume, broker, account_number, commission, fees,
         option_type, strike_price, premium, expiration_date, counterparty_id,
         entered_by, external_ref, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
       RETURNING id`,
      [
        trade.org_id, trade.commodity_id, trade.trade_type, trade.instrument_class,
        trade.direction, trade.status, trade.trade_date, trade.contract_month,
        numContracts, trade.contract_size, split.volume,
        trade.trade_price, trade.currency, trade.hedge_book_id,
        childStatus, split.siteId ?? trade.site_id, split.budgetMonth ?? trade.budget_month,
        trade.id, split.volume, trade.broker, trade.account_number,
        trade.commission, trade.fees, trade.option_type, trade.strike_price,
        trade.premium, trade.expiration_date, null,
        userId, trade.external_ref, trade.notes,
      ]
    );
    childIds.push(childResult.rows[0].id);

    // Copy instrument detail row for each child
    if (trade.trade_type === "futures") {
      await client.query(
        `INSERT INTO tc_futures_details (trade_id, exchange, contract_month, num_contracts, contract_size, broker, account_number, hedge_book_id)
         SELECT $1, exchange, contract_month, $2, contract_size, broker, account_number, hedge_book_id
         FROM tc_futures_details WHERE trade_id = $3`,
        [childResult.rows[0].id, numContracts, trade.id]
      );
    } else if (trade.trade_type === "options") {
      await client.query(
        `INSERT INTO tc_option_details (trade_id, option_type, option_style, strike_price, premium, premium_total,
           expiration_date, underlying_contract, broker, account_number, exchange, exercise_status, hedge_book_id,
           option_side, premium_per_unit, collar_pair_id, parent_option_id)
         SELECT $1, option_type, option_style, strike_price, premium, premium_total,
           expiration_date, underlying_contract, broker, account_number, exchange, exercise_status, hedge_book_id,
           option_side, premium_per_unit, collar_pair_id, parent_option_id
         FROM tc_option_details WHERE trade_id = $2`,
        [childResult.rows[0].id, trade.id]
      );
    } else if (trade.trade_type === "swap") {
      await client.query(
        `INSERT INTO tc_swap_details (trade_id, swap_type, fixed_price, floating_reference, floating_index,
           notional_volume, volume_unit, start_date, end_date, payment_frequency, settlement_type,
           isda_ref, master_agreement, hedge_book_id)
         SELECT $1, swap_type, fixed_price, floating_reference, floating_index,
           notional_volume, volume_unit, start_date, end_date, payment_frequency, settlement_type,
           isda_ref, master_agreement, hedge_book_id
         FROM tc_swap_details WHERE trade_id = $2`,
        [childResult.rows[0].id, trade.id]
      );
    }
  }

  await writePositionEvent(client, {
    orgId: trade.org_id,
    tradeHeaderId: trade.id,
    eventType: "SPLIT",
    fromStatus,
    toStatus: "partial",
    performedBy: userId,
    metadata: { childIds, splits },
  });

  await emit({
    type: EventTypes.POSITION_SPLIT,
    source: "positionActions",
    entityType: "trade",
    entityId: trade.id,
    orgId: trade.org_id,
    userId,
    payload: { childIds },
  });

  return { parentId: trade.id, childIds };
}

// ─── Reassign Book ──────────────────────────────────────────────────────────

export interface ReassignBookParams {
  tradeId: string;
  userId: string;
  toBookId: string;
  reason?: string;
}

export async function reassignBook(params: ReassignBookParams) {
  return transaction(async (client) => {
    const trade = await loadTradeForUpdate(client, params.tradeId);
    const fromBookId = trade.hedge_book_id;

    if (!fromBookId) throw new Error("Trade is not assigned to a hedge book");
    if (fromBookId === params.toBookId) throw new Error("Already in the target book");

    // Update trade
    await client.query(
      `UPDATE tc_financial_trades SET hedge_book_id = $1 WHERE id = $2`,
      [params.toBookId, trade.id]
    );

    // Log reassignment
    await client.query(
      `INSERT INTO hedge_book_reassignments (org_id, trade_header_id, from_book_id, to_book_id, reassigned_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [trade.org_id, trade.id, fromBookId, params.toBookId, params.userId, params.reason ?? null]
    );

    await writePositionEvent(client, {
      orgId: trade.org_id,
      tradeHeaderId: trade.id,
      eventType: "REASSIGN_BOOK",
      fromStatus: trade.position_status,
      toStatus: trade.position_status,
      performedBy: params.userId,
      metadata: { fromBookId, toBookId: params.toBookId, reason: params.reason },
    });

    await emit({
      type: EventTypes.HEDGE_BOOK_REASSIGNED,
      source: "positionActions",
      entityType: "trade",
      entityId: trade.id,
      orgId: trade.org_id,
      userId: params.userId,
      payload: { fromBookId, toBookId: params.toBookId },
    });

    return { tradeId: trade.id, fromBookId, toBookId: params.toBookId };
  });
}
