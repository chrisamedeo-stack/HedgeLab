"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import type { OrgTreeNode, HierarchyLevel, CustomerProfile, NavSection } from "@/types/org";

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

// ─── Org Tree ────────────────────────────────────────────────────────────

export function useOrgTree(orgId?: string) {
  return useFetch<OrgTreeNode[]>(async () => {
    if (!orgId) return [];
    const res = await fetch(`${API_BASE}/api/kernel/org-hierarchy?orgId=${orgId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, [orgId]);
}

// ─── Enabled Plugins ────────────────────────────────────────────────────

interface PluginStatus {
  id: string;
  name: string;
  is_enabled: boolean;
  nav_section: string | null;
  nav_label: string | null;
  nav_href: string | null;
  sort_order: number;
  depends_on: string[];
  description: string | null;
}

export function useEnabledPlugins(orgId?: string) {
  return useFetch<PluginStatus[]>(async () => {
    if (!orgId) return [];
    const res = await fetch(`${API_BASE}/api/kernel/org-plugins?orgId=${orgId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, [orgId]);
}

// ─── Nav Config ─────────────────────────────────────────────────────────

export function useNavConfig(orgId?: string) {
  return useFetch<NavSection[]>(async () => {
    if (!orgId) return [];
    const res = await fetch(`${API_BASE}/api/kernel/org-plugins?orgId=${orgId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    const plugins: PluginStatus[] = await res.json();

    // Build nav sections from enabled plugins
    const sectionMap = new Map<string, { href: string; label: string; pluginId: string; sort: number }[]>();
    const sectionOrder: string[] = [];

    for (const p of plugins) {
      if (!p.is_enabled || !p.nav_section || !p.nav_href || !p.nav_label) continue;
      if (!sectionMap.has(p.nav_section)) {
        sectionMap.set(p.nav_section, []);
        sectionOrder.push(p.nav_section);
      }
      sectionMap.get(p.nav_section)!.push({
        href: p.nav_href,
        label: p.nav_label,
        pluginId: p.id,
        sort: p.sort_order,
      });
    }

    return sectionOrder.map((label) => ({
      label,
      items: sectionMap
        .get(label)!
        .sort((a, b) => a.sort - b.sort)
        .map(({ href, label: itemLabel, pluginId }) => ({ href, label: itemLabel, pluginId })),
    }));
  }, [orgId]);
}

// ─── Hierarchy Levels ───────────────────────────────────────────────────

export function useHierarchyLevels(orgId?: string) {
  return useFetch<HierarchyLevel[]>(async () => {
    if (!orgId) return [];
    const res = await fetch(`${API_BASE}/api/kernel/org-hierarchy/levels?orgId=${orgId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, [orgId]);
}

// ─── Customer Profiles ──────────────────────────────────────────────────

export function useCustomerProfiles() {
  return useFetch<CustomerProfile[]>(async () => {
    const res = await fetch(`${API_BASE}/api/kernel/customer-profiles`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, []);
}
