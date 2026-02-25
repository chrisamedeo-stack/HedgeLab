import { cn } from "@/lib/utils";
import type { TradeStatus, DeliveryStatus } from "@/types/trade";

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

const tradeStatusColors: Record<TradeStatus, BadgeColor> = {
  CONFIRMED: "profit",
  DRAFT: "neutral",
  AMENDED: "action",
  CANCELLED: "destructive",
  PARTIALLY_DELIVERED: "warning",
  FULLY_DELIVERED: "profit",
  SETTLED: "neutral",
};

const deliveryStatusColors: Record<DeliveryStatus, BadgeColor> = {
  PENDING: "neutral",
  PARTIAL: "warning",
  COMPLETE: "profit",
  CANCELLED: "destructive",
};

function StatusPill({ color, label }: { color: BadgeColor; label: string }) {
  const c = colorMap[color];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ring-1",
        c.ring,
        c.bg,
        c.text
      )}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

export function StatusBadge({ status }: { status: TradeStatus | string }) {
  const color = tradeStatusColors[status as TradeStatus] ?? "neutral";
  return <StatusPill color={color} label={status} />;
}

export function DeliveryBadge({ status }: { status: DeliveryStatus | string }) {
  const color = deliveryStatusColors[status as DeliveryStatus] ?? "neutral";
  return <StatusPill color={color} label={status} />;
}

// ─── Contract Status ────────────────────────────────────────────────────────

const contractStatusColors: Record<string, BadgeColor> = {
  OPEN: "neutral",
  BASIS_LOCKED: "action",
  EFP_EXECUTED: "profit",
  PO_ISSUED: "accent",
  CLOSED: "neutral",
  CANCELLED: "destructive",
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
  const color = contractStatusColors[status] ?? "neutral";
  const label = contractStatusLabels[status] ?? status;
  return <StatusPill color={color} label={label} />;
}

// ─── EFP Status ─────────────────────────────────────────────────────────────

const efpStatusColors: Record<string, BadgeColor> = {
  PENDING: "warning",
  CONFIRMED: "profit",
  CANCELLED: "destructive",
};

export function EfpStatusBadge({ status }: { status: string }) {
  const color = efpStatusColors[status] ?? "neutral";
  return <StatusPill color={color} label={status} />;
}

// ─── Hedge Status ───────────────────────────────────────────────────────────

const hedgeStatusColors: Record<string, BadgeColor> = {
  OPEN: "profit",
  PARTIALLY_EFP: "warning",
  FULLY_EFP: "action",
  CLOSED: "neutral",
};

export function HedgeStatusBadge({ status }: { status: string }) {
  const color = hedgeStatusColors[status] ?? "neutral";
  return <StatusPill color={color} label={status} />;
}

// ─── Trade Type ─────────────────────────────────────────────────────────────

const tradeTypeColors: Record<string, BadgeColor> = {
  BASIS: "action",
  ALL_IN: "profit",
  INDEX: "warning",
};

const tradeTypeLabels: Record<string, string> = {
  BASIS: "BASIS",
  ALL_IN: "ALL-IN",
  INDEX: "INDEX",
};

export function TradeTypeBadge({ type }: { type: string }) {
  const color = tradeTypeColors[type] ?? "neutral";
  const label = tradeTypeLabels[type] ?? type;
  return <StatusPill color={color} label={label} />;
}

// ─── Side (BUY/SELL/LONG/SHORT) ─────────────────────────────────────────────

const sideColors: Record<string, BadgeColor> = {
  BUY: "profit",
  LONG: "profit",
  SELL: "destructive",
  SHORT: "destructive",
};

export function SideBadge({ side }: { side: string }) {
  const color = sideColors[side] ?? "neutral";
  return <StatusPill color={color} label={side} />;
}
