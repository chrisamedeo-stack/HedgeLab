import { queryOne, queryAll } from "./db";
import { auditLog } from "./audit";
import { requirePermission } from "./permissions";
import { emit, EventTypes } from "./eventBus";
import type {
  MtmSnapshot,
  MtmSummary,
  MtmFilters,
  PositionLimit,
  CreateLimitParams,
  UpdateLimitParams,
  LimitCheck,
  LimitCheckResult,
  ExposureBucket,
  CounterpartyExposure,
} from "@/types/risk";

// ─── MTM Engine ─────────────────────────────────────────────────────────────

export async function runMtm(orgId: string, userId: string): Promise<MtmSnapshot[]> {
  await requirePermission(userId, "risk.mtm");

  const today = new Date().toISOString().split("T")[0];

  // Get all commodities with positions
  const commodities = await queryAll<{ commodity_id: string }>(
    `SELECT DISTINCT commodity_id FROM pm_allocations WHERE org_id = $1 AND status NOT IN ('cancelled')`,
    [orgId]
  );

  const snapshots: MtmSnapshot[] = [];

  for (const { commodity_id } of commodities) {
    // Get latest market price
    const priceRow = await queryOne<{ price: string }>(
      `SELECT price FROM md_prices
       WHERE commodity_id = $1 ORDER BY price_date DESC LIMIT 1`,
      [commodity_id]
    );
    const marketPrice = priceRow ? Number(priceRow.price) : 0;

    // Futures P&L: sum of (market_price - trade_price) * volume * direction_sign
    const futuresRow = await queryOne<{ pnl: string; net_pos: string }>(
      `SELECT
         COALESCE(SUM(
           (CASE WHEN direction = 'long' THEN 1 ELSE -1 END)
           * allocated_volume
           * ($2 - COALESCE(trade_price, 0))
         ), 0) as pnl,
         COALESCE(SUM(
           (CASE WHEN direction = 'long' THEN 1 ELSE -1 END) * allocated_volume
         ), 0) as net_pos
       FROM pm_allocations
       WHERE org_id = $1 AND commodity_id = $3 AND status NOT IN ('cancelled', 'offset')`,
      [orgId, marketPrice, commodity_id]
    );
    const futuresPnl = Number(futuresRow?.pnl ?? 0);
    const netPosition = Number(futuresRow?.net_pos ?? 0);

    // Physical P&L from ct_physical_contracts
    const physicalRow = await queryOne<{ pnl: string }>(
      `SELECT COALESCE(SUM(
         (CASE WHEN direction = 'buy' THEN -1 ELSE 1 END)
         * delivered_volume
         * ($2 - COALESCE(price, 0))
       ), 0) as pnl
       FROM ct_physical_contracts
       WHERE org_id = $1 AND commodity_id = $3 AND status IN ('active', 'completed')`,
      [orgId, marketPrice, commodity_id]
    );
    const physicalPnl = Number(physicalRow?.pnl ?? 0);

    // Realized from offset allocations
    const realizedRow = await queryOne<{ pnl: string }>(
      `SELECT COALESCE(SUM(
         (CASE WHEN direction = 'long' THEN 1 ELSE -1 END)
         * allocated_volume
         * ($2 - COALESCE(trade_price, 0))
       ), 0) as pnl
       FROM pm_allocations
       WHERE org_id = $1 AND commodity_id = $3 AND status = 'offset'`,
      [orgId, marketPrice, commodity_id]
    );
    const realizedPnl = Number(realizedRow?.pnl ?? 0);
    const unrealizedPnl = futuresPnl;

    // Upsert snapshot
    const snapshot = await queryOne<MtmSnapshot>(
      `INSERT INTO rsk_mtm_snapshots
         (org_id, snapshot_date, commodity_id, futures_pnl, physical_pnl,
          net_position, realized_pnl, unrealized_pnl, market_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (org_id, snapshot_date, commodity_id)
       DO UPDATE SET
         futures_pnl = EXCLUDED.futures_pnl,
         physical_pnl = EXCLUDED.physical_pnl,
         net_position = EXCLUDED.net_position,
         realized_pnl = EXCLUDED.realized_pnl,
         unrealized_pnl = EXCLUDED.unrealized_pnl,
         market_price = EXCLUDED.market_price
       RETURNING *`,
      [orgId, today, commodity_id, futuresPnl, physicalPnl, netPosition, realizedPnl, unrealizedPnl, marketPrice]
    );

    snapshots.push(snapshot!);
  }

  await emit({
    type: EventTypes.MTM_CALCULATED,
    source: "risk",
    payload: { snapshotCount: snapshots.length, date: today },
    orgId,
    userId,
  });

  return snapshots;
}

