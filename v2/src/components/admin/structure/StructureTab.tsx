"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useOrgContextSafe } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, btnPrimary, inputCls, cn } from "../shared";
import { TableSkeleton, ConfirmDialog } from "../SharedUI";
import { LevelEditor } from "./LevelEditor";
import { OrgTree, type SelectedNode } from "./OrgTree";
import { DetailPanel } from "./DetailPanel";
import type { OrgTreeNode, HierarchyLevel } from "@/types/org";

export function StructureTab({ orgId: propOrgId }: { orgId?: string } = {}) {
  const ctx = useOrgContextSafe();
  const { user } = useAuth();
  const orgId = propOrgId ?? ctx?.orgId ?? "";
  const userId = user?.id ?? "";

  const [tree, setTree] = useState<OrgTreeNode[]>([]);
  const [levels, setLevels] = useState<HierarchyLevel[]>([]);
  const [siteTypes, setSiteTypes] = useState<{ id: string; name: string }[]>([]);
  const [commodities, setCommodities] = useState<{ id: string; name: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<SelectedNode | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ type: "unit" | "site"; id: string; name: string } | null>(null);

  // Add root unit form
  const [showAddRoot, setShowAddRoot] = useState(false);
  const [addRootForm, setAddRootForm] = useState({ name: "", code: "" });
  const [addingRoot, setAddingRoot] = useState(false);

  const load = useCallback(async () => {
    try {
      const [treeData, levelsData, typesData, commodityData] = await Promise.all([
        apiFetch(`/api/kernel/org-hierarchy?orgId=${orgId}`).catch(() => []),
        apiFetch(`/api/kernel/org-hierarchy/levels?orgId=${orgId}`).catch(() => []),
        apiFetch("/api/kernel/site-types").catch(() => []),
        apiFetch(`/api/kernel/commodities?orgId=${orgId}`).catch(() => []),
      ]);
      setTree(treeData ?? []);
      setLevels(levelsData ?? []);
      setSiteTypes(typesData ?? []);
      setCommodities((commodityData ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));

      // Auto-expand root nodes on first load
      if (treeData?.length && expanded.size === 0) {
        setExpanded(new Set(treeData.map((n: OrgTreeNode) => n.id)));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  function reload() {
    load();
    ctx?.refreshOrgTree?.();
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "unit") {
        await apiFetch(`/api/kernel/org-hierarchy/${deleteTarget.id}`, {
          method: "DELETE",
          body: JSON.stringify({ userId }),
        });
      } else {
        await apiFetch(`/api/kernel/sites/${deleteTarget.id}`, { method: "DELETE" });
      }
      if (selected?.id === deleteTarget.id) setSelected(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  }

  // Find the top-level (root) non-site level for adding root units
  const nonSiteLevels = levels.filter((l) => !l.is_site_level);
  const rootLevel = nonSiteLevels.length > 0 ? nonSiteLevels[0] : null;

  async function handleAddRoot(e: React.FormEvent) {
    e.preventDefault();
    if (!rootLevel) return;
    setAddingRoot(true);
    setError(null);
    try {
      await apiFetch("/api/kernel/org-hierarchy", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          hierarchyLevelId: rootLevel.id,
          name: addRootForm.name.trim(),
          code: addRootForm.code.trim() || null,
          userId,
        }),
      });
      setAddRootForm({ name: "", code: "" });
      setShowAddRoot(false);
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingRoot(false);
    }
  }

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Level Editor */}
      <div className="bg-surface border border-b-default rounded-lg p-4 space-y-2">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Hierarchy Levels</h3>
        <LevelEditor orgId={orgId} levels={levels} userId={userId} onChanged={reload} />
      </div>

      {/* Add root unit button */}
      {rootLevel && (
        <div className="flex items-center gap-2">
          {!showAddRoot ? (
            <button onClick={() => setShowAddRoot(true)} className={cn(btnPrimary, "text-xs")}>
              <Plus className="h-3.5 w-3.5" /> Add {rootLevel.label}
            </button>
          ) : (
            <form onSubmit={handleAddRoot} className="flex items-center gap-2">
              <input
                type="text"
                className={cn(inputCls, "text-xs py-1.5 w-36")}
                placeholder={`${rootLevel.label} name`}
                value={addRootForm.name}
                onChange={(e) => setAddRootForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
              <input
                type="text"
                className={cn(inputCls, "text-xs py-1.5 w-20")}
                placeholder="Code"
                value={addRootForm.code}
                onChange={(e) => setAddRootForm((f) => ({ ...f, code: e.target.value }))}
              />
              <button type="submit" disabled={addingRoot} className={cn(btnPrimary, "text-xs py-1.5")}>
                {addingRoot ? "Adding..." : "Add"}
              </button>
              <button type="button" onClick={() => { setShowAddRoot(false); setAddRootForm({ name: "", code: "" }); }} className="text-xs text-faint hover:text-secondary">
                Cancel
              </button>
            </form>
          )}
        </div>
      )}

      {/* Split panel: tree + detail */}
      <div className="flex gap-4" style={{ minHeight: 400 }}>
        {/* Left: tree */}
        <div className="flex-1 min-w-0">
          <OrgTree
            tree={tree}
            selected={selected}
            onSelect={setSelected}
            onDeleteUnit={(node) => setDeleteTarget({ type: "unit", id: node.id, name: node.name })}
            onDeleteSite={(site) => setDeleteTarget({ type: "site", id: site.id, name: site.name })}
            expanded={expanded}
            onToggleExpand={toggleExpand}
          />
        </div>

        {/* Right: detail panel */}
        <div className="w-[340px] shrink-0">
          <DetailPanel
            orgId={orgId}
            userId={userId}
            selected={selected}
            levels={levels}
            siteTypes={siteTypes}
            allCommodities={commodities}
            tree={tree}
            onChanged={reload}
          />
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.type === "unit" ? "Unit" : "Site"}`}
          desc={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
