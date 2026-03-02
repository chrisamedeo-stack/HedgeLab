import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const commodityId = searchParams.get("commodityId");

    let sql = `
      SELECT lp.*,
             a.budget_month, a.contract_month, a.direction, a.trade_price,
             s.name as site_name, s.code as site_code,
             c.name as commodity_name
      FROM pm_locked_positions lp
      JOIN pm_allocations a ON a.id = lp.allocation_id
      LEFT JOIN sites s ON s.id = lp.site_id
      LEFT JOIN commodities c ON c.id = lp.commodity_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (siteId) {
      params.push(siteId);
      sql += ` AND lp.site_id = $${params.length}`;
    }
    if (commodityId) {
      params.push(commodityId);
      sql += ` AND lp.commodity_id = $${params.length}`;
    }

    sql += ` ORDER BY lp.delivery_month, lp.lock_date DESC`;

    const locked = await queryAll(sql, params);
    return NextResponse.json(locked);
  } catch (err) {
    console.error("[locked] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
