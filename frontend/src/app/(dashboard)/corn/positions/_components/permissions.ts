"use client";

import { useMemo } from "react";
import { getUser } from "@/lib/auth";
import type { AppRole } from "@/types/auth";

export type PermissionAction =
  | "book-hedge"
  | "edit-hedge"
  | "delete-hedge"
  | "allocate"
  | "undo-allocation"
  | "assign-site"
  | "publish-settle";

const ROLE_PERMISSIONS: Record<AppRole, Set<PermissionAction>> = {
  ADMIN: new Set<PermissionAction>([
    "book-hedge",
    "edit-hedge",
    "delete-hedge",
    "allocate",
    "undo-allocation",
    "assign-site",
    "publish-settle",
  ]),
  TRADER: new Set<PermissionAction>([
    "book-hedge",
    "edit-hedge",
    "delete-hedge",
    "publish-settle",
  ]),
  RISK_MANAGER: new Set<PermissionAction>([
    "allocate",
    "undo-allocation",
    "assign-site",
  ]),
  READ_ONLY: new Set<PermissionAction>(),
};

export function usePermissions() {
  const user = typeof window !== "undefined" ? getUser() : null;
  const role = (user?.role as AppRole) ?? "READ_ONLY";

  const can = useMemo(() => {
    const allowed = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.READ_ONLY;
    return (action: PermissionAction) => allowed.has(action);
  }, [role]);

  return { can, role };
}
