"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, Edit2, Trash2 } from "lucide-react";
import { useOrgContext } from "@/contexts/OrgContext";
import { apiFetch, btnPrimary, btnCancel, inputCls, selectCls, cn } from "./shared";
import { TableSkeleton, EmptyState, ConfirmDialog } from "./SharedUI";

const ROLES = ["admin", "risk_manager", "trader", "operations", "viewer"];
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", risk_manager: "Risk Manager", trader: "Trader", operations: "Operations", viewer: "Viewer",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive-15 text-destructive",
  risk_manager: "bg-action-20 text-action",
  trader: "bg-profit-20 text-profit",
  operations: "bg-warning-20 text-warning",
  viewer: "bg-input-bg text-muted",
};

export function UsersTab() {
  const { orgId } = useOrgContext();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "trader", enabled: true });

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v2/kernel/users?orgId=${orgId}`);
      setUsers(data);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  function startEdit(u: any) {
    setEditing(u);
    setForm({ name: u.name ?? "", email: u.email ?? "", role: u.role_id ?? u.role ?? "trader", enabled: u.is_active ?? true });
    setShowForm(false);
  }

  function cancelAll() {
    setShowForm(false); setEditing(null);
    setForm({ name: "", email: "", role: "trader", enabled: true });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch("/api/v2/kernel/users", {
        method: "POST",
        body: JSON.stringify({ orgId, name: form.name, email: form.email || null, roleId: form.role }),
      });
      cancelAll(); load();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editing) return; setSubmitting(true);
    try {
      await apiFetch(`/api/v2/kernel/users/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({ email: form.email || null, roleId: form.role, isActive: form.enabled }),
      });
      cancelAll(); load();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/v2/kernel/users/${deleteTarget.id}`, { method: "DELETE" });
      load();
    } catch (err) { setError((err as Error).message); }
    finally { setDeleteTarget(null); }
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button></div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{users.length} users</p>
        <button onClick={() => showForm ? cancelAll() : (cancelAll(), setShowForm(true))} className={btnPrimary}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add User"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-secondary">New User</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1"><label className="text-xs text-muted">Name</label>
              <input type="text" required maxLength={100} className={inputCls} placeholder="John Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1"><label className="text-xs text-muted">Email</label>
              <input type="email" maxLength={150} className={inputCls} placeholder="j.smith@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1"><label className="text-xs text-muted">Role</label>
              <select className={selectCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelAll} className={btnCancel}>Cancel</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>{submitting ? "Creating..." : "Create User"}</button>
          </div>
        </form>
      )}

      {editing && (
        <form onSubmit={handleEdit} className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-secondary">Edit <span className="text-action">{editing.name}</span></h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1"><label className="text-xs text-muted">Email</label>
              <input type="email" maxLength={150} className={inputCls} placeholder="email@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1"><label className="text-xs text-muted">Role</label>
              <select className={selectCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-xs text-muted">Enabled</label>
              <div className="flex items-center h-[38px]">
                <button type="button" onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                  className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    form.enabled ? "bg-action" : "bg-input-bg border border-b-input")}>
                  <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform",
                    form.enabled ? "translate-x-6" : "translate-x-1")} />
                </button>
                <span className="ml-2 text-sm text-secondary">{form.enabled ? "Active" : "Disabled"}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelAll} className={btnCancel}>Cancel</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>{submitting ? "Saving..." : "Update User"}</button>
          </div>
        </form>
      )}

      {loading ? <TableSkeleton /> : users.length === 0 ? (
        <EmptyState title="No users" desc="Add your first user." onAction={() => setShowForm(true)} actionLabel="Add User" />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-input-bg/50 border-b border-b-default">
              {["Username","Email","Role","Status",""].map(h => <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-b-default">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-row-hover transition-colors">
                  <td className="px-3 py-3 font-medium text-secondary">{u.name}</td>
                  <td className="px-3 py-3 text-muted">{u.email ?? "\u2014"}</td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", ROLE_COLORS[u.role_id] ?? "bg-input-bg text-muted")}>
                      {ROLE_LABELS[u.role_id] ?? u.role_name ?? u.role_id}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                      u.is_active ? "bg-profit-20 text-profit" : "bg-input-bg text-faint")}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => startEdit(u)} className="text-ph hover:text-action transition-colors" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDeleteTarget(u)} className="text-ph hover:text-destructive transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog title="Delete User" desc={`Delete user "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
