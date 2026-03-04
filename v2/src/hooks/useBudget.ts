"use client";

import { useEffect } from "react";
import { useBudgetStore } from "@/store/budgetStore";
import type { BudgetFilters } from "@/types/budget";

export function useBudgetPeriods(orgId: string, filters?: BudgetFilters) {
  const { periods, loading, error, fetchPeriods } = useBudgetStore();

  useEffect(() => {
    if (orgId) fetchPeriods(orgId, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, JSON.stringify(filters), fetchPeriods]);

  return {
    data: periods,
    loading,
    error,
    refetch: () => fetchPeriods(orgId, filters),
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

export function useCoverage(orgId: string, commodityId?: string, siteId?: string) {
  const { coverage, loading, error, fetchCoverage } = useBudgetStore();

  useEffect(() => {
    if (orgId) fetchCoverage(orgId, commodityId, siteId);
  }, [orgId, commodityId, siteId, fetchCoverage]);

  return {
    data: coverage,
    loading,
    error,
    refetch: () => fetchCoverage(orgId, commodityId, siteId),
  };
}

export function useBudgetVersions(periodId: string | null) {
  const { versions, fetchVersions } = useBudgetStore();

  useEffect(() => {
    if (periodId) fetchVersions(periodId);
  }, [periodId, fetchVersions]);

  return { data: versions, refetch: () => periodId ? fetchVersions(periodId) : undefined };
}
