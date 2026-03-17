import { NextResponse } from "next/server";
import { queryAll, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let units: unknown[] = [];
    try {
      units = await queryAll(
        `SELECT id, commodity_id, unit_name, abbreviation,
                to_trade_unit, from_trade_unit, is_default_report, sort_order
         FROM commodity_units
         WHERE commodity_id = $1
         ORDER BY sort_order`,
        [id]
      );
    } catch {
      // commodity_units table may not exist yet
    }
    return NextResponse.json(units);
  } catch (err) {
    console.error("[commodity-units] GET Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { units } = await request.json();

    if (!Array.isArray(units)) {
      return NextResponse.json({ error: "units must be an array" }, { status: 400 });
    }

    // Delete existing and re-insert
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

    await auditLog({
      module: "kernel",
      entityType: "commodity_units",
      entityId: id,
      action: "update",
      after: { commodity_id: id, units },
    });

    // Return updated list
    const updated = await queryAll(
      `SELECT id, commodity_id, unit_name, abbreviation,
              to_trade_unit, from_trade_unit, is_default_report, sort_order
       FROM commodity_units WHERE commodity_id = $1 ORDER BY sort_order`,
      [id]
    );
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[commodity-units] PUT Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const result = await query(
      `INSERT INTO commodity_units
         (commodity_id, unit_name, abbreviation, to_trade_unit, from_trade_unit,
          is_default_report, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        body.unit_name,
        body.abbreviation,
        body.to_trade_unit,
        body.from_trade_unit,
        body.is_default_report ?? false,
        body.sort_order ?? 0,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[commodity-units] POST Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
