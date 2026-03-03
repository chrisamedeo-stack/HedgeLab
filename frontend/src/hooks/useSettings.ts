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

export interface SupplierResponse {
  id: number;
  code: string;
  name: string;
  country: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  active: boolean;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string | null;
  role: "ADMIN" | "RISK_MANAGER" | "TRADER" | "READ_ONLY";
  enabled: boolean;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAdminSites(slug = "corn") {
  const { data, error, mutate } = useSWR<SiteResponse[]>(
    `/api/v1/${slug}/sites`,
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

export function useSuppliers() {
  const { data, error, mutate } = useSWR<SupplierResponse[]>(
    "/api/v1/suppliers",
    (url: string) => api.get<SupplierResponse[]>(url)
  );
  return { suppliers: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useSiteSuppliers(siteId: number | null, slug = "corn") {
  const { data, error, mutate } = useSWR<SupplierResponse[]>(
    siteId ? `/api/v1/${slug}/sites/${siteId}/suppliers` : null,
    (url: string) => api.get<SupplierResponse[]>(url)
  );
  return { suppliers: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useUsers() {
  const { data, error, mutate } = useSWR<UserResponse[]>(
    "/api/v1/admin/users",
    (url: string) => api.get<UserResponse[]>(url)
  );
  return { users: data ?? [], isLoading: !data && !error, error, mutate };
}

export function useSiteCommodities(siteId: number | null, slug = "corn") {
  const { data, error, mutate } = useSWR<CommodityResponse[]>(
    siteId ? `/api/v1/${slug}/sites/${siteId}/commodities` : null,
    (url: string) => api.get<CommodityResponse[]>(url)
  );
  return { commodities: data ?? [], isLoading: !data && !error, error, mutate };
}
