"use client";

import { useState } from "react";
import Link from "next/link";
import { useTrade } from "@/hooks/useTrades";
import { useTradeStore } from "@/store/tradeStore";
import { KPICard } from "@/components/ui/KPICard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AllocateForm } from "@/components/positions/AllocateForm";
import type { Allocation } from "@/types/positions";

const USER_ID = "00000000-0000-0000-0000-000000000099"; // demo admin

interface TradeDetailProps {
  tradeId: string;
  commodities: { id: string; name: string }[];
  sites: { id: string; name: string; code: string }[];
  orgId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function TradeDetail({ tradeId, commodities, sites, orgId, onClose, onRefresh }: TradeDetailProps) {
  const { data, loading, refetch } = useTrade(tradeId);
  const { cancelTrade, updateTrade } = useTradeStore();
  const [showAllocate, setShowAllocate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState("");
  const [cancelling, setCancelling] = useState(false);

  if (loading || !data) {
    return (
      <div className="mt-2 rounded-lg border border-b-default bg-surface p-4">
        <div className="text-sm text-faint">Loading trade details...</div>
      </div>
    );
  }

  const { trade, allocations, summary } = data;

  const handleCancel = async () => {
    if (!confirm("Cancel this trade? Open allocations will also be cancelled.")) return;
    setCancelling(true);
    try {
      await cancelTrade(tradeId, USER_ID, "User cancelled from blotter");
      onRefresh();
      onClose();
    } catch {
      // error handled by store
    } finally {
      setCancelling(false);
    }
  };

  const handleSavePrice = async () => {
    if (!editPrice) return;
    try {
      await updateTrade(tradeId, USER_ID, { tradePrice: Number(editPrice) });
      setEditing(false);
      refetch();
      onRefresh();
    } catch {
      // error handled by store
    }
  };

  const allocationColumns: Column<Allocation>[] = [
    {
      key: "allocation_date",
      header: "Date",
      render: (row) => <span className="tabular-nums text-secondary">{row.allocation_date?.slice(0, 10)}</span>,
    },
    {
      key: "site_name",
      header: "Site",
      render: (row) => {
        const a = row as Allocation & { site_name?: string; site_code?: string };
        return <span className="text-secondary">{a.site_name ?? a.site_code ?? row.site_id.slice(0, 8)}</span>;
      },
    },
    {
      key: "allocated_volume",
      header: "Volume",
      align: "right",
      render: (row) => <span className="tabular-nums">{Number(row.allocated_volume).toLocaleString()}</span>,
    },
    {
      key: "budget_month",
      header: "Budget Mo",
      render: (row) => <span className="tabular-nums text-muted">{row.budget_month ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="mt-2 rounded-lg border border-b-default bg-surface p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-primary">
              {trade.commodity_name ?? trade.commodity_id} — {trade.contract_month}
            </h3>
            <StatusBadge status={trade.status} />
            <span className={`text-xs font-medium ${trade.direction === "long" ? "text-profit" : "text-loss"}`}>
              {trade.direction.toUpperCase()}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-faint">
            {trade.trade_date?.slice(0, 10)} &middot; {trade.num_contracts} contracts @ {Number(trade.trade_price).toFixed(2)}
            {trade.broker && <> &middot; {trade.broker}</>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trade.status !== "cancelled" && (
            <>
              {Number(trade.unallocated_volume) > 0 && (
                <button
                  onClick={() => setShowAllocate(true)}
                  className="rounded-md bg-action px-3 py-1.5 text-xs font-medium text-white hover:bg-action-hover"
                >
                  Allocate
                </button>
              )}
              {!editing && trade.status !== "fully_allocated" && (
                <button
                  onClick={() => {
                    setEditPrice(String(trade.trade_price));
                    setEditing(true);
                  }}
                  className="rounded-md border border-b-input px-3 py-1.5 text-xs text-secondary hover:bg-hover"
                >
                  Edit Price
                </button>
              )}
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-md border border-destructive-20 px-3 py-1.5 text-xs text-loss hover:bg-destructive-10 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Cancel Trade"}
              </button>
            </>
          )}
          <Link
            href={`/trades/${tradeId}`}
            className="rounded-md border border-b-input px-3 py-1.5 text-xs text-muted hover:text-secondary hover:bg-hover"
          >
            Full Detail
          </Link>
          <button onClick={onClose} className="text-faint hover:text-secondary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Edit price inline */}
      {editing && (
        <div className="flex items-center gap-2 rounded-md bg-surface border border-b-default px-3 py-2">
          <span className="text-xs text-muted">New Price:</span>
          <input
            type="number"
            step="any"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            className="w-28 rounded border border-b-input bg-input-bg px-2 py-1 text-sm text-primary tabular-nums focus:border-focus focus:outline-none"
          />
          <button onClick={handleSavePrice} className="rounded bg-action px-2 py-1 text-xs text-white hover:bg-action-hover">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="rounded px-2 py-1 text-xs text-muted hover:text-secondary">
            Cancel
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <KPICard label="Total Volume" value={summary.totalVolume.toLocaleString()} />
        <KPICard label="Allocated" value={summary.allocatedVolume.toLocaleString()} />
        <KPICard
          label="Unallocated"
          value={summary.unallocatedVolume.toLocaleString()}
          trend={summary.unallocatedVolume > 0 ? "down" : undefined}
        />
        <KPICard label="Allocations" value={String(summary.allocationCount)} />
      </div>

      {/* Allocations table */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted">Allocations</h4>
        <DataTable
          columns={allocationColumns}
          data={allocations}
          keyField="id"
          emptyMessage="No allocations yet"
        />
      </div>

      {/* Allocate modal */}
      {showAllocate && (
        <AllocateForm
          orgId={orgId}
          sites={sites}
          commodities={commodities}
          onClose={() => setShowAllocate(false)}
          onSuccess={() => {
            setShowAllocate(false);
            refetch();
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
