import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const unitId = searchParams.get("unitId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
    if (!unitId) return NextResponse.json({ error: "unitId required" }, { status: 400 });

    const commodityId = searchParams.get("commodityId") ?? undefined;

    // Use lateral subqueries to avoid JOIN fan-out between budget and allocations
    const budgetCommodityFilter = commodityId ? ` AND p.commodity_id = $3` : "";
    const allocCommodityFilter = commodityId ? ` AND a.commodity_id = $3` : "";

    const sql = `
      SELECT
        s.id as site_id,
        s.name as site_name,
        s.code as site_code,
        st.name as site_type,
        COALESCE(bgt.budgeted_volume, 0) as budgeted_volume,
        COALESCE(bgt.covered_volume, 0) as covered_volume,
        COALESCE(alloc.open_hedges, 0) as open_hedges,
        COALESCE(alloc.locked_hedges, 0) as locked_hedges,
        COALESCE(alloc.total_volume, 0) as total_volume
      FROM sites s
      JOIN site_types st ON st.id = s.site_type_id
      LEFT JOIN LATERAL (
        SELECT
          SUM(li.budgeted_volume) as budgeted_volume,
          SUM(li.committed_volume + li.hedged_volume) as covered_volume
        FROM bgt_line_items li
        JOIN bgt_periods p ON p.id = li.period_id
        WHERE p.site_id = s.id AND p.org_id = $1
          ${budgetCommodityFilter}
      ) bgt ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE a.status = 'open') as open_hedges,
          COUNT(*) FILTER (WHERE a.status = 'efp_closed') as locked_hedges,
          SUM(a.allocated_volume) FILTER (WHERE a.status != 'cancelled') as total_volume
        FROM pm_allocations a
        WHERE a.site_id = s.id AND a.org_id = $1
          ${allocCommodityFilter}
      ) alloc ON true
      WHERE s.org_id = $1
        AND s.is_active = true
        AND s.org_unit_id = $2
      ORDER BY s.name
    `;

    const params: unknown[] = [orgId, unitId];
    if (commodityId) params.push(commodityId);

    const rows = await queryAll<{
      site_id: string;
      site_name: string;
      site_code: string;
      site_type: string;
      budgeted_volume: string;
      covered_volume: string;
      open_hedges: string;
      locked_hedges: string;
      total_volume: string;
    }>(sql, params);

    const summaries = rows.map((r) => {
      const budgeted = Number(r.budgeted_volume);
      const covered = Number(r.covered_volume);
      return {
        siteId: r.site_id,
        siteName: r.site_name,
        siteCode: r.site_code,
        siteType: r.site_type,
        coveragePct: budgeted > 0 ? Math.round((covered / budgeted) * 100) : 0,
        openHedges: Number(r.open_hedges),
        lockedHedges: Number(r.locked_hedges),
        totalVolume: Number(r.total_volume),
      };
    });

    return NextResponse.json(summaries);
  } catch (err) {
    console.error("[dashboard/site-summary] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
