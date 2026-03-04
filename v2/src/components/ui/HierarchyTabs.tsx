"use client";

import type { OrgTreeNode } from "@/types/org";

interface HierarchyTabsProps {
  nodes: OrgTreeNode[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  allLabel?: string;
}

export function HierarchyTabs({
  nodes,
  selected,
  onSelect,
  allLabel,
}: HierarchyTabsProps) {
  // Dynamic "All" label from level label (e.g. "All Countries")
  const levelLabel = nodes[0]?.level_label;
  const defaultAllLabel = levelLabel ? `All ${levelLabel}s` : "All";
  const resolvedAllLabel = allLabel ?? defaultAllLabel;

  return (
    <div className="flex gap-1 rounded-lg bg-input-bg p-1">
      <button
        onClick={() => onSelect(null)}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          selected === null
            ? "bg-action-10 text-secondary"
            : "text-muted hover:text-secondary"
        }`}
      >
        {resolvedAllLabel}
      </button>
      {nodes.map((node) => {
        const siteCount = countSitesRecursive(node);
        return (
          <button
            key={node.id}
            onClick={() => onSelect(node.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selected === node.id
                ? "bg-action-10 text-secondary"
                : "text-muted hover:text-secondary"
            }`}
          >
            {node.name}
            {siteCount > 0 && (
              <span className="ml-1.5 text-xs text-faint">({siteCount})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function countSitesRecursive(node: OrgTreeNode): number {
  let count = node.sites.length;
  for (const child of node.children) {
    count += countSitesRecursive(child);
  }
  return count;
}
