"use client";

import { useState } from "react";
import { useRollCandidates, useCommodities } from "@/hooks/usePositions";
import { CommodityFilter } from "@/components/ui/CommodityFilter";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { KPICard } from "@/components/ui/KPICard";
import { RollForm } from "@/components/positions/RollForm";
import type { RolloverCandidate } from "@/types/positions";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

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
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);
  const [rollTarget, setRollTarget] = useState<RolloverCandidate | null>(null);

  const { data, loading, refetch } = useRollCandidates(ORG_ID, selectedCommodity ?? undefined);
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Roll Candidates</h1>
        {commodities && (
          <CommodityFilter
            commodities={commodities}
            selected={selectedCommodity}
            onSelect={setSelectedCommodity}
          />
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard
          label="Critical"
          value={grouped.CRITICAL?.length ?? 0}
          subtitle="3 days or less"
          trend={(grouped.CRITICAL?.length ?? 0) > 0 ? "down" : "neutral"}
        />
        <KPICard
          label="Urgent"
          value={grouped.URGENT?.length ?? 0}
          subtitle="4-7 days"
          trend={(grouped.URGENT?.length ?? 0) > 0 ? "down" : "neutral"}
        />
        <KPICard
          label="Upcoming"
          value={grouped.UPCOMING?.length ?? 0}
          subtitle="8-21 days"
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
