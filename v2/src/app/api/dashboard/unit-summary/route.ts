import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const commodityId = searchParams.get("commodityId") ?? undefined;

    // Use lateral subqueries to avoid JOIN fan-out between budget and allocations
    const commodityFilter = commodityId ? ` AND commodity_id = $2` : "";
    const budgetCommodityFilter = commodityId ? ` AND p.commodity_id = $2` : "";

    const sql = `
      SELECT
        ou.id as unit_id,
        ou.name as unit_name,
        (SELECT COUNT(*) FROM sites s
         WHERE s.org_unit_id = ou.id AND s.is_active = true) as site_count,
        COALESCE(bgt.budgeted_volume, 0) as budgeted_volume,
        COALESCE(bgt.covered_volume, 0) as covered_volume,
        COALESCE(alloc.total_volume, 0) as total_volume,
        COALESCE(alerts.alert_count, 0) as alert_count
      FROM org_units ou
      JOIN org_hierarchy_levels ohl ON ohl.id = ou.hierarchy_level_id
      LEFT JOIN LATERAL (
        SELECT
          SUM(li.budgeted_volume) as budgeted_volume,
          SUM(li.committed_volume + li.hedged_volume) as covered_volume
        FROM bgt_line_items li
        JOIN bgt_periods p ON p.id = li.period_id
        WHERE p.org_id = $1
          AND p.site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))
          ${budgetCommodityFilter}
      ) bgt ON true
      LEFT JOIN LATERAL (
        SELECT SUM(a.allocated_volume) as total_volume
        FROM pm_allocations a
        WHERE a.org_id = $1
          AND a.status IN ('open','efp_closed','rolled','offset')
          AND a.site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))
          ${commodityFilter}
      ) alloc ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as alert_count
        FROM pm_allocations ra
        WHERE ra.org_id = $1
          AND ra.status = 'open'
          AND ra.site_id IN (SELECT site_id FROM get_sites_under_unit(ou.id))
          AND ra.contract_month <= TO_CHAR(NOW() + INTERVAL '30 days', 'YYYY-MM')
          ${commodityFilter}
      ) alerts ON true
      WHERE ou.org_id = $1
        AND ohl.is_site_level = false
        AND ou.is_active = true
      ORDER BY ou.sort_order, ou.name
    `;

    const params: unknown[] = [orgId];
    if (commodityId) params.push(commodityId);

    const rows = await queryAll<{
      unit_id: string;
      unit_name: string;
      site_count: string;
      budgeted_volume: string;
      covered_volume: string;
      total_volume: string;
      alert_count: string;
    }>(sql, params);

    const summaries = rows.map((r) => {
      const budgeted = Number(r.budgeted_volume);
      const covered = Number(r.covered_volume);
      return {
        unitId: r.unit_id,
        unitName: r.unit_name,
        siteCount: Number(r.site_count),
        coveragePct: budgeted > 0 ? Math.round((covered / budgeted) * 100) : 0,
        totalVolume: Number(r.total_volume),
        budgetedVolume: budgeted,
        alertCount: Number(r.alert_count),
      };
    });

    return NextResponse.json(summaries);
  } catch (err) {
    console.error("[dashboard/unit-summary] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
