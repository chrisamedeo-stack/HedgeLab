"use client";

import { useEffect } from "react";
import { usePricingStore } from "@/store/pricingStore";

export function useFormulas(orgId: string, commodityId?: string) {
  const { formulas, loading, error, fetchFormulas } = usePricingStore();

  useEffect(() => {
    if (orgId) fetchFormulas(orgId, commodityId);
  }, [orgId, commodityId, fetchFormulas]);

  return {
    data: formulas,
    loading,
    error,
    refetch: () => fetchFormulas(orgId, commodityId),
  };
}

export function useRateTables(orgId: string, commodityId?: string) {
  const { rateTables, loading, error, fetchRateTables } = usePricingStore();

  useEffect(() => {
    if (orgId) fetchRateTables(orgId, commodityId);
  }, [orgId, commodityId, fetchRateTables]);

  return {
    data: rateTables,
    loading,
    error,
    refetch: () => fetchRateTables(orgId, commodityId),
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
