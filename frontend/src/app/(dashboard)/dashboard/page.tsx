"use client";

import { useSites, useBudget, useCoverage, usePositions, useContracts } from "@/hooks/useCorn";
import { Skeleton } from "@/components/ui/Skeleton";
import { SetupWizard } from "./_components/setup-wizard";
import { KpiRow } from "./_components/kpi-row";
import { CoverageMini } from "./_components/coverage-mini";
import { CoverageWaterfallChart } from "./_components/coverage-waterfall-chart";
import { QuickActions } from "./_components/quick-actions";
import { AlertsPanel } from "./_components/alerts-panel";

const BUSHELS_PER_MT = 39.3683;

export default function DashboardPage() {
  const { sites, isLoading: sitesLoading } = useSites();
  const { budget, isLoading: budgetLoading } = useBudget();
  const { coverage, isLoading: coverageLoading } = useCoverage();
  const { positions, isLoading: positionsLoading } = usePositions();
  const { contracts, isLoading: contractsLoading } = useContracts();

  const isLoading = sitesLoading || budgetLoading || coverageLoading || positionsLoading || contractsLoading;

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

  // Compute KPIs
  const totalBudgetBu = budget.reduce((s, b) => s + (b.budgetVolumeBu ?? b.budgetVolumeMt * BUSHELS_PER_MT), 0);

  const totalBudgetedMt = coverage.reduce((s, c) => s + (c.budgetedMt ?? 0), 0);
  const totalHedgedMt = coverage.reduce((s, c) => s + (c.hedgedMt ?? 0), 0);
  const hedgeCoveragePct = totalBudgetedMt > 0 ? (totalHedgedMt / totalBudgetedMt) * 100 : 0;

  const openHedgeLots = positions?.hedgeBook?.reduce((s, h) => s + (h.openLots ?? 0), 0) ?? 0;

  const activeContracts = contracts.filter(
    (c) => c.status !== "CANCELLED" && c.status !== "CLOSED"
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-primary">Dashboard</h1>

      {/* Show wizard if setup is incomplete */}
      {(!hasBudget || !hasPositions) && (
        <SetupWizard hasSites={hasSites} hasBudget={hasBudget} hasPositions={hasPositions} />
      )}

      <KpiRow
        totalBudgetBu={totalBudgetBu}
        hedgeCoveragePct={hedgeCoveragePct}
        openHedgeLots={openHedgeLots}
        activeContracts={activeContracts}
      />

      <CoverageWaterfallChart coverage={coverage} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CoverageMini coverage={coverage} />
        <AlertsPanel coverage={coverage} positions={positions} contracts={contracts} />
      </div>

      <QuickActions />
    </div>
  );
}
