"use client";

import { useEffect } from "react";
import { useLogisticsStore } from "@/store/logisticsStore";
import type { DeliveryFilters } from "@/types/logistics";

export function useDeliveries(orgId: string, filters?: Partial<DeliveryFilters>) {
  const { deliveries, loading, error, fetchDeliveries } = useLogisticsStore();

  useEffect(() => {
    if (orgId) fetchDeliveries(orgId, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, JSON.stringify(filters), fetchDeliveries]);

  return {
    data: deliveries,
    loading,
    error,
    refetch: () => fetchDeliveries(orgId, filters),
  };
}

export function useInventory(params?: Record<string, string>) {
  const { inventory, loading, error, fetchInventory } = useLogisticsStore();

  useEffect(() => {
    fetchInventory(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), fetchInventory]);

  return {
    data: inventory,
    loading,
    error,
    refetch: () => fetchInventory(params),
  };
}

export { useLogisticsStore } from "@/store/logisticsStore";
