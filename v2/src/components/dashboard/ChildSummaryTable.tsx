"use client";

import { DataTable, type Column } from "@/components/ui/DataTable";
import type { ChildSummary } from "@/types/dashboard";

interface Props {
  children: ChildSummary[];
  onSelect: (child: ChildSummary) => void;
  loading: boolean;
}

const columns: Column<ChildSummary>[] = [
  {
    key: "name",
    header: "Name",
    render: (row) => (
      <div>
        <span className="text-secondary font-medium">{row.name}</span>
        {row.code && <span className="ml-1.5 text-faint text-[10px]">{row.code}</span>}
      </div>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (row) => (
      <span className="text-xs text-muted">
        {row.type === "unit" ? `${row.siteCount ?? 0} sites` : row.siteType ?? "Site"}
      </span>
    ),
  },
  {
    key: "coveragePct",
    header: "Coverage",
    align: "right",
    render: (row) => (
      <div className="flex items-center justify-end gap-2">
        <div className="w-16 h-1.5 bg-input-bg rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              row.coveragePct >= 80 ? "bg-profit" : row.coveragePct >= 50 ? "bg-warning" : "bg-loss"
            }`}
            style={{ width: `${Math.min(row.coveragePct, 100)}%` }}
          />
        </div>
        <span className={`text-xs tabular-nums font-medium ${
          row.coveragePct >= 80 ? "text-profit" : row.coveragePct >= 50 ? "text-warning" : "text-loss"
        }`}>
          {row.coveragePct}%
        </span>
      </div>
    ),
  },
  {
    key: "hedgedVolume",
    header: "Hedged Vol",
    align: "right",
    render: (row) => (
      <span className="text-xs tabular-nums">{row.hedgedVolume.toLocaleString()}</span>
    ),
  },
  {
    key: "netPosition",
    header: "Net Position",
    align: "right",
    render: (row) => (
      <span className={`text-xs tabular-nums font-medium ${
        row.netPosition > 0 ? "text-profit" : row.netPosition < 0 ? "text-loss" : "text-muted"
      }`}>
        {row.netPosition > 0 ? "+" : ""}{row.netPosition.toLocaleString()}
      </span>
    ),
  },
  {
    key: "pnl",
    header: "P&L",
    align: "right",
    render: (row) => (
      <span className={`text-xs tabular-nums font-medium ${
        row.pnl > 0 ? "text-profit" : row.pnl < 0 ? "text-loss" : "text-muted"
      }`}>
        ${Math.abs(row.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>
    ),
  },
  {
    key: "alertCount",
    header: "Alerts",
    align: "center",
    sortable: false,
    render: (row) =>
      row.alertCount > 0 ? (
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-loss/20 text-loss text-[10px] font-bold">
          {row.alertCount}
        </span>
      ) : (
        <span className="text-faint">&mdash;</span>
      ),
  },
];

export function ChildSummaryTable({ children, onSelect, loading }: Props) {
  if (loading && children.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-b-default">
          <div className="h-3 w-32 rounded bg-gradient-to-r from-input-bg via-b-input to-input-bg bg-[length:200%_100%] animate-shimmer" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-4 py-4 border-b border-b-default">
            <div className="h-3 w-full rounded bg-gradient-to-r from-input-bg via-b-input to-input-bg bg-[length:200%_100%] animate-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (children.length === 0) return null;

  return (
    <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
      <DataTable
        columns={columns}
        data={children}
        keyField="id"
        onRowClick={onSelect}
        emptyMessage="No child entities"
      />
    </div>
  );
}
