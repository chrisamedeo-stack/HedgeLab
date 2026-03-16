import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Fetch existing row for audit before-snapshot
    const before = await queryOne(
      `SELECT * FROM commodities WHERE id = $1`,
      [id]
    );
    if (!before) {
      return NextResponse.json({ error: "Commodity not found" }, { status: 404 });
    }

    const {
      name,
      category,
      unit,
      currency,
      exchange,
      contract_size,
      tick_size,
      tick_value,
      contract_months,
      decimal_places,
      price_unit,
      volume_unit,
      config,
      is_active,
    } = body;

    // Merge config JSONB: existing config + incoming config (for month_mappings etc.)
    const mergedConfig =
      config !== undefined
        ? { ...(before.config ?? {}), ...config }
        : before.config;

    const result = await queryOne(
      `UPDATE commodities SET
         name = COALESCE($2, name),
         category = COALESCE($3, category),
         unit = COALESCE($4, unit),
         currency = COALESCE($5, currency),
         exchange = COALESCE($6, exchange),
         contract_size = COALESCE($7, contract_size),
         tick_size = COALESCE($8, tick_size),
         tick_value = COALESCE($9, tick_value),
         contract_months = COALESCE($10, contract_months),
         decimal_places = COALESCE($11, decimal_places),
         price_unit = COALESCE($12, price_unit),
         volume_unit = COALESCE($13, volume_unit),
         config = $14,
         is_active = COALESCE($15, is_active)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name ?? null,
        category ?? null,
        unit ?? null,
        currency ?? null,
        exchange ?? null,
        contract_size ?? null,
        tick_size ?? null,
        tick_value ?? null,
        contract_months ?? null,
        decimal_places ?? null,
        price_unit ?? null,
        volume_unit ?? null,
        mergedConfig ? JSON.stringify(mergedConfig) : null,
        is_active ?? null,
      ]
    );

    await auditLog({
      module: "kernel",
      entityType: "commodity",
      entityId: id,
      action: "update",
      before: before as Record<string, unknown>,
      after: result as Record<string, unknown>,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[commodities] PUT Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
