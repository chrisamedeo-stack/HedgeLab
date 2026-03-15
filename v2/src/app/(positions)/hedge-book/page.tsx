"use client";

import { useState, useMemo } from "react";
import { useHedgeBook, useCommodities, useSites } from "@/hooks/usePositions";
import { useOrgContext } from "@/contexts/OrgContext";
import { HierarchyTabs } from "@/components/ui/HierarchyTabs";
import { CommodityFilter } from "@/components/ui/CommodityFilter";
import { KPICard } from "@/components/ui/KPICard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AllocateForm } from "@/components/positions/AllocateForm";
import { formatContractMonth } from "@/lib/commodity-utils";
import type { HedgeBookEntry } from "@/types/positions";

function fmtVol(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtBudgetMonth(ym: string | null | undefined): string {
  if (!ym) return "—";
  const [year, month] = ym.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const idx = parseInt(month, 10) - 1;
  return idx >= 0 && idx < 12 ? `${names[idx]} ${year}` : ym;
}

function fmtPrice(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export default function HedgeBookPage() {
  const { orgId, orgTree, selectedOrgUnit, setSelectedOrgUnit, groupingLevelLabel } = useOrgContext();
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);
  const [showAllocate, setShowAllocate] = useState(false);

  const { data: hedgeBook, loading, refetch } = useHedgeBook(
    orgId,
    selectedCommodity ?? undefined,
    undefined,
    selectedOrgUnit ?? undefined
  );
  const { data: commodities } = useCommodities();
  const { data: sites } = useSites(orgId);

  const columns: Column<HedgeBookEntry>[] = [
    { key: "contract_month", header: "Contract", width: "90px", render: (r) => formatContractMonth(r.contract_month) },
    {
      key: "commodity_name",
      header: "Commodity",
      render: (r) => r.commodity_name ?? r.commodity_id,
    },
    { key: "site_name", header: "Site", render: (r) => r.site_name ?? "—" },
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
    { key: "budget_month", header: "Budget Mo", render: (r) => fmtBudgetMonth(r.budget_month) },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const kpis = hedgeBook?.kpis;

  return (
    <div className="space-y-6 page-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Hedge Book</h1>
          <p className="mt-0.5 text-xs text-faint">Allocation positions by contract month</p>
        </div>
        <button
          onClick={() => setShowAllocate(true)}
          className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
        >
          + Allocate
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {orgTree.length > 0 && (
          <HierarchyTabs
            nodes={orgTree}
            selected={selectedOrgUnit}
            onSelect={setSelectedOrgUnit}
            allLabel={`All ${groupingLevelLabel}`}
          />
        )}
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
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            label="Total Allocations"
            value={kpis.totalAllocations}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>}
          />
          <KPICard
            label="Open Volume"
            value={fmtVol(kpis.openVolume)}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>}
          />
          <KPICard
            label="Locked Volume"
            value={fmtVol(kpis.lockedVolume)}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
          />
          <KPICard
            label="Offset Volume"
            value={fmtVol(kpis.offsetVolume)}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
          />
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
          orgId={orgId}
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
