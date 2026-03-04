"use client";

import { useState } from "react";
import { usePhysicals, useSites, useCommodities } from "@/hooks/usePositions";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { usePositionStore } from "@/store/positionStore";
import type { PhysicalPosition, CreatePhysicalParams, PhysicalDirection, PricingType } from "@/types/positions";

const USER_ID = "00000000-0000-0000-0000-000000000099";

const statusStyle: Record<string, string> = {
  open: "bg-profit-10 text-profit",
  filled: "bg-action-10 text-action",
  cancelled: "bg-destructive-10 text-destructive",
};

export default function ContractsPage() {
  const { orgId } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const params: Record<string, string> = { orgId };
  if (commodityId) params.commodityId = commodityId;
  const { data: physicals, loading, error, refetch } = usePhysicals(params);
  const { data: sites } = useSites(orgId);
  const { data: commodities } = useCommodities();
  const { createPhysical } = usePositionStore();
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    siteId: "",
    commodityId: commodityId ?? "",
    direction: "buy" as PhysicalDirection,
    volume: "",
    price: "",
    pricingType: "fixed" as PricingType,
    basisPrice: "",
    basisMonth: "",
    deliveryMonth: "",
    counterparty: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createPhysical({
        orgId: orgId,
        userId: USER_ID,
        siteId: form.siteId,
        commodityId: form.commodityId,
        direction: form.direction,
        volume: Number(form.volume),
        price: form.price ? Number(form.price) : undefined,
        pricingType: form.pricingType,
        basisPrice: form.basisPrice ? Number(form.basisPrice) : undefined,
        basisMonth: form.basisMonth || undefined,
        deliveryMonth: form.deliveryMonth || undefined,
        counterparty: form.counterparty || undefined,
      });
      setShowForm(false);
      setForm({ siteId: "", commodityId: commodityId ?? "", direction: "buy", volume: "", price: "", pricingType: "fixed", basisPrice: "", basisMonth: "", deliveryMonth: "", counterparty: "" });
      refetch();
    } catch {
      // error handled by store
    } finally {
      setSubmitting(false);
    }
  }

  // Group by delivery month
  const byMonth: Record<string, PhysicalPosition[]> = {};
  (physicals ?? []).forEach((p) => {
    const key = p.delivery_month ?? "Unscheduled";
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(p);
  });
  const months = Object.keys(byMonth).sort();

  return (
    <div className="space-y-6 page-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Physical Contracts</h1>
          <p className="mt-0.5 text-xs text-faint">
            {(physicals ?? []).length} contract{(physicals ?? []).length !== 1 ? "s" : ""} &mdash; buy/sell physical positions
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Contract
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {loading && (physicals ?? []).length === 0 && (
        <div className="py-12 text-center text-sm text-faint">Loading contracts...</div>
      )}

      {/* Contracts grouped by delivery month */}
      {months.length > 0 ? months.map((month) => (
        <div key={month} className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-b-default bg-input-bg/30">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{month}</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-b-default">
              <tr>
                {["Direction", "Volume", "Price", "Pricing", "Basis", "Counterparty", "Site", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {byMonth[month].map((p) => (
                <tr key={p.id} className="hover:bg-row-hover">
                  <td className="px-4 py-2.5">
                    <span className={p.direction === "buy" ? "text-profit font-medium" : "text-loss font-medium"}>
                      {p.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-secondary">{p.volume.toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-secondary">
                    {p.price != null ? `$${Number(p.price).toFixed(4)}` : "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{p.pricing_type}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted">
                    {p.basis_price != null ? `$${Number(p.basis_price).toFixed(4)}` : "\u2014"}
                    {p.basis_month ? ` (${p.basis_month})` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-secondary">{p.counterparty ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-muted">{p.site_id.slice(0, 8)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[p.status] ?? "bg-hover text-muted"}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )) : !loading && (
        <div className="bg-surface border border-b-default rounded-lg px-6 py-12 text-center">
          <p className="text-sm text-faint">No physical contracts yet</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-sm text-action hover:underline">Create your first contract</button>
        </div>
      )}

      {/* New Contract Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-lg border border-b-default bg-main p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-primary mb-4">New Physical Contract</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Site *</label>
                  <select required value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                    className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
                    <option value="">Select site</option>
                    {(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Commodity *</label>
                  <select required value={form.commodityId} onChange={(e) => setForm({ ...form, commodityId: e.target.value })}
                    className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
                    <option value="">Select commodity</option>
                    {(commodities ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Direction *</label>
                  <select required value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as PhysicalDirection })}
                    className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Volume *</label>
                  <input required type="number" step="any" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })}
                    className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Pricing Type</label>
                  <select value={form.pricingType} onChange={(e) => setForm({ ...form, pricingType: e.target.value as PricingType })}
                    className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
                    <option value="fixed">Fixed</option>
                    <option value="basis">Basis</option>
                    <option value="formula">Formula</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Price</label>
                  <input type="number" step="any" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Delivery Month</label>
                  <input type="text" placeholder="e.g. Z26" value={form.deliveryMonth} onChange={(e) => setForm({ ...form, deliveryMonth: e.target.value })}
                    className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Counterparty</label>
                  <input type="text" value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                    className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg border border-b-input px-4 py-2 text-sm text-muted hover:bg-input-bg transition-colors">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50">
                  {submitting ? "Creating..." : "Create Contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
