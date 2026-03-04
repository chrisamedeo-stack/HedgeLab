"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { OrgTreeNode, HierarchyLevel } from "@/types/org";

interface OrgContextValue {
  orgId: string;
  orgName: string;
  enabledPlugins: Set<string>;
  orgTree: OrgTreeNode[];
  hierarchyLevels: HierarchyLevel[];
  groupingLevelLabel: string;
  isPluginEnabled: (pluginId: string) => boolean;
  selectedOrgUnit: string | null;
  setSelectedOrgUnit: (id: string | null) => void;
  refreshOrgTree: () => Promise<void>;
  loading: boolean;
}

const OrgContext = createContext<OrgContextValue | null>(null);

// Default org for demo — will be replaced by auth session
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_ORG_NAME = "HedgeLab Demo";
const STORAGE_KEY = "hedgelab-selected-org-unit";

export function OrgProvider({ children }: { children: ReactNode }) {
  const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(new Set());
  const [orgTree, setOrgTree] = useState<OrgTreeNode[]>([]);
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevel[]>([]);
  const [selectedOrgUnit, setSelectedOrgUnitState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Restore selected org unit from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedOrgUnitState(stored);
    setLoaded(true);
  }, []);

  function setSelectedOrgUnit(id: string | null) {
    setSelectedOrgUnitState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const fetchOrgData = useCallback(async () => {
    setLoading(true);
    try {
      const [pluginsRes, treeRes, levelsRes] = await Promise.all([
        fetch(`/api/v2/kernel/org-plugins?orgId=${DEFAULT_ORG_ID}`),
        fetch(`/api/v2/kernel/org-hierarchy?orgId=${DEFAULT_ORG_ID}`),
        fetch(`/api/v2/kernel/org-hierarchy/levels?orgId=${DEFAULT_ORG_ID}`),
      ]);

      if (pluginsRes.ok) {
        const plugins = await pluginsRes.json();
        const enabled = new Set<string>(
          plugins
            .filter((p: { is_enabled: boolean }) => p.is_enabled)
            .map((p: { id: string }) => p.id)
        );
        setEnabledPlugins(enabled);
      }

      if (treeRes.ok) {
        setOrgTree(await treeRes.json());
      }

      if (levelsRes.ok) {
        setHierarchyLevels(await levelsRes.json());
      }
    } catch (err) {
      console.error("[OrgContext] Failed to load org data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrgData();
  }, [fetchOrgData]);

  const isPluginEnabled = useCallback(
    (pluginId: string) => enabledPlugins.has(pluginId),
    [enabledPlugins]
  );

  // Derive grouping level label (level just above sites)
  const groupingLevelLabel = hierarchyLevels
    .filter((l) => !l.is_site_level)
    .sort((a, b) => b.level_depth - a.level_depth)[0]?.label ?? "Region";

  if (!loaded) return null;

  return (
    <OrgContext.Provider
      value={{
        orgId: DEFAULT_ORG_ID,
        orgName: DEFAULT_ORG_NAME,
        enabledPlugins,
        orgTree,
        hierarchyLevels,
        groupingLevelLabel,
        isPluginEnabled,
        selectedOrgUnit,
        setSelectedOrgUnit,
        refreshOrgTree: fetchOrgData,
        loading,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrgContext() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrgContext must be used within OrgProvider");
  return ctx;
}
