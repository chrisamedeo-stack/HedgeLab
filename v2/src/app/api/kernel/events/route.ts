import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get("eventType");
    const sourceModule = searchParams.get("sourceModule");
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    let sql = `
      SELECT id, event_type, source_module, entity_type, entity_id,
             payload, org_id, user_id, processed_by, created_at
      FROM event_log
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (eventType) {
      params.push(eventType);
      sql += ` AND event_type = $${params.length}`;
    }
    if (sourceModule) {
      params.push(sourceModule);
      sql += ` AND source_module = $${params.length}`;
    }
    if (entityType && entityId) {
      params.push(entityType, entityId);
      sql += ` AND entity_type = $${params.length - 1} AND entity_id = $${params.length}`;
    }

    params.push(Math.min(limit, 200));
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const events = await queryAll(sql, params);
    return NextResponse.json(events);
  } catch (err) {
    console.error("[events] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
