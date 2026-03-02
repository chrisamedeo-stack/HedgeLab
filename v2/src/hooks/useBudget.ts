"use client";

import { useEffect } from "react";
import { useBudgetStore } from "@/store/budgetStore";
import type { BudgetFilters } from "@/types/budget";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export function useBudgetPeriods(orgId?: string, filters?: BudgetFilters) {
  const { periods, loading, error, fetchPeriods } = useBudgetStore();
  const org = orgId ?? DEFAULT_ORG;

  useEffect(() => {
    fetchPeriods(org, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, JSON.stringify(filters), fetchPeriods]);

  return {
    data: periods,
    loading,
    error,
    refetch: () => fetchPeriods(org, filters),
  };
}

export function useBudgetPeriod(periodId: string | null) {
  const { selectedPeriod, loading, error, fetchPeriod } = useBudgetStore();

  useEffect(() => {
    if (periodId) fetchPeriod(periodId);
  }, [periodId, fetchPeriod]);

  return {
    data: selectedPeriod,
    loading,
    error,
    refetch: () => periodId ? fetchPeriod(periodId) : undefined,
  };
}

export function useCoverage(orgId?: string, commodityId?: string, siteId?: string) {
  const { coverage, loading, error, fetchCoverage } = useBudgetStore();
  const org = orgId ?? DEFAULT_ORG;

  useEffect(() => {
    fetchCoverage(org, commodityId, siteId);
  }, [org, commodityId, siteId, fetchCoverage]);

  return {
    data: coverage,
    loading,
    error,
    refetch: () => fetchCoverage(org, commodityId, siteId),
  };
}

export function useBudgetVersions(periodId: string | null) {
  const { versions, fetchVersions } = useBudgetStore();

  useEffect(() => {
    if (periodId) fetchVersions(periodId);
  }, [periodId, fetchVersions]);

  return { data: versions, refetch: () => periodId ? fetchVersions(periodId) : undefined };
}
