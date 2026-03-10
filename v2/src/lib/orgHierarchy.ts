import { queryOne, queryAll, transaction } from "./db";
import { auditLog } from "./audit";
import type {
  HierarchyLevel,
  OrgUnit,
  OrgTreeNode,
  SiteRef,
  OrgPlugin,
  CustomerProfile,
  HierarchyTemplateLevel,
  NavSection,
  NavItem,
} from "@/types/org";

// ─── Plugin Gating ────────────────────────────────────────────────────────

export class PluginNotEnabledError extends Error {
  statusCode = 403;
  constructor(pluginId: string) {
    super(`Plugin '${pluginId}' is not enabled for this organization`);
    this.name = "PluginNotEnabledError";
  }
}

/** Check if a plugin is enabled for an org */
export async function isPluginEnabled(orgId: string, pluginId: string): Promise<boolean> {
  const row = await queryOne<{ is_enabled: boolean }>(
    `SELECT is_enabled FROM org_plugins WHERE org_id = $1 AND plugin_id = $2`,
    [orgId, pluginId]
  );
  return row?.is_enabled ?? false;
}

/** Throw PluginNotEnabledError if plugin is not enabled */
export async function requirePlugin(orgId: string, pluginId: string): Promise<void> {
  const enabled = await isPluginEnabled(orgId, pluginId);
  if (!enabled) throw new PluginNotEnabledError(pluginId);
}

/** Get all enabled plugin IDs for an org */
export async function getEnabledPlugins(orgId: string): Promise<string[]> {
  const rows = await queryAll<{ plugin_id: string }>(
    `SELECT plugin_id FROM org_plugins WHERE org_id = $1 AND is_enabled = true`,
    [orgId]
  );
  return rows.map((r) => r.plugin_id);
}

// ─── Org Hierarchy ────────────────────────────────────────────────────────

/** Get hierarchy level definitions for an org */
export async function getHierarchyLevels(orgId: string): Promise<HierarchyLevel[]> {
  return queryAll<HierarchyLevel>(
    `SELECT id, org_id, level_depth, label, is_site_level
     FROM org_hierarchy_levels
     WHERE org_id = $1
     ORDER BY level_depth`,
    [orgId]
  );
}

/** Get the label of the level just above sites (for tab headers) */
export async function getGroupingLevelLabel(orgId: string): Promise<string | null> {
  const row = await queryOne<{ label: string }>(
    `SELECT label FROM org_hierarchy_levels
     WHERE org_id = $1 AND is_site_level = false
     ORDER BY level_depth DESC
     LIMIT 1`,
    [orgId]
  );
  return row?.label ?? null;
}

/** Get site IDs under an org_unit via the DB helper function */
export async function getSiteIdsUnderUnit(unitId: string): Promise<string[]> {
  const rows = await queryAll<{ site_id: string }>(
    `SELECT site_id FROM get_sites_under_unit($1)`,
    [unitId]
  );
  return rows.map((r) => r.site_id);
}

