"use client";

import { KPICard } from "@/components/ui/KPICard";
import type { HedgeBookSummary } from "@/types/positions";

interface PositionSummaryCardsProps {
  summary: HedgeBookSummary | null;
  currency?: string;
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVol(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function PositionSummaryCards({ summary, currency = "USD" }: PositionSummaryCardsProps) {
  if (!summary) return null;

  const prefix = currency === "CAD" ? "C$" : "$";

  const cards = [
    { label: "MTM P&L", value: `${prefix}${fmt(summary.mtm_pnl)}`, highlight: summary.mtm_pnl >= 0 ? "profit" : "destructive" },
    { label: "Realized P&L", value: `${prefix}${fmt(summary.realized_pnl)}`, highlight: summary.realized_pnl >= 0 ? "profit" : "destructive" },
    { label: "Avg Board Price", value: summary.avg_board_price != null ? `${prefix}${fmt(summary.avg_board_price)}` : "—" },
    { label: "Avg Basis", value: summary.avg_basis != null ? `${prefix}${fmt(summary.avg_basis)}` : "—" },
    { label: "Avg Net Premium", value: summary.avg_net_premium != null ? `${prefix}${fmt(summary.avg_net_premium)}` : "—" },
    { label: "All-in Price", value: summary.all_in_price != null ? `${prefix}${fmt(summary.all_in_price)}` : "—" },
    { label: "Open Volume", value: fmtVol(summary.open_volume) },
    { label: "EFP Volume", value: fmtVol(summary.efp_volume) },
    { label: "Offset Volume", value: fmtVol(summary.offset_volume) },
  ] as const;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {cards.map((c) => (
        <KPICard
          key={c.label}
          label={c.label}
          value={c.value}
          highlight={"highlight" in c ? (c.highlight as "profit" | "destructive") : undefined}
          className="min-w-[140px] flex-shrink-0"
        />
      ))}
    </div>
  );
}
