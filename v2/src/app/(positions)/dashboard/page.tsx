"use client";

import { useEffect } from "react";
import { useHedgeBook, useSites, useCommodities, useRollCandidates } from "@/hooks/usePositions";
import { useBudgetStore } from "@/store/budgetStore";
import { useDashboardData } from "@/hooks/useDashboard";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { KPICard } from "@/components/ui/KPICard";
import { CoverageWaterfallChart } from "@/components/charts/CoverageWaterfallChart";
import { CoverageMiniChart } from "@/components/charts/CoverageMiniChart";
import { PositionByMonthChart } from "@/components/charts/PositionByMonthChart";
import { ExpiringPositionsCard } from "@/components/charts/ExpiringPositionsCard";
import { CoverageGaugeChart } from "@/components/charts/CoverageGaugeChart";
import { PositionLifecycleFunnel } from "@/components/charts/PositionLifecycleFunnel";
import { DailyPnlTrendChart } from "@/components/charts/DailyPnlTrendChart";
import { PnlByCommodityChart } from "@/components/charts/PnlByCommodityChart";
import { useRiskSummary, useRiskHistory } from "@/hooks/useRisk";
import Link from "next/link";

function QuickActions() {
  const { isPluginEnabled } = useOrgContext();

  const allLinks = [
    { href: "/trades", label: "Book Trade", plugin: "trade_capture", icon: "M12 4v16m8-8H4" },
    { href: "/hedge-book", label: "Hedge Book", plugin: "position_manager", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { href: "/budget", label: "Budget", plugin: "budget", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    { href: "/coverage", label: "Coverage", plugin: null, icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { href: "/roll-candidates", label: "Roll Candidates", plugin: "position_manager", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
    { href: "/contracts", label: "Contracts", plugin: "contracts", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { href: "/risk", label: "Risk", plugin: "risk", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
    { href: "/import", label: "Import Data", plugin: "ai_import", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
  ];

  const links = allLinks.filter((l) => !l.plugin || isPluginEnabled(l.plugin));

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Quick Actions</h2>
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${Math.min(links.length, 6)} gap-2`}>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex flex-col items-center gap-2 rounded-lg border border-b-default bg-input-bg px-3 py-4 text-center text-xs font-medium text-muted hover:bg-hover hover:text-secondary transition-colors"
          >
            <svg className="h-5 w-5 text-action" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={l.icon} />
            </svg>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { orgId, isPluginEnabled } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const { data: hedgeBook, loading: hbLoading } = useHedgeBook(orgId, commodityId ?? undefined);
  const { data: sites } = useSites(orgId);
  const { data: commodities } = useCommodities();
  const { data: rollCandidatesData } = useRollCandidates(orgId, commodityId ?? undefined);
  const { periods, coverage, fetchPeriods, fetchCoverage, loading: budgetLoading } = useBudgetStore();
  const { coverageBySite, positionsByMonth } = useDashboardData(orgId, commodityId ?? undefined);

  useEffect(() => {
    fetchPeriods(orgId);
    fetchCoverage(orgId, commodityId ?? undefined);
  }, [orgId, fetchPeriods, fetchCoverage, commodityId]);

  const isLoading = hbLoading || budgetLoading;

  // KPIs
  const entries = hedgeBook?.entries ?? [];
  const openEntries = entries.filter((e) => e.status === "open");
  const totalOpenVolume = openEntries.reduce((s, e) => s + (e.allocated_volume ?? 0), 0);
  const efpEntries = entries.filter((e) => e.status === "efp_closed");
  const lockedVolume = efpEntries.reduce((s, e) => s + (e.allocated_volume ?? 0), 0);

  const coveragePct = coverage?.overallCoveragePct ?? 0;
  const totalBudgeted = coverage?.totalBudgeted ?? 0;
  const totalOpen = coverage?.totalOpen ?? 0;

  const activePeriods = periods.filter((p) => p.status !== "approved").length;

  const selectedCommodityName = commodities?.find((c) => c.id === commodityId)?.name ?? "All";

  const budgetEnabled = isPluginEnabled("budget");
  const pmEnabled = isPluginEnabled("position_manager");
  const riskEnabled = isPluginEnabled("risk");

  // Risk data (only fetch when plugin enabled)
  const { data: riskSummary } = useRiskSummary(riskEnabled ? orgId : "");
  const { data: riskHistory } = useRiskHistory(riskEnabled ? orgId : "", 30);

  const rollCandidates = rollCandidatesData?.candidates ?? [];

  if (isLoading && !hedgeBook) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-primary">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-b-default rounded-lg p-5 space-y-3 animate-pulse">
              <div className="h-3 w-24 bg-hover rounded" />
              <div className="h-7 w-16 bg-hover rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Dashboard</h1>
          <p className="mt-0.5 text-xs text-faint">
            {selectedCommodityName} overview &middot; {sites?.length ?? 0} sites
          </p>
        </div>
        <span className="text-sm text-muted tabular-nums">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Hedge Coverage"
          value={`${Number(coveragePct).toFixed(1)}%`}
          subtitle={`${Number(totalBudgeted).toLocaleString()} budgeted`}
          className={Number(coveragePct) >= 80 ? "text-profit" : Number(coveragePct) >= 50 ? "text-warning" : "text-loss"}
        />
        <KPICard
          label="Open Volume"
          value={totalOpenVolume.toLocaleString()}
          subtitle={`${openEntries.length} open allocations`}
        />
        <KPICard
          label="Locked Volume"
          value={lockedVolume.toLocaleString()}
          subtitle={`${efpEntries.length} EFP positions`}
          className="text-profit"
        />
        <KPICard
          label="Unhedged Volume"
          value={Number(totalOpen).toLocaleString()}
          subtitle={`${activePeriods} budget period${activePeriods !== 1 ? "s" : ""} in progress`}
          className={Number(totalOpen) > 0 ? "text-warning" : "text-profit"}
        />
      </div>

      {/* Coverage Waterfall Chart — full width */}
      {budgetEnabled && coverage?.byMonth && (
        <CoverageWaterfallChart data={coverage.byMonth} />
      )}

      {/* 2-col grid: Coverage Mini + Coverage Gauge / Expiring Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {budgetEnabled && (
          <CoverageMiniChart sites={coverageBySite} />
        )}
        {budgetEnabled && (
          <CoverageGaugeChart coveragePct={Number(coveragePct)} />
        )}
        {!budgetEnabled && pmEnabled && (
          <ExpiringPositionsCard candidates={rollCandidates} />
        )}
      </div>

      {/* 2-col grid: Expiring Positions + Position Lifecycle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pmEnabled && (
          <ExpiringPositionsCard candidates={rollCandidates} />
        )}
        {pmEnabled && (() => {
          const funnelTotal = entries.reduce((s, e) => s + (e.allocated_volume ?? 0), 0);
          const funnelOpen = openEntries.reduce((s, e) => s + (e.allocated_volume ?? 0), 0);
          const funnelLocked = efpEntries.reduce((s, e) => s + (e.allocated_volume ?? 0), 0);
          const funnelOffset = entries.filter((e) => e.status === "offset").reduce((s, e) => s + (e.allocated_volume ?? 0), 0);
          const funnelRolled = entries.filter((e) => e.status === "rolled").reduce((s, e) => s + (e.allocated_volume ?? 0), 0);
          return (
            <PositionLifecycleFunnel
              total={funnelTotal}
              open={funnelOpen}
              locked={funnelLocked}
              offset={funnelOffset}
              rolled={funnelRolled}
            />
          );
        })()}
      </div>

      {/* Position by Month — full width */}
      {pmEnabled && positionsByMonth.length > 0 && (
        <PositionByMonthChart data={positionsByMonth} />
      )}

      {/* Risk KPIs + Charts */}
      {riskEnabled && riskSummary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total MTM"
              value={`$${riskSummary.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              className={riskSummary.totalPnl >= 0 ? "text-profit" : "text-loss"}
            />
            <KPICard
              label="Realized P&L"
              value={`$${riskSummary.realizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              className={riskSummary.realizedPnl >= 0 ? "text-profit" : "text-loss"}
            />
            <KPICard
              label="Unrealized P&L"
              value={`$${riskSummary.unrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              className={riskSummary.unrealizedPnl >= 0 ? "text-profit" : "text-loss"}
            />
            <KPICard
              label="Net Position"
              value={riskSummary.netPosition.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              subtitle={riskSummary.netPosition > 0 ? "Long" : riskSummary.netPosition < 0 ? "Short" : "Flat"}
            />
          </div>
          <DailyPnlTrendChart data={riskHistory} />
          {riskSummary.byCommodity.length > 0 && (
            <PnlByCommodityChart data={riskSummary.byCommodity} />
          )}
        </>
      )}

      {/* Alerts */}
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Alerts</h2>
        <div className="space-y-2">
          {Number(totalOpen) > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-warning-30 bg-warning-10 px-4 py-3 text-sm">
              <svg className="h-4 w-4 text-warning shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-warning">{Number(totalOpen).toLocaleString()} unhedged volume remaining</span>
              <Link href="/coverage" className="ml-auto text-xs font-medium text-action hover:underline">View Coverage</Link>
            </div>
          )}
          {activePeriods > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-action-20 bg-action-10 px-4 py-3 text-sm">
              <svg className="h-4 w-4 text-action shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-action">{activePeriods} budget period{activePeriods !== 1 ? "s" : ""} pending approval</span>
              <Link href="/budget" className="ml-auto text-xs font-medium text-action hover:underline">View Budget</Link>
            </div>
          )}
          {rollCandidates.length > 0 && rollCandidates.some((c) => c.urgency === "CRITICAL") && (
            <div className="flex items-center gap-3 rounded-lg border border-loss/30 bg-loss/10 px-4 py-3 text-sm">
              <svg className="h-4 w-4 text-loss shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-loss">
                {rollCandidates.filter((c) => c.urgency === "CRITICAL").length} critical roll candidate{rollCandidates.filter((c) => c.urgency === "CRITICAL").length !== 1 ? "s" : ""}
              </span>
              <Link href="/roll-candidates" className="ml-auto text-xs font-medium text-action hover:underline">View Rolls</Link>
            </div>
          )}
          {Number(totalOpen) === 0 && activePeriods === 0 && rollCandidates.filter((c) => c.urgency === "CRITICAL").length === 0 && (
            <p className="text-sm text-faint py-2">No alerts at this time.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}
