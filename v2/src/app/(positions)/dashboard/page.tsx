"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useDashboard, useDashboardNav } from "@/hooks/useDashboard";
import { useRiskHistory, usePnlAttribution } from "@/hooks/useRisk";
import { useForwardCurve } from "@/hooks/useMarket";
import { useBasisSummary, useCommodities } from "@/hooks/usePositions";
import { useCoverage } from "@/hooks/useBudget";
import { CascadingNav } from "@/components/dashboard/CascadingNav";
import { DashboardKPIs } from "@/components/dashboard/DashboardKPIs";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { ChildSummaryTable } from "@/components/dashboard/ChildSummaryTable";
import { SiteOperationalView } from "@/components/dashboard/SiteOperationalView";
import { CoverageWaterfallChart } from "@/components/charts/CoverageWaterfallChart";
import { CoverageMiniChart } from "@/components/charts/CoverageMiniChart";
import { PositionByMonthChart } from "@/components/charts/PositionByMonthChart";
import { ForwardCurveChart } from "@/components/charts/ForwardCurveChart";
import { BasisBySiteChart } from "@/components/charts/BasisBySiteChart";
import { BasisByMonthChart } from "@/components/charts/BasisByMonthChart";
import { DailyPnlTrendChart } from "@/components/charts/DailyPnlTrendChart";
import { PnlWaterfallChart } from "@/components/charts/PnlWaterfallChart";
import Link from "next/link";

