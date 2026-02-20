import useSWR from "swr";
import { api } from "@/lib/api";
import type { CreditUtilization } from "@/types/risk";

export function useCreditAlerts() {
  const { data, error, mutate } = useSWR<CreditUtilization[]>(
    "/api/v1/risk/credit-utilizations/alerts",
    (url: string) => api.get<CreditUtilization[]>(url),
    { refreshInterval: 60_000 }
  );
  return { alerts: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useCreditUtilization(counterpartyId: number | null) {
  const { data, error } = useSWR<CreditUtilization>(
    counterpartyId != null ? `/api/v1/risk/credit-utilizations/${counterpartyId}` : null,
    (url: string) => api.get<CreditUtilization>(url)
  );
  return { utilization: data, isLoading: !data && !error, error };
}
