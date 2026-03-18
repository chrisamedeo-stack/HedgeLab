"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import type { OrgTierConfig, OrgNode } from "@/types/pm";

export interface OrgScope {
  [tierLevel: number]: string | null; // null = "All"
}

interface OrgScopeContextValue {
  tiers: OrgTierConfig[];
  nodes: OrgNode[];
  scope: OrgScope;
  setTierValue: (tierLevel: number, nodeId: string | null) => void;
  resetScope: () => void;
  leafTier: OrgTierConfig | null;
  /** The deepest selected node ID (for filtering queries) */
  activeNodeId: string | null;
  /** All leaf node IDs within the current scope */
  loading: boolean;
  getChildrenOfNode: (parentId: string | null, tierLevel: number) => OrgNode[];
}

const OrgScopeContext = createContext<OrgScopeContextValue | null>(null);

export function OrgScopeProvider({ children }: { children: ReactNode }) {
  const { orgId } = useOrgContext();
  const [tiers, setTiers] = useState<OrgTierConfig[]>([]);
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [scope, setScope] = useState<OrgScope>({});
  const [loading, setLoading] = useState(true);

  // Fetch tiers and nodes
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/org/tiers?orgId=${orgId}`).then((r) => r.json()),
      fetch(`/api/org/nodes?orgId=${orgId}`).then((r) => r.json()),
    ])
      .then(([tiersData, nodesData]) => {
        setTiers(tiersData);
        setNodes(nodesData);
        // Initialize scope: tier 0 = corporate root (find it), rest = null
        const init: OrgScope = {};
        for (const t of tiersData) {
          if (t.tier_level === 0) {
            // Find the corporate root node
            const root = nodesData.find((n: OrgNode) => n.tier_level === 0 && !n.parent_id);
            init[0] = root?.id ?? null;
          } else {
            init[t.tier_level] = null;
          }
        }
        setScope(init);
      })
      .catch((err) => {
        console.error("[OrgScopeContext] Failed to load:", err);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  const setTierValue = useCallback(
    (tierLevel: number, nodeId: string | null) => {
      setScope((prev) => {
        const next = { ...prev, [tierLevel]: nodeId };
        // Reset all tiers below this one to null (cascading)
        for (const t of tiers) {
          if (t.tier_level > tierLevel) {
            next[t.tier_level] = null;
          }
        }
        return next;
      });
    },
    [tiers]
  );

  const resetScope = useCallback(() => {
    const init: OrgScope = {};
    for (const t of tiers) {
      if (t.tier_level === 0) {
        const root = nodes.find((n) => n.tier_level === 0 && !n.parent_id);
        init[0] = root?.id ?? null;
      } else {
        init[t.tier_level] = null;
      }
    }
    setScope(init);
  }, [tiers, nodes]);

  const leafTier = useMemo(
    () => tiers.find((t) => t.is_leaf) ?? null,
    [tiers]
  );

  // The deepest non-null scope value
  const activeNodeId = useMemo(() => {
    let deepest: string | null = null;
    const sortedTiers = [...tiers].sort((a, b) => b.tier_level - a.tier_level);
    for (const t of sortedTiers) {
      if (scope[t.tier_level]) {
        deepest = scope[t.tier_level];
        break;
      }
    }
    return deepest;
  }, [scope, tiers]);

  const getChildrenOfNode = useCallback(
    (parentId: string | null, tierLevel: number): OrgNode[] => {
      return nodes.filter(
        (n) => n.tier_level === tierLevel && (parentId ? n.parent_id === parentId : !n.parent_id)
      );
    },
    [nodes]
  );

  return (
    <OrgScopeContext.Provider
      value={{
        tiers,
        nodes,
        scope,
        setTierValue,
        resetScope,
        leafTier,
        activeNodeId,
        loading,
        getChildrenOfNode,
      }}
    >
      {children}
    </OrgScopeContext.Provider>
  );
}

export function useOrgScope(): OrgScopeContextValue {
  const ctx = useContext(OrgScopeContext);
  if (!ctx) throw new Error("useOrgScope must be used within OrgScopeProvider");
  return ctx;
}
