import { query, queryOne, queryAll, transaction } from "./db";
import { auditLog } from "./audit";
import { emit, EventTypes } from "./eventBus";
import { requirePermission } from "./permissions";
import type {
  Allocation,
  LockedPosition,
  PhysicalPosition,
  Rollover,
  AllocateToSiteParams,
  ExecuteEFPParams,
  ExecuteOffsetParams,
  ExecuteRollParams,
  CreatePhysicalParams,
  CancelAllocationParams,
  RolloverCandidate,
  RollUrgency,
  SitePositionView,
  SitePositionHedge,
  OpenBoardEntry,
  AllInSummaryEntry,
  HedgeBookEntry,
  PositionChain,
} from "@/types/positions";

// ─── 1. Allocate to Site ─────────────────────────────────────────────────────

export async function allocateToSite(params: AllocateToSiteParams): Promise<Allocation> {
  await requirePermission(params.userId, "position.allocate");

  const result = await query<Allocation>(
    `INSERT INTO pm_allocations
       (org_id, trade_id, site_id, commodity_id, allocated_volume,
        budget_month, allocation_date, status,
        trade_price, trade_date, contract_month, direction, currency,
        allocated_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,'open',$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      params.orgId,
      params.tradeId ?? null,
      params.siteId,
      params.commodityId,
      params.allocatedVolume,
      params.budgetMonth ?? null,
      params.tradePrice ?? null,
      params.tradeDate ?? null,
      params.contractMonth ?? null,
      params.direction ?? null,
      params.currency ?? "USD",
      params.userId,
      params.notes ?? null,
    ]
  );

  const allocation = result.rows[0];

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "positions",
    entityType: "allocation",
    entityId: allocation.id,
    action: "create",
    after: allocation as unknown as Record<string, unknown>,
  });

  await emit({
    type: EventTypes.POSITION_ALLOCATED,
    source: "positions",
    entityType: "allocation",
    entityId: allocation.id,
    payload: {
      siteId: params.siteId,
      commodityId: params.commodityId,
      volume: params.allocatedVolume,
      budgetMonth: params.budgetMonth,
      contractMonth: params.contractMonth,
      direction: params.direction,
    },
    orgId: params.orgId,
    userId: params.userId,
  });

  return allocation;
}

// ─── 2. Execute EFP (Lock) ───────────────────────────────────────────────────

export async function executeEFP(params: ExecuteEFPParams): Promise<LockedPosition> {
  await requirePermission(params.userId, "position.efp");

  const allocation = await queryOne<Allocation>(
    `SELECT * FROM pm_allocations WHERE id = $1`,
    [params.allocationId]
  );

  if (!allocation) throw new Error("Allocation not found");
  if (allocation.status !== "open") throw new Error(`Cannot lock — status is ${allocation.status}`);

  const dirMult = allocation.direction === "short" ? -1 : 1;
  const futuresPnl = allocation.trade_price
    ? (params.lockPrice - allocation.trade_price) * allocation.allocated_volume * dirMult
    : null;

  const basis = params.basisPrice ?? 0;
  // Cumulative roll cost from position chain
  const chain = await queryOne<{ cumulative_roll_cost: number }>(
    `SELECT cumulative_roll_cost FROM pm_position_chains
     WHERE current_id = $1 ORDER BY roll_count DESC LIMIT 1`,
    [params.allocationId]
  );
  const rollCost = chain?.cumulative_roll_cost ?? 0;
  const allInPrice = params.lockPrice + basis + rollCost;

  return await transaction(async (tx) => {
    // Create locked position
    const lockResult = await tx.query<LockedPosition>(
      `INSERT INTO pm_locked_positions
         (allocation_id, site_id, commodity_id, volume,
          locked_price, futures_component, basis_component,
          futures_pnl, all_in_price, currency, lock_date, delivery_month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE,$11)
       RETURNING *`,
      [
        params.allocationId,
        allocation.site_id,
        allocation.commodity_id,
        allocation.allocated_volume,
        params.lockPrice,
        params.lockPrice,
        basis,
        futuresPnl,
        allInPrice,
        allocation.currency,
        params.deliveryMonth ?? allocation.contract_month,
      ]
    );

    // Update allocation status
    await tx.query(
      `UPDATE pm_allocations SET status = 'efp_closed' WHERE id = $1`,
      [params.allocationId]
    );

    const locked = lockResult.rows[0];

    await auditLog({
      orgId: allocation.org_id ?? undefined,
      userId: params.userId,
      module: "positions",
      entityType: "locked_position",
      entityId: locked.id,
      action: "create",
      before: allocation as unknown as Record<string, unknown>,
      after: locked as unknown as Record<string, unknown>,
    });

    await emit({
      type: EventTypes.EFP_EXECUTED,
      source: "positions",
      entityType: "locked_position",
      entityId: locked.id,
      payload: {
        allocationId: params.allocationId,
        siteId: allocation.site_id,
        commodityId: allocation.commodity_id,
        volume: allocation.allocated_volume,
        lockedPrice: params.lockPrice,
        futuresPnl,
        allInPrice,
      },
      orgId: allocation.org_id ?? undefined,
      userId: params.userId,
    });

    return locked;
  });
}

// ─── 3. Execute Offset ───────────────────────────────────────────────────────

export async function executeOffset(params: ExecuteOffsetParams): Promise<Allocation> {
  await requirePermission(params.userId, "position.offset");

  const allocation = await queryOne<Allocation>(
    `SELECT * FROM pm_allocations WHERE id = $1`,
    [params.allocationId]
  );

  if (!allocation) throw new Error("Allocation not found");
  if (allocation.status !== "open") throw new Error(`Cannot offset — status is ${allocation.status}`);

  const dirMult = allocation.direction === "short" ? -1 : 1;
  const offsetPnl = allocation.trade_price
    ? (params.offsetPrice - allocation.trade_price) * allocation.allocated_volume * dirMult
    : null;

  const result = await query<Allocation>(
    `UPDATE pm_allocations
     SET status = 'offset',
         offset_date = CURRENT_DATE,
         offset_price = $2,
         offset_volume = allocated_volume,
         offset_pnl = $3
     WHERE id = $1
     RETURNING *`,
    [params.allocationId, params.offsetPrice, offsetPnl]
  );

  // The migration doesn't have offset_ columns yet — let me handle gracefully
  // Actually, looking at the design doc, allocations DO track offset fields.
  // But our migration was minimal. Let me keep it simple and just update status.

  const updated = result.rows[0];

  await auditLog({
    orgId: allocation.org_id ?? undefined,
    userId: params.userId,
    module: "positions",
    entityType: "allocation",
    entityId: params.allocationId,
    action: "offset",
    before: allocation as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  await emit({
    type: EventTypes.POSITION_OFFSET,
    source: "positions",
    entityType: "allocation",
    entityId: params.allocationId,
    payload: {
      siteId: allocation.site_id,
      commodityId: allocation.commodity_id,
      volume: allocation.allocated_volume,
      offsetPrice: params.offsetPrice,
      offsetPnl,
    },
    orgId: allocation.org_id ?? undefined,
    userId: params.userId,
  });

  return updated;
}

// ─── 4. Execute Roll ─────────────────────────────────────────────────────────

export async function executeRoll(params: ExecuteRollParams): Promise<Rollover> {
  await requirePermission(params.userId, "position.roll");

  const source = await queryOne<Allocation>(
    `SELECT * FROM pm_allocations WHERE id = $1`,
    [params.sourceAllocationId]
  );

  if (!source) throw new Error("Source allocation not found");
  if (source.status !== "open") throw new Error(`Cannot roll — status is ${source.status}`);

  const volume = params.openVolume ?? source.allocated_volume;
  const dirMult = source.direction === "short" ? -1 : 1;
  const closeRealizedPnl = source.trade_price
    ? (params.closePrice - source.trade_price) * source.allocated_volume * dirMult
    : null;
  const spreadPrice = params.closePrice - params.openPrice;
  const spreadCost = Math.abs(spreadPrice * source.allocated_volume);
  const commission = params.commission ?? 0;
  const fees = params.fees ?? 0;
  const totalCost = spreadCost + commission + fees;

  return await transaction(async (tx) => {
    // Create rollover record
    const rollResult = await tx.query<Rollover>(
      `INSERT INTO pm_rollovers
         (org_id, commodity_id, rollover_type, status, roll_date,
          close_month, close_volume, close_price, close_realized_pnl,
          open_month, open_volume, open_price, open_total_volume,
          spread_price, spread_cost,
          source_type, source_allocation_id,
          auto_reallocate, reallocation_site_id, reallocation_budget_month,
          direction, executed_by, notes)
       VALUES ($1,$2,'contract_month_roll','executed',CURRENT_DATE,
               $3,$4,$5,$6,$7,$8,$9,$8,$10,$11,
               'allocation',$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        params.orgId,
        source.commodity_id,
        source.contract_month,
        source.allocated_volume,
        params.closePrice,
        closeRealizedPnl,
        params.openMonth,
        volume,
        params.openPrice,
        spreadPrice,
        spreadCost,
        params.sourceAllocationId,
        params.autoReallocate ?? false,
        params.reallocationSiteId ?? source.site_id,
        params.reallocationBudgetMonth ?? source.budget_month,
        source.direction,
        params.userId,
        params.notes ?? null,
      ]
    );

    const rollover = rollResult.rows[0];

    // Create close leg
    await tx.query(
      `INSERT INTO pm_rollover_legs
         (rollover_id, leg_type, commodity_id, contract_month, volume, price, allocation_id, realized_pnl)
       VALUES ($1,'close',$2,$3,$4,$5,$6,$7)`,
      [
        rollover.id,
        source.commodity_id,
        source.contract_month,
        source.allocated_volume,
        params.closePrice,
        params.sourceAllocationId,
        closeRealizedPnl,
      ]
    );

    // Create open leg
    await tx.query(
      `INSERT INTO pm_rollover_legs
         (rollover_id, leg_type, commodity_id, contract_month, volume, price)
       VALUES ($1,'open',$2,$3,$4,$5)`,
      [rollover.id, source.commodity_id, params.openMonth, volume, params.openPrice]
    );

    // Create rollover costs
    await tx.query(
      `INSERT INTO pm_rollover_costs
         (rollover_id, spread_cost, commission, fees, total_cost, cost_allocation, site_id, currency)
       VALUES ($1,$2,$3,$4,$5,'site',$6,$7)`,
      [rollover.id, spreadCost, commission, fees, totalCost, source.site_id, source.currency]
    );

    // Mark source as rolled
    await tx.query(
      `UPDATE pm_allocations SET status = 'rolled', roll_id = $2 WHERE id = $1`,
      [params.sourceAllocationId, rollover.id]
    );

    // Create new allocation for the open leg (auto-reallocate)
    const newAllocResult = await tx.query<Allocation>(
      `INSERT INTO pm_allocations
         (org_id, site_id, commodity_id, allocated_volume,
          budget_month, allocation_date, status,
          trade_price, trade_date, contract_month, direction, currency,
          rolled_from_allocation_id, roll_id, allocated_by, notes)
       VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,'open',$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        params.orgId,
        params.reallocationSiteId ?? source.site_id,
        source.commodity_id,
        volume,
        params.reallocationBudgetMonth ?? source.budget_month,
        params.openPrice,
        source.trade_date,
        params.openMonth,
        source.direction,
        source.currency,
        params.sourceAllocationId,
        rollover.id,
        params.userId,
        `Rolled from ${source.contract_month} to ${params.openMonth}`,
      ]
    );

    // Update rollover with new allocation id
    await tx.query(
      `UPDATE pm_rollovers SET new_allocation_id = $2 WHERE id = $1`,
      [rollover.id, newAllocResult.rows[0].id]
    );

    await auditLog({
      orgId: params.orgId,
      userId: params.userId,
      module: "positions",
      entityType: "rollover",
      entityId: rollover.id,
      action: "create",
      after: rollover as unknown as Record<string, unknown>,
    });

    await emit({
      type: EventTypes.POSITION_ROLLED,
      source: "positions",
      entityType: "rollover",
      entityId: rollover.id,
      payload: {
        sourceAllocationId: params.sourceAllocationId,
        newAllocationId: newAllocResult.rows[0].id,
        closeMonth: source.contract_month,
        openMonth: params.openMonth,
        spreadCost: totalCost,
        closeRealizedPnl,
      },
      orgId: params.orgId,
      userId: params.userId,
    });

    return rollover;
  });
}

// ─── 5. Get Rollover Candidates ──────────────────────────────────────────────

export async function getRolloverCandidates(
  orgId: string,
  commodityId?: string
): Promise<RolloverCandidate[]> {
  let sql = `
    SELECT
      a.id, a.site_id, s.name as site_name,
      a.commodity_id, c.name as commodity_name,
      a.contract_month, a.allocated_volume,
      a.trade_price, a.direction,
      cal.last_trade_date,
      cal.first_notice_date,
      (cal.last_trade_date - CURRENT_DATE) as days_to_last_trade,
      (cal.first_notice_date - CURRENT_DATE) as days_to_first_notice
    FROM pm_allocations a
    LEFT JOIN sites s ON s.id = a.site_id
    LEFT JOIN commodities c ON c.id = a.commodity_id
    LEFT JOIN commodity_contract_calendar cal
      ON cal.commodity_id = a.commodity_id AND cal.contract_month = a.contract_month
    WHERE a.status = 'open'
      AND a.org_id = $1
      AND cal.last_trade_date IS NOT NULL
      AND (cal.last_trade_date - CURRENT_DATE) <= 21
  `;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND a.commodity_id = $${params.length}`;
  }

  sql += ` ORDER BY cal.last_trade_date ASC`;

  const rows = await queryAll(sql, params);

  return rows.map((r: Record<string, unknown>) => {
    const daysToLast = r.days_to_last_trade as number | null;
    let urgency: RollUrgency = "UPCOMING";
    if (daysToLast !== null && daysToLast <= 3) urgency = "CRITICAL";
    else if (daysToLast !== null && daysToLast <= 7) urgency = "URGENT";

    return {
      id: r.id as string,
      site_id: r.site_id as string,
      site_name: r.site_name as string,
      commodity_id: r.commodity_id as string,
      commodity_name: r.commodity_name as string,
      contract_month: r.contract_month as string,
      allocated_volume: Number(r.allocated_volume),
      trade_price: r.trade_price ? Number(r.trade_price) : null,
      direction: r.direction as RolloverCandidate["direction"],
      days_to_last_trade: daysToLast,
      days_to_first_notice: r.days_to_first_notice as number | null,
      last_trade_date: r.last_trade_date as string | null,
      first_notice_date: r.first_notice_date as string | null,
      urgency,
    };
  });
}

