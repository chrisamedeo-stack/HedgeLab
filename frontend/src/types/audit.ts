export type AuditAction =
  | "CREATE" | "UPDATE" | "DELETE"
  | "STATE_CHANGE" | "AMEND" | "DELIVER" | "SCHEDULE_RUN";

export interface AuditLog {
  id: number;
  entityType: string;
  entityId: number | null;
  action: AuditAction;
  performedBy: string;
  performedAt: string;
  oldValue: string | null;
  newValue: string | null;
  changeSummary: string | null;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}
