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

    const { units, config, futures_budget_mapping, ...fields } = body;

    // Merge config JSONB: existing config + incoming config (for month_mappings etc.)
    const mergedConfig =
      config !== undefined
        ? { ...(before.config ?? {}), ...config }
        : undefined;

    // Build dynamic UPDATE — only set fields that are provided
    // This avoids referencing columns that may not exist yet (e.g. display_name)
    const setClauses: string[] = [];
    const values: unknown[] = [id];
    let paramIdx = 2;

    // Core columns (always exist)
    const coreColumns = [
      "name", "category", "unit", "currency", "exchange",
      "contract_size", "tick_size", "tick_value", "contract_months",
      "decimal_places", "price_unit", "volume_unit", "is_active",
    ];

    // Extended columns (added by later migrations — may not exist)
    const extColumns = [
      "display_name", "commodity_class", "ticker_root",
      "trade_price_unit", "trade_volume_unit", "price_decimal_places",
      "point_value", "basis_unit", "basis_reference",
      "volume_entry_mode", "basis_sign_convention",
    ];

    for (const col of [...coreColumns, ...extColumns]) {
      if (fields[col] !== undefined) {
        setClauses.push(`${col} = $${paramIdx}`);
        values.push(fields[col]);
        paramIdx++;
      }
    }

    // Handle config merge specially
    if (mergedConfig !== undefined) {
      setClauses.push(`config = $${paramIdx}`);
      values.push(JSON.stringify(mergedConfig));
      paramIdx++;
    }

    // Handle futures_budget_mapping specially (JSONB)
    if (futures_budget_mapping !== undefined) {
      setClauses.push(`futures_budget_mapping = $${paramIdx}`);
      values.push(JSON.stringify(futures_budget_mapping));
      paramIdx++;
    }

    let result: Record<string, unknown> = before as Record<string, unknown>;
    if (setClauses.length > 0) {
      try {
        const r = await queryOne(
          `UPDATE commodities SET ${setClauses.join(", ")} WHERE id = $1 RETURNING *`,
          values
        );
        if (r) result = r as Record<string, unknown>;
      } catch (updateErr) {
        // If a column doesn't exist, retry with only core columns
        const coreSetClauses: string[] = [];
        const coreValues: unknown[] = [id];
        let coreIdx = 2;
        for (const col of coreColumns) {
          if (fields[col] !== undefined) {
            coreSetClauses.push(`${col} = $${coreIdx}`);
            coreValues.push(fields[col]);
            coreIdx++;
          }
        }
        if (mergedConfig !== undefined) {
          coreSetClauses.push(`config = $${coreIdx}`);
          coreValues.push(JSON.stringify(mergedConfig));
          coreIdx++;
        }
        if (coreSetClauses.length > 0) {
          const r = await queryOne(
            `UPDATE commodities SET ${coreSetClauses.join(", ")} WHERE id = $1 RETURNING *`,
            coreValues
          );
          if (r) result = r as Record<string, unknown>;
        } else {
          throw updateErr;
        }
      }
    }

    // If units array provided, replace all units (delete + re-insert)
    if (units !== undefined && Array.isArray(units)) {
      try {
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
      } catch {
        // commodity_units table may not exist yet — skip
      }
    }

    await auditLog({
      module: "kernel",
      entityType: "commodity",
      entityId: id,
      action: "update",
      before: before as Record<string, unknown>,
      after: result,
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
