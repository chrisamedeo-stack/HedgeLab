"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatContractMonth } from "@/lib/commodity-utils";
import type { FinancialTrade } from "@/types/trades";
import { TradeDetail } from "./TradeDetail";

interface TradeBlotterProps {
  trades: FinancialTrade[];
  commodities: { id: string; name: string }[];
  orgId: string;
  onRefresh: () => void;
}

const typeStyle: Record<string, { bg: string; text: string }> = {
  futures: { bg: "bg-futures-15", text: "text-futures" },
  options: { bg: "bg-action-10", text: "text-action" },
  swap: { bg: "bg-swap-15", text: "text-swap" },
};

export function TradeBlotter({ trades, commodities, orgId, onRefresh }: TradeBlotterProps) {
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
      key: "trade_type",
      header: "Type",
      width: "w-20",
      render: (row) => {
        const style = typeStyle[row.trade_type] ?? typeStyle.futures;
        return (
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}>
            {row.trade_type === "futures" ? "FUT" : row.trade_type === "options" ? "OPT" : "SWP"}
          </span>
        );
      },
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
      width: "w-20",
      render: (row) => (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          row.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
        }`}>
          {row.direction === "long" ? "LONG" : "SHORT"}
        </span>
      ),
    },
    {
      key: "contract_month",
      header: "Month",
      width: "w-24",
      render: (row) => <span className="tabular-nums">{formatContractMonth(row.contract_month)}</span>,
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
      render: (row) => {
        // Options: show C/P badge + strike
        if (row.trade_type === "options" && row.option_type) {
          const badge = row.option_type === "call" ? "C" : "P";
          const badgeColor = row.option_type === "call" ? "text-profit" : "text-loss";
          return (
            <span className="tabular-nums text-secondary">
              <span className={`font-bold ${badgeColor}`}>{badge}</span>{" "}
              {Number(row.strike_price ?? row.trade_price).toFixed(4)}
            </span>
          );
        }
        return (
          <span className="tabular-nums font-medium text-secondary">
            ${Number(row.trade_price).toFixed(4)}
          </span>
        );
      },
    },
    {
      key: "broker",
      header: "Broker",
      render: (row) => {
        // Swaps show counterparty instead of broker
        if (row.trade_type === "swap") {
          return <span className="text-muted text-xs">{row.counterparty_name ?? "\u2014"}</span>;
        }
        return <span className="text-muted text-xs">{row.broker ?? "\u2014"}</span>;
      },
    },
    {
      key: "unallocated_volume",
      header: "Unalloc",
      align: "right",
      render: (row) => {
        // Swaps don't use allocation
        if (row.trade_type === "swap") {
          return <span className="text-faint text-xs">N/A</span>;
        }
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
        expandedKey={expandedId}
        renderExpandedRow={(row) => (
          <TradeDetail
            tradeId={row.id}
            commodities={commodities}
            orgId={orgId}
            onClose={() => setExpandedId(null)}
            onRefresh={onRefresh}
          />
        )}
        emptyMessage="No trades found"
      />
    </div>
  );
}
