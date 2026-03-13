"use client";

import { useState } from "react";
import { useHedgeBook, useCommodities, useSites } from "@/hooks/usePositions";
import { useOrgContext } from "@/contexts/OrgContext";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { HierarchyTabs } from "@/components/ui/HierarchyTabs";
import { KPICard } from "@/components/ui/KPICard";
import { TabGroup } from "@/components/ui/TabGroup";
import { SkeletonTable, SkeletonKPIGrid } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeliveryMonthTable } from "@/components/positions/DeliveryMonthTable";
import { BudgetMonthTable } from "@/components/positions/BudgetMonthTable";

function fmtVol(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function PositionManagerPage() {
  const { orgId, orgTree, selectedOrgUnit, setSelectedOrgUnit, groupingLevelLabel } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const [activeTab, setActiveTab] = useState<"delivery" | "budget">("delivery");

  const { data: hedgeBook, loading, refetch } = useHedgeBook(
    orgId,
    commodityId ?? undefined,
    undefined,
    selectedOrgUnit ?? undefined
  );
  const { data: commodities } = useCommodities();
  const { data: sites } = useSites(orgId);

  const kpis = hedgeBook?.kpis;

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Position Manager</h1>
          <p className="text-sm text-muted mt-0.5">Manage hedge allocations across delivery and budget months</p>
        </div>
      </div>

      {/* Org unit filter */}
      {orgTree.length > 0 && (
        <HierarchyTabs
          nodes={orgTree}
          selected={selectedOrgUnit}
          onSelect={setSelectedOrgUnit}
          allLabel={`All ${groupingLevelLabel}`}
        />
      )}

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Positions"
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

      {/* Tab toggle: Delivery Month vs Budget Month */}
      <TabGroup
        tabs={[
          { key: "delivery", label: "Delivery Month" },
          { key: "budget", label: "Budget Month" },
        ]}
        active={activeTab}
        onChange={(key) => setActiveTab(key as "delivery" | "budget")}
      />

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : activeTab === "delivery" ? (
        <DeliveryMonthTable
          entries={hedgeBook?.entries ?? []}
          sites={sites ?? []}
          commodities={commodities ?? []}
          orgId={orgId}
          onAllocated={refetch}
        />
      ) : (
        <BudgetMonthTable
          entries={hedgeBook?.entries ?? []}
          orgId={orgId}
          commodityId={commodityId ?? undefined}
        />
      )}
    </div>
  );
}
