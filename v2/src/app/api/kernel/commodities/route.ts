import { NextResponse } from "next/server";
import { queryAll, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET() {
  try {
    const commodities = await queryAll(
      `SELECT * FROM commodities WHERE is_active = true ORDER BY name`
    );

    // Fetch reporting units separately — graceful fallback if table doesn't exist yet
    let unitsByComm: Record<string, unknown[]> = {};
    try {
      const units = await queryAll<{
        commodity_id: string; id: string; unit_name: string;
        abbreviation: string; to_trade_unit: string; from_trade_unit: string;
        is_default_report: boolean; sort_order: number;
      }>(`SELECT commodity_id, id, unit_name, abbreviation, to_trade_unit,
                 from_trade_unit, is_default_report, sort_order
          FROM commodity_units ORDER BY sort_order`);
      for (const u of units) {
        (unitsByComm[u.commodity_id] ??= []).push({
          id: u.id, unit_name: u.unit_name, abbreviation: u.abbreviation,
          to_trade_unit: u.to_trade_unit, from_trade_unit: u.from_trade_unit,
          is_default_report: u.is_default_report, sort_order: u.sort_order,
        });
      }
    } catch {
      // commodity_units table may not exist yet — skip
    }

    const result = commodities.map((c: Record<string, unknown>) => ({
      ...c,
      units: unitsByComm[c.id as string] ?? [],
    }));

    return NextResponse.json(result);
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
    const { id, name, units, config, futures_budget_mapping, ...rest } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: "Missing required fields: id, name" },
        { status: 400 }
      );
    }

    // Core columns that always exist in the commodities table
    const coreColumns = [
      "category", "unit", "currency", "exchange",
      "contract_size", "tick_size", "tick_value", "contract_months",
      "decimal_places", "price_unit", "volume_unit", "is_active",
    ];
    const coreDefaults: Record<string, unknown> = {
      category: "ag", unit: "MT", currency: "USD", decimal_places: 2,
    };

    // Extended columns added by later migrations — may not exist
    const extColumns = [
      "display_name", "commodity_class", "ticker_root",
      "trade_price_unit", "trade_volume_unit", "price_decimal_places",
      "point_value", "basis_unit", "basis_reference",
      "volume_entry_mode", "basis_sign_convention",
    ];
    const extDefaults: Record<string, unknown> = {
      display_name: name, commodity_class: "grains",
      price_decimal_places: 4, volume_entry_mode: "units",
      basis_sign_convention: "positive_above",
    };

    // Build column list dynamically
    const columns = ["id", "name"];
    const values: unknown[] = [id, name];
    let paramIdx = 3;

    for (const col of coreColumns) {
      columns.push(col);
      values.push(rest[col] ?? coreDefaults[col] ?? null);
      paramIdx++;
    }

    // Config (JSONB)
    columns.push("config");
    values.push(config ? JSON.stringify(config) : null);
    paramIdx++;

    // Try INSERT with extended columns, fall back to core-only
    const extCols = [...columns];
    const extVals = [...values];
    let extIdx = paramIdx;
    for (const col of extColumns) {
      extCols.push(col);
      extVals.push(rest[col] ?? extDefaults[col] ?? null);
      extIdx++;
    }
    // futures_budget_mapping (JSONB)
    extCols.push("futures_budget_mapping");
    extVals.push(futures_budget_mapping ? JSON.stringify(futures_budget_mapping) : "{}");
    extIdx++;

    const placeholders = (count: number) =>
      Array.from({ length: count }, (_, i) => `$${i + 1}`).join(", ");

    let commodity: Record<string, unknown>;
    try {
      const result = await query(
        `INSERT INTO commodities (${extCols.join(", ")})
         VALUES (${placeholders(extCols.length)})
         RETURNING *`,
        extVals
      );
      commodity = result.rows[0];
    } catch {
      // Extended columns may not exist — retry with core columns only
      const result = await query(
        `INSERT INTO commodities (${columns.join(", ")})
         VALUES (${placeholders(columns.length)})
         RETURNING *`,
        values
      );
      commodity = result.rows[0];
    }

    // Insert reporting units if provided (graceful fallback if table doesn't exist)
    if (units && Array.isArray(units) && units.length > 0) {
      try {
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
      } catch {
        // commodity_units table may not exist yet — skip
      }
    }

    await auditLog({
      module: "kernel",
      entityType: "commodity",
      entityId: commodity.id as string,
      action: "create",
      after: commodity,
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