/** Build org tree: nested OrgTreeNode[] with sites at leaves */
export async function getOrgTree(orgId: string): Promise<OrgTreeNode[]> {
  // Fetch all units + their hierarchy level info
  const units = await queryAll<OrgUnit & { level_depth: number; level_label: string }>(
    `SELECT ou.id, ou.org_id, ou.hierarchy_level_id, ou.parent_id,
            ou.name, ou.code, ou.sort_order, ou.is_active,
            ohl.level_depth, ohl.label as level_label
     FROM org_units ou
     JOIN org_hierarchy_levels ohl ON ohl.id = ou.hierarchy_level_id
     WHERE ou.org_id = $1 AND ou.is_active = true
     ORDER BY ohl.level_depth, ou.sort_order, ou.name`,
    [orgId]
  );

  // Fetch sites with org_unit_id
  const sites = await queryAll<SiteRef & { org_unit_id: string }>(
    `SELECT s.id, s.name, s.code, st.name as site_type_name, s.org_unit_id
     FROM sites s
     JOIN site_types st ON st.id = s.site_type_id
     WHERE s.org_id = $1 AND s.is_active = true AND s.org_unit_id IS NOT NULL
     ORDER BY s.name`,
    [orgId]
  );

  // Index sites by org_unit_id
  const sitesByUnit = new Map<string, SiteRef[]>();
  for (const site of sites) {
    const unitSites = sitesByUnit.get(site.org_unit_id) ?? [];
    unitSites.push({ id: site.id, name: site.name, code: site.code, site_type_name: site.site_type_name });
    sitesByUnit.set(site.org_unit_id, unitSites);
  }

  // Build node map
  const nodeMap = new Map<string, OrgTreeNode>();
  for (const u of units) {
    nodeMap.set(u.id, {
      id: u.id,
      name: u.name,
      code: u.code,
      level_depth: u.level_depth,
      level_label: u.level_label,
      parent_id: u.parent_id,
      children: [],
      sites: sitesByUnit.get(u.id) ?? [],
    });
  }

  // Link children to parents
  const roots: OrgTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─── Nav Config ───────────────────────────────────────────────────────────

/** Build navigation sections from plugin_registry + org_plugins */
export async function getNavConfig(orgId: string): Promise<NavSection[]> {
  const rows = await queryAll<{
    plugin_id: string;
    nav_section: string;
    nav_label: string;
    nav_href: string;
    nav_icon: string | null;
    sort_order: number;
  }>(
    `SELECT pr.id as plugin_id, pr.nav_section, pr.nav_label, pr.nav_href,
            pr.nav_icon, pr.sort_order
     FROM plugin_registry pr
     JOIN org_plugins op ON op.plugin_id = pr.id AND op.org_id = $1
     WHERE op.is_enabled = true
       AND pr.nav_section IS NOT NULL
       AND pr.nav_href IS NOT NULL
     ORDER BY pr.sort_order`,
    [orgId]
  );

  // Group by nav_section preserving order
  const sectionMap = new Map<string, NavItem[]>();
  const sectionOrder: string[] = [];
  for (const r of rows) {
    if (!sectionMap.has(r.nav_section)) {
      sectionMap.set(r.nav_section, []);
      sectionOrder.push(r.nav_section);
    }
    sectionMap.get(r.nav_section)!.push({
      href: r.nav_href,
      label: r.nav_label,
      pluginId: r.plugin_id,
      icon: r.nav_icon ?? undefined,
    });
  }

  return sectionOrder.map((label) => ({
    label,
    items: sectionMap.get(label)!,
  }));
}

// ─── Customer Profile (Transaction-safe) ──────────────────────────────────

/**
 * Apply customer profile within an existing transaction.
 * Shared by setup wizard POST and platform admin createOrganization.
 */
export async function applyCustomerProfileInTx(
  tx: { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  orgId: string,
  profileId: string,
  userId: string,
  customLevels?: { depth: number; label: string; is_site_level?: boolean }[]
): Promise<void> {
  const profileRes = await tx.query(
    `SELECT id, display_name, operating_model, default_plugins,
            hierarchy_template, default_site_types, default_settings, description
     FROM customer_profiles WHERE id = $1`,
    [profileId]
  );
  const profile = profileRes.rows[0];
  if (!profile) throw new Error(`Customer profile '${profileId}' not found`);

  await tx.query(
    `UPDATE organizations SET customer_profile_id = $2 WHERE id = $1`,
    [orgId, profileId]
  );

  const levels = customLevels && customLevels.length > 0
    ? customLevels
    : (typeof profile.hierarchy_template === "string"
        ? JSON.parse(profile.hierarchy_template as string)
        : profile.hierarchy_template) as { depth: number; label: string; is_site_level?: boolean }[];

  for (const level of levels) {
    await tx.query(
      `INSERT INTO org_hierarchy_levels (org_id, level_depth, label, is_site_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (org_id, level_depth) DO UPDATE SET label = $3, is_site_level = $4`,
      [orgId, level.depth, level.label, level.is_site_level ?? false]
    );
  }

  const plugins = profile.default_plugins as string[];
  for (const pluginId of plugins) {
    await tx.query(
      `INSERT INTO org_plugins (org_id, plugin_id, is_enabled, enabled_by)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (org_id, plugin_id) DO UPDATE SET is_enabled = true`,
      [orgId, pluginId, userId]
    );
  }

  const settings = typeof profile.default_settings === "string"
    ? JSON.parse(profile.default_settings as string)
    : profile.default_settings;

  if (settings && Object.keys(settings as Record<string, unknown>).length > 0) {
    await tx.query(
      `UPDATE organizations SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb WHERE id = $1`,
      [orgId, JSON.stringify(settings)]
    );
  }
}

// ─── Customer Profiles ────────────────────────────────────────────────────

/** Apply a customer profile to an org — creates hierarchy levels, enables plugins, merges settings */
export async function applyCustomerProfile(
  orgId: string,
  profileId: string,
  userId: string
): Promise<void> {
  const profile = await queryOne<CustomerProfile>(
    `SELECT id, display_name, operating_model, default_plugins,
            hierarchy_template, default_site_types, default_settings, description
     FROM customer_profiles WHERE id = $1`,
    [profileId]
  );
  if (!profile) throw new Error(`Customer profile '${profileId}' not found`);

  const template: HierarchyTemplateLevel[] =
    typeof profile.hierarchy_template === "string"
      ? JSON.parse(profile.hierarchy_template)
      : profile.hierarchy_template;

  await transaction(async (tx) => {
    // Set profile on org
    await tx.query(
      `UPDATE organizations SET customer_profile_id = $2 WHERE id = $1`,
      [orgId, profileId]
    );

    // Create hierarchy levels from template
    for (const level of template) {
      await tx.query(
        `INSERT INTO org_hierarchy_levels (org_id, level_depth, label, is_site_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (org_id, level_depth) DO UPDATE SET label = $3, is_site_level = $4`,
        [orgId, level.depth, level.label, level.is_site_level ?? false]
      );
    }

    // Enable default plugins
    for (const pluginId of profile.default_plugins) {
      await tx.query(
        `INSERT INTO org_plugins (org_id, plugin_id, is_enabled, enabled_by)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (org_id, plugin_id) DO UPDATE SET is_enabled = true`,
        [orgId, pluginId, userId]
      );
    }

    // Merge default_settings into org_settings
    const settings = typeof profile.default_settings === "string"
      ? JSON.parse(profile.default_settings)
      : profile.default_settings;

    if (Object.keys(settings).length > 0) {
      await tx.query(
        `UPDATE organizations SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb WHERE id = $1`,
        [orgId, JSON.stringify(settings)]
      );
    }
  });

  await auditLog({
    orgId,
    userId,
    module: "kernel",
    entityType: "organization",
    entityId: orgId,
    action: "apply_profile",
    after: { profileId, operating_model: profile.operating_model },
  });
}
