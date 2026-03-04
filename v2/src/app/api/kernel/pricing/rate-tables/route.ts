import { NextResponse } from "next/server";
import { queryAll, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const commodityId = searchParams.get("commodityId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId parameter" }, { status: 400 });
    }

    await requirePlugin(orgId, "formula_pricing");

    let sql = `
      SELECT id, org_id, name, rate_type, commodity_id, rates,
             effective_date, expiry_date, is_active, created_at
      FROM pricing_rate_tables
      WHERE org_id = $1 AND is_active = true
    `;
    const params: unknown[] = [orgId];

    if (commodityId) {
      params.push(commodityId);
      sql += ` AND (commodity_id = $${params.length} OR commodity_id IS NULL)`;
    }

    sql += ` ORDER BY name`;

    const tables = await queryAll(sql, params);
    return NextResponse.json(tables);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[rate-tables] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, name, rateType, commodityId, rates, effectiveDate, expiryDate } = body;

    if (!orgId || !name || !rateType || !rates) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, name, rateType, rates" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO pricing_rate_tables
         (org_id, name, rate_type, commodity_id, rates, effective_date, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orgId, name, rateType, commodityId ?? null, JSON.stringify(rates),
       effectiveDate ?? null, expiryDate ?? null]
    );

    await auditLog({
      orgId,
      module: "kernel",
      entityType: "pricing_rate_table",
      entityId: result.rows[0].id,
      action: "create",
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[rate-tables] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
