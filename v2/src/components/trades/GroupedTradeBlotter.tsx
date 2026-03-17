"use client";

import { useState, useMemo } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { formatContractMonth } from "@/lib/commodity-utils";
import { groupTrades, getSwapTrades } from "@/lib/tradeGrouping";
import { GroupAllocateForm } from "./GroupAllocateForm";
import { TradeDetail } from "./TradeDetail";
import type { FinancialTrade, TradeGroupSummary } from "@/types/trades";

interface GroupedTradeBlotterProps {
  trades: FinancialTrade[];
  commodities: { id: string; name: string }[];
  sites: { id: string; name: string; code: string }[];
  orgId: string;
  onRefresh: () => void;
}

// ─── Swap blotter columns (flat list at bottom) ─────────────────────────────

const swapColumns: Column<FinancialTrade>[] = [
  {
    key: "trade_date",
    header: "Date",
    width: "w-24",
    render: (row) => <span className="tabular-nums text-secondary">{row.trade_date?.slice(0, 10)}</span>,
  },
  {
    key: "commodity_name",
    header: "Commodity",
    render: (row) => <span className="text-secondary">{row.commodity_name ?? row.commodity_id}</span>,
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
    key: "total_volume",
    header: "Volume",
    align: "right",
    render: (row) => <span className="tabular-nums">{Number(row.total_volume).toLocaleString()}</span>,
  },
  {
    key: "trade_price",
    header: "Price",
    align: "right",
    render: (row) => <span className="tabular-nums font-medium text-secondary">${Number(row.trade_price).toFixed(4)}</span>,
  },
  {
    key: "counterparty_name",
    header: "Counterparty",
    render: (row) => <span className="text-muted text-xs">{row.counterparty_name ?? "\u2014"}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  },
];

