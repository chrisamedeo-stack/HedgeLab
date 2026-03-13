"use client";

import { btnPrimary } from "@/lib/ui-classes";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-b-default bg-surface px-6 py-12 text-center">
      {icon && (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-input-bg text-faint">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-secondary">{title}</p>
      {description && <p className="mt-1 text-xs text-faint">{description}</p>}
      {onAction && actionLabel && (
        <button onClick={onAction} className={`${btnPrimary} mt-4`}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
