"use client";

import type { NavState } from "@/types/dashboard";
import type { HierarchyLevel, OrgTreeNode } from "@/types/org";
import type { Commodity } from "@/hooks/usePositions";

interface Props {
  hierarchyLevels: HierarchyLevel[];
  orgTree: OrgTreeNode[];
  nav: NavState;
  commodities: Commodity[];
  onSelectUnit: (unitId: string) => void;
  onSelectSite: (siteId: string) => void;
  onSetCommodity: (commodityId: string | undefined) => void;
  onReset: () => void;
}

const selectCls =
  "rounded border border-b-default bg-input-bg px-2.5 py-1.5 text-xs text-secondary focus:outline-none focus:border-action transition-colors appearance-none cursor-pointer";

export function CascadingNav({
  hierarchyLevels,
  orgTree,
  nav,
  commodities,
  onSelectUnit,
  onSelectSite,
  onSetCommodity,
  onReset,
}: Props) {
  // Find node by ID anywhere in tree
  const findNode = (nodes: OrgTreeNode[], id: string): OrgTreeNode | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const found = findNode(n.children ?? [], id);
      if (found) return found;
    }
    return undefined;
  };

  // Skip Corporate root (depth=0) — show its children as top-level options
  // If all roots are at depth 0, flatten to their combined children
  const allRootsAreCorporate = orgTree.length > 0 && orgTree.every((n) => n.level_depth === 0);
  const topUnits = allRootsAreCorporate
    ? orgTree.flatMap((n) => n.children ?? [])
    : orgTree;
  const topDepth = topUnits[0]?.level_depth ?? 1;

  const selectedUnit = nav.orgUnitId ? findNode(orgTree, nav.orgUnitId) : undefined;
  const childUnits = selectedUnit?.children ?? [];
  const childSites = selectedUnit?.sites ?? [];

  // Hierarchy level labels — match actual depths shown
  const topLabel = hierarchyLevels.find((l) => l.level_depth === topDepth)?.label ?? "Region";
  const secondLabel = hierarchyLevels.find((l) => l.level_depth === topDepth + 1)?.label ?? "Area";

  return (
    <div className="flex items-center gap-2 bg-surface border border-b-default rounded-lg px-4 py-2.5 flex-wrap">
      {/* Level 1: Top-level units */}
      {topUnits.length > 0 && (
        <>
          <label className="text-[10px] uppercase tracking-wider text-faint font-medium">{topLabel}</label>
          <select
            value={nav.orgUnitId && topUnits.some((u) => u.id === nav.orgUnitId) ? nav.orgUnitId : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) onReset();
              else onSelectUnit(v);
            }}
            className={selectCls}
          >
            <option value="">All</option>
            {topUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </>
      )}

      {/* Level 2: Child units or sites */}
      {nav.orgUnitId && childUnits.length > 0 && (
        <>
          <span className="text-faint text-xs">&rsaquo;</span>
          <label className="text-[10px] uppercase tracking-wider text-faint font-medium">{secondLabel}</label>
          <select
            value={
              nav.orgUnitId && childUnits.some((u) => u.id === nav.orgUnitId) ? nav.orgUnitId :
              nav.siteId ? "" : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onSelectUnit(v);
            }}
            className={selectCls}
          >
            <option value="">All</option>
            {childUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </>
      )}

      {/* Site selector (when at leaf unit) */}
      {nav.orgUnitId && childUnits.length === 0 && childSites.length > 0 && (
        <>
          <span className="text-faint text-xs">&rsaquo;</span>
          <label className="text-[10px] uppercase tracking-wider text-faint font-medium">Site</label>
          <select
            value={nav.siteId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) onSelectUnit(nav.orgUnitId!);
              else onSelectSite(v);
            }}
            className={selectCls}
          >
            <option value="">All Sites</option>
            {childSites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Commodity filter */}
      <label className="text-[10px] uppercase tracking-wider text-faint font-medium">Commodity</label>
      <select
        value={nav.commodityId ?? ""}
        onChange={(e) => onSetCommodity(e.target.value || undefined)}
        className={selectCls}
      >
        <option value="">All Commodities</option>
        {commodities.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
