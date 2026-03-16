"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Building2, Globe, Plus, X, Edit2, Trash2, Check, Loader2 } from "lucide-react";
import { useOrgContextSafe } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, btnPrimary, btnCancel, btnDanger, inputCls, cn } from "./shared";
import { TableSkeleton, ConfirmDialog } from "./SharedUI";
import type { OrgTreeNode, HierarchyLevel } from "@/types/org";

export function OrganizationTab({ orgId: propOrgId }: { orgId?: string } = {}) {
  const ctx = useOrgContextSafe();
  const { user } = useAuth();
  const orgId = propOrgId ?? ctx?.orgId ?? "";

  // Org profile state
  const [orgName, setOrgName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  // Hierarchy state
  const [tree, setTree] = useState<OrgTreeNode[]>([]);
  const [levels, setLevels] = useState<HierarchyLevel[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add unit form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", code: "" });
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit unit
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<OrgTreeNode | null>(null);

  const groupingLevel = levels.find(l => !l.is_site_level);

  const load = useCallback(async () => {
    try {
      const [orgData, treeData, levelsData, settingsData] = await Promise.all([
        apiFetch(`/api/kernel/organizations?id=${orgId}`),
        apiFetch(`/api/kernel/org-hierarchy?orgId=${orgId}`).catch(() => []),
        apiFetch(`/api/kernel/org-hierarchy/levels?orgId=${orgId}`).catch(() => []),
        apiFetch(`/api/kernel/org-settings?orgId=${orgId}`).catch(() => null),
      ]);
      if (orgData?.org) {
        setOrgName(orgData.org.name);
        setOriginalName(orgData.org.name);
        setProfileId(orgData.org.customer_profile_id ?? null);
        setBaseCurrency(orgData.org.base_currency ?? "USD");
      }
      setTree(treeData ?? []);
      setLevels(levelsData ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Clear success message after 3s
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  async function handleSaveOrgName(e: React.FormEvent) {
    e.preventDefault();
    if (orgName.trim() === originalName) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/kernel/organizations", {
        method: "PATCH",
        body: JSON.stringify({ orgId, name: orgName.trim(), userId: user!.id }),
      });
      setOriginalName(orgName.trim());
      setSuccess("Organization name updated");
      ctx?.refreshOrgTree();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupingLevel) return;
    setAddSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/kernel/org-hierarchy", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          hierarchyLevelId: groupingLevel.id,
          name: addForm.name.trim(),
          code: addForm.code.trim() || null,
          userId: user!.id,
        }),
      });
      setAddForm({ name: "", code: "" });
      setShowAddForm(false);
      setSuccess("Country added");
      load();
      ctx?.refreshOrgTree();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddSubmitting(false);
    }
  }

  function startEdit(node: OrgTreeNode) {
    setEditingUnit(node.id);
    setEditForm({ name: node.name, code: node.code ?? "" });
  }

  async function handleEditUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUnit) return;
    setEditSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/kernel/org-hierarchy/${editingUnit}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name.trim(),
          code: editForm.code.trim() || null,
          userId: user!.id,
        }),
      });
      setEditingUnit(null);
      setSuccess("Country updated");
      load();
      ctx?.refreshOrgTree();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteUnit() {
    if (!deleteTarget) return;
    setError(null);
    try {
      await apiFetch(`/api/kernel/org-hierarchy/${deleteTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ userId: user!.id }),
      });
      setSuccess("Country deleted");
      load();
      ctx?.refreshOrgTree();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  }

  if (loading) return <TableSkeleton />;

  const nameChanged = orgName.trim() !== originalName;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-gain/10 border border-gain/20 rounded-lg text-sm text-gain">
          {success}
        </div>
      )}

      {/* Section 1: Organization Profile */}
      <div className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
          <Building2 className="h-4 w-4 text-action" /> Organization Profile
        </h3>

        <form onSubmit={handleSaveOrgName} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted">Organization Name</label>
              <input
                type="text"
                className={inputCls}
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Customer Profile</label>
              <div className="px-3 py-2 bg-input-bg/50 border border-b-default rounded-lg text-sm text-muted capitalize">
                {profileId ?? "—"}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Base Currency</label>
              <div className="px-3 py-2 bg-input-bg/50 border border-b-default rounded-lg text-sm text-muted">
                {baseCurrency}
              </div>
            </div>
          </div>
          {nameChanged && (
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save Name"}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Section 2: Org Hierarchy */}
      <div className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
            <Globe className="h-4 w-4 text-action" /> {groupingLevel?.label ?? "Region"}s
          </h3>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setEditingUnit(null); }}
            className={btnPrimary}
          >
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showAddForm ? "Cancel" : `Add ${groupingLevel?.label ?? "Region"}`}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddUnit} className="bg-input-bg/30 border border-b-default rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted">Name *</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Canada"
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  required
                  maxLength={200}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Code</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. CA"
                  value={addForm.code}
                  onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))}
                  maxLength={20}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className={btnCancel}>Cancel</button>
              <button type="submit" disabled={addSubmitting} className={btnPrimary}>
                {addSubmitting ? "Adding..." : `Add ${groupingLevel?.label ?? "Region"}`}
              </button>
            </div>
          </form>
        )}

        {tree.length === 0 ? (
          <p className="text-sm text-faint text-center py-6">
            No {(groupingLevel?.label ?? "region").toLowerCase()}s configured. Add one to group your sites.
          </p>
        ) : (
          <div className="space-y-1">
            {tree.map(node => (
              <div key={node.id} className="bg-input-bg/20 border border-b-default rounded-lg overflow-hidden">
                {editingUnit === node.id ? (
                  <form onSubmit={handleEditUnit} className="flex items-center gap-3 px-4 py-3">
                    <Globe className="h-4 w-4 text-action shrink-0" />
                    <input
                      type="text"
                      className={cn(inputCls, "flex-1")}
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                    <input
                      type="text"
                      className={cn(inputCls, "w-20")}
                      placeholder="Code"
                      value={editForm.code}
                      onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))}
                    />
                    <button type="submit" disabled={editSubmitting} className="text-gain hover:text-gain/80" title="Save">
                      <Check className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setEditingUnit(null)} className="text-faint hover:text-secondary" title="Cancel">
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-action" />
                      <span className="text-sm font-medium text-secondary">{node.name}</span>
                      {node.code && (
                        <span className="text-xs font-mono text-faint bg-hover px-1.5 py-0.5 rounded">{node.code}</span>
                      )}
                      <span className="text-xs text-faint">
                        {node.sites.length} site{node.sites.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(node)} className="text-faint hover:text-action transition-colors" title="Edit">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(node)} className="text-faint hover:text-destructive transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Sites under this node */}
                {node.sites.length > 0 && editingUnit !== node.id && (
                  <div className="border-t border-b-default px-4 py-2 bg-input-bg/10">
                    <div className="flex flex-wrap gap-2">
                      {node.sites.map(site => (
                        <span key={site.id} className="inline-flex items-center gap-1.5 text-xs text-muted bg-hover px-2 py-1 rounded">
                          <Building2 className="h-3 w-3" />
                          {site.code} — {site.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${groupingLevel?.label ?? "Region"}`}
          desc={
            deleteTarget.sites.length > 0
              ? `Cannot delete "${deleteTarget.name}" — it has ${deleteTarget.sites.length} site(s) assigned. Reassign them first.`
              : `Delete "${deleteTarget.name}"? This cannot be undone.`
          }
          onConfirm={deleteTarget.sites.length > 0 ? () => setDeleteTarget(null) : handleDeleteUnit}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
