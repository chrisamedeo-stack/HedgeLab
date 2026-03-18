"use client";

import { useState } from "react";
import Link from "next/link";
import { useTrade } from "@/hooks/useTrades";
import { useTradeStore } from "@/store/tradeStore";
import { useAuth } from "@/contexts/AuthContext";
import { KPICard } from "@/components/ui/KPICard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatContractMonth } from "@/lib/commodity-utils";

interface TradeDetailProps {
  tradeId: string;
  commodities: { id: string; name: string }[];
  orgId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function TradeDetail({ tradeId, commodities, orgId, onClose, onRefresh }: TradeDetailProps) {
  const { data, loading, refetch } = useTrade(tradeId);
  const { cancelTrade, updateTrade, deleteTrade } = useTradeStore();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading || !data) {
    return (
      <div className="bg-surface p-4">
        <div className="text-sm text-faint">Loading trade details...</div>
      </div>
    );
  }

  const { trade, summary } = data;

  const handleCancel = async () => {
    if (!confirm("Cancel this trade? Open allocations will also be cancelled.")) return;
    setCancelling(true);
    try {
      await cancelTrade(tradeId, user!.id, "User cancelled from blotter");
      onRefresh();
      onClose();
    } catch {
      // error handled by store
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Permanently delete this trade? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteTrade(tradeId, user!.id);
      onRefresh();
      onClose();
    } catch {
      // error handled by store
    } finally {
      setDeleting(false);
    }
  };

  const handleSavePrice = async () => {
    if (!editPrice) return;
    try {
      await updateTrade(tradeId, user!.id, { tradePrice: Number(editPrice) });
      setEditing(false);
      refetch();
      onRefresh();
    } catch {
      // error handled by store
    }
  };

  return (
    <div className="bg-surface p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-primary">
              {trade.commodity_name ?? trade.commodity_id} &middot; {formatContractMonth(trade.contract_month)}
            </h3>
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              trade.trade_type === "options" ? "bg-action-10 text-action"
                : trade.trade_type === "swap" ? "bg-swap-15 text-swap"
                : "bg-futures-15 text-futures"
            }`}>
              {trade.trade_type === "futures" ? "FUT" : trade.trade_type === "options" ? "OPT" : "SWP"}
            </span>
            <StatusBadge status={trade.status} />
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              trade.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
            }`}>
              {trade.direction === "long" ? "LONG" : "SHORT"}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-faint">
            {trade.trade_date?.slice(0, 10)} &middot; {trade.num_contracts} contracts @ ${Number(trade.trade_price).toFixed(4)}
            {trade.broker && <> &middot; {trade.broker}</>}
            {trade.trade_type === "swap" && trade.counterparty_name && <> &middot; {trade.counterparty_name}</>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trade.status !== "cancelled" && (
            <>
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
              {trade.status === "open" && Number(trade.allocated_volume) === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-md bg-destructive-10 border border-destructive-20 px-3 py-1.5 text-xs font-medium text-loss hover:bg-destructive-15 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              )}
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

      {/* KPI Card — read-only volume indicator */}
      {trade.trade_type !== "swap" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard label="Total Volume" value={summary.totalVolume.toLocaleString()} />
          <KPICard label="Allocated" value={summary.allocatedVolume.toLocaleString()} />
          <KPICard label="Unallocated" value={summary.unallocatedVolume.toLocaleString()} />
        </div>
      )}

      {/* Swap info banner */}
      {trade.trade_type === "swap" && (
        <div className="rounded-lg border border-swap-20 bg-swap-5 px-4 py-3 text-xs text-swap">
          Swaps settle via their own settlement schedule. Use the Full Detail view to manage settlements.
        </div>
      )}

    </div>
  );
}
