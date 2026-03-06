"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { FinancialTrade } from "@/types/trades";
import { TradeDetail } from "./TradeDetail";

interface TradeBlotterProps {
  trades: FinancialTrade[];
  commodities: { id: string; name: string }[];
  sites: { id: string; name: string; code: string }[];
  orgId: string;
  onRefresh: () => void;
}

export function TradeBlotter({ trades, commodities, sites, orgId, onRefresh }: TradeBlotterProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const columns: Column<FinancialTrade>[] = [
    {
      key: "trade_date",
      header: "Date",
      width: "w-24",
      render: (row) => (
        <span className="tabular-nums text-secondary">{row.trade_date?.slice(0, 10)}</span>
      ),
    },
    {
      key: "commodity_name",
      header: "Commodity",
      render: (row) => (
        <span className="text-secondary">{row.commodity_name ?? row.commodity_id}</span>
      ),
    },
    {
      key: "direction",
      header: "Dir",
      width: "w-16",
      render: (row) => (
        <span className={row.direction === "long" ? "text-profit" : "text-loss"}>
          {row.direction === "long" ? "L" : "S"}
        </span>
      ),
    },
    {
      key: "contract_month",
      header: "Month",
      width: "w-20",
      render: (row) => <span className="tabular-nums">{row.contract_month}</span>,
    },
    {
      key: "num_contracts",
      header: "Contracts",
      width: "w-20",
      align: "right",
      render: (row) => <span className="tabular-nums">{row.num_contracts}</span>,
    },
    {
      key: "total_volume",
      header: "Volume",
      align: "right",
      render: (row) => (
        <span className="tabular-nums">{Number(row.total_volume).toLocaleString()}</span>
      ),
    },
    {
      key: "trade_price",
      header: "Price",
      align: "right",
      render: (row) => (
        <span className="tabular-nums font-medium text-secondary">
          ${Number(row.trade_price).toFixed(4)}
        </span>
      ),
    },
    {
      key: "allocated_volume",
      header: "Allocated",
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-muted">
          {Number(row.allocated_volume).toLocaleString()}
        </span>
      ),
    },
    {
      key: "unallocated_volume",
      header: "Unalloc",
      align: "right",
      render: (row) => {
        const unalloc = Number(row.unallocated_volume);
        return (
          <span className={`tabular-nums ${unalloc > 0 ? "text-warning" : "text-faint"}`}>
            {unalloc.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div>
      <DataTable
        columns={columns}
        data={trades}
        keyField="id"
        onRowClick={(row) => setExpandedId(expandedId === row.id ? null : row.id)}
        emptyMessage="No trades found"
      />

      {expandedId && (
        <TradeDetail
          tradeId={expandedId}
          commodities={commodities}
          sites={sites}
          orgId={orgId}
          onClose={() => setExpandedId(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
