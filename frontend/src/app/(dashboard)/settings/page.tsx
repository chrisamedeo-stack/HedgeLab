"use client";

import React, { useState } from "react";
import {
  useAdminSites,
  useCommodities,
  useAppSettings,
  useSuppliers,
  useSiteSuppliers,
  useSiteCommodities,
  SiteResponse,
  CommodityResponse,
  SupplierResponse,
} from "@/hooks/useSettings";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
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
  Truck,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { btnPrimary, btnCancel } from "@/lib/corn-format";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const MONTH_ABBR = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const CATEGORIES = ["ENERGY","METALS","AGRICULTURAL","SOFTS","FREIGHT","ENVIRONMENTAL"];
const UOMS = ["BBL","MT","MMBTU","OZ_TROY","LB","KG","BUSHEL","MWH","LOT","GALLON"];

const CBOT_LETTERS: Record<string, string> = {
  H: "March", K: "May", N: "July", U: "September", Z: "December",
};

type Tab = "sites" | "suppliers" | "commodities" | "fiscal-year" | "futures-months";

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: "sites", label: "Sites", icon: Building2 },
  { key: "suppliers", label: "Suppliers", icon: Truck },
  { key: "commodities", label: "Commodities", icon: Wheat },
  { key: "fiscal-year", label: "Fiscal Year", icon: Calendar },
  { key: "futures-months", label: "Futures Months", icon: ArrowLeftRight },
];

// ─── Site Linking Panel ──────────────────────────────────────────────────────

