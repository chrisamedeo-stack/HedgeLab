"use client";

import { useEffect } from "react";
import { usePlatformStore } from "@/store/platformStore";

export function usePlatformOrgs() {
  const { orgs, loading, error, fetchOrgs } = usePlatformStore();
  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);
  return { data: orgs, loading, error, refetch: fetchOrgs };
}

export function usePlatformOrg(orgId: string | null) {
  const { selectedOrg, loading, error, fetchOrg } = usePlatformStore();
  useEffect(() => {
    if (orgId) fetchOrg(orgId);
  }, [orgId, fetchOrg]);
  return { data: selectedOrg, loading, error, refetch: () => orgId ? fetchOrg(orgId) : undefined };
}

export function usePlatformStats() {
  const { stats, fetchStats } = usePlatformStore();
  useEffect(() => { fetchStats(); }, [fetchStats]);
  return { data: stats };
}
