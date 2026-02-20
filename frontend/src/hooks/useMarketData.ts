import useSWR from "swr";
import { api } from "@/lib/api";

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
