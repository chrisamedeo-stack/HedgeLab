import { NextResponse } from "next/server";
import { query, queryOne, queryAll } from "@/lib/db";
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const levelId = searchParams.get("levelId");

    if (!orgId || !levelId) {
      return NextResponse.json({ error: "Missing orgId or levelId" }, { status: 400 });
    }

    // Get the level to delete
    const level = await queryOne<{ id: string; level_depth: number; is_site_level: boolean }>(
      `SELECT id, level_depth, is_site_level FROM org_hierarchy_levels WHERE id = $1 AND org_id = $2`,
      [levelId, orgId]
    );
    if (!level) {
      return NextResponse.json({ error: "Level not found" }, { status: 404 });
    }
    if (level.is_site_level) {
      return NextResponse.json({ error: "Cannot delete the site level" }, { status: 400 });
    }

    // Check no org_units exist at this level
    const unitCheck = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*)::TEXT AS cnt FROM org_units WHERE hierarchy_level_id = $1`,
      [levelId]
    );
    if (unitCheck && parseInt(unitCheck.cnt) > 0) {
      return NextResponse.json(
        { error: `Cannot delete level — ${unitCheck.cnt} org unit(s) still exist at this level` },
        { status: 400 }
      );
    }

    // Delete the level
    await query(`DELETE FROM org_hierarchy_levels WHERE id = $1`, [levelId]);

    // Re-compact depths so they remain sequential
    const remaining = await queryAll<{ id: string }>(
      `SELECT id FROM org_hierarchy_levels WHERE org_id = $1 ORDER BY level_depth`,
      [orgId]
    );
    for (let i = 0; i < remaining.length; i++) {
      await query(
        `UPDATE org_hierarchy_levels SET level_depth = $1 WHERE id = $2`,
        [i, remaining[i].id]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[org-hierarchy/levels] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
