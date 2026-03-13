"use client";

import { useEffect } from "react";
import { useRiskStore } from "@/store/riskStore";

export function useRiskSummary(orgId: string) {
  const { summary, loading, error, fetchSummary } = useRiskStore();

  useEffect(() => {
    if (orgId) fetchSummary(orgId);
  }, [orgId, fetchSummary]);

  return {
    data: summary,
    loading,
    error,
    refetch: () => fetchSummary(orgId),
  };
}

export function useRiskHistory(orgId: string, days?: number) {
  const { history, fetchHistory } = useRiskStore();

  useEffect(() => {
    if (orgId) fetchHistory(orgId, days);
  }, [orgId, days, fetchHistory]);

  return { data: history, refetch: () => fetchHistory(orgId, days) };
}

export function usePositionLimits(orgId: string) {
  const { limits, loading, error, fetchLimits } = useRiskStore();

  useEffect(() => {
    if (orgId) fetchLimits(orgId);
  }, [orgId, fetchLimits]);

  return {
    data: limits,
    loading,
    error,
    refetch: () => fetchLimits(orgId),
  };
}

export function useExposureByTenor(orgId: string, commodityId?: string) {
  const { exposureByTenor, fetchExposureByTenor } = useRiskStore();

  useEffect(() => {
    if (orgId) fetchExposureByTenor(orgId, commodityId);
  }, [orgId, commodityId, fetchExposureByTenor]);

  return { data: exposureByTenor, refetch: () => fetchExposureByTenor(orgId, commodityId) };
}

export function useExposureByCounterparty(orgId: string) {
  const { exposureByCounterparty, fetchExposureByCounterparty } = useRiskStore();

  useEffect(() => {
    if (orgId) fetchExposureByCounterparty(orgId);
  }, [orgId, fetchExposureByCounterparty]);

  return { data: exposureByCounterparty, refetch: () => fetchExposureByCounterparty(orgId) };
}

export function usePnlAttribution(orgId: string, commodityId?: string) {
  const { attribution, fetchAttribution } = useRiskStore();

  useEffect(() => {
    if (orgId) fetchAttribution(orgId, commodityId);
  }, [orgId, commodityId, fetchAttribution]);

  return { data: attribution, refetch: () => fetchAttribution(orgId, commodityId) };
}

export { useRiskStore } from "@/store/riskStore";
