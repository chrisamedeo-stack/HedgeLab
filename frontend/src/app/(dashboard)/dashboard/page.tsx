"use client";

import { useState } from "react";
import { useSites, useBudget, useCoverage, usePositions, useContracts } from "@/hooks/useCorn";
import { useAdminSites } from "@/hooks/useSettings";
import { Skeleton } from "@/components/ui/Skeleton";
import { SetupWizard } from "./_components/setup-wizard";
import { KpiRow } from "./_components/kpi-row";
import { CoverageMini } from "./_components/coverage-mini";
import { CoverageWaterfallChart } from "./_components/coverage-waterfall-chart";
import { QuickActions } from "./_components/quick-actions";
import { AlertsPanel } from "./_components/alerts-panel";
import { DashboardBreadcrumb, ViewLevel } from "./_components/breadcrumb";
import { CountryCards } from "./_components/country-cards";
import { CountryView } from "./_components/country-view";
import { SiteView } from "./_components/site-view";
import { aggregateMtm, SiteWithCountry } from "@/lib/dashboard-aggregation";

const BUSHELS_PER_MT = 39.3683;

export default function DashboardPage() {
  const { sites, isLoading: sitesLoading } = useSites();
  const { sites: adminSites, isLoading: adminSitesLoading } = useAdminSites();
  const { budget, isLoading: budgetLoading } = useBudget();
  const { coverage, isLoading: coverageLoading } = useCoverage();
  const { positions, isLoading: positionsLoading } = usePositions();
  const { contracts, isLoading: contractsLoading } = useContracts();

  // Drill-down state
  const [viewLevel, setViewLevel] = useState<ViewLevel>("company");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  const isLoading = sitesLoading || adminSitesLoading || budgetLoading || coverageLoading || positionsLoading || contractsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-primary">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-b-default rounded-lg p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  const hasSites = sites.length > 0;
  const hasBudget = budget.length > 0;
  const hasPositions = (positions?.hedgeBook?.length ?? 0) > 0;

  // Show setup wizard if no sites configured
  if (!hasSites) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-primary">Dashboard</h1>
        <SetupWizard hasSites={hasSites} hasBudget={hasBudget} hasPositions={hasPositions} />
      </div>
    );
  }

  // Use adminSites (which has the country field) for grouping
  const sitesWithCountry: SiteWithCountry[] = adminSites.length > 0 ? adminSites : sites;

  // Navigation handlers
  function handleSelectCountry(country: string) {
    setSelectedCountry(country);
    setSelectedSite(null);
    setViewLevel("country");
  }

  function handleSelectSite(siteCode: string) {
    setSelectedSite(siteCode);
    setViewLevel("site");
  }

  function handleBreadcrumbNavigate(level: ViewLevel) {
    setViewLevel(level);
    if (level === "company") {
      setSelectedCountry(null);
      setSelectedSite(null);
    } else if (level === "country") {
      setSelectedSite(null);
    }
  }

  const selectedSiteName = selectedSite
    ? (sitesWithCountry.find((s) => s.code === selectedSite)?.name ?? selectedSite)
    : null;

  // Company-level KPIs
  const totalBudgetBu = budget.reduce((s, b) => s + (b.budgetVolumeBu ?? b.budgetVolumeMt * BUSHELS_PER_MT), 0);
  const totalBudgetedMt = coverage.reduce((s, c) => s + (c.budgetedMt ?? 0), 0);
  const totalHedgedMt = coverage.reduce((s, c) => s + (c.hedgedMt ?? 0), 0);
  const hedgeCoveragePct = totalBudgetedMt > 0 ? (totalHedgedMt / totalBudgetedMt) * 100 : 0;
  const openHedgeLots = positions?.hedgeBook?.reduce((s, h) => s + (h.openLots ?? 0), 0) ?? 0;
  const portfolioMtm = aggregateMtm(positions?.hedgeBook);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Dashboard</h1>
      </div>

      {viewLevel !== "company" && (
        <DashboardBreadcrumb
          viewLevel={viewLevel}
          selectedCountry={selectedCountry}
          selectedSiteName={selectedSiteName}
          onNavigate={handleBreadcrumbNavigate}
        />
      )}

      {/* Show wizard if setup is incomplete */}
      {(!hasBudget || !hasPositions) && viewLevel === "company" && (
        <SetupWizard hasSites={hasSites} hasBudget={hasBudget} hasPositions={hasPositions} />
      )}

      {/* ─── Company View ─────────────────────────────────────────────────── */}
      {viewLevel === "company" && (
        <>
          <KpiRow
            cards={[
              { label: "Total Budget", value: totalBudgetBu, unit: "bu" },
              { label: "Hedge Coverage", value: hedgeCoveragePct, unit: "pct" },
              { label: "Open Hedge Lots", value: openHedgeLots, unit: "count" },
              { label: "Portfolio MTM", value: portfolioMtm, unit: "usd" },
            ]}
          />

          <CountryCards
            coverage={coverage}
            sites={sitesWithCountry}
            hedgeBook={positions?.hedgeBook}
            onSelectCountry={handleSelectCountry}
          />

          <CoverageWaterfallChart coverage={coverage} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CoverageMini coverage={coverage} sites={sitesWithCountry} />
            <AlertsPanel coverage={coverage} positions={positions} contracts={contracts} />
          </div>

          <QuickActions />
        </>
      )}

      {/* ─── Country View ─────────────────────────────────────────────────── */}
      {viewLevel === "country" && selectedCountry && (
        <CountryView
          country={selectedCountry}
          coverage={coverage}
          positions={positions}
          contracts={contracts}
          sites={sitesWithCountry}
          budget={budget}
          onSelectSite={handleSelectSite}
        />
      )}

      {/* ─── Site View ────────────────────────────────────────────────────── */}
      {viewLevel === "site" && selectedSite && (
        <SiteView
          siteCode={selectedSite}
          coverage={coverage}
          positions={positions}
          contracts={contracts}
          budget={budget}
          sites={sitesWithCountry}
        />
      )}
    </div>
  );
}
