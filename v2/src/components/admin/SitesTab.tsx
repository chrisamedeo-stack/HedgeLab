"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, Edit2, Trash2 } from "lucide-react";
import { useOrgContextSafe } from "@/contexts/OrgContext";
import { apiFetch, btnPrimary, btnCancel, inputCls, selectCls } from "./shared";
import { TableSkeleton, EmptyState, ConfirmDialog } from "./SharedUI";
import type { OrgTreeNode } from "@/types/org";

/** Flatten an OrgTreeNode[] into a flat list of { id, name } for dropdown */
function flattenUnits(nodes: OrgTreeNode[]): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name });
    if (n.children?.length) out.push(...flattenUnits(n.children));
  }
  return out;
}

export function SitesTab({ orgId: propOrgId }: { orgId?: string } = {}) {
  const ctx = useOrgContextSafe();
  const orgId = propOrgId ?? ctx?.orgId ?? "";
  const [sites, setSites] = useState<any[]>([]);
  const [siteTypes, setSiteTypes] = useState<{ id: string; name: string }[]>([]);
  const [orgUnits, setOrgUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({ code: "", name: "", region: "", siteTypeId: "", orgUnitId: "" });

  const load = useCallback(async () => {
    try {
      const [sitesData, typesData, treeData] = await Promise.all([
        apiFetch(`/api/kernel/sites?orgId=${orgId}`),
        apiFetch("/api/kernel/site-types"),
        apiFetch(`/api/kernel/org-hierarchy?orgId=${orgId}`).catch(() => []),
      ]);
      setSites(sitesData);
      setSiteTypes(typesData ?? []);
      setOrgUnits(flattenUnits(treeData ?? []));
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  function field(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function startEdit(s: any) {
    setEditing(s);
    setForm({
      code: s.code ?? "",
      name: s.name,
      region: s.region ?? "",
      siteTypeId: s.site_type_id ?? "",
      orgUnitId: s.org_unit_id ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false); setEditing(null);
    setForm({ code: "", name: "", region: "", siteTypeId: "", orgUnitId: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      const payload = {
        orgId,
        code: form.code,
        name: form.name,
        region: form.region || null,
        siteTypeId: form.siteTypeId,
        orgUnitId: form.orgUnitId || null,
      };
      if (editing) {
        await apiFetch(`/api/kernel/sites/${editing.id}`, { method: "PUT", body: JSON.stringify({ ...payload, id: editing.id }) });
      } else {
        await apiFetch("/api/kernel/sites", { method: "POST", body: JSON.stringify(payload) });
      }
      cancelForm(); load();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/kernel/sites/${deleteTarget.id}`, { method: "DELETE" });
      load();
    } catch (err) { setError((err as Error).message); }
    finally { setDeleteTarget(null); }
  }

  // Build a lookup of orgUnit id → name
  const unitNameMap: Record<string, string> = {};
  for (const u of orgUnits) unitNameMap[u.id] = u.name;

  // Group sites by org_unit name (country/region), fallback "Unassigned"
  const grouped: Record<string, any[]> = {};
  for (const s of sites) {
    const key = s.org_unit_id ? (unitNameMap[s.org_unit_id] ?? "Unassigned") : "Unassigned";
    (grouped[key] ??= []).push(s);
  }
  // Sort groups: named groups first (alphabetical), "Unassigned" last
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button></div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{sites.length} sites configured</p>
        <button onClick={() => showForm ? cancelForm() : setShowForm(true)} className={btnPrimary}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Site"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-secondary">
            {editing ? <>Edit <span className="text-action">{editing.code}</span></> : "New Site"}
          </h3>
          {/* Row 1: Code, Name (wider), Site Type */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted">Code *</label>
              <input type="text" maxLength={20} required className={inputCls} placeholder="e.g. GM1" value={form.code} onChange={e => field("code", e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs text-muted">Name *</label>
              <input type="text" maxLength={200} required className={inputCls} placeholder="e.g. Gimli Elevator" value={form.name} onChange={e => field("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Site Type</label>
              <select className={selectCls} value={form.siteTypeId} onChange={e => field("siteTypeId", e.target.value)}>
                <option value="">Select...</option>
                {siteTypes.map(st => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Row 2: Country/Region, Province/State */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted">Country / Region</label>
              <select className={selectCls} value={form.orgUnitId} onChange={e => field("orgUnitId", e.target.value)}>
                <option value="">Select...</option>
                {orgUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Province / State</label>
              <input type="text" className={inputCls} placeholder="e.g. MB" value={form.region} onChange={e => field("region", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelForm} className={btnCancel}>Cancel</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? "Saving..." : editing ? "Update Site" : "Create Site"}
            </button>
          </div>
        </form>
      )}

      {loading ? <TableSkeleton /> : sites.length === 0 ? (
        <EmptyState title="No sites" desc="Add your first site to get started." onAction={() => setShowForm(true)} actionLabel="Add Site" />
      ) : (
        groupKeys.map(group => (
          <div key={group} className="space-y-2">
            <h3 className="text-xs font-semibold text-faint uppercase tracking-wider">{group}</h3>
            <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-input-bg/50 border-b border-b-default">
                    {["Code", "Name", "Province / State", "Type", ""].map(h => <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-b-default">
                  {grouped[group].map((s: any) => (
                    <tr key={s.id} className="hover:bg-row-hover transition-colors">
                      <td className="px-3 py-3 font-mono text-xs text-action">{s.code}</td>
                      <td className="px-3 py-3 text-secondary">{s.name}</td>
                      <td className="px-3 py-3 text-muted">{s.region ?? "\u2014"}</td>
                      <td className="px-3 py-3 text-muted">{s.site_type_name ?? s.site_type_id ?? "\u2014"}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => startEdit(s)} className="text-ph hover:text-action transition-colors" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteTarget(s)} className="text-ph hover:text-destructive transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {deleteTarget && (
        <ConfirmDialog title="Delete Site" desc={`Delete site "${deleteTarget.code} \u2014 ${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
