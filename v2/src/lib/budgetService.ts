import { query, queryOne, queryAll, transaction } from "./db";
import { auditLog } from "./audit";
import { emit, EventTypes } from "./eventBus";
import type {
  BudgetPeriod,
  BudgetLineItem,
  BudgetVersion,
  BudgetComponent,
  ForecastHistoryEntry,
  CreatePeriodParams,
  UpsertLineItemParams,
  BudgetFilters,
  CoverageSummary,
  CoverageDataPoint,
} from "@/types/budget";

// ─── Budget Periods ──────────────────────────────────────────────────────────

export async function createBudgetPeriod(params: CreatePeriodParams): Promise<BudgetPeriod> {
  const { orgId, userId, siteId, commodityId, budgetYear, notes, currency } = params;

  const row = await queryOne<BudgetPeriod>(
    `INSERT INTO bgt_periods (org_id, site_id, commodity_id, budget_year, notes, currency)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [orgId, siteId, commodityId, budgetYear, notes ?? null, currency ?? "USD"]
  );
  if (!row) throw new Error("Failed to create budget period");

  await auditLog({
    orgId,
    userId,
    module: "budget",
    entityType: "period",
    entityId: row.id,
    action: "create",
    after: row as unknown as Record<string, unknown>,
  });

  return row;
}

export async function getBudgetPeriod(periodId: string): Promise<BudgetPeriod | null> {
  const period = await queryOne<BudgetPeriod>(
    `SELECT p.*,
            s.name as site_name, s.code as site_code,
            c.name as commodity_name
     FROM bgt_periods p
     LEFT JOIN sites s ON s.id = p.site_id
     LEFT JOIN commodities c ON c.id = p.commodity_id
     WHERE p.id = $1`,
    [periodId]
  );
  if (!period) return null;

  const lineItems = await queryAll<BudgetLineItem>(
    `SELECT * FROM bgt_line_items WHERE period_id = $1 ORDER BY budget_month`,
    [periodId]
  );
  period.line_items = lineItems;

  return period;
}

export async function listBudgetPeriods(
  orgId: string,
  filters?: BudgetFilters
): Promise<BudgetPeriod[]> {
  let sql = `
    SELECT p.*,
           s.name as site_name, s.code as site_code,
           c.name as commodity_name
    FROM bgt_periods p
    LEFT JOIN sites s ON s.id = p.site_id
    LEFT JOIN commodities c ON c.id = p.commodity_id
    WHERE p.org_id = $1
  `;
  const params: unknown[] = [orgId];

  if (filters?.siteId) {
    params.push(filters.siteId);
    sql += ` AND p.site_id = $${params.length}`;
  }
  if (filters?.commodityId) {
    params.push(filters.commodityId);
    sql += ` AND p.commodity_id = $${params.length}`;
  }
  if (filters?.budgetYear) {
    params.push(filters.budgetYear);
    sql += ` AND p.budget_year = $${params.length}`;
  }
  if (filters?.status) {
    params.push(filters.status);
    sql += ` AND p.status = $${params.length}`;
  }

  sql += ` ORDER BY p.budget_year DESC, s.name, c.name`;

  return queryAll<BudgetPeriod>(sql, params);
}

// ─── Line Items ──────────────────────────────────────────────────────────────

export async function upsertLineItem(
  periodId: string,
  data: UpsertLineItemParams,
  userId?: string
): Promise<BudgetLineItem> {
  // Validate period is not locked
  const period = await queryOne<BudgetPeriod>(
    `SELECT * FROM bgt_periods WHERE id = $1`,
    [periodId]
  );
  if (!period) throw new Error("Budget period not found");
  if (period.locked_at) throw new Error("Cannot modify a locked budget period");

  const row = await queryOne<BudgetLineItem>(
    `INSERT INTO bgt_line_items (
       period_id, budget_month, budgeted_volume, budget_price,
       committed_volume, committed_avg_price, committed_cost,
       hedged_volume, hedged_avg_price, hedged_cost,
       forecast_volume, forecast_price, futures_month, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (period_id, budget_month) DO UPDATE SET
       budgeted_volume = COALESCE($3, bgt_line_items.budgeted_volume),
       budget_price = COALESCE($4, bgt_line_items.budget_price),
       committed_volume = COALESCE($5, bgt_line_items.committed_volume),
       committed_avg_price = COALESCE($6, bgt_line_items.committed_avg_price),
       committed_cost = COALESCE($7, bgt_line_items.committed_cost),
       hedged_volume = COALESCE($8, bgt_line_items.hedged_volume),
       hedged_avg_price = COALESCE($9, bgt_line_items.hedged_avg_price),
       hedged_cost = COALESCE($10, bgt_line_items.hedged_cost),
       forecast_volume = COALESCE($11, bgt_line_items.forecast_volume),
       forecast_price = COALESCE($12, bgt_line_items.forecast_price),
       futures_month = COALESCE($13, bgt_line_items.futures_month),
       notes = COALESCE($14, bgt_line_items.notes),
       updated_at = NOW()
     RETURNING *`,
    [
      periodId,
      data.budgetMonth,
      data.budgetedVolume ?? 0,
      data.budgetPrice ?? null,
      data.committedVolume ?? 0,
      data.committedAvgPrice ?? null,
      data.committedCost ?? 0,
      data.hedgedVolume ?? 0,
      data.hedgedAvgPrice ?? null,
      data.hedgedCost ?? 0,
      data.forecastVolume ?? null,
      data.forecastPrice ?? null,
      data.futuresMonth ?? null,
      data.notes ?? null,
    ]
  );

  if (!row) throw new Error("Failed to upsert line item");

  await auditLog({
    orgId: period.org_id,
    userId,
    module: "budget",
    entityType: "line_item",
    entityId: row.id,
    action: "upsert",
    after: row as unknown as Record<string, unknown>,
  });

  return row;
}

export async function upsertLineItems(
  periodId: string,
  items: UpsertLineItemParams[],
  userId?: string
): Promise<BudgetLineItem[]> {
  const results: BudgetLineItem[] = [];
  for (const item of items) {
    const result = await upsertLineItem(periodId, item, userId);
    results.push(result);
  }
  return results;
}

export async function deleteLineItem(
  lineItemId: string,
  userId?: string
): Promise<void> {
  const item = await queryOne<BudgetLineItem & { period_id: string }>(
    `SELECT li.*, p.org_id, p.locked_at FROM bgt_line_items li
     JOIN bgt_periods p ON p.id = li.period_id
     WHERE li.id = $1`,
    [lineItemId]
  );
  if (!item) throw new Error("Line item not found");
  if ((item as unknown as Record<string, unknown>).locked_at) {
    throw new Error("Cannot delete from a locked budget period");
  }

  await query(`DELETE FROM bgt_line_items WHERE id = $1`, [lineItemId]);

  await auditLog({
    orgId: (item as unknown as Record<string, unknown>).org_id as string,
    userId,
    module: "budget",
    entityType: "line_item",
    entityId: lineItemId,
    action: "delete",
    before: item as unknown as Record<string, unknown>,
  });
}

// ─── Workflow ────────────────────────────────────────────────────────────────

export async function submitBudget(
  periodId: string,
  userId: string
): Promise<BudgetPeriod> {
  const before = await queryOne<BudgetPeriod>(
    `SELECT * FROM bgt_periods WHERE id = $1`,
    [periodId]
  );
  if (!before) throw new Error("Budget period not found");
  if (before.status !== "draft") throw new Error("Only draft budgets can be submitted");

  // Create version snapshot on submit
  await createVersionSnapshot(periodId, userId, `Submitted`);

  const after = await queryOne<BudgetPeriod>(
    `UPDATE bgt_periods SET status = 'submitted', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [periodId]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "budget",
    entityType: "period",
    entityId: periodId,
    action: "submit",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after!;
}

export async function approveBudget(
  periodId: string,
  userId: string
): Promise<BudgetPeriod> {
  const before = await queryOne<BudgetPeriod>(
    `SELECT * FROM bgt_periods WHERE id = $1`,
    [periodId]
  );
  if (!before) throw new Error("Budget period not found");
  if (before.status !== "submitted") throw new Error("Only submitted budgets can be approved");

  const after = await queryOne<BudgetPeriod>(
    `UPDATE bgt_periods SET status = 'approved', approved_by = $2, approved_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [periodId, userId]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "budget",
    entityType: "period",
    entityId: periodId,
    action: "approve",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after!;
}

export async function lockBudget(
  periodId: string,
  userId: string
): Promise<BudgetPeriod> {
  const before = await queryOne<BudgetPeriod>(
    `SELECT * FROM bgt_periods WHERE id = $1`,
    [periodId]
  );
  if (!before) throw new Error("Budget period not found");
  if (before.status !== "approved") throw new Error("Only approved budgets can be locked");

  const after = await queryOne<BudgetPeriod>(
    `UPDATE bgt_periods SET locked_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [periodId]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "budget",
    entityType: "period",
    entityId: periodId,
    action: "lock",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after!;
}

export async function unlockBudget(
  periodId: string,
  userId: string
): Promise<BudgetPeriod> {
  const before = await queryOne<BudgetPeriod>(
    `SELECT * FROM bgt_periods WHERE id = $1`,
    [periodId]
  );
  if (!before) throw new Error("Budget period not found");
  if (!before.locked_at) throw new Error("Budget is not locked");

  const after = await queryOne<BudgetPeriod>(
    `UPDATE bgt_periods SET locked_at = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [periodId]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "budget",
    entityType: "period",
    entityId: periodId,
    action: "unlock",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return after!;
}

// ─── Versions ────────────────────────────────────────────────────────────────

export async function createVersionSnapshot(
  periodId: string,
  userId: string,
  name?: string
): Promise<BudgetVersion> {
  const lineItems = await queryAll<BudgetLineItem>(
    `SELECT * FROM bgt_line_items WHERE period_id = $1 ORDER BY budget_month`,
    [periodId]
  );

  // Get next version number
  const maxVersion = await queryOne<{ max_num: number }>(
    `SELECT COALESCE(MAX(version_number), 0) as max_num FROM bgt_versions WHERE period_id = $1`,
    [periodId]
  );
  const nextNum = (maxVersion?.max_num ?? 0) + 1;

  const version = await queryOne<BudgetVersion>(
    `INSERT INTO bgt_versions (period_id, version_number, version_name, snapshot, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [periodId, nextNum, name ?? `v${nextNum}`, JSON.stringify(lineItems), userId]
  );

  if (!version) throw new Error("Failed to create version snapshot");

  const period = await queryOne<{ org_id: string }>(`SELECT org_id FROM bgt_periods WHERE id = $1`, [periodId]);
  await auditLog({
    orgId: period?.org_id,
    userId,
    module: "budget",
    entityType: "version",
    entityId: version.id,
    action: "create",
    after: { version_number: nextNum, version_name: version.version_name },
  });

  return version;
}

export async function getVersionHistory(periodId: string): Promise<BudgetVersion[]> {
  return queryAll<BudgetVersion>(
    `SELECT * FROM bgt_versions WHERE period_id = $1 ORDER BY version_number DESC`,
    [periodId]
  );
}

export async function restoreVersion(
  periodId: string,
  versionNumber: number,
  userId: string
): Promise<BudgetLineItem[]> {
  const period = await queryOne<BudgetPeriod>(
    `SELECT * FROM bgt_periods WHERE id = $1`,
    [periodId]
  );
  if (!period) throw new Error("Budget period not found");
  if (period.locked_at) throw new Error("Cannot restore to a locked budget period");

  const version = await queryOne<BudgetVersion>(
    `SELECT * FROM bgt_versions WHERE period_id = $1 AND version_number = $2`,
    [periodId, versionNumber]
  );
  if (!version) throw new Error(`Version ${versionNumber} not found`);

  // Create snapshot of current state before restoring
  await createVersionSnapshot(periodId, userId, `Before restore to v${versionNumber}`);

  // Delete current line items and restore from snapshot
  return await transaction(async (client) => {
    await client.query(`DELETE FROM bgt_line_items WHERE period_id = $1`, [periodId]);

    const snapshot = typeof version.snapshot === "string"
      ? JSON.parse(version.snapshot)
      : version.snapshot;

    const results: BudgetLineItem[] = [];
    for (const item of snapshot as BudgetLineItem[]) {
      const restored = await queryOne<BudgetLineItem>(
        `INSERT INTO bgt_line_items (
           period_id, budget_month, budgeted_volume, budget_price,
           committed_volume, committed_avg_price, committed_cost,
           hedged_volume, hedged_avg_price, hedged_cost,
           forecast_volume, forecast_price, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          periodId, item.budget_month, item.budgeted_volume, item.budget_price,
          item.committed_volume, item.committed_avg_price, item.committed_cost,
          item.hedged_volume, item.hedged_avg_price, item.hedged_cost,
          item.forecast_volume, item.forecast_price, item.notes,
        ]
      );
      if (restored) results.push(restored);
    }

    await auditLog({
      orgId: period.org_id,
      userId,
      module: "budget",
      entityType: "period",
      entityId: periodId,
      action: "restore_version",
      notes: `Restored to version ${versionNumber}`,
    });

    return results;
  });
}

// ─── Coverage ────────────────────────────────────────────────────────────────

export async function getCoverageSummary(
  orgId: string,
  commodityId?: string,
  siteId?: string
): Promise<CoverageSummary> {
  let sql = `
    SELECT
      li.budget_month,
      SUM(li.budgeted_volume) as budgeted,
      SUM(li.committed_volume) as committed,
      SUM(li.hedged_volume) as hedged,
      SUM(GREATEST(li.budgeted_volume - li.committed_volume - li.hedged_volume, 0)) as open
    FROM bgt_line_items li
    JOIN bgt_periods p ON p.id = li.period_id
    WHERE p.org_id = $1
  `;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND p.commodity_id = $${params.length}`;
  }
  if (siteId) {
    params.push(siteId);
    sql += ` AND p.site_id = $${params.length}`;
  }

  sql += ` GROUP BY li.budget_month ORDER BY li.budget_month`;

  const rows = await queryAll<{
    budget_month: string;
    budgeted: string;
    committed: string;
    hedged: string;
    open: string;
  }>(sql, params);

  let totalBudgeted = 0;
  let totalCommitted = 0;
  let totalHedged = 0;
  let totalOpen = 0;

  const byMonth: CoverageDataPoint[] = rows.map((r) => {
    const budgeted = Number(r.budgeted);
    const committed = Number(r.committed);
    const hedged = Number(r.hedged);
    const open = Number(r.open);

    totalBudgeted += budgeted;
    totalCommitted += committed;
    totalHedged += hedged;
    totalOpen += open;

    return {
      month: r.budget_month,
      budgeted,
      committed,
      hedged,
      open,
      coveragePct: budgeted > 0 ? Math.round(((committed + hedged) / budgeted) * 100) : 0,
    };
  });

  return {
    totalBudgeted,
    totalCommitted,
    totalHedged,
    totalOpen,
    overallCoveragePct:
      totalBudgeted > 0
        ? Math.round(((totalCommitted + totalHedged) / totalBudgeted) * 100)
        : 0,
    byMonth,
  };
}

// ─── Components ──────────────────────────────────────────────────────────────

export async function getLineItemComponents(lineItemId: string): Promise<BudgetComponent[]> {
  return queryAll<BudgetComponent>(
    `SELECT * FROM bgt_line_item_components WHERE line_item_id = $1 ORDER BY display_order`,
    [lineItemId]
  );
}

export async function saveLineItemComponents(
  lineItemId: string,
  components: BudgetComponent[]
): Promise<BudgetComponent[]> {
  await query(`DELETE FROM bgt_line_item_components WHERE line_item_id = $1`, [lineItemId]);
  const results: BudgetComponent[] = [];
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    const row = await queryOne<BudgetComponent>(
      `INSERT INTO bgt_line_item_components (line_item_id, component_name, unit, target_value, display_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [lineItemId, c.component_name, c.unit || "$/bu", c.target_value || 0, i]
    );
    if (row) results.push(row);
  }
  return results;
}

// ─── Forecast History ────────────────────────────────────────────────────────

export async function getForecastHistory(lineItemId: string): Promise<ForecastHistoryEntry[]> {
  return queryAll<ForecastHistoryEntry>(
    `SELECT * FROM bgt_forecast_history WHERE line_item_id = $1 ORDER BY recorded_at DESC`,
    [lineItemId]
  );
}

export async function logForecastChange(
  lineItemId: string,
  forecastVolume: number | null,
  forecastPrice: number | null,
  recordedBy?: string,
  notes?: string
): Promise<ForecastHistoryEntry | null> {
  return queryOne<ForecastHistoryEntry>(
    `INSERT INTO bgt_forecast_history (line_item_id, forecast_volume, forecast_price, recorded_by, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [lineItemId, forecastVolume, forecastPrice, recordedBy ?? null, notes ?? null]
  );
}
