import { query } from "./db";

interface AuditLogParams {
  orgId?: string;
  userId?: string;
  module: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  source?: string;
  notes?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Compute field-level changes between before and after snapshots */
function computeChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  for (const key of allKeys) {
    const oldVal = before?.[key] ?? null;
    const newVal = after?.[key] ?? null;
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }
  return changes;
}

/** Log an audit event — call on every data mutation */
export async function auditLog(params: AuditLogParams): Promise<void> {
  const changes = computeChanges(params.before, params.after);
  await query(
    `INSERT INTO audit_log
       (org_id, user_id, module, entity_type, entity_id, action,
        changes, before_snapshot, after_snapshot, ip_address, user_agent, source, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      params.orgId ?? null,
      params.userId ?? null,
      params.module,
      params.entityType,
      params.entityId,
      params.action,
      JSON.stringify(changes),
      params.before ? JSON.stringify(params.before) : null,
      params.after ? JSON.stringify(params.after) : null,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      params.source ?? "ui",
      params.notes ?? null,
    ]
  );
}
