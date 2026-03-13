"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuthSafe } from "@/contexts/AuthContext";
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
  isPlatformView: boolean;
}

const OrgContext = createContext<OrgContextValue | null>(null);

const STORAGE_KEY = "hedgelab-selected-org-unit";
const PLATFORM_ORG_KEY = "hedgelab-platform-org-id";

export function OrgProvider({ children }: { children: ReactNode }) {
  const auth = useAuthSafe();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [isPlatformView, setIsPlatformView] = useState(false);
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

  // Resolve org: platform impersonation > auth user's orgId > API fallback
  useEffect(() => {
    const platformOrgId = localStorage.getItem(PLATFORM_ORG_KEY);

    if (platformOrgId) {
      // Platform impersonation mode
      fetch(`/api/kernel/organizations?id=${platformOrgId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.exists && data.org) {
            setOrgId(data.org.id);
            setOrgName(data.org.name);
            setIsPlatformView(true);
          } else {
            localStorage.removeItem(PLATFORM_ORG_KEY);
            resolveFromAuth();
          }
        })
        .catch((err) => {
          console.error("[OrgContext] Failed to fetch platform org:", err);
          localStorage.removeItem(PLATFORM_ORG_KEY);
          resolveFromAuth();
        });
    } else {
      resolveFromAuth();
    }

    function resolveFromAuth() {
      // Use auth user's orgId if available
      if (auth?.user?.orgId) {
        setOrgId(auth.user.orgId);
        // Fetch org name
        fetch(`/api/kernel/organizations?id=${auth.user.orgId}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.exists && data.org) {
              setOrgName(data.org.name);
            }
          })
          .catch(() => {});
        return;
      }

      // Fallback: fetch default org from API
      fetch("/api/kernel/organizations")
        .then((r) => r.json())
        .then((data) => {
          if (data.exists && data.org) {
            setOrgId(data.org.id);
            setOrgName(data.org.name);
          }
        })
        .catch((err) => {
          console.error("[OrgContext] Failed to fetch org:", err);
        });
    }
  }, [auth?.user?.orgId]);

  const fetchOrgData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [pluginsRes, treeRes, levelsRes] = await Promise.all([
        fetch(`/api/kernel/org-plugins?orgId=${orgId}`),
        fetch(`/api/kernel/org-hierarchy?orgId=${orgId}`),
        fetch(`/api/kernel/org-hierarchy/levels?orgId=${orgId}`),
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
  }, [orgId]);

  useEffect(() => {
    if (orgId) fetchOrgData();
  }, [orgId, fetchOrgData]);

  const isPluginEnabled = useCallback(
    (pluginId: string) => enabledPlugins.has(pluginId),
    [enabledPlugins]
  );

  // Derive grouping level label (level just above sites)
  const groupingLevelLabel = hierarchyLevels
    .filter((l) => !l.is_site_level)
    .sort((a, b) => b.level_depth - a.level_depth)[0]?.label ?? "Region";

  if (!loaded) return null;

  // If org hasn't been resolved yet, show nothing (page-level redirect handles /setup)
  if (!orgId) {
    return loading ? null : null;
  }

  return (
    <OrgContext.Provider
      value={{
        orgId,
        orgName,
        enabledPlugins,
        orgTree,
        hierarchyLevels,
        groupingLevelLabel,
        isPluginEnabled,
        selectedOrgUnit,
        setSelectedOrgUnit,
        refreshOrgTree: fetchOrgData,
        loading,
        isPlatformView,
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

/** Safe version that returns null when outside OrgProvider (for platform admin reuse) */
export function useOrgContextSafe(): OrgContextValue | null {
  return useContext(OrgContext);
}