// ─── MTM Queries ────────────────────────────────────────────────────────────

export async function getMtmSnapshots(filters: MtmFilters): Promise<MtmSnapshot[]> {
  let sql = `
    SELECT s.*, c.name as commodity_name
    FROM rsk_mtm_snapshots s
    LEFT JOIN commodities c ON c.id = s.commodity_id
    WHERE s.org_id = $1`;
  const params: unknown[] = [filters.orgId];

  if (filters.commodityId) {
    params.push(filters.commodityId);
    sql += ` AND s.commodity_id = $${params.length}`;
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    sql += ` AND s.snapshot_date >= $${params.length}`;
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    sql += ` AND s.snapshot_date <= $${params.length}`;
  }

  sql += ` ORDER BY s.snapshot_date DESC, c.name`;
  return queryAll<MtmSnapshot>(sql, params);
}

export async function getMtmSummary(orgId: string): Promise<MtmSummary> {
  // Get latest date
  const dateRow = await queryOne<{ d: string }>(
    `SELECT MAX(snapshot_date) as d FROM rsk_mtm_snapshots WHERE org_id = $1`,
    [orgId]
  );

  if (!dateRow?.d) {
    return {
      totalPnl: 0,
      futuresPnl: 0,
      physicalPnl: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      netPosition: 0,
      byCommodity: [],
    };
  }

  const rows = await queryAll<MtmSnapshot & { commodity_name: string }>(
    `SELECT s.*, c.name as commodity_name
     FROM rsk_mtm_snapshots s
     LEFT JOIN commodities c ON c.id = s.commodity_id
     WHERE s.org_id = $1 AND s.snapshot_date = $2
     ORDER BY c.name`,
    [orgId, dateRow.d]
  );

  const totalPnl = rows.reduce((s, r) => s + Number(r.futures_pnl) + Number(r.physical_pnl), 0);
  const futuresPnl = rows.reduce((s, r) => s + Number(r.futures_pnl), 0);
  const physicalPnl = rows.reduce((s, r) => s + Number(r.physical_pnl), 0);
  const realizedPnl = rows.reduce((s, r) => s + Number(r.realized_pnl), 0);
  const unrealizedPnl = rows.reduce((s, r) => s + Number(r.unrealized_pnl), 0);
  const netPosition = rows.reduce((s, r) => s + Number(r.net_position), 0);

  return {
    totalPnl,
    futuresPnl,
    physicalPnl,
    realizedPnl,
    unrealizedPnl,
    netPosition,
    byCommodity: rows.map((r) => ({
      commodityId: r.commodity_id ?? "",
      commodityName: r.commodity_name ?? "Unknown",
      totalPnl: Number(r.futures_pnl) + Number(r.physical_pnl),
      futuresPnl: Number(r.futures_pnl),
      physicalPnl: Number(r.physical_pnl),
      netPosition: Number(r.net_position),
    })),
  };
}

export async function getMtmHistory(
  orgId: string,
  days: number = 30
): Promise<MtmSnapshot[]> {
  return queryAll<MtmSnapshot>(
    `SELECT
       snapshot_date,
       SUM(futures_pnl) as futures_pnl,
       SUM(physical_pnl) as physical_pnl,
       SUM(futures_pnl + physical_pnl) as total_pnl,
       SUM(net_position) as net_position,
       SUM(realized_pnl) as realized_pnl,
       SUM(unrealized_pnl) as unrealized_pnl,
       'USD' as currency
     FROM rsk_mtm_snapshots
     WHERE org_id = $1 AND snapshot_date >= CURRENT_DATE - $2::INTEGER
     GROUP BY snapshot_date
     ORDER BY snapshot_date`,
    [orgId, days]
  );
}

// ─── Position Limits CRUD ───────────────────────────────────────────────────

