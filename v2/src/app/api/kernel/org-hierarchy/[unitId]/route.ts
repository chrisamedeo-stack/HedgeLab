import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

/** PUT — Rename an org unit */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params;
    const body = await request.json();
    const { name, code, userId } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const existing = await queryOne<{ id: string; name: string; code: string; org_id: string }>(
      `SELECT id, name, code, org_id FROM org_units WHERE id = $1 AND is_active = true`,
      [unitId]
    );
    if (!existing) {
      return NextResponse.json({ error: "Org unit not found" }, { status: 404 });
    }

    const result = await query(
      `UPDATE org_units SET name = $1, code = $2 WHERE id = $3 RETURNING *`,
      [name.trim(), code?.trim() || null, unitId]
    );
    const updated = result.rows[0];

    if (userId) {
      await auditLog({
        orgId: existing.org_id,
        userId,
        module: "kernel",
        entityType: "org_unit",
        entityId: unitId,
        action: "update",
        before: { name: existing.name, code: existing.code },
        after: { name: updated.name, code: updated.code },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[org-hierarchy/unitId] PUT error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** DELETE — Delete an org unit (only if no sites assigned) */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  try {
    const { unitId } = await params;
    const body = await request.json().catch(() => ({}));
    const userId = (body as { userId?: string }).userId;

    const existing = await queryOne<{ id: string; name: string; org_id: string }>(
      `SELECT id, name, org_id FROM org_units WHERE id = $1 AND is_active = true`,
      [unitId]
    );
    if (!existing) {
      return NextResponse.json({ error: "Org unit not found" }, { status: 404 });
    }

    // Check if any active sites are assigned to this unit
    const siteCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM sites WHERE org_unit_id = $1 AND is_active = true`,
      [unitId]
    );
    if (siteCount && parseInt(siteCount.count) > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${siteCount.count} site(s) are assigned to this unit. Reassign them first.` },
        { status: 409 }
      );
    }

    // Check for child units
    const childCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM org_units WHERE parent_id = $1 AND is_active = true`,
      [unitId]
    );
    if (childCount && parseInt(childCount.count) > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${childCount.count} child unit(s) exist. Delete them first.` },
        { status: 409 }
      );
    }

    // Soft delete
    await query(`UPDATE org_units SET is_active = false WHERE id = $1`, [unitId]);

    if (userId) {
      await auditLog({
        orgId: existing.org_id,
        userId,
        module: "kernel",
        entityType: "org_unit",
        entityId: unitId,
        action: "delete",
        before: { name: existing.name },
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[org-hierarchy/unitId] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
