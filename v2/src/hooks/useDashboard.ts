"use client";

import { useEffect, useCallback } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import type { DashboardSummary } from "@/store/dashboardStore";
import type { DrillPathEntry, DrillLevel } from "@/types/dashboard";

export function useDashboardData(orgId: string, commodityId?: string, orgUnitId?: string) {
  const { coverageBySite, positionsByMonth, loading, error, fetchDashboardData } = useDashboardStore();

  useEffect(() => {
    if (orgId) fetchDashboardData(orgId, commodityId, orgUnitId);
  }, [orgId, commodityId, orgUnitId, fetchDashboardData]);

  return {
    coverageBySite,
    positionsByMonth,
    loading,
    error,
    refetch: () => fetchDashboardData(orgId, commodityId, orgUnitId),
  };
}

export function useDashboardSummary(orgId: string, commodityId?: string, orgUnitId?: string) {
  const { summary, loading, error, fetchDashboardSummary } = useDashboardStore();

  useEffect(() => {
    if (orgId) fetchDashboardSummary(orgId, commodityId, orgUnitId);
  }, [orgId, commodityId, orgUnitId, fetchDashboardSummary]);

  return {
    data: summary,
    loading,
    error,
    refetch: () => fetchDashboardSummary(orgId, commodityId, orgUnitId),
  };
}

// ─── Drill-Down Hook ─────────────────────────────────────────────────────────

export function useDrillDown() {
  const { drillPath, drillLevel, drillDown, drillTo, resetDrill } = useDashboardStore();

  const currentUnitId = drillPath.length > 0 && drillPath[drillPath.length - 1].type === "unit"
    ? drillPath[drillPath.length - 1].id
    : undefined;

  const currentSiteId = drillPath.length > 0 && drillPath[drillPath.length - 1].type === "site"
    ? drillPath[drillPath.length - 1].id
    : undefined;

  return {
    drillPath,
    drillLevel: drillLevel as DrillLevel,
    drillDown: drillDown as (entry: DrillPathEntry) => void,
    drillTo,
    resetDrill,
    currentUnitId,
    currentSiteId,
  };
}

// ─── Layout Hook ─────────────────────────────────────────────────────────────

export function useDashboardLayout(orgId: string) {
  const { layout, layoutLoading, fetchLayout, saveLayout, resetLayout } = useDashboardStore();

  useEffect(() => {
    if (orgId) fetchLayout(orgId);
  }, [orgId, fetchLayout]);

  const save = useCallback(
    (newLayout: typeof layout) => saveLayout(orgId, newLayout),
    [orgId, saveLayout],
  );

  const reset = useCallback(
    () => resetLayout(orgId),
    [orgId, resetLayout],
  );

  return { layout, loading: layoutLoading, save, reset };
}

// ─── Unit Summaries Hook ─────────────────────────────────────────────────────

export function useUnitSummaries(orgId: string, commodityId?: string) {
  const { unitSummaries, summariesLoading, fetchUnitSummaries } = useDashboardStore();

  useEffect(() => {
    if (orgId) fetchUnitSummaries(orgId, commodityId);
  }, [orgId, commodityId, fetchUnitSummaries]);

  return { data: unitSummaries, loading: summariesLoading };
}

// ─── Site Summaries Hook ─────────────────────────────────────────────────────

export function useSiteSummaries(orgId: string, unitId: string | undefined, commodityId?: string) {
  const { siteSummaries, summariesLoading, fetchSiteSummaries } = useDashboardStore();

  useEffect(() => {
    if (orgId && unitId) fetchSiteSummaries(orgId, unitId, commodityId);
  }, [orgId, unitId, commodityId, fetchSiteSummaries]);

  return { data: siteSummaries, loading: summariesLoading };
}

export type { DashboardSummary };
