import { queryOne, queryAll } from "./db";
import { auditLog } from "./audit";
import type { DashboardLayout, CoverageSiteEntry, PositionByMonthDataPoint } from "@/types/dashboard";

// ─── Dashboard CRUD ──────────────────────────────────────────────────────────

export async function getDashboards(userId: string, orgId: string): Promise<DashboardLayout[]> {
  return queryAll<DashboardLayout>(
    `SELECT * FROM crt_dashboards WHERE user_id = $1 AND org_id = $2 ORDER BY is_default DESC, name`,
    [userId, orgId]
  );
}

export async function getDashboard(dashboardId: string): Promise<DashboardLayout | null> {
  return queryOne<DashboardLayout>(
    `SELECT * FROM crt_dashboards WHERE id = $1`,
    [dashboardId]
  );
}

export async function createDashboard(
  userId: string,
  orgId: string,
  name?: string,
  layout?: unknown[]
): Promise<DashboardLayout> {
  const row = await queryOne<DashboardLayout>(
    `INSERT INTO crt_dashboards (user_id, org_id, name, layout)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, orgId, name ?? "My Dashboard", JSON.stringify(layout ?? [])]
  );
  if (!row) throw new Error("Failed to create dashboard");

  await auditLog({
    orgId,
    userId,
    module: "dashboard",
    entityType: "dashboard",
    entityId: row.id,
    action: "create",
    after: row as unknown as Record<string, unknown>,
  });

  return row;
}

export async function updateDashboard(
  dashboardId: string,
  userId: string,
  updates: { name?: string; layout?: unknown[]; isDefault?: boolean }
): Promise<DashboardLayout> {
  const before = await getDashboard(dashboardId);
  if (!before) throw new Error("Dashboard not found");

  const row = await queryOne<DashboardLayout>(
    `UPDATE crt_dashboards SET
       name = COALESCE($2, name),
       layout = COALESCE($3, layout),
       is_default = COALESCE($4, is_default),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [
      dashboardId,
      updates.name ?? null,
      updates.layout ? JSON.stringify(updates.layout) : null,
      updates.isDefault ?? null,
    ]
  );
  if (!row) throw new Error("Failed to update dashboard");

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "dashboard",
    entityType: "dashboard",
    entityId: dashboardId,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: row as unknown as Record<string, unknown>,
  });

  return row;
}

export async function deleteDashboard(dashboardId: string, userId: string): Promise<void> {
  const before = await getDashboard(dashboardId);
  if (!before) throw new Error("Dashboard not found");

  await queryOne(`DELETE FROM crt_dashboards WHERE id = $1 RETURNING id`, [dashboardId]);

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "dashboard",
    entityType: "dashboard",
    entityId: dashboardId,
    action: "delete",
    before: before as unknown as Record<string, unknown>,
  });
}

// ─── Aggregation Queries ─────────────────────────────────────────────────────

export async function getCoverageBySite(
  orgId: string,
  commodityId?: string
): Promise<CoverageSiteEntry[]> {
  let sql = `
    SELECT
      s.id as site_id,
      s.name as site_name,
      s.code as site_code,
      COALESCE(SUM(li.budgeted_volume), 0) as budgeted_volume,
      COALESCE(SUM(li.committed_volume + li.hedged_volume), 0) as covered_volume
    FROM sites s
    JOIN bgt_periods p ON p.site_id = s.id AND p.org_id = $1
    JOIN bgt_line_items li ON li.period_id = p.id
    WHERE s.org_id = $1
  `;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND p.commodity_id = $${params.length}`;
  }

  sql += ` GROUP BY s.id, s.name, s.code ORDER BY s.name`;

  const rows = await queryAll<{
    site_id: string;
    site_name: string;
    site_code: string;
    budgeted_volume: string;
    covered_volume: string;
  }>(sql, params);

  return rows.map((r) => {
    const budgeted = Number(r.budgeted_volume);
    const covered = Number(r.covered_volume);
    return {
      siteId: r.site_id,
      siteName: r.site_name,
      siteCode: r.site_code,
      budgetedVolume: budgeted,
      coveredVolume: covered,
      coveragePct: budgeted > 0 ? Math.round((covered / budgeted) * 100) : 0,
    };
  });
}

export async function getPositionsByMonth(
  orgId: string,
  commodityId?: string
): Promise<PositionByMonthDataPoint[]> {
  let sql = `
    SELECT
      contract_month,
      SUM(CASE WHEN status = 'open' THEN allocated_volume ELSE 0 END) as open_vol,
      SUM(CASE WHEN status = 'efp_closed' THEN allocated_volume ELSE 0 END) as locked_vol,
      SUM(CASE WHEN status = 'offset' THEN allocated_volume ELSE 0 END) as offset_vol,
      SUM(CASE WHEN status = 'rolled' THEN allocated_volume ELSE 0 END) as rolled_vol,
      SUM(allocated_volume) as total_vol
    FROM pm_allocations
    WHERE org_id = $1
      AND status != 'cancelled'
      AND contract_month IS NOT NULL
  `;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND commodity_id = $${params.length}`;
  }

  sql += ` GROUP BY contract_month ORDER BY contract_month`;

  const rows = await queryAll<{
    contract_month: string;
    open_vol: string;
    locked_vol: string;
    offset_vol: string;
    rolled_vol: string;
    total_vol: string;
  }>(sql, params);

  return rows.map((r) => ({
    month: r.contract_month,
    label: r.contract_month,
    open: Number(r.open_vol),
    locked: Number(r.locked_vol),
    offset: Number(r.offset_vol),
    rolled: Number(r.rolled_vol),
    total: Number(r.total_vol),
  }));
}
