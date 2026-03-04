import { NextResponse } from "next/server";
import { queryAll, queryOne, query } from "@/lib/db";
import { getOrgTree } from "@/lib/orgHierarchy";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const tree = await getOrgTree(orgId);
    return NextResponse.json(tree);
  } catch (err) {
    console.error("[org-hierarchy] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, hierarchyLevelId, parentId, name, code, sortOrder, userId } = body;

    if (!orgId || !hierarchyLevelId || !name) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, hierarchyLevelId, name" },
        { status: 400 }
      );
    }

    // Validate hierarchy level belongs to this org
    const level = await queryOne(
      `SELECT id FROM org_hierarchy_levels WHERE id = $1 AND org_id = $2`,
      [hierarchyLevelId, orgId]
    );
    if (!level) {
      return NextResponse.json({ error: "Invalid hierarchy level for this org" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO org_units (org_id, hierarchy_level_id, parent_id, name, code, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, hierarchyLevelId, parentId ?? null, name, code ?? null, sortOrder ?? 0]
    );

    const unit = result.rows[0];

    if (userId) {
      await auditLog({
        orgId,
        userId,
        module: "kernel",
        entityType: "org_unit",
        entityId: unit.id,
        action: "create",
        after: unit as Record<string, unknown>,
      });
    }

    return NextResponse.json(unit, { status: 201 });
  } catch (err) {
    console.error("[org-hierarchy] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