// ─── Chevron icon ───────────────────────────────────────────────────────────

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 text-faint transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function GroupedTradeBlotter({
  trades,
  commodities,
  sites,
  orgId,
  onRefresh,
}: GroupedTradeBlotterProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupAllocatingId, setGroupAllocatingId] = useState<string | null>(null);
  const [expandedSwapId, setExpandedSwapId] = useState<string | null>(null);

  const commodityGroups = useMemo(() => groupTrades(trades), [trades]);
  const swapTrades = useMemo(() => getSwapTrades(trades), [trades]);

  const toggleGroup = (groupId: string) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
      setGroupAllocatingId(null);
    } else {
      setExpandedGroupId(groupId);
      setGroupAllocatingId(null);
    }
  };

  const handleGroupAllocate = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroupId(groupId);
    setGroupAllocatingId(groupAllocatingId === groupId ? null : groupId);
  };

  const handleAllocateSuccess = () => {
    setGroupAllocatingId(null);
    onRefresh();
  };

  if (commodityGroups.length === 0 && swapTrades.length === 0) {
    return (
      <div className="rounded-lg border border-b-default bg-surface px-4 py-8 text-center text-sm text-muted">
        No trades found
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Grouped futures/options */}
      {commodityGroups.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-default bg-input-bg/50">
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted text-left">Dir</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted text-left">Month</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted text-right">Trades</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted text-right">Volume</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted text-right">VWAP</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted text-right">Allocated</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted text-right">Unalloc</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted text-left">Status</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {commodityGroups.map((cg) => (
                <CommoditySection
                  key={cg.commodityId}
                  commodityGroup={cg}
                  expandedGroupId={expandedGroupId}
                  groupAllocatingId={groupAllocatingId}
                  onToggle={toggleGroup}
                  onGroupAllocate={handleGroupAllocate}
                  onAllocateSuccess={handleAllocateSuccess}
                  commodities={commodities}
                  sites={sites}
                  orgId={orgId}
                  onRefresh={onRefresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Swaps section */}
      {swapTrades.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted px-1">
            Swaps
            <span className="ml-2 font-normal text-faint">({swapTrades.length})</span>
          </h3>
          <DataTable
            columns={swapColumns}
            data={swapTrades}
            keyField="id"
            onRowClick={(row) => setExpandedSwapId(expandedSwapId === row.id ? null : row.id)}
            expandedKey={expandedSwapId}
            renderExpandedRow={(row) => (
              <TradeDetail
                tradeId={row.id}
                commodities={commodities}
                sites={sites}
                orgId={orgId}
                onClose={() => setExpandedSwapId(null)}
                onRefresh={onRefresh}
              />
            )}
            emptyMessage="No swaps"
          />
        </div>
      )}
    </div>
  );
}

// ─── Commodity Section ──────────────────────────────────────────────────────

interface CommoditySectionProps {
  commodityGroup: { commodityId: string; commodityName: string; groups: TradeGroupSummary[] };
  expandedGroupId: string | null;
  groupAllocatingId: string | null;
  onToggle: (groupId: string) => void;
  onGroupAllocate: (groupId: string, e: React.MouseEvent) => void;
  onAllocateSuccess: () => void;
  commodities: { id: string; name: string }[];
  sites: { id: string; name: string; code: string }[];
  orgId: string;
  onRefresh: () => void;
}

function CommoditySection({
  commodityGroup: cg,
  expandedGroupId,
  groupAllocatingId,
  onToggle,
  onGroupAllocate,
  onAllocateSuccess,
  commodities,
  sites,
  orgId,
  onRefresh,
}: CommoditySectionProps) {
  const totalTrades = cg.groups.reduce((s, g) => s + g.tradeCount, 0);

  return (
    <>
      {/* Commodity header row */}
      <tr className="bg-input-bg/30">
        <td colSpan={10} className="px-4 py-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted">{cg.commodityName}</span>
          <span className="ml-2 text-[10px] text-faint">
            {totalTrades} trade{totalTrades !== 1 ? "s" : ""}
          </span>
        </td>
      </tr>

      {/* Summary rows for each direction+month group */}
      {cg.groups.map((g) => {
        const isExpanded = expandedGroupId === g.groupId;
        const isGroupAllocating = groupAllocatingId === g.groupId;
        const currency = g.trades[0]?.currency ?? "USD";

        return (
          <SummaryRow
            key={g.groupId}
            group={g}
            currency={currency}
            isExpanded={isExpanded}
            isGroupAllocating={isGroupAllocating}
            onToggle={onToggle}
            onGroupAllocate={onGroupAllocate}
            onAllocateSuccess={onAllocateSuccess}
            commodities={commodities}
            sites={sites}
            orgId={orgId}
            onRefresh={onRefresh}
          />
        );
      })}
    </>
  );
}

// ─── Summary Row + Expanded Content ─────────────────────────────────────────

interface SummaryRowProps {
  group: TradeGroupSummary;
  currency: string;
  isExpanded: boolean;
  isGroupAllocating: boolean;
  onToggle: (groupId: string) => void;
  onGroupAllocate: (groupId: string, e: React.MouseEvent) => void;
  onAllocateSuccess: () => void;
  commodities: { id: string; name: string }[];
  sites: { id: string; name: string; code: string }[];
  orgId: string;
  onRefresh: () => void;
}

function SummaryRow({
  group: g,
  currency,
  isExpanded,
  isGroupAllocating,
  onToggle,
  onGroupAllocate,
  onAllocateSuccess,
  commodities,
  sites,
  orgId,
  onRefresh,
}: SummaryRowProps) {
  return (
    <>
      <tr
        className={`cursor-pointer transition-colors hover:bg-row-hover ${isExpanded ? "bg-row-hover" : ""}`}
        onClick={() => onToggle(g.groupId)}
      >
        {/* Chevron */}
        <td className="px-2 py-3 text-center">
          <ChevronIcon expanded={isExpanded} />
        </td>

        {/* Direction */}
        <td className="px-4 py-3">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            g.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
          }`}>
            {g.direction === "long" ? "LONG" : "SHORT"}
          </span>
        </td>

        {/* Month */}
        <td className="px-4 py-3">
          <span className="tabular-nums">{formatContractMonth(g.contractMonth)}</span>
        </td>

        {/* Trade count */}
        <td className="px-4 py-3 text-right">
          <span className="tabular-nums text-muted">{g.tradeCount}</span>
        </td>

        {/* Volume */}
        <td className="px-4 py-3 text-right">
          <span className="tabular-nums font-medium">{g.totalVolume.toLocaleString()}</span>
        </td>

        {/* VWAP */}
        <td className="px-4 py-3 text-right">
          <span className="tabular-nums font-medium text-secondary">${g.vwap.toFixed(4)}</span>
        </td>

        {/* Allocated */}
        <td className="px-4 py-3 text-right">
          <span className="tabular-nums text-faint">{g.allocatedVolume.toLocaleString()}</span>
        </td>

        {/* Unallocated */}
        <td className="px-4 py-3 text-right">
          <span className={`tabular-nums ${g.unallocatedVolume > 0 ? "text-warning" : "text-faint"}`}>
            {g.unallocatedVolume.toLocaleString()}
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={g.aggregateStatus} />
        </td>

        {/* Group allocate button */}
        <td className="px-4 py-3 text-right">
          {g.unallocatedVolume > 0 && sites.length > 0 && (
            <button
              onClick={(e) => onGroupAllocate(g.groupId, e)}
              className="rounded-md border border-action-20 bg-action-10 px-2.5 py-1 text-[10px] font-medium text-action hover:bg-action-15 transition-colors"
            >
              Allocate
            </button>
          )}
        </td>
      </tr>

      {/* Expanded content */}
      {isExpanded && (
        <tr>
          <td colSpan={10} className="p-0 border-t border-tbl-border">
            <ExpandedGroupContent
              group={g}
              currency={currency}
              isGroupAllocating={isGroupAllocating}
              onAllocateSuccess={onAllocateSuccess}
              commodities={commodities}
              sites={sites}
              orgId={orgId}
              onRefresh={onRefresh}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Expanded Group Content (owns individual trade expand state) ────────────

interface ExpandedGroupContentProps {
  group: TradeGroupSummary;
  currency: string;
  isGroupAllocating: boolean;
  onAllocateSuccess: () => void;
  commodities: { id: string; name: string }[];
  sites: { id: string; name: string; code: string }[];
  orgId: string;
  onRefresh: () => void;
}

function ExpandedGroupContent({
  group: g,
  currency,
  isGroupAllocating,
  onAllocateSuccess,
  commodities,
  sites,
  orgId,
  onRefresh,
}: ExpandedGroupContentProps) {
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  const toggleTrade = (tradeId: string) => {
    setExpandedTradeId(expandedTradeId === tradeId ? null : tradeId);
  };

  const tradeColumns: Column<FinancialTrade>[] = [
    {
      key: "trade_date",
      header: "Date",
      width: "w-24",
      render: (row) => <span className="tabular-nums text-secondary">{row.trade_date?.slice(0, 10)}</span>,
    },
    {
      key: "trade_type",
      header: "Type",
      width: "w-16",
      render: (row) => {
        const styles: Record<string, { bg: string; text: string }> = {
          futures: { bg: "bg-futures-15", text: "text-futures" },
          options: { bg: "bg-action-10", text: "text-action" },
        };
        const s = styles[row.trade_type] ?? styles.futures;
        return (
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.bg} ${s.text}`}>
            {row.trade_type === "futures" ? "FUT" : "OPT"}
          </span>
        );
      },
    },
    {
      key: "num_contracts",
      header: "Lots",
      width: "w-16",
      align: "right",
      render: (row) => <span className="tabular-nums">{row.num_contracts}</span>,
    },
    {
      key: "total_volume",
      header: "Volume",
      align: "right",
      render: (row) => <span className="tabular-nums">{Number(row.total_volume).toLocaleString()}</span>,
    },
    {
      key: "trade_price",
      header: "Price",
      align: "right",
      render: (row) => {
        if (row.trade_type === "options" && row.option_type) {
          const badge = row.option_type === "call" ? "C" : "P";
          const color = row.option_type === "call" ? "text-profit" : "text-loss";
          return (
            <span className="tabular-nums text-secondary">
              <span className={`font-bold ${color}`}>{badge}</span>{" "}
              {Number(row.strike_price ?? row.trade_price).toFixed(4)}
            </span>
          );
        }
        return <span className="tabular-nums font-medium text-secondary">${Number(row.trade_price).toFixed(4)}</span>;
      },
    },
    {
      key: "broker",
      header: "Broker",
      render: (row) => <span className="text-muted text-xs">{row.broker ?? "\u2014"}</span>,
    },
    {
      key: "allocated_volume",
      header: "Alloc",
      align: "right",
      render: (row) => <span className="tabular-nums text-faint">{Number(row.allocated_volume).toLocaleString()}</span>,
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
    {
      key: "actions" as string,
      header: "",
      align: "right",
      sortable: false,
      render: (row) => {
        const unalloc = Number(row.unallocated_volume);
        if (unalloc <= 0 || row.status === "cancelled") return null;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTrade(row.id);
            }}
            className="rounded-md border border-action-20 bg-action-10 px-2.5 py-1 text-[10px] font-medium text-action hover:bg-action-15 transition-colors"
          >
            Allocate
          </button>
        );
      },
    },
  ];

  return (
    <div className="bg-surface p-4 space-y-4">
      {/* Group allocation form (Mode A) */}
      {isGroupAllocating && sites.length > 0 && (
        <GroupAllocateForm
          trades={g.trades}
          orgId={orgId}
          commodityId={g.commodityId}
          direction={g.direction}
          contractMonth={g.contractMonth}
          vwap={g.vwap}
          currency={currency}
          remainingVolume={g.unallocatedVolume}
          sites={sites}
          onSuccess={onAllocateSuccess}
        />
      )}

      {/* Individual trades sub-table */}
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted">
          Individual Trades ({g.tradeCount})
        </h4>
        <DataTable
          columns={tradeColumns}
          data={g.trades}
          keyField="id"
          onRowClick={(row) => toggleTrade(row.id)}
          expandedKey={expandedTradeId}
          renderExpandedRow={(row) => (
            <TradeDetail
              tradeId={row.id}
              commodities={commodities}
              sites={sites}
              orgId={orgId}
              onClose={() => setExpandedTradeId(null)}
              onRefresh={onRefresh}
            />
          )}
          emptyMessage="No trades"
        />
      </div>
    </div>
  );
}
