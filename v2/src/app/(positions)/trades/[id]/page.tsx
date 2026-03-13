"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useTrade } from "@/hooks/useTrades";
import { useSites } from "@/hooks/usePositions";
import { useOrgContext } from "@/contexts/OrgContext";
import { TradeAllocateForm } from "@/components/trades/TradeAllocateForm";
import { TabGroup } from "@/components/ui/TabGroup";
import { Spinner } from "@/components/ui/Spinner";
import type { Allocation } from "@/types/positions";

const statusStyle: Record<string, string> = {
  open: "bg-profit-10 text-profit",
  partially_allocated: "bg-warning-10 text-warning",
  fully_allocated: "bg-action-10 text-action",
  rolled: "bg-accent-10 text-accent",
  cancelled: "bg-destructive-10 text-destructive",
};

const allocStatusStyle: Record<string, string> = {
  open: "bg-profit-10 text-profit",
  efp_closed: "bg-action-10 text-action",
  offset: "bg-warning-10 text-warning",
  rolled: "bg-accent-10 text-accent",
  cancelled: "bg-destructive-10 text-destructive",
};

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tradeData, loading, error, refetch } = useTrade(id);
  const { orgId } = useOrgContext();
  const { data: sites } = useSites(orgId);
  const [tab, setTab] = useState<"details" | "allocations">("details");

  if (loading || !tradeData) {
    return (
      <div className="space-y-4">
        <Link href="/trades" className="flex items-center gap-1.5 text-sm text-faint hover:text-secondary transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Trades
        </Link>
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      </div>
    );
  }

  const trade = tradeData.trade;
  const allocations: Allocation[] = tradeData.allocations ?? [];
  const summary = tradeData.summary;
  const unallocated = Number(trade.unallocated_volume) || 0;

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/trades" className="flex items-center gap-1.5 text-sm text-faint hover:text-secondary transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Trades
        </Link>
        <h1 className="text-xl font-bold text-primary font-mono">
          {trade.external_ref || trade.id.slice(0, 8)}
        </h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[trade.status] ?? "bg-hover text-muted"}`}>
          {trade.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Tabs */}
      <TabGroup
        tabs={[
          { key: "details", label: "Details" },
          { key: "allocations", label: `Allocations (${allocations.length})` },
        ]}
        active={tab}
        onChange={(key) => setTab(key as "details" | "allocations")}
      />

      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {tab === "details" && (
        <div className="bg-surface border border-b-default rounded-lg p-6 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {[
            ["Type", trade.trade_type],
            ["Direction", trade.direction],
            ["Commodity", trade.commodity_name ?? trade.commodity_id],
            ["Trade Date", trade.trade_date],
            ["Contract Month", trade.contract_month],
            ["Broker", trade.broker ?? "\u2014"],
            ["Account", trade.account_number ?? "\u2014"],
            ["Contracts", String(trade.num_contracts)],
            ["Contract Size", String(trade.contract_size)],
            ["Total Volume", trade.total_volume.toLocaleString()],
            ["Trade Price", trade.trade_price != null ? `$${Number(trade.trade_price).toFixed(4)}/bu` : "\u2014"],
            ["Currency", trade.currency],
            ["Commission", trade.commission != null ? `$${Number(trade.commission).toFixed(2)}` : "\u2014"],
            ["Fees", trade.fees != null ? `$${Number(trade.fees).toFixed(2)}` : "\u2014"],
            ["Allocated Volume", `${trade.allocated_volume?.toLocaleString() ?? 0} / ${trade.total_volume.toLocaleString()}`],
            ["Unallocated", trade.unallocated_volume?.toLocaleString() ?? "\u2014"],
            ["Option Type", trade.option_type ?? "\u2014"],
            ["Strike Price", trade.strike_price != null ? `$${Number(trade.strike_price).toFixed(4)}` : "\u2014"],
            ["Premium", trade.premium != null ? `$${Number(trade.premium).toFixed(4)}` : "\u2014"],
            ["External Ref", trade.external_ref ?? "\u2014"],
            ["Notes", trade.notes ?? "\u2014"],
            ["Created", new Date(trade.created_at).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-faint uppercase tracking-wide">{label}</dt>
              <dd className="mt-0.5 text-secondary">{value}</dd>
            </div>
          ))}
        </div>
      )}

      {tab === "allocations" && (
        <div className="space-y-4">
          {/* Summary bar */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ["Total Volume", summary.totalVolume?.toLocaleString()],
                ["Allocated", summary.allocatedVolume?.toLocaleString()],
                ["Unallocated", summary.unallocatedVolume?.toLocaleString()],
                ["Allocations", String(summary.allocationCount ?? allocations.length)],
              ].map(([label, value]) => (
                <div key={label} className="bg-surface border border-b-default rounded-lg p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-faint">{label}</p>
                  <p className="mt-1 text-lg font-bold text-primary tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Inline allocation form */}
          {unallocated > 0 && trade.status !== "cancelled" && (
            sites && sites.length > 0 ? (
              <TradeAllocateForm
                tradeId={trade.id}
                orgId={trade.org_id}
                commodityId={trade.commodity_id}
                direction={trade.direction}
                contractMonth={trade.contract_month}
                tradePrice={Number(trade.trade_price)}
                tradeDate={trade.trade_date}
                currency={trade.currency}
                remainingVolume={unallocated}
                sites={sites}
                onSuccess={refetch}
              />
            ) : (
              <div className="rounded-lg border border-warning-20 bg-warning-10 px-4 py-3 text-xs text-warning">
                Loading sites...
              </div>
            )
          )}

          {/* Allocations table */}
          <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-input-bg/50 border-b border-b-default">
                <tr>
                  {["Site", "Volume", "Budget Month", "Contract Month", "Direction", "Price", "Status", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-b-default">
                {allocations.length > 0 ? allocations.map((a) => (
                  <tr key={a.id} className="hover:bg-row-hover">
                    <td className="px-4 py-2.5 font-medium text-secondary">
                      <Link href={`/sites/${a.site_id}`} className="hover:text-action hover:underline">
                        {a.site_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-secondary">{a.allocated_volume.toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-muted">{a.budget_month ?? "\u2014"}</td>
                    <td className="px-4 py-2.5 font-mono text-muted">{a.contract_month ?? "\u2014"}</td>
                    <td className="px-4 py-2.5">
                      <span className={a.direction === "long" ? "text-profit" : "text-loss"}>
                        {a.direction ?? "\u2014"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-secondary">
                      {a.trade_price != null ? `$${Number(a.trade_price).toFixed(4)}/bu` : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${allocStatusStyle[a.status] ?? "bg-hover text-muted"}`}>
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted tabular-nums">{a.allocation_date}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-faint">No allocations yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