function DashboardInner() {
  const { orgId, orgTree, hierarchyLevels, isPluginEnabled } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const { nav, selectUnit, selectSite, setCommodity, reset } = useDashboardNav();

  // Merge commodity context with nav
  const effectiveNav = { ...nav, commodityId: nav.commodityId ?? commodityId ?? undefined };

  // Dashboard data
  const { kpis, alerts, children, operational, coverageBySite, positionsByMonth, loading, refetch } =
    useDashboard(orgId, effectiveNav);

  // Commodities for dropdown
  const { data: commodities } = useCommodities();

  // Plugin checks
  const riskEnabled = isPluginEnabled("risk");
  const marketEnabled = isPluginEnabled("market_data");
  const pmEnabled = isPluginEnabled("position_manager");
  const budgetEnabled = isPluginEnabled("budget");

  // Risk data (only at corporate/unit levels)
  const showRisk = riskEnabled && effectiveNav.level !== "site";
  const { data: riskHistory } = useRiskHistory(showRisk ? orgId : "", 30);
  const { data: attribution } = usePnlAttribution(showRisk ? orgId : "");

  // Forward curve (only when commodity selected)
  const [curveCompareDate, setCurveCompareDate] = useState<string | undefined>();
  const showCurve = marketEnabled && effectiveNav.level !== "site" && !!effectiveNav.commodityId;
  const { data: forwardCurve } = useForwardCurve(
    showCurve ? orgId : "",
    showCurve ? effectiveNav.commodityId : undefined,
    curveCompareDate
  );

  // Basis (corporate/unit only)
  const showBasis = pmEnabled && effectiveNav.level !== "site";
  const { data: basisSummary } = useBasisSummary(
    showBasis ? orgId : "",
    effectiveNav.commodityId,
    effectiveNav.orgUnitId
  );

  // Coverage chart data (corporate/unit only)
  const showCoverage = budgetEnabled && effectiveNav.level !== "site";
  const { data: coverage } = useCoverage(
    showCoverage ? orgId : "",
    effectiveNav.commodityId
  );

  // Refresh
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const mountTime = useRef(new Date());

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [refetch]);

  // Time ago
  const [timeAgoStr, setTimeAgoStr] = useState("just now");
  useEffect(() => {
    const fmt = (d: Date) => {
      const s = Math.floor((Date.now() - d.getTime()) / 1000);
      if (s < 60) return "just now";
      const m = Math.floor(s / 60);
      return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
    };
    const tick = () => setTimeAgoStr(fmt(mountTime.current > lastUpdated ? mountTime.current : lastUpdated));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Onboarding check
  const hasNoData = !kpis || (kpis.hedgedVolume === 0 && kpis.budgetedVolume === 0 && kpis.totalPnl === 0);

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-faint tabular-nums hidden sm:inline">
            {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <span className="text-xs text-faint tabular-nums">{timeAgoStr}</span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded border border-b-default bg-input-bg p-1.5 text-muted hover:text-secondary hover:bg-hover transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <svg className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cascading Navigation */}
      <CascadingNav
        hierarchyLevels={hierarchyLevels}
        orgTree={orgTree}
        nav={effectiveNav}
        commodities={commodities ?? []}
        onSelectUnit={selectUnit}
        onSelectSite={selectSite}
        onSetCommodity={setCommodity}
        onReset={reset}
      />

      {/* KPI Row — always visible */}
      <DashboardKPIs kpis={kpis} loading={loading} />

      {/* Alerts Panel — always visible */}
      <AlertsPanel alerts={alerts} loading={loading} />

      {/* Level-Adaptive Content */}
      {effectiveNav.level !== "site" ? (
        <>
          {/* Onboarding empty state */}
          {hasNoData && !loading && effectiveNav.level === "corporate" && (
            <div className="rounded-lg border border-b-default bg-surface px-6 py-10 text-center animate-fade-in">
              <svg className="mx-auto h-8 w-8 text-faint mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <h2 className="text-sm font-semibold text-primary mb-1">Welcome to HedgeLab</h2>
              <p className="text-xs text-muted mb-5 max-w-md mx-auto">
                Create a budget period or book your first trade to get started.
              </p>
              <div className="flex items-center justify-center gap-3">
                {budgetEnabled && (
                  <Link href="/budget" className="rounded bg-action px-4 py-2 text-xs font-medium text-white hover:bg-action-hover transition-colors">
                    Create Budget
                  </Link>
                )}
                {isPluginEnabled("trade_capture") && (
                  <Link href="/trades" className="rounded border border-b-default bg-input-bg px-4 py-2 text-xs font-medium text-secondary hover:bg-hover transition-colors">
                    Book Trade
                  </Link>
                )}
                {isPluginEnabled("ai_import") && (
                  <Link href="/import" className="rounded border border-b-default bg-input-bg px-4 py-2 text-xs font-medium text-secondary hover:bg-hover transition-colors">
                    Import Data
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Comparison table */}
          <ChildSummaryTable
            children={children}
            onSelect={(child) => child.type === "unit" ? selectUnit(child.id) : selectSite(child.id)}
            loading={loading}
          />

          {/* Coverage charts */}
          {showCoverage && coverage && coverage.byMonth.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CoverageWaterfallChart data={coverage.byMonth} />
              <CoverageMiniChart sites={coverageBySite} />
            </div>
          )}

          {/* Positions by month */}
          {pmEnabled && positionsByMonth.length > 0 && (
            <PositionByMonthChart data={positionsByMonth} />
          )}

          {/* Forward curve */}
          {showCurve && forwardCurve && forwardCurve.current.length > 0 && (
            <ForwardCurveChart
              current={forwardCurve.current}
              comparison={forwardCurve.comparison}
              compareDate={forwardCurve.compareDate}
              onCompareChange={setCurveCompareDate}
            />
          )}

          {/* Basis charts */}
          {basisSummary && (basisSummary.bySite.length > 0 || basisSummary.byMonth.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {basisSummary.bySite.length > 0 && <BasisBySiteChart data={basisSummary.bySite} />}
              {basisSummary.byMonth.length > 0 && <BasisByMonthChart data={basisSummary.byMonth} />}
            </div>
          )}

          {/* Risk charts */}
          {showRisk && riskHistory && riskHistory.length > 0 && (
            <DailyPnlTrendChart data={riskHistory} />
          )}

          {showRisk && attribution && attribution.length > 0 && (
            <PnlWaterfallChart data={attribution} />
          )}
        </>
      ) : (
        /* Site: Operational view */
        <SiteOperationalView
          data={operational}
          siteId={effectiveNav.siteId!}
          commodityId={effectiveNav.commodityId}
          loading={loading}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-b-default rounded-lg p-5 space-y-3">
              <div className="h-3 w-24 rounded bg-gradient-to-r from-input-bg via-b-input to-input-bg bg-[length:200%_100%] animate-shimmer" />
              <div className="h-7 w-16 rounded bg-gradient-to-r from-input-bg via-b-input to-input-bg bg-[length:200%_100%] animate-shimmer" />
            </div>
          ))}
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
