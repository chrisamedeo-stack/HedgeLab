"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSites, useCommodities } from "@/hooks/usePositions";
import { useDashboardSummary, useDrillDown, useDashboardLayout, useUnitSummaries, useSiteSummaries } from "@/hooks/useDashboard";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { useRiskSummary, useRiskHistory, usePnlAttribution } from "@/hooks/useRisk";
import { useForwardCurve } from "@/hooks/useMarket";
import { useBasisSummary } from "@/hooks/usePositions";
import { getWidgetsForLevel } from "@/lib/widgetRegistry";
import { DashboardBreadcrumb } from "@/components/dashboard/DashboardBreadcrumb";
import { QuickActionsStrip } from "@/components/dashboard/QuickActionsStrip";
import { DashboardCustomizePanel } from "@/components/dashboard/DashboardCustomizePanel";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import Link from "next/link";

export default function DashboardPage() {
  const { orgId, orgTree, isPluginEnabled } = useOrgContext();
  const { commodityId } = useCommodityContext();

  // Drill-down state
  const { drillPath, drillLevel, drillDown, drillTo, resetDrill, currentUnitId, currentSiteId } = useDrillDown();

  // Determine orgUnitId for data fetching based on drill path
  const orgUnitId = currentUnitId ?? undefined;

  // Dashboard data
  const { data: summary, loading, refetch } = useDashboardSummary(orgId, commodityId ?? undefined, orgUnitId);
  const { data: sites } = useSites(orgId);
  const { data: commodities } = useCommodities();

  // Layout
  const { layout, save: saveLayout, reset: resetLayout } = useDashboardLayout(orgId);

  // Drill-down summaries
  const { data: unitSummaries, loading: unitLoading } = useUnitSummaries(orgId, commodityId ?? undefined);
  const { data: siteSummaries, loading: siteLoading } = useSiteSummaries(orgId, currentUnitId, commodityId ?? undefined);

  // Flat org edge case: no org_units → show sites directly at corporate level
  const isFlatOrg = orgTree.length === 0;

  // Plugin checks
  const riskEnabled = isPluginEnabled("risk");
  const marketEnabled = isPluginEnabled("market_data");
  const pmEnabled = isPluginEnabled("position_manager");
  const budgetEnabled = isPluginEnabled("budget");

  // Risk data
  const { data: riskSummary } = useRiskSummary(riskEnabled ? orgId : "");
  const { data: riskHistory } = useRiskHistory(riskEnabled ? orgId : "", 30);
  const { data: attribution } = usePnlAttribution(riskEnabled ? orgId : "");

  // Forward curve
  const [curveCompareDate, setCurveCompareDate] = useState<string | undefined>();
  const { data: forwardCurve } = useForwardCurve(
    marketEnabled ? orgId : "",
    marketEnabled && commodityId ? commodityId : undefined,
    curveCompareDate
  );

  // Basis
  const { data: basisSummary } = useBasisSummary(pmEnabled ? orgId : "", commodityId ?? undefined, orgUnitId);

  // Customization panel
  const [customizeOpen, setCustomizeOpen] = useState(false);

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

  const selectedCommodityName = commodities?.find((c) => c.id === commodityId)?.name ?? "All";

  // Resolved widgets for current level
  const activeWidgets = getWidgetsForLevel(layout, drillLevel, isPluginEnabled);

  // Drill handlers
  const handleDrillUnit = (id: string, name: string) => drillDown({ id, name, type: "unit" });
  const handleDrillSite = (id: string, name: string) => drillDown({ id, name, type: "site" });

  // Onboarding check
  const entries = summary?.hedgeBook?.entries ?? [];
  const totalBudgeted = summary?.coverage?.totalBudgeted ?? 0;
  const rollCandidates = summary?.rollCandidates?.candidates ?? [];
  const trades = summary?.trades ?? [];
  const hasNoData = entries.length === 0 && totalBudgeted === 0 && rollCandidates.length === 0 && trades.length === 0;

  // Loading skeleton
  if (loading && !summary) {
    return (
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
        <div className="h-48 rounded-lg bg-gradient-to-r from-input-bg via-b-input to-input-bg bg-[length:200%_100%] animate-shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-fade">
      {/* Header + Quick Actions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Dashboard</h1>
            <p className="mt-0.5 text-xs text-faint">
              {selectedCommodityName} &middot; {sites?.length ?? 0} sites
            </p>
          </div>
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
            <button
              onClick={() => setCustomizeOpen(true)}
              className="rounded border border-b-default bg-input-bg p-1.5 text-muted hover:text-secondary hover:bg-hover transition-colors"
              title="Customize dashboard"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        <QuickActionsStrip />
      </div>

      {/* Breadcrumb */}
      <DashboardBreadcrumb path={drillPath} onNavigate={drillTo} />

      {/* Onboarding empty state */}
      {hasNoData && !loading && drillLevel === "corporate" && (
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

      {/* Widget Renderer */}
      <WidgetRenderer
        widgets={activeWidgets}
        drillLevel={drillLevel}
        summary={summary}
        unitSummaries={isFlatOrg ? [] : unitSummaries}
        siteSummaries={siteSummaries}
        summariesLoading={unitLoading || siteLoading}
        onDrillUnit={handleDrillUnit}
        onDrillSite={handleDrillSite}
        riskSummary={riskSummary}
        riskHistory={riskHistory}
        attribution={attribution}
        forwardCurve={forwardCurve}
        onCurveCompareChange={setCurveCompareDate}
        basisSummary={basisSummary}
        orgId={orgId}
        currentSiteId={currentSiteId}
        currentUnitId={currentUnitId}
        commodityId={commodityId ?? undefined}
      />

      {/* Customize Panel */}
      <DashboardCustomizePanel
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        layout={layout}
        onSave={saveLayout}
        onReset={resetLayout}
        drillLevel={drillLevel}
        isPluginEnabled={isPluginEnabled}
      />
    </div>
  );
}
