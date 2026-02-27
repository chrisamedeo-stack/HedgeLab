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

export function useDailyPrices(indexCode: string | null, days = 90) {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = useSWR<DailyPriceResponse>(
    indexCode ? `/api/v1/market-data/prices/${indexCode}/history?from=${from}&to=${to}` : null,
    (url: string) => api.get<DailyPriceResponse>(url),
    { refreshInterval: 300_000 }
  );
  const prices = Array.isArray(data) ? data : [];
  return { prices, isLoading: !data && !error, error };
}

type DailyPriceResponse = DailyPrice[] | DailyPrice;

export function useForwardCurve(indexCode: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = useSWR<ForwardPoint[]>(
    indexCode ? `/api/v1/market-data/forward-curves/${indexCode}?curveDate=${today}` : null,
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
