"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useDashboardStore } from "@/store/dashboardStore";
import type { NavState, DrillLevel } from "@/types/dashboard";

// ─── Main Data Hook ─────────────────────────────────────────────────────────

export function useDashboard(orgId: string, nav: NavState) {
  const {
    kpis, alerts, children, operational,
    coverageBySite, positionsByMonth,
    loading, error, fetchDashboard,
  } = useDashboardStore();

  useEffect(() => {
    if (orgId) fetchDashboard(nav);
  }, [orgId, nav.level, nav.orgUnitId, nav.siteId, nav.commodityId, fetchDashboard]);

  const refetch = useCallback(() => fetchDashboard(nav), [nav, fetchDashboard]);

  return { kpis, alerts, children, operational, coverageBySite, positionsByMonth, loading, error, refetch };
}

// ─── Navigation Hook ────────────────────────────────────────────────────────

export function useDashboardNav() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setNav } = useDashboardStore();

  // Parse nav state from URL params
  const nav = useMemo<NavState>(() => {
    const siteId = searchParams.get("site") ?? undefined;
    const orgUnitId = searchParams.get("unit") ?? undefined;
    const commodityId = searchParams.get("commodity") ?? undefined;

    let level: DrillLevel = "corporate";
    if (siteId) level = "site";
    else if (orgUnitId) level = "unit";

    return { level, orgUnitId, siteId, commodityId };
  }, [searchParams]);

  // Sync store
  useEffect(() => { setNav(nav); }, [nav, setNav]);

  const updateUrl = useCallback((updates: Partial<NavState>) => {
    const next = { ...nav, ...updates };
    const params = new URLSearchParams();
    if (next.orgUnitId) params.set("unit", next.orgUnitId);
    if (next.siteId) params.set("site", next.siteId);
    if (next.commodityId) params.set("commodity", next.commodityId);
    const qs = params.toString();
    router.push(`/dashboard${qs ? `?${qs}` : ""}`);
  }, [nav, router]);

  const selectUnit = useCallback((unitId: string) => {
    updateUrl({ level: "unit", orgUnitId: unitId, siteId: undefined });
  }, [updateUrl]);

  const selectSite = useCallback((siteId: string) => {
    updateUrl({ level: "site", siteId });
  }, [updateUrl]);

  const setCommodity = useCallback((commodityId: string | undefined) => {
    updateUrl({ commodityId });
  }, [updateUrl]);

  const reset = useCallback(() => {
    updateUrl({ level: "corporate", orgUnitId: undefined, siteId: undefined });
  }, [updateUrl]);

  const setLevel = useCallback((level: DrillLevel, id?: string) => {
    if (level === "corporate") reset();
    else if (level === "unit" && id) selectUnit(id);
    else if (level === "site" && id) selectSite(id);
  }, [reset, selectUnit, selectSite]);

  return { nav, setLevel, selectUnit, selectSite, setCommodity, reset };
}
