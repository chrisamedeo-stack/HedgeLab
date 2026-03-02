import { queryOne } from "./db";

/** Check if a user has a specific permission (respects overrides) */
export async function checkPermission(
  userId: string,
  permissionId: string
): Promise<boolean> {
  // 1. Check user-level overrides first
  const override = await queryOne<{ granted: boolean }>(
    `SELECT granted FROM user_permission_overrides WHERE user_id = $1 AND permission_id = $2`,
    [userId, permissionId]
  );
  if (override) return override.granted;

  // 2. Fall back to role-based permissions
  const result = await queryOne<{ ok: number }>(
    `SELECT 1 as ok FROM users u
     JOIN role_permissions rp ON rp.role_id = u.role_id
     WHERE u.id = $1 AND rp.permission_id = $2`,
    [userId, permissionId]
  );
  return result !== null;
}

/** Require a permission — throws if denied */
export async function requirePermission(
  userId: string,
  permissionId: string
): Promise<void> {
  const allowed = await checkPermission(userId, permissionId);
  if (!allowed) {
    throw new PermissionError(permissionId);
  }
}

/** Get all permissions for a user (role + overrides) */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const { rows } = await (await import("./db")).query<{ permission_id: string }>(
    `SELECT DISTINCT p.permission_id FROM (
       SELECT rp.permission_id FROM users u
       JOIN role_permissions rp ON rp.role_id = u.role_id
       WHERE u.id = $1
       UNION ALL
       SELECT upo.permission_id FROM user_permission_overrides upo
       WHERE upo.user_id = $1 AND upo.granted = true
     ) p
     WHERE p.permission_id NOT IN (
       SELECT upo.permission_id FROM user_permission_overrides upo
       WHERE upo.user_id = $1 AND upo.granted = false
     )`,
    [userId]
  );
  return rows.map((r) => r.permission_id);
}

export class PermissionError extends Error {
  public readonly permissionId: string;
  public readonly statusCode = 403;

  constructor(permissionId: string) {
    super(`Permission denied: ${permissionId}`);
    this.name = "PermissionError";
    this.permissionId = permissionId;
  }
}
