import { NextResponse } from "next/server";
import { query, queryAll, queryOne } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId parameter" }, { status: 400 });
    }

    const templates = await queryAll(
      `SELECT id, name, target_module, target_table, column_mapping, sample_headers,
              use_count, last_used_at, created_by, created_at
       FROM import_templates
       WHERE org_id = $1
       ORDER BY use_count DESC, created_at DESC`,
      [orgId]
    );

    return NextResponse.json(templates);
  } catch (err) {
    console.error("[import/templates] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, userId, name, targetModule, targetTable, columnMapping, sampleHeaders } = body;

    await requirePermission(userId, "import.upload");

    // Check for duplicate name
    const existing = await queryOne(
      `SELECT id FROM import_templates WHERE org_id = $1 AND name = $2`,
      [orgId, name]
    );
    if (existing) {
      return NextResponse.json({ error: "Template with this name already exists" }, { status: 409 });
    }

    const result = await query<{ id: string }>(
      `INSERT INTO import_templates (org_id, name, target_module, target_table, column_mapping, sample_headers, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [orgId, name, targetModule, targetTable, JSON.stringify(columnMapping), sampleHeaders, userId]
    );

    const templateId = result.rows[0].id;

    await auditLog({
      orgId,
      userId,
      module: "kernel",
      entityType: "import_template",
      entityId: templateId,
      action: "create",
      after: { name, targetModule, targetTable, columnMapping },
    });

    return NextResponse.json({ id: templateId }, { status: 201 });
  } catch (err) {
    console.error("[import/templates] Error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("id");
    const userId = searchParams.get("userId");

    if (!templateId || !userId) {
      return NextResponse.json({ error: "Missing id or userId parameter" }, { status: 400 });
    }

    await requirePermission(userId, "import.upload");

    const existing = await queryOne<{ org_id: string; name: string }>(
      `SELECT org_id, name FROM import_templates WHERE id = $1`,
      [templateId]
    );
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await query(`DELETE FROM import_templates WHERE id = $1`, [templateId]);

    await auditLog({
      orgId: existing.org_id,
      userId,
      module: "kernel",
      entityType: "import_template",
      entityId: templateId,
      action: "delete",
      before: { name: existing.name },
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[import/templates] Error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
