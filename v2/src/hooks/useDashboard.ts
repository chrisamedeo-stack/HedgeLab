"use client";

import { useEffect } from "react";
import { useDashboardStore } from "@/store/dashboardStore";

export function useDashboardData(orgId: string, commodityId?: string) {
  const { coverageBySite, positionsByMonth, loading, error, fetchDashboardData } = useDashboardStore();

  useEffect(() => {
    if (orgId) fetchDashboardData(orgId, commodityId);
  }, [orgId, commodityId, fetchDashboardData]);

  return {
    coverageBySite,
    positionsByMonth,
    loading,
    error,
    refetch: () => fetchDashboardData(orgId, commodityId),
  };
}
