"use client";

import { useState } from "react";
import { usePlatformStore } from "@/store/platformStore";

const TIERS = ["standard", "professional", "enterprise"];
const STATUSES = ["active", "suspended", "cancelled"];

interface SubscriptionEditorProps {
  orgId: string;
  tier: string;
  status: string;
  maxUsers: number;
  maxSites: number;
  notes: string | null;
}

export function SubscriptionEditor({ orgId, tier, status, maxUsers, maxSites, notes }: SubscriptionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    subscription_tier: tier,
    subscription_status: status,
    max_users: maxUsers,
    max_sites: maxSites,
    notes: notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const { updateOrg } = usePlatformStore();

  async function handleSave() {
    setSaving(true);
    try {
      await updateOrg(orgId, form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-secondary">Subscription</h3>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-action hover:text-action-hover transition-colors font-medium"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted">Tier</p>
            <p className="text-secondary font-medium mt-0.5 capitalize">{tier}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Status</p>
            <p className="text-secondary font-medium mt-0.5 capitalize">{status}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Max Users</p>
            <p className="text-secondary font-medium mt-0.5">{maxUsers}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Max Sites</p>
            <p className="text-secondary font-medium mt-0.5">{maxSites}</p>
          </div>
        </div>
        {notes && (
          <div>
            <p className="text-xs text-muted">Notes</p>
            <p className="text-sm text-secondary mt-0.5">{notes}</p>
          </div>
        )}
      </div>
    );
  }

  const inputCls = "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph";
  const selectCls = inputCls;

  return (
    <div className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
      <h3 className="text-sm font-semibold text-secondary">Edit Subscription</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted">Tier</label>
          <select className={selectCls} value={form.subscription_tier} onChange={(e) => setForm((f) => ({ ...f, subscription_tier: e.target.value }))}>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Status</label>
          <select className={selectCls} value={form.subscription_status} onChange={(e) => setForm((f) => ({ ...f, subscription_status: e.target.value }))}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Max Users</label>
          <input type="number" min={1} className={inputCls} value={form.max_users} onChange={(e) => setForm((f) => ({ ...f, max_users: parseInt(e.target.value) || 1 }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Max Sites</label>
          <input type="number" min={1} className={inputCls} value={form.max_sites} onChange={(e) => setForm((f) => ({ ...f, max_sites: parseInt(e.target.value) || 1 }))} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted">Notes</label>
        <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Internal notes about this organization..." />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setEditing(false)} className="inline-flex items-center gap-2 rounded-lg bg-input-bg px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors border border-b-input">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
