import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { queryAll, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import type { OrgNode } from "@/types/pm";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || user.orgId;

    const nodes = await queryAll<OrgNode>(
      `SELECT id, org_id, parent_id, tier_level, name, code, is_active, created_at
       FROM org_nodes
       WHERE org_id = $1 AND is_active = true
       ORDER BY tier_level, name`,
      [orgId]
    );

    return NextResponse.json(nodes);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[org/nodes] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    const body = await request.json();
    const { orgId, parentId, tierLevel, name, code } = body;

    if (!orgId || tierLevel === undefined || !name) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, tierLevel, name" },
        { status: 400 }
      );
    }

    const result = await query<OrgNode>(
      `INSERT INTO org_nodes (org_id, parent_id, tier_level, name, code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orgId, parentId || null, tierLevel, name, code || null]
    );
    const node = result.rows[0];

    await auditLog({
      orgId,
      userId: user.id,
      module: "org",
      entityType: "org_node",
      entityId: node.id,
      action: "create",
      after: node as unknown as Record<string, unknown>,
    });

    return NextResponse.json(node, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[org/nodes] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
