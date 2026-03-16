"use client";

import React from "react";
import { ChevronRight, Globe, Trash2 } from "lucide-react";
import { cn } from "../shared";
import type { OrgTreeNode, SiteRef } from "@/types/org";

export type SelectedNode =
  | { type: "unit"; id: string; node: OrgTreeNode }
  | { type: "site"; id: string; site: SiteRef; parentUnitId: string };

interface Props {
  tree: OrgTreeNode[];
  selected: SelectedNode | null;
  onSelect: (node: SelectedNode) => void;
  onDeleteUnit: (node: OrgTreeNode) => void;
  onDeleteSite: (site: SiteRef) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
}

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
  onDeleteUnit,
  onDeleteSite,
  expanded,
  onToggleExpand,
}: {
  node: OrgTreeNode;
  depth: number;
  selected: SelectedNode | null;
  onSelect: (n: SelectedNode) => void;
  onDeleteUnit: (n: OrgTreeNode) => void;
  onDeleteSite: (s: SiteRef) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const isSelected = selected?.type === "unit" && selected.id === node.id;
  const childCount = node.children.length + node.sites.length;
  const hasChildren = childCount > 0;

  return (
    <div className="relative">
      {/* Vertical connector line */}
      {depth > 0 && (
        <div
          className="absolute border-l border-[#1E3A5F]"
          style={{ left: 12 + (depth - 1) * 20, top: 0, bottom: 0 }}
        />
      )}

      {/* Node row */}
      <div
        className={cn(
          "group flex items-center gap-1.5 py-1.5 pr-2 cursor-pointer transition-colors rounded-md",
          isSelected ? "border-l-2 border-action bg-action/5" : "hover:bg-hover/50 border-l-2 border-transparent"
        )}
        style={{ paddingLeft: 12 + depth * 20 }}
        onClick={() => onSelect({ type: "unit", id: node.id, node })}
      >
        {/* Expand chevron */}
        <button
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(node.id); }}
          className={cn("shrink-0 transition-transform", hasChildren ? "text-faint hover:text-secondary" : "invisible")}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")} />
        </button>

        <Globe className="h-3.5 w-3.5 text-action shrink-0" />

        <span className="text-sm font-medium text-secondary truncate">{node.name}</span>

        {node.code && (
          <span className="text-[10px] font-mono text-faint bg-hover px-1 py-0.5 rounded shrink-0">
            {node.code}
          </span>
        )}

        {!isExpanded && childCount > 0 && (
          <span className="text-[10px] text-faint shrink-0">({childCount})</span>
        )}

        <div className="flex-1" />

        <button
          onClick={(e) => { e.stopPropagation(); onDeleteUnit(node); }}
          className="hidden group-hover:block text-faint hover:text-loss transition-colors shrink-0"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Children */}
      {isExpanded && (
        <>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              onDeleteUnit={onDeleteUnit}
              onDeleteSite={onDeleteSite}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
            />
          ))}
          {node.sites.map((site) => (
            <SiteLeaf
              key={site.id}
              site={site}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              onDelete={onDeleteSite}
              parentUnitId={node.id}
            />
          ))}
        </>
      )}
    </div>
  );
}

function SiteLeaf({
  site,
  depth,
  selected,
  onSelect,
  onDelete,
  parentUnitId,
}: {
  site: SiteRef;
  depth: number;
  selected: SelectedNode | null;
  onSelect: (n: SelectedNode) => void;
  onDelete: (s: SiteRef) => void;
  parentUnitId: string;
}) {
  const isSelected = selected?.type === "site" && selected.id === site.id;

  return (
    <div className="relative">
      {depth > 0 && (
        <div
          className="absolute border-l border-[#1E3A5F]"
          style={{ left: 12 + (depth - 1) * 20, top: 0, height: "50%" }}
        />
      )}

      <div
        className={cn(
          "group flex items-center gap-1.5 py-1.5 pr-2 cursor-pointer transition-colors rounded-md",
          isSelected ? "border-l-2 border-action bg-action/5" : "hover:bg-hover/50 border-l-2 border-transparent"
        )}
        style={{ paddingLeft: 12 + depth * 20 + 18 }}
        onClick={() => onSelect({ type: "site", id: site.id, site, parentUnitId })}
      >
        <div className="h-2 w-2 rounded-full bg-futures shrink-0" />

        <span className="text-sm text-secondary truncate">{site.name}</span>

        {site.code && (
          <span className="text-[10px] font-mono text-faint shrink-0">{site.code}</span>
        )}

        <div className="flex-1" />

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(site); }}
          className="hidden group-hover:block text-faint hover:text-loss transition-colors shrink-0"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function OrgTree({ tree, selected, onSelect, onDeleteUnit, onDeleteSite, expanded, onToggleExpand }: Props) {
  return (
    <div className="bg-surface border border-b-default rounded-lg p-3 overflow-y-auto min-h-[200px]">
      {tree.length === 0 ? (
        <p className="text-sm text-faint text-center py-8">
          No organizational units yet. Use the detail panel to add units.
        </p>
      ) : (
        tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            selected={selected}
            onSelect={onSelect}
            onDeleteUnit={onDeleteUnit}
            onDeleteSite={onDeleteSite}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
          />
        ))
      )}
    </div>
  );
}