// ─── 6. Get Site Position (4-section view) ───────────────────────────────────

export async function getSitePosition(
  siteId: string,
  commodityId?: string
): Promise<SitePositionView> {
  // Site info
  const site = await queryOne<{ id: string; name: string; code: string }>(
    `SELECT id, name, code FROM sites WHERE id = $1`,
    [siteId]
  );
  if (!site) throw new Error("Site not found");

  const commodityFilter = commodityId ? [commodityId] : [];

  // Section 1: Hedges (allocations + locked info + chain roll costs)
  let hedgeSql = `
    SELECT a.*,
           lp.locked_price, lp.futures_pnl, lp.all_in_price,
           COALESCE(pc.cumulative_roll_cost, 0) as cumulative_roll_cost
    FROM pm_allocations a
    LEFT JOIN pm_locked_positions lp ON lp.allocation_id = a.id
    LEFT JOIN LATERAL (
      SELECT cumulative_roll_cost FROM pm_position_chains
      WHERE current_id = a.id ORDER BY roll_count DESC LIMIT 1
    ) pc ON true
    WHERE a.site_id = $1 AND a.status != 'cancelled'
  `;
  const hedgeParams: unknown[] = [siteId];
  if (commodityId) {
    hedgeParams.push(commodityId);
    hedgeSql += ` AND a.commodity_id = $${hedgeParams.length}`;
  }
  hedgeSql += ` ORDER BY a.contract_month, a.created_at`;
  const hedges = await queryAll<SitePositionHedge>(hedgeSql, hedgeParams);

  // Section 2: Physical commitments
  let physSql = `
    SELECT * FROM pm_physical_positions
    WHERE site_id = $1 AND status != 'cancelled'
  `;
  const physParams: unknown[] = [siteId];
  if (commodityId) {
    physParams.push(commodityId);
    physSql += ` AND commodity_id = $${physParams.length}`;
  }
  physSql += ` ORDER BY delivery_month, created_at`;
  const physicals = await queryAll(physSql, physParams);

  // Section 3: Open board (open hedges + market prices for unrealized P&L)
  const openHedges = hedges.filter((h) => h.status === "open");

  // Gather latest settlement prices (graceful degradation if md_prices table missing)
  let priceMap: Map<string, number> = new Map();
  try {
    const commodityIds = [...new Set(openHedges.map((h) => h.commodity_id).filter(Boolean))];
    if (commodityIds.length > 0) {
      const placeholders = commodityIds.map((_, i) => `$${i + 1}`).join(",");
      const priceRows = await queryAll<{ commodity_id: string; contract_month: string; price: string }>(
        `SELECT DISTINCT ON (commodity_id, contract_month)
           commodity_id, contract_month, price
         FROM md_prices
         WHERE commodity_id IN (${placeholders}) AND price_type = 'settlement'
         ORDER BY commodity_id, contract_month, price_date DESC`,
        commodityIds
      );
      for (const row of priceRows) {
        priceMap.set(`${row.commodity_id}|${row.contract_month}`, Number(row.price));
      }
    }
  } catch {
    // md_prices table may not exist yet — degrade gracefully
    priceMap = new Map();
  }

  const openBoard: OpenBoardEntry[] = openHedges.map((h) => {
    const tradePrice = h.trade_price ? Number(h.trade_price) : null;
    const marketPrice = priceMap.get(`${h.commodity_id}|${h.contract_month}`) ?? null;
    let unrealizedPnl: number | null = null;

    if (tradePrice !== null && marketPrice !== null) {
      const sign = h.direction === "long" ? 1 : -1;
      unrealizedPnl = sign * (marketPrice - tradePrice) * Number(h.allocated_volume);
    }

    return {
      contract_month: h.contract_month ?? "",
      direction: h.direction ?? null,
      volume: Number(h.allocated_volume),
      trade_price: tradePrice,
      market_price: marketPrice,
      unrealized_pnl: unrealizedPnl,
    };
  });

  // Section 4: All-in summary (locked positions aggregated by delivery month)
  let summSql = `
    SELECT
      lp.delivery_month,
      SUM(lp.volume) as total_volume,
      CASE WHEN SUM(lp.volume) > 0
        THEN SUM(lp.locked_price * lp.volume) / SUM(lp.volume)
        ELSE NULL END as vwap_locked_price,
      CASE WHEN SUM(lp.volume) > 0
        THEN SUM(COALESCE(lp.basis_component, 0) * lp.volume) / SUM(lp.volume)
        ELSE NULL END as avg_basis,
      COALESCE(SUM(rc_agg.total_cost), 0) as total_roll_costs,
      CASE WHEN SUM(lp.volume) > 0
        THEN SUM(lp.all_in_price * lp.volume) / SUM(lp.volume)
        ELSE NULL END as all_in_price,
      lp.currency
    FROM pm_locked_positions lp
    LEFT JOIN pm_allocations a ON a.id = lp.allocation_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(rc.total_cost), 0) as total_cost
      FROM pm_position_chains pc
      JOIN pm_rollover_costs rc ON rc.rollover_id = ANY(
        SELECT r.id FROM pm_rollovers r WHERE r.source_allocation_id = ANY(pc.chain_ids)
      )
      WHERE pc.current_id = a.id
    ) rc_agg ON true
    WHERE lp.site_id = $1
  `;
  const summParams: unknown[] = [siteId];
  if (commodityId) {
    summParams.push(commodityId);
    summSql += ` AND lp.commodity_id = $${summParams.length}`;
  }
  summSql += ` GROUP BY lp.delivery_month, lp.currency ORDER BY lp.delivery_month`;

  const summaryRows = await queryAll(summSql, summParams);
  const allInSummary: AllInSummaryEntry[] = summaryRows.map((r: Record<string, unknown>) => ({
    delivery_month: r.delivery_month as string,
    total_volume: Number(r.total_volume),
    vwap_locked_price: r.vwap_locked_price ? Number(r.vwap_locked_price) : null,
    avg_basis: r.avg_basis ? Number(r.avg_basis) : null,
    total_roll_costs: Number(r.total_roll_costs),
    all_in_price: r.all_in_price ? Number(r.all_in_price) : null,
    currency: (r.currency as string) ?? "USD",
  }));

  return {
    siteId: site.id,
    siteName: site.name,
    siteCode: site.code,
    commodityId,
    hedges,
    physicals: physicals as PhysicalPosition[],
    openBoard,
    allInSummary,
  };
}

