import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { queryAll } from "@/lib/db";
import type { OrgNode } from "@/types/pm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getApiUser();
    const { id } = await params;

    // Get all leaf nodes beneath this node (recursive CTE)
    const leafNodes = await queryAll<OrgNode>(
      `WITH RECURSIVE descendants AS (
         SELECT id, org_id, parent_id, tier_level, name, code, is_active, created_at
         FROM org_nodes WHERE id = $1
         UNION ALL
         SELECT n.id, n.org_id, n.parent_id, n.tier_level, n.name, n.code, n.is_active, n.created_at
         FROM org_nodes n
         JOIN descendants d ON n.parent_id = d.id
         WHERE n.is_active = true
       )
       SELECT d.*
       FROM descendants d
       JOIN org_tier_config t ON t.org_id = d.org_id AND t.tier_level = d.tier_level AND t.is_leaf = true
       WHERE d.is_active = true
       ORDER BY d.name`,
      [id]
    );

    return NextResponse.json(leafNodes);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[org/nodes/sites] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