export async function createLimit(params: CreateLimitParams): Promise<PositionLimit> {
  await requirePermission(params.userId, "risk.limits");

  const row = await queryOne<PositionLimit>(
    `INSERT INTO rsk_position_limits
       (org_id, commodity_id, limit_type, limit_value, alert_threshold, direction, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      params.orgId,
      params.commodityId ?? null,
      params.limitType,
      params.limitValue,
      params.alertThreshold ?? 80,
      params.direction ?? null,
      params.notes ?? null,
      params.userId,
    ]
  );

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "risk",
    entityType: "position_limit",
    entityId: row!.id,
    action: "create",
    after: row as unknown as Record<string, unknown>,
  });

  return row!;
}

export async function getLimit(id: string): Promise<PositionLimit | null> {
  return queryOne<PositionLimit>(
    `SELECT l.*, c.name as commodity_name
     FROM rsk_position_limits l
     LEFT JOIN commodities c ON c.id = l.commodity_id
     WHERE l.id = $1`,
    [id]
  );
}

export async function listLimits(orgId: string, activeOnly: boolean = true): Promise<PositionLimit[]> {
  let sql = `
    SELECT l.*, c.name as commodity_name
    FROM rsk_position_limits l
    LEFT JOIN commodities c ON c.id = l.commodity_id
    WHERE l.org_id = $1`;

  if (activeOnly) sql += ` AND l.is_active = true`;
  sql += ` ORDER BY c.name, l.limit_type`;

  return queryAll<PositionLimit>(sql, [orgId]);
}

export async function updateLimit(
  id: string,
  userId: string,
  changes: UpdateLimitParams
): Promise<PositionLimit> {
  await requirePermission(userId, "risk.limits");
  const before = await getLimit(id);
  if (!before) throw new Error("Limit not found");

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fields: [keyof UpdateLimitParams, string][] = [
    ["limitValue", "limit_value"],
    ["alertThreshold", "alert_threshold"],
    ["isActive", "is_active"],
    ["notes", "notes"],
  ];

  for (const [paramKey, colName] of fields) {
    if (changes[paramKey] !== undefined) {
      setClauses.push(`${colName} = $${idx}`);
      values.push(changes[paramKey]);
      idx++;
    }
  }

  if (setClauses.length === 0) return before;

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const row = await queryOne<PositionLimit>(
    `UPDATE rsk_position_limits SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "risk",
    entityType: "position_limit",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: row as unknown as Record<string, unknown>,
  });

  return row!;
}

