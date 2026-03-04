"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "@/lib/api";
import {
  Settings,
  Plus,
  X,
  Edit2,
  Trash2,
  Building2,
  Wheat,
  Calendar,
  ArrowLeftRight,
  Shield,
  Key,
  Layers,
  Calculator,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormulaCard } from "@/components/pricing/FormulaCard";
import { FormulaBuilder } from "@/components/pricing/FormulaBuilder";
import { TemplateSelector } from "@/components/pricing/TemplateSelector";
import { RateTableEditor } from "@/components/pricing/RateTableEditor";
import { FormulaEvaluator } from "@/components/pricing/FormulaEvaluator";
import { usePricingStore } from "@/store/pricingStore";
import type { FormulaRow, RateTable, FormulaTemplate } from "@/types/pricing";
import type { FormulaComponent } from "@/lib/pricingEngine";

import { useOrgContext } from "@/contexts/OrgContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_ABBR = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const CATEGORIES = ["ag","energy","metals","softs","freight","environmental"];
const UOMS = ["bushels","MT","BBL","MMBTU","OZ_TROY","LB","KG","MWH","LOT","GALLON","short tons","pounds"];

const CBOT_LETTERS: Record<string, string> = {
  H: "March", K: "May", N: "July", U: "September", Z: "December",
};

type Tab = "sites" | "site-groups" | "commodities" | "fiscal-year" | "futures-months" | "users" | "pricing";

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: "sites", label: "Sites", icon: Building2 },
  { key: "site-groups", label: "Site Groups", icon: Layers },
  { key: "commodities", label: "Commodities", icon: Wheat },
  { key: "fiscal-year", label: "Fiscal Year", icon: Calendar },
  { key: "futures-months", label: "Futures Months", icon: ArrowLeftRight },
  { key: "users", label: "Users", icon: Shield },
  { key: "pricing", label: "Pricing", icon: Calculator },
];

const ROLES = ["admin", "risk_manager", "trader", "read_only"];
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", risk_manager: "Risk Manager", trader: "Trader", read_only: "Read Only",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive-15 text-destructive",
  risk_manager: "bg-action-20 text-action",
  trader: "bg-profit-20 text-profit",
  read_only: "bg-input-bg text-muted",
};

const btnPrimary = "inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50";
const btnCancel = "inline-flex items-center gap-2 rounded-lg bg-input-bg px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors border border-b-input";
const inputCls = "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph";
const selectCls = inputCls;

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Shared fetch helpers ────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.message || body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Sites Tab ────────────────────────────────────────────────────────────────

