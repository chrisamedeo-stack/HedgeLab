import { queryAll, queryOne } from "./db";
import type {
  CoverageSiteEntry,
  PositionByMonthDataPoint,
  DashboardKpis,
  ChildSummary,
  DashboardAlert,
  SiteOperationalData,
  SiteOperationalHedge,
  SiteOperationalPhysical,
  SiteOperationalOpenEntry,
  SiteOperationalAllIn,
} from "@/types/dashboard";

// ─── Existing Queries (unchanged) ───────────────────────────────────────────

export async function getCoverageBySite(
  orgId: string,
  commodityId?: string,
  orgUnitId?: string
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
  if (orgUnitId) {
    params.push(orgUnitId);
    sql += ` AND s.id IN (SELECT site_id FROM get_sites_under_unit($${params.length}))`;
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
  commodityId?: string,
  orgUnitId?: string
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
  if (orgUnitId) {
    params.push(orgUnitId);
    sql += ` AND site_id IN (SELECT site_id FROM get_sites_under_unit($${params.length}))`;
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

// ─── Dashboard KPIs ─────────────────────────────────────────────────────────

export async function getDashboardKpis(
  orgId: string,
  commodityId?: string,
  orgUnitId?: string,
  siteId?: string
): Promise<DashboardKpis> {
  const result: DashboardKpis = {
    totalPnl: 0,
    coveragePct: 0,
    hedgedVolume: 0,
    netPosition: 0,
    budgetedVolume: 0,
    coveredVolume: 0,
    openVolume: 0,
    lockedVolume: 0,
  };

  // Build site filter clause
  let siteFilter = "";
  const baseParams: unknown[] = [orgId];

  if (siteId) {
    baseParams.push(siteId);
    siteFilter = ` AND site_id = $${baseParams.length}`;
  } else if (orgUnitId) {
    baseParams.push(orgUnitId);
    siteFilter = ` AND site_id IN (SELECT site_id FROM get_sites_under_unit($${baseParams.length}))`;
  }

  const commodityFilter = commodityId
    ? ((baseParams.push(commodityId)), ` AND commodity_id = $${baseParams.length}`)
    : "";

  // Position volumes from pm_allocations
  try {
    const pmSql = `
      SELECT
        SUM(CASE WHEN status = 'open' THEN allocated_volume ELSE 0 END) as open_vol,
        SUM(CASE WHEN status = 'efp_closed' THEN allocated_volume ELSE 0 END) as locked_vol,
        SUM(CASE WHEN status IN ('open', 'efp_closed') THEN allocated_volume ELSE 0 END) as hedged_vol,
        SUM(CASE WHEN direction = 'long' THEN allocated_volume ELSE -allocated_volume END) as net_pos
      FROM pm_allocations
      WHERE org_id = $1 AND status NOT IN ('cancelled', 'offset', 'rolled')
      ${siteFilter}${commodityFilter}
    `;
    const pm = await queryOne<{
      open_vol: string;
      locked_vol: string;
      hedged_vol: string;
      net_pos: string;
    }>(pmSql, baseParams);
    if (pm) {
      result.openVolume = Number(pm.open_vol) || 0;
      result.lockedVolume = Number(pm.locked_vol) || 0;
      result.hedgedVolume = Number(pm.hedged_vol) || 0;
      result.netPosition = Number(pm.net_pos) || 0;
    }
  } catch { /* pm table may not exist */ }

  // Budget volumes from bgt_line_items
  try {
    let budgetSql = `
      SELECT
        COALESCE(SUM(li.budgeted_volume), 0) as budgeted,
        COALESCE(SUM(li.committed_volume + li.hedged_volume), 0) as covered
      FROM bgt_line_items li
      JOIN bgt_periods p ON p.id = li.period_id
      WHERE p.org_id = $1
    `;
    const budgetParams: unknown[] = [orgId];
    if (siteId) {
      budgetParams.push(siteId);
      budgetSql += ` AND p.site_id = $${budgetParams.length}`;
    } else if (orgUnitId) {
      budgetParams.push(orgUnitId);
      budgetSql += ` AND p.site_id IN (SELECT site_id FROM get_sites_under_unit($${budgetParams.length}))`;
    }
    if (commodityId) {
      budgetParams.push(commodityId);
      budgetSql += ` AND p.commodity_id = $${budgetParams.length}`;
    }
    const bgt = await queryOne<{ budgeted: string; covered: string }>(budgetSql, budgetParams);
    if (bgt) {
      result.budgetedVolume = Number(bgt.budgeted) || 0;
      result.coveredVolume = Number(bgt.covered) || 0;
      result.coveragePct = result.budgetedVolume > 0
        ? Math.round((result.coveredVolume / result.budgetedVolume) * 100)
        : 0;
    }
  } catch { /* budget table may not exist */ }

  // P&L from latest MTM snapshot
  try {
    let pnlSql = `
      SELECT COALESCE(SUM(total_pnl), 0) as total_pnl
      FROM rsk_mtm_snapshots
      WHERE org_id = $1
        AND snapshot_date = (SELECT MAX(snapshot_date) FROM rsk_mtm_snapshots WHERE org_id = $1)
    `;
    const pnlParams: unknown[] = [orgId];
    if (commodityId) {
      pnlParams.push(commodityId);
      pnlSql += ` AND commodity_id = $${pnlParams.length}`;
    }
    const pnl = await queryOne<{ total_pnl: string }>(pnlSql, pnlParams);
    if (pnl) result.totalPnl = Number(pnl.total_pnl) || 0;
  } catch { /* risk table may not exist */ }

  return result;
}

// ─── Child Summaries ────────────────────────────────────────────────────────

export async function getChildSummaries(
  orgId: string,
  commodityId?: string,
  orgUnitId?: string
): Promise<ChildSummary[]> {
  // Determine what children to show
  if (!orgUnitId) {
    // Corporate level: show top-level org_units
    return await getTopLevelUnitSummaries(orgId, commodityId);
  }
  // Unit level: check if children are units or sites
  const childUnits = await queryAll<{ id: string }>(
    `SELECT id FROM org_units WHERE parent_id = $1 AND is_active = true LIMIT 1`,
    [orgUnitId]
  );
  if (childUnits.length > 0) {
    return await getChildUnitSummaries(orgId, orgUnitId, commodityId);
  }
  // Leaf unit: show sites directly
  return await getSiteSummariesUnderUnit(orgId, orgUnitId, commodityId);
}

async function getTopLevelUnitSummaries(orgId: string, commodityId?: string): Promise<ChildSummary[]> {
  let sql = `
    SELECT
      ou.id, ou.name, ou.code,
      (SELECT COUNT(*) FROM sites s WHERE s.org_unit_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))) as site_count,
      COALESCE(pm.hedged_vol, 0) as hedged_volume,
      COALESCE(pm.net_pos, 0) as net_position,
      COALESCE(bgt.budgeted, 0) as budgeted,
      COALESCE(bgt.covered, 0) as covered,
      COALESCE(rsk.pnl, 0) as pnl
    FROM org_units ou
    WHERE ou.org_id = $1 AND ou.parent_id IS NULL AND ou.is_active = true
  `;
  const params: unknown[] = [orgId];

  // Lateral joins for aggregation
  let pmFilter = "";
  let bgtFilter = "";
  if (commodityId) {
    params.push(commodityId);
    pmFilter = ` AND commodity_id = $${params.length}`;
    bgtFilter = ` AND p.commodity_id = $${params.length}`;
  }

  sql = `
    SELECT
      ou.id, ou.name, ou.code,
      (SELECT COUNT(*) FROM sites s
       WHERE s.id IN (SELECT site_id FROM get_sites_under_unit(ou.id))
       AND s.org_id = $1) as site_count,
      (SELECT COALESCE(SUM(allocated_volume), 0) FROM pm_allocations
       WHERE org_id = $1 AND status NOT IN ('cancelled','offset','rolled')
       AND site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))${pmFilter}) as hedged_volume,
      (SELECT COALESCE(SUM(CASE WHEN direction='long' THEN allocated_volume ELSE -allocated_volume END), 0)
       FROM pm_allocations
       WHERE org_id = $1 AND status NOT IN ('cancelled','offset','rolled')
       AND site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))${pmFilter}) as net_position,
      (SELECT COALESCE(SUM(li.budgeted_volume), 0) FROM bgt_line_items li
       JOIN bgt_periods p ON p.id = li.period_id
       WHERE p.org_id = $1 AND p.site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))${bgtFilter}) as budgeted,
      (SELECT COALESCE(SUM(li.committed_volume + li.hedged_volume), 0) FROM bgt_line_items li
       JOIN bgt_periods p ON p.id = li.period_id
       WHERE p.org_id = $1 AND p.site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))${bgtFilter}) as covered
    FROM org_units ou
    WHERE ou.org_id = $1 AND ou.parent_id IS NULL AND ou.is_active = true
    ORDER BY ou.sort_order, ou.name
  `;

  const rows = await queryAll<{
    id: string; name: string; code: string; site_count: string;
    hedged_volume: string; net_position: string; budgeted: string; covered: string;
  }>(sql, params);

  // Get P&L per unit from latest MTM
  let pnlMap: Map<string, number> = new Map();
  try {
    const pnlRows = await queryAll<{ unit_id: string; pnl: string }>(`
      SELECT ou.id as unit_id, COALESCE(SUM(ms.total_pnl), 0) as pnl
      FROM org_units ou
      CROSS JOIN LATERAL (
        SELECT total_pnl FROM rsk_mtm_snapshots
        WHERE org_id = $1
          AND snapshot_date = (SELECT MAX(snapshot_date) FROM rsk_mtm_snapshots WHERE org_id = $1)
      ) ms
      WHERE ou.org_id = $1 AND ou.parent_id IS NULL AND ou.is_active = true
      GROUP BY ou.id
    `, [orgId]);
    for (const r of pnlRows) pnlMap.set(r.unit_id, Number(r.pnl));
  } catch { /* risk may not exist */ }

  return rows.map((r) => {
    const budgeted = Number(r.budgeted);
    const covered = Number(r.covered);
    return {
      id: r.id,
      name: r.name,
      code: r.code ?? undefined,
      type: "unit" as const,
      siteCount: Number(r.site_count),
      coveragePct: budgeted > 0 ? Math.round((covered / budgeted) * 100) : 0,
      hedgedVolume: Number(r.hedged_volume),
      netPosition: Number(r.net_position),
      pnl: pnlMap.get(r.id) ?? 0,
      alertCount: 0,
    };
  });
}

async function getChildUnitSummaries(orgId: string, parentUnitId: string, commodityId?: string): Promise<ChildSummary[]> {
  const params: unknown[] = [orgId, parentUnitId];
  let pmFilter = "";
  let bgtFilter = "";
  if (commodityId) {
    params.push(commodityId);
    pmFilter = ` AND commodity_id = $${params.length}`;
    bgtFilter = ` AND p.commodity_id = $${params.length}`;
  }

  const sql = `
    SELECT
      ou.id, ou.name, ou.code,
      (SELECT COUNT(*) FROM sites s
       WHERE s.id IN (SELECT site_id FROM get_sites_under_unit(ou.id))
       AND s.org_id = $1) as site_count,
      (SELECT COALESCE(SUM(allocated_volume), 0) FROM pm_allocations
       WHERE org_id = $1 AND status NOT IN ('cancelled','offset','rolled')
       AND site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))${pmFilter}) as hedged_volume,
      (SELECT COALESCE(SUM(CASE WHEN direction='long' THEN allocated_volume ELSE -allocated_volume END), 0)
       FROM pm_allocations
       WHERE org_id = $1 AND status NOT IN ('cancelled','offset','rolled')
       AND site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))${pmFilter}) as net_position,
      (SELECT COALESCE(SUM(li.budgeted_volume), 0) FROM bgt_line_items li
       JOIN bgt_periods p ON p.id = li.period_id
       WHERE p.org_id = $1 AND p.site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))${bgtFilter}) as budgeted,
      (SELECT COALESCE(SUM(li.committed_volume + li.hedged_volume), 0) FROM bgt_line_items li
       JOIN bgt_periods p ON p.id = li.period_id
       WHERE p.org_id = $1 AND p.site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))${bgtFilter}) as covered
    FROM org_units ou
    WHERE ou.org_id = $1 AND ou.parent_id = $2 AND ou.is_active = true
    ORDER BY ou.sort_order, ou.name
  `;

  const rows = await queryAll<{
    id: string; name: string; code: string; site_count: string;
    hedged_volume: string; net_position: string; budgeted: string; covered: string;
  }>(sql, params);

  return rows.map((r) => {
    const budgeted = Number(r.budgeted);
    const covered = Number(r.covered);
    return {
      id: r.id,
      name: r.name,
      code: r.code ?? undefined,
      type: "unit" as const,
      siteCount: Number(r.site_count),
      coveragePct: budgeted > 0 ? Math.round((covered / budgeted) * 100) : 0,
      hedgedVolume: Number(r.hedged_volume),
      netPosition: Number(r.net_position),
      pnl: 0,
      alertCount: 0,
    };
  });
}

async function getSiteSummariesUnderUnit(orgId: string, unitId: string, commodityId?: string): Promise<ChildSummary[]> {
  const params: unknown[] = [orgId, unitId];
  let pmFilter = "";
  let bgtFilter = "";
  if (commodityId) {
    params.push(commodityId);
    pmFilter = ` AND commodity_id = $${params.length}`;
    bgtFilter = ` AND p.commodity_id = $${params.length}`;
  }

  const sql = `
    SELECT
      s.id, s.name, s.code,
      st.name as site_type,
      (SELECT COALESCE(SUM(allocated_volume), 0) FROM pm_allocations
       WHERE org_id = $1 AND status NOT IN ('cancelled','offset','rolled')
       AND site_id = s.id${pmFilter}) as hedged_volume,
      (SELECT COALESCE(SUM(CASE WHEN direction='long' THEN allocated_volume ELSE -allocated_volume END), 0)
       FROM pm_allocations
       WHERE org_id = $1 AND status NOT IN ('cancelled','offset','rolled')
       AND site_id = s.id${pmFilter}) as net_position,
      (SELECT COALESCE(SUM(li.budgeted_volume), 0) FROM bgt_line_items li
       JOIN bgt_periods p ON p.id = li.period_id
       WHERE p.org_id = $1 AND p.site_id = s.id${bgtFilter}) as budgeted,
      (SELECT COALESCE(SUM(li.committed_volume + li.hedged_volume), 0) FROM bgt_line_items li
       JOIN bgt_periods p ON p.id = li.period_id
       WHERE p.org_id = $1 AND p.site_id = s.id${bgtFilter}) as covered
    FROM sites s
    LEFT JOIN site_types st ON st.id = s.site_type_id
    WHERE s.org_id = $1
      AND s.id IN (SELECT site_id FROM get_sites_under_unit($2))
      AND s.is_active = true
    ORDER BY s.name
  `;

  const rows = await queryAll<{
    id: string; name: string; code: string; site_type: string | null;
    hedged_volume: string; net_position: string; budgeted: string; covered: string;
  }>(sql, params);

  return rows.map((r) => {
    const budgeted = Number(r.budgeted);
    const covered = Number(r.covered);
    return {
      id: r.id,
      name: r.name,
      code: r.code ?? undefined,
      type: "site" as const,
      siteType: r.site_type ?? undefined,
      coveragePct: budgeted > 0 ? Math.round((covered / budgeted) * 100) : 0,
      hedgedVolume: Number(r.hedged_volume),
      netPosition: Number(r.net_position),
      pnl: 0,
      alertCount: 0,
    };
  });
}

// ─── Dashboard Alerts ───────────────────────────────────────────────────────

export async function getDashboardAlerts(
  orgId: string,
  commodityId?: string,
  orgUnitId?: string,
  siteId?: string
): Promise<DashboardAlert[]> {
  const alerts: DashboardAlert[] = [];
  let alertIdx = 0;

  // Build common site filter
  const siteFilterParams: unknown[] = [orgId];
  let siteClause = "";
  if (siteId) {
    siteFilterParams.push(siteId);
    siteClause = ` AND site_id = $${siteFilterParams.length}`;
  } else if (orgUnitId) {
    siteFilterParams.push(orgUnitId);
    siteClause = ` AND site_id IN (SELECT site_id FROM get_sites_under_unit($${siteFilterParams.length}))`;
  }
  const commodityClause = commodityId
    ? ((siteFilterParams.push(commodityId)), ` AND commodity_id = $${siteFilterParams.length}`)
    : "";

  // Critical: expiring positions (contract_month within 7 days)
  try {
    const expSql = `
      SELECT COUNT(*) as cnt
      FROM pm_allocations
      WHERE org_id = $1
        AND status = 'open'
        AND contract_month IS NOT NULL
        AND (contract_month || '-01')::date <= CURRENT_DATE + interval '7 days'
      ${siteClause}${commodityClause}
    `;
    const exp = await queryOne<{ cnt: string }>(expSql, siteFilterParams);
    const cnt = Number(exp?.cnt ?? 0);
    if (cnt > 0) {
      alerts.push({
        id: `alert-${++alertIdx}`,
        severity: "critical",
        title: `${cnt} position${cnt > 1 ? "s" : ""} expiring within 7 days`,
        detail: "Review and roll or offset these positions before expiry",
        link: "/position-manager",
      });
    }
  } catch { /* table may not exist */ }

  // Warning: underhedged months (<50% coverage)
  try {
    const uhSql = `
      SELECT COUNT(DISTINCT li.budget_month) as cnt
      FROM bgt_line_items li
      JOIN bgt_periods p ON p.id = li.period_id
      WHERE p.org_id = $1
        AND li.budgeted_volume > 0
        AND (li.committed_volume + li.hedged_volume) / li.budgeted_volume < 0.5
        AND li.budget_month >= to_char(CURRENT_DATE, 'YYYY-MM')
      ${siteId ? ` AND p.site_id = $2` : orgUnitId ? ` AND p.site_id IN (SELECT site_id FROM get_sites_under_unit($2))` : ""}
      ${commodityId ? ` AND p.commodity_id = $${siteId || orgUnitId ? 3 : 2}` : ""}
    `;
    const uhParams: unknown[] = [orgId];
    if (siteId) uhParams.push(siteId);
    else if (orgUnitId) uhParams.push(orgUnitId);
    if (commodityId) uhParams.push(commodityId);
    const uh = await queryOne<{ cnt: string }>(uhSql, uhParams);
    const cnt = Number(uh?.cnt ?? 0);
    if (cnt > 0) {
      alerts.push({
        id: `alert-${++alertIdx}`,
        severity: "warning",
        title: `${cnt} month${cnt > 1 ? "s" : ""} under 50% hedged`,
        detail: "Budget months with coverage below target threshold",
        link: "/coverage",
      });
    }
  } catch { /* budget tables may not exist */ }

  // Warning: rolls due within 30 days
  try {
    const rollSql = `
      SELECT COUNT(*) as cnt
      FROM pm_allocations
      WHERE org_id = $1
        AND status = 'open'
        AND contract_month IS NOT NULL
        AND (contract_month || '-01')::date <= CURRENT_DATE + interval '30 days'
        AND (contract_month || '-01')::date > CURRENT_DATE + interval '7 days'
      ${siteClause}${commodityClause}
    `;
    const roll = await queryOne<{ cnt: string }>(rollSql, siteFilterParams);
    const cnt = Number(roll?.cnt ?? 0);
    if (cnt > 0) {
      alerts.push({
        id: `alert-${++alertIdx}`,
        severity: "warning",
        title: `${cnt} roll${cnt > 1 ? "s" : ""} due within 30 days`,
        detail: "Positions approaching expiry that may need rolling",
        link: "/position-manager",
      });
    }
  } catch { /* table may not exist */ }

  // Info: pending budget approvals
  try {
    let pendSql = `
      SELECT COUNT(*) as cnt FROM bgt_periods
      WHERE org_id = $1 AND status = 'submitted'
    `;
    const pendParams: unknown[] = [orgId];
    if (siteId) {
      pendParams.push(siteId);
      pendSql += ` AND site_id = $${pendParams.length}`;
    } else if (orgUnitId) {
      pendParams.push(orgUnitId);
      pendSql += ` AND site_id IN (SELECT site_id FROM get_sites_under_unit($${pendParams.length}))`;
    }
    const pend = await queryOne<{ cnt: string }>(pendSql, pendParams);
    const cnt = Number(pend?.cnt ?? 0);
    if (cnt > 0) {
      alerts.push({
        id: `alert-${++alertIdx}`,
        severity: "info",
        title: `${cnt} budget period${cnt > 1 ? "s" : ""} pending approval`,
        detail: "Submitted budgets awaiting review",
        link: "/budget",
      });
    }
  } catch { /* budget tables may not exist */ }

  return alerts;
}

// ─── Site Operational Data ──────────────────────────────────────────────────

export async function getSiteOperationalData(
  orgId: string,
  siteId: string,
  commodityId?: string
): Promise<SiteOperationalData> {
  const params: unknown[] = [siteId];
  const commodityClause = commodityId
    ? ((params.push(commodityId)), ` AND commodity_id = $${params.length}`)
    : "";

  // Section 1: Hedges
  const hedgeSql = `
    SELECT
      a.id, a.contract_month, a.direction, a.allocated_volume, a.trade_price, a.status,
      c.name as commodity_name,
      CASE WHEN a.status = 'open' AND a.trade_price IS NOT NULL AND mp.price IS NOT NULL
        THEN (CASE WHEN a.direction = 'long' THEN 1 ELSE -1 END) * (mp.price - a.trade_price) * a.allocated_volume
        ELSE NULL
      END as unrealized_pnl
    FROM pm_allocations a
    LEFT JOIN commodities c ON c.id = a.commodity_id
    LEFT JOIN LATERAL (
      SELECT price FROM md_prices
      WHERE commodity_id = a.commodity_id AND contract_month = a.contract_month AND price_type = 'settlement'
      ORDER BY price_date DESC LIMIT 1
    ) mp ON true
    WHERE a.site_id = $1 AND a.status != 'cancelled'${commodityClause}
    ORDER BY a.contract_month, a.created_at
  `;
  let hedges: SiteOperationalHedge[] = [];
  try {
    hedges = (await queryAll(hedgeSql, params)).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      contract_month: r.contract_month as string,
      direction: r.direction as string,
      allocated_volume: Number(r.allocated_volume),
      trade_price: r.trade_price ? Number(r.trade_price) : null,
      status: r.status as string,
      unrealized_pnl: r.unrealized_pnl ? Number(r.unrealized_pnl) : null,
      commodity_name: r.commodity_name as string | undefined,
    }));
  } catch { /* pm table may not exist */ }

  // Section 2: Physicals
  const physParams: unknown[] = [siteId];
  const physCommodity = commodityId
    ? ((physParams.push(commodityId)), ` AND pp.commodity_id = $${physParams.length}`)
    : "";
  const physSql = `
    SELECT pp.id, pp.delivery_month, pp.direction, pp.volume, pp.price,
           c.name as commodity_name
    FROM pm_physical_positions pp
    LEFT JOIN commodities c ON c.id = pp.commodity_id
    WHERE pp.site_id = $1 AND pp.status != 'cancelled'${physCommodity}
    ORDER BY pp.delivery_month
  `;
  let physicals: SiteOperationalPhysical[] = [];
  try {
    physicals = (await queryAll(physSql, physParams)).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      delivery_month: r.delivery_month as string,
      direction: r.direction as string,
      volume: Number(r.volume),
      price: r.price ? Number(r.price) : null,
      commodity_name: r.commodity_name as string | undefined,
    }));
  } catch { /* table may not exist */ }

  // Section 3: Open board
  const openHedges = hedges.filter((h) => h.status === "open");
  const openBoard: SiteOperationalOpenEntry[] = openHedges.map((h) => ({
    contract_month: h.contract_month ?? "",
    direction: h.direction ?? null,
    volume: h.allocated_volume,
    trade_price: h.trade_price,
    market_price: null, // already computed via lateral join
    unrealized_pnl: h.unrealized_pnl,
  }));

  // Section 4: All-in summary
  const summParams: unknown[] = [siteId];
  const summCommodity = commodityId
    ? ((summParams.push(commodityId)), ` AND lp.commodity_id = $${summParams.length}`)
    : "";
  const summSql = `
    SELECT
      lp.delivery_month,
      SUM(lp.volume) as total_volume,
      CASE WHEN SUM(lp.volume) > 0
        THEN SUM(lp.locked_price * lp.volume) / SUM(lp.volume)
        ELSE NULL END as vwap_locked_price,
      CASE WHEN SUM(lp.volume) > 0
        THEN SUM(COALESCE(lp.basis_component, 0) * lp.volume) / SUM(lp.volume)
        ELSE NULL END as avg_basis,
      COALESCE(SUM(lp.all_in_price * lp.volume) / NULLIF(SUM(lp.volume), 0), NULL) as all_in_price,
      lp.currency
    FROM pm_locked_positions lp
    WHERE lp.site_id = $1${summCommodity}
    GROUP BY lp.delivery_month, lp.currency
    ORDER BY lp.delivery_month
  `;
  let allInSummary: SiteOperationalAllIn[] = [];
  try {
    allInSummary = (await queryAll(summSql, summParams)).map((r: Record<string, unknown>) => ({
      delivery_month: r.delivery_month as string,
      total_volume: Number(r.total_volume),
      vwap_locked_price: r.vwap_locked_price ? Number(r.vwap_locked_price) : null,
      avg_basis: r.avg_basis ? Number(r.avg_basis) : null,
      total_roll_costs: 0,
      all_in_price: r.all_in_price ? Number(r.all_in_price) : null,
      currency: (r.currency as string) ?? "USD",
    }));
  } catch { /* table may not exist */ }

  // Coverage summary for this site
  let coverageSummary: SiteOperationalData["coverageSummary"] = null;
  try {
    const covParams: unknown[] = [orgId, siteId];
    let covSql = `
      SELECT
        COALESCE(SUM(li.budgeted_volume), 0) as budgeted,
        COALESCE(SUM(li.committed_volume + li.hedged_volume), 0) as covered
      FROM bgt_line_items li
      JOIN bgt_periods p ON p.id = li.period_id
      WHERE p.org_id = $1 AND p.site_id = $2
    `;
    if (commodityId) {
      covParams.push(commodityId);
      covSql += ` AND p.commodity_id = $${covParams.length}`;
    }
    const cov = await queryOne<{ budgeted: string; covered: string }>(covSql, covParams);
    if (cov) {
      const budgeted = Number(cov.budgeted);
      const covered = Number(cov.covered);
      if (budgeted > 0) {
        coverageSummary = { budgeted, covered, pct: Math.round((covered / budgeted) * 100) };
      }
    }
  } catch { /* budget tables may not exist */ }

  return { hedges, physicals, openBoard, allInSummary, coverageSummary };
}
