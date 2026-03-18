"use client";

import type { BudgetVersion } from "@/types/budget";
import { useBudgetStore } from "@/store/budgetStore";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import { format } from "date-fns";

interface VersionPanelProps {
  periodId: string;
  versions: BudgetVersion[];
  userId: string;
  locked?: boolean;
}

export function VersionPanel({ periodId, versions, userId, locked }: VersionPanelProps) {
  const { restoreVersion } = useBudgetStore();
  const { confirm, dialog } = useConfirmDialog();

  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-b-default bg-surface px-4 py-6 text-center">
        <p className="text-sm text-faint">No version snapshots yet.</p>
        <p className="text-xs text-ph mt-1">Snapshots are created automatically on submit, or manually via Save Snapshot.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-b-default bg-surface">
      {dialog}
      <div className="px-4 py-3 border-b border-b-default">
        <h3 className="text-sm font-semibold text-secondary">Version History</h3>
      </div>
      <div className="divide-y divide-tbl-border">
        {versions.map((v) => {
          let snap: unknown = v.snapshot;
          if (typeof snap === "string") {
            try { snap = JSON.parse(snap); } catch { snap = []; }
          }
          const itemCount = Array.isArray(snap) ? snap.length : 0;
          return (
            <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-row-hover transition-colors">
              <div>
                <div className="text-sm text-secondary">
                  <span className="font-medium">v{v.version_number}</span>
                  {v.version_name && (
                    <span className="ml-2 text-muted">· {v.version_name}</span>
                  )}
                </div>
                <div className="text-xs text-faint mt-0.5">
                  {format(new Date(v.created_at), "MMM d, yyyy h:mm a")} · {itemCount} months
                </div>
              </div>
              {!locked && (
                <button
                  onClick={() => {
                    confirm({
                      title: "Restore version",
                      description: `Restore to v${v.version_number}? Current data will be snapshot first.`,
                      variant: "warning",
                      confirmLabel: "Restore",
                      onConfirm: async () => {
                        await restoreVersion(periodId, v.version_number, userId);
                      },
                    });
                  }}
                  className="px-2.5 py-1 text-xs text-muted border border-b-input rounded-lg hover:bg-hover hover:text-secondary transition-colors"
                >
                  Restore
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
