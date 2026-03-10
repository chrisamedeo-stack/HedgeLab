import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { toggleOrgPlugin } from "@/lib/platformService";

/** GET — List all plugins with enabled status for an org */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const plugins = await queryAll(`
      SELECT pr.id, pr.name, pr.description, pr.depends_on, pr.sort_order,
             COALESCE(op.is_enabled, false) AS is_enabled
      FROM plugin_registry pr
      LEFT JOIN org_plugins op ON op.plugin_id = pr.id AND op.org_id = $1
      ORDER BY pr.sort_order
    `, [orgId]);
    return NextResponse.json(plugins);
  } catch (err) {
    console.error("[platform/plugins] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST — Toggle a plugin for an org */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const { pluginId, enabled } = await request.json();

    if (!pluginId || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "pluginId and enabled required" }, { status: 400 });
    }

    await toggleOrgPlugin(orgId, pluginId, enabled);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[platform/plugins] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
