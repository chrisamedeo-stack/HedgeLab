import { NextResponse } from "next/server";
import { queryAll, queryOne, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET() {
  try {
    const types = await queryAll(
      `SELECT id, name, supported_commodities, description, created_at
       FROM site_types
       ORDER BY name`
    );
    return NextResponse.json(types);
  } catch (err) {
    console.error("[site-types] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, supportedCommodities, description } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: "Missing required fields: id, name" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO site_types (id, name, supported_commodities, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, name, supportedCommodities ?? '{}', description ?? null]
    );

    await auditLog({
      module: "kernel",
      entityType: "site_type",
      entityId: id,
      action: "create",
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[site-types] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, name, supportedCommodities, description } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing site type id" }, { status: 400 });
    }

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM site_types WHERE id = $1`,
      [id]
    );
    if (!before) {
      return NextResponse.json({ error: "Site type not found" }, { status: 404 });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
    if (supportedCommodities !== undefined) { params.push(supportedCommodities); updates.push(`supported_commodities = $${params.length}`); }
    if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }

    if (updates.length === 0) return NextResponse.json(before);

    params.push(id);
    const result = await query(
      `UPDATE site_types SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await auditLog({
      module: "kernel",
      entityType: "site_type",
      entityId: id,
      action: "update",
      before,
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("[site-types] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