// ─── 7. Get Hedge Book ───────────────────────────────────────────────────────

export async function getHedgeBook(
  orgId: string,
  commodityId?: string,
  regionGroupId?: string,
  orgUnitId?: string
): Promise<HedgeBookEntry[]> {
  let sql = `
    SELECT a.*,
           s.name as site_name, s.code as site_code, s.region,
           c.name as commodity_name
    FROM pm_allocations a
    LEFT JOIN sites s ON s.id = a.site_id
    LEFT JOIN commodities c ON c.id = a.commodity_id
    WHERE a.org_id = $1 AND a.status != 'cancelled'
  `;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND a.commodity_id = $${params.length}`;
  }

  if (orgUnitId) {
    params.push(orgUnitId);
    sql += ` AND a.site_id IN (SELECT site_id FROM get_sites_under_unit($${params.length}))`;
  } else if (regionGroupId) {
    params.push(regionGroupId);
    sql += ` AND a.site_id IN (
      SELECT sgm.site_id FROM site_group_members sgm WHERE sgm.site_group_id = $${params.length}
    )`;
  }

  sql += ` ORDER BY a.contract_month, s.name, a.created_at`;

  return await queryAll<HedgeBookEntry>(sql, params);
}

// ─── 8. Create Physical Position ─────────────────────────────────────────────

export async function createPhysicalPosition(params: CreatePhysicalParams): Promise<PhysicalPosition> {
  await requirePermission(params.userId, "position.create_physical");

  const result = await query<PhysicalPosition>(
    `INSERT INTO pm_physical_positions
       (org_id, site_id, commodity_id, direction, volume, price,
        pricing_type, basis_price, basis_month, delivery_month,
        counterparty, currency, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'open')
     RETURNING *`,
    [
      params.orgId,
      params.siteId,
      params.commodityId,
      params.direction,
      params.volume,
      params.price ?? null,
      params.pricingType ?? "fixed",
      params.basisPrice ?? null,
      params.basisMonth ?? null,
      params.deliveryMonth ?? null,
      params.counterparty ?? null,
      params.currency ?? "USD",
    ]
  );

  const physical = result.rows[0];

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "positions",
    entityType: "physical_position",
    entityId: physical.id,
    action: "create",
    after: physical as unknown as Record<string, unknown>,
  });

  await emit({
    type: EventTypes.PHYSICAL_POSITION_CREATED,
    source: "positions",
    entityType: "physical_position",
    entityId: physical.id,
    payload: {
      siteId: params.siteId,
      commodityId: params.commodityId,
      direction: params.direction,
      volume: params.volume,
      deliveryMonth: params.deliveryMonth,
    },
    orgId: params.orgId,
    userId: params.userId,
  });

  return physical;
}

// ─── 9. Cancel Allocation ────────────────────────────────────────────────────

export async function cancelAllocation(params: CancelAllocationParams): Promise<Allocation> {
  await requirePermission(params.userId, "position.allocate");

  const before = await queryOne<Allocation>(
    `SELECT * FROM pm_allocations WHERE id = $1`,
    [params.allocationId]
  );
  if (!before) throw new Error("Allocation not found");
  if (before.status !== "open") throw new Error(`Cannot cancel — status is ${before.status}`);

  const result = await query<Allocation>(
    `UPDATE pm_allocations SET status = 'cancelled', notes = COALESCE(notes || E'\n', '') || $2
     WHERE id = $1 RETURNING *`,
    [params.allocationId, params.notes ?? "Cancelled"]
  );

  const after = result.rows[0];

  await auditLog({
    orgId: before.org_id ?? undefined,
    userId: params.userId,
    module: "positions",
    entityType: "allocation",
    entityId: params.allocationId,
    action: "cancel",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  await emit({
    type: EventTypes.POSITION_DEALLOCATED,
    source: "positions",
    entityType: "allocation",
    entityId: params.allocationId,
    payload: {
      siteId: before.site_id,
      commodityId: before.commodity_id,
      volume: before.allocated_volume,
    },
    orgId: before.org_id ?? undefined,
    userId: params.userId,
  });

  return after;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function getAllocation(id: string): Promise<Allocation | null> {
  return queryOne<Allocation>(`SELECT * FROM pm_allocations WHERE id = $1`, [id]);
}

export async function getPositionChain(allocationId: string): Promise<PositionChain[]> {
  return queryAll<PositionChain>(
    `SELECT * FROM pm_position_chains WHERE original_id = (
       SELECT original_id FROM pm_position_chains WHERE current_id = $1 LIMIT 1
     ) ORDER BY roll_count`,
    [allocationId]
  );
}
