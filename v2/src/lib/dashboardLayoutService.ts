// ─── Dashboard Layout Service ─────────────────────────────────────────────────
// CRUD for crt_dashboards table — stores user widget layout preferences.

import { queryOne, queryAll } from "./db";
import type { WidgetLayoutEntry } from "@/types/dashboard";

interface DashboardRow {
  id: string;
  user_id: string;
  org_id: string;
  name: string;
  layout: WidgetLayoutEntry[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** Get user's saved layout for an org (returns null if none saved) */
export async function getUserLayout(
  userId: string,
  orgId: string,
): Promise<WidgetLayoutEntry[] | null> {
  const row = await queryOne<DashboardRow>(
    `SELECT layout FROM crt_dashboards WHERE user_id = $1 AND org_id = $2 ORDER BY is_default DESC, updated_at DESC LIMIT 1`,
    [userId, orgId],
  );
  if (!row) return null;
  // layout is JSONB — pg driver returns it already parsed
  return row.layout;
}

/** Save (upsert) a user's layout for an org */
export async function saveUserLayout(
  userId: string,
  orgId: string,
  layout: WidgetLayoutEntry[],
): Promise<void> {
  // Check if a row exists
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM crt_dashboards WHERE user_id = $1 AND org_id = $2 ORDER BY is_default DESC LIMIT 1`,
    [userId, orgId],
  );

  if (existing) {
    await queryOne(
      `UPDATE crt_dashboards SET layout = $3::jsonb, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id`,
      [existing.id, userId, JSON.stringify(layout)],
    );
  } else {
    await queryOne(
      `INSERT INTO crt_dashboards (user_id, org_id, name, layout, is_default)
       VALUES ($1, $2, 'My Dashboard', $3::jsonb, true) RETURNING id`,
      [userId, orgId, JSON.stringify(layout)],
    );
  }
}

/** Delete user's saved layout (reset to default) */
export async function deleteUserLayout(
  userId: string,
  orgId: string,
): Promise<void> {
  await queryOne(
    `DELETE FROM crt_dashboards WHERE user_id = $1 AND org_id = $2`,
    [userId, orgId],
  );
}

/** Get org-level default layout from organizations.settings */
export async function getOrgDefaultLayout(
  orgId: string,
): Promise<WidgetLayoutEntry[] | null> {
  const row = await queryOne<{ settings: Record<string, unknown> }>(
    `SELECT settings FROM organizations WHERE id = $1`,
    [orgId],
  );
  if (!row?.settings) return null;
  const dl = (row.settings as Record<string, unknown>).dashboard_layout;
  if (!dl || !Array.isArray(dl)) return null;
  return dl as WidgetLayoutEntry[];
}
