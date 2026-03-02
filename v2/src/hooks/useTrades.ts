"use client";

import { useEffect, useCallback, useState } from "react";
import { useTradeStore } from "@/store/tradeStore";
import type { TradeFilters, TradeWithAllocations } from "@/types/trades";

// ─── Trade List ─────────────────────────────────────────────────────────────

export function useTrades(orgId: string, filters?: Partial<TradeFilters>) {
  const { trades, loading, error, fetchTrades } = useTradeStore();

  useEffect(() => {
    if (orgId) fetchTrades(orgId, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, JSON.stringify(filters), fetchTrades]);

  return {
    data: trades,
    loading,
    error,
    refetch: () => fetchTrades(orgId, filters),
  };
}

// ─── Single Trade + Allocations ─────────────────────────────────────────────

export function useTrade(tradeId: string | null) {
  const { selectedTrade, loading, error, fetchTrade } = useTradeStore();

  useEffect(() => {
    if (tradeId) fetchTrade(tradeId);
  }, [tradeId, fetchTrade]);

  return {
    data: selectedTrade,
    loading,
    error,
    refetch: () => tradeId ? fetchTrade(tradeId) : undefined,
  };
}

// ─── Contract Calendar (data-driven contract month options) ─────────────────

interface ContractMonth {
  commodity_id: string;
  contract_month: string;
  first_notice_date: string | null;
  last_trade_date: string | null;
  expiration_date: string | null;
}

export function useContractCalendar(commodityId?: string) {
  const [data, setData] = useState<ContractMonth[]>([]);
  const [loading, setLoading] = useState(false);

  const fetcher = useCallback(async () => {
    if (!commodityId) {
      setData([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ commodityId });
      const res = await fetch(`/api/kernel/contract-calendar?${params}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [commodityId]);

  useEffect(() => {
    fetcher();
  }, [fetcher]);

  return { data, loading, refetch: fetcher };
}

// ─── Trade Form State ───────────────────────────────────────────────────────

export { useTradeStore } from "@/store/tradeStore";
