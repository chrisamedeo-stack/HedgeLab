import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;
    const table = await queryOne(
      `SELECT * FROM pricing_rate_tables WHERE id = $1 AND is_active = true`,
      [tableId]
    );
    if (!table) {
      return NextResponse.json({ error: "Rate table not found" }, { status: 404 });
    }
    return NextResponse.json(table);
  } catch (err) {
    console.error("[rate-tables] GET Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;
    const body = await request.json();
    const { name, rateType, commodityId, rates, effectiveDate, expiryDate, isActive } = body;

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM pricing_rate_tables WHERE id = $1`,
      [tableId]
    );
    if (!before) {
      return NextResponse.json({ error: "Rate table not found" }, { status: 404 });
    }

    const result = await query(
      `UPDATE pricing_rate_tables
       SET name = COALESCE($2, name),
           rate_type = COALESCE($3, rate_type),
           commodity_id = $4,
           rates = COALESCE($5, rates),
           effective_date = $6,
           expiry_date = $7,
           is_active = COALESCE($8, is_active)
       WHERE id = $1
       RETURNING *`,
      [
        tableId,
        name ?? null,
        rateType ?? null,
        commodityId !== undefined ? commodityId : before.commodity_id,
        rates ? JSON.stringify(rates) : null,
        effectiveDate !== undefined ? effectiveDate : before.effective_date,
        expiryDate !== undefined ? expiryDate : before.expiry_date,
        isActive ?? null,
      ]
    );

    await auditLog({
      orgId: before.org_id as string,
      module: "kernel",
      entityType: "pricing_rate_table",
      entityId: tableId,
      action: "update",
      before,
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("[rate-tables] PUT Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM pricing_rate_tables WHERE id = $1`,
      [tableId]
    );
    if (!before) {
      return NextResponse.json({ error: "Rate table not found" }, { status: 404 });
    }

    await query(
      `UPDATE pricing_rate_tables SET is_active = false WHERE id = $1`,
      [tableId]
    );

    await auditLog({
      orgId: before.org_id as string,
      module: "kernel",
      entityType: "pricing_rate_table",
      entityId: tableId,
      action: "deactivate",
      before,
      after: { ...before, is_active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[rate-tables] DELETE Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
