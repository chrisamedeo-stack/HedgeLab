"use client";

import { useEffect } from "react";
import { usePmTradeStore } from "@/store/pmTradeStore";
import type { PmTradeFilters } from "@/types/pm";

export function usePmTrades(orgId: string, filters?: PmTradeFilters) {
  const { trades, total, loading, error, fetchTrades } = usePmTradeStore();

  useEffect(() => {
    if (orgId) fetchTrades(orgId, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, JSON.stringify(filters), fetchTrades]);

  return {
    data: trades,
    total,
    loading,
    error,
    refetch: () => fetchTrades(orgId, filters),
  };
}

export function usePmTrade(id: string | null) {
  const { selectedTrade, loading, error, fetchTrade } = usePmTradeStore();

  useEffect(() => {
    if (id) fetchTrade(id);
  }, [id, fetchTrade]);

  return {
    data: selectedTrade,
    loading,
    error,
    refetch: () => id && fetchTrade(id),
  };
}
