"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { StatusBadge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu, type DropdownItem } from "@/components/ui/DropdownMenu";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { useTableSort } from "@/hooks/useTableSort";
import { formatUsd } from "@/lib/format";
import type { Trade } from "@/types/trade";

const STATUS_OPTIONS = [
  "",
  "DRAFT",
  "CONFIRMED",
  "AMENDED",
  "CANCELLED",
  "PARTIALLY_DELIVERED",
  "FULLY_DELIVERED",
  "SETTLED",
];

export default function TradesPage() {
  const [page, setPage]     = useState(0);
  const [status, setStatus] = useState("");
  const { toast }           = useToast();

  const { trades, isLoading, mutate } = useTrades(page, 20, status || undefined);

  type TradeSortKey = "tradeReference" | "tradeType" | "status" | "counterpartyName" | "commodityCode" | "bookCode" | "tradeDate" | "notionalUsd";
  const tradeAccessor = useCallback((t: Trade, key: TradeSortKey) => {
    switch (key) {
      case "tradeReference": return t.tradeReference;
      case "tradeType": return t.tradeType;
      case "status": return t.status;
      case "counterpartyName": return t.counterpartyName;
      case "commodityCode": return t.commodityCode;
      case "bookCode": return t.bookCode;
      case "tradeDate": return t.tradeDate;
      case "notionalUsd": return t.notionalUsd;
      default: return null;
    }
  }, []);
  const { sorted: sortedTrades, sort: tradeSort, toggleSort: toggleTradeSort } = useTableSort<Trade, TradeSortKey>(trades?.content ?? [], "tradeDate", tradeAccessor, "desc");

  async function handleConfirm(id: number) {
    try {
      await api.post(`/api/v1/trades/${id}/confirm`, {});
      toast("Trade confirmed successfully", "success");
      mutate();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to confirm trade", "error");
    }
  }

  async function handleCancel(id: number) {
    if (!confirm("Cancel this trade?")) return;
    try {
      await api.post(`/api/v1/trades/${id}/cancel`, {});
      toast("Trade cancelled", "info");
      mutate();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to cancel trade", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Trade Blotter</h1>
        <span className="text-sm text-faint">
          {trades?.totalElements ?? 0} total trades
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={9} />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-input-bg/50">
              <tr>
                <SortableHeader label="Reference" sortKey="tradeReference" activeKey={tradeSort.key} activeDir={tradeSort.dir} onToggle={(k) => toggleTradeSort(k as TradeSortKey)} className="px-3" />
                <SortableHeader label="Type" sortKey="tradeType" activeKey={tradeSort.key} activeDir={tradeSort.dir} onToggle={(k) => toggleTradeSort(k as TradeSortKey)} className="px-3" />
                <SortableHeader label="Status" sortKey="status" activeKey={tradeSort.key} activeDir={tradeSort.dir} onToggle={(k) => toggleTradeSort(k as TradeSortKey)} className="px-3" />
                <SortableHeader label="Counterparty" sortKey="counterpartyName" activeKey={tradeSort.key} activeDir={tradeSort.dir} onToggle={(k) => toggleTradeSort(k as TradeSortKey)} className="px-3" />
                <SortableHeader label="Commodity" sortKey="commodityCode" activeKey={tradeSort.key} activeDir={tradeSort.dir} onToggle={(k) => toggleTradeSort(k as TradeSortKey)} className="px-3" />
                <SortableHeader label="Book" sortKey="bookCode" activeKey={tradeSort.key} activeDir={tradeSort.dir} onToggle={(k) => toggleTradeSort(k as TradeSortKey)} className="px-3" />
                <SortableHeader label="Trade Date" sortKey="tradeDate" activeKey={tradeSort.key} activeDir={tradeSort.dir} onToggle={(k) => toggleTradeSort(k as TradeSortKey)} className="px-3" />
                <SortableHeader label="Notional USD" sortKey="notionalUsd" activeKey={tradeSort.key} activeDir={tradeSort.dir} onToggle={(k) => toggleTradeSort(k as TradeSortKey)} className="px-3" />
                <th className="px-3 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {sortedTrades.length ? (
                sortedTrades.map((t) => (
                  <TradeRow
                    key={t.id}
                    trade={t}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={ArrowLeftRight}
                      title="No trades found"
                      description={
                        status
                          ? `No trades with status "${status}". Try a different filter.`
                          : "No trades have been created yet."
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {trades && trades.totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border border-b-input bg-input-bg text-secondary rounded-lg disabled:opacity-40 hover:bg-hover transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-faint">
            {page + 1} / {trades.totalPages}
          </span>
          <button
            disabled={page >= trades.totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border border-b-input bg-input-bg text-secondary rounded-lg disabled:opacity-40 hover:bg-hover transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function TradeRow({
  trade,
  onConfirm,
  onCancel,
}: {
  trade: Trade;
  onConfirm: (id: number) => void;
  onCancel: (id: number) => void;
}) {
  const items: DropdownItem[] = [
    {
      label: "View details",
      onClick: () => { window.location.href = `/trades/${trade.id}`; },
    },
    ...(trade.status === "DRAFT"
      ? [{ label: "Confirm", onClick: () => onConfirm(trade.id) }]
      : []),
    ...((trade.status === "CONFIRMED" || trade.status === "AMENDED")
      ? [{ label: "Amend", onClick: () => { window.location.href = `/trades/${trade.id}/amend`; } }]
      : []),
    ...(trade.status !== "CANCELLED" && trade.status !== "SETTLED"
      ? [{ label: "Cancel", onClick: () => onCancel(trade.id), variant: "danger" as const }]
      : []),
  ];

  return (
    <tr className="hover:bg-row-hover transition-colors">
      <td className="px-3 py-2.5">
        <Link
          href={`/trades/${trade.id}`}
          className="text-action hover:text-action-hover font-mono text-xs transition-colors"
        >
          {trade.tradeReference}
        </Link>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted">
        {trade.tradeType.replace(/_/g, " ")}
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={trade.status} />
      </td>
      <td className="px-3 py-2.5 text-xs text-secondary">{trade.counterpartyName}</td>
      <td className="px-3 py-2.5 text-xs text-secondary">{trade.commodityCode}</td>
      <td className="px-3 py-2.5 text-xs text-muted">{trade.bookCode}</td>
      <td className="px-3 py-2.5 text-xs text-muted font-mono tabular-nums">{trade.tradeDate}</td>
      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-xs text-secondary">
        {formatUsd(trade.notionalUsd)}
      </td>
      <td className="px-3 py-2.5">
        <DropdownMenu items={items} />
      </td>
    </tr>
  );
}
