import { useCallback, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";

export interface PriceIndex {
  id: number;
  indexCode: string;
  displayName: string;
  commodityCode: string;
  currency: string;
  active: boolean;
}

export function usePriceIndices() {
  const { data, error } = useSWR<PriceIndex[]>(
    "/api/v1/market-data/indices",
    (url: string) => api.get<PriceIndex[]>(url),
  );
  return { indices: data ?? [], isLoading: !data && !error, error };
}

export interface DailyPrice {
  priceDate: string;
  price: string;
  priceType: string;
}

export interface ForwardPoint {
  deliveryMonth: string;
  forwardPrice: string;
}

export function useDailyPrices(priceIndexId: number | null, days = 90) {
  const { data, error } = useSWR<DailyPrice[]>(
    priceIndexId != null ? `/api/v1/market-data/prices/${priceIndexId}?days=${days}` : null,
    (url: string) => api.get<DailyPrice[]>(url),
    { refreshInterval: 300_000 }
  );
  return { prices: data ?? [], isLoading: !data && !error, error };
}

export function useForwardCurve(priceIndexId: number | null) {
  const { data, error } = useSWR<ForwardPoint[]>(
    priceIndexId != null ? `/api/v1/market-data/forward-curve/${priceIndexId}` : null,
    (url: string) => api.get<ForwardPoint[]>(url),
    { refreshInterval: 300_000 }
  );
  return { curve: data ?? [], isLoading: !data && !error, error };
}

export interface PriceFetchResult {
  status: string;
  published?: number;
  failures?: string[];
  reason?: string;
}

export function usePriceFetch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceFetchResult | null>(null);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<PriceFetchResult>("/api/v1/market-data/prices/fetch", {});
      setResult(res);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch prices";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchPrices, loading, error, result };
}
