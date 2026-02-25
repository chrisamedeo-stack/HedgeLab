import { cn } from "@/lib/utils";
import type { TradeStatus, DeliveryStatus } from "@/types/trade";

type BadgeColor = "emerald" | "slate" | "blue" | "red" | "amber" | "violet";

interface ColorConfig {
  dot: string;
  ring: string;
  bg: string;
  text: string;
}

const colorMap: Record<BadgeColor, ColorConfig> = {
  emerald: {
    dot: "bg-emerald-400",
    ring: "ring-emerald-500/20",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  slate: {
    dot: "bg-slate-400",
    ring: "ring-slate-500/20",
    bg: "bg-slate-500/10",
    text: "text-slate-400",
  },
  blue: {
    dot: "bg-blue-400",
    ring: "ring-blue-500/20",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
  red: {
    dot: "bg-red-400",
    ring: "ring-red-500/20",
    bg: "bg-red-500/10",
    text: "text-red-400",
  },
  amber: {
    dot: "bg-amber-400",
    ring: "ring-amber-500/20",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
  violet: {
    dot: "bg-violet-400",
    ring: "ring-violet-500/20",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
  },
};

const tradeStatusColors: Record<TradeStatus, BadgeColor> = {
  CONFIRMED: "emerald",
  DRAFT: "slate",
  AMENDED: "blue",
  CANCELLED: "red",
  PARTIALLY_DELIVERED: "amber",
  FULLY_DELIVERED: "emerald",
  SETTLED: "slate",
};

const deliveryStatusColors: Record<DeliveryStatus, BadgeColor> = {
  PENDING: "slate",
  PARTIAL: "amber",
  COMPLETE: "emerald",
  CANCELLED: "red",
};

function StatusPill({ color, label }: { color: BadgeColor; label: string }) {
  const c = colorMap[color];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        c.ring,
        c.bg,
        c.text
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {label.replace(/_/g, " ")}
    </span>
  );
}

export function StatusBadge({ status }: { status: TradeStatus | string }) {
  const color = tradeStatusColors[status as TradeStatus] ?? "slate";
  return <StatusPill color={color} label={status} />;
}

export function DeliveryBadge({ status }: { status: DeliveryStatus | string }) {
  const color = deliveryStatusColors[status as DeliveryStatus] ?? "slate";
  return <StatusPill color={color} label={status} />;
}

// ─── Contract Status ────────────────────────────────────────────────────────

const contractStatusColors: Record<string, BadgeColor> = {
  OPEN: "slate",
  BASIS_LOCKED: "blue",
  EFP_EXECUTED: "emerald",
  PO_ISSUED: "violet",
  CLOSED: "slate",
  CANCELLED: "red",
};

const contractStatusLabels: Record<string, string> = {
  OPEN: "Open",
  BASIS_LOCKED: "Basis Locked",
  EFP_EXECUTED: "EFP'd",
  PO_ISSUED: "PO Issued",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export function ContractStatusBadge({ status }: { status: string }) {
  const color = contractStatusColors[status] ?? "slate";
  const label = contractStatusLabels[status] ?? status;
  return <StatusPill color={color} label={label} />;
}

// ─── EFP Status ─────────────────────────────────────────────────────────────

const efpStatusColors: Record<string, BadgeColor> = {
  PENDING: "amber",
  CONFIRMED: "emerald",
  CANCELLED: "red",
};

export function EfpStatusBadge({ status }: { status: string }) {
  const color = efpStatusColors[status] ?? "slate";
  return <StatusPill color={color} label={status} />;
}

// ─── Hedge Status ───────────────────────────────────────────────────────────

const hedgeStatusColors: Record<string, BadgeColor> = {
  OPEN: "emerald",
  PARTIALLY_EFP: "amber",
  FULLY_EFP: "blue",
  CLOSED: "slate",
};

export function HedgeStatusBadge({ status }: { status: string }) {
  const color = hedgeStatusColors[status] ?? "slate";
  return <StatusPill color={color} label={status} />;
}

// ─── Trade Type ─────────────────────────────────────────────────────────────

const tradeTypeColors: Record<string, BadgeColor> = {
  BASIS: "blue",
  ALL_IN: "emerald",
  INDEX: "amber",
};

const tradeTypeLabels: Record<string, string> = {
  BASIS: "BASIS",
  ALL_IN: "ALL-IN",
  INDEX: "INDEX",
};

export function TradeTypeBadge({ type }: { type: string }) {
  const color = tradeTypeColors[type] ?? "slate";
  const label = tradeTypeLabels[type] ?? type;
  return <StatusPill color={color} label={label} />;
}

// ─── Side (BUY/SELL/LONG/SHORT) ─────────────────────────────────────────────

const sideColors: Record<string, BadgeColor> = {
  BUY: "emerald",
  LONG: "emerald",
  SELL: "red",
  SHORT: "red",
};

export function SideBadge({ side }: { side: string }) {
  const color = sideColors[side] ?? "slate";
  return <StatusPill color={color} label={side} />;
}
