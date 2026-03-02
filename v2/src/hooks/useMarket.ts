"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/store/marketStore";
import type { PriceFilters } from "@/types/market";

// ─── Price List ─────────────────────────────────────────────────────────────

export function usePrices(filters?: PriceFilters) {
  const { prices, loading, error, fetchPrices } = useMarketStore();

  useEffect(() => {
    fetchPrices(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), fetchPrices]);

  return {
    data: prices,
    loading,
    error,
    refetch: () => fetchPrices(filters),
  };
}

// ─── Latest Prices (for open board integration) ─────────────────────────────

export function useLatestPrices(commodityId?: string) {
  const { latestPrices, loading, error, fetchLatestPrices } = useMarketStore();

  useEffect(() => {
    if (commodityId) fetchLatestPrices(commodityId);
  }, [commodityId, fetchLatestPrices]);

  return {
    data: latestPrices,
    loading,
    error,
    refetch: () => commodityId ? fetchLatestPrices(commodityId) : undefined,
  };
}

// ─── Re-export store for direct access ──────────────────────────────────────

export { useMarketStore } from "@/store/marketStore";
