"use client";

import { useState } from "react";
import { useBudgetStore } from "@/store/budgetStore";
import type { BudgetPeriod } from "@/types/budget";

interface ApprovalBarProps {
  period: BudgetPeriod;
  userId: string;
}

export function ApprovalBar({ period, userId }: ApprovalBarProps) {
  const { submitBudget, approveBudget, lockBudget, unlockBudget, createSnapshot } = useBudgetStore();
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const isLocked = !!period.locked_at;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-b-default bg-surface px-4 py-3">
      <div className="flex-1">
        <span className="text-xs text-faint uppercase tracking-wider">Status</span>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusDot status={period.status} locked={isLocked} />
          <span className="text-sm font-medium text-secondary">
            {isLocked ? "Locked" : period.status.charAt(0).toUpperCase() + period.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Snapshot button always available */}
        <button
          disabled={busy}
          onClick={() => act(() => createSnapshot(period.id, userId))}
          className="px-3 py-1.5 text-xs text-muted border border-b-input rounded-lg hover:bg-hover hover:text-secondary transition-colors disabled:opacity-50"
        >
          Save Snapshot
        </button>

        {/* Draft → Submit */}
        {period.status === "draft" && !isLocked && (
          <button
            disabled={busy}
            onClick={() => act(() => submitBudget(period.id, userId))}
            className="px-3 py-1.5 text-xs font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors disabled:opacity-50"
          >
            Submit for Approval
          </button>
        )}

        {/* Submitted → Approve */}
        {period.status === "submitted" && !isLocked && (
          <button
            disabled={busy}
            onClick={() => act(() => approveBudget(period.id, userId))}
            className="px-3 py-1.5 text-xs font-medium text-white bg-profit rounded-lg hover:bg-profit-hover transition-colors disabled:opacity-50"
          >
            Approve
          </button>
        )}

        {/* Approved → Lock */}
        {period.status === "approved" && !isLocked && (
          <button
            disabled={busy}
            onClick={() => act(() => lockBudget(period.id, userId))}
            className="px-3 py-1.5 text-xs font-medium text-white bg-warning rounded-lg hover:bg-warning-hover transition-colors disabled:opacity-50"
          >
            Lock Budget
          </button>
        )}

        {/* Locked → Unlock */}
        {isLocked && (
          <button
            disabled={busy}
            onClick={() => act(() => unlockBudget(period.id, userId))}
            className="px-3 py-1.5 text-xs font-medium text-warning border border-warning-20 rounded-lg hover:bg-warning-10 transition-colors disabled:opacity-50"
          >
            Unlock
          </button>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status, locked }: { status: string; locked: boolean }) {
  const color = locked
    ? "bg-warning"
    : status === "approved"
    ? "bg-profit"
    : status === "submitted"
    ? "bg-action"
    : "bg-muted";

  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}
