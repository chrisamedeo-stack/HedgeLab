"use client";

type BadgeColor = "profit" | "neutral" | "action" | "destructive" | "warning" | "accent";

interface ColorConfig {
  ring: string;
  bg: string;
  text: string;
}

const colorMap: Record<BadgeColor, ColorConfig> = {
  profit: {
    ring: "ring-profit-20",
    bg: "bg-profit-15",
    text: "text-profit",
  },
  neutral: {
    ring: "ring-neutral-20",
    bg: "bg-neutral-15",
    text: "text-neutral",
  },
  action: {
    ring: "ring-action-20",
    bg: "bg-action-15",
    text: "text-action",
  },
  destructive: {
    ring: "ring-destructive-20",
    bg: "bg-destructive-15",
    text: "text-destructive",
  },
  warning: {
    ring: "ring-warning-20",
    bg: "bg-warning-15",
    text: "text-warning",
  },
  accent: {
    ring: "ring-accent-20",
    bg: "bg-accent-15",
    text: "text-accent",
  },
};

const statusToColor: Record<string, BadgeColor> = {
  // Position statuses
  open: "action",
  efp_closed: "profit",
  locked: "profit",
  offset: "warning",
  rolled: "accent",
  cancelled: "neutral",
  // Trade statuses
  partially_allocated: "warning",
  fully_allocated: "profit",
  filled: "profit",
  pending: "warning",
  executed: "profit",
  // Import statuses
  uploaded: "action",
  validated: "warning",
  committed: "profit",
  valid: "profit",
  warning: "warning",
  error: "destructive",
  // Budget statuses
  draft: "neutral",
  submitted: "action",
  approved: "profit",
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
  locked: "Locked",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const badgeColor = statusToColor[status] ?? "neutral";
  const c = colorMap[badgeColor];
  const label = statusLabels[status] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ring-1 ${c.ring} ${c.bg} ${c.text} ${className}`}
    >
      {label}
    </span>
  );
}
