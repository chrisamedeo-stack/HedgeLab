import { NextResponse } from "next/server";
import { queryAll, queryOne, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    let sql = `
      SELECT u.id, u.org_id, u.email, u.name, u.role_id, u.is_active, u.created_at,
             r.name as role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (orgId) {
      params.push(orgId);
      sql += ` AND u.org_id = $${params.length}`;
    }

    sql += ` ORDER BY u.name`;

    const users = await queryAll(sql, params);
    return NextResponse.json(users);
  } catch (err) {
    console.error("[users] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, email, name, roleId = "viewer" } = body;

    if (!orgId || !email || !name) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, email, name" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO users (org_id, email, name, role_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [orgId, email, name, roleId]
    );

    await auditLog({
      orgId,
      module: "kernel",
      entityType: "user",
      entityId: result.rows[0].id,
      action: "create",
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[users] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, name, roleId, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );
    if (!before) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }
    if (roleId !== undefined) {
      params.push(roleId);
      updates.push(`role_id = $${params.length}`);
    }
    if (isActive !== undefined) {
      params.push(isActive);
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json(before);
    }

    params.push(id);
    const result = await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
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
    console.error("[users] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
