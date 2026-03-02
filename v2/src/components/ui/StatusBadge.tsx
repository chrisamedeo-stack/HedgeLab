"use client";

const statusColors: Record<string, string> = {
  open: "bg-action-10 text-action border-action-20",
  efp_closed: "bg-profit-10 text-profit border-profit-20",
  locked: "bg-profit-10 text-profit border-profit-20",
  offset: "bg-warning-10 text-warning border-warning-20",
  rolled: "bg-accent-10 text-accent border-accent-20",
  cancelled: "bg-neutral-15 text-muted border-neutral-20",
  // Trade statuses
  partially_allocated: "bg-warning-10 text-warning border-warning-20",
  fully_allocated: "bg-profit-10 text-profit border-profit-20",
  filled: "bg-profit-10 text-profit border-profit-20",
  pending: "bg-warning-10 text-warning border-warning-20",
  executed: "bg-profit-10 text-profit border-profit-20",
  // Import statuses
  uploaded: "bg-action-10 text-action border-action-20",
  validated: "bg-warning-10 text-warning border-warning-20",
  committed: "bg-profit-10 text-profit border-profit-20",
  valid: "bg-profit-10 text-profit border-profit-20",
  warning: "bg-warning-10 text-warning border-warning-20",
  error: "bg-destructive-10 text-loss border-destructive-20",
  // Budget statuses
  draft: "bg-neutral-15 text-muted border-neutral-20",
  submitted: "bg-action-10 text-action border-action-20",
  approved: "bg-profit-10 text-profit border-profit-20",
};

const statusLabels: Record<string, string> = {
  efp_closed: "Locked",
  open: "Open",
  offset: "Offset",
  rolled: "Rolled",
  cancelled: "Cancelled",
  partially_allocated: "Partial",
  fully_allocated: "Allocated",
  filled: "Filled",
  pending: "Pending",
  executed: "Executed",
  uploaded: "Uploaded",
  validated: "Validated",
  committed: "Committed",
  valid: "Valid",
  warning: "Warning",
  error: "Error",
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const colors = statusColors[status] ?? "bg-neutral-15 text-muted border-neutral-20";
  const label = statusLabels[status] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors} ${className}`}
    >
      {label}
    </span>
  );
}