function SiteLinkingPanel({ site }: { site: SiteResponse }) {
  const { suppliers: allSuppliers } = useSuppliers();
  const { commodities: allCommodities } = useCommodities();
  const { suppliers: linkedSuppliers, mutate: mutateSuppliers } = useSiteSuppliers(site.id);
  const { commodities: linkedCommodities, mutate: mutateCommodities } = useSiteCommodities(site.id);
  const { toast } = useToast();
  const [savingS, setSavingS] = useState(false);
  const [savingC, setSavingC] = useState(false);

  const linkedSupplierIds = new Set(linkedSuppliers.map((s) => s.id));
  const linkedCommodityIds = new Set(linkedCommodities.map((c) => c.id));

  async function toggleSupplier(supplierId: number) {
    setSavingS(true);
    const next = linkedSupplierIds.has(supplierId)
      ? Array.from(linkedSupplierIds).filter((id) => id !== supplierId)
      : Array.from(linkedSupplierIds).concat(supplierId);
    try {
      await api.put(`/api/v1/corn/sites/${site.id}/suppliers`, next);
      mutateSuppliers();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Failed to update suppliers", "error");
    } finally {
      setSavingS(false);
    }
  }

  async function toggleCommodity(commodityId: number) {
    setSavingC(true);
    const next = linkedCommodityIds.has(commodityId)
      ? Array.from(linkedCommodityIds).filter((id) => id !== commodityId)
      : Array.from(linkedCommodityIds).concat(commodityId);
    try {
      await api.put(`/api/v1/corn/sites/${site.id}/commodities`, next);
      mutateCommodities();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Failed to update commodities", "error");
    } finally {
      setSavingC(false);
    }
  }

  const activeSuppliers = allSuppliers.filter((s) => s.active);
  const activeCommodities = allCommodities.filter((c) => c.active);

  return (
    <div className="px-6 py-4 bg-main/40 border-t border-b-default/50 space-y-4">
      {/* Linked Suppliers */}
      <div>
        <p className="text-xs font-medium text-muted mb-2">Linked Suppliers {savingS && <span className="text-action ml-1">saving...</span>}</p>
        {activeSuppliers.length === 0 ? (
          <p className="text-xs text-ph">No suppliers configured yet</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {activeSuppliers.map((s) => {
              const linked = linkedSupplierIds.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSupplier(s.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    linked
                      ? "bg-action-20 text-action ring-1 ring-action-30"
                      : "bg-input-bg text-faint hover:text-secondary ring-1 ring-b-input"
                  )}
                >
                  {s.code} — {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Linked Commodities */}
      <div>
        <p className="text-xs font-medium text-muted mb-2">Linked Commodities {savingC && <span className="text-action ml-1">saving...</span>}</p>
        {activeCommodities.length === 0 ? (
          <p className="text-xs text-ph">No commodities configured yet</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {activeCommodities.map((c) => {
              const linked = linkedCommodityIds.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCommodity(c.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    linked
                      ? "bg-profit-20 text-profit ring-1 ring-profit-30"
                      : "bg-input-bg text-faint hover:text-secondary ring-1 ring-b-input"
                  )}
                >
                  {c.code} — {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sites Tab ────────────────────────────────────────────────────────────────

function SitesTab() {
  const { sites, isLoading, mutate } = useAdminSites();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SiteResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", country: "Canada", province: "" });
  const [expandedSiteId, setExpandedSiteId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function field(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function startEdit(s: SiteResponse) {
    setEditing(s);
    setForm({ code: s.code, name: s.name, country: s.country ?? "Canada", province: s.province ?? "" });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ code: "", name: "", country: "Canada", province: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { code: form.code, name: form.name, country: form.country, province: form.province || null };
      if (editing) {
        await api.put(`/api/v1/corn/sites/${editing.id}`, payload);
        toast("Site updated", "success");
      } else {
        await api.post("/api/v1/corn/sites", payload);
        toast("Site created", "success");
      }
      cancelForm();
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/v1/corn/sites/${deleteTarget.id}`);
      toast("Site deleted", "success");
      mutate();
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("referenced") || msg.includes("in use") || msg.includes("409")) {
        toast("Site is in use and cannot be deleted", "error");
      } else {
        toast(msg || "Delete failed", "error");
      }
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }

  const grouped: Record<string, SiteResponse[]> = {};
  for (const s of sites) {
    const key = s.country ?? "Other";
    (grouped[key] ??= []).push(s);
  }
  const countryOrder = ["Canada", "US", ...Object.keys(grouped).filter((k) => k !== "Canada" && k !== "US")];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{sites.length} sites configured · click a row to manage linked suppliers and commodities</p>
        <button
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          className={btnPrimary}
        >
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
            <div className="space-y-1">
              <label className="text-xs text-muted">Code</label>
              <input
                type="text" maxLength={10} required
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="e.g. GM1"
                value={form.code}
                onChange={(e) => field("code", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Name</label>
              <input
                type="text" maxLength={100} required
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="e.g. Gimli"
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Country</label>
              <select
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
                value={form.country}
                onChange={(e) => field("country", e.target.value)}
                required
              >
                <option value="Canada">Canada</option>
                <option value="US">US</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Province / State</label>
              <input
                type="text"
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="e.g. MB"
                value={form.province}
                onChange={(e) => field("province", e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelForm} className={btnCancel}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? "Saving..." : editing ? "Update Site" : "Create Site"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : sites.length === 0 ? (
        <EmptyState icon={Building2} title="No sites" description="Add your first site to get started." action={{ label: "Add Site", onClick: () => setShowForm(true) }} />
      ) : (
        countryOrder.filter((c) => grouped[c]?.length).map((country) => (
          <div key={country} className="space-y-2">
            <h3 className="text-xs font-semibold text-faint uppercase tracking-wider">{country}</h3>
            <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-input-bg/50 border-b border-b-default">
                    <th className="w-8" />
                    {["Code", "Name", "Province", ""].map((h) => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-b-default">
                  {grouped[country].map((s) => {
                    const expanded = expandedSiteId === s.id;
                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          className={cn("hover:bg-row-hover transition-colors cursor-pointer", expanded && "bg-row-hover")}
                          onClick={() => setExpandedSiteId(expanded ? null : s.id)}
                        >
                          <td className="px-2 py-3 text-center">
                            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-faint" /> : <ChevronRight className="h-3.5 w-3.5 text-faint" />}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-action">{s.code}</td>
                          <td className="px-3 py-3 text-secondary">{s.name}</td>
                          <td className="px-3 py-3 text-muted">{s.province ?? "\u2014"}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => startEdit(s)} className="text-ph hover:text-action transition-colors" title="Edit">
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeleteTarget(s)} className="text-ph hover:text-destructive transition-colors" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={5}>
                              <SiteLinkingPanel site={s} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Site"
        description={`Delete site "${deleteTarget?.code ?? ""} — ${deleteTarget?.name ?? ""}"? This cannot be undone. Sites that are in use by budgets or contracts cannot be deleted.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    </div>
  );
}

// ─── Suppliers Tab ───────────────────────────────────────────────────────────

function SuppliersTab() {
  const { suppliers, isLoading, mutate } = useSuppliers();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SupplierResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<SupplierResponse | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const defaultForm = { code: "", name: "", country: "", contactEmail: "", contactPhone: "" };
  const [form, setForm] = useState(defaultForm);

  function field(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function startEdit(s: SupplierResponse) {
    setEditing(s);
    setForm({
      code: s.code,
      name: s.name,
      country: s.country ?? "",
      contactEmail: s.contactEmail ?? "",
      contactPhone: s.contactPhone ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm(defaultForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        country: form.country || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
      };
      if (editing) {
        await api.put(`/api/v1/suppliers/${editing.id}`, payload);
        toast("Supplier updated", "success");
      } else {
        await api.post("/api/v1/suppliers", payload);
        toast("Supplier created", "success");
      }
      cancelForm();
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivateConfirm() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await api.delete(`/api/v1/suppliers/${deactivateTarget.id}`);
      toast(`${deactivateTarget.code} deactivated`, "success");
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Deactivation failed", "error");
    } finally {
      setDeactivating(false);
      setDeactivateTarget(null);
    }
  }

  async function handleActivate(s: SupplierResponse) {
    try {
      await api.put(`/api/v1/suppliers/${s.id}/activate`, {});
      toast(`${s.code} activated`, "success");
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Activation failed", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{suppliers.length} suppliers</p>
        <button
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          className={btnPrimary}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Supplier"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-secondary">
            {editing ? <>Edit <span className="text-action">{editing.code}</span></> : "New Supplier"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted">Code</label>
              <input type="text" maxLength={20} required
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="e.g. CARG" value={form.code} onChange={(e) => field("code", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Name</label>
              <input type="text" maxLength={200} required
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="e.g. Cargill" value={form.name} onChange={(e) => field("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Country</label>
              <input type="text"
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="e.g. Canada" value={form.country} onChange={(e) => field("country", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Email</label>
              <input type="email" maxLength={150}
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="contact@example.com" value={form.contactEmail} onChange={(e) => field("contactEmail", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Phone</label>
              <input type="tel" maxLength={30}
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="+1 204 555 0100" value={form.contactPhone} onChange={(e) => field("contactPhone", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelForm} className={btnCancel}>Cancel</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? "Saving..." : editing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <SkeletonTable rows={5} cols={7} />
      ) : suppliers.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers" description="Add your first supplier to get started." action={{ label: "Add Supplier", onClick: () => setShowForm(true) }} />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-input-bg/50 border-b border-b-default">
                {["Code", "Name", "Country", "Email", "Phone", "Active", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-row-hover transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-action">{s.code}</td>
                  <td className="px-3 py-3 text-secondary">{s.name}</td>
                  <td className="px-3 py-3 text-muted">{s.country ?? "\u2014"}</td>
                  <td className="px-3 py-3 text-muted text-xs">{s.contactEmail ?? "\u2014"}</td>
                  <td className="px-3 py-3 text-muted text-xs">{s.contactPhone ?? "\u2014"}</td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      s.active
                        ? "text-profit bg-profit-10 ring-1 ring-profit-20"
                        : "text-muted bg-hover/50 ring-1 ring-b-input"
                    )}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => startEdit(s)} className="text-ph hover:text-action transition-colors" title="Edit">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {s.active ? (
                        <button onClick={() => setDeactivateTarget(s)} className="text-ph hover:text-destructive transition-colors" title="Deactivate">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => handleActivate(s)} className="text-ph hover:text-profit transition-colors text-xs" title="Activate">
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate Supplier"
        description={`Deactivate supplier "${deactivateTarget?.code ?? ""} — ${deactivateTarget?.name ?? ""}"? You can reactivate it later.`}
        confirmLabel="Deactivate"
        variant="warning"
        onConfirm={handleDeactivateConfirm}
        onCancel={() => setDeactivateTarget(null)}
        loading={deactivating}
      />
    </div>
  );
}

// ─── Commodities Tab ──────────────────────────────────────────────────────────

function CommoditiesTab() {
  const { commodities, isLoading, mutate } = useCommodities();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CommodityResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<CommodityResponse | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const defaultForm = {
    code: "", name: "", category: "AGRICULTURAL", unitOfMeasure: "BUSHEL",
    currency: "USD", hedgeable: false, description: "", icisCode: "",
  };
  const [form, setForm] = useState(defaultForm);

  function field(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function startEdit(c: CommodityResponse) {
    setEditing(c);
    setForm({
      code: c.code, name: c.name, category: c.category,
      unitOfMeasure: c.unitOfMeasure, currency: c.currency,
      hedgeable: c.hedgeable, description: c.description ?? "",
      icisCode: c.icisCode ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm(defaultForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        code: form.code, name: form.name, category: form.category,
        unitOfMeasure: form.unitOfMeasure, currency: form.currency,
        hedgeable: form.hedgeable,
        description: form.description || null,
        icisCode: form.icisCode || null,
      };
      if (editing) {
        await api.put(`/api/v1/commodities/${editing.id}`, payload);
        toast("Commodity updated", "success");
      } else {
        await api.post("/api/v1/commodities", payload);
        toast("Commodity created", "success");
      }
      cancelForm();
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivateConfirm() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await api.delete(`/api/v1/commodities/${deactivateTarget.id}`);
      toast(`${deactivateTarget.code} deactivated`, "success");
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Deactivation failed", "error");
    } finally {
      setDeactivating(false);
      setDeactivateTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{commodities.length} commodities</p>
        <button
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          className={btnPrimary}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Commodity"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-secondary">
            {editing ? <>Edit <span className="text-action">{editing.code}</span></> : "New Commodity"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted">Code</label>
              <input type="text" maxLength={30} required
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="e.g. CORN-ZC" value={form.code} onChange={(e) => field("code", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Name</label>
              <input type="text" maxLength={100} required
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="e.g. Corn (CBOT)" value={form.name} onChange={(e) => field("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Category</label>
              <select className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
                value={form.category} onChange={(e) => field("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Unit of Measure</label>
              <select className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
                value={form.unitOfMeasure} onChange={(e) => field("unitOfMeasure", e.target.value)}>
                {UOMS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Currency</label>
              <input type="text" maxLength={3} required
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="USD" value={form.currency} onChange={(e) => field("currency", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">ICIS Code</label>
              <input type="text" maxLength={30}
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
                placeholder="Optional" value={form.icisCode} onChange={(e) => field("icisCode", e.target.value)} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.hedgeable}
                  onChange={(e) => field("hedgeable", e.target.checked)}
                  className="h-4 w-4 rounded border-b-input bg-input-bg text-action focus:ring-focus" />
                <span className="text-sm text-secondary">Hedgeable</span>
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Description</label>
            <input type="text" maxLength={500}
              className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
              placeholder="Optional description" value={form.description} onChange={(e) => field("description", e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelForm} className={btnCancel}>Cancel</button>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? "Saving..." : editing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <SkeletonTable rows={5} cols={8} />
      ) : commodities.length === 0 ? (
        <EmptyState icon={Wheat} title="No commodities" description="Add your first commodity." action={{ label: "Add Commodity", onClick: () => setShowForm(true) }} />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-input-bg/50 border-b border-b-default">
                {["Code", "Name", "Category", "UoM", "Currency", "Hedgeable", "Active", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {commodities.map((c) => (
                <tr key={c.id} className="hover:bg-row-hover transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-action">{c.code}</td>
                  <td className="px-3 py-3 text-secondary">{c.name}</td>
                  <td className="px-3 py-3 text-muted">{c.category}</td>
                  <td className="px-3 py-3 text-muted">{c.unitOfMeasure}</td>
                  <td className="px-3 py-3 text-muted">{c.currency}</td>
                  <td className="px-3 py-3">{c.hedgeable ? <span className="text-profit">Yes</span> : <span className="text-faint">No</span>}</td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      c.active
                        ? "text-profit bg-profit-10 ring-1 ring-profit-20"
                        : "text-muted bg-hover/50 ring-1 ring-b-input"
                    )}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => startEdit(c)} className="text-ph hover:text-action transition-colors" title="Edit">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {c.active && (
                        <button onClick={() => setDeactivateTarget(c)} className="text-ph hover:text-destructive transition-colors" title="Deactivate">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate Commodity"
        description={`Deactivate commodity "${deactivateTarget?.code ?? ""} — ${deactivateTarget?.name ?? ""}"? You can reactivate it later.`}
        confirmLabel="Deactivate"
        variant="warning"
        onConfirm={handleDeactivateConfirm}
        onCancel={() => setDeactivateTarget(null)}
        loading={deactivating}
      />
    </div>
  );
}

// ─── Fiscal Year Tab ──────────────────────────────────────────────────────────

function FiscalYearTab() {
  const { settings, isLoading, mutate } = useAppSettings();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const fySetting = settings.find((s) => s.settingKey === "FISCAL_YEAR_START_MONTH");
  const [month, setMonth] = useState<number | null>(null);

  // Sync from server once loaded
  const effectiveMonth = month ?? (fySetting ? parseInt(fySetting.value) : 7);

  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() + 1 >= effectiveMonth ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  const startLabel = MONTH_ABBR[effectiveMonth - 1];
  const endMonthIdx = effectiveMonth === 1 ? 11 : effectiveMonth - 2;
  const endLabel = MONTH_ABBR[endMonthIdx];

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/api/v1/settings/FISCAL_YEAR_START_MONTH", { value: String(effectiveMonth) });
      toast("Fiscal year start month updated", "success");
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <SkeletonTable rows={2} cols={2} />;

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-surface border border-b-default rounded-lg p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-secondary">Fiscal Year Start Month</h3>
          <p className="text-xs text-faint mt-1">
            The month when each fiscal year begins. Budget lines are grouped into fiscal years based on this setting.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted">Start Month</label>
          <select
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus"
            value={effectiveMonth}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>

        <div className="p-4 bg-input-bg/50 rounded-lg">
          <p className="text-xs text-faint mb-1">Preview</p>
          <p className="text-sm font-semibold text-secondary">
            FY {startYear}/{endYear} = {startLabel} {startYear} &ndash; {endLabel} {endYear}
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={btnPrimary}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="flex items-start gap-2 px-4 py-3 bg-warning-10 border border-warning-20 rounded-lg">
        <Calendar className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-warning">
          Changing the fiscal year start month affects how new budget lines are grouped. Existing budget lines will not be retroactively updated.
        </p>
      </div>
    </div>
  );
}

// ─── Futures Months Tab ───────────────────────────────────────────────────────

type MappingState = Record<string, number[]>;

function FuturesMonthsTab() {
  const { settings, isLoading, mutate } = useAppSettings();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<MappingState | null>(null);

  const fmSetting = settings.find((s) => s.settingKey === "FUTURES_MONTH_MAPPINGS");
  let mappings: MappingState = { H: [12, 1, 2], K: [3, 4], N: [5, 6], U: [7, 8], Z: [9, 10, 11] };
  try {
    if (fmSetting) mappings = JSON.parse(fmSetting.value);
  } catch { /* use defaults */ }

  const active = editMode && draft ? draft : mappings;

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(mappings)));
    setEditMode(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditMode(false);
  }

  function toggleMonth(letter: string, monthNum: number) {
    if (!draft) return;
    setDraft((prev) => {
      const next = { ...prev! };
      const arr = [...(next[letter] ?? [])];
      const idx = arr.indexOf(monthNum);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(monthNum);
      arr.sort((a, b) => a - b);
      next[letter] = arr;
      return next;
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await api.put("/api/v1/settings/FUTURES_MONTH_MAPPINGS", { value: JSON.stringify(draft) });
      toast("Futures month mappings updated", "success");
      setEditMode(false);
      setDraft(null);
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <SkeletonTable rows={5} cols={14} />;

  const letters = Object.keys(CBOT_LETTERS);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">CBOT ZC month codes mapped to physical delivery months</p>
        {!editMode ? (
          <button onClick={startEdit} className={btnPrimary}>
            <Edit2 className="h-4 w-4" /> Edit Mappings
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cancelEdit} className={btnCancel}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>
              {saving ? "Saving..." : "Save Mappings"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-input-bg/50 border-b border-b-default">
              <th className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">Letter</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">Contract</th>
              {MONTH_ABBR.map((m) => (
                <th key={m} className="px-2 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider w-12">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-b-default">
            {letters.map((letter) => (
              <tr key={letter} className="hover:bg-row-hover transition-colors">
                <td className="px-3 py-3 font-mono text-lg font-bold text-action">{letter}</td>
                <td className="px-3 py-3 text-secondary">{CBOT_LETTERS[letter]}</td>
                {MONTH_ABBR.map((_, i) => {
                  const monthNum = i + 1;
                  const isSelected = (active[letter] ?? []).includes(monthNum);
                  return (
                    <td key={i} className="px-2 py-3 text-center">
                      {editMode ? (
                        <button
                          type="button"
                          onClick={() => toggleMonth(letter, monthNum)}
                          className={cn(
                            "h-7 w-7 rounded-md text-xs font-medium transition-colors",
                            isSelected
                              ? "bg-action text-white"
                              : "bg-input-bg text-ph hover:bg-hover hover:text-muted"
                          )}
                        >
                          {MONTH_ABBR[i]}
                        </button>
                      ) : (
                        isSelected ? (
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-action-20 text-action text-xs font-medium">{MONTH_ABBR[i]}</span>
                        ) : (
                          <span className="text-ph">-</span>
                        )
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1">
        {letters.map((letter) => (
          <p key={letter} className="text-xs text-faint">
            <span className="font-mono text-muted">{letter}</span> = {CBOT_LETTERS[letter]} contract &rarr; {(active[letter] ?? []).map((m) => MONTH_ABBR[m - 1]).join(", ") || "none"}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("sites");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage sites, suppliers, commodities, fiscal year, and futures month mappings</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-6 border-b border-b-default">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === key
                ? "border-action text-action"
                : "border-transparent text-faint hover:text-secondary"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "sites" && <SitesTab />}
      {tab === "suppliers" && <SuppliersTab />}
      {tab === "commodities" && <CommoditiesTab />}
      {tab === "fiscal-year" && <FiscalYearTab />}
      {tab === "futures-months" && <FuturesMonthsTab />}
    </div>
  );
}
