import { NextResponse } from "next/server";
import { queryAll, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET() {
  try {
    const commodities = await queryAll(
      `SELECT c.id, c.name, c.category, c.unit, c.currency, c.contract_size, c.tick_size, c.tick_value,
              c.exchange, c.contract_months, c.decimal_places, c.is_active, c.config,
              c.price_unit, c.volume_unit,
              c.display_name, c.commodity_class, c.ticker_root,
              c.trade_price_unit, c.trade_volume_unit, c.price_decimal_places,
              c.point_value, c.basis_unit, c.basis_reference,
              c.volume_entry_mode, c.basis_sign_convention, c.futures_budget_mapping,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', cu.id,
                    'unit_name', cu.unit_name,
                    'abbreviation', cu.abbreviation,
                    'to_trade_unit', cu.to_trade_unit,
                    'from_trade_unit', cu.from_trade_unit,
                    'is_default_report', cu.is_default_report,
                    'sort_order', cu.sort_order
                  ) ORDER BY cu.sort_order
                ) FILTER (WHERE cu.id IS NOT NULL),
                '[]'
              ) AS units
       FROM commodities c
       LEFT JOIN commodity_units cu ON cu.commodity_id = c.id
       WHERE c.is_active = true
       GROUP BY c.id
       ORDER BY c.name`
    );
    return NextResponse.json(commodities);
  } catch (err) {
    console.error("[commodities] GET Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
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

    if (!id || !name) {
      return NextResponse.json(
        { error: "Missing required fields: id, name" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO commodities
         (id, name, category, unit, currency, exchange, contract_size, tick_size,
          tick_value, contract_months, decimal_places, price_unit, volume_unit, config,
          display_name, commodity_class, ticker_root,
          trade_price_unit, trade_volume_unit, price_decimal_places,
          point_value, basis_unit, basis_reference,
          volume_entry_mode, basis_sign_convention, futures_budget_mapping)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
       RETURNING *`,
      [
        id,
        name,
        category || "ag",
        unit || "MT",
        currency || "USD",
        exchange || null,
        contract_size || null,
        tick_size || null,
        tick_value || null,
        contract_months || null,
        decimal_places ?? 2,
        price_unit || null,
        volume_unit || null,
        config ? JSON.stringify(config) : null,
        display_name || name,
        commodity_class || "grains",
        ticker_root || null,
        trade_price_unit || null,
        trade_volume_unit || null,
        price_decimal_places ?? 4,
        point_value || null,
        basis_unit || null,
        basis_reference || null,
        volume_entry_mode || "units",
        basis_sign_convention || "positive_above",
        futures_budget_mapping ? JSON.stringify(futures_budget_mapping) : "{}",
      ]
    );

    const commodity = result.rows[0];

    // Insert reporting units if provided
    if (units && Array.isArray(units) && units.length > 0) {
      for (const u of units) {
        await query(
          `INSERT INTO commodity_units
             (commodity_id, unit_name, abbreviation, to_trade_unit, from_trade_unit,
              is_default_report, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (commodity_id, abbreviation) DO NOTHING`,
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
      entityId: commodity.id,
      action: "create",
      after: commodity as Record<string, unknown>,
    });

    return NextResponse.json(commodity, { status: 201 });
  } catch (err) {
    console.error("[commodities] POST Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
