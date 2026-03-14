"use client";

import { useState } from "react";
import { useDeliveries, useInventory, useLogisticsStore } from "@/hooks/useLogistics";
import { useSites, useCommodities } from "@/hooks/usePositions";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import type { DeliveryStatus, DeliveryFilters } from "@/types/logistics";

const statusStyle: Record<string, string> = {
  scheduled: "bg-action-10 text-action",
  in_transit: "bg-warning-10 text-warning",
  delivered: "bg-profit-10 text-profit",
  cancelled: "bg-destructive-10 text-destructive",
};

const statusTransitions: Record<string, { label: string; next: DeliveryStatus; className: string }[]> = {
  scheduled: [
    { label: "In Transit", next: "in_transit", className: "text-warning hover:bg-warning-10" },
    { label: "Delivered", next: "delivered", className: "text-profit hover:bg-profit-10" },
  ],
  in_transit: [
    { label: "Delivered", next: "delivered", className: "text-profit hover:bg-profit-10" },
  ],
};

export default function LogisticsPage() {
  const { orgId } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "">("");
  const [siteFilter, setSiteFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [invSite, setInvSite] = useState("");

  const filters: Partial<DeliveryFilters> = {};
  if (commodityId) filters.commodityId = commodityId;
  if (statusFilter) filters.status = statusFilter;
  if (siteFilter) filters.siteId = siteFilter;

  const { data: deliveries, loading, error, refetch } = useDeliveries(orgId, filters);
  const { data: sites } = useSites(orgId);
  const { data: commodities } = useCommodities();
  const { updateDelivery, cancelDelivery } = useLogisticsStore();

  const { data: inventory } = useInventory(
    showInventory && invSite ? { siteId: invSite, orgId } : undefined
  );

  const [form, setForm] = useState({
    siteId: "",
    commodityId: commodityId ?? "",
    contractId: "",
    deliveryDate: "",
    volume: "",
    unit: "MT",
    status: "scheduled" as DeliveryStatus,
    carrier: "",
    origin: "",
    destination: "",
    freightCost: "",
    weightTicket: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { recordDelivery } = useLogisticsStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recordDelivery({
        orgId,
        userId: user!.id,
        siteId: form.siteId,
        commodityId: form.commodityId,
        contractId: form.contractId || undefined,
        deliveryDate: form.deliveryDate,
        volume: Number(form.volume),
        unit: form.unit,
        status: form.status,
        carrier: form.carrier || undefined,
        origin: form.origin || undefined,
        destination: form.destination || undefined,
        freightCost: form.freightCost ? Number(form.freightCost) : undefined,
        weightTicket: form.weightTicket || undefined,
        notes: form.notes || undefined,
      });
      setShowForm(false);
      resetForm();
      refetch();
    } catch {
      // error handled by store
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      siteId: "",
      commodityId: commodityId ?? "",
      contractId: "",
      deliveryDate: "",
      volume: "",
      unit: "MT",
      status: "scheduled",
      carrier: "",
      origin: "",
      destination: "",
      freightCost: "",
      weightTicket: "",
      notes: "",
    });
  }

  async function handleTransition(id: string, next: DeliveryStatus) {
    try {
      await updateDelivery(id, user!.id, { status: next });
      refetch();
    } catch {
      // error handled by store
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this delivery?")) return;
    await cancelDelivery(id, user!.id);
    refetch();
  }

  const inputClass =
    "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Logistics</h1>
          <p className="text-sm text-muted mt-0.5">
            {deliveries.length} delivery record{deliveries.length !== 1 ? "s" : ""} &mdash; track shipments &amp; inventory
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInventory(!showInventory)}
            className="inline-flex items-center gap-2 rounded-lg border border-b-input px-4 py-2 text-sm text-secondary hover:bg-input-bg transition-colors"
          >
            {showInventory ? "Hide" : "Show"} Inventory
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Record Delivery
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | "")}
          className="bg-input-bg border border-b-input text-sm text-secondary rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="bg-input-bg border border-b-input text-sm text-secondary rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value="">All Sites</option>
          {(sites ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {loading && deliveries.length === 0 && (
        <div className="py-12 text-center text-sm text-faint">Loading deliveries...</div>
      )}

      {/* Deliveries Table */}
      {deliveries.length > 0 ? (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-b-default">
              <tr>
                {["Date", "Site", "Commodity", "Volume", "Carrier", "Origin → Dest", "Ticket", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {deliveries.map((d) => {
                const transitions = statusTransitions[d.status] ?? [];
                return (
                  <tr key={d.id} className="hover:bg-row-hover">
                    <td className="px-4 py-2.5 text-secondary text-xs">
                      {new Date(d.delivery_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-secondary">{d.site_name ?? d.site_id.slice(0, 8)}</td>
                    <td className="px-4 py-2.5 text-secondary">{d.commodity_name ?? d.commodity_id}</td>
                    <td className="px-4 py-2.5 tabular-nums text-secondary">
                      {Number(d.volume).toLocaleString()} {d.unit}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{d.carrier ?? "\u2014"}</td>
                    <td className="px-4 py-2.5 text-muted text-xs">
                      {d.origin ?? "?"} → {d.destination ?? "?"}
                    </td>
                    <td className="px-4 py-2.5 text-muted font-mono text-xs">{d.weight_ticket ?? "\u2014"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[d.status] ?? "bg-hover text-muted"}`}>
                        {d.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {transitions.map((t) => (
                          <button
                            key={t.next}
                            onClick={() => handleTransition(d.id, t.next)}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${t.className}`}
                          >
                            {t.label}
                          </button>
                        ))}
                        {d.status !== "cancelled" && d.status !== "delivered" && (
                          <button
                            onClick={() => handleCancel(d.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-loss hover:bg-loss/10 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="rounded-lg border border-b-default bg-surface px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-input-bg text-faint">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12l-3 7H8m0 0l-1.5 6M8 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3H20" />
            </svg>
          </div>
          <p className="text-sm font-medium text-secondary">No deliveries recorded yet</p>
          <p className="mt-1 text-xs text-faint">Record your first delivery to start tracking logistics.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors">
            Record Delivery
          </button>
        </div>
      )}

      {/* Inline Record Delivery Form */}
      {showForm && (
        <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4">
          <h3 className="text-sm font-medium text-secondary mb-3">Record Delivery</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Site *</label>
                <select required value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })} className={inputClass}>
                  <option value="">Select site</option>
                  {(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Commodity *</label>
                <select required value={form.commodityId} onChange={(e) => setForm({ ...form, commodityId: e.target.value })} className={inputClass}>
                  <option value="">Select commodity</option>
                  {(commodities ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Delivery Date *</label>
                <input required type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Volume *</label>
                <input required type="number" step="any" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Unit</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass}>
                  <option value="MT">MT</option>
                  <option value="BU">BU</option>
                  <option value="LBS">LBS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DeliveryStatus })} className={inputClass}>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Carrier</label>
                <input type="text" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Freight Cost</label>
                <input type="number" step="any" value={form.freightCost} onChange={(e) => setForm({ ...form, freightCost: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Origin</label>
                <input type="text" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Destination</label>
                <input type="text" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Weight Ticket</label>
                <input type="text" value={form.weightTicket} onChange={(e) => setForm({ ...form, weightTicket: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-faint mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-b-input px-4 py-2 text-sm text-muted hover:bg-input-bg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50">
                {submitting ? "Recording..." : "Record Delivery"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inventory Section */}
      {showInventory && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">Inventory Snapshots</h2>
            <select
              value={invSite}
              onChange={(e) => setInvSite(e.target.value)}
              className="bg-input-bg border border-b-input text-sm text-secondary rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-focus"
            >
              <option value="">Select site</option>
              {(sites ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {invSite && inventory.length > 0 ? (
            <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-b-default">
                  <tr>
                    {["Date", "Commodity", "On Hand", "Committed", "Available", "Avg Cost"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-b-default">
                  {inventory.map((inv) => (
                    <tr key={inv.id} className="hover:bg-row-hover">
                      <td className="px-4 py-2.5 text-secondary text-xs">{new Date(inv.as_of_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-secondary">{inv.commodity_name ?? inv.commodity_id}</td>
                      <td className="px-4 py-2.5 tabular-nums text-secondary">{Number(inv.on_hand_volume).toLocaleString()} {inv.unit}</td>
                      <td className="px-4 py-2.5 tabular-nums text-muted">{Number(inv.committed_out).toLocaleString()}</td>
                      <td className="px-4 py-2.5 tabular-nums text-profit font-medium">{Number(inv.available).toLocaleString()}</td>
                      <td className="px-4 py-2.5 tabular-nums text-muted">{inv.avg_cost != null ? `$${Number(inv.avg_cost).toFixed(2)}` : "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : invSite ? (
            <div className="rounded-lg border border-b-default bg-surface px-6 py-8 text-center">
              <p className="text-sm text-muted">No inventory snapshots for this site</p>
            </div>
          ) : (
            <div className="rounded-lg border border-b-default bg-surface px-6 py-8 text-center">
              <p className="text-sm text-muted">Select a site to view inventory</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
