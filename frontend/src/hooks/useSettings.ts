import useSWR from "swr";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SiteResponse {
  id: number;
  code: string;
  name: string;
  country: string;
  province: string;
}

export interface CommodityResponse {
  id: number;
  code: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  currency: string;
  hedgeable: boolean;
  active: boolean;
  description: string | null;
  icisCode: string | null;
  createdAt: string;
}

export interface AppSettingResponse {
  id: number;
  settingKey: string;
  value: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAdminSites() {
  const { data, error, mutate } = useSWR<SiteResponse[]>(
    "/api/v1/corn/sites",
    (url: string) => api.get<SiteResponse[]>(url)
  );
  return { sites: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useCommodities() {
  const { data, error, mutate } = useSWR<CommodityResponse[]>(
    "/api/v1/commodities",
    (url: string) => api.get<CommodityResponse[]>(url)
  );
  return { commodities: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useAppSettings() {
  const { data, error, mutate } = useSWR<AppSettingResponse[]>(
    "/api/v1/settings",
    (url: string) => api.get<AppSettingResponse[]>(url)
  );
  return { settings: data ?? [], isLoading: !data && !error, error, mutate };
}
