import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getHierarchyLevels } from "@/lib/orgHierarchy";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const levels = await getHierarchyLevels(orgId);
    return NextResponse.json(levels);
  } catch (err) {
    console.error("[org-hierarchy/levels] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, levels, userId } = body;

    if (!orgId || !Array.isArray(levels)) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, levels[]" },
        { status: 400 }
      );
    }

    const results = [];
    for (const level of levels) {
      const result = await query(
        `INSERT INTO org_hierarchy_levels (org_id, level_depth, label, is_site_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (org_id, level_depth)
         DO UPDATE SET label = $3, is_site_level = $4
         RETURNING *`,
        [orgId, level.depth, level.label, level.is_site_level ?? false]
      );
      results.push(result.rows[0]);
    }

    if (userId) {
      await auditLog({
        orgId,
        userId,
        module: "kernel",
        entityType: "org_hierarchy_levels",
        entityId: orgId,
        action: "upsert",
        after: { levels: results },
      });
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("[org-hierarchy/levels] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
