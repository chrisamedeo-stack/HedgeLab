import { NextResponse } from "next/server";
import { queryOne, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing orgId parameter" },
        { status: 400 }
      );
    }

    const settings = await queryOne(
      `SELECT os.*, o.name as org_name, o.base_currency
       FROM org_settings os
       JOIN organizations o ON o.id = os.org_id
       WHERE os.org_id = $1`,
      [orgId]
    );

    if (!settings) {
      return NextResponse.json(
        { error: "Organization settings not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(settings);
  } catch (err) {
    console.error("[org-settings] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { orgId, ...updates } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing orgId" },
        { status: 400 }
      );
    }

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM org_settings WHERE org_id = $1`,
      [orgId]
    );
    if (!before) {
      return NextResponse.json(
        { error: "Organization settings not found" },
        { status: 404 }
      );
    }

    // Build dynamic update from provided fields
    const setClauses: string[] = [];
    const params: unknown[] = [];
    const allowedFields = [
      "default_currency", "reporting_currency", "fiscal_year_start",
      "date_format", "number_format", "timezone", "default_exchange",
      "default_broker", "default_account", "commission_default",
      "budget_lock_after_approval", "budget_variance_threshold",
      "mtm_auto_run", "mtm_run_time", "position_limit_hard_block",
      "import_require_approval", "import_auto_template",
      "notifications_enabled", "email_notifications",
      "roll_critical_days", "roll_urgent_days", "roll_upcoming_days",
      "roll_auto_notify", "roll_require_approval_critical",
      "roll_default_target", "roll_budget_month_policy", "roll_cost_allocation",
      "futures_month_mappings",
    ];

    for (const field of allowedFields) {
      // Accept both snake_case and camelCase
      const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const value = updates[field] ?? updates[camel];
      if (value !== undefined) {
        params.push(value);
        setClauses.push(`${field} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json(before);
    }

    setClauses.push("updated_at = NOW()");
    params.push(orgId);

    const result = await query(
      `UPDATE org_settings SET ${setClauses.join(", ")} WHERE org_id = $${params.length} RETURNING *`,
      params
    );

    await auditLog({
      orgId,
      module: "kernel",
      entityType: "org_settings",
      entityId: orgId,
      action: "update",
      before,
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("[org-settings] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