export async function deleteLimit(id: string, userId: string): Promise<void> {
  await requirePermission(userId, "risk.limits");
  const before = await getLimit(id);
  if (!before) throw new Error("Limit not found");

  await queryOne(
    `UPDATE rsk_position_limits SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "risk",
    entityType: "position_limit",
    entityId: id,
    action: "deactivate",
    before: before as unknown as Record<string, unknown>,
  });
}

// ─── Limit Check Engine ────────────────────────────────────────────────────

export async function checkLimits(orgId: string, userId: string): Promise<LimitCheck[]> {
  await requirePermission(userId, "risk.limit_check");

  const limits = await listLimits(orgId);
  const checks: LimitCheck[] = [];

  for (const limit of limits) {
    let currentValue = 0;

    // Calculate current position value based on limit type
    const commodityFilter = limit.commodity_id ? ` AND commodity_id = '${limit.commodity_id}'` : "";

    if (limit.limit_type === "net") {
      const row = await queryOne<{ val: string }>(
        `SELECT COALESCE(SUM(
           (CASE WHEN direction = 'long' THEN 1 ELSE -1 END) * allocated_volume
         ), 0) as val
         FROM pm_allocations
         WHERE org_id = $1 AND status NOT IN ('cancelled', 'offset')${commodityFilter}`,
        [orgId]
      );
      currentValue = Math.abs(Number(row?.val ?? 0));
    } else if (limit.limit_type === "long") {
      const row = await queryOne<{ val: string }>(
        `SELECT COALESCE(SUM(allocated_volume), 0) as val
         FROM pm_allocations
         WHERE org_id = $1 AND direction = 'long' AND status NOT IN ('cancelled', 'offset')${commodityFilter}`,
        [orgId]
      );
      currentValue = Number(row?.val ?? 0);
    } else if (limit.limit_type === "short") {
      const row = await queryOne<{ val: string }>(
        `SELECT COALESCE(SUM(allocated_volume), 0) as val
         FROM pm_allocations
         WHERE org_id = $1 AND direction = 'short' AND status NOT IN ('cancelled', 'offset')${commodityFilter}`,
        [orgId]
      );
      currentValue = Number(row?.val ?? 0);
    } else if (limit.limit_type === "gross") {
      const row = await queryOne<{ val: string }>(
        `SELECT COALESCE(SUM(allocated_volume), 0) as val
         FROM pm_allocations
         WHERE org_id = $1 AND status NOT IN ('cancelled', 'offset')${commodityFilter}`,
        [orgId]
      );
      currentValue = Number(row?.val ?? 0);
    }

    const utilizationPct = Number(limit.limit_value) > 0
      ? (currentValue / Number(limit.limit_value)) * 100
      : 0;

    let result: LimitCheckResult = "ok";
    if (utilizationPct >= 100) {
      result = "breached";
    } else if (utilizationPct >= Number(limit.alert_threshold)) {
      result = "warning";
    }

    const check = await queryOne<LimitCheck>(
      `INSERT INTO rsk_limit_checks
         (org_id, limit_id, current_value, limit_value, utilization_pct, result, checked_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [orgId, limit.id, currentValue, limit.limit_value, utilizationPct, result, userId]
    );

    checks.push(check!);

    // Emit event for breaches
    if (result === "breached") {
      await emit({
        type: EventTypes.LIMIT_BREACHED,
        source: "risk",
        entityType: "position_limit",
        entityId: limit.id,
        payload: {
          limitType: limit.limit_type,
          commodityId: limit.commodity_id,
          currentValue,
          limitValue: Number(limit.limit_value),
          utilizationPct,
        },
        orgId,
        userId,
      });
    }
  }

  return checks;
}

// ─── Exposure Aggregations ──────────────────────────────────────────────────

export async function getExposureByTenor(orgId: string, commodityId?: string): Promise<ExposureBucket[]> {
  let sql = `
    SELECT
      contract_month as tenor,
      COALESCE(SUM(CASE WHEN direction = 'long' THEN allocated_volume ELSE 0 END), 0) as long_exposure,
      COALESCE(SUM(CASE WHEN direction = 'short' THEN allocated_volume ELSE 0 END), 0) as short_exposure
    FROM pm_allocations
    WHERE org_id = $1 AND status NOT IN ('cancelled', 'offset') AND contract_month IS NOT NULL`;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND commodity_id = $${params.length}`;
  }

  sql += ` GROUP BY contract_month ORDER BY contract_month`;

  const rows = await queryAll<{
    tenor: string;
    long_exposure: string;
    short_exposure: string;
  }>(sql, params);

  return rows.map((r) => ({
    tenor: r.tenor,
    longExposure: Number(r.long_exposure),
    shortExposure: Number(r.short_exposure),
    netExposure: Number(r.long_exposure) - Number(r.short_exposure),
  }));
}

export async function getExposureByCounterparty(orgId: string): Promise<CounterpartyExposure[]> {
  const rows = await queryAll<{
    counterparty_id: string;
    counterparty_name: string;
    total_exposure: string;
    contract_count: string;
    remaining_volume: string;
  }>(
    `SELECT
       c.counterparty_id,
       cp.name as counterparty_name,
       COALESCE(SUM(c.total_volume * COALESCE(c.price, 0)), 0) as total_exposure,
       COUNT(c.id) as contract_count,
       COALESCE(SUM(c.remaining_volume), 0) as remaining_volume
     FROM ct_physical_contracts c
     JOIN ct_counterparties cp ON cp.id = c.counterparty_id
     WHERE c.org_id = $1 AND c.status IN ('draft', 'active')
     GROUP BY c.counterparty_id, cp.name
     ORDER BY total_exposure DESC`,
    [orgId]
  );

  return rows.map((r) => ({
    counterpartyId: r.counterparty_id,
    counterpartyName: r.counterparty_name,
    totalExposure: Number(r.total_exposure),
    contractCount: Number(r.contract_count),
    remainingVolume: Number(r.remaining_volume),
  }));
}
