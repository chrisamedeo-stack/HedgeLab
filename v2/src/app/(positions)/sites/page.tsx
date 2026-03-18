"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSites } from "@/hooks/usePositions";
import { useOrgContext } from "@/contexts/OrgContext";
import { HierarchyTabs } from "@/components/ui/HierarchyTabs";
import type { OrgTreeNode } from "@/types/org";

export default function SitesIndexPage() {
  const { orgId, orgTree, selectedOrgUnit, setSelectedOrgUnit, groupingLevelLabel } = useOrgContext();
  const { data: sites, loading } = useSites(orgId);

  // Build a set of site IDs under the selected org_unit
  const siteIdsUnderUnit = useMemo(() => {
    if (!selectedOrgUnit || !orgTree.length) return null;
    const ids = new Set<string>();
    function collectSites(node: OrgTreeNode) {
      for (const site of node.sites) ids.add(site.id);
      for (const child of node.children) collectSites(child);
    }
    // Find the selected node
    function findNode(nodes: OrgTreeNode[]): OrgTreeNode | null {
      for (const n of nodes) {
        if (n.id === selectedOrgUnit) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    }
    const node = findNode(orgTree);
    if (node) collectSites(node);
    return ids;
  }, [selectedOrgUnit, orgTree]);

  // Filter sites by selected org_unit
  const filteredSites = useMemo(() => {
    if (!sites) return [];
    if (!siteIdsUnderUnit) return sites;
    return sites.filter((s) => siteIdsUnderUnit.has(s.id));
  }, [sites, siteIdsUnderUnit]);

  // Group by parent org_unit from org tree
  const grouped = useMemo(() => {
    // Build a map of site_id → org_unit name from the tree
    const siteToGroup = new Map<string, string>();
    function mapSites(node: OrgTreeNode) {
      for (const site of node.sites) {
        siteToGroup.set(site.id, node.name);
      }
      for (const child of node.children) mapSites(child);
    }
    for (const root of orgTree) mapSites(root);

    const map: Record<string, typeof filteredSites> = {};
    for (const site of filteredSites) {
      const group = siteToGroup.get(site.id) || site.region || "Other";
      if (!map[group]) map[group] = [];
      map[group].push(site);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredSites, orgTree]);

  return (
    <div className="space-y-6 page-fade">
      <div>
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Sites</h1>
        <p className="mt-0.5 text-xs text-faint">
          Operating locations grouped by {groupingLevelLabel.toLowerCase()}
        </p>
      </div>

      {orgTree.length > 0 && (
        <HierarchyTabs
          nodes={orgTree}
          selected={selectedOrgUnit}
          onSelect={setSelectedOrgUnit}
          allLabel={`All ${groupingLevelLabel}`}
        />
      )}

      {loading ? (
        <div className="py-12 text-center text-faint">Loading sites...</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([group, groupSites]) => (
            <div key={group}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-faint">
                {group}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupSites.map((site) => (
                  <Link
                    key={site.id}
                    href={`/sites/${site.id}`}
                    className="group rounded-lg border border-b-default bg-surface p-4 transition-colors hover:border-b-input hover:bg-hover"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-secondary group-hover:text-primary">
                          {site.name}
                        </div>
                        <div className="mt-0.5 text-xs text-faint">{site.code}</div>
                      </div>
                      <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-muted">
                        {site.site_type_name}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-faint">
                      {site.operating_model} model
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="py-12 text-center text-faint">No sites found.</div>
          )}
        </div>
      )}
    </div>
  );
}
