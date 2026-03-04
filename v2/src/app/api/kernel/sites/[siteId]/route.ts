import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
    const body = await request.json();
    const { orgId, code, name, region, siteTypeId, orgUnitId, timezone, config } = body;

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM sites WHERE id = $1`,
      [siteId]
    );
    if (!before) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const result = await query(
      `UPDATE sites
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           region = $3,
           site_type_id = COALESCE($4, site_type_id),
           org_unit_id = $5,
           timezone = COALESCE($6, timezone),
           config = COALESCE($7, config),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [code || null, name || null, region ?? null, siteTypeId || null, orgUnitId ?? null, timezone || null, config ? JSON.stringify(config) : null, siteId]
    );

    const after = result.rows[0] as Record<string, unknown>;

    await auditLog({
      orgId: orgId || (before.org_id as string),
      module: "kernel",
      entityType: "site",
      entityId: siteId,
      action: "update",
      before,
      after,
    });

    return NextResponse.json(after);
  } catch (err) {
    console.error("[sites] PUT Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM sites WHERE id = $1`,
      [siteId]
    );
    if (!before) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    await query(
      `UPDATE sites SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [siteId]
    );

    await auditLog({
      orgId: before.org_id as string,
      module: "kernel",
      entityType: "site",
      entityId: siteId,
      action: "delete",
      before,
      after: { ...before, is_active: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[sites] DELETE Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
