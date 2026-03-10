import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

/** GET — Usage stats for an organization */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const stats = await queryOne(`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE org_id = $1 AND is_active = true) AS user_count,
        (SELECT COUNT(*)::int FROM sites WHERE org_id = $1 AND is_active = true) AS site_count,
        (SELECT COUNT(*)::int FROM org_plugins WHERE org_id = $1 AND is_enabled = true) AS plugin_count,
        (SELECT COUNT(*)::int FROM org_units WHERE org_id = $1 AND is_active = true) AS unit_count
    `, [orgId]);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[platform/stats] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
