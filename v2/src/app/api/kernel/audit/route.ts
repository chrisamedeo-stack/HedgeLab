import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const module = searchParams.get("module");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    let sql = `
      SELECT al.id, al.org_id, al.user_id, al.module, al.entity_type, al.entity_id,
             al.action, al.changes, al.before_snapshot, al.after_snapshot,
             al.source, al.notes, al.created_at,
             u.name as user_name, u.email as user_email
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (entityType && entityId) {
      params.push(entityType, entityId);
      sql += ` AND al.entity_type = $${params.length - 1} AND al.entity_id = $${params.length}`;
    }
    if (module) {
      params.push(module);
      sql += ` AND al.module = $${params.length}`;
    }

    params.push(Math.min(limit, 200));
    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length}`;

    const logs = await queryAll(sql, params);
    return NextResponse.json(logs);
  } catch (err) {
    console.error("[audit] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