function SitesTab() {
  const { orgId } = useOrgContext();
  const [sites, setSites] = useState<any[]>([]);
  const [siteTypes, setSiteTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({ code: "", name: "", region: "", siteTypeId: "" });

  const load = useCallback(async () => {
    try {
      const [sitesData, typesData] = await Promise.all([
        apiFetch(`/api/v2/kernel/sites?orgId=${orgId}`),
        apiFetch("/api/v2/kernel/site-types"),
      ]);
      setSites(sitesData);
      setSiteTypes(typesData ?? []);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function field(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function startEdit(s: any) {
    setEditing(s);
    setForm({ code: s.code ?? "", name: s.name, region: s.region ?? "", siteTypeId: s.site_type_id ?? "elevator" });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false); setEditing(null);
    setForm({ code: "", name: "", region: "", siteTypeId: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      const payload = { orgId: orgId, code: form.code, name: form.name, region: form.region || null, siteTypeId: form.siteTypeId };
      if (editing) {
        await apiFetch(`/api/v2/kernel/sites/${editing.id}`, { method: "PUT", body: JSON.stringify({ ...payload, id: editing.id }) });
      } else {
        await apiFetch("/api/v2/kernel/sites", { method: "POST", body: JSON.stringify(payload) });
      }
      cancelForm(); load();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/v2/kernel/sites/${deleteTarget.id}`, { method: "DELETE" });
      load();
    } catch (err) { setError((err as Error).message); }
    finally { setDeleteTarget(null); }
  }

  const grouped: Record<string, any[]> = {};
  for (const s of sites) { const key = s.region ?? "Other"; (grouped[key] ??= []).push(s); }
  const regions = Object.keys(grouped).sort();

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1"><label className="text-xs text-muted">Code</label>
              <input type="text" maxLength={20} required className={inputCls} placeholder="e.g. LETH" value={form.code} onChange={e => field("code", e.target.value)} />
            </div>
            <div className="space-y-1"><label className="text-xs text-muted">Name</label>
              <input type="text" maxLength={200} required className={inputCls} placeholder="e.g. Lethbridge Elevator" value={form.name} onChange={e => field("name", e.target.value)} />
            </div>
            <div className="space-y-1"><label className="text-xs text-muted">Region</label>
              <input type="text" className={inputCls} placeholder="e.g. Alberta" value={form.region} onChange={e => field("region", e.target.value)} />
            </div>
            <div className="space-y-1"><label className="text-xs text-muted">Site Type</label>
              <select className={selectCls} value={form.siteTypeId} onChange={e => field("siteTypeId", e.target.value)}>
                <option value="">Select...</option>
                {siteTypes.map(st => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
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
        regions.map(region => (
          <div key={region} className="space-y-2">
            <h3 className="text-xs font-semibold text-faint uppercase tracking-wider">{region}</h3>
            <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-input-bg/50 border-b border-b-default">
                    {["Code","Name","Type",""].map(h => <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-b-default">
                  {grouped[region].map((s: any) => (
                    <tr key={s.id} className="hover:bg-row-hover transition-colors">
                      <td className="px-3 py-3 font-mono text-xs text-action">{s.code}</td>
                      <td className="px-3 py-3 text-secondary">{s.name}</td>
                      <td className="px-3 py-3 text-muted">{s.site_type_id ?? "\u2014"}</td>
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

// ─── Site Groups Tab ─────────────────────────────────────────────────────────

function SiteGroupsTab() {
  const { orgId } = useOrgContext();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", groupType: "region" });

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v2/kernel/site-groups?orgId=${orgId}`);
      setGroups(data);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch("/api/v2/kernel/site-groups", {
        method: "POST",
        body: JSON.stringify({ orgId: orgId, name: form.name, groupType: form.groupType }),
      });
      setShowForm(false); setForm({ name: "", groupType: "region" }); load();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button></div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{groups.length} site groups</p>
        <button onClick={() => setShowForm(!showForm)} className={btnPrimary}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Group"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-secondary">New Site Group</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-xs text-muted">Name</label>
              <input type="text" required className={inputCls} placeholder="e.g. Western Canada" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1"><label className="text-xs text-muted">Type</label>
              <select className={selectCls} value={form.groupType} onChange={e => setForm(f => ({ ...f, groupType: e.target.value }))}>
                <option value="region">Region</option>
                <option value="business_unit">Business Unit</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className={btnCancel}>Cancel</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>{submitting ? "Saving..." : "Create"}</button>
          </div>
        </form>
      )}

      {loading ? <TableSkeleton /> : groups.length === 0 ? (
        <EmptyState title="No site groups" desc="Add your first site group." onAction={() => setShowForm(true)} actionLabel="Add Group" />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-input-bg/50 border-b border-b-default">
              {["Name","Type","Sites","Active"].map(h => <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-b-default">
              {groups.map((g: any) => (
                <tr key={g.id} className="hover:bg-row-hover transition-colors">
                  <td className="px-3 py-3 font-medium text-secondary">{g.name}</td>
                  <td className="px-3 py-3 text-muted">{g.group_type ?? g.groupType}</td>
                  <td className="px-3 py-3 text-muted">{g.sites?.length ?? 0} sites</td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                      (g.is_active ?? g.isActive) ? "text-profit bg-profit-10 ring-1 ring-profit-20" : "text-muted bg-hover/50")}>
                      {(g.is_active ?? g.isActive) ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Commodities Tab ──────────────────────────────────────────────────────────

function CommoditiesTab() {
  const [commodities, setCommodities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", name: "", category: "ag", unit: "bushels", currency: "USD", contractSize: "5000", exchange: "CBOT" });

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/v2/kernel/commodities");
      setCommodities(data);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{commodities.length} commodities</p>
      </div>

      {loading ? <TableSkeleton /> : commodities.length === 0 ? (
        <EmptyState title="No commodities" desc="No commodities configured." />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-input-bg/50 border-b border-b-default">
              {["Code","Name","Category","Unit","Currency","Exchange","Contract Size","Active"].map(h =>
                <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-b-default">
              {commodities.map((c: any) => (
                <tr key={c.id} className="hover:bg-row-hover transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-action">{c.id}</td>
                  <td className="px-3 py-3 text-secondary">{c.name}</td>
                  <td className="px-3 py-3 text-muted">{c.category}</td>
                  <td className="px-3 py-3 text-muted">{c.unit}</td>
                  <td className="px-3 py-3 text-muted">{c.currency}</td>
                  <td className="px-3 py-3 text-muted">{c.exchange ?? "\u2014"}</td>
                  <td className="px-3 py-3 text-muted font-mono">{c.contract_size?.toLocaleString() ?? "\u2014"}</td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                      (c.is_active ?? true) ? "text-profit bg-profit-10 ring-1 ring-profit-20" : "text-muted bg-hover/50")}>
                      {(c.is_active ?? true) ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Fiscal Year Tab ──────────────────────────────────────────────────────────

function FiscalYearTab() {
  const { orgId } = useOrgContext();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/v2/kernel/org-settings?orgId=${orgId}`)
      .then(data => {
        setSettings(data);
        const fy = data?.config?.fiscal_year_start_month ?? data?.config?.fiscalYearStartMonth;
        if (fy) setMonth(fy);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() + 1 >= month ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  const startLabel = MONTH_ABBR[month - 1];
  const endMonthIdx = month === 1 ? 11 : month - 2;
  const endLabel = MONTH_ABBR[endMonthIdx];

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/api/v2/kernel/org-settings`, {
        method: "PUT",
        body: JSON.stringify({
          orgId: orgId,
          config: { ...(settings?.config ?? {}), fiscal_year_start_month: month },
        }),
      });
      setError(null);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <TableSkeleton />;

  return (
    <div className="max-w-lg space-y-6">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      <div className="bg-surface border border-b-default rounded-lg p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-secondary">Fiscal Year Start Month</h3>
          <p className="text-xs text-faint mt-1">The month when each fiscal year begins. Budget lines are grouped into fiscal years based on this setting.</p>
        </div>
        <div className="space-y-1"><label className="text-xs text-muted">Start Month</label>
          <select className={selectCls} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
          </select>
        </div>
        <div className="p-4 bg-input-bg/50 rounded-lg">
          <p className="text-xs text-faint mb-1">Preview</p>
          <p className="text-sm font-semibold text-secondary">FY {startYear}/{endYear} = {startLabel} {startYear} &ndash; {endLabel} {endYear}</p>
        </div>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
      </div>
      <div className="flex items-start gap-2 px-4 py-3 bg-warning-10 border border-warning-20 rounded-lg">
        <Calendar className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-warning">Changing the fiscal year start month affects how new budget lines are grouped. Existing budget lines will not be retroactively updated.</p>
      </div>
    </div>
  );
}

// ─── Futures Months Tab ───────────────────────────────────────────────────────

type MappingState = Record<string, number[]>;

function FuturesMonthsTab() {
  const { orgId } = useOrgContext();
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultMappings: MappingState = { H: [12, 1, 2], K: [3, 4], N: [5, 6], U: [7, 8], Z: [9, 10, 11] };
  const [mappings, setMappings] = useState<MappingState>(defaultMappings);
  const [draft, setDraft] = useState<MappingState | null>(null);

  useEffect(() => {
    apiFetch(`/api/v2/kernel/org-settings?orgId=${orgId}`)
      .then(data => {
        const fm = data?.config?.futures_month_mappings ?? data?.config?.futuresMonthMappings;
        if (fm && typeof fm === "object") setMappings(fm);
      })
      .catch(() => {});
  }, []);

  const active = editMode && draft ? draft : mappings;

  function startEdit() { setDraft(JSON.parse(JSON.stringify(mappings))); setEditMode(true); }
  function cancelEdit() { setDraft(null); setEditMode(false); }

  function toggleMonth(letter: string, monthNum: number) {
    if (!draft) return;
    setDraft(prev => {
      const next = { ...prev! };
      const arr = [...(next[letter] ?? [])];
      const idx = arr.indexOf(monthNum);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(monthNum);
      arr.sort((a, b) => a - b);
      next[letter] = arr;
      return next;
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const current = await apiFetch(`/api/v2/kernel/org-settings?orgId=${orgId}`);
      await apiFetch(`/api/v2/kernel/org-settings`, {
        method: "PUT",
        body: JSON.stringify({ orgId: orgId, config: { ...(current?.config ?? {}), futures_month_mappings: draft } }),
      });
      setMappings(draft); setEditMode(false); setDraft(null);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  const letters = Object.keys(CBOT_LETTERS);

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">CBOT contract codes mapped to physical delivery months</p>
        {!editMode ? (
          <button onClick={startEdit} className={btnPrimary}><Edit2 className="h-4 w-4" /> Edit Mappings</button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cancelEdit} className={btnCancel}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save Mappings"}</button>
          </div>
        )}
      </div>

      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-input-bg/50 border-b border-b-default">
            <th className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">Letter</th>
            <th className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">Contract</th>
            {MONTH_ABBR.map(m => <th key={m} className="px-2 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider w-12">{m}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-b-default">
            {letters.map(letter => (
              <tr key={letter} className="hover:bg-row-hover transition-colors">
                <td className="px-3 py-3 font-mono text-lg font-bold text-action">{letter}</td>
                <td className="px-3 py-3 text-secondary">{CBOT_LETTERS[letter]}</td>
                {MONTH_ABBR.map((_, i) => {
                  const monthNum = i + 1;
                  const isSelected = (active[letter] ?? []).includes(monthNum);
                  return (
                    <td key={i} className="px-2 py-3 text-center">
                      {editMode ? (
                        <button type="button" onClick={() => toggleMonth(letter, monthNum)}
                          className={cn("h-7 w-7 rounded-md text-xs font-medium transition-colors",
                            isSelected ? "bg-action text-white" : "bg-input-bg text-ph hover:bg-hover hover:text-muted")}>
                          {MONTH_ABBR[i]}
                        </button>
                      ) : isSelected ? (
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-action-20 text-action text-xs font-medium">{MONTH_ABBR[i]}</span>
                      ) : <span className="text-ph">-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1">
        {letters.map(letter => (
          <p key={letter} className="text-xs text-faint">
            <span className="font-mono text-muted">{letter}</span> = {CBOT_LETTERS[letter]} contract &rarr; {(active[letter] ?? []).map(m => MONTH_ABBR[m - 1]).join(", ") || "none"}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab() {
  const { orgId } = useOrgContext();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm] = useState({ username: "", email: "", role: "trader", enabled: true });

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/v2/kernel/users?orgId=${orgId}`);
      setUsers(data);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(u: any) {
    setEditing(u);
    setForm({ username: u.username, email: u.email ?? "", role: u.role ?? "trader", enabled: u.enabled ?? u.is_active ?? true });
    setShowForm(false);
  }

  function cancelAll() {
    setShowForm(false); setEditing(null);
    setForm({ username: "", email: "", role: "trader", enabled: true });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch("/api/v2/kernel/users", {
        method: "POST",
        body: JSON.stringify({ orgId: orgId, username: form.username, email: form.email || null, role: form.role }),
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
        body: JSON.stringify({ email: form.email || null, role: form.role, enabled: form.enabled }),
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
            <div className="space-y-1"><label className="text-xs text-muted">Username</label>
              <input type="text" required maxLength={50} className={inputCls} placeholder="jsmith" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
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
          <h3 className="text-sm font-semibold text-secondary">Edit <span className="text-action">{editing.username}</span></h3>
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
                  <td className="px-3 py-3 font-medium text-secondary">{u.username}</td>
                  <td className="px-3 py-3 text-muted">{u.email ?? "\u2014"}</td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", ROLE_COLORS[u.role] ?? "bg-input-bg text-muted")}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                      (u.enabled ?? u.is_active) ? "bg-profit-20 text-profit" : "bg-input-bg text-faint")}>
                      {(u.enabled ?? u.is_active) ? "Active" : "Disabled"}
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
        <ConfirmDialog title="Delete User" desc={`Delete user "${deleteTarget.username}"? This cannot be undone.`}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

// ─── Pricing Tab ─────────────────────────────────────────────────────────────

type PricingSubTab = "formulas" | "rate-tables" | "evaluator";

function PricingTab() {
  const { orgId } = useOrgContext();
  const [subTab, setSubTab] = useState<PricingSubTab>("formulas");
  const [commodities, setCommodities] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Store
  const {
    formulas, rateTables, templates, loading,
    fetchFormulas, fetchRateTables, fetchTemplates,
    createFormula, updateFormula, deleteFormula, duplicateFormula,
    createRateTable, updateRateTable, deleteRateTable,
    instantiateTemplate,
  } = usePricingStore();

  // Modal state
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showRateTableModal, setShowRateTableModal] = useState(false);
  const [editingFormula, setEditingFormula] = useState<FormulaRow | null>(null);
  const [editingRateTable, setEditingRateTable] = useState<RateTable | null>(null);
  const [templatePrefill, setTemplatePrefill] = useState<FormulaTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "formula" | "rateTable"; id: string; name: string } | null>(null);
  // Evaluator: jump to evaluator with pre-selected formula
  const [evalFormulaId, setEvalFormulaId] = useState<string | undefined>();

  // Load data
  useEffect(() => {
    fetchFormulas(orgId);
    fetchRateTables(orgId);
    fetchTemplates();
    apiFetch("/api/v2/kernel/commodities")
      .then((data: any[]) => setCommodities(data.map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Formula CRUD
  async function handleSaveFormula(data: {
    name: string; description: string; commodityId: string | null;
    formulaType: string; components: FormulaComponent[];
    outputUnit: string | null; rounding: number;
  }) {
    setSaving(true);
    try {
      if (editingFormula) {
        await updateFormula(editingFormula.id, data);
      } else {
        await createFormula({ orgId: orgId, ...data, description: data.description || undefined, commodityId: data.commodityId ?? undefined, outputUnit: data.outputUnit ?? undefined });
      }
      setShowFormulaModal(false);
      setEditingFormula(null);
      setTemplatePrefill(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleEditFormula(f: FormulaRow) {
    setEditingFormula(f);
    setTemplatePrefill(null);
    setShowFormulaModal(true);
  }

  async function handleDuplicateFormula(f: FormulaRow) {
    try {
      await duplicateFormula(f.id, orgId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleTestFormula(f: FormulaRow) {
    setEvalFormulaId(f.id);
    setSubTab("evaluator");
  }

  function handleDeactivateFormula(f: FormulaRow) {
    setDeleteTarget({ type: "formula", id: f.id, name: f.name });
  }

  // Template instantiation
  async function handleSelectTemplate(t: FormulaTemplate) {
    setShowTemplateModal(false);
    try {
      await instantiateTemplate(t.id, orgId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleFromTemplatePrefill(t: FormulaTemplate) {
    setShowTemplateModal(false);
    setEditingFormula(null);
    setTemplatePrefill(t);
    setShowFormulaModal(true);
  }

  // Rate table CRUD
  async function handleSaveRateTable(data: {
    name: string; rateType: string; commodityId: string | null;
    rates: Record<string, number>;
    effectiveDate: string | null; expiryDate: string | null;
  }) {
    setSaving(true);
    try {
      if (editingRateTable) {
        await updateRateTable(editingRateTable.id, data);
      } else {
        await createRateTable({ orgId: orgId, ...data, commodityId: data.commodityId ?? undefined, effectiveDate: data.effectiveDate ?? undefined, expiryDate: data.expiryDate ?? undefined });
      }
      setShowRateTableModal(false);
      setEditingRateTable(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "formula") {
        await deleteFormula(deleteTarget.id);
      } else {
        await deleteRateTable(deleteTarget.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  }

  const subTabs: { key: PricingSubTab; label: string }[] = [
    { key: "formulas", label: "Formulas" },
    { key: "rate-tables", label: "Rate Tables" },
    { key: "evaluator", label: "Evaluator" },
  ];

  // Build initial data for FormulaBuilder when using template prefill
  const formulaBuilderInitial: FormulaRow | null = editingFormula ?? (templatePrefill ? {
    id: "", org_id: orgId, name: templatePrefill.name,
    description: templatePrefill.description, commodity_id: null,
    formula_type: templatePrefill.formulaType,
    components: templatePrefill.components,
    output_unit: templatePrefill.outputUnit, rounding: 4,
    is_active: true, is_system: false, created_at: "", updated_at: "",
  } : null);

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button></div>}

      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-b-default">
        {subTabs.map((st) => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            className={cn(
              "pb-2 px-1 text-sm font-medium transition-colors border-b-2 -mb-px",
              subTab === st.key ? "border-action text-action" : "border-transparent text-faint hover:text-secondary"
            )}>
            {st.label}
          </button>
        ))}
      </div>

      {/* Formulas sub-tab */}
      {subTab === "formulas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{formulas.length} formulas</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowTemplateModal(true)} className={btnCancel}>
                From Template
              </button>
              <button onClick={() => { setEditingFormula(null); setTemplatePrefill(null); setShowFormulaModal(true); }} className={btnPrimary}>
                <Plus className="h-4 w-4" /> New Formula
              </button>
            </div>
          </div>

          {loading ? <TableSkeleton /> : formulas.length === 0 ? (
            <EmptyState title="No formulas" desc="Create a formula or start from a template."
              onAction={() => setShowTemplateModal(true)} actionLabel="From Template" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {formulas.map((f) => (
                <FormulaCard key={f.id} formula={f}
                  onEdit={() => handleEditFormula(f)}
                  onDuplicate={() => handleDuplicateFormula(f)}
                  onTest={() => handleTestFormula(f)}
                  onDeactivate={() => handleDeactivateFormula(f)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rate Tables sub-tab */}
      {subTab === "rate-tables" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{rateTables.length} rate tables</p>
            <button onClick={() => { setEditingRateTable(null); setShowRateTableModal(true); }} className={btnPrimary}>
              <Plus className="h-4 w-4" /> New Rate Table
            </button>
          </div>

          {loading ? <TableSkeleton /> : rateTables.length === 0 ? (
            <EmptyState title="No rate tables" desc="Create rate tables for lookups in pricing formulas."
              onAction={() => setShowRateTableModal(true)} actionLabel="New Rate Table" />
          ) : (
            <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-input-bg/50 border-b border-b-default">
                    {["Name", "Type", "Commodity", "Rates", "Effective", "Expiry", ""].map((h) => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-b-default">
                  {rateTables.map((t) => (
                    <tr key={t.id} className="hover:bg-row-hover transition-colors">
                      <td className="px-3 py-3 font-medium text-secondary">{t.name}</td>
                      <td className="px-3 py-3 text-muted">{t.rate_type}</td>
                      <td className="px-3 py-3 text-muted">{t.commodity_id ?? "All"}</td>
                      <td className="px-3 py-3 text-muted font-mono text-xs">{Object.keys(t.rates).length} entries</td>
                      <td className="px-3 py-3 text-muted text-xs">{t.effective_date ?? "\u2014"}</td>
                      <td className="px-3 py-3 text-muted text-xs">{t.expiry_date ?? "\u2014"}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setEditingRateTable(t); setShowRateTableModal(true); }}
                            className="text-ph hover:text-action transition-colors" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget({ type: "rateTable", id: t.id, name: t.name })}
                            className="text-ph hover:text-destructive transition-colors" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Evaluator sub-tab */}
      {subTab === "evaluator" && (
        <FormulaEvaluator formulas={formulas} />
      )}

      {/* Formula Builder Modal */}
      <Modal open={showFormulaModal} onClose={() => { setShowFormulaModal(false); setEditingFormula(null); setTemplatePrefill(null); }}
        title={editingFormula ? "Edit Formula" : templatePrefill ? `New Formula (from ${templatePrefill.name})` : "New Formula"}
        width="max-w-3xl">
        <FormulaBuilder
          initial={formulaBuilderInitial}
          rateTables={rateTables}
          commodities={commodities}
          saving={saving}
          onSave={handleSaveFormula}
          onCancel={() => { setShowFormulaModal(false); setEditingFormula(null); setTemplatePrefill(null); }}
        />
      </Modal>

      {/* Template Selector Modal */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)}
        title="Choose a Template" width="max-w-2xl">
        <div className="space-y-3">
          <p className="text-xs text-muted">Select a template to pre-fill a new formula, or click to create instantly.</p>
          <TemplateSelector templates={templates} onSelect={handleFromTemplatePrefill} />
        </div>
      </Modal>

      {/* Rate Table Editor Modal */}
      <Modal open={showRateTableModal} onClose={() => { setShowRateTableModal(false); setEditingRateTable(null); }}
        title={editingRateTable ? "Edit Rate Table" : "New Rate Table"} width="max-w-2xl">
        <RateTableEditor
          initial={editingRateTable}
          commodities={commodities}
          saving={saving}
          onSave={handleSaveRateTable}
          onCancel={() => { setShowRateTableModal(false); setEditingRateTable(null); }}
        />
      </Modal>

      {/* Confirm Delete */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Deactivate ${deleteTarget.type === "formula" ? "Formula" : "Rate Table"}`}
          desc={`Deactivate "${deleteTarget.name}"? It will no longer appear in lists.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="bg-surface border border-b-default rounded-lg overflow-hidden animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4 border-b border-b-default last:border-0">
          <div className="h-4 bg-hover rounded w-20" /><div className="h-4 bg-hover rounded w-40" /><div className="h-4 bg-hover rounded w-24" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, desc, onAction, actionLabel }: { title: string; desc: string; onAction?: () => void; actionLabel?: string }) {
  return (
    <div className="bg-surface border border-b-default rounded-lg p-12 text-center">
      <p className="text-sm font-medium text-secondary">{title}</p>
      <p className="text-xs text-faint mt-1">{desc}</p>
      {onAction && actionLabel && (
        <button onClick={onAction} className={cn(btnPrimary, "mt-4")}><Plus className="h-4 w-4" /> {actionLabel}</button>
      )}
    </div>
  );
}

function ConfirmDialog({ title, desc, onConfirm, onCancel }: { title: string; desc: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-b-default rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-sm font-semibold text-secondary">{title}</h3>
        <p className="text-sm text-muted">{desc}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={btnCancel}>Cancel</button>
          <button onClick={onConfirm} className="inline-flex items-center gap-2 rounded-lg bg-loss px-4 py-2 text-sm font-medium text-white hover:bg-loss/80 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("sites");

  return (
    <div className="space-y-6 page-fade">
      <div>
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Settings</h1>
        <p className="mt-0.5 text-xs text-faint">Manage sites, groups, commodities, fiscal year, and users</p>
      </div>

      <div className="flex gap-6 border-b border-b-default">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === key ? "border-action text-action" : "border-transparent text-faint hover:text-secondary"
            )}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === "sites" && <SitesTab />}
      {tab === "site-groups" && <SiteGroupsTab />}
      {tab === "commodities" && <CommoditiesTab />}
      {tab === "fiscal-year" && <FiscalYearTab />}
      {tab === "futures-months" && <FuturesMonthsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "pricing" && <PricingTab />}
    </div>
  );
}
