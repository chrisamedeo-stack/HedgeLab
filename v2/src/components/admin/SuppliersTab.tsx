"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, Edit2 } from "lucide-react";
import { useOrgContextSafe } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, btnPrimary, btnCancel, inputCls, selectCls } from "./shared";
import { TableSkeleton, EmptyState } from "./SharedUI";
import type { Counterparty, EntityType, CounterpartyType } from "@/types/contracts";

type FilterMode = "all" | "supplier" | "counterparty";

const ENTITY_BADGE: Record<string, { label: string; cls: string }> = {
  supplier: { label: "Supplier", cls: "bg-profit/15 text-profit" },
  counterparty: { label: "Counterparty", cls: "bg-action/15 text-action" },
  both: { label: "Both", cls: "bg-warning/15 text-warning" },
};

const STATUS_BADGE: Record<string, { cls: string }> = {
  good: { cls: "bg-profit/15 text-profit" },
  warning: { cls: "bg-warning/15 text-warning" },
  exceeded: { cls: "bg-loss/15 text-loss" },
  suspended: { cls: "bg-faint/15 text-faint" },
};

export function SuppliersTab({ orgId: propOrgId }: { orgId?: string } = {}) {
  const ctx = useOrgContextSafe();
  const auth = useAuth();
  const orgId = propOrgId ?? ctx?.orgId ?? "";
  const userId = auth?.user?.id ?? "";

  const [data, setData] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Counterparty | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const [form, setForm] = useState({
    name: "",
    shortName: "",
    entityType: "both" as EntityType,
    counterpartyType: "commercial" as CounterpartyType,
    creditLimit: "",
    creditRating: "",
    paymentTermsDays: "30",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ orgId });
      if (filterMode !== "all") params.set("entityType", filterMode);
      const result = await apiFetch(`/api/contracts/counterparties?${params}`);
      setData(result);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [orgId, filterMode]);

  useEffect(() => { load(); }, [load]);

  function field(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function startEdit(cp: Counterparty) {
    setEditing(cp);
    setForm({
      name: cp.name,
      shortName: cp.short_name ?? "",
      entityType: cp.entity_type,
      counterpartyType: cp.counterparty_type,
      creditLimit: cp.credit_limit != null ? String(cp.credit_limit) : "",
      creditRating: cp.credit_rating ?? "",
      paymentTermsDays: String(cp.payment_terms_days),
      contactName: cp.contact_name ?? "",
      contactEmail: cp.contact_email ?? "",
      contactPhone: cp.contact_phone ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false); setEditing(null);
    setForm({ name: "", shortName: "", entityType: "both", counterpartyType: "commercial",
      creditLimit: "", creditRating: "", paymentTermsDays: "30", contactName: "", contactEmail: "", contactPhone: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError(null);
    try {
      if (editing) {
        await apiFetch(`/api/contracts/counterparties/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            userId,
            name: form.name,
            shortName: form.shortName || undefined,
            entityType: form.entityType,
            counterpartyType: form.counterpartyType,
            creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
            creditRating: form.creditRating || undefined,
            paymentTermsDays: Number(form.paymentTermsDays),
            contactName: form.contactName || undefined,
            contactEmail: form.contactEmail || undefined,
            contactPhone: form.contactPhone || undefined,
          }),
        });
      } else {
        await apiFetch("/api/contracts/counterparties", {
          method: "POST",
          body: JSON.stringify({
            orgId, userId,
            name: form.name,
            shortName: form.shortName || undefined,
            entityType: form.entityType,
            counterpartyType: form.counterpartyType,
            creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
            creditRating: form.creditRating || undefined,
            paymentTermsDays: Number(form.paymentTermsDays),
            contactName: form.contactName || undefined,
            contactEmail: form.contactEmail || undefined,
            contactPhone: form.contactPhone || undefined,
          }),
        });
      }
      cancelForm(); load();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted">{data.length} entries</p>
          <div className="flex rounded-lg border border-b-default overflow-hidden ml-3">
            {(["all", "supplier", "counterparty"] as FilterMode[]).map(mode => (
              <button key={mode} onClick={() => setFilterMode(mode)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  filterMode === mode ? "bg-action text-white" : "text-muted hover:bg-hover"
                }`}>
                {mode === "all" ? "All" : mode === "supplier" ? "Suppliers" : "Counterparties"}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => showForm ? cancelForm() : setShowForm(true)} className={btnPrimary}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-b-default rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-secondary">
            {editing ? <>Edit <span className="text-action">{editing.name}</span></> : "New Supplier / Counterparty"}
          </h3>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-muted">Name *</label>
              <input type="text" required className={inputCls} value={form.name} onChange={e => field("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Short Name</label>
              <input type="text" className={inputCls} value={form.shortName} onChange={e => field("shortName", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Entity Type</label>
              <select className={selectCls} value={form.entityType} onChange={e => field("entityType", e.target.value)}>
                <option value="supplier">Supplier</option>
                <option value="counterparty">Counterparty</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">CP Type</label>
              <select className={selectCls} value={form.counterpartyType} onChange={e => field("counterpartyType", e.target.value)}>
                <option value="commercial">Commercial</option>
                <option value="broker">Broker</option>
                <option value="exchange">Exchange</option>
                <option value="producer">Producer</option>
                <option value="consumer">Consumer</option>
                <option value="trader">Trader</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Credit Rating</label>
              <input type="text" className={inputCls} value={form.creditRating} onChange={e => field("creditRating", e.target.value)} placeholder="e.g. A+" />
            </div>
          </div>
          <div className="grid grid-cols-6 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted">Credit Limit</label>
              <input type="number" step="any" className={inputCls} value={form.creditLimit} onChange={e => field("creditLimit", e.target.value)} placeholder="$" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Pay Terms (d)</label>
              <input type="number" className={inputCls} value={form.paymentTermsDays} onChange={e => field("paymentTermsDays", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-muted">Contact Name</label>
              <input type="text" className={inputCls} value={form.contactName} onChange={e => field("contactName", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Email</label>
              <input type="email" className={inputCls} value={form.contactEmail} onChange={e => field("contactEmail", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Phone</label>
              <input type="text" className={inputCls} value={form.contactPhone} onChange={e => field("contactPhone", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={cancelForm} className={btnCancel}>Cancel</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? "Saving..." : editing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      )}

      {loading ? <TableSkeleton /> : data.length === 0 ? (
        <EmptyState title="No suppliers or counterparties" desc="Add your first supplier to get started."
          onAction={() => setShowForm(true)} actionLabel="Add" />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-input-bg/50 border-b border-b-default">
                {["Name","Type","Entity","Credit Limit","Credit Used","Status","Payment",""].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {data.map(cp => {
                const limit = cp.credit_limit != null ? Number(cp.credit_limit) : null;
                const used = Number(cp.credit_used);
                const pct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
                const eb = ENTITY_BADGE[cp.entity_type] ?? ENTITY_BADGE.both;
                const sb = STATUS_BADGE[cp.credit_status] ?? STATUS_BADGE.good;
                const barColor = cp.credit_status === "good" ? "bg-profit" :
                  cp.credit_status === "warning" ? "bg-warning" : "bg-loss";

                return (
                  <tr key={cp.id} className={`hover:bg-row-hover transition-colors ${!cp.is_active ? "opacity-50" : ""}`}>
                    <td className="px-3 py-3">
                      <div className="text-secondary">{cp.name}</div>
                      {cp.short_name && <div className="text-xs text-faint">{cp.short_name}</div>}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">{cp.counterparty_type}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${eb.cls}`}>
                        {eb.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-secondary">
                      {limit != null ? `$${limit.toLocaleString()}` : "\u2014"}
                    </td>
                    <td className="px-3 py-3">
                      {limit != null && limit > 0 ? (
                        <div className="space-y-1">
                          <span className="font-mono text-xs text-secondary">${used.toLocaleString()}</span>
                          <div className="h-1.5 w-20 rounded-full bg-input-bg overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-faint">\u2014</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {limit != null && limit > 0 ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sb.cls}`}>
                          {cp.credit_status}
                        </span>
                      ) : (
                        <span className="text-xs text-faint">\u2014</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">{cp.payment_terms_days}d</td>
                    <td className="px-3 py-3">
                      <button onClick={() => startEdit(cp)} className="text-ph hover:text-action transition-colors" title="Edit">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
