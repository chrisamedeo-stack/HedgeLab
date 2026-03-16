"use client";

import React, { useState } from "react";
import { Plus, Edit2, Globe } from "lucide-react";
import { apiFetch, btnPrimary, btnCancel, inputCls, selectCls, cn } from "../shared";
import { CommodityTags } from "./CommodityTags";
import type { SelectedNode } from "./OrgTree";
import type { OrgTreeNode, HierarchyLevel } from "@/types/org";

interface Props {
  orgId: string;
  userId: string;
  selected: SelectedNode | null;
  levels: HierarchyLevel[];
  siteTypes: { id: string; name: string }[];
  allCommodities: { id: string; name: string }[];
  tree: OrgTreeNode[];
  onChanged: () => void;
}

export function DetailPanel({ orgId, userId, selected, levels, siteTypes, allCommodities, tree, onChanged }: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "addChild" | "addSite">("view");
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset mode when selection changes
  React.useEffect(() => {
    setMode("view");
    setError(null);
  }, [selected?.id]);

  if (!selected) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-faint text-center">Select a node from the tree to view details</p>
      </div>
    );
  }

  function field(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  // ─── Org Unit selected ─────────────────────────────────────────────────
  if (selected.type === "unit") {
    const { node } = selected;
    const currentLevel = levels.find((l) => l.label === node.level_label);
    const currentDepth = currentLevel?.level_depth ?? node.level_depth;
    const nonSiteLevels = levels.filter((l) => !l.is_site_level);
    const childLevel = nonSiteLevels.find((l) => l.level_depth === currentDepth + 1);
    const siteLevel = levels.find((l) => l.is_site_level);
    const isParentOfSites = siteLevel && siteLevel.level_depth === currentDepth + 1;

    function startEdit() {
      setForm({ name: node.name, code: node.code ?? "" });
      setMode("edit");
    }

    function startAddChild() {
      setForm({ name: "", code: "" });
      setMode("addChild");
    }

    function startAddSite() {
      setForm({ code: "", name: "", siteTypeId: siteTypes[0]?.id ?? "" });
      setMode("addSite");
    }

    async function handleEditUnit(e: React.FormEvent) {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        await apiFetch(`/api/kernel/org-hierarchy/${node.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: form.name?.trim(), code: form.code?.trim() || null, userId }),
        });
        setMode("view");
        onChanged();
      } catch (err) { setError((err as Error).message); }
      finally { setSubmitting(false); }
    }

    async function handleAddChild(e: React.FormEvent) {
      e.preventDefault();
      const targetLevel = childLevel;
      if (!targetLevel) return;
      setSubmitting(true);
      setError(null);
      try {
        await apiFetch("/api/kernel/org-hierarchy", {
          method: "POST",
          body: JSON.stringify({
            orgId,
            hierarchyLevelId: targetLevel.id,
            parentId: node.id,
            name: form.name?.trim(),
            code: form.code?.trim() || null,
            userId,
          }),
        });
        setMode("view");
        onChanged();
      } catch (err) { setError((err as Error).message); }
      finally { setSubmitting(false); }
    }

    async function handleAddSite(e: React.FormEvent) {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        await apiFetch("/api/kernel/sites", {
          method: "POST",
          body: JSON.stringify({
            orgId,
            code: form.code?.trim(),
            name: form.name?.trim(),
            siteTypeId: form.siteTypeId || null,
            orgUnitId: node.id,
          }),
        });
        setMode("view");
        onChanged();
      } catch (err) { setError((err as Error).message); }
      finally { setSubmitting(false); }
    }

    return (
      <div className="bg-surface border border-b-default rounded-lg p-4 space-y-4 overflow-y-auto">
        {error && (
          <div className="p-2 bg-loss/10 border border-loss/20 rounded text-xs text-loss">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Header */}
        <div>
          <p className="text-[10px] text-faint uppercase tracking-wider">{node.level_label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <h3 className="text-sm font-semibold text-primary">{node.name}</h3>
            {node.code && (
              <span className="text-[10px] font-mono text-faint bg-hover px-1.5 py-0.5 rounded">{node.code}</span>
            )}
          </div>
          <p className="text-xs text-faint mt-1">
            {node.children.length} child unit{node.children.length !== 1 ? "s" : ""}, {node.sites.length} site{node.sites.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Actions */}
        {mode === "view" && (
          <div className="flex items-center gap-2 flex-wrap">
            {childLevel && (
              <button onClick={startAddChild} className={cn(btnPrimary, "text-xs py-1.5 px-3")}>
                <Plus className="h-3 w-3" /> Add {childLevel.label}
              </button>
            )}
            {isParentOfSites && (
              <button onClick={startAddSite} className={cn(btnPrimary, "text-xs py-1.5 px-3")}>
                <Plus className="h-3 w-3" /> Add Site
              </button>
            )}
            <button onClick={startEdit} className={cn(btnCancel, "text-xs py-1.5 px-3")}>
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          </div>
        )}

        {/* Edit form */}
        {mode === "edit" && (
          <form onSubmit={handleEditUnit} className="space-y-3 bg-input-bg/20 border border-b-default rounded-lg p-3">
            <div className="space-y-1">
              <label className="text-xs text-muted">Name</label>
              <input type="text" className={inputCls} value={form.name ?? ""} onChange={(e) => field("name", e.target.value)} required maxLength={200} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Code</label>
              <input type="text" className={inputCls} value={form.code ?? ""} onChange={(e) => field("code", e.target.value)} maxLength={20} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMode("view")} className={cn(btnCancel, "text-xs py-1.5 px-3")}>Cancel</button>
              <button type="submit" disabled={submitting} className={cn(btnPrimary, "text-xs py-1.5 px-3")}>
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}

        {/* Add child form */}
        {mode === "addChild" && childLevel && (
          <form onSubmit={handleAddChild} className="space-y-3 bg-input-bg/20 border border-b-default rounded-lg p-3">
            <p className="text-xs font-medium text-muted">New {childLevel.label}</p>
            <div className="space-y-1">
              <label className="text-xs text-muted">Name *</label>
              <input type="text" className={inputCls} value={form.name ?? ""} onChange={(e) => field("name", e.target.value)} required maxLength={200} placeholder={`e.g. ${childLevel.label} name`} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Code</label>
              <input type="text" className={inputCls} value={form.code ?? ""} onChange={(e) => field("code", e.target.value)} maxLength={20} placeholder="e.g. CA" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMode("view")} className={cn(btnCancel, "text-xs py-1.5 px-3")}>Cancel</button>
              <button type="submit" disabled={submitting} className={cn(btnPrimary, "text-xs py-1.5 px-3")}>
                {submitting ? "Adding..." : `Add ${childLevel.label}`}
              </button>
            </div>
          </form>
        )}

        {/* Add site form */}
        {mode === "addSite" && (
          <form onSubmit={handleAddSite} className="space-y-3 bg-input-bg/20 border border-b-default rounded-lg p-3">
            <p className="text-xs font-medium text-muted">New Site under {node.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted">Code *</label>
                <input type="text" className={inputCls} value={form.code ?? ""} onChange={(e) => field("code", e.target.value)} required maxLength={20} placeholder="e.g. GM1" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Site Type</label>
                <select className={selectCls} value={form.siteTypeId ?? ""} onChange={(e) => field("siteTypeId", e.target.value)}>
                  <option value="">Select...</option>
                  {siteTypes.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Name *</label>
              <input type="text" className={inputCls} value={form.name ?? ""} onChange={(e) => field("name", e.target.value)} required maxLength={200} placeholder="e.g. Gimli Elevator" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMode("view")} className={cn(btnCancel, "text-xs py-1.5 px-3")}>Cancel</button>
              <button type="submit" disabled={submitting} className={cn(btnPrimary, "text-xs py-1.5 px-3")}>
                {submitting ? "Adding..." : "Add Site"}
              </button>
            </div>
          </form>
        )}

        {/* Commodities */}
        <CommodityTags
          orgId={orgId}
          entityType="org_unit"
          entityId={node.id}
          userId={userId}
          allCommodities={allCommodities}
          onChanged={onChanged}
        />

        {/* Children list */}
        {(node.children.length > 0 || node.sites.length > 0) && mode === "view" && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-muted uppercase tracking-wider">Children</h4>
            {node.children.map((child) => (
              <div key={child.id} className="flex items-center gap-2 px-2 py-1.5 bg-input-bg/20 rounded text-xs">
                <Globe className="h-3 w-3 text-action" />
                <span className="text-secondary">{child.name}</span>
                {child.code && <span className="text-faint font-mono">{child.code}</span>}
                <span className="text-faint ml-auto">{child.sites.length} site{child.sites.length !== 1 ? "s" : ""}</span>
              </div>
            ))}
            {node.sites.map((site) => (
              <div key={site.id} className="flex items-center gap-2 px-2 py-1.5 bg-input-bg/20 rounded text-xs">
                <div className="h-2 w-2 rounded-full bg-futures" />
                <span className="text-secondary">{site.name}</span>
                <span className="text-faint font-mono">{site.code}</span>
                <span className="text-faint ml-auto">{site.site_type_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Site selected ──────────────────────────────────────────────────────
  if (selected.type === "site") {
    const { site } = selected;
    // We need to fetch full site data for editing
    return <SiteDetail
      orgId={orgId}
      userId={userId}
      site={site}
      siteTypes={siteTypes}
      allCommodities={allCommodities}
      tree={tree}
      onChanged={onChanged}
    />;
  }

  return null;
}

// ─── Site Detail Sub-component ──────────────────────────────────────────────

function SiteDetail({ orgId, userId, site, siteTypes, allCommodities, tree, onChanged }: {
  orgId: string;
  userId: string;
  site: SiteRef;
  siteTypes: { id: string; name: string }[];
  allCommodities: { id: string; name: string }[];
  tree: OrgTreeNode[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullSite, setFullSite] = useState<Record<string, unknown> | null>(null);

  // Fetch full site details
  React.useEffect(() => {
    setMode("view");
    setError(null);
    apiFetch(`/api/kernel/sites?orgId=${orgId}`)
      .then((sites: Record<string, unknown>[]) => {
        const found = sites.find((s) => s.id === site.id);
        if (found) setFullSite(found);
      })
      .catch(() => {});
  }, [site.id, orgId]);

  function field(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  // Flatten tree for org_unit dropdown
  function flattenUnits(nodes: OrgTreeNode[]): { id: string; name: string }[] {
    const out: { id: string; name: string }[] = [];
    for (const n of nodes) {
      out.push({ id: n.id, name: n.name });
      if (n.children?.length) out.push(...flattenUnits(n.children));
    }
    return out;
  }
  const orgUnits = flattenUnits(tree);

  function startEdit() {
    setForm({
      code: (fullSite?.code as string) ?? site.code ?? "",
      name: (fullSite?.name as string) ?? site.name ?? "",
      siteTypeId: (fullSite?.site_type_id as string) ?? "",
      region: (fullSite?.region as string) ?? "",
      timezone: (fullSite?.timezone as string) ?? "",
      orgUnitId: (fullSite?.org_unit_id as string) ?? "",
    });
    setMode("edit");
  }

  async function handleEditSite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/kernel/sites/${site.id}`, {
        method: "PUT",
        body: JSON.stringify({
          orgId,
          code: form.code?.trim() || null,
          name: form.name?.trim(),
          siteTypeId: form.siteTypeId || null,
          region: form.region?.trim() || null,
          timezone: form.timezone?.trim() || null,
          orgUnitId: form.orgUnitId || null,
        }),
      });
      setMode("view");
      onChanged();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  }

  const siteTypeName = site.site_type_name || (siteTypes.find((st) => st.id === fullSite?.site_type_id)?.name ?? "—");

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4 space-y-4 overflow-y-auto">
      {error && (
        <div className="p-2 bg-loss/10 border border-loss/20 rounded text-xs text-loss">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Header */}
      <div>
        <p className="text-[10px] text-faint uppercase tracking-wider">Site</p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="h-2.5 w-2.5 rounded-full bg-futures" />
          <h3 className="text-sm font-semibold text-primary">{site.name}</h3>
          {site.code && (
            <span className="text-[10px] font-mono text-faint bg-hover px-1.5 py-0.5 rounded">{site.code}</span>
          )}
        </div>
        <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-medium bg-futures/15 text-futures rounded">
          {siteTypeName}
        </span>
      </div>

      {/* Actions */}
      {mode === "view" && (
        <div className="flex items-center gap-2">
          <button onClick={startEdit} className={cn(btnCancel, "text-xs py-1.5 px-3")}>
            <Edit2 className="h-3 w-3" /> Edit
          </button>
        </div>
      )}

      {/* Edit form */}
      {mode === "edit" && (
        <form onSubmit={handleEditSite} className="space-y-3 bg-input-bg/20 border border-b-default rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted">Code</label>
              <input type="text" className={inputCls} value={form.code ?? ""} onChange={(e) => field("code", e.target.value)} maxLength={20} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Site Type</label>
              <select className={selectCls} value={form.siteTypeId ?? ""} onChange={(e) => field("siteTypeId", e.target.value)}>
                <option value="">Select...</option>
                {siteTypes.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Name</label>
            <input type="text" className={inputCls} value={form.name ?? ""} onChange={(e) => field("name", e.target.value)} required maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted">Province / State</label>
              <input type="text" className={inputCls} value={form.region ?? ""} onChange={(e) => field("region", e.target.value)} placeholder="e.g. MB" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Timezone</label>
              <input type="text" className={inputCls} value={form.timezone ?? ""} onChange={(e) => field("timezone", e.target.value)} placeholder="e.g. America/Chicago" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Parent Unit</label>
            <select className={selectCls} value={form.orgUnitId ?? ""} onChange={(e) => field("orgUnitId", e.target.value)}>
              <option value="">Unassigned</option>
              {orgUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMode("view")} className={cn(btnCancel, "text-xs py-1.5 px-3")}>Cancel</button>
            <button type="submit" disabled={submitting} className={cn(btnPrimary, "text-xs py-1.5 px-3")}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      )}

      {/* Commodities */}
      <CommodityTags
        orgId={orgId}
        entityType="site"
        entityId={site.id}
        userId={userId}
        allCommodities={allCommodities}
        onChanged={onChanged}
      />

      {/* Details (read-only) */}
      {fullSite && mode === "view" && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-muted uppercase tracking-wider">Details</h4>
          {[
            ["Province / State", fullSite.region],
            ["Timezone", fullSite.timezone],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between text-xs px-2 py-1.5 bg-input-bg/20 rounded">
              <span className="text-muted">{label as string}</span>
              <span className="text-secondary">{(value as string) || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Import SiteRef type locally since it's used in SiteDetail
import type { SiteRef } from "@/types/org";
