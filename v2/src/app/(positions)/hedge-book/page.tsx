"use client";

import { useState, useMemo } from "react";
import { useHedgeBook, useSiteGroups, useCommodities, useSites } from "@/hooks/usePositions";
import { usePositionStore } from "@/store/positionStore";
import { RegionTabs } from "@/components/ui/RegionTabs";
import { CommodityFilter } from "@/components/ui/CommodityFilter";
import { KPICard } from "@/components/ui/KPICard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AllocateForm } from "@/components/positions/AllocateForm";
import type { HedgeBookEntry } from "@/types/positions";

const ORG_ID = "00000000-0000-0000-0000-000000000001"; // demo org

function fmtVol(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPrice(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export default function HedgeBookPage() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);
  const [showAllocate, setShowAllocate] = useState(false);

  const { data: hedgeBook, loading, refetch } = useHedgeBook(
    ORG_ID,
    selectedCommodity ?? undefined,
    selectedRegion ?? undefined
  );
  const { data: regions } = useSiteGroups(ORG_ID, "region");
  const { data: commodities } = useCommodities();
  const { data: sites } = useSites(ORG_ID);

  const regionTabs = useMemo(() =>
    (regions ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      siteCount: r.sites.length,
    })),
    [regions]
  );

  const columns: Column<HedgeBookEntry>[] = [
    { key: "contract_month", header: "Contract", width: "90px" },
    {
      key: "commodity_name",
      header: "Commodity",
      render: (r) => r.commodity_name ?? r.commodity_id,
    },
    { key: "site_name", header: "Site", render: (r) => r.site_name ?? "—" },
    { key: "region", header: "Region", render: (r) => r.region ?? "—" },
    {
      key: "direction",
      header: "Dir",
      width: "60px",
      render: (r) => (
        <span className={r.direction === "long" ? "text-profit" : "text-loss"}>
          {r.direction ?? "—"}
        </span>
      ),
    },
    {
      key: "allocated_volume",
      header: "Volume",
      align: "right",
      render: (r) => fmtVol(r.allocated_volume),
    },
    {
      key: "trade_price",
      header: "Price",
      align: "right",
      render: (r) => fmtPrice(r.trade_price),
    },
    { key: "budget_month", header: "Budget Mo", render: (r) => r.budget_month ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const kpis = hedgeBook?.kpis;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Hedge Book</h1>
        <button
          onClick={() => setShowAllocate(true)}
          className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
        >
          + Allocate
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <RegionTabs
          regions={regionTabs}
          selected={selectedRegion}
          onSelect={setSelectedRegion}
        />
        {commodities && (
          <CommodityFilter
            commodities={commodities}
            selected={selectedCommodity}
            onSelect={setSelectedCommodity}
          />
        )}
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-4 gap-3">
          <KPICard label="Total Allocations" value={kpis.totalAllocations} />
          <KPICard label="Open Volume" value={fmtVol(kpis.openVolume)} />
          <KPICard label="Locked Volume" value={fmtVol(kpis.lockedVolume)} />
          <KPICard label="Offset Volume" value={fmtVol(kpis.offsetVolume)} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-faint">Loading hedge book...</div>
      ) : (
        <div className="rounded-lg border border-b-default bg-surface">
          <DataTable<HedgeBookEntry>
            columns={columns}
            data={hedgeBook?.entries ?? []}
            emptyMessage="No allocations yet. Click + Allocate to create one."
          />
        </div>
      )}

      {/* Allocate Modal */}
      {showAllocate && (
        <AllocateForm
          orgId={ORG_ID}
          sites={sites ?? []}
          commodities={commodities ?? []}
          onClose={() => setShowAllocate(false)}
          onSuccess={() => {
            setShowAllocate(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
