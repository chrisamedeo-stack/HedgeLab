import { queryOne, queryAll, transaction } from "./db";
import { auditLog } from "./audit";
import { applyCustomerProfileInTx } from "./orgHierarchy";
import { hashPassword } from "./auth";
import type { OrgSummary, OrgDetail, PlatformStats, UpdateOrgRequest } from "@/types/platform";
import type { CreateOrganizationRequest } from "@/types/setup";

// ─── List Organizations ──────────────────────────────────────────────────

export async function listOrganizations(): Promise<OrgSummary[]> {
  return queryAll<OrgSummary>(`
    SELECT
      o.id, o.name, o.customer_profile_id, cp.display_name AS profile_name,
      o.is_active, o.subscription_tier, o.subscription_status,
      o.max_users, o.max_sites, o.created_at,
      COALESCE(uc.cnt, 0)::int AS user_count,
      COALESCE(sc.cnt, 0)::int AS site_count,
      COALESCE(pc.cnt, 0)::int AS plugin_count
    FROM organizations o
    LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
    LEFT JOIN (SELECT org_id, COUNT(*) AS cnt FROM users WHERE is_active = true GROUP BY org_id) uc ON uc.org_id = o.id
    LEFT JOIN (SELECT org_id, COUNT(*) AS cnt FROM sites WHERE is_active = true GROUP BY org_id) sc ON sc.org_id = o.id
    LEFT JOIN (SELECT org_id, COUNT(*) AS cnt FROM org_plugins WHERE is_enabled = true GROUP BY org_id) pc ON pc.org_id = o.id
    ORDER BY o.created_at DESC
  `);
}

// ─── Get Organization Detail ─────────────────────────────────────────────

export async function getOrganizationDetail(orgId: string): Promise<OrgDetail | null> {
  const org = await queryOne<OrgDetail>(`
    SELECT
      o.id, o.name, o.customer_profile_id, cp.display_name AS profile_name,
      o.is_active, o.subscription_tier, o.subscription_status,
      o.max_users, o.max_sites, o.base_currency, o.settings, o.notes, o.created_at,
      COALESCE(uc.cnt, 0)::int AS user_count,
      COALESCE(sc.cnt, 0)::int AS site_count,
      COALESCE(pc.cnt, 0)::int AS plugin_count
    FROM organizations o
    LEFT JOIN customer_profiles cp ON cp.id = o.customer_profile_id
    LEFT JOIN (SELECT org_id, COUNT(*) AS cnt FROM users WHERE is_active = true GROUP BY org_id) uc ON uc.org_id = o.id
    LEFT JOIN (SELECT org_id, COUNT(*) AS cnt FROM sites WHERE is_active = true GROUP BY org_id) sc ON sc.org_id = o.id
    LEFT JOIN (SELECT org_id, COUNT(*) AS cnt FROM org_plugins WHERE is_enabled = true GROUP BY org_id) pc ON pc.org_id = o.id
    WHERE o.id = $1
  `, [orgId]);

  if (!org) return null;

  const plugins = await queryAll<{ plugin_id: string }>(
    `SELECT plugin_id FROM org_plugins WHERE org_id = $1 AND is_enabled = true`,
    [orgId]
  );
  org.enabled_plugins = plugins.map(p => p.plugin_id);

  return org;
}

// ─── Create Organization (Platform) ──────────────────────────────────────

