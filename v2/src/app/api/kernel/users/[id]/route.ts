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
    const { email, name, role, roleId, isActive, enabled } = body;

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );
    if (!before) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: string[] = [];
    const vals: unknown[] = [];

    if (email !== undefined) {
      vals.push(email);
      updates.push(`email = $${vals.length}`);
    }
    if (name !== undefined) {
      vals.push(name);
      updates.push(`name = $${vals.length}`);
    }
    const resolvedRole = roleId ?? role;
    if (resolvedRole !== undefined) {
      vals.push(resolvedRole);
      updates.push(`role_id = $${vals.length}`);
    }
    const resolvedActive = isActive ?? enabled;
    if (resolvedActive !== undefined) {
      vals.push(resolvedActive);
      updates.push(`is_active = $${vals.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json(before);
    }

    vals.push(id);
    const result = await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${vals.length} RETURNING *`,
      vals
    );

    await auditLog({
      orgId: before.org_id as string,
      module: "kernel",
      entityType: "user",
      entityId: id,
      action: "update",
      before,
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("[users/:id] PUT error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );
    if (!before) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await query(`DELETE FROM users WHERE id = $1`, [id]);

    await auditLog({
      orgId: before.org_id as string,
      module: "kernel",
      entityType: "user",
      entityId: id,
      action: "delete",
      before,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[users/:id] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
