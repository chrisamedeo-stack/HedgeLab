import useSWR from "swr";
import { api } from "@/lib/api";
import type { Trade, Page } from "@/types/trade";

const fetcher = (url: string) => api.get<Page<Trade>>(url);

export function useTrades(page = 0, size = 20, status?: string) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  const { data, error, mutate } = useSWR<Page<Trade>>(
    `/api/v1/trades?${params}`,
    fetcher,
    { refreshInterval: 30_000 }
  );
  return { trades: data, isLoading: !data && !error, error, mutate };
}

export function useTrade(id: number | null) {
  const { data, error, mutate } = useSWR<Trade>(
    id != null ? `/api/v1/trades/${id}` : null,
    (url: string) => api.get<Trade>(url)
  );
  return { trade: data, isLoading: !data && !error, error, mutate };
}