export async function createOrganization(data: CreateOrganizationRequest): Promise<{
  org: { id: string; name: string };
  user: { id: string; name: string; email: string };
}> {
  const { orgName, baseCurrency, adminName, adminEmail, adminPassword, profileId, hierarchyLevels, selectedCommodities } = data;

  // Hash password if provided
  const passwordHash = adminPassword ? await hashPassword(adminPassword) : null;

  const result = await transaction(async (tx) => {
    const orgRow = await tx.query(
      `INSERT INTO organizations (name, base_currency, settings, is_active)
       VALUES ($1, $2, '{}', true)
       RETURNING id, name`,
      [orgName, baseCurrency]
    );
    const org = orgRow.rows[0] as { id: string; name: string };

    await tx.query(
      `INSERT INTO org_settings (org_id, default_currency, reporting_currency)
       VALUES ($1, $2, $2)`,
      [org.id, baseCurrency]
    );

    const userRow = await tx.query(
      `INSERT INTO users (org_id, email, name, role_id, is_active, password_hash)
       VALUES ($1, $2, $3, 'admin', true, $4)
       RETURNING id, name, email`,
      [org.id, adminEmail, adminName, passwordHash]
    );
    const user = userRow.rows[0] as { id: string; name: string; email: string };

    if (profileId) {
      await applyCustomerProfileInTx(tx, org.id, profileId, user.id, hierarchyLevels);
    }

    if (selectedCommodities && selectedCommodities.length > 0) {
      await tx.query(
        `UPDATE organizations SET settings = settings || $2::jsonb WHERE id = $1`,
        [org.id, JSON.stringify({ enabled_commodities: selectedCommodities })]
      );
    }

    return { org: { id: org.id, name: org.name }, user: { id: user.id, name: user.name, email: user.email } };
  });

  await auditLog({
    orgId: result.org.id,
    userId: result.user.id,
    module: "platform",
    entityType: "organization",
    entityId: result.org.id,
    action: "create",
    after: { orgName, baseCurrency, profileId, adminEmail },
  });

  return result;
}

// ─── Update Organization ─────────────────────────────────────────────────

export async function updateOrganization(orgId: string, patch: UpdateOrgRequest): Promise<OrgDetail | null> {
  const before = await queryOne<Record<string, unknown>>(
    `SELECT name, subscription_tier, subscription_status, max_users, max_sites, notes FROM organizations WHERE id = $1`,
    [orgId]
  );

  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      sets.push(`${key} = $${++i}`);
      params.push(value);
    }
  }

  if (sets.length === 0) return getOrganizationDetail(orgId);

  await queryOne(
    `UPDATE organizations SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1`,
    [orgId, ...params]
  );

  await auditLog({
    orgId,
    module: "platform",
    entityType: "organization",
    entityId: orgId,
    action: "update",
    before: before as Record<string, unknown>,
    after: patch as Record<string, unknown>,
  });

  return getOrganizationDetail(orgId);
}

// ─── Deactivate Organization ─────────────────────────────────────────────

export async function deactivateOrganization(orgId: string): Promise<void> {
  await queryOne(
    `UPDATE organizations SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [orgId]
  );

  await auditLog({
    orgId,
    module: "platform",
    entityType: "organization",
    entityId: orgId,
    action: "deactivate",
    after: { is_active: false },
  });
}

// ─── Platform Stats ──────────────────────────────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats> {
  const result = await queryOne<PlatformStats>(`
    SELECT
      (SELECT COUNT(*)::int FROM organizations) AS total_orgs,
      (SELECT COUNT(*)::int FROM organizations WHERE is_active = true) AS active_orgs,
      (SELECT COUNT(*)::int FROM users WHERE is_active = true) AS total_users,
      (SELECT COUNT(*)::int FROM sites WHERE is_active = true) AS total_sites
  `);
  return result!;
}

// ─── Toggle Org Plugin ───────────────────────────────────────────────────

export async function toggleOrgPlugin(
  orgId: string,
  pluginId: string,
  enabled: boolean
): Promise<void> {
  await queryOne(
    `INSERT INTO org_plugins (org_id, plugin_id, is_enabled)
     VALUES ($1, $2, $3)
     ON CONFLICT (org_id, plugin_id) DO UPDATE SET is_enabled = $3`,
    [orgId, pluginId, enabled]
  );

  await auditLog({
    orgId,
    module: "platform",
    entityType: "org_plugin",
    entityId: pluginId,
    action: enabled ? "enable" : "disable",
    after: { plugin_id: pluginId, is_enabled: enabled },
  });
}

// ─── Platform Settings ───────────────────────────────────────────────────

export async function getPlatformSettings(): Promise<Record<string, unknown>> {
  const rows = await queryAll<{ key: string; value: unknown }>(
    `SELECT key, value FROM platform_settings`
  );
  const settings: Record<string, unknown> = {};
  for (const r of rows) settings[r.key] = r.value;
  return settings;
}

export async function updatePlatformSettings(
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  for (const [key, value] of Object.entries(updates)) {
    await queryOne(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }
  return getPlatformSettings();
}
