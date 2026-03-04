"use client";

import { useState } from "react";
import { useRollCandidates, useCommodities } from "@/hooks/usePositions";
import { CommodityFilter } from "@/components/ui/CommodityFilter";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { KPICard } from "@/components/ui/KPICard";
import { RollForm } from "@/components/positions/RollForm";
import { useOrgContext } from "@/contexts/OrgContext";
import type { RolloverCandidate } from "@/types/positions";

const urgencyColors: Record<string, string> = {
  CRITICAL: "border-loss bg-destructive-5",
  URGENT: "border-warning-30 bg-warning-5",
  UPCOMING: "border-action-30 bg-action-5",
};

const urgencyLabels: Record<string, string> = {
  CRITICAL: "Critical (3 days or less)",
  URGENT: "Urgent (4-7 days)",
  UPCOMING: "Upcoming (8-21 days)",
};

export default function RollCandidatesPage() {
  const { orgId } = useOrgContext();
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);
  const [rollTarget, setRollTarget] = useState<RolloverCandidate | null>(null);

  const { data, loading, refetch } = useRollCandidates(orgId, selectedCommodity ?? undefined);
  const { data: commodities } = useCommodities();

  const columns: Column<RolloverCandidate>[] = [
    { key: "site_name", header: "Site" },
    { key: "commodity_name", header: "Commodity" },
    { key: "contract_month", header: "Contract", width: "90px" },
    {
      key: "direction", header: "Dir", width: "50px",
      render: (r) => (
        <span className={r.direction === "long" ? "text-profit" : "text-loss"}>
          {r.direction ?? "—"}
        </span>
      ),
    },
    {
      key: "allocated_volume", header: "Volume", align: "right",
      render: (r) => r.allocated_volume.toLocaleString(),
    },
    {
      key: "trade_price", header: "Price", align: "right",
      render: (r) => r.trade_price?.toFixed(2) ?? "—",
    },
    {
      key: "days_to_last_trade", header: "Days Left", align: "right",
      render: (r) => (
        <span className={
          (r.days_to_last_trade ?? 99) <= 3 ? "font-bold text-loss" :
          (r.days_to_last_trade ?? 99) <= 7 ? "font-bold text-warning" :
          "text-secondary"
        }>
          {r.days_to_last_trade ?? "—"}
        </span>
      ),
    },
    {
      key: "actions", header: "", sortable: false, width: "80px",
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setRollTarget(r); }}
          className="rounded bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-40"
        >
          Roll
        </button>
      ),
    },
  ];

  const grouped = data?.grouped ?? {};

  return (
    <div className="space-y-6 page-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Roll Candidates</h1>
          <p className="mt-0.5 text-xs text-faint">Positions approaching contract expiry</p>
        </div>
        {commodities && (
          <CommodityFilter
            commodities={commodities}
            selected={selectedCommodity}
            onSelect={setSelectedCommodity}
          />
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard
          label="Critical"
          value={grouped.CRITICAL?.length ?? 0}
          subtitle="3 days or less"
          trend={(grouped.CRITICAL?.length ?? 0) > 0 ? "down" : "neutral"}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
        />
        <KPICard
          label="Urgent"
          value={grouped.URGENT?.length ?? 0}
          subtitle="4-7 days"
          trend={(grouped.URGENT?.length ?? 0) > 0 ? "down" : "neutral"}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KPICard
          label="Upcoming"
          value={grouped.UPCOMING?.length ?? 0}
          subtitle="8-21 days"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-faint">Loading roll candidates...</div>
      ) : (
        <div className="space-y-4">
          {(["CRITICAL", "URGENT", "UPCOMING"] as const).map((urgency) => {
            const items = grouped[urgency] ?? [];
            if (items.length === 0) return null;
            return (
              <div
                key={urgency}
                className={`rounded-lg border ${urgencyColors[urgency]}`}
              >
                <div className="border-b border-inherit px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-secondary">
                    {urgencyLabels[urgency]}
                    <span className="ml-2 text-xs font-normal text-faint">({items.length})</span>
                  </h2>
                </div>
                <DataTable<RolloverCandidate>
                  columns={columns}
                  data={items}
                />
              </div>
            );
          })}

          {(data?.candidates.length ?? 0) === 0 && (
            <div className="rounded-lg border border-b-default bg-surface py-12 text-center text-faint">
              No positions near expiry. All clear.
            </div>
          )}
        </div>
      )}

      {rollTarget && (
        <RollForm
          candidate={rollTarget}
          onClose={() => setRollTarget(null)}
          onSuccess={() => { setRollTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}
