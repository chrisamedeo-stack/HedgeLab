"use client";

import { useState } from "react";
import { useContracts, useCounterparties, useContractStore } from "@/hooks/useContracts";
import { useSites, useCommodities } from "@/hooks/usePositions";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";
import type {
  PhysicalContract,
  ContractStatus,
  ContractType,
  ContractDirection,
  ContractPricingType,
  ContractFilters,
} from "@/types/contracts";

const USER_ID = "00000000-0000-0000-0000-000000000099";

const statusStyle: Record<string, string> = {
  draft: "bg-hover text-muted",
  active: "bg-profit-10 text-profit",
  completed: "bg-action-10 text-action",
  cancelled: "bg-destructive-10 text-destructive",
};

const statusActions: Record<string, { label: string; action: string; className: string }[]> = {
  draft: [{ label: "Activate", action: "activate", className: "text-profit hover:bg-profit-10" }],
  active: [
    { label: "Complete", action: "complete", className: "text-action hover:bg-action-10" },
    { label: "Deliver", action: "deliver", className: "text-warning hover:bg-warning-10" },
  ],
};

export default function ContractsPage() {
  const { orgId } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<ContractType | "">("");
  const [counterpartyFilter, setCounterpartyFilter] = useState("");

  const filters: Partial<ContractFilters> = {};
  if (commodityId) filters.commodityId = commodityId;
  if (statusFilter) filters.status = statusFilter;
  if (typeFilter) filters.contractType = typeFilter;
  if (counterpartyFilter) filters.counterpartyId = counterpartyFilter;

  const { data: contracts, loading, error, refetch } = useContracts(orgId, filters);
  const { data: counterparties } = useCounterparties(orgId);
  const { data: sites } = useSites(orgId);
  const { data: commodities } = useCommodities();
  const { createContract, transitionContract, cancelContract } = useContractStore();

  const [showForm, setShowForm] = useState(false);
  const [deliverContractId, setDeliverContractId] = useState<string | null>(null);
  const [deliverVolume, setDeliverVolume] = useState("");

  const [form, setForm] = useState({
    counterpartyId: "",
    commodityId: commodityId ?? "",
    siteId: "",
    contractRef: "",
    contractType: "purchase" as ContractType,
    direction: "buy" as ContractDirection,
    pricingType: "fixed" as ContractPricingType,
    totalVolume: "",
    price: "",
    basisPrice: "",
    basisMonth: "",
    deliveryStart: "",
    deliveryEnd: "",
    deliveryLocation: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createContract({
        orgId,
        userId: USER_ID,
        counterpartyId: form.counterpartyId || undefined,
        commodityId: form.commodityId || undefined,
        siteId: form.siteId || undefined,
        contractRef: form.contractRef || undefined,
        contractType: form.contractType,
        direction: form.direction,
        pricingType: form.pricingType,
        totalVolume: Number(form.totalVolume),
        price: form.price ? Number(form.price) : undefined,
        basisPrice: form.basisPrice ? Number(form.basisPrice) : undefined,
        basisMonth: form.basisMonth || undefined,
        deliveryStart: form.deliveryStart || undefined,
        deliveryEnd: form.deliveryEnd || undefined,
        deliveryLocation: form.deliveryLocation || undefined,
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
      counterpartyId: "",
      commodityId: commodityId ?? "",
      siteId: "",
      contractRef: "",
      contractType: "purchase",
      direction: "buy",
      pricingType: "fixed",
      totalVolume: "",
      price: "",
      basisPrice: "",
      basisMonth: "",
      deliveryStart: "",
      deliveryEnd: "",
      deliveryLocation: "",
      notes: "",
    });
  }

  async function handleAction(contractId: string, action: string) {
    if (action === "deliver") {
      setDeliverContractId(contractId);
      return;
    }
    try {
      await transitionContract(contractId, USER_ID, action);
      refetch();
    } catch {
      // error handled by store
    }
  }

  async function handleDeliver() {
    if (!deliverContractId || !deliverVolume) return;
    try {
      await transitionContract(deliverContractId, USER_ID, "deliver", {
        volume: Number(deliverVolume),
      });
      setDeliverContractId(null);
      setDeliverVolume("");
      refetch();
    } catch {
      // error handled by store
    }
  }

  async function handleCancel(contractId: string) {
    if (!confirm("Cancel this contract?")) return;
    await cancelContract(contractId, USER_ID);
    refetch();
  }

  function deliveryPct(c: PhysicalContract): number {
    const total = Number(c.total_volume);
    if (total === 0) return 0;
    return Math.round((Number(c.delivered_volume) / total) * 100);
  }

  const inputClass =
    "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Physical Contracts</h1>
          <p className="mt-0.5 text-xs text-faint">
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""} &mdash; full lifecycle management
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

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ContractStatus | "")}
          className="bg-input-bg border border-b-input text-sm text-secondary rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ContractType | "")}
          className="bg-input-bg border border-b-input text-sm text-secondary rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value="">All Types</option>
          <option value="purchase">Purchase</option>
          <option value="sale">Sale</option>
        </select>
        <select
          value={counterpartyFilter}
          onChange={(e) => setCounterpartyFilter(e.target.value)}
          className="bg-input-bg border border-b-input text-sm text-secondary rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value="">All Counterparties</option>
          {counterparties.map((cp) => (
            <option key={cp.id} value={cp.id}>{cp.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {loading && contracts.length === 0 && (
        <div className="py-12 text-center text-sm text-faint">Loading contracts...</div>
      )}

      {/* Contracts Table */}
      {contracts.length > 0 ? (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-b-default">
              <tr>
                {["Ref", "Type", "Direction", "Counterparty", "Commodity", "Volume", "Delivery", "Price", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {contracts.map((c) => {
                const pct = deliveryPct(c);
                const actions = statusActions[c.status] ?? [];
                return (
                  <tr key={c.id} className="hover:bg-row-hover">
                    <td className="px-4 py-2.5 text-secondary font-mono text-xs">
                      {c.contract_ref ?? c.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5 text-muted capitalize">{c.contract_type}</td>
                    <td className="px-4 py-2.5">
                      <span className={c.direction === "buy" ? "text-profit font-medium" : "text-loss font-medium"}>
                        {c.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-secondary">{c.counterparty_name ?? "\u2014"}</td>
                    <td className="px-4 py-2.5 text-secondary">{c.commodity_name ?? "\u2014"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="tabular-nums text-secondary">
                          {Number(c.delivered_volume).toLocaleString()} / {Number(c.total_volume).toLocaleString()}
                        </span>
                        <div className="h-1.5 w-full max-w-[100px] rounded-full bg-input-bg overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-profit" : pct > 0 ? "bg-action" : "bg-input-bg"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted text-xs">
                      {c.delivery_start ? new Date(c.delivery_start).toLocaleDateString() : "\u2014"}
                      {c.delivery_end ? ` \u2013 ${new Date(c.delivery_end).toLocaleDateString()}` : ""}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-secondary">
                      {c.price != null ? `$${Number(c.price).toFixed(4)}` : c.pricing_type}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[c.status] ?? "bg-hover text-muted"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {actions.map((a) => (
                          <button
                            key={a.action}
                            onClick={() => handleAction(c.id, a.action)}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${a.className}`}
                          >
                            {a.label}
                          </button>
                        ))}
                        {c.status !== "cancelled" && c.status !== "completed" && (
                          <button
                            onClick={() => handleCancel(c.id)}
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
        <div className="bg-surface border border-b-default rounded-lg px-6 py-12 text-center">
          <p className="text-sm text-faint">No physical contracts yet</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-sm text-action hover:underline">
            Create your first contract
          </button>
        </div>
      )}

      {/* Delivery Modal */}
      {deliverContractId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDeliverContractId(null)}>
          <div className="w-full max-w-sm rounded-lg border border-b-default bg-main p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-primary mb-4">Record Delivery</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Volume Delivered</label>
                <input
                  type="number"
                  step="any"
                  value={deliverVolume}
                  onChange={(e) => setDeliverVolume(e.target.value)}
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeliverContractId(null)}
                  className="rounded-lg border border-b-input px-4 py-2 text-sm text-muted hover:bg-input-bg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeliver}
                  disabled={!deliverVolume}
                  className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50"
                >
                  Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Contract Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-lg border border-b-default bg-main p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-primary mb-4">New Physical Contract</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Contract Type *</label>
                  <select
                    required
                    value={form.contractType}
                    onChange={(e) => {
                      const ct = e.target.value as ContractType;
                      setForm({ ...form, contractType: ct, direction: ct === "purchase" ? "buy" : "sell" });
                    }}
                    className={inputClass}
                  >
                    <option value="purchase">Purchase</option>
                    <option value="sale">Sale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Counterparty</label>
                  <select value={form.counterpartyId} onChange={(e) => setForm({ ...form, counterpartyId: e.target.value })} className={inputClass}>
                    <option value="">Select counterparty</option>
                    {counterparties.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Commodity</label>
                  <select value={form.commodityId} onChange={(e) => setForm({ ...form, commodityId: e.target.value })} className={inputClass}>
                    <option value="">Select commodity</option>
                    {(commodities ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Site</label>
                  <select value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })} className={inputClass}>
                    <option value="">Select site</option>
                    {(sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Volume *</label>
                  <input required type="number" step="any" value={form.totalVolume} onChange={(e) => setForm({ ...form, totalVolume: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Pricing Type</label>
                  <select value={form.pricingType} onChange={(e) => setForm({ ...form, pricingType: e.target.value as ContractPricingType })} className={inputClass}>
                    <option value="fixed">Fixed</option>
                    <option value="basis">Basis</option>
                    <option value="formula">Formula</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Price</label>
                  <input type="number" step="any" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Contract Ref</label>
                  <input type="text" value={form.contractRef} onChange={(e) => setForm({ ...form, contractRef: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Delivery Start</label>
                  <input type="date" value={form.deliveryStart} onChange={(e) => setForm({ ...form, deliveryStart: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Delivery End</label>
                  <input type="date" value={form.deliveryEnd} onChange={(e) => setForm({ ...form, deliveryEnd: e.target.value })} className={inputClass} />
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
