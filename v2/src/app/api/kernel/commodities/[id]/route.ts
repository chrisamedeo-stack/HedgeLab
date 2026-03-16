import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
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
      display_name,
      commodity_class,
      ticker_root,
      trade_price_unit,
      trade_volume_unit,
      price_decimal_places,
      point_value,
      basis_unit,
      basis_reference,
      volume_entry_mode,
      basis_sign_convention,
      futures_budget_mapping,
      units,
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
         is_active = COALESCE($15, is_active),
         display_name = COALESCE($16, display_name),
         commodity_class = COALESCE($17, commodity_class),
         ticker_root = COALESCE($18, ticker_root),
         trade_price_unit = COALESCE($19, trade_price_unit),
         trade_volume_unit = COALESCE($20, trade_volume_unit),
         price_decimal_places = COALESCE($21, price_decimal_places),
         point_value = COALESCE($22, point_value),
         basis_unit = COALESCE($23, basis_unit),
         basis_reference = COALESCE($24, basis_reference),
         volume_entry_mode = COALESCE($25, volume_entry_mode),
         basis_sign_convention = COALESCE($26, basis_sign_convention),
         futures_budget_mapping = COALESCE($27, futures_budget_mapping)
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
        display_name ?? null,
        commodity_class ?? null,
        ticker_root ?? null,
        trade_price_unit ?? null,
        trade_volume_unit ?? null,
        price_decimal_places ?? null,
        point_value ?? null,
        basis_unit ?? null,
        basis_reference ?? null,
        volume_entry_mode ?? null,
        basis_sign_convention ?? null,
        futures_budget_mapping ? JSON.stringify(futures_budget_mapping) : null,
      ]
    );

    // If units array provided, replace all units (delete + re-insert)
    if (units !== undefined && Array.isArray(units)) {
      await query(`DELETE FROM commodity_units WHERE commodity_id = $1`, [id]);
      for (const u of units) {
        await query(
          `INSERT INTO commodity_units
             (commodity_id, unit_name, abbreviation, to_trade_unit, from_trade_unit,
              is_default_report, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            u.unit_name,
            u.abbreviation,
            u.to_trade_unit,
            u.from_trade_unit,
            u.is_default_report ?? false,
            u.sort_order ?? 0,
          ]
        );
      }
    }

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
