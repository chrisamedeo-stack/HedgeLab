"use client";

import { useMemo } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getAvailableActions } from "@/lib/positionStateMachine";
import type { Position, PipelineTab } from "@/types/positions";
import type { TradeType } from "@/types/trades";

interface PositionTableProps {
  positions: Position[];
  tab: PipelineTab;
  onAction: (positionId: string, action: string) => void;
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVol(v: number | null | undefined): string {
  if (v == null) return "—";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function PositionTable({ positions, tab, onAction }: PositionTableProps) {
  const columns = useMemo(() => {
    const base: Column<Position>[] = [
      { key: "contract_month", header: "Contract", width: "100px" },
      { key: "commodity_name", header: "Commodity" },
      {
        key: "direction",
        header: "Dir",
        width: "60px",
        render: (r) => (
          <span className={r.direction === "long" ? "text-profit" : "text-destructive"}>
            {r.direction === "long" ? "Long" : "Short"}
          </span>
        ),
      },
      { key: "trade_type", header: "Type", width: "80px", render: (r) => r.trade_type.charAt(0).toUpperCase() + r.trade_type.slice(1) },
      { key: "total_volume", header: "Volume", align: "right" as const, render: (r) => fmtVol(r.total_volume) },
      { key: "trade_price", header: "Price", align: "right" as const, render: (r) => fmt(r.trade_price) },
      {
        key: "position_status",
        header: "Status",
        render: (r) => <StatusBadge status={r.position_status} />,
      },
    ];

    // Tab-specific columns
    if (tab === "budget" || tab === "site" || tab === "all") {
      base.push({ key: "budget_month", header: "Budget Mo", render: (r) => r.budget_month ?? "—" });
    }
    if (tab === "site" || tab === "all") {
      base.push({ key: "site_name", header: "Site", render: (r) => r.site_name ?? "—" });
    }
    if (tab === "efp") {
      base.push(
        { key: "efp_market_price", header: "Mkt Price", align: "right" as const, render: (r) => fmt(r.efp_market_price) },
        { key: "efp_basis", header: "Basis", align: "right" as const, render: (r) => fmt(r.efp_basis) },
        { key: "futures_realized_pnl", header: "Realized P&L", align: "right" as const, render: (r) => fmt(r.futures_realized_pnl) }
      );
    }
    if (tab === "offset") {
      base.push(
        { key: "offset_price", header: "Offset Price", align: "right" as const, render: (r) => fmt(r.offset_price) },
        { key: "realized_pnl", header: "Realized P&L", align: "right" as const, render: (r) => fmt(r.realized_pnl) }
      );
    }

    // Actions column
    base.push({
      key: "actions",
      header: "",
      sortable: false,
      align: "right" as const,
      render: (r) => {
        const actions = getAvailableActions(r.position_status, r.trade_type as TradeType);
        if (actions.length === 0) return null;
        return (
          <div className="flex gap-2 justify-end">
            {actions.map((a) => (
              <button
                key={a.key}
                onClick={(e) => { e.stopPropagation(); onAction(r.id, a.key); }}
                className="text-xs text-action hover:underline whitespace-nowrap"
              >
                {a.label}
              </button>
            ))}
          </div>
        );
      },
    });

    return base;
  }, [tab, onAction]);

  return (
    <DataTable
      columns={columns}
      data={positions}
      emptyMessage="No positions in this view"
    />
  );
}
