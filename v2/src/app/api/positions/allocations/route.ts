import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";
import { allocateToSite } from "@/lib/positionService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (orgId) await requirePlugin(orgId, "position_manager");
    const siteId = searchParams.get("siteId");
    const commodityId = searchParams.get("commodityId");
    const status = searchParams.get("status");
    const contractMonth = searchParams.get("contractMonth");
    const budgetMonth = searchParams.get("budgetMonth");

    let sql = `
      SELECT a.*,
             s.name as site_name, s.code as site_code,
             c.name as commodity_name
      FROM pm_allocations a
      LEFT JOIN sites s ON s.id = a.site_id
      LEFT JOIN commodities c ON c.id = a.commodity_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (orgId) {
      params.push(orgId);
      sql += ` AND a.org_id = $${params.length}`;
    }
    if (siteId) {
      params.push(siteId);
      sql += ` AND a.site_id = $${params.length}`;
    }
    if (commodityId) {
      params.push(commodityId);
      sql += ` AND a.commodity_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND a.status = $${params.length}`;
    }
    if (contractMonth) {
      params.push(contractMonth);
      sql += ` AND a.contract_month = $${params.length}`;
    }
    if (budgetMonth) {
      params.push(budgetMonth);
      sql += ` AND a.budget_month = $${params.length}`;
    }

    sql += ` ORDER BY a.contract_month, a.created_at DESC`;

    const allocations = await queryAll(sql, params);
    return NextResponse.json(allocations);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[allocations] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, userId, tradeId, siteId, commodityId, allocatedVolume,
            budgetMonth, tradePrice, tradeDate, contractMonth, direction,
            currency, notes } = body;

    await requirePlugin(orgId, "position_manager");

    if (!orgId || !userId || !siteId || !commodityId || !allocatedVolume) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, userId, siteId, commodityId, allocatedVolume" },
        { status: 400 }
      );
    }

    // Prevent allocating swap trades — swaps settle via their own schedule
    if (tradeId) {
      const trade = await queryOne<{ trade_type: string }>(
        `SELECT trade_type FROM tc_financial_trades WHERE id = $1`,
        [tradeId]
      );
      if (trade?.trade_type === "swap") {
        return NextResponse.json(
          { error: "Swap trades cannot be allocated to sites. They settle via their own settlement schedule." },
          { status: 400 }
        );
      }
    }

    const allocation = await allocateToSite({
      orgId, userId, tradeId, siteId, commodityId,
      allocatedVolume: Number(allocatedVolume),
      budgetMonth, tradePrice: tradePrice ? Number(tradePrice) : undefined,
      tradeDate, contractMonth, direction, currency, notes,
    });

    return NextResponse.json(allocation, { status: 201 });
  } catch (err) {
    console.error("[allocations] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
