"use client";

import { useEffect } from "react";
import { usePricingStore } from "@/store/pricingStore";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export function useFormulas(orgId?: string, commodityId?: string) {
  const { formulas, loading, error, fetchFormulas } = usePricingStore();
  const org = orgId ?? DEFAULT_ORG;

  useEffect(() => {
    fetchFormulas(org, commodityId);
  }, [org, commodityId, fetchFormulas]);

  return {
    data: formulas,
    loading,
    error,
    refetch: () => fetchFormulas(org, commodityId),
  };
}

export function useRateTables(orgId?: string, commodityId?: string) {
  const { rateTables, loading, error, fetchRateTables } = usePricingStore();
  const org = orgId ?? DEFAULT_ORG;

  useEffect(() => {
    fetchRateTables(org, commodityId);
  }, [org, commodityId, fetchRateTables]);

  return {
    data: rateTables,
    loading,
    error,
    refetch: () => fetchRateTables(org, commodityId),
  };
}

export function useTemplates() {
  const { templates, error, fetchTemplates } = usePricingStore();

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    data: templates,
    error,
    refetch: fetchTemplates,
  };
}
