import { NextResponse } from "next/server";
import { query, queryAll } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    // Return all plugins with their enabled status for this org
    const plugins = await queryAll(
      `SELECT pr.id, pr.name, pr.module_prefix, pr.depends_on,
              pr.nav_section, pr.nav_label, pr.nav_href, pr.nav_icon,
              pr.sort_order, pr.description,
              COALESCE(op.is_enabled, false) as is_enabled,
              op.config as org_config
       FROM plugin_registry pr
       LEFT JOIN org_plugins op ON op.plugin_id = pr.id AND op.org_id = $1
       ORDER BY pr.sort_order`,
      [orgId]
    );

    return NextResponse.json(plugins);
  } catch (err) {
    console.error("[org-plugins] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, pluginId, isEnabled, config, userId } = body;

    if (!orgId || !pluginId || isEnabled === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, pluginId, isEnabled" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO org_plugins (org_id, plugin_id, is_enabled, config, enabled_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (org_id, plugin_id)
       DO UPDATE SET is_enabled = $3, config = COALESCE($4, org_plugins.config)
       RETURNING *`,
      [orgId, pluginId, isEnabled, config ? JSON.stringify(config) : null, userId ?? null]
    );

    const plugin = result.rows[0];

    if (userId) {
      await auditLog({
        orgId,
        userId,
        module: "kernel",
        entityType: "org_plugin",
        entityId: `${orgId}:${pluginId}`,
        action: isEnabled ? "enable" : "disable",
        after: plugin as Record<string, unknown>,
      });
    }

    return NextResponse.json(plugin);
  } catch (err) {
    console.error("[org-plugins] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
