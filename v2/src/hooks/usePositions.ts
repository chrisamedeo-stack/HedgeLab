"use client";

import { useEffect, useCallback, useState } from "react";
import { API_BASE } from "@/lib/api";
import { usePositionStore } from "@/store/positionStore";

// ─── Shared fetch hook pattern ───────────────────────────────────────────────

function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ─── Hedge Book ──────────────────────────────────────────────────────────────

export function useHedgeBook(orgId: string, commodityId?: string, regionGroupId?: string, orgUnitId?: string) {
  const { hedgeBook, loading, error, fetchHedgeBook } = usePositionStore();

  useEffect(() => {
    if (orgId) fetchHedgeBook(orgId, commodityId, regionGroupId, orgUnitId);
  }, [orgId, commodityId, regionGroupId, orgUnitId, fetchHedgeBook]);

  return {
    data: hedgeBook,
    loading,
    error,
    refetch: () => fetchHedgeBook(orgId, commodityId, regionGroupId, orgUnitId),
  };
}

// ─── Site View ───────────────────────────────────────────────────────────────

export function useSiteView(siteId: string | null, commodityId?: string) {
  const { siteView, loading, error, fetchSiteView } = usePositionStore();

  useEffect(() => {
    if (siteId) fetchSiteView(siteId, commodityId);
  }, [siteId, commodityId, fetchSiteView]);

  return {
    data: siteView,
    loading,
    error,
    refetch: () => siteId ? fetchSiteView(siteId, commodityId) : undefined,
  };
}

// ─── Allocations ─────────────────────────────────────────────────────────────

export function useAllocations(params?: Record<string, string>) {
  const { allocations, loading, error, fetchAllocations } = usePositionStore();

  useEffect(() => {
    fetchAllocations(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), fetchAllocations]);

  return {
    data: allocations,
    loading,
    error,
    refetch: () => fetchAllocations(params),
  };
}

// ─── Physicals ───────────────────────────────────────────────────────────────

export function usePhysicals(params?: Record<string, string>) {
  const { physicals, loading, error, fetchPhysicals } = usePositionStore();

  useEffect(() => {
    fetchPhysicals(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), fetchPhysicals]);

  return {
    data: physicals,
    loading,
    error,
    refetch: () => fetchPhysicals(params),
  };
}

// ─── Roll Candidates ─────────────────────────────────────────────────────────

export function useRollCandidates(orgId: string, commodityId?: string, orgUnitId?: string) {
  const { rollCandidates, loading, error, fetchRollCandidates } = usePositionStore();

  useEffect(() => {
    if (orgId) fetchRollCandidates(orgId, commodityId, orgUnitId);
  }, [orgId, commodityId, orgUnitId, fetchRollCandidates]);

  return {
    data: rollCandidates,
    loading,
    error,
    refetch: () => fetchRollCandidates(orgId, commodityId, orgUnitId),
  };
}

// ─── Basis Summary ───────────────────────────────────────────────────────────

export function useBasisSummary(orgId: string, commodityId?: string, orgUnitId?: string) {
  const { basisSummary, fetchBasisSummary } = usePositionStore();

  useEffect(() => {
    if (orgId) fetchBasisSummary(orgId, commodityId, orgUnitId);
  }, [orgId, commodityId, orgUnitId, fetchBasisSummary]);

  return {
    data: basisSummary,
    refetch: () => fetchBasisSummary(orgId, commodityId, orgUnitId),
  };
}

// ─── Site Groups (data-driven regions) ───────────────────────────────────────

interface SiteGroup {
  id: string;
  name: string;
  group_type: string;
  sites: { id: string; name: string; code: string; region: string }[];
}

/**
 * @deprecated Use useOrgTree() from useOrgHierarchy.ts instead.
 * Site groups are replaced by org_units hierarchy.
 */
export function useSiteGroups(orgId?: string, groupType?: string) {
  if (typeof window !== "undefined") {
    console.warn("[useSiteGroups] Deprecated — use useOrgTree() from useOrgHierarchy.ts");
  }
  return useFetch<SiteGroup[]>(async () => {
    const params = new URLSearchParams();
    if (orgId) params.set("orgId", orgId);
    if (groupType) params.set("type", groupType);
    const res = await fetch(`${API_BASE}/api/kernel/site-groups?${params}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, [orgId, groupType]);
}

// ─── Commodities ─────────────────────────────────────────────────────────────

export interface CommodityUnit {
  id: string;
  unit_name: string;
  abbreviation: string;
  to_trade_unit: number;
  from_trade_unit: number;
  is_default_report: boolean;
  sort_order: number;
}

export interface Commodity {
  id: string;
  name: string;
  category: string;
  unit: string;
  currency: string;
  exchange: string;
  price_unit?: string;
  volume_unit?: string;
  contract_size?: number;
  contract_months?: string;
  decimal_places?: number;
  is_active?: boolean;
  tick_size?: number;
  tick_value?: number;
  // New commodity config columns
  display_name?: string;
  commodity_class?: string;
  ticker_root?: string;
  trade_price_unit?: string;
  trade_volume_unit?: string;
  price_decimal_places?: number;
  point_value?: number;
  basis_unit?: string;
  basis_reference?: string;
  // Reporting units (from commodity_units table)
  units?: CommodityUnit[];
  config?: {
    month_mappings?: Record<string, number[]>;
    futures_prefix?: string;
    units_per_mt?: number;
    /** @deprecated Use units_per_mt instead */
    bushels_per_mt?: number;
  };
}

export function useCommodities() {
  return useFetch<Commodity[]>(async () => {
    const res = await fetch(`${API_BASE}/api/kernel/commodities`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, []);
}

// ─── Sites ───────────────────────────────────────────────────────────────────

interface Site {
  id: string;
  name: string;
  code: string;
  region: string;
  site_type_name: string;
  operating_model: string;
}

export function useSites(orgId?: string) {
  return useFetch<Site[]>(async () => {
    const params = new URLSearchParams();
    if (orgId) params.set("orgId", orgId);
    const res = await fetch(`${API_BASE}/api/kernel/sites?${params}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, [orgId]);
}
